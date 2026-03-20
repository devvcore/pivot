/**
 * Eval System — Public API
 *
 * Usage:
 *   import { runEvalSuite, ALL_SUITES, setBaseline } from '@/lib/eval';
 *
 * CLI:
 *   npx tsx scripts/run-evals.ts                  # run all agent tests
 *   npx tsx scripts/run-evals.ts --suite quick     # fast smoke tests
 *   npx tsx scripts/run-evals.ts --suite pivvy     # Pivvy coach tests
 *   npx tsx scripts/run-evals.ts --tags standalone  # only standalone tests
 *   npx tsx scripts/run-evals.ts --no-grade        # skip model grading
 *   npx tsx scripts/run-evals.ts --no-persist      # don't save to DB
 *   npx tsx scripts/run-evals.ts --baseline <runId> # set baseline from a run
 */

export { runEvalSuite, setBaseline } from './runner';
export { gradeOutput } from './grader';
export { ALL_SUITES, agentSuite, pivvySuite, quickSuite } from './suites';
export * from './checks';
export type {
  EvalSuite, EvalTestCase, EvalResult, EvalRunSummary,
  DimensionScores, QualityCheck, CheckMeta,
  GraderResult, GraderVerdict,
  Baseline, Regression,
} from './types';
