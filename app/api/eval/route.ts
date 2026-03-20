/**
 * GET /api/eval — List eval runs with scores
 * GET /api/eval?id=<runId> — Get single run with results
 * POST /api/eval — Trigger an eval run
 * POST /api/eval { action: "baseline", runId } — Set baseline from a run
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/supabase/auth-api';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('id');
  const suiteId = searchParams.get('suite');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  // Single run with results
  if (runId) {
    const [{ data: run }, { data: results }] = await Promise.all([
      supabase.from('eval_runs').select('*').eq('id', runId).single(),
      supabase.from('eval_results').select('*').eq('run_id', runId).order('created_at'),
    ]);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run, results });
  }

  // List runs
  let query = supabase
    .from('eval_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (suiteId) query = query.eq('suite_id', suiteId);

  const { data: runs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also fetch latest baselines
  const { data: baselines } = await supabase
    .from('eval_baselines')
    .select('*')
    .order('updated_at', { ascending: false });

  return NextResponse.json({ runs, baselines });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { action, suiteId, runId, tags, orgId } = body;

  // Set baseline
  if (action === 'baseline') {
    if (!runId || !suiteId) {
      return NextResponse.json({ error: 'runId and suiteId required' }, { status: 400 });
    }
    try {
      const { setBaseline } = await import('@/lib/eval/index');
      await setBaseline(suiteId, runId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
    }
  }

  // Trigger eval run (non-blocking)
  const resolvedOrgId = orgId ?? 'bad7cf7d-f09f-410c-8ca1-607652d00bb8';
  const suite = suiteId ?? 'quick';
  const { ALL_SUITES, runEvalSuite } = await import('@/lib/eval/index');
  const evalSuite = ALL_SUITES[suite];
  if (!evalSuite) {
    return NextResponse.json({ error: `Unknown suite: ${suite}. Available: ${Object.keys(ALL_SUITES).join(', ')}` }, { status: 400 });
  }

  // Load deliverables
  const supabase = createAdminClient();
  let deliverables: Record<string, unknown> | undefined;
  try {
    const { data } = await supabase
      .from('jobs')
      .select('results_json')
      .eq('organization_id', resolvedOrgId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data?.results_json) deliverables = data.results_json as Record<string, unknown>;
  } catch { /* no data */ }

  // Get git SHA
  let gitSha: string | undefined;
  try {
    const { execSync } = await import('child_process');
    gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* not in git */ }

  // Fire and forget — run in background
  const runPromise = runEvalSuite(evalSuite, {
    suiteId: suite,
    orgId: resolvedOrgId,
    deliverables,
    gitSha,
    trigger: 'manual',
    persist: true,
    grade: true,
    verbose: false,
    tags,
    concurrency: 2,
  });

  // Don't await — return immediately
  runPromise.catch(err => console.error('[Eval API] Run failed:', err));

  return NextResponse.json({
    message: `Eval suite '${suite}' started (${evalSuite.tests.length} tests)`,
    suiteId: suite,
  });
}
