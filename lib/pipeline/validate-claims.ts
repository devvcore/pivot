import type { FinancialFact, MVPDeliverables } from "@/lib/types";

export interface ClaimValidation {
  field: string;           // "cashIntelligence.currentCashPosition"
  value: number;
  matchedFact: { label: string; value: number; sourceFile: string } | null;
  status: "verified" | "estimated" | "conflicting" | "unverifiable";
  divergencePct: number | null;
}

/** Normalize label to lowercase tokens for fuzzy matching */
function normalizeLabel(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")  // camelCase -> separate words
    .replace(/[_\-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/** Compute token overlap similarity (Jaccard) between two labels */
function labelSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeLabel(a));
  const tokensB = new Set(normalizeLabel(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

/** Find the best matching fact for a field path + value */
function findMatchingFact(
  fieldPath: string,
  value: number,
  facts: FinancialFact[]
): { fact: FinancialFact; similarity: number } | null {
  // Extract the leaf field name
  const parts = fieldPath.split(".");
  const leaf = parts[parts.length - 1];

  let bestMatch: { fact: FinancialFact; similarity: number } | null = null;

  for (const fact of facts) {
    // Check label similarity
    const sim = labelSimilarity(leaf, fact.label);
    if (sim < 0.3) continue; // too dissimilar

    if (!bestMatch || sim > bestMatch.similarity) {
      bestMatch = { fact, similarity: sim };
    }
  }

  // If label match is weak, also check value proximity
  if (!bestMatch) {
    for (const fact of facts) {
      if (fact.value === 0) continue;
      const pctDiff = Math.abs(value - fact.value) / Math.abs(fact.value);
      if (pctDiff <= 0.05) {
        // Exact or near-exact value match
        bestMatch = { fact, similarity: 0.3 };
      }
    }
  }

  return bestMatch;
}

/** Recursively walk an object, collecting all numeric fields with their paths */
function collectNumericFields(
  obj: unknown,
  prefix: string,
  result: { path: string; value: number }[]
): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "number" && Number.isFinite(obj)) {
    result.push({ path: prefix, value: obj });
    return;
  }
  if (Array.isArray(obj)) {
    // Skip arrays (items, recommendations, etc.) — too noisy
    return;
  }
  if (typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      // Skip non-data fields
      if (key.endsWith("_source") || key === "recommendations" || key === "items") continue;
      collectNumericFields(val, prefix ? `${prefix}.${key}` : key, result);
    }
  }
}

/**
 * Validate all numeric claims in deliverables against verified financial facts.
 * Zero API calls — pure computation.
 *
 * Algorithm:
 * - Recursively walk deliverable JSON
 * - For every numeric field, fuzzy-match against FinancialFact[] labels
 * - Match within 5% = verified
 * - Match but diverge >25% = conflicting
 * - Match between 5-25% = estimated (close but not exact)
 * - No match = estimated
 */
export function validateFinancialClaims(
  deliverables: MVPDeliverables,
  facts: FinancialFact[]
): ClaimValidation[] {
  if (!facts || facts.length === 0) return [];

  const numericFields: { path: string; value: number }[] = [];
  collectNumericFields(deliverables, "", numericFields);

  const validations: ClaimValidation[] = [];

  for (const { path, value } of numericFields) {
    // Skip trivial values (scores, percentages, small numbers)
    if (Math.abs(value) < 100 && !path.toLowerCase().includes("revenue") && !path.toLowerCase().includes("cash")) {
      continue;
    }

    const match = findMatchingFact(path, value, facts);

    if (!match) {
      validations.push({
        field: path,
        value,
        matchedFact: null,
        status: "estimated",
        divergencePct: null,
      });
      continue;
    }

    const divergence = match.fact.value !== 0
      ? Math.abs(value - match.fact.value) / Math.abs(match.fact.value)
      : 0;

    let status: ClaimValidation["status"];
    if (divergence <= 0.05) {
      status = "verified";
    } else if (divergence > 0.25) {
      status = "conflicting";
    } else {
      status = "estimated";
    }

    validations.push({
      field: path,
      value,
      matchedFact: {
        label: match.fact.label,
        value: match.fact.value,
        sourceFile: match.fact.sourceFile,
      },
      status,
      divergencePct: Math.round(divergence * 100),
    });
  }

  return validations;
}

/** Summary counts for UI display */
export function summarizeClaims(validations: ClaimValidation[]): {
  verified: number;
  estimated: number;
  conflicting: number;
  unverifiable: number;
  total: number;
} {
  const counts = { verified: 0, estimated: 0, conflicting: 0, unverifiable: 0, total: validations.length };
  for (const v of validations) {
    counts[v.status]++;
  }
  return counts;
}
