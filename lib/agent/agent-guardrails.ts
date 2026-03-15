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
