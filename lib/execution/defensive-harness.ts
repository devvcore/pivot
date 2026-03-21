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

// ── 6. Text-Based Tool Call Recovery ─────────────────────────────────────────
// Ported from BetterBot's text-tool-recovery.js
// When models (especially via OpenRouter proxying) emit tool calls as text
// instead of structured function calls, parse them into proper call objects.

interface RecoveredToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface RecoveryResult {
  cleanText: string;
  toolCalls: RecoveredToolCall[] | null;
}

let recoveryCounter = 0;

/**
 * Attempt to extract tool calls from text content when the model returned
 * no structured function calls but the text contains tool-call-like patterns.
 *
 * Patterns detected:
 * 1. <function=name>{"arg": "val"}</function>
 * 2. <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 * 3. ```tool_call\n{json}\n``` or ```json\n{json with name field}\n```
 *
 * Only recovers calls for tools actually available in the current outfit.
 */
export function recoverToolCallsFromText(
  responseText: string,
  availableTools: string[]
): RecoveryResult {
  if (!responseText || availableTools.length === 0) {
    return { cleanText: responseText, toolCalls: null };
  }

  const offeredTools = new Set(availableTools);
  const toolCalls: RecoveredToolCall[] = [];
  let cleanText = responseText;

  // Pattern 1: <function=name>{json}</function>
  const funcPattern = /<function=(\w+)>([\s\S]*?)<\/function>/g;
  let match: RegExpExecArray | null;
  while ((match = funcPattern.exec(responseText)) !== null) {
    const [fullMatch, name, argsStr] = match;
    if (!offeredTools.has(name)) continue;
    try {
      const args = JSON.parse(argsStr.trim()) as Record<string, unknown>;
      toolCalls.push({ id: `recover_${++recoveryCounter}`, name, args });
      cleanText = cleanText.replace(fullMatch, '').trim();
    } catch { /* malformed JSON, skip */ }
  }

  // Pattern 2: <tool_call>{json with name+arguments}</tool_call>
  const toolCallPattern = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  while ((match = toolCallPattern.exec(responseText)) !== null) {
    const [fullMatch, body] = match;
    try {
      const parsed = JSON.parse(body.trim()) as Record<string, unknown>;
      const name = (parsed.name || parsed.function) as string | undefined;
      let args = (parsed.arguments || parsed.args || parsed.input || {}) as Record<string, unknown> | string;
      if (name && offeredTools.has(name)) {
        const resolvedArgs = typeof args === 'string' ? JSON.parse(args) as Record<string, unknown> : args;
        toolCalls.push({ id: `recover_${++recoveryCounter}`, name, args: resolvedArgs });
        cleanText = cleanText.replace(fullMatch, '').trim();
      }
    } catch { /* skip */ }
  }

  // Pattern 3: ```tool_call\n{json}\n``` or ```json\n{json with name field}\n```
  const codeBlockPattern = /```(?:tool_call|json)\s*\n([\s\S]*?)\n```/g;
  while ((match = codeBlockPattern.exec(responseText)) !== null) {
    const [fullMatch, body] = match;
    try {
      const parsed = JSON.parse(body.trim()) as Record<string, unknown>;
      const name = (parsed.name || parsed.function || parsed.tool) as string | undefined;
      let args = (parsed.arguments || parsed.args || parsed.input || parsed.parameters || {}) as Record<string, unknown> | string;
      if (name && offeredTools.has(name)) {
        const resolvedArgs = typeof args === 'string' ? JSON.parse(args) as Record<string, unknown> : args;
        toolCalls.push({ id: `recover_${++recoveryCounter}`, name, args: resolvedArgs });
        cleanText = cleanText.replace(fullMatch, '').trim();
      }
    } catch { /* skip */ }
  }

  return {
    cleanText: cleanText || '',
    toolCalls: toolCalls.length > 0 ? toolCalls : null,
  };
}

// ── 7. Session Repair — Message Array Validation ────────────────────────────
// Ported from BetterBot's session-repair.js (7-phase pipeline)
// Validates and fixes the Gemini conversation history before sending to LLM.
// Catches orphaned function responses, empty messages, missing responses,
// duplicate results, and consecutive same-role messages.

interface GeminiMessage {
  role: string;
  parts: unknown[];
}

/**
 * Extract function call names/IDs from a model message's parts.
 */
function getFunctionCallNames(msg: GeminiMessage): string[] {
  const names: string[] = [];
  if (msg.role !== 'model') return names;
  for (const part of msg.parts) {
    const p = part as Record<string, unknown>;
    if (p.functionCall) {
      const fc = p.functionCall as Record<string, unknown>;
      if (fc.name) names.push(fc.name as string);
    }
  }
  return names;
}

/**
 * Check if a model message has function calls.
 */
function hasFunctionCalls(msg: GeminiMessage): boolean {
  return getFunctionCallNames(msg).length > 0;
}

/**
 * Get function response names from a user message's parts.
 */
function getFunctionResponseNames(msg: GeminiMessage): string[] {
  const names: string[] = [];
  if (msg.role !== 'user') return names;
  for (const part of msg.parts) {
    const p = part as Record<string, unknown>;
    if (p.functionResponse) {
      const fr = p.functionResponse as Record<string, unknown>;
      if (fr.name) names.push(fr.name as string);
    }
  }
  return names;
}

/**
 * Check if a message is effectively empty (no text, no function calls/responses).
 */
function isEmptyGeminiMessage(msg: GeminiMessage): boolean {
  if (hasFunctionCalls(msg)) return false;
  if (getFunctionResponseNames(msg).length > 0) return false;
  if (!Array.isArray(msg.parts) || msg.parts.length === 0) return true;
  for (const part of msg.parts) {
    const p = part as Record<string, unknown>;
    if (typeof p.text === 'string' && (p.text as string).trim().length > 0) return false;
    if (p.functionCall || p.functionResponse) return false;
  }
  return true;
}

/**
 * Repair a Gemini conversation history before sending to the API.
 * Fixes:
 * - Empty messages (removes them)
 * - Orphaned function responses (removes if no matching call)
 * - Missing function responses (inserts synthetic error)
 * - Consecutive same-role messages (merges text parts)
 *
 * Returns { messages, repairs } where repairs describes each fix applied.
 */
export function repairConversationHistory(
  messages: GeminiMessage[]
): { messages: GeminiMessage[]; repairs: string[] } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: [], repairs: [] };
  }

  const repairs: string[] = [];
  let msgs = JSON.parse(JSON.stringify(messages)) as GeminiMessage[];

  // Phase 1: Collect all function call names from model messages
  const allCallNames = new Set<string>();
  for (const msg of msgs) {
    for (const name of getFunctionCallNames(msg)) {
      allCallNames.add(name);
    }
  }

  // Phase 2: Remove orphaned function responses
  msgs = msgs.filter(msg => {
    if (msg.role !== 'user') return true;
    const frNames = getFunctionResponseNames(msg);
    if (frNames.length === 0) return true;
    // Check if this user message has ONLY function responses (no text)
    const hasText = msg.parts.some(p => {
      const part = p as Record<string, unknown>;
      return typeof part.text === 'string' && (part.text as string).trim().length > 0;
    });
    if (hasText) return true;
    // Pure function response message — keep only if all names have matching calls
    const orphaned = frNames.filter(n => !allCallNames.has(n));
    if (orphaned.length > 0 && orphaned.length === frNames.length) {
      repairs.push(`removed orphaned function response message (names: ${orphaned.join(', ')})`);
      return false;
    }
    return true;
  });

  // Phase 3: Drop empty messages
  msgs = msgs.filter(msg => {
    if (isEmptyGeminiMessage(msg)) {
      repairs.push(`removed empty ${msg.role} message`);
      return false;
    }
    return true;
  });

  // Phase 4: Insert synthetic error responses for unmatched function calls
  const responseNames = new Set<string>();
  for (const msg of msgs) {
    for (const name of getFunctionResponseNames(msg)) {
      responseNames.add(name);
    }
  }

  const expanded: GeminiMessage[] = [];
  for (const msg of msgs) {
    expanded.push(msg);
    if (msg.role !== 'model') continue;
    const callNames = getFunctionCallNames(msg);
    const missing = callNames.filter(n => !responseNames.has(n));
    if (missing.length === 0) continue;
    // Insert synthetic error responses
    const syntheticParts = missing.map(name => ({
      functionResponse: {
        name,
        response: { output: 'Error: tool execution was interrupted' },
      },
    }));
    expanded.push({ role: 'user', parts: syntheticParts });
    for (const name of missing) {
      repairs.push(`inserted synthetic error response for function call: ${name}`);
      responseNames.add(name);
    }
  }
  msgs = expanded;

  // Phase 5: Merge consecutive same-role text-only messages
  if (msgs.length > 1) {
    const merged: GeminiMessage[] = [msgs[0]];
    for (let i = 1; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = merged[merged.length - 1];
      if (msg.role === prev.role && !hasFunctionCalls(prev) && !hasFunctionCalls(msg)
          && getFunctionResponseNames(prev).length === 0 && getFunctionResponseNames(msg).length === 0) {
        // Both are pure text same-role — merge
        prev.parts = [...prev.parts, ...msg.parts];
        repairs.push(`merged consecutive ${msg.role} messages`);
      } else {
        merged.push(msg);
      }
    }
    msgs = merged;
  }

  // Phase 6: Ensure alternating user/model structure (Gemini requirement)
  if (msgs.length > 1) {
    const validated: GeminiMessage[] = [msgs[0]];
    for (let i = 1; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = validated[validated.length - 1];
      if (msg.role === prev.role) {
        // Insert placeholder of opposite role
        const placeholder: GeminiMessage = msg.role === 'user'
          ? { role: 'model', parts: [{ text: '[continued]' }] }
          : { role: 'user', parts: [{ text: '[continued]' }] };
        validated.push(placeholder);
        repairs.push(`inserted placeholder ${placeholder.role} message to maintain alternation`);
      }
      validated.push(msg);
    }
    msgs = validated;
  }

  return { messages: msgs, repairs };
}

// ── 8. Context Budget — Smart Truncation ────────────────────────────────────
// Ported from BetterBot's context-budget.js
// Dynamic context window management with head/tail preservation.

const CHARS_PER_TOKEN = 4;
const GEMINI_CONTEXT_WINDOW = 1_000_000; // Gemini Flash/Pro

/**
 * Smart truncation: keep head + tail of a string, insert a marker in the middle.
 * Preserves the beginning (often contains structure) and end (often contains the answer).
 */
export function smartTruncate(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  const headChars = Math.min(500, Math.floor(maxChars * 0.2));
  const tailChars = maxChars - headChars - 80;
  const head = str.slice(0, headChars);
  const tail = str.slice(-tailChars);
  const dropped = str.length - headChars - tailChars;
  return `${head}\n\n[... ${dropped} chars trimmed ...]\n\n${tail}`;
}

/**
 * Estimate the total character count of a Gemini conversation history.
 */
function estimateHistoryChars(messages: GeminiMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (typeof p.text === 'string') total += (p.text as string).length;
      if (p.functionCall) total += JSON.stringify(p.functionCall).length;
      if (p.functionResponse) {
        const fr = p.functionResponse as Record<string, unknown>;
        const resp = fr.response as Record<string, unknown> | undefined;
        const output = resp?.output;
        if (typeof output === 'string') total += output.length;
        else total += JSON.stringify(resp ?? {}).length;
      }
    }
  }
  return total;
}

/**
 * Get the length of function response output in a message.
 */
function getFunctionResponseChars(msg: GeminiMessage): number {
  let total = 0;
  if (msg.role !== 'user') return total;
  for (const part of msg.parts) {
    const p = part as Record<string, unknown>;
    if (p.functionResponse) {
      const fr = p.functionResponse as Record<string, unknown>;
      const resp = fr.response as Record<string, unknown> | undefined;
      const output = resp?.output;
      if (typeof output === 'string') total += output.length;
    }
  }
  return total;
}

/**
 * Compact function response outputs in a message to a max char limit.
 * Mutates in place. Returns true if any truncation occurred.
 */
function compactFunctionResponses(msg: GeminiMessage, maxChars: number): boolean {
  if (msg.role !== 'user') return false;
  let changed = false;
  for (const part of msg.parts) {
    const p = part as Record<string, unknown>;
    if (p.functionResponse) {
      const fr = p.functionResponse as Record<string, unknown>;
      const resp = fr.response as Record<string, unknown> | undefined;
      if (resp && typeof resp.output === 'string' && resp.output.length > maxChars) {
        resp.output = smartTruncate(resp.output, maxChars);
        changed = true;
      }
    }
  }
  return changed;
}

interface ContextGuardResult {
  trimmed: boolean;
  stage?: number;
  resetRequired?: boolean;
}

/**
 * Guard context budget before an LLM call. Mutates the messages array in place.
 *
 * Layer 1: If total tool result content exceeds 75% of remaining headroom,
 * compact the oldest tool results to 2K chars each, keeping the last 3 untouched.
 *
 * Layer 2: Progressive overflow recovery:
 *   Stage 1 — keep last 10 messages, prepend trimmed-context summary
 *   Stage 2 — keep last 4 messages
 *   Stage 3 — truncate ALL function responses to 2K chars
 *   Stage 4 — return resetRequired flag
 */
export function guardContextBudget(
  messages: GeminiMessage[],
  systemPromptChars: number = 8000
): ContextGuardResult {
  const contextChars = GEMINI_CONTEXT_WINDOW * CHARS_PER_TOKEN;
  const responseBuffer = 4096 * CHARS_PER_TOKEN;
  const headroom = contextChars - systemPromptChars - responseBuffer;

  if (headroom <= 0) {
    return { trimmed: true, stage: 4, resetRequired: true };
  }

  // --- Layer 1: Headroom guard on tool results ---
  const toolResultThreshold = Math.floor(headroom * 0.75);
  let totalToolChars = 0;
  const toolResultIndices: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    const chars = getFunctionResponseChars(messages[i]);
    if (chars > 0) {
      totalToolChars += chars;
      toolResultIndices.push(i);
    }
  }

  let trimmed = false;

  if (totalToolChars > toolResultThreshold && toolResultIndices.length > 1) {
    const keepRecent = Math.min(3, toolResultIndices.length - 1);
    const compactCount = toolResultIndices.length - keepRecent;
    for (let j = 0; j < compactCount; j++) {
      const idx = toolResultIndices[j];
      if (compactFunctionResponses(messages[idx], 2000)) {
        trimmed = true;
      }
    }
  }

  // --- Layer 2: Overflow recovery ---
  let totalChars = estimateHistoryChars(messages);

  if (totalChars <= headroom) {
    return { trimmed };
  }

  // Stage 1: Keep last 10 messages
  if (messages.length > 10) {
    const removed = messages.length - 10;
    const summary: GeminiMessage = { role: 'user', parts: [{ text: `[Older context: ${removed} messages trimmed]` }] };
    messages.splice(0, removed, summary);
    trimmed = true;
    totalChars = estimateHistoryChars(messages);
    if (totalChars <= headroom) return { trimmed, stage: 1 };
  }

  // Stage 2: Keep last 4 messages
  if (messages.length > 4) {
    const removed = messages.length - 4;
    const summary: GeminiMessage = { role: 'user', parts: [{ text: `[Older context: ${removed} messages trimmed]` }] };
    messages.splice(0, removed, summary);
    trimmed = true;
    totalChars = estimateHistoryChars(messages);
    if (totalChars <= headroom) return { trimmed, stage: 2 };
  }

  // Stage 3: Truncate ALL function responses to 2K chars
  for (const msg of messages) {
    if (compactFunctionResponses(msg, 2000)) {
      trimmed = true;
    }
  }
  totalChars = estimateHistoryChars(messages);
  if (totalChars <= headroom) return { trimmed, stage: 3 };

  // Stage 4: Nothing left — signal reset needed
  return { trimmed: true, stage: 4, resetRequired: true };
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
