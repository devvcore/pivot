/**
 * Defensive Harness for Agent Execution
 *
 * Inspired by BetterBot's defensive patterns. Catches and corrects common LLM
 * mistakes: hallucinated tool names, misspelled arg names, wrong arg types,
 * lazy responses, and hallucinated responses that ignore tool output.
 */

// ── 1. Fuzzy Tool Matching ──────────────────────────────────────────────────

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * When the LLM hallucinates a tool name (e.g. "read" instead of "read_file",
 * "search" instead of "web_search"), find the closest match from available tools
 * using Levenshtein distance + substring matching.
 *
 * Returns null if no reasonable match is found (distance too high).
 */
export function fuzzyMatchTool(
  hallucinated: string,
  availableTools: string[]
): string | null {
  if (availableTools.length === 0) return null;

  const h = hallucinated.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!h) return null;

  // Exact match check (case-insensitive)
  const exact = availableTools.find(t => t.toLowerCase() === h);
  if (exact) return exact;

  let bestTool: string | null = null;
  let bestScore = Infinity;

  for (const tool of availableTools) {
    const t = tool.toLowerCase();

    // Substring match: if hallucinated is fully contained in tool name or vice versa
    if (t.includes(h) || h.includes(t)) {
      // Strong match — score by length difference
      const subScore = Math.abs(t.length - h.length) * 0.5;
      if (subScore < bestScore) {
        bestScore = subScore;
        bestTool = tool;
      }
      continue;
    }

    // Check if hallucinated matches a segment (split by underscore)
    const segments = t.split('_');
    const hSegments = h.split('_');
    const segmentOverlap = segments.filter(s => hSegments.some(hs => s.includes(hs) || hs.includes(s))).length;
    if (segmentOverlap > 0) {
      const segScore = (segments.length - segmentOverlap) + levenshtein(h, t) * 0.3;
      if (segScore < bestScore) {
        bestScore = segScore;
        bestTool = tool;
      }
      continue;
    }

    // Pure Levenshtein
    const dist = levenshtein(h, t);
    if (dist < bestScore) {
      bestScore = dist;
      bestTool = tool;
    }
  }

  // Reject if best score is too high relative to the string lengths
  // Threshold: max 40% of the longer string's length
  if (bestTool) {
    const maxLen = Math.max(h.length, bestTool.length);
    const threshold = Math.max(3, Math.ceil(maxLen * 0.4));
    const dist = levenshtein(h, bestTool.toLowerCase());
    if (dist <= threshold) {
      return bestTool;
    }
  }

  return null;
}

// ── 2. Arg Validation with Correction ───────────────────────────────────────

/**
 * When tool args have typos in parameter names (e.g. "path" instead of
 * "file_path"), auto-correct by finding the closest expected parameter name.
 *
 * Returns a new args object with corrected parameter names. Unknown args that
 * don't match any expected param are passed through unchanged.
 */
export function correctArgs(
  toolName: string,
  providedArgs: Record<string, unknown>,
  expectedParams: string[]
): Record<string, unknown> {
  if (expectedParams.length === 0) return { ...providedArgs };

  const corrected: Record<string, unknown> = {};
  const expectedLower = expectedParams.map(p => p.toLowerCase());

  for (const [key, value] of Object.entries(providedArgs)) {
    const keyLower = key.toLowerCase();

    // Exact match
    if (expectedParams.includes(key)) {
      corrected[key] = value;
      continue;
    }

    // Case-insensitive exact match
    const caseIdx = expectedLower.indexOf(keyLower);
    if (caseIdx !== -1) {
      corrected[expectedParams[caseIdx]] = value;
      continue;
    }

    // Substring match: "path" -> "file_path", "query" -> "search_query"
    const substringMatches = expectedParams.filter(
      p => p.toLowerCase().includes(keyLower) || keyLower.includes(p.toLowerCase())
    );
    if (substringMatches.length === 1) {
      console.warn(`[DefensiveHarness] Corrected arg "${key}" → "${substringMatches[0]}" for tool ${toolName}`);
      corrected[substringMatches[0]] = value;
      continue;
    }

    // Levenshtein fallback
    let bestParam = key;
    let bestDist = Infinity;
    for (const param of expectedParams) {
      const dist = levenshtein(keyLower, param.toLowerCase());
      if (dist < bestDist) {
        bestDist = dist;
        bestParam = param;
      }
    }

    // Only correct if distance is small enough (max 2 edits or 30% of length)
    const threshold = Math.max(2, Math.ceil(bestParam.length * 0.3));
    if (bestDist <= threshold && bestDist > 0) {
      console.warn(`[DefensiveHarness] Corrected arg "${key}" → "${bestParam}" for tool ${toolName} (distance: ${bestDist})`);
      corrected[bestParam] = value;
    } else {
      // Pass through unknown args unchanged
      corrected[key] = value;
    }
  }

  return corrected;
}

// ── 3. Type Coercion ────────────────────────────────────────────────────────

/**
 * Auto-cast string "3" to number 3, "true" to boolean true, etc.
 * Schema maps parameter name to expected type: "string" | "number" | "boolean" | "array" | "object"
 */
export function coerceArgs(
  args: Record<string, unknown>,
  schema: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    const expectedType = schema[key];

    if (!expectedType) {
      // No schema info for this param — pass through
      result[key] = value;
      continue;
    }

    result[key] = coerceValue(value, expectedType);
  }

  return result;
}

function coerceValue(value: unknown, expectedType: string): unknown {
  if (value === null || value === undefined) return value;

  switch (expectedType) {
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        const num = Number(trimmed);
        if (!isNaN(num) && trimmed !== '') return num;
      }
      if (typeof value === 'boolean') return value ? 1 : 0;
      return value;
    }

    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      if (typeof value === 'number') return value !== 0;
      return value;
    }

    case 'string': {
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }

    case 'array': {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Try JSON parse
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Comma-separated fallback
          if (value.includes(',')) {
            return value.split(',').map(s => s.trim());
          }
        }
        // Wrap single value in array
        return [value];
      }
      return [value];
    }

    case 'object': {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch {
          // Not valid JSON
        }
      }
      return value;
    }

    default:
      return value;
  }
}

// ── 4. Lazy Response Detection ──────────────────────────────────────────────

/**
 * Detect lazy responses: short responses (< 100 chars) that don't reference
 * any tool output. Indicates the model phoned it in instead of synthesizing.
 *
 * Returns true if the response appears lazy.
 */
export function detectLazyResponse(
  response: string,
  toolOutputs: string[]
): boolean {
  const trimmed = response.trim();

  // Not lazy if it's a reasonable length
  if (trimmed.length >= 100) return false;

  // Not lazy if there are no tool outputs to reference
  if (toolOutputs.length === 0) return false;

  // Check if the short response references any tool output content
  // Extract significant terms from tool outputs (words 4+ chars)
  const toolTerms = new Set<string>();
  for (const output of toolOutputs) {
    const words = output.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    for (const word of words) {
      toolTerms.add(word);
    }
  }

  if (toolTerms.size === 0) return false;

  // Check if response references at least some tool data
  const responseWords = new Set(trimmed.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []);
  let overlap = 0;
  for (const word of responseWords) {
    if (toolTerms.has(word)) overlap++;
  }

  // If short response has very little overlap with tool outputs, it's lazy
  const overlapRatio = responseWords.size > 0 ? overlap / responseWords.size : 0;
  return overlapRatio < 0.15;
}

// ── 5. Hallucinated Response Detection ──────────────────────────────────────

/**
 * Detect when a response has zero meaningful overlap with tool output,
 * indicating the model ignored the data it gathered.
 *
 * Returns true if the response appears hallucinated (no grounding in tool data).
 */
export function detectHallucinatedResponse(
  response: string,
  toolOutputs: string[]
): boolean {
  // Can't hallucinate if there were no tool outputs
  if (toolOutputs.length === 0) return false;

  const trimmed = response.trim();
  // Very short responses are handled by lazy detection
  if (trimmed.length < 50) return false;

  // Extract significant terms from tool outputs (words 4+ chars, excluding common words)
  const STOP_WORDS = new Set([
    'that', 'this', 'with', 'from', 'they', 'have', 'been', 'will', 'your',
    'their', 'which', 'would', 'about', 'could', 'other', 'there', 'than',
    'into', 'also', 'some', 'more', 'very', 'when', 'what', 'just', 'each',
    'make', 'like', 'does', 'then', 'them', 'only', 'come', 'made', 'after',
    'back', 'most', 'over', 'such', 'here', 'take', 'well', 'were', 'being',
    'long', 'much', 'same', 'should', 'still', 'these', 'those', 'under',
    'where', 'while', 'before', 'between', 'through', 'first', 'because',
    'against', 'during', 'without', 'again', 'further', 'once', 'both',
    'true', 'false', 'null', 'undefined', 'string', 'number', 'object',
    'data', 'success', 'error', 'result', 'output', 'response', 'tool',
  ]);

  const toolTerms = new Set<string>();
  for (const output of toolOutputs) {
    const words = output.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    for (const word of words) {
      if (!STOP_WORDS.has(word)) {
        toolTerms.add(word);
      }
    }
  }

  // If tool outputs are too generic to fingerprint, can't detect hallucination
  if (toolTerms.size < 5) return false;

  // Extract numbers from tool outputs (strong signals)
  const toolNumbers = new Set<string>();
  for (const output of toolOutputs) {
    const nums = output.match(/\b\d{2,}\b/g) ?? [];
    for (const num of nums) {
      toolNumbers.add(num);
    }
  }

  // Check overlap with response
  const responseWords = new Set(
    trimmed.toLowerCase().match(/\b[a-z]{4,}\b/g)?.filter(w => !STOP_WORDS.has(w)) ?? []
  );
  const responseNumbers = new Set(trimmed.match(/\b\d{2,}\b/g) ?? []);

  let wordOverlap = 0;
  for (const word of responseWords) {
    if (toolTerms.has(word)) wordOverlap++;
  }

  let numberOverlap = 0;
  for (const num of responseNumbers) {
    if (toolNumbers.has(num)) numberOverlap++;
  }

  // Calculate grounding score
  const wordOverlapRatio = responseWords.size > 0 ? wordOverlap / responseWords.size : 0;
  const numberOverlapRatio = responseNumbers.size > 0 ? numberOverlap / responseNumbers.size : 0;

  // Hallucinated if: very low word overlap AND (has numbers but none from tools)
  if (wordOverlapRatio < 0.05 && responseNumbers.size > 3 && numberOverlapRatio === 0) {
    return true;
  }

  // Hallucinated if: essentially zero overlap with substantial tool output
  if (wordOverlapRatio < 0.03 && toolTerms.size > 20) {
    return true;
  }

  return false;
}

// ── Harness Integration Helper ──────────────────────────────────────────────

/**
 * Collect tool outputs from conversation history for lazy/hallucination checks.
 */
export function extractToolOutputsFromHistory(
  history: Array<{ role: string; parts: unknown[] }>
): string[] {
  const outputs: string[] = [];
  for (const msg of history) {
    if (msg.role !== 'user') continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      const fr = p?.functionResponse as Record<string, unknown> | undefined;
      const respObj = fr?.response as Record<string, unknown> | undefined;
      const output = respObj?.output;
      if (typeof output === 'string' && output.length > 0) {
        outputs.push(output);
      }
    }
  }
  return outputs;
}
