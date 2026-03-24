/**
 * Slack Intent Router
 *
 * Classifies incoming Slack messages into one of 5 intents:
 *   bi_query   — business intelligence data request
 *   agent_task — delegate work to an execution agent
 *   campaign   — launch/manage an automated campaign
 *   report     — request a full BI report section
 *   general    — everything else (pass-through / conversational)
 *
 * Strategy:
 *   1. Gemini Flash classification (temp 0, 200 tokens, no thinking)
 *   2. Keyword / regex fallback when the API key is absent or the LLM call fails
 */

import { GoogleGenAI } from '@google/genai';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlackIntent =
  | { type: 'bi_query'; section: string; question: string }
  | { type: 'agent_task'; agentId: string; taskTitle: string; taskDescription: string }
  | { type: 'campaign'; action: 'launch' | 'status' | 'list' | 'pause' | 'cancel'; templateId?: string; campaignId?: string }
  | { type: 'report'; section: string }
  | { type: 'general'; message: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const FLASH_MODEL = 'gemini-2.0-flash-lite';

const BI_SECTIONS = [
  'healthScore',
  'cashIntelligence',
  'revenueLeakAnalysis',
  'revenueForecast',
  'executiveSummary',
  'kpiReport',
  'atRiskCustomers',
  'budgetPlanning',
  'pricingIntelligence',
  'competitorAnalysis',
  'swotAnalysis',
  'marketIntelligence',
  'customerSegmentation',
  'salesPlaybook',
] as const;

const AGENT_IDS = [
  'marketer',
  'analyst',
  'researcher',
  'strategist',
  'recruiter',
  'operator',
  'codebot',
] as const;

const CAMPAIGN_TEMPLATES = [
  'product-launch',
  'content-calendar-week',
  'hiring-pipeline',
  'financial-review',
  'competitor-intel',
] as const;

// ── Classification Prompt ─────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are a Slack message intent classifier for a business intelligence platform called Pivot.

Classify the user's message into exactly one of these 5 intents and respond with a single JSON object (no markdown, no explanation):

1. bi_query — user asks a specific business intelligence question
   {"type":"bi_query","section":"<sectionId>","question":"<verbatim or rephrased question>"}
   section must be one of: ${BI_SECTIONS.join(', ')}

2. agent_task — user wants to delegate work to an AI agent
   {"type":"agent_task","agentId":"<agentId>","taskTitle":"<short title>","taskDescription":"<full task description>"}
   agentId must be one of: ${AGENT_IDS.join(', ')}
   Choose agentId based on: marketer=social/content/campaigns, analyst=data/metrics/reporting,
   researcher=research/intel/trends, strategist=strategy/planning/goals,
   recruiter=hiring/hr/people, operator=ops/process/tools, codebot=code/github/technical

3. campaign — user wants to launch or manage a campaign
   {"type":"campaign","action":"<action>","templateId":"<templateId>","campaignId":"<id if mentioned>"}
   action must be one of: launch, status, list, pause, cancel
   templateId must be one of (only when action=launch): ${CAMPAIGN_TEMPLATES.join(', ')}
   Omit templateId/campaignId fields if not applicable.

4. report — user wants a full BI report section rendered
   {"type":"report","section":"<sectionId>"}
   section must be one of: ${BI_SECTIONS.join(', ')}
   Use report (not bi_query) when the user asks to "show", "generate", "give me", or "pull up" a full report/section
   rather than asking a specific question.

5. general — everything else (greetings, feedback, off-topic, unclear requests)
   {"type":"general","message":"<original message>"}

Rules:
- Output ONLY the JSON object, nothing else.
- Do not wrap the JSON in markdown code fences.
- If uncertain between bi_query and report, use bi_query.
- If uncertain between agent_task and general, use general.
- Match section/agentId values exactly as listed; never invent new values.`;

// ── LLM Classification ────────────────────────────────────────────────────────

async function classifyWithLLM(message: string): Promise<SlackIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [{ role: 'user', parts: [{ text: message }] }],
    });

    const raw = response.text?.trim() ?? '';
    if (!raw) return null;

    // Strip accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned) as SlackIntent;

    // Validate required fields per type
    if (!parsed.type) return null;

    switch (parsed.type) {
      case 'bi_query':
        if (!parsed.section || !parsed.question) return null;
        break;
      case 'agent_task':
        if (!parsed.agentId || !parsed.taskTitle || !parsed.taskDescription) return null;
        break;
      case 'campaign':
        if (!parsed.action) return null;
        break;
      case 'report':
        if (!parsed.section) return null;
        break;
      case 'general':
        if (!parsed.message) return null;
        break;
      default:
        return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ── Keyword / Regex Fallback ──────────────────────────────────────────────────

const BI_KEYWORDS = /health\s*score|burn\s*rate|runway|cash|revenue|forecast|kpi|at[\s-]risk|customer|budget|pric(?:e|ing)|competitor|swot|pipeline|how.*doing|how.*business/i;

const AGENT_TASK_PATTERNS: Array<{ pattern: RegExp; agentId: string }> = [
  { pattern: /post.*(?:to\s+)?linkedin|linkedin\s+post/i, agentId: 'marketer' },
  { pattern: /tweet|post.*(?:to\s+)?twitter/i, agentId: 'marketer' },
  { pattern: /post.*(?:to\s+)?instagram|instagram\s+post/i, agentId: 'marketer' },
  { pattern: /send.*email|draft.*email|write.*email/i, agentId: 'marketer' },
  { pattern: /research\b/i, agentId: 'researcher' },
  { pattern: /analyz[e|ing].*market|market.*analys/i, agentId: 'researcher' },
  { pattern: /analyz[e|ing]|crunch.*data|data.*report/i, agentId: 'analyst' },
  { pattern: /\bcode\b|\bfix.*bug\b|\bgithub\b|\bpull\s+request\b|\bpr\b/i, agentId: 'codebot' },
  { pattern: /strateg[y|ize]|roadmap|planning/i, agentId: 'strategist' },
  { pattern: /recruit|hire|hiring|job\s+posting/i, agentId: 'recruiter' },
  { pattern: /automat[e|ion]|workflow|process/i, agentId: 'operator' },
];

const CAMPAIGN_LAUNCH_PATTERN = /(?:launch|run|start|kick\s*off)\s*(?:a\s+)?campaign/i;

const CAMPAIGN_TEMPLATE_MAP: Array<{ pattern: RegExp; templateId: string }> = [
  { pattern: /product[\s-]launch|new\s+product/i, templateId: 'product-launch' },
  { pattern: /content[\s-]calendar|weekly\s+content/i, templateId: 'content-calendar-week' },
  { pattern: /hir(?:e|ing)\s*pipeline|hiring\s*campaign/i, templateId: 'hiring-pipeline' },
  { pattern: /financial[\s-]review|finance\s+review/i, templateId: 'financial-review' },
  { pattern: /competitor[\s-]intel|competitive\s+intel/i, templateId: 'competitor-intel' },
];

const CAMPAIGN_ACTION_PATTERNS: Array<{ pattern: RegExp; action: 'status' | 'list' | 'pause' | 'cancel' }> = [
  { pattern: /(?:campaign|campaigns)\s*(?:status|update)|status\s+of\s+campaign/i, action: 'status' },
  { pattern: /list\s+campaigns?|show\s+campaigns?|my\s+campaigns?/i, action: 'list' },
  { pattern: /pause\s+campaign/i, action: 'pause' },
  { pattern: /cancel\s+campaign|stop\s+campaign/i, action: 'cancel' },
];

const REPORT_KEYWORDS: Array<{ pattern: RegExp; section: string }> = [
  { pattern: /health\s*score\s*report|show\s*health\s*score|pull\s*up\s*health/i, section: 'healthScore' },
  { pattern: /cash\s*intelligence\s*report|show\s*cash/i, section: 'cashIntelligence' },
  { pattern: /revenue\s*leak|show.*revenue\s*leak/i, section: 'revenueLeakAnalysis' },
  { pattern: /revenue\s*forecast\s*report|show.*forecast/i, section: 'revenueForecast' },
  { pattern: /executive\s*summary|exec\s*summary/i, section: 'executiveSummary' },
  { pattern: /kpi\s*report|show.*kpis?/i, section: 'kpiReport' },
  { pattern: /at[\s-]risk\s*customers?|show.*at[\s-]risk/i, section: 'atRiskCustomers' },
  { pattern: /budget\s*(?:plan|report|planning)|show.*budget/i, section: 'budgetPlanning' },
  { pattern: /pric(?:e|ing)\s*intelligence|show.*pric/i, section: 'pricingIntelligence' },
  { pattern: /competitor\s*analysis|show.*competitor/i, section: 'competitorAnalysis' },
  { pattern: /swot\s*analysis|show.*swot/i, section: 'swotAnalysis' },
  { pattern: /market\s*intelligence|show.*market\s*intel/i, section: 'marketIntelligence' },
  { pattern: /customer\s*segmentation|show.*segment/i, section: 'customerSegmentation' },
  { pattern: /sales\s*playbook|show.*playbook/i, section: 'salesPlaybook' },
];

function classifyWithKeywords(message: string): SlackIntent {
  // --- Campaign actions first (most specific) ---
  if (CAMPAIGN_LAUNCH_PATTERN.test(message)) {
    let templateId: string | undefined;
    for (const { pattern, templateId: tId } of CAMPAIGN_TEMPLATE_MAP) {
      if (pattern.test(message)) {
        templateId = tId;
        break;
      }
    }
    return { type: 'campaign', action: 'launch', ...(templateId ? { templateId } : {}) };
  }

  for (const { pattern, action } of CAMPAIGN_ACTION_PATTERNS) {
    if (pattern.test(message)) {
      return { type: 'campaign', action };
    }
  }

  // --- Report (full section render) ---
  for (const { pattern, section } of REPORT_KEYWORDS) {
    if (pattern.test(message)) {
      return { type: 'report', section };
    }
  }

  // --- Agent task ---
  for (const { pattern, agentId } of AGENT_TASK_PATTERNS) {
    if (pattern.test(message)) {
      return {
        type: 'agent_task',
        agentId,
        taskTitle: message.slice(0, 60).trim(),
        taskDescription: message.trim(),
      };
    }
  }

  // --- BI query (generic) ---
  if (BI_KEYWORDS.test(message)) {
    return { type: 'bi_query', section: 'executiveSummary', question: message.trim() };
  }

  // --- Default ---
  return { type: 'general', message: message.trim() };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify the intent of a Slack message.
 *
 * Tries Gemini Flash classification first; falls back to keyword matching if
 * the API key is missing or the LLM call fails.
 */
export async function classifyIntent(message: string): Promise<SlackIntent> {
  if (!message || !message.trim()) {
    return { type: 'general', message: message ?? '' };
  }

  const llmResult = await classifyWithLLM(message);
  if (llmResult) return llmResult;

  return classifyWithKeywords(message);
}
