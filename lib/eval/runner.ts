/**
 * Eval Runner
 *
 * Executes eval suites: runs agent tasks, applies checks, model-grades output,
 * computes dimension scores, detects regressions, and persists results.
 */

import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { globalRegistry, createCostTracker, type ToolContext } from '../execution/tools/index';
import { getAgent } from '../execution/agents/index';
import { OUTFITS, getOutfitSystemPrompt } from '../execution/outfits';
import { gradeOutput } from './grader';
import type {
  EvalSuite, EvalTestCase, EvalResult, EvalRunSummary,
  DimensionScores, Baseline, Regression, CheckMeta, GraderResult,
} from './types';
import { weightedScore, DIMENSION_WEIGHTS } from './types';

const FLASH_MODEL = 'gemini-2.5-flash';

// ── Tool import side-effects (register all tools) ────────────────────────────
import '../execution/tools/web-tools';
import '../execution/tools/marketing-tools';
import '../execution/tools/finance-tools';
import '../execution/tools/hr-tools';
import '../execution/tools/operations-tools';
import '../execution/tools/data-tools';
import '../execution/tools/communication-tools';
import '../execution/tools/social-tools';
import '../execution/tools/github-action-tools';
import '../execution/tools/productivity-tools';
import '../execution/tools/media-tools';

// ── Types ────────────────────────────────────────────────────────────────────

interface RunOptions {
  suiteId: string;
  orgId: string;
  deliverables?: Record<string, unknown>;
  gitSha?: string;
  trigger?: 'manual' | 'ci' | 'deploy' | 'cron';
  persist?: boolean;           // save to Supabase (default: true)
  grade?: boolean;             // run model grader (default: true)
  verbose?: boolean;           // print progress
  tags?: string[];             // only run tests matching these tags
  concurrency?: number;        // parallel test execution (default: 2)
}

interface FunctionCallPart {
  functionCall: { name: string; args: Record<string, unknown> };
}

interface FunctionResponsePart {
  functionResponse: { name: string; response: { output: string } };
}

// ── Execution Engine ─────────────────────────────────────────────────────────

async function executeTestCase(
  test: EvalTestCase,
  orgId: string,
  deliverables?: Record<string, unknown>,
): Promise<{ result: string; toolsUsed: string[]; toolCalls: number; costUsd: number; latencyMs: number }> {
  const start = Date.now();
  const agent = getAgent(test.agentId === 'pivvy' ? 'strategist' : test.agentId);
  if (!agent) throw new Error(`Unknown agent: ${test.agentId}`);

  const outfit = OUTFITS[agent.defaultOutfit];
  if (!outfit) throw new Error(`Unknown outfit: ${agent.defaultOutfit}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });
  const functionDeclarations = globalRegistry.toGeminiFunctionDeclarations(outfit.tools);
  const costTracker = createCostTracker(1.0);
  const toolsUsed: string[] = [];
  let toolCalls = 0;
  const hasDeliverables = !!deliverables && Object.keys(deliverables).length > 0;

  const toolContext: ToolContext = {
    orgId,
    agentId: test.agentId,
    sessionId: `eval-${uuidv4()}`,
    deliverables,
    costTracker,
  };

  const outfitPrompt = getOutfitSystemPrompt(agent.defaultOutfit);
  const now = new Date();

  const dataStrategy = hasDeliverables
    ? `--- Data Access ---
You have business analysis data via query_analysis.
1. Call query_analysis(section: "list_sections") to discover data.
2. Use query_analysis(section: "search", query: "...") for targeted lookups.
3. Ground ALL content in the company's actual data.`
    : `--- Data Access ---
No business analysis data loaded.
1. Task title and description are your PRIMARY context.
2. Do NOT call query_analysis. Go straight to domain tools.
3. Use web_search if needed.
4. NEVER produce generic placeholder content.`;

  const systemPrompt = `${agent.systemPrompt}

--- Situational Awareness ---
Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}, ${now.toLocaleDateString('en-US', { weekday: 'long' })}
Agent: ${agent.name} (${agent.id}) | Outfit: ${agent.defaultOutfit}

--- Current Task ---
Title: ${test.title}
Description: ${test.description}

--- Domain Knowledge ---
${outfitPrompt}

${dataStrategy}

--- Rules ---
JUST DO IT: Execute the task. Lead with output. Don't ask before starting.
CONVERSATIONAL: Talk like a helpful colleague. Use markdown. Offer next steps.
INLINE CONNECTIONS: If a tool returns "[connect:X]", copy it verbatim. Never paraphrase.
ANTI-HALLUCINATION: Never invent stats, case studies, or testimonials. Label estimates.`;

  const userPrompt = `Execute: **${test.title}**\n\n${test.description}`;

  const conversationHistory: Array<{ role: string; parts: unknown[] }> = [
    { role: 'user', parts: [{ text: userPrompt }] },
  ];

  let finalResponse = '';
  const maxRounds = outfit.maxToolRounds;

  // Loop guard
  const toolSigCounts = new Map<string, number>();
  const toolNameCounts = new Map<string, number>();

  for (let round = 0; round < maxRounds; round++) {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
      config: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        systemInstruction: systemPrompt,
        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
        toolConfig: functionDeclarations.length > 0 ? { functionCallingMode: 'AUTO' } : undefined,
      } as Record<string, unknown>,
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      finalResponse = response.text ?? 'No response.';
      break;
    }

    const parts = candidate.content.parts;
    const functionCallParts: FunctionCallPart[] = [];
    let textContent = '';

    for (const part of parts) {
      const p = part as Record<string, unknown>;
      if (p.functionCall) functionCallParts.push(p as unknown as FunctionCallPart);
      if (p.text) textContent += String(p.text);
    }

    conversationHistory.push({ role: 'model', parts });

    if (functionCallParts.length === 0) {
      finalResponse = textContent;
      break;
    }

    const functionResponses: FunctionResponsePart[] = [];

    for (const fc of functionCallParts) {
      const { name, args } = fc.functionCall;
      toolCalls++;

      // Loop guard
      const sig = `${name}:${JSON.stringify(args)}`;
      toolSigCounts.set(sig, (toolSigCounts.get(sig) ?? 0) + 1);
      toolNameCounts.set(name, (toolNameCounts.get(name) ?? 0) + 1);

      if ((toolSigCounts.get(sig) ?? 0) >= 2) {
        functionResponses.push({
          functionResponse: { name, response: { output: `DUPLICATE: Already called with these args. Write your response NOW.` } },
        });
        continue;
      }
      if ((toolNameCounts.get(name) ?? 0) >= 3) {
        functionResponses.push({
          functionResponse: { name, response: { output: `ENOUGH: Called ${name} too many times. Write your final response.` } },
        });
        continue;
      }

      if (!toolsUsed.includes(name)) toolsUsed.push(name);

      try {
        const toolResult = await globalRegistry.execute(name, args, toolContext);
        let output = typeof toolResult.output === 'string' ? toolResult.output : JSON.stringify(toolResult.output);
        // Add connect marker instruction
        if (output.includes('[connect:')) {
          output += '\n\nIMPORTANT: Include the [connect:...] marker EXACTLY as shown above in your response verbatim.';
        }
        functionResponses.push({
          functionResponse: { name, response: { output: output.slice(0, 8000) } },
        });
      } catch (err) {
        functionResponses.push({
          functionResponse: { name, response: { output: `Error: ${err instanceof Error ? err.message : 'unknown'}` } },
        });
      }
    }

    conversationHistory.push({ role: 'user', parts: functionResponses });
  }

  // Forced synthesis if no text output
  if (!finalResponse.trim()) {
    conversationHistory.push({
      role: 'user',
      parts: [{ text: 'SYSTEM: Provide your FINAL response using ALL gathered data. Do NOT call tools.' }],
    });
    try {
      const synthResp = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
        config: { temperature: 0.1, maxOutputTokens: 4096, systemInstruction: systemPrompt } as Record<string, unknown>,
      });
      finalResponse = synthResp.text ?? '';
    } catch {
      finalResponse = 'Agent failed to synthesize a response.';
    }
  }

  // Post-process: inject missed [connect:X] markers from tool results
  const connectRe = /\[connect:([a-z_]+)\]/g;
  const toolMarkersFound = new Set<string>();
  for (const msg of conversationHistory) {
    if (msg.role !== 'user') continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      const fr = p?.functionResponse as Record<string, unknown> | undefined;
      const output = (fr?.response as Record<string, unknown>)?.output;
      if (typeof output === 'string') {
        let match: RegExpExecArray | null;
        const re = new RegExp(connectRe.source, 'g');
        while ((match = re.exec(output)) !== null) {
          toolMarkersFound.add(match[0]);
        }
      }
    }
  }
  if (toolMarkersFound.size > 0) {
    const missing = [...toolMarkersFound].filter(m => !finalResponse.includes(m));
    if (missing.length > 0) {
      finalResponse += '\n\n' + missing.join('\n');
    }
  }

  return {
    result: finalResponse,
    toolsUsed,
    toolCalls,
    costUsd: costTracker.totalSpent,
    latencyMs: Date.now() - start,
  };
}

// ── Score Calculator ─────────────────────────────────────────────────────────

function computeScores(
  checks: EvalTestCase['checks'],
  checkResults: { passed: string[]; failed: string[] },
  graderScores?: DimensionScores,
  meta?: CheckMeta,
): DimensionScores {
  const scores: DimensionScores = { accuracy: 0, hallucination: 100, relevance: 0, quality: 0, efficiency: 0 };

  // Compute per-dimension pass rate from checks
  const dimChecks: Record<keyof DimensionScores, { total: number; passed: number }> = {
    accuracy: { total: 0, passed: 0 },
    hallucination: { total: 0, passed: 0 },
    relevance: { total: 0, passed: 0 },
    quality: { total: 0, passed: 0 },
    efficiency: { total: 0, passed: 0 },
  };

  for (const check of checks) {
    dimChecks[check.dimension].total++;
    if (checkResults.passed.includes(check.name)) {
      dimChecks[check.dimension].passed++;
    }
  }

  // Convert to 0-100 score
  for (const dim of Object.keys(dimChecks) as Array<keyof DimensionScores>) {
    const { total, passed } = dimChecks[dim];
    const checkScore = total > 0 ? (passed / total) * 100 : 75; // default if no checks
    // Blend check score (40%) with grader score (60%) if available
    if (graderScores) {
      scores[dim] = Math.round(checkScore * 0.4 + graderScores[dim] * 0.6);
    } else {
      scores[dim] = Math.round(checkScore);
    }
  }

  return scores;
}

// ── Main Runner ──────────────────────────────────────────────────────────────

export async function runEvalSuite(
  suite: EvalSuite,
  options: RunOptions,
): Promise<EvalRunSummary> {
  const {
    orgId, deliverables, gitSha, trigger = 'manual',
    persist = true, grade = true, verbose = true,
    tags, concurrency = 2,
  } = options;

  const runId = uuidv4();
  const startTime = Date.now();

  // Filter tests by tags
  let tests = suite.tests;
  if (tags && tags.length > 0) {
    tests = tests.filter(t => t.tags?.some(tag => tags.includes(tag)));
  }

  if (verbose) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  EVAL: ${suite.name} (${tests.length} tests)`);
    console.log(`  Run ID: ${runId}`);
    if (gitSha) console.log(`  Git SHA: ${gitSha}`);
    console.log(`${'═'.repeat(60)}\n`);
  }

  // Persist run start
  let supabase: ReturnType<typeof import('../supabase/admin').createAdminClient> | null = null;
  if (persist) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      supabase = createAdminClient();
      await supabase.from('eval_runs').insert({
        id: runId,
        suite_id: suite.id,
        git_sha: gitSha,
        trigger,
        status: 'running',
        total_tests: tests.length,
      });
    } catch (err) {
      console.warn('[Eval] Could not persist run start:', err instanceof Error ? err.message : err);
      supabase = null;
    }
  }

  // Execute tests with controlled concurrency
  const results: EvalResult[] = [];
  for (let i = 0; i < tests.length; i += concurrency) {
    const batch = tests.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(test => runSingleTest(test, orgId, deliverables, grade, verbose)),
    );
    for (let j = 0; j < batch.length; j++) {
      const settled = batchResults[j];
      if (settled.status === 'fulfilled') {
        results.push(settled.value);
      } else {
        results.push({
          testName: batch[j].name,
          agentId: batch[j].agentId,
          status: 'error',
          scores: { accuracy: 0, hallucination: 0, relevance: 0, quality: 0, efficiency: 0 },
          overall: 0,
          checksPassed: [],
          checksFailed: [],
          output: '',
          toolsUsed: [],
          toolCalls: 0,
          tokensUsed: 0,
          costUsd: 0,
          latencyMs: 0,
          taskTitle: batch[j].title,
          taskDescription: batch[j].description,
          error: settled.reason?.message ?? String(settled.reason),
        });
      }
    }
  }

  // Aggregate scores
  const passedTests = results.filter(r => r.status === 'passed').length;
  const failedTests = results.filter(r => r.status === 'failed' || r.status === 'error').length;
  const totalChecks = results.reduce((s, r) => s + r.checksPassed.length + r.checksFailed.length, 0);
  const passedChecks = results.reduce((s, r) => s + r.checksPassed.length, 0);
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
  const totalTime = Date.now() - startTime;
  const avgLatency = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length) : 0;

  // Average dimension scores
  const avgScores: DimensionScores = { accuracy: 0, hallucination: 0, relevance: 0, quality: 0, efficiency: 0 };
  if (results.length > 0) {
    for (const dim of Object.keys(avgScores) as Array<keyof DimensionScores>) {
      avgScores[dim] = Math.round(results.reduce((s, r) => s + r.scores[dim], 0) / results.length);
    }
  }
  const overallScore = weightedScore(avgScores);

  // Detect regressions against baselines
  let regressions: Regression[] = [];
  if (supabase) {
    regressions = await detectRegressions(supabase, suite.id, avgScores, overallScore, results);
  }

  const summary: EvalRunSummary = {
    id: runId,
    suiteId: suite.id,
    gitSha,
    trigger,
    status: 'completed',
    totalTests: tests.length,
    passedTests,
    failedTests,
    totalChecks,
    passedChecks,
    scores: { ...avgScores, overall: overallScore },
    totalCostUsd: totalCost,
    totalTokens: 0,
    totalTimeMs: totalTime,
    avgLatencyMs: avgLatency,
    results,
    regressions,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  // Persist results
  if (supabase) {
    try {
      // Update run
      await supabase.from('eval_runs').update({
        status: 'completed',
        total_tests: tests.length,
        passed_tests: passedTests,
        failed_tests: failedTests,
        total_checks: totalChecks,
        passed_checks: passedChecks,
        score_overall: overallScore,
        score_accuracy: avgScores.accuracy,
        score_hallucination: avgScores.hallucination,
        score_relevance: avgScores.relevance,
        score_quality: avgScores.quality,
        score_efficiency: avgScores.efficiency,
        total_cost_usd: totalCost,
        total_time_ms: totalTime,
        avg_latency_ms: avgLatency,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);

      // Insert results
      const rows = results.map(r => ({
        run_id: runId,
        test_name: r.testName,
        agent_id: r.agentId,
        status: r.status,
        score_accuracy: r.scores.accuracy,
        score_hallucination: r.scores.hallucination,
        score_relevance: r.scores.relevance,
        score_quality: r.scores.quality,
        score_efficiency: r.scores.efficiency,
        checks_passed: r.checksPassed,
        checks_failed: r.checksFailed,
        grader_verdict: r.grader?.verdict,
        grader_reasoning: r.grader?.reasoning,
        grader_scores: r.grader?.scores,
        output: r.output.slice(0, 10000),
        tools_used: r.toolsUsed,
        tool_calls: r.toolCalls,
        cost_usd: r.costUsd,
        latency_ms: r.latencyMs,
        task_title: r.taskTitle,
        task_description: r.taskDescription,
      }));
      await supabase.from('eval_results').insert(rows);
    } catch (err) {
      console.warn('[Eval] Could not persist results:', err instanceof Error ? err.message : err);
    }
  }

  // Print summary
  if (verbose) {
    printSummary(summary);
  }

  return summary;
}

// ── Single Test Execution ────────────────────────────────────────────────────

async function runSingleTest(
  test: EvalTestCase,
  orgId: string,
  deliverables?: Record<string, unknown>,
  grade = true,
  verbose = true,
): Promise<EvalResult> {
  if (verbose) console.log(`  ▶ ${test.name} (${test.agentId})`);

  try {
    const { result, toolsUsed, toolCalls, costUsd, latencyMs } = await executeTestCase(test, orgId, deliverables);

    // Run checks
    const meta: CheckMeta = { toolsUsed, toolCalls, latencyMs, taskTitle: test.title, taskDescription: test.description };
    const passed: string[] = [];
    const failed: string[] = [];

    for (const check of test.checks) {
      if (check.check(result, meta)) {
        passed.push(check.name);
      } else {
        failed.push(check.name);
      }
    }

    // Model-grade
    let graderResult: GraderResult | undefined = undefined;
    if (grade) {
      graderResult = await gradeOutput(test.title, test.description, result, toolsUsed);
    }

    const scores = computeScores(test.checks, { passed, failed }, graderResult?.scores, meta);
    const overall = weightedScore(scores);
    const status = failed.length === 0 ? 'passed' as const : 'failed' as const;

    if (verbose) {
      const icon = status === 'passed' ? '✓' : '✗';
      const failStr = failed.length > 0 ? ` [FAILED: ${failed.join(', ')}]` : '';
      const gradeStr = graderResult ? ` | Grade: ${graderResult.verdict} (${overall})` : '';
      console.log(`    ${icon} ${passed.length}/${passed.length + failed.length} checks${failStr}${gradeStr} | ${latencyMs}ms | $${costUsd.toFixed(4)}`);
    }

    return {
      testName: test.name,
      agentId: test.agentId,
      status,
      scores,
      overall,
      checksPassed: passed,
      checksFailed: failed,
      grader: graderResult,
      output: result,
      toolsUsed,
      toolCalls,
      tokensUsed: 0,
      costUsd,
      latencyMs,
      taskTitle: test.title,
      taskDescription: test.description,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (verbose) console.log(`    ✗ ERROR: ${message}`);
    return {
      testName: test.name,
      agentId: test.agentId,
      status: 'error',
      scores: { accuracy: 0, hallucination: 0, relevance: 0, quality: 0, efficiency: 0 },
      overall: 0,
      checksPassed: [],
      checksFailed: test.checks.map(c => c.name),
      output: '',
      toolsUsed: [],
      toolCalls: 0,
      tokensUsed: 0,
      costUsd: 0,
      latencyMs: 0,
      taskTitle: test.title,
      taskDescription: test.description,
      error: message,
    };
  }
}

// ── Regression Detection ─────────────────────────────────────────────────────

async function detectRegressions(
  supabase: ReturnType<typeof import('../supabase/admin').createAdminClient>,
  suiteId: string,
  avgScores: DimensionScores,
  overallScore: number,
  results: EvalResult[],
): Promise<Regression[]> {
  const regressions: Regression[] = [];

  try {
    const { data: baselines } = await supabase
      .from('eval_baselines')
      .select('*')
      .eq('suite_id', suiteId);

    if (!baselines || baselines.length === 0) return [];

    for (const b of baselines as Baseline[]) {
      let current: number;
      if (b.metric === 'score_overall') {
        current = overallScore;
      } else if (b.metric.startsWith('score_') && !b.agentId) {
        const dim = b.metric.replace('score_', '') as keyof DimensionScores;
        current = avgScores[dim] ?? 0;
      } else if (b.agentId) {
        // Agent-level baseline
        const agentResults = results.filter(r => r.agentId === b.agentId);
        if (agentResults.length === 0) continue;
        const dim = b.metric.replace('score_', '') as keyof DimensionScores;
        current = Math.round(agentResults.reduce((s, r) => s + (r.scores[dim] ?? 0), 0) / agentResults.length);
      } else {
        continue;
      }

      const delta = current - b.value;
      if (delta < -b.threshold) {
        regressions.push({
          metric: b.metric,
          agentId: b.agentId,
          baseline: b.value,
          current,
          delta,
          threshold: b.threshold,
        });
      }
    }
  } catch {
    // No baselines table yet — skip
  }

  return regressions;
}

// ── Pretty Print ─────────────────────────────────────────────────────────────

function printSummary(summary: EvalRunSummary): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTS: ${summary.suiteId}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Tests:  ${summary.passedTests}/${summary.totalTests} passed`);
  console.log(`  Checks: ${summary.passedChecks}/${summary.totalChecks} passed (${summary.totalChecks > 0 ? Math.round(summary.passedChecks / summary.totalChecks * 100) : 0}%)`);
  console.log(`  Cost:   $${summary.totalCostUsd.toFixed(4)}`);
  console.log(`  Time:   ${(summary.totalTimeMs / 1000).toFixed(1)}s (avg ${(summary.avgLatencyMs / 1000).toFixed(1)}s per test)`);
  console.log('');
  console.log('  Scores:');
  console.log(`    Overall:       ${summary.scores.overall}`);
  console.log(`    Accuracy:      ${summary.scores.accuracy}`);
  console.log(`    Hallucination: ${summary.scores.hallucination}`);
  console.log(`    Relevance:     ${summary.scores.relevance}`);
  console.log(`    Quality:       ${summary.scores.quality}`);
  console.log(`    Efficiency:    ${summary.scores.efficiency}`);

  if (summary.regressions.length > 0) {
    console.log('');
    console.log('  ⚠ REGRESSIONS DETECTED:');
    for (const r of summary.regressions) {
      const agent = r.agentId ? ` (${r.agentId})` : '';
      console.log(`    ${r.metric}${agent}: ${r.baseline} → ${r.current} (${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}, threshold: ${r.threshold})`);
    }
  }

  // Failed tests
  const failures = summary.results.filter(r => r.status !== 'passed');
  if (failures.length > 0) {
    console.log('');
    console.log('  Failed Tests:');
    for (const f of failures) {
      console.log(`    ✗ ${f.testName}: ${f.checksFailed.join(', ')}${f.error ? ` | Error: ${f.error}` : ''}`);
      if (f.grader) {
        console.log(`      Grade: ${f.grader.verdict} — ${f.grader.reasoning.slice(0, 120)}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}\n`);
}

// ── Baseline Management ──────────────────────────────────────────────────────

export async function setBaseline(suiteId: string, runId: string): Promise<void> {
  const { createAdminClient } = await import('../supabase/admin');
  const supabase = createAdminClient();

  const { data: run } = await supabase.from('eval_runs').select('*').eq('id', runId).single();
  if (!run) throw new Error(`Run not found: ${runId}`);

  const metrics = [
    { metric: 'score_overall', value: run.score_overall },
    { metric: 'score_accuracy', value: run.score_accuracy },
    { metric: 'score_hallucination', value: run.score_hallucination },
    { metric: 'score_relevance', value: run.score_relevance },
    { metric: 'score_quality', value: run.score_quality },
    { metric: 'score_efficiency', value: run.score_efficiency },
  ];

  for (const { metric, value } of metrics) {
    if (value == null) continue;
    await supabase.from('eval_baselines').upsert({
      suite_id: suiteId,
      agent_id: null,
      metric,
      baseline_value: value,
      threshold: 5.0,
      run_id: runId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'suite_id,agent_id,metric' });
  }

  console.log(`[Eval] Baseline set from run ${runId} for suite ${suiteId}`);
}
