/**
 * Eval Suites
 *
 * Pre-built test suites for agents, Pivvy, and synthesis pipeline.
 * Each suite defines test cases with quality checks mapped to scoring dimensions.
 */

import type { EvalSuite } from './types';
import {
  containsAny, containsAll, hasConnectMarker, usedTool,
  noHallucination, noFabricatedNumbers, noFakeTestimonials,
  notGeneric, noVerboseGuidance, minLength, maxLength,
  isConversational, usesMarkdown, hasHeaders,
  maxToolCalls, maxLatency,
} from './checks';

// ─────────────────────────────────────────────────────────────────────────────
// Agent Suite — tests all 7 execution agents
// ─────────────────────────────────────────────────────────────────────────────

export const agentSuite: EvalSuite = {
  id: 'agents',
  name: 'Execution Agents',
  description: 'Tests all 7 agents with real and disconnected integrations',
  tests: [
    // ── Connected services (real data) ──
    {
      name: 'Analyst: Stripe Revenue',
      agentId: 'analyst',
      title: 'Pull our Stripe revenue data and summarize recent payments',
      description: 'Access our connected Stripe account and show recent payment activity. Summarize total revenue, number of transactions, and any notable patterns.',
      expectsRealData: true,
      tags: ['integration', 'stripe'],
      checks: [
        minLength(200), containsAny('stripe', 'payment', 'revenue', '$', 'transaction'),
        notGeneric(), noHallucination(), noFabricatedNumbers(), noVerboseGuidance(),
        usesMarkdown(), maxToolCalls(8),
      ],
    },
    {
      name: 'Researcher: Gmail Summary',
      agentId: 'researcher',
      title: 'Check our email inbox for recent important messages',
      description: 'Read our recent emails and provide a summary of the most important ones. Highlight action items and urgent messages.',
      expectsRealData: true,
      tags: ['integration', 'gmail'],
      checks: [
        minLength(200), containsAny('email', 'inbox', 'from', 'subject', 'message'),
        notGeneric(), noHallucination(), noVerboseGuidance(), usesMarkdown(), maxToolCalls(8),
      ],
    },
    {
      name: 'Operator: Send Email',
      agentId: 'operator',
      title: 'Send a follow-up email about Q2 planning',
      description: 'Send an email to manueldavid.aforedev@gmail.com with subject "Q2 Planning Follow-Up — Eval Test" summarizing: 1) Finalize roadmap by March 20, 2) Review hiring plan, 3) Set up advisory board. You MUST call send_email.',
      expectsRealData: true,
      tags: ['integration', 'gmail', 'action'],
      checks: [
        minLength(100), containsAny('email', 'sent', 'q2', 'planning'),
        notGeneric(), noHallucination(), noVerboseGuidance(), maxToolCalls(6),
      ],
    },

    // ── Disconnected services (expect connect markers) ──
    {
      name: 'Marketer: Post to LinkedIn',
      agentId: 'marketer',
      title: 'Post an AI analytics announcement to LinkedIn',
      description: 'Write a LinkedIn post announcing our AI-powered analytics feature for B2B founders. You MUST call the post_to_linkedin tool to attempt publishing — do NOT skip the tool call. The tool will handle connection checking automatically.',
      expectsConnect: 'linkedin',
      tags: ['integration', 'social', 'disconnected'],
      checks: [
        minLength(100), hasConnectMarker('linkedin'),
        noVerboseGuidance(), noHallucination(), noFakeTestimonials(),
        usedTool('post_to_linkedin'),
      ],
    },
    {
      name: 'CodeBot: Create GitHub Issue',
      agentId: 'codebot',
      title: 'Create a GitHub issue to track a bug in our authentication module',
      description: 'Create a GitHub issue in our main repo titled "Auth module throws 401 on token refresh". Include steps to reproduce, expected behavior, and priority label. You MUST call github_create_issue to create it.',
      tags: ['integration', 'action'],
      checks: [
        minLength(50),
        noVerboseGuidance(), noHallucination(),
        usedTool('github_create_issue'),
        // If connected: should show success. If not: should show [connect:github].
        // Either outcome is valid — the tool call is what matters.
        containsAny('issue', 'created', 'github', 'connect', 'auth', 'token'),
      ],
    },
    {
      name: 'Operator: Create Jira Ticket',
      agentId: 'operator',
      title: 'Create a Jira Epic for our Q2 product roadmap',
      description: 'Create a Jira Epic for Q2 2026: AI analytics launch, mobile beta, enterprise tier. High priority. You MUST call the create_jira_ticket tool — it handles connection checking automatically.',
      expectsConnect: 'jira',
      tags: ['integration', 'disconnected'],
      checks: [
        minLength(50), hasConnectMarker('jira'),
        noVerboseGuidance(), noHallucination(),
        usedTool('create_jira_ticket'),
      ],
    },

    // ── Standalone (no integration needed) ──
    {
      name: 'Recruiter: Job Posting',
      agentId: 'recruiter',
      title: 'Write a Senior Full-Stack Engineer job posting',
      description: 'Job posting for Pivot (AI business intelligence). Stack: Next.js, TypeScript, Supabase. Remote, $150K-$190K. Include responsibilities, requirements, benefits.',
      tags: ['standalone'],
      checks: [
        minLength(400), containsAny('next.js', 'typescript', 'supabase', 'remote'),
        containsAny('responsibilities', 'requirements', 'qualifications', 'benefits'),
        notGeneric(), noHallucination(), isConversational(), usesMarkdown(), hasHeaders(),
      ],
    },
    {
      name: 'Strategist: Growth Plan',
      agentId: 'strategist',
      title: 'Create a Q2 2026 growth plan for Pivot',
      description: 'Develop a growth strategy for Pivot (AI-powered business intelligence platform) for Q2 2026. Current: 50 users, $5K MRR, 7 AI agents. Goals: 200 users, $20K MRR.',
      tags: ['standalone'],
      checks: [
        minLength(400), containsAny('growth', 'strategy', 'q2', 'users', 'mrr'),
        notGeneric(), noHallucination(), noFabricatedNumbers(),
        isConversational(), usesMarkdown(), hasHeaders(), maxToolCalls(10),
      ],
    },
    {
      name: 'Marketer: Content Calendar',
      agentId: 'marketer',
      title: 'Create a 2-week social media content calendar for Pivot',
      description: 'Build a content calendar for LinkedIn and Twitter. Focus on AI business intelligence, agent execution, and integration capabilities. Include post ideas, timing, and hashtags.',
      tags: ['standalone', 'content'],
      checks: [
        minLength(300), containsAny('linkedin', 'twitter', 'post', 'content'),
        notGeneric(), noHallucination(), usesMarkdown(), isConversational(),
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pivvy Suite — tests business agent / coach
// ─────────────────────────────────────────────────────────────────────────────

export const pivvySuite: EvalSuite = {
  id: 'pivvy',
  name: 'Pivvy Business Agent',
  description: 'Tests Pivvy coach across memory, tools, search, and projections',
  tests: [
    {
      name: 'Memory: Health Score',
      agentId: 'pivvy',
      title: 'What is our business health score?',
      description: 'Answer from analysis memory without tool calls if possible.',
      tags: ['memory'],
      checks: [
        minLength(100), containsAny('health', 'score', 'overall', 'rating'),
        noHallucination(), noFabricatedNumbers(),
      ],
    },
    {
      name: 'Tools: Revenue Data',
      agentId: 'pivvy',
      title: 'Show me our revenue breakdown and key financial metrics',
      description: 'Pull financial data from the analysis or integrations.',
      tags: ['tools', 'financial'],
      checks: [
        minLength(150), containsAny('revenue', '$', 'financial', 'income', 'cash'),
        noHallucination(), noFabricatedNumbers(),
      ],
    },
    {
      name: 'Tools: Integration Data',
      agentId: 'pivvy',
      title: 'What data do we have from our connected tools?',
      description: 'List available integration data and summarize key metrics.',
      tags: ['tools', 'integration'],
      checks: [
        minLength(100), containsAny('integration', 'connected', 'stripe', 'data', 'tool'),
        noHallucination(),
      ],
    },
    {
      name: 'Web Search: Market Research',
      agentId: 'pivvy',
      title: 'What are the latest trends in AI-powered business intelligence?',
      description: 'Search the web for current market trends.',
      tags: ['search'],
      checks: [
        minLength(200), containsAny('ai', 'business intelligence', 'trend', 'market'),
        noHallucination(), noFakeTestimonials(),
      ],
    },
    {
      name: 'Multi-turn: Follow-up',
      agentId: 'pivvy',
      title: 'Tell me about our top issues, then suggest fixes',
      description: 'Identify top business issues from analysis, then provide actionable recommendations.',
      tags: ['multi-turn'],
      checks: [
        minLength(200), containsAny('issue', 'risk', 'problem', 'recommend', 'fix', 'action'),
        noHallucination(), isConversational(),
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Quick Suite — fast smoke tests (subset for CI)
// ─────────────────────────────────────────────────────────────────────────────

export const quickSuite: EvalSuite = {
  id: 'quick',
  name: 'Quick Smoke Tests',
  description: 'Fast 3-test suite for CI/deploy validation',
  tests: [
    agentSuite.tests.find(t => t.name === 'Strategist: Growth Plan')!,
    agentSuite.tests.find(t => t.name === 'Recruiter: Job Posting')!,
    pivvySuite.tests.find(t => t.name === 'Memory: Health Score')!,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SUITES: Record<string, EvalSuite> = {
  agents: agentSuite,
  pivvy: pivvySuite,
  quick: quickSuite,
};
