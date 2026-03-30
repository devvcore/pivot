/**
 * Agent Guardrails - Safety & Resilience Utilities for Pivot's AI Agents
 *
 * Implements BetterBot patterns:
 * 1. LoopGuard - Circuit breaker preventing infinite tool-call loops
 * 2. closestToolName - Fuzzy tool name matching for LLM typos
 * 3. coerceArgs - Argument auto-coercion (types + fuzzy key names)
 * 4. smartTruncate - Context-preserving text truncation
 */

import { createHash } from "crypto";

// ── 1. Loop Guard (circuit breaker) ─────────────────────────────────────────

const IDENTICAL_CALL_WARN = 3;
const IDENTICAL_CALL_BLOCK = 5;
const PER_TOOL_WARN = 6;
const PER_TOOL_BLOCK = 10;
const GLOBAL_CIRCUIT_BREAKER = 25;

export interface LoopGuardResult {
  allowed: boolean;
  warning?: string;
}

export class LoopGuard {
  private callHistory: Map<string, number> = new Map();
  private toolCounts: Map<string, number> = new Map();
  private totalCalls = 0;

  /**
   * Check whether a tool call should proceed.
   * Returns { allowed: true } if ok, or { allowed: false, warning } if blocked.
   * May also return { allowed: true, warning } for soft warnings.
   */
  check(toolName: string, args: any): LoopGuardResult {
    this.totalCalls++;

    // Global circuit breaker
    if (this.totalCalls > GLOBAL_CIRCUIT_BREAKER) {
      return {
        allowed: false,
        warning: `Global circuit breaker: ${this.totalCalls} total tool calls exceeded limit of ${GLOBAL_CIRCUIT_BREAKER}. Stopping to prevent runaway loop.`,
      };
    }

    // Per-tool count
    const toolCount = (this.toolCounts.get(toolName) ?? 0) + 1;
    this.toolCounts.set(toolName, toolCount);

    if (toolCount > PER_TOOL_BLOCK) {
      return {
        allowed: false,
        warning: `Tool "${toolName}" called ${toolCount} times (limit: ${PER_TOOL_BLOCK}). Blocked to prevent loop.`,
      };
    }

    // Identical call detection (same tool + same args)
    const callKey = createHash("sha256")
      .update(toolName + JSON.stringify(args ?? {}))
      .digest("hex");
    const callCount = (this.callHistory.get(callKey) ?? 0) + 1;
    this.callHistory.set(callKey, callCount);

    if (callCount >= IDENTICAL_CALL_BLOCK) {
      return {
        allowed: false,
        warning: `Identical call to "${toolName}" with same args repeated ${callCount} times (limit: ${IDENTICAL_CALL_BLOCK}). Blocked.`,
      };
    }

    // Soft warnings (allowed but flagged)
    const warnings: string[] = [];
    if (callCount >= IDENTICAL_CALL_WARN) {
      warnings.push(`Identical call to "${toolName}" repeated ${callCount} times.`);
    }
    if (toolCount >= PER_TOOL_WARN) {
      warnings.push(`Tool "${toolName}" called ${toolCount} times total.`);
    }

    return {
      allowed: true,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    };
  }

  /** Reset all counters (call between conversation turns if needed) */
  reset(): void {
    this.callHistory.clear();
    this.toolCounts.clear();
    this.totalCalls = 0;
  }
}

// ── 2. Fuzzy Tool Name Matching ─────────────────────────────────────────────

/** Normalize a string for comparison: lowercase, strip _ and - */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[_-]/g, "");
}

/**
 * Find the closest matching tool name from the available list.
 * Returns the best match or null if no reasonable match found.
 */
export function closestToolName(name: string, available: string[]): string | null {
  if (available.length === 0) return null;

  const norm = normalize(name);

  // Exact match after normalization
  const exact = available.find((t) => normalize(t) === norm);
  if (exact) return exact;

  // Substring / prefix / suffix match
  const candidates: { tool: string; score: number }[] = [];

  for (const tool of available) {
    const nt = normalize(tool);
    let score = 0;

    // Check if one contains the other
    if (nt.includes(norm)) {
      score = norm.length / nt.length; // how much of the tool name does the input cover
    } else if (norm.includes(nt)) {
      score = nt.length / norm.length;
    }

    // Prefix match bonus
    if (nt.startsWith(norm) || norm.startsWith(nt)) {
      score = Math.max(score, 0.7);
    }

    // Suffix match bonus
    if (nt.endsWith(norm) || norm.endsWith(nt)) {
      score = Math.max(score, 0.6);
    }

    // Levenshtein distance for close typos (only for short names to avoid perf issues)
    if (score === 0 && norm.length <= 30 && nt.length <= 30) {
      const dist = levenshtein(norm, nt);
      const maxLen = Math.max(norm.length, nt.length);
      const similarity = 1 - dist / maxLen;
      if (similarity >= 0.6) {
        score = similarity;
      }
    }

    if (score > 0) {
      candidates.push({ tool, score });
    }
  }

  if (candidates.length === 0) return null;

  // Return the best match if it clears the threshold
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best.score >= 0.5 ? best.tool : null;
}

/** Simple Levenshtein distance for short strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

// ── 3. Argument Auto-Coercion ──────────────────────────────────────────────

/**
 * Coerce tool arguments to match expected schema types.
 * Also fuzzy-matches argument names to handle LLM typos.
 *
 * @param args - The raw args from the LLM
 * @param schema - Map of expected field name -> type string ("string" | "number" | "boolean" | "object" | "array")
 * @returns Coerced args with corrected keys and types
 */
export function coerceArgs(
  args: Record<string, any>,
  schema: Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {};
  const expectedKeys = Object.keys(schema);

  for (const [key, value] of Object.entries(args)) {
    // Find the best matching expected key
    let matchedKey = key;
    if (!schema[key]) {
      const closest = closestToolName(key, expectedKeys);
      if (closest) {
        matchedKey = closest;
      }
    }

    const expectedType = schema[matchedKey];
    if (!expectedType) {
      // Unknown key - pass through as-is
      result[matchedKey] = value;
      continue;
    }

    // Coerce the value to the expected type
    result[matchedKey] = coerceValue(value, expectedType);
  }

  return result;
}

function coerceValue(value: any, expectedType: string): any {
  if (value == null) return value;

  switch (expectedType) {
    case "number": {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return isNaN(parsed) ? value : parsed;
      }
      return value;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const lower = value.toLowerCase().trim();
        if (lower === "true" || lower === "yes" || lower === "1") return true;
        if (lower === "false" || lower === "no" || lower === "0") return false;
      }
      if (typeof value === "number") return value !== 0;
      return value;
    }
    case "string": {
      if (typeof value === "string") return value;
      return String(value);
    }
    case "object": {
      if (typeof value === "object" && !Array.isArray(value)) return value;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }
    case "array": {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return [value];
        }
      }
      return [value];
    }
    default:
      return value;
  }
}

// ── 4. Smart Context Truncation ────────────────────────────────────────────

/**
 * Truncate text while preserving head context (first 20%) and tail context.
 * Inserts a "[...N chars truncated...]" indicator in the middle.
 *
 * @param text - The text to truncate
 * @param maxChars - Maximum character length
 * @returns Truncated text with indicator, or original if under limit
 */
export function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Reserve space for the truncation indicator
  const indicatorTemplate = "[... chars truncated...]";
  const reservedForIndicator = indicatorTemplate.length + 10; // extra space for the number

  const usableChars = maxChars - reservedForIndicator;
  if (usableChars <= 0) return text.slice(0, maxChars);

  // Keep first 20% as head context, rest goes to tail
  const headSize = Math.floor(usableChars * 0.2);
  const tailSize = usableChars - headSize;

  const head = text.slice(0, headSize);
  const tail = text.slice(text.length - tailSize);
  const truncatedCount = text.length - headSize - tailSize;

  return `${head}\n[...${truncatedCount} chars truncated...]\n${tail}`;
}

// ── 5. Response Quality Detection ────────────────────────────────────────────

/** Fluff phrases that indicate a vague, non-specific response */
const VAGUE_PATTERNS: RegExp[] = [
  /\bconsider\s+(?:diversifying|exploring|investing|looking into|evaluating)\b/i,
  /\byou (?:might|may|could|should) (?:want to )?(?:consider|look into|think about|explore)\b/i,
  /\bit(?:'s| is) (?:important|essential|crucial|critical|vital|key) to\b/i,
  /\bfocus on (?:building|improving|developing|enhancing|strengthening|optimizing)\b/i,
  /\bleverage (?:your|the|existing)\b/i,
  /\bstreamline (?:your|the|operations|processes)\b/i,
  /\bdouble down on\b/i,
  /\bstrategic(?:ally)? (?:align|position|pivot|focus)\b/i,
  /\bhere are (?:some|a few) (?:things|ideas|suggestions|recommendations|steps|ways)\b/i,
  /\bin today(?:'s| s) (?:competitive|dynamic|rapidly changing|evolving) (?:landscape|market|environment)\b/i,
  /\bsynerg(?:y|ies|ize)\b/i,
  /\bholistic(?:ally)? (?:approach|view|strategy|perspective)\b/i,
  /\brobust (?:strategy|framework|approach|plan)\b/i,
  /\bscalable (?:solution|approach|model|framework)\b/i,
  /\bproactive(?:ly)? (?:address|manage|tackle|approach)\b/i,
];

/** Phrases that indicate specificity (numbers, names, actions) */
const SPECIFIC_SIGNALS: RegExp[] = [
  /\$[\d,.]+[KkMmBb]?/,                     // dollar amounts
  /\d+(?:\.\d+)?%/,                          // percentages
  /\d+(?:\.\d+)?\s*(?:weeks?|months?|days?|hours?)/i, // time spans
  /(?:Amanda|Kate|Sarah|John|revenue leak|client name)/i, // specific names (from report)
  /step \d|#\d|\d\.\s/,                      // numbered steps
  /(?:draft|create|send|build|write|call|email|schedule)\s+(?:a|the|an)/i, // concrete actions
];

export interface QualityCheck {
  isVague: boolean;
  vagueCount: number;
  specificCount: number;
  reason?: string;
}

/**
 * Detect if a response is vague/generic consultant-speak.
 * Returns isVague=true if the response has too many fluff phrases
 * relative to specific data points.
 */
export function detectVagueResponse(text: string): QualityCheck {
  // Strip markers before checking
  const clean = text.replace(/<!--[\s\S]*?-->/g, "").trim();

  // Don't flag very short responses (greetings, confirmations)
  if (clean.length < 100) return { isVague: false, vagueCount: 0, specificCount: 0 };

  const vagueCount = VAGUE_PATTERNS.filter(p => p.test(clean)).length;
  const specificCount = SPECIFIC_SIGNALS.filter(p => p.test(clean)).length;

  // Vague if: 3+ vague phrases AND fewer specific signals than vague ones
  if (vagueCount >= 3 && specificCount < vagueCount) {
    return {
      isVague: true,
      vagueCount,
      specificCount,
      reason: `${vagueCount} vague phrases, only ${specificCount} specific data points`,
    };
  }

  // Also flag if 2+ vague AND zero specific signals
  if (vagueCount >= 2 && specificCount === 0) {
    return {
      isVague: true,
      vagueCount,
      specificCount,
      reason: `${vagueCount} vague phrases with no concrete data`,
    };
  }

  return { isVague: false, vagueCount, specificCount };
}

/** Prompt to append when forcing specificity */
export const SPECIFICITY_NUDGE = `Your previous response was too vague and generic. Rewrite it with:
- ACTUAL NUMBERS from the business data (dollar amounts, percentages, weeks)
- SPECIFIC NAMES (clients, products, team members from the report)
- CONCRETE ACTIONS (not "consider exploring" but "draft an email to Amanda about the $12K invoice")
- If you don't have the data, call get_report_section or get_integration_data to get it
Do NOT use phrases like "consider diversifying", "leverage your", "in today's competitive landscape", or "robust strategy".`;

// ── 6. Tool Result Validation ────────────────────────────────────────────────

export interface ValidationResult {
  content: string;    // cleaned/validated content
  quality: "good" | "weak" | "empty";
  warning?: string;   // optional warning to prepend
}

/**
 * Validate and clean tool results before sending to Gemini.
 * Catches empty results, irrelevant search data, malformed JSON, etc.
 */
export function validateToolResult(toolName: string, query: string, rawResult: string): ValidationResult {
  // Empty or error results
  if (!rawResult || rawResult.trim().length === 0) {
    return { content: `[${toolName}] No data returned.`, quality: "empty" };
  }

  if (rawResult.length < 20 && /no.*found|unavailable|failed|error/i.test(rawResult)) {
    return { content: rawResult, quality: "empty" };
  }

  // Web search validation
  if (toolName === "search_web") {
    return validateWebSearch(query, rawResult);
  }

  // Report section validation
  if (toolName === "get_report_section") {
    return validateReportSection(query, rawResult);
  }

  // Integration data validation
  if (toolName === "get_integration_data") {
    return validateIntegrationData(rawResult);
  }

  // All other tools — pass through with basic length check
  return { content: rawResult, quality: "good" };
}

function validateWebSearch(query: string, result: string): ValidationResult {
  // Check for common Perplexity failure modes
  const failurePatterns = [
    /i (?:don't|do not) have (?:access|information|data) (?:about|on|to)/i,
    /as an ai,? i (?:cannot|can't|don't)/i,
    /i'm (?:sorry|unable),? (?:but )?i (?:cannot|can't)/i,
    /no relevant (?:results|information|data) (?:found|available)/i,
    /i (?:couldn't|could not) find (?:any|specific)/i,
  ];

  for (const pattern of failurePatterns) {
    if (pattern.test(result)) {
      return {
        content: `[Web Search] No useful results for: "${query}". Answer from your training knowledge instead.`,
        quality: "empty",
        warning: "Search returned no useful results",
      };
    }
  }

  // Check for very short or generic responses (likely unhelpful)
  const contentOnly = result.replace(/\[Web Search.*?\]\n?/, "").replace(/\n\nSources:\n[\s\S]*$/, "").trim();
  if (contentOnly.length < 50) {
    return {
      content: result,
      quality: "weak",
      warning: "Search returned very brief results — verify before citing",
    };
  }

  // Check relevance: do query keywords appear in the result?
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const resultLower = contentOnly.toLowerCase();
  const matchCount = queryWords.filter(w => resultLower.includes(w)).length;
  const matchRatio = queryWords.length > 0 ? matchCount / queryWords.length : 1;

  if (matchRatio < 0.2 && queryWords.length >= 3) {
    return {
      content: `${result}\n\n[VALIDATION NOTE: Search results may not be directly relevant to "${query}". Cross-check with report data before citing.]`,
      quality: "weak",
      warning: "Low relevance match between query and results",
    };
  }

  return { content: result, quality: "good" };
}

function validateReportSection(section: string, result: string): ValidationResult {
  // Check for "not found" responses
  if (/not found|no completed report/i.test(result) && result.length < 200) {
    return { content: result, quality: "empty" };
  }

  // Check for empty JSON objects/arrays
  if (/^\[Report Section:.*?\]\n\s*(\{\}|\[\]|null|"null")$/m.test(result)) {
    return {
      content: `[Report Section: ${section}] Section exists but contains no data.`,
      quality: "empty",
    };
  }

  return { content: result, quality: "good" };
}

function validateIntegrationData(result: string): ValidationResult {
  // Check for "no data" responses
  if (/no (?:integration )?data (?:available|found)/i.test(result)) {
    return { content: result, quality: "empty" };
  }

  // Check for empty data arrays
  if (/\[\]|"data"\s*:\s*"?\s*"?/i.test(result) && result.length < 100) {
    return {
      content: result + "\n[NOTE: Integration returned empty data. The provider may not be synced yet.]",
      quality: "weak",
    };
  }

  return { content: result, quality: "good" };
}
