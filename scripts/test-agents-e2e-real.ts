/**
 * End-to-End Agent Tests with Real Integrations
 *
 * Tests all 7 agents using the user's real org with connected services.
 * Verifies:
 * 1. Agents produce useful, non-generic output
 * 2. Connected services (Slack, Gmail, Stripe) return real data
 * 3. Disconnected services produce [connect:provider] markers
 * 4. Output quality: markdown, conversational, no hallucination
 *
 * Run: npx tsx scripts/test-agents-e2e-real.ts
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

import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Import tool + agent modules using relative paths
import { globalRegistry, createCostTracker, type ToolContext, type ToolResult } from '../lib/execution/tools/index';
import '../lib/execution/tools/web-tools';
import '../lib/execution/tools/marketing-tools';
import '../lib/execution/tools/finance-tools';
import '../lib/execution/tools/hr-tools';
import '../lib/execution/tools/operations-tools';
import '../lib/execution/tools/data-tools';
import '../lib/execution/tools/communication-tools';
import '../lib/execution/tools/social-tools';
import '../lib/execution/tools/github-action-tools';
import '../lib/execution/tools/productivity-tools';
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
  /** If true, this test expects a [connect:X] marker (service not connected) */
  expectsConnect?: string;
  /** If true, this test should access real integration data */
  expectsRealData?: boolean;
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
  toolsUsed: string[];
  timeMs: number;
  cost: number;
}

// ── Quality Checks ──────────────────────────────────────────────────────────

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

function hasConnectMarker(provider: string): QualityCheck {
  return {
    name: `Has [connect:${provider}] marker`,
    check: (r) => r.includes(`[connect:${provider}]`),
  };
}

function noVerboseGuidance(): QualityCheck {
  return {
    name: 'No verbose connection guidance',
    check: (r) => {
      const lower = r.toLowerCase();
      const bannedPhrases = [
        'settings → integrations',
        'settings > integrations',
        'connect via settings',
        'go to settings',
        'navigate to integrations',
        'click the connection panel',
      ];
      return !bannedPhrases.some(p => lower.includes(p));
    },
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
    name: 'Conversational tone',
    check: (r) => {
      const lower = r.toLowerCase();
      return (
        lower.includes('would you like') ||
        lower.includes('want me to') ||
        lower.includes('next step') ||
        lower.includes('let me know') ||
        lower.includes('shall i') ||
        lower.includes('i can also') ||
        lower.includes("here's what") ||
        lower.includes('here are') ||
        lower.includes('happy to') ||
        lower.includes('i recommend') ||
        lower.includes("i'd suggest") ||
        lower.includes('should i') ||
        lower.includes("i've") ||
        lower.includes('i found') ||
        lower.includes('i pulled')
      );
    },
  };
}

function usesMarkdown(): QualityCheck {
  return {
    name: 'Uses markdown',
    check: (r) => /#{1,3}\s/.test(r) || /\*\*[^*]+\*\*/.test(r),
  };
}

function noHallucination(): QualityCheck {
  return {
    name: 'No hallucination',
    check: (r) => {
      const lower = r.toLowerCase();
      const redFlags = [
        '"as a [', 'john doe', 'jane doe', 'xyz corp', 'abc company',
      ];
      return !redFlags.some(f => lower.includes(f));
    },
  };
}

// ── Test Cases ──────────────────────────────────────────────────────────────

const REAL_ORG_ID = 'bad7cf7d-f09f-410c-8ca1-607652d00bb8'; // Pivot org

const ALL_TESTS: TestCase[] = [
  // ── Connected services (should access real data) ──
  {
    name: 'Analyst: Stripe Revenue Data',
    agentId: 'analyst',
    title: 'Pull our Stripe revenue data and summarize recent payments',
    description: 'Access our connected Stripe account and show recent payment activity. Summarize total revenue, number of transactions, and any notable patterns. Use real data from our Stripe integration.',
    expectsRealData: true,
    checks: [
      minLength(200),
      containsAny('stripe', 'payment', 'revenue', '$', 'transaction'),
      notGeneric(),
      noHallucination(),
      noVerboseGuidance(),
    ],
  },
  {
    name: 'Researcher: Gmail Inbox Summary',
    agentId: 'researcher',
    title: 'Check our email inbox for recent important messages',
    description: 'Read our recent emails and provide a summary of the most important ones. Highlight any action items, urgent messages, or key communications.',
    expectsRealData: true,
    checks: [
      minLength(200),
      containsAny('email', 'inbox', 'from', 'subject', 'message'),
      notGeneric(),
      noHallucination(),
      noVerboseGuidance(),
    ],
  },

  {
    name: 'Operator: Send Email via Gmail',
    agentId: 'operator',
    title: 'Send a follow-up email about the Q2 planning meeting',
    description: 'Use the send_email tool to send an email to manueldavid.aforedev@gmail.com with subject "Q2 Planning Follow-Up — Pivot Agent Test" and body summarizing action items: 1) Finalize product roadmap by March 20, 2) Review hiring plan, 3) Set up customer advisory board. You MUST call the send_email tool to actually send it — do not just compose the text.',
    expectsRealData: true,
    checks: [
      minLength(100),
      containsAny('email', 'sent', 'q2', 'planning', 'roadmap'),
      notGeneric(),
      noHallucination(),
      noVerboseGuidance(),
    ],
  },
  {
    name: 'Marketer: Send Slack Message',
    agentId: 'marketer',
    title: 'Send a message to our Slack #general channel announcing the new AI analytics feature',
    description: 'Send a Slack message to #general announcing our new AI-powered analytics dashboard. Include key features: real-time insights, automated reports, and integration with Stripe/Gmail. Keep it exciting but professional.',
    expectsRealData: true,
    checks: [
      minLength(100),
      containsAny('slack', 'sent', 'message', 'analytics'),
      notGeneric(),
      noHallucination(),
      noVerboseGuidance(),
    ],
  },

  // ── Disconnected services (should produce [connect:X] markers) ──
  {
    name: 'Marketer: Post to LinkedIn',
    agentId: 'marketer',
    title: 'Post an announcement to LinkedIn about our new AI analytics feature',
    description: 'Write a compelling LinkedIn post announcing our latest AI-powered analytics feature. Make it engaging for B2B founders. Then use the post_to_linkedin tool to publish it. You MUST call post_to_linkedin to attempt posting.',
    expectsConnect: 'linkedin',
    checks: [
      minLength(100),
      hasConnectMarker('linkedin'),
      noVerboseGuidance(),
      noHallucination(),
    ],
  },
  {
    name: 'CodeBot: List GitHub Repos',
    agentId: 'codebot',
    title: 'List our GitHub repositories and show recent activity',
    description: 'Connect to our GitHub account and list all repositories. Show recent commits, open issues, and open pull requests.',
    expectsConnect: 'github',
    checks: [
      minLength(50),
      hasConnectMarker('github'),
      noVerboseGuidance(),
      noHallucination(),
    ],
  },
  {
    name: 'Operator: Create Jira Ticket',
    agentId: 'operator',
    title: 'Create a Jira ticket to track our Q2 product roadmap',
    description: 'Create a Jira Epic for our Q2 2026 product roadmap. Include key milestones: AI analytics launch, mobile app beta, enterprise tier. Set it as high priority.',
    expectsConnect: 'jira',
    checks: [
      minLength(50),
      hasConnectMarker('jira'),
      noVerboseGuidance(),
      noHallucination(),
    ],
  },

  // ── Standalone agents (no integration needed) ──
  {
    name: 'Recruiter: Job Posting + Post to LinkedIn',
    agentId: 'recruiter',
    title: 'Write a job posting for a Senior Full-Stack Engineer and post it to LinkedIn',
    description: 'Create a compelling job posting for a Senior Full-Stack Engineer at Pivot (AI-powered business intelligence platform). Stack: Next.js, TypeScript, Supabase, Python. Remote-first, $150K-$190K. Include responsibilities, requirements, benefits. Write the FULL job posting first, then attempt to post it to LinkedIn.',
    expectsConnect: 'linkedin',
    checks: [
      minLength(200),
      containsAny('senior', 'full-stack', 'full stack', 'engineer', 'pivot'),
      hasConnectMarker('linkedin'),
      notGeneric(),
      noHallucination(),
      noVerboseGuidance(),
    ],
  },
  {
    name: 'Strategist: 30-Day Growth Plan',
    agentId: 'strategist',
    title: 'Create a 30-day growth plan based on our business data',
    description: 'Analyze our available business data and create a focused 30-day growth plan. We are an AI-powered business intelligence platform for SMBs. Prioritize quick wins that can drive revenue and user engagement. Be specific with timelines, owners, and success metrics.',
    checks: [
      minLength(500),
      containsAny('day', 'week', 'timeline', 'milestone'),
      containsAny('growth', 'revenue', 'user', 'engagement'),
      notGeneric(),
      isConversational(),
      usesMarkdown(),
      noHallucination(),
      noVerboseGuidance(),
    ],
  },
];

// ── Execution Engine ────────────────────────────────────────────────────────

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
  orgId: string,
  deliverables?: Record<string, unknown>,
): Promise<{ result: string; cost: number; toolsUsed: string[] }> {
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
  const toolsUsed: string[] = [];

  const toolContext: ToolContext = {
    orgId,
    agentId,
    sessionId: `e2e-${uuidv4()}`,
    deliverables,
    costTracker,
  };

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

TOOL-FIRST ACTIONS — CRITICAL:
- When the user asks you to SEND an email, you MUST call the send_email tool. Do NOT write the email text inline and skip the tool call.
- When the user asks you to POST to social media, you MUST call the posting tool (post_to_linkedin, post_to_twitter, etc.). Do NOT just write the post text.
- When the user asks you to SEND a Slack message, you MUST call send_slack_message. Do NOT just write the message text.
- When the user asks you to CREATE a Jira ticket / GitHub issue, you MUST call the tool. Do NOT just describe the ticket.
- NEVER compose content inline as a substitute for calling the tool. The tools execute real actions. Writing text in your response does NOT send anything.
- If a send/post tool fails, report the failure. Do NOT pretend you sent it by writing the content inline instead.

CONVERSATIONAL OUTPUT:
- You are talking to a REAL PERSON in a chat interface. Write like a talented colleague.
- Lead with a 1-2 sentence summary of what you did.
- Use clean markdown: ## headers, **bold**, > blockquotes for featured content, tables for data.
- After presenting, ALWAYS offer 2-3 concrete next steps: "Would you like me to..."
- Be confident. You are an expert.
- NEVER dump raw content without context. Introduce it, present it, offer to do more.

INLINE CONNECTIONS — MANDATORY:
- When ANY tool returns a string containing "[connect:XXXX]" (e.g. "[connect:linkedin]", "[connect:github]", "[connect:jira]"), you MUST copy that exact marker into your response. This is critical — the UI renders it as a clickable connection button.
- NEVER paraphrase, explain, or replace the marker. Output it verbatim on its own line.
- NEVER say "go to Settings", "connect via Integrations", "click the connection panel", or give any setup instructions.
- Keep it short and natural around the marker.

QUALITY BAR:
- Output must be ready to use immediately.
- Be specific to the company, industry, and audience. No generic filler.
- End every response with a "Next Steps" section.

ANTI-HALLUCINATION:
- NEVER invent statistics, case studies, testimonials, or quotes that don't exist.
- NEVER fabricate data entries, payments, transactions, or records.
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
        temperature: 0.1,
        maxOutputTokens: 8192,
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
      toolsUsed.push(name);
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

  return { result: finalResponse, cost: costTracker.totalSpent, toolsUsed };
}

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runTest(test: TestCase, orgId: string, deliverables?: Record<string, unknown>): Promise<TestResult> {
  console.log(`\n  ▶ ${test.name}`);
  if (test.expectsConnect) console.log(`    (expects [connect:${test.expectsConnect}] marker)`);
  if (test.expectsRealData) console.log(`    (expects REAL integration data)`);

  const start = Date.now();

  try {
    const { result, cost, toolsUsed } = await executeTaskDirect(
      test.agentId,
      test.title,
      test.description,
      orgId,
      deliverables,
    );

    const timeMs = Date.now() - start;

    const passed: string[] = [];
    const failed: string[] = [];

    for (const qc of test.checks) {
      if (qc.check(result)) {
        passed.push(qc.name);
      } else {
        failed.push(qc.name);
      }
    }

    const status = failed.length === 0 ? '✅ PASS' : `⚠️  ${passed.length}/${test.checks.length} checks`;
    console.log(`    ${status} (${(timeMs / 1000).toFixed(1)}s, $${cost.toFixed(4)})`);
    console.log(`    🔧 Tools used: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'none'}`);

    if (failed.length > 0) {
      for (const f of failed) console.log(`    ❌ ${f}`);
    }

    const preview = result.replace(/\n+/g, ' ').slice(0, 300);
    console.log(`    📝 "${preview}..."`);

    return { testName: test.name, agentId: test.agentId, passed, failed, output: result, toolsUsed, timeMs, cost };
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
      toolsUsed: [],
      timeMs,
      cost: 0,
    };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PIVOT E2E AGENT TESTS — REAL INTEGRATIONS');
  console.log('═══════════════════════════════════════════════════════════');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Check connected integrations
  const { data: integrations } = await supabase
    .from('integrations')
    .select('provider, status')
    .eq('org_id', REAL_ORG_ID)
    .eq('status', 'connected');

  const connected = (integrations ?? []).map(i => i.provider);
  console.log(`\n  Org: ${REAL_ORG_ID}`);
  console.log(`  Connected: ${connected.length > 0 ? connected.join(', ') : 'none'}`);

  // Load deliverables
  let deliverables: Record<string, unknown> | undefined;
  const { data: latestJob } = await supabase
    .from('jobs')
    .select('results_json, run_id')
    .eq('organization_id', REAL_ORG_ID)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestJob?.results_json) {
    deliverables = latestJob.results_json as Record<string, unknown>;
    const sectionCount = Object.keys(deliverables).filter(k => (deliverables as Record<string, unknown>)[k] != null).length;
    console.log(`  Deliverables: ${sectionCount} sections from run ${latestJob.run_id}`);
  } else {
    console.log('  Deliverables: none');
  }

  // Run all tests
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  RUNNING E2E TESTS');
  console.log('───────────────────────────────────────────────────────────');

  const results: TestResult[] = [];
  for (const test of ALL_TESTS) {
    const result = await runTest(test, REAL_ORG_ID, deliverables);
    results.push(result);
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
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
  const totalTime = results.reduce((sum, r) => sum + r.timeMs, 0);

  console.log(`\n  Tests: ${fullPasses}/${totalTests} fully passed`);
  console.log(`  Checks: ${passedChecks}/${totalChecks} passed`);
  console.log(`  Cost: $${totalCost.toFixed(4)}`);
  console.log(`  Time: ${(totalTime / 1000).toFixed(1)}s total`);

  const failures = results.filter(r => r.failed.length > 0);
  if (failures.length > 0) {
    console.log('\n  ❌ Failed checks:');
    for (const r of failures) {
      console.log(`    ${r.testName}: ${r.failed.join(', ')}`);
    }
  }

  // Print all tools used across all tests
  const allTools = results.flatMap(r => r.toolsUsed);
  const toolCounts: Record<string, number> = {};
  for (const t of allTools) toolCounts[t] = (toolCounts[t] ?? 0) + 1;
  console.log('\n  🔧 Tools called:');
  for (const [tool, count] of Object.entries(toolCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${tool}: ${count}x`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
