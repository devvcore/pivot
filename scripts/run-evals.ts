#!/usr/bin/env tsx
/**
 * Eval Runner CLI
 *
 * Usage:
 *   npx tsx scripts/run-evals.ts                    # run agent suite (default)
 *   npx tsx scripts/run-evals.ts --suite quick       # fast smoke tests (3 tests)
 *   npx tsx scripts/run-evals.ts --suite pivvy       # Pivvy coach tests
 *   npx tsx scripts/run-evals.ts --suite agents      # all 7 agents
 *   npx tsx scripts/run-evals.ts --tags standalone    # filter by tag
 *   npx tsx scripts/run-evals.ts --no-grade          # skip model grading (faster)
 *   npx tsx scripts/run-evals.ts --no-persist        # don't save results to DB
 *   npx tsx scripts/run-evals.ts --baseline <runId>  # set baseline from a run
 *   npx tsx scripts/run-evals.ts --history           # show recent eval runs
 *   npx tsx scripts/run-evals.ts --compare <id1> <id2>  # compare two runs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found */ }

import { createClient } from '@supabase/supabase-js';
import { runEvalSuite, setBaseline, ALL_SUITES } from '../lib/eval/index';

const REAL_ORG_ID = 'bad7cf7d-f09f-410c-8ca1-607652d00bb8';

async function main() {
  const args = process.argv.slice(2);

  // --baseline <runId>
  const baselineIdx = args.indexOf('--baseline');
  if (baselineIdx !== -1) {
    const runId = args[baselineIdx + 1];
    const suiteId = getArg(args, '--suite') ?? 'agents';
    if (!runId) {
      console.error('Usage: --baseline <runId>');
      process.exit(1);
    }
    await setBaseline(suiteId, runId);
    process.exit(0);
  }

  // --history
  if (args.includes('--history')) {
    await showHistory(getArg(args, '--suite'));
    process.exit(0);
  }

  // --compare <id1> <id2>
  const compareIdx = args.indexOf('--compare');
  if (compareIdx !== -1) {
    const id1 = args[compareIdx + 1];
    const id2 = args[compareIdx + 2];
    if (!id1 || !id2) {
      console.error('Usage: --compare <runId1> <runId2>');
      process.exit(1);
    }
    await compareRuns(id1, id2);
    process.exit(0);
  }

  // Get suite
  const suiteId = getArg(args, '--suite') ?? 'agents';
  const suite = ALL_SUITES[suiteId];
  if (!suite) {
    console.error(`Unknown suite: ${suiteId}. Available: ${Object.keys(ALL_SUITES).join(', ')}`);
    process.exit(1);
  }

  // Get git SHA
  let gitSha: string | undefined;
  try {
    const { execSync } = await import('child_process');
    gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* not in git */ }

  // Load deliverables
  let deliverables: Record<string, unknown> | undefined;
  if (!args.includes('--no-data')) {
    deliverables = await loadDeliverables();
  }

  // Parse tags
  const tagsArg = getArg(args, '--tags');
  const tags = tagsArg ? tagsArg.split(',') : undefined;

  // Run
  const summary = await runEvalSuite(suite, {
    suiteId: suite.id,
    orgId: REAL_ORG_ID,
    deliverables,
    gitSha,
    trigger: 'manual',
    persist: !args.includes('--no-persist'),
    grade: !args.includes('--no-grade'),
    verbose: true,
    tags,
    concurrency: args.includes('--serial') ? 1 : 2,
  });

  // Exit code based on pass/fail
  const passRate = summary.totalTests > 0 ? summary.passedTests / summary.totalTests : 0;
  process.exit(passRate >= 0.8 ? 0 : 1); // 80% pass rate threshold
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

async function loadDeliverables(): Promise<Record<string, unknown> | undefined> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return undefined;

    const supabase = createClient(url, key);
    const { data } = await supabase
      .from('jobs')
      .select('results_json')
      .eq('organization_id', REAL_ORG_ID)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.results_json) {
      console.log(`[Eval] Loaded deliverables (${Object.keys(data.results_json).length} sections)`);
      return data.results_json as Record<string, unknown>;
    }
  } catch {
    console.log('[Eval] No deliverables loaded — running without analysis data');
  }
  return undefined;
}

async function showHistory(suiteFilter?: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.error('No Supabase credentials'); return; }

  const supabase = createClient(url, key);
  let query = supabase
    .from('eval_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (suiteFilter) query = query.eq('suite_id', suiteFilter);

  const { data: runs, error } = await query;
  if (error) { console.error('Error:', error.message); return; }
  if (!runs || runs.length === 0) { console.log('No eval runs found.'); return; }

  console.log(`\n${'═'.repeat(80)}`);
  console.log('  EVAL HISTORY');
  console.log(`${'═'.repeat(80)}`);
  console.log(`  ${'ID'.padEnd(12)} ${'Suite'.padEnd(10)} ${'Tests'.padEnd(8)} ${'Score'.padEnd(8)} ${'Halluc'.padEnd(8)} ${'Cost'.padEnd(10)} Date`);
  console.log(`  ${'-'.repeat(74)}`);

  for (const run of runs) {
    const id = run.id.slice(0, 8);
    const suite = run.suite_id.padEnd(10);
    const tests = `${run.passed_tests}/${run.total_tests}`.padEnd(8);
    const score = (run.score_overall?.toFixed(1) ?? 'N/A').padEnd(8);
    const halluc = (run.score_hallucination?.toFixed(1) ?? 'N/A').padEnd(8);
    const cost = `$${(run.total_cost_usd ?? 0).toFixed(4)}`.padEnd(10);
    const date = new Date(run.created_at).toLocaleDateString();
    console.log(`  ${id} ${suite} ${tests} ${score} ${halluc} ${cost} ${date}`);
  }
  console.log('');
}

async function compareRuns(id1: string, id2: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.error('No Supabase credentials'); return; }

  const supabase = createClient(url, key);

  // Support partial IDs
  const findRun = async (id: string) => {
    const { data } = await supabase.from('eval_runs').select('*').ilike('id', `${id}%`).limit(1).single();
    return data;
  };

  const [run1, run2] = await Promise.all([findRun(id1), findRun(id2)]);
  if (!run1 || !run2) { console.error('One or both runs not found'); return; }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  COMPARISON: ${run1.id.slice(0, 8)} vs ${run2.id.slice(0, 8)}`);
  console.log(`${'═'.repeat(60)}`);

  const metrics = [
    ['Overall', 'score_overall'],
    ['Accuracy', 'score_accuracy'],
    ['Hallucination', 'score_hallucination'],
    ['Relevance', 'score_relevance'],
    ['Quality', 'score_quality'],
    ['Efficiency', 'score_efficiency'],
    ['Tests Passed', 'passed_tests'],
    ['Cost (USD)', 'total_cost_usd'],
  ] as const;

  console.log(`  ${'Metric'.padEnd(16)} ${'Run 1'.padEnd(10)} ${'Run 2'.padEnd(10)} Delta`);
  console.log(`  ${'-'.repeat(46)}`);

  for (const [label, key] of metrics) {
    const v1 = run1[key] ?? 0;
    const v2 = run2[key] ?? 0;
    const delta = v2 - v1;
    const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    const indicator = delta > 0 ? ' ▲' : delta < 0 ? ' ▼' : '  ';
    console.log(`  ${label.padEnd(16)} ${String(v1).padEnd(10)} ${String(v2).padEnd(10)} ${deltaStr}${indicator}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
