/**
 * Pivvy (Business Agent) Live Tests
 *
 * Tests the full business agent pipeline: memory loading, tool calling,
 * web search, projections, navigation, and integration data retrieval.
 *
 * Run:  npx tsx scripts/test-pivvy-live.ts
 * Quick: npx tsx scripts/test-pivvy-live.ts --quick
 */

// Load env vars
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

// ── Types ───────────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  message: string;
  /** Previous messages in the conversation (for multi-turn tests) */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  checks: QualityCheck[];
  /** Expected tools to be used (if any) */
  expectTools?: string[];
}

interface QualityCheck {
  name: string;
  check: (result: string, toolsUsed?: string[]) => boolean;
}

interface TestResult {
  name: string;
  passed: string[];
  failed: string[];
  output: string;
  toolsUsed: string[];
  timeMs: number;
}

// ── Quality Check Helpers ───────────────────────────────────────────────────

function minLength(n: number): QualityCheck {
  return { name: `Output > ${n} chars`, check: (r) => r.length > n };
}

function containsAny(...keywords: string[]): QualityCheck {
  return {
    name: `Contains: ${keywords.slice(0, 3).join('/')}`,
    check: (r) => {
      const lower = r.toLowerCase();
      return keywords.some(k => lower.includes(k.toLowerCase()));
    },
  };
}

function notEmpty(): QualityCheck {
  return {
    name: 'Not empty/error response',
    check: (r) => {
      const lower = r.toLowerCase();
      return r.length > 50 && !lower.includes('i encountered an issue') && !lower.includes('technical issue');
    },
  };
}

function noHallucination(): QualityCheck {
  return {
    name: 'No hallucination markers',
    check: (r) => {
      const lower = r.toLowerCase();
      const flags = ['john doe', 'jane doe', 'xyz corp', 'abc company', 'lorem ipsum', '[insert'];
      return !flags.some(f => lower.includes(f));
    },
  };
}

function usedTool(toolName: string): QualityCheck {
  return {
    name: `Used tool: ${toolName}`,
    check: (_r, tools) => (tools ?? []).includes(toolName),
  };
}

function didNotUseTool(toolName: string): QualityCheck {
  return {
    name: `Did NOT call: ${toolName}`,
    check: (_r, tools) => !(tools ?? []).includes(toolName),
  };
}

function hasProjectionMarker(): QualityCheck {
  return {
    name: 'Contains <!--PROJECTION:...--> marker',
    check: (r) => /<!--PROJECTION:/.test(r),
  };
}

function hasNavigateMarker(): QualityCheck {
  return {
    name: 'Contains <!--NAVIGATE:...--> marker',
    check: (r) => /<!--NAVIGATE:/.test(r),
  };
}

function suggestsNextSteps(): QualityCheck {
  return {
    name: 'Suggests next steps',
    check: (r) => {
      const lower = r.toLowerCase();
      return (
        lower.includes('would you like') || lower.includes('want me to') ||
        lower.includes('shall i') || lower.includes('i can') ||
        lower.includes('should i') || lower.includes('next step') ||
        lower.includes('let me know') || lower.includes('happy to') ||
        lower.includes('recommend') || lower.includes('suggest')
      );
    },
  };
}

function maxLength(n: number): QualityCheck {
  return { name: `Output < ${n} chars (efficient)`, check: (r) => r.length < n };
}

// ── Test Cases ──────────────────────────────────────────────────────────────

const ALL_TESTS: TestCase[] = [
  // 1. Memory-based answer (no tool needed)
  {
    name: 'Memory: Health Score',
    message: "What's my health score?",
    checks: [
      notEmpty(),
      containsAny('health score', 'score', 'grade', '/100'),
      didNotUseTool('get_report_section'),
      suggestsNextSteps(),
      noHallucination(),
      maxLength(3000),
    ],
  },

  // 2. Tool-calling question
  {
    name: 'Tool: Expenses breakdown',
    message: 'What are my expenses and where do those numbers come from?',
    checks: [
      notEmpty(),
      containsAny('expense', 'cost', 'spend', 'burn', 'budget'),
      usedTool('get_report_section'),
      suggestsNextSteps(),
      noHallucination(),
    ],
  },

  // 3. Revenue leaks (specific data pull or navigation)
  {
    name: 'Tool: Revenue Leaks',
    message: 'Break down my revenue leaks in detail with specific numbers.',
    checks: [
      notEmpty(),
      containsAny('revenue', 'leak', '$'),
      noHallucination(),
    ],
  },

  // 4. Integration data query
  {
    name: 'Tool: Integration Data',
    message: "What data do you have from my connected tools? Pull the latest from Stripe.",
    checks: [
      notEmpty(),
      usedTool('get_integration_data'),
      noHallucination(),
    ],
  },

  // 5. Web search
  {
    name: 'Tool: Web Search',
    message: 'What are SaaS industry benchmarks for monthly churn rate?',
    checks: [
      notEmpty(),
      containsAny('churn', '%', 'benchmark', 'saas'),
      usedTool('search_web'),
      noHallucination(),
    ],
  },

  // 6. Navigation
  {
    name: 'Navigation: Action Plan',
    message: 'Show me the action plan.',
    checks: [
      notEmpty(),
      hasNavigateMarker(),
      usedTool('navigate_to_page'),
    ],
  },

  // 7. Projection
  {
    name: 'Projection: Cash Forecast',
    message: 'What would my cash look like in 6 months if I fix my top revenue leaks?',
    checks: [
      notEmpty(),
      hasProjectionMarker(),
      usedTool('generate_projection'),
      noHallucination(),
    ],
  },

  // 8. Conversational greeting
  {
    name: 'Conversational: Greeting',
    message: "Hey, I'm new here. What can you tell me about my business?",
    checks: [
      notEmpty(),
      containsAny('health', 'score', 'runway', 'revenue', 'business'),
      suggestsNextSteps(),
      noHallucination(),
      maxLength(4000),
    ],
  },

  // 9. Follow-up question (multi-turn)
  {
    name: 'Multi-turn: Follow-up',
    message: 'Tell me more about the top one.',
    history: [
      { role: 'user', content: 'What are my revenue leaks?' },
      { role: 'assistant', content: 'Here are your top revenue leaks:\n1. Pricing below market rate - $15,000\n2. Unbilled services - $8,000\n3. Customer churn - $5,000\n\nWould you like me to dive deeper into any of these?' },
    ],
    checks: [
      notEmpty(),
      noHallucination(),
    ],
  },

  // 10. Error recovery (bad section name)
  {
    name: 'Error Recovery: Invalid section',
    message: 'Show me the quantum flux analysis section.',
    checks: [
      notEmpty(),
      noHallucination(),
      // Should gracefully handle — not crash
    ],
  },
];

const QUICK_TESTS = ALL_TESTS.filter(t =>
  ['Memory: Health Score', 'Tool: Expenses breakdown', 'Tool: Web Search', 'Projection: Cash Forecast'].includes(t.name)
);

// ── Test Runner ─────────────────────────────────────────────────────────────

// Dynamic import to ensure env vars are loaded first
let runBusinessAgent: (req: any) => Promise<{ message: string; toolsUsed?: string[] }>;

async function loadAgent() {
  const mod = await import('../lib/agent/business-agent');
  runBusinessAgent = mod.runBusinessAgent;
}

async function runTest(test: TestCase, orgId: string): Promise<TestResult> {
  console.log(`\n  ▶ ${test.name}`);
  console.log(`    Message: "${test.message.slice(0, 80)}"`);
  const start = Date.now();

  try {
    const req = {
      orgId,
      messages: (test.history ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      message: test.message,
    };

    const result = await runBusinessAgent(req);
    const timeMs = Date.now() - start;

    const passed: string[] = [];
    const failed: string[] = [];

    for (const qc of test.checks) {
      if (qc.check(result.message, result.toolsUsed)) {
        passed.push(qc.name);
      } else {
        failed.push(qc.name);
      }
    }

    const status = failed.length === 0 ? '✅ PASS' : `⚠️  ${passed.length}/${test.checks.length}`;
    console.log(`    ${status} (${(timeMs / 1000).toFixed(1)}s)`);
    if (result.toolsUsed?.length) {
      console.log(`    🔧 Tools: ${result.toolsUsed.join(', ')}`);
    }
    if (failed.length > 0) {
      for (const f of failed) console.log(`    ❌ ${f}`);
    }
    const preview = result.message.replace(/\n+/g, ' ').replace(/<!--[\s\S]*?-->/g, '[marker]').slice(0, 200);
    console.log(`    📝 "${preview}..."`);

    return { name: test.name, passed, failed, output: result.message, toolsUsed: result.toolsUsed ?? [], timeMs };
  } catch (err) {
    const timeMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ CRASHED: ${msg} (${(timeMs / 1000).toFixed(1)}s)`);
    return { name: test.name, passed: [], failed: test.checks.map(c => c.name), output: `ERROR: ${msg}`, toolsUsed: [], timeMs };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick');
  const tests = isQuick ? QUICK_TESTS : ALL_TESTS;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PIVVY (BUSINESS AGENT) LIVE TESTS');
  console.log(`  Mode: ${isQuick ? 'QUICK (4 tests)' : 'FULL (10 tests)'}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Check required env vars
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Supabase env vars not set');
    process.exit(1);
  }

  // Load agent module (after env vars are set)
  await loadAgent();

  // Find an org with agent memory
  console.log('\n  Finding org with agent memory...');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, agent_memory_json')
    .not('agent_memory_json', 'is', null)
    .limit(5);

  if (!orgs || orgs.length === 0) {
    console.error('❌ No organizations with agent memory found');
    process.exit(1);
  }

  const org = orgs[0];
  console.log(`  ✅ Using org: ${org.name} (${org.id})`);

  // Run tests
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  RUNNING PIVVY TESTS');
  console.log('───────────────────────────────────────────────────────────');

  const results: TestResult[] = [];
  for (const test of tests) {
    const result = await runTest(test, org.id);
    results.push(result);
    // Delay between tests to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  const totalTests = results.length;
  const fullPasses = results.filter(r => r.failed.length === 0).length;
  const totalChecks = results.reduce((sum, r) => sum + r.passed.length + r.failed.length, 0);
  const passedChecks = results.reduce((sum, r) => sum + r.passed.length, 0);
  const totalTime = results.reduce((sum, r) => sum + r.timeMs, 0);

  console.log(`\n  Tests: ${fullPasses}/${totalTests} fully passed`);
  console.log(`  Checks: ${passedChecks}/${totalChecks} passed (${((passedChecks / totalChecks) * 100).toFixed(1)}%)`);
  console.log(`  Time: ${(totalTime / 1000).toFixed(1)}s total`);

  const failures = results.filter(r => r.failed.length > 0);
  if (failures.length > 0) {
    console.log('\n  Failed checks:');
    for (const r of failures) {
      console.log(`    ${r.name}: ${r.failed.join(', ')}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
