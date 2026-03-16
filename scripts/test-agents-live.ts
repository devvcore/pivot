/**
 * Live Agent Quality Tests
 *
 * Runs real tasks through the orchestrator pipeline and validates output quality.
 * Tests both WITH and WITHOUT deliverables to ensure agents produce useful content.
 *
 * Run:  npx tsx scripts/test-agents-live.ts
 * Quick: npx tsx scripts/test-agents-live.ts --quick  (3 tests only)
 */

// Load env vars from .env file
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
} catch { /* .env not found, rely on existing env */ }

// ── Inline Orchestrator (avoids @/ alias issues in scripts) ─────────────────

import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';

// Import tool + agent modules using relative paths
import { globalRegistry, createCostTracker, type ToolContext, type ToolResult } from '../lib/execution/tools/index';
import '../lib/execution/tools/web-tools';
import '../lib/execution/tools/marketing-tools';
import '../lib/execution/tools/finance-tools';
import '../lib/execution/tools/hr-tools';
import '../lib/execution/tools/operations-tools';
import '../lib/execution/tools/data-tools';
import { getAgent, type AgentDefinition } from '../lib/execution/agents/index';
import { OUTFITS, getOutfitSystemPrompt } from '../lib/execution/outfits';

const FLASH_MODEL = 'gemini-2.5-flash';

// ── Types ───────────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  agentId: string;
  title: string;
  description: string;
  checks: QualityCheck[];
}

interface QualityCheck {
  name: string;
  check: (result: string) => boolean;
}

interface TestResult {
  testName: string;
  agentId: string;
  passed: string[];
  failed: string[];
  output: string;
  timeMs: number;
  cost: number;
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

function containsAll(...keywords: string[]): QualityCheck {
  return {
    name: `Contains all: ${keywords.slice(0, 3).join('/')}`,
    check: (r) => {
      const lower = r.toLowerCase();
      return keywords.every(k => lower.includes(k.toLowerCase()));
    },
  };
}

function hasHeaders(): QualityCheck {
  return {
    name: 'Has structured headers',
    check: (r) => (r.match(/#{1,4}\s|^\*\*[A-Z]/gm) || []).length >= 2,
  };
}

function notGeneric(): QualityCheck {
  return {
    name: 'Not generic filler',
    check: (r) => {
      const genericPhrases = [
        'lorem ipsum', 'insert company name', 'your company name here',
        '[company name]', '[your company]', '[your name]', '[insert',
        'placeholder', 'example company', 'xyz corp', 'abc company',
      ];
      const lower = r.toLowerCase();
      return !genericPhrases.some(p => lower.includes(p));
    },
  };
}

function isConversational(): QualityCheck {
  return {
    name: 'Conversational tone (offers next steps)',
    check: (r) => {
      const lower = r.toLowerCase();
      // Should offer next steps or ask what user wants
      return (
        lower.includes('would you like') ||
        lower.includes('want me to') ||
        lower.includes('next step') ||
        lower.includes('let me know') ||
        lower.includes('shall i') ||
        lower.includes('i can also') ||
        lower.includes('here\'s what') ||
        lower.includes('here are') ||
        lower.includes('happy to') ||
        lower.includes('feel free') ||
        lower.includes('i recommend') ||
        lower.includes('i\'d suggest') ||
        lower.includes('should i') ||
        lower.includes('you\'ll find') ||
        lower.includes('i\'ve developed') ||
        lower.includes('i\'ve built') ||
        lower.includes('i\'ve created') ||
        lower.includes('i\'ve put together')
      );
    },
  };
}

function usesMarkdown(): QualityCheck {
  return {
    name: 'Uses markdown formatting',
    check: (r) => {
      // Should have markdown headers or bold text
      const hasHeaders = /#{1,3}\s/.test(r);
      const hasBold = /\*\*[^*]+\*\*/.test(r);
      return hasHeaders || hasBold;
    },
  };
}

function noHallucination(): QualityCheck {
  return {
    name: 'No obvious hallucination',
    check: (r) => {
      const lower = r.toLowerCase();
      // Check for fake testimonials/quotes that AI commonly hallucinate
      const redFlags = [
        '"as a [', // "As a [company] customer..."
        'testimonial:', // made up testimonials
        'case study:', // fake case studies
        'according to a recent study by', // fake citations
        'john doe', 'jane doe', // placeholder names
        'xyz corp', 'abc company',
      ];
      return !redFlags.some(f => lower.includes(f));
    },
  };
}

// ── Test Cases ──────────────────────────────────────────────────────────────

const ALL_TESTS: TestCase[] = [
  {
    name: 'Marketer: LinkedIn Posts',
    agentId: 'marketer',
    title: 'Create a LinkedIn post series about Nouvo, an AI-powered business intelligence platform for SMB founders',
    description: 'Nouvo helps small and medium business owners understand their company health through AI analysis. Create 3 engaging LinkedIn posts that highlight: (1) the pain of not knowing your business numbers, (2) how AI can surface hidden revenue leaks, (3) a customer success angle. Target audience: founders and CEOs of companies with 10-100 employees. Tone: professional but approachable. Include relevant hashtags.',
    checks: [
      minLength(600),
      containsAny('linkedin', 'post'),
      containsAny('nouvo', 'business intelligence', 'AI'),
      containsAny('#', 'hashtag'),
      containsAny('founder', 'ceo', 'smb', 'business owner'),
      hasHeaders(),
      notGeneric(),
      isConversational(),
      usesMarkdown(),
      noHallucination(),
    ],
  },
  {
    name: 'Marketer: Google Ads Copy',
    agentId: 'marketer',
    title: 'Create Google Ads copy for Nouvo, an enterprise SaaS platform that automates financial reporting, targeting CFOs and finance leaders',
    description: 'Nouvo automates business health scoring, revenue leak detection, and financial reporting for growing companies. Create Google Ads with A/B variants targeting CFOs and finance directors. Budget: $3000/month. Key USPs: saves 10+ hours/week on reporting, AI-powered insights, integrates with QuickBooks/Stripe. Include headline variants (30 char limit each), descriptions (90 char limit), and targeting suggestions.',
    checks: [
      minLength(500),
      containsAny('headline', 'description', 'variant'),
      containsAny('cfo', 'finance'),
      containsAny('nouvo', 'reporting', 'AI'),
      notGeneric(),
      isConversational(),
      noHallucination(),
    ],
  },
  {
    name: 'Analyst: Startup Budget',
    agentId: 'analyst',
    title: 'Create a Q2 2026 budget for a 15-person SaaS startup with $200K/month revenue, prioritizing engineering and growth marketing',
    description: 'We are a Series A SaaS startup. 15 employees (8 engineering, 3 marketing, 2 sales, 1 ops, 1 CEO). Monthly revenue: $200K, growing 8% MoM. Burn rate: $280K/month. We have $2M in the bank. Create a detailed Q2 budget that allocates spending across departments, with emphasis on engineering (new product features) and growth marketing (paid acquisition). Include line items, monthly breakdown, and runway analysis.',
    checks: [
      minLength(800),
      containsAny('$200', '200k', '200,000'),
      containsAny('engineering', 'marketing'),
      containsAny('budget', 'allocation'),
      containsAny('runway', 'burn', 'cash'),
      hasHeaders(),
      notGeneric(),
      isConversational(),
      noHallucination(),
    ],
  },
  {
    name: 'Recruiter: Job Posting',
    agentId: 'recruiter',
    title: 'Create a job posting for a Senior Full-Stack Developer at a Series A fintech startup, remote-first, $150K-$190K',
    description: 'We are building an AI-powered financial intelligence platform (Nouvo). Stack: Next.js, TypeScript, Supabase, Python. The role involves building our core analysis pipeline and real-time dashboard. Must have 5+ years experience, strong with React and Node.js, experience with AI/ML integration is a plus. We offer equity (0.1-0.3%), unlimited PTO, $2K/year learning budget, health/dental/vision. Company is 15 people, backed by top-tier VCs. Remote-first, US timezones preferred.',
    checks: [
      minLength(700),
      containsAny('$150', '$190', '150k', '190k', '150,000', '190,000', 'salary'),
      containsAny('remote', 'remote-first'),
      containsAny('responsibilities', 'requirements', 'qualifications', 'what you\'ll do', 'what we\'re looking for', 'role', 'about the role', 'you will', 'you\'ll'),
      containsAny('next.js', 'typescript', 'react', 'node', 'tech stack', 'full-stack', 'full stack'),
      containsAny('equity', 'pto', 'benefits'),
      hasHeaders(),
      notGeneric(),
      isConversational(),
      noHallucination(),
    ],
  },
  {
    name: 'Operator: Data Breach SOP',
    agentId: 'operator',
    title: 'Create an SOP for handling customer data breach incidents at a healthcare SaaS company',
    description: 'We are a healthcare SaaS company that stores PHI (Protected Health Information). We need a comprehensive Standard Operating Procedure for data breach response. Must cover: detection and initial assessment, containment procedures, HIPAA breach notification requirements (60-day rule), HHS notification, affected individual notification, documentation requirements, post-incident review process. Include roles and responsibilities, escalation matrix, and timeline requirements.',
    checks: [
      minLength(800),
      containsAny('hipaa', 'phi', 'compliance', 'protected health'),
      containsAny('notification', 'breach'),
      containsAny('escalation', 'containment', 'response'),
      containsAny('step', 'procedure', 'process', 'phase', 'stage', 'sop'),
      hasHeaders(),
      notGeneric(),
      isConversational(),
      noHallucination(),
    ],
  },
  {
    name: 'Researcher: CRM Competitive Landscape',
    agentId: 'researcher',
    title: 'Research the competitive landscape for AI-powered CRM tools targeting mid-market companies',
    description: 'We are evaluating the competitive landscape for AI-powered CRM solutions. Research the top players in this space (Salesforce Einstein, HubSpot AI, Freshsales, Pipedrive, etc.). Focus on: AI capabilities (lead scoring, email automation, deal prediction), pricing for mid-market (50-500 employees), key differentiators, market positioning, recent funding/acquisitions. Provide a comparison matrix and identify gaps/opportunities.',
    checks: [
      minLength(600),
      containsAny('salesforce', 'hubspot', 'freshsales', 'pipedrive', 'zoho'),
      containsAny('AI', 'artificial intelligence', 'machine learning'),
      containsAny('pricing', 'cost'),
      hasHeaders(),
      notGeneric(),
      isConversational(),
      noHallucination(),
    ],
  },
  {
    name: 'Strategist: 90-Day Growth Plan',
    agentId: 'strategist',
    title: 'Create a 90-day growth plan for Nouvo, a B2B SaaS company that just raised a $5M Series A with current ARR of $1.2M',
    description: 'Nouvo is an AI-powered business intelligence platform for SMBs. We just closed our Series A ($5M from top-tier VCs). Current metrics: $1.2M ARR, 85 paying customers, 15 employees, $100K MRR growing 8% MoM, NRR 115%. Our biggest challenges: (1) sales cycle is too long (45 days avg), (2) need to hire 5 more people, (3) need to launch self-serve tier. Create a prioritized 90-day plan with specific initiatives, owners, timelines, and success metrics.',
    checks: [
      minLength(800),
      containsAny('$5m', '$1.2m', '5 million', '1.2 million', '$5 million', '$1.2 million', 'series a', '$5,000'),
      containsAny('hire', 'hiring', 'team'),
      containsAny('self-serve', 'self serve', 'product-led'),
      containsAny('week', 'day', 'month', 'timeline'),
      hasHeaders(),
      notGeneric(),
      isConversational(),
      noHallucination(),
    ],
  },
];

const QUICK_TESTS = ALL_TESTS.filter(t =>
  ['Marketer: LinkedIn Posts', 'Recruiter: Job Posting', 'Strategist: 90-Day Growth Plan'].includes(t.name)
);

// ── Lightweight Execution Engine (no Supabase dependency) ───────────────────

interface FunctionCallPart {
  functionCall: { name: string; args: Record<string, unknown> };
}

interface FunctionResponsePart {
  functionResponse: { name: string; response: { output: string } };
}

async function executeTaskDirect(
  agentId: string,
  title: string,
  description: string,
  deliverables?: Record<string, unknown>,
): Promise<{ result: string; cost: number }> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);

  const outfit = OUTFITS[agent.defaultOutfit];
  if (!outfit) throw new Error(`Unknown outfit: ${agent.defaultOutfit}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });
  const functionDeclarations = globalRegistry.toGeminiFunctionDeclarations(outfit.tools);
  const costTracker = createCostTracker(1.0);
  const hasDeliverables = !!deliverables && Object.keys(deliverables).length > 0;

  const toolContext: ToolContext = {
    orgId: 'test-org',
    agentId,
    sessionId: `test-${uuidv4()}`,
    deliverables,
    costTracker,
  };

  // Build system prompt (BetterBot architecture: Identity → Awareness → Context → Knowledge → Rules)
  const outfitPrompt = getOutfitSystemPrompt(agent.defaultOutfit);
  const now = new Date();

  const dataStrategy = hasDeliverables
    ? `--- Data Access ---
You have business analysis data available via the query_analysis tool.
1. FIRST: Call query_analysis(section: "list_sections") to discover what data exists.
2. Use query_analysis(section: "search", query: "...") to find relevant data.
3. Ground ALL content in the company's actual data.`
    : `--- Data Access ---
No business analysis data is loaded. This means:
1. The task title and description are your PRIMARY context. Extract every detail.
2. Do NOT call query_analysis - there is no data to query. Go straight to your domain tools.
3. Use web_search to gather real market data if needed.
4. NEVER produce generic placeholder content. Be specific with the information given.`;

  const systemPrompt = `${agent.systemPrompt}

--- Situational Awareness ---
Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}, ${now.toLocaleDateString('en-US', { weekday: 'long' })}
Agent: ${agent.name} (${agent.id}) | Outfit: ${agent.defaultOutfit}
Task Priority: high | Budget: $1.00 remaining

--- Current Task ---
Title: ${title}
Description: ${description}

--- Domain Knowledge ---
${outfitPrompt}

${dataStrategy}

--- Rules ---

JUST DO IT:
- When given a task, EXECUTE IT. Don't ask "would you like me to..." before starting.
- Lead with your output. Show the work first, then explain your choices.
- If a tool fails, try a different approach silently.
- One strong deliverable is better than multiple weak ones.

CONVERSATIONAL OUTPUT:
- You are talking to a REAL PERSON in a chat interface. Write like a talented colleague.
- Lead with a 1-2 sentence summary of what you did.
- Use clean markdown: ## headers, **bold**, > blockquotes for featured content, tables for data.
- After presenting, ALWAYS offer 2-3 concrete next steps: "Would you like me to..."
- Be confident. You are an expert.
- NEVER dump raw content without context. Introduce it, present it, offer to do more.

QUALITY BAR:
- Output must be ready to use immediately.
- Be specific to the company, industry, and audience. No generic filler.
- End every response with a "Next Steps" section.

ANTI-HALLUCINATION:
- NEVER invent statistics, case studies, testimonials, or quotes that don't exist.
- NEVER make up company names, product features, or customer stories.
- If you use numbers, use well-known benchmarks or label them as estimates.
- Clearly distinguish between facts and recommendations.`;

  const userPrompt = `Execute this now: **${title}**\n\n${description}\n\nUse your tools, produce the deliverable, and present it conversationally with next steps.`;

  const conversationHistory: Array<{ role: string; parts: unknown[] }> = [
    { role: 'user', parts: [{ text: userPrompt }] },
  ];

  let finalResponse = '';
  const maxRounds = outfit.maxToolRounds;

  for (let round = 0; round < maxRounds; round++) {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
      config: {
        temperature: 0.4,
        maxOutputTokens: 4000,
        systemInstruction: systemPrompt,
        tools: functionDeclarations.length > 0
          ? [{ functionDeclarations }]
          : undefined,
        toolConfig: functionDeclarations.length > 0
          ? { functionCallingMode: 'AUTO' }
          : undefined,
      } as Record<string, unknown>,
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      finalResponse = response.text ?? 'No response generated.';
      break;
    }

    const parts = candidate.content.parts;
    const functionCalls: FunctionCallPart[] = [];
    let textContent = '';

    for (const part of parts) {
      const p = part as Record<string, unknown>;
      if (p.functionCall) functionCalls.push(p as unknown as FunctionCallPart);
      if (p.text) textContent += String(p.text);
    }

    conversationHistory.push({ role: 'model', parts });

    if (functionCalls.length === 0) {
      finalResponse = textContent;
      break;
    }

    // Execute function calls
    const functionResponses: FunctionResponsePart[] = [];

    for (const fc of functionCalls) {
      const { name, args } = fc.functionCall;
      process.stdout.write(`    🔧 ${name}(${Object.keys(args).join(', ')}) `);

      const toolResult = await globalRegistry.execute(name, args, toolContext);
      process.stdout.write(toolResult.success ? '✓\n' : '✗\n');

      functionResponses.push({
        functionResponse: {
          name,
          response: { output: toolResult.output.slice(0, 8000) },
        },
      });
    }

    conversationHistory.push({ role: 'user', parts: functionResponses });
  }

  return { result: finalResponse, cost: costTracker.totalSpent };
}

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runTest(test: TestCase, deliverables?: Record<string, unknown>): Promise<TestResult> {
  const mode = deliverables ? 'WITH data' : 'NO data';
  console.log(`\n  ▶ ${test.name} [${mode}]`);

  const start = Date.now();

  try {
    const { result, cost } = await executeTaskDirect(
      test.agentId,
      test.title,
      test.description,
      deliverables,
    );

    const timeMs = Date.now() - start;

    // Run quality checks
    const passed: string[] = [];
    const failed: string[] = [];

    for (const qc of test.checks) {
      if (qc.check(result)) {
        passed.push(qc.name);
      } else {
        failed.push(qc.name);
      }
    }

    // Print results
    const status = failed.length === 0 ? '✅ PASS' : `⚠️  ${passed.length}/${test.checks.length} checks`;
    console.log(`    ${status} (${(timeMs / 1000).toFixed(1)}s, $${cost.toFixed(4)})`);

    if (failed.length > 0) {
      for (const f of failed) console.log(`    ❌ ${f}`);
    }

    // Print output preview
    const preview = result.replace(/\n+/g, ' ').slice(0, 200);
    console.log(`    📝 "${preview}..."`);

    return { testName: test.name, agentId: test.agentId, passed, failed, output: result, timeMs, cost };
  } catch (err) {
    const timeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ CRASHED: ${message} (${(timeMs / 1000).toFixed(1)}s)`);
    return {
      testName: test.name,
      agentId: test.agentId,
      passed: [],
      failed: test.checks.map(c => c.name),
      output: `ERROR: ${message}`,
      timeMs,
      cost: 0,
    };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick');
  const noDb = args.includes('--no-db');
  const tests = isQuick ? QUICK_TESTS : ALL_TESTS;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PIVOT AGENT QUALITY TESTS');
  console.log(`  Mode: ${isQuick ? 'QUICK (3 tests)' : 'FULL (7 tests)'}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Check required env vars
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  // Try to load deliverables from Supabase
  let deliverables: Record<string, unknown> | undefined;

  if (!noDb && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n  Loading deliverables from Supabase...');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );

      const { data: latestJob } = await supabase
        .from('jobs')
        .select('results_json, run_id, organization_id')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestJob?.results_json) {
        deliverables = latestJob.results_json as Record<string, unknown>;
        const sectionCount = Object.keys(deliverables).filter(k => (deliverables as Record<string, unknown>)[k] != null).length;
        console.log(`  ✅ Loaded ${sectionCount} sections from run ${latestJob.run_id} (org: ${latestJob.organization_id})`);
      } else {
        console.log('  ⚠️  No completed analysis found in database');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠️  Could not load from Supabase: ${msg}`);
    }
  } else {
    console.log('\n  Skipping Supabase (--no-db or missing env vars)');
  }

  // Run tests WITHOUT deliverables (critical — agents must work standalone)
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  PHASE 1: Testing WITHOUT deliverables (standalone mode)');
  console.log('───────────────────────────────────────────────────────────');

  const noDataResults: TestResult[] = [];
  for (const test of tests) {
    const result = await runTest(test, undefined);
    noDataResults.push(result);
    // Small delay between tests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  // Run tests WITH deliverables (if available)
  const withDataResults: TestResult[] = [];
  if (deliverables) {
    console.log('\n───────────────────────────────────────────────────────────');
    console.log('  PHASE 2: Testing WITH deliverables (data-grounded mode)');
    console.log('───────────────────────────────────────────────────────────');

    for (const test of tests) {
      const result = await runTest(test, deliverables);
      withDataResults.push(result);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  const allResults = [...noDataResults, ...withDataResults];
  const totalTests = allResults.length;
  const fullPasses = allResults.filter(r => r.failed.length === 0).length;
  const totalChecks = allResults.reduce((sum, r) => sum + r.passed.length + r.failed.length, 0);
  const passedChecks = allResults.reduce((sum, r) => sum + r.passed.length, 0);
  const totalCost = allResults.reduce((sum, r) => sum + r.cost, 0);
  const totalTime = allResults.reduce((sum, r) => sum + r.timeMs, 0);

  console.log(`\n  Tests: ${fullPasses}/${totalTests} fully passed`);
  console.log(`  Checks: ${passedChecks}/${totalChecks} passed`);
  console.log(`  Cost: $${totalCost.toFixed(4)}`);
  console.log(`  Time: ${(totalTime / 1000).toFixed(1)}s total`);

  // Detailed failures
  const failures = allResults.filter(r => r.failed.length > 0);
  if (failures.length > 0) {
    console.log('\n  Failed checks:');
    for (const r of failures) {
      console.log(`    ${r.testName}: ${r.failed.join(', ')}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
