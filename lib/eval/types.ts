/**
 * Eval System Types
 *
 * Lightweight eval framework for grading agent and synthesis quality.
 * Supports rule-based checks, model-graded evals, and statistical tracking.
 */

// ── Score Dimensions ─────────────────────────────────────────────────────────

export interface DimensionScores {
  accuracy: number;       // 0-100: factual correctness, data grounding
  hallucination: number;  // 0-100: inverse hallucination rate (100 = clean)
  relevance: number;      // 0-100: task-specific, not generic
  quality: number;        // 0-100: structure, markdown, tone, completeness
  efficiency: number;     // 0-100: tool economy, speed, token usage
}

export const DIMENSION_WEIGHTS: Record<keyof DimensionScores, number> = {
  accuracy: 0.25,
  hallucination: 0.30,
  relevance: 0.20,
  quality: 0.15,
  efficiency: 0.10,
};

export function weightedScore(scores: DimensionScores): number {
  let total = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    total += (scores[dim as keyof DimensionScores] ?? 0) * weight;
  }
  return Math.round(total * 10) / 10;
}

// ── Checks ───────────────────────────────────────────────────────────────────

export interface QualityCheck {
  name: string;
  dimension: keyof DimensionScores;
  check: (output: string, meta?: CheckMeta) => boolean;
}

export interface CheckMeta {
  toolsUsed?: string[];
  toolCalls?: number;
  tokensUsed?: number;
  latencyMs?: number;
  taskTitle?: string;
  taskDescription?: string;
}

// ── Test Cases ───────────────────────────────────────────────────────────────

export interface EvalTestCase {
  name: string;
  agentId: string;
  title: string;
  description: string;
  checks: QualityCheck[];
  /** Expected connect marker for disconnected service tests */
  expectsConnect?: string;
  /** Whether test needs real integration data */
  expectsRealData?: boolean;
  /** Tags for filtering (e.g. 'integration', 'standalone', 'social') */
  tags?: string[];
}

// ── Results ──────────────────────────────────────────────────────────────────

export type GraderVerdict = 'excellent' | 'good' | 'acceptable' | 'poor' | 'fail';

export interface GraderResult {
  verdict: GraderVerdict;
  reasoning: string;
  scores: DimensionScores;
}

export interface EvalResult {
  testName: string;
  agentId: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  scores: DimensionScores;
  overall: number;
  checksPassed: string[];
  checksFailed: string[];
  grader?: GraderResult;
  output: string;
  toolsUsed: string[];
  toolCalls: number;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  taskTitle: string;
  taskDescription: string;
  error?: string;
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export interface EvalRunSummary {
  id: string;
  suiteId: string;
  gitSha?: string;
  trigger: 'manual' | 'ci' | 'deploy' | 'cron';
  status: 'running' | 'completed' | 'failed';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalChecks: number;
  passedChecks: number;
  scores: DimensionScores & { overall: number };
  totalCostUsd: number;
  totalTokens: number;
  totalTimeMs: number;
  avgLatencyMs: number;
  results: EvalResult[];
  regressions: Regression[];
  createdAt: string;
  completedAt?: string;
}

// ── Baselines & Regressions ──────────────────────────────────────────────────

export interface Baseline {
  suiteId: string;
  agentId?: string;
  metric: string;
  value: number;
  threshold: number;
}

export interface Regression {
  metric: string;
  agentId?: string;
  baseline: number;
  current: number;
  delta: number;
  threshold: number;
}

// ── Suite ────────────────────────────────────────────────────────────────────

export interface EvalSuite {
  id: string;
  name: string;
  description: string;
  tests: EvalTestCase[];
}
