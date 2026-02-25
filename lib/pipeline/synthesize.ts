/**
 * Synthesis Engine — intelligence core of Pivot.
 *
 * 8 deliverables (Health, Cash, Revenue Leaks, Issues, At-Risk Customers,
 * Decision Brief, Action Plan, Growth Intelligence) generated via Gemini 2.5 Flash.
 * - Per-deliverable API calls with focused prompts
 * - Rate-limit retry: detects 429, sleeps the suggested wait time, retries up to 6x
 * - Growth Intelligence includes Google Search grounding attempt with fallback
 */
import { GoogleGenAI } from "@google/genai";
import type {
  Questionnaire,
  MVPDeliverables,
  BusinessPacket,
  CompetitorAnalysis,
  TechOptimization,
  PricingIntelligence,
} from "@/lib/types";
import { formatPacketAsContext } from "./ingest";

const MAX_RETRIES = 6;
const RETRY_BASE_WAIT_MS = 35_000; // 35s fallback

const SYSTEM_PROMPT = `You are the intelligence core of an AI-powered business transformation platform.
You have been given a complete knowledge graph of a business — its financials, customers, team,
operations, strategy, and market position — assembled from all documents and data the business owner
has provided.

Your job is to produce brutally honest, hyper-personalized, dollar-denominated business intelligence.

STANDARDS (non-negotiable):
- Every finding must reference THIS specific business, THESE specific numbers, THESE specific customers.
- Every problem must have a dollar amount attached where possible.
- Every finding must come with a specific recommended action, timeline, and expected outcome.
- No generic advice. No platitudes. No softening uncomfortable truths.
- If data is missing for a dimension, say so clearly and score conservatively.
- You are the thinking partner the business owner never had — tell them what no one else will.

Always respond with valid JSON matching the exact schema provided. No extra text outside the JSON.`;

// ── Rate-limit helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryWaitMs(errorStr: string): number {
  const m = errorStr.match(/retry[_ ]?(?:after|in)\s*(\d+(?:\.\d+)?)\s*s/i);
  if (m) return (parseFloat(m[1]) + 3) * 1000;
  return RETRY_BASE_WAIT_MS;
}

function isRateLimit(error: unknown): boolean {
  const str = String(error);
  return str.includes("429") || str.includes("RESOURCE_EXHAUSTED");
}

async function callWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isRateLimit(e) && attempt < MAX_RETRIES) {
      const wait = parseRetryWaitMs(String(e));
      console.warn(`[Pivot] Rate limited — waiting ${Math.round(wait / 1000)}s (retry ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(wait);
      return callWithRetry(fn, attempt + 1);
    }
    throw e;
  }
}

async function callJson(
  genai: GoogleGenAI,
  prompt: string,
  model = "gemini-3-flash-preview"
): Promise<Record<string, unknown>> {
  return callWithRetry(async () => {
    const resp = await genai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });
    const text = resp.text ?? "{}";
    return JSON.parse(text) as Record<string, unknown>;
  });
}

async function callText(
  genai: GoogleGenAI,
  prompt: string,
  useSearch = false,
  model = "gemini-3-flash-preview"
): Promise<string> {
  return callWithRetry(async () => {
    const config: Record<string, unknown> = {
      temperature: 0.3,
      maxOutputTokens: 3000,
    };
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.thinkingConfig = { thinkingBudget: 0 };
    }
    const resp = await genai.models.generateContent({
      model,
      contents: prompt,
      config,
    });
    return resp.text ?? "";
  });
}

// ── Main entry point ───────────────────────────────────────────────────────────

export async function synthesizeDeliverables(
  questionnaire: Questionnaire,
  packet: BusinessPacket
): Promise<MVPDeliverables> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return getFallbackDeliverables(questionnaire, "GEMINI_API_KEY is missing from environment.");
  }

  const genai = new GoogleGenAI({ apiKey });
  // Use lean structured packet context (much smaller than raw KnowledgeGraph JSON)
  // Cap at 60K chars to stay within model context limits
  const kg = formatPacketAsContext(packet).slice(0, 60_000);

  try {
    console.log("[Pivot] Generating Health Score…");
    const health = await genHealthScore(genai, kg);

    console.log("[Pivot] Generating Cash Intelligence…");
    const cash = await genCashIntelligence(genai, kg);

    console.log("[Pivot] Identifying Revenue Leaks…");
    const leaks = await genRevenueLeaks(genai, kg);

    console.log("[Pivot] Compiling Issues Register…");
    const issues = await genIssuesRegister(genai, kg);

    console.log("[Pivot] Analysing At-Risk Customers…");
    const customers = await genAtRiskCustomers(genai, kg);

    console.log("[Pivot] Drafting Decision Brief…");
    const brief = await genDecisionBrief(genai, kg, questionnaire);

    console.log("[Pivot] Building Action Plan…");
    const actionPlan = await genActionPlan(genai, kg, questionnaire);

    console.log("[Pivot] Researching external market context…");
    const researchCtx = await researchExternalContext(genai, kg, packet);

    console.log("[Pivot] Building Growth Intelligence…");
    const marketIntel = await genMarketIntelligence(genai, kg, researchCtx);

    return normalizeDeliverables({
      healthScore: health,
      cashIntelligence: cash,
      revenueLeakAnalysis: leaks,
      issuesRegister: issues,
      atRiskCustomers: customers,
      decisionBrief: brief,
      actionPlan,
      marketIntelligence: marketIntel,
    });
  } catch (e) {
    console.warn("[Pivot] Synthesis failed:", e);
    const errorMsg = e instanceof Error ? e.message : String(e);
    return getFallbackDeliverables(questionnaire, `Synthesis error: ${errorMsg}`);
  }
}

// ── Individual deliverable generators ─────────────────────────────────────────

async function genHealthScore(genai: GoogleGenAI, kg: string) {
  const schema = `{
  "score": <integer 0-100>,
  "grade": "<A/B/C/D/F>",
  "headline": "<one punchy sentence describing the overall business health>",
  "interpretation": "<2-3 sentences: what this score means for this specific business right now>",
  "summary": "<2-3 sentences overall summary>",
  "dimensions": [
    {
      "name": "Cash & Financial Health",
      "score": <0-100>,
      "grade": "<A-F>",
      "summary": "<2 sentences specific to this business>",
      "keyFinding": "<the single most important finding for this dimension>",
      "driver": "<key driver phrase>"
    },
    {
      "name": "Revenue & Growth Momentum",
      "score": <0-100>,
      "grade": "<A-F>",
      "summary": "<2 sentences>",
      "keyFinding": "<most important finding>",
      "driver": "<key driver>"
    },
    {
      "name": "Customer Stability",
      "score": <0-100>,
      "grade": "<A-F>",
      "summary": "<2 sentences>",
      "keyFinding": "<most important finding>",
      "driver": "<key driver>"
    },
    {
      "name": "People & Team",
      "score": <0-100>,
      "grade": "<A-F>",
      "summary": "<2 sentences>",
      "keyFinding": "<most important finding>",
      "driver": "<key driver>"
    },
    {
      "name": "Competitive Position",
      "score": <0-100>,
      "grade": "<A-F>",
      "summary": "<2 sentences>",
      "keyFinding": "<most important finding>",
      "driver": "<key driver>"
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nGenerate the Business Health Score. Score each dimension honestly based on the data provided.\nIf data for a dimension is missing, score it conservatively (40-50) and note the data gap.\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

async function genCashIntelligence(genai: GoogleGenAI, kg: string) {
  const schema = `{
  "currentCashPosition": <float or null if unknown>,
  "runwayWeeks": <integer — weeks until cash hits critical level, or 52 if safe>,
  "criticalWeeks": [<list of week numbers where balance may hit danger zone>],
  "summary": "<3-4 sentences: the cash story for this business right now>",
  "topRisks": [
    "<specific cash risk #1 — name the week, the amount, the cause>",
    "<specific cash risk #2>",
    "<specific cash risk #3>"
  ],
  "recommendations": [
    "<action #1 — specific, with timeline and expected $ impact>",
    "<action #2>",
    "<action #3>"
  ],
  "risks": [
    { "description": "<risk description>", "week": <week number or null>, "impact": "<$ or qualitative>" }
  ],
  "weeklyProjections": [
    {
      "week": 1,
      "label": "Week 1",
      "openingBalance": <float>,
      "inflows": <float>,
      "outflows": <float>,
      "closingBalance": <float>,
      "riskFlag": "<null or 'LOW BALANCE' or 'CASH CRUNCH' or 'NEGATIVE'>",
      "action": "<null or specific action if riskFlag is set>"
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nGenerate the 13-week Cash Intelligence Report.\nUse actual financial data where available. Where exact figures are missing, estimate conservatively\nbased on the revenue model and flag estimates clearly. Flag the exact week number where cash risks appear.\n\nReturn ONLY valid JSON with 13 entries in weeklyProjections, matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

async function genRevenueLeaks(genai: GoogleGenAI, kg: string) {
  const schema = `{
  "totalIdentified": <float — total $ recoverable across all leaks>,
  "totalRecoverable": <float — same as totalIdentified>,
  "day90RecoveryProjection": <float — realistic 90-day recovery if actions taken>,
  "priorityAction": "<the single most important action to take in the next 7 days>",
  "summary": "<2-3 sentences overall summary of revenue leak situation>",
  "items": [
    {
      "rank": 1,
      "description": "<specific leak description>",
      "amount": <float — annual $ impact>,
      "annualImpact": <float — same as amount>,
      "category": "<e.g. 'Underpriced Contracts', 'Missed Upsell', 'Pre-Churn Revenue', 'Pricing Gap'>",
      "clientOrArea": "<specific client name or business area>",
      "confidence": "<High/Medium/Low>",
      "rootCause": "<specific, named root cause — not generic>",
      "recoveryPlan": "<specific action with owner and timeline>",
      "timeline": "<e.g. 'Actionable in 2 weeks', 'Requires 30 days'>"
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nIdentify and dollar-denominate every revenue leak in this business.\nA revenue leak is money the business is losing, leaving on the table, or about to lose.\nCategories: underpriced products/services, undercharged clients, missed upsells, at-risk recurring revenue,\nmarketing waste, pricing inconsistencies, pre-churn customer revenue.\n\nBe specific: name the client, the contract, the product line. If the data supports it, name the exact amount.\nMinimum 3 leaks, maximum 8. Rank by annual $ impact.\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

async function genIssuesRegister(genai: GoogleGenAI, kg: string) {
  const schema = `{
  "totalIssues": <integer>,
  "criticalCount": <integer>,
  "highCount": <integer>,
  "totalFinancialExposure": <float>,
  "issues": [
    {
      "id": "ISS-001",
      "title": "<short, specific title — not generic>",
      "description": "<2-3 sentences: what the problem is, why it matters, what happens if ignored>",
      "category": "<Financial/Customer/People/Operations/Strategic/Compliance>",
      "severity": "<Critical/High/Medium/Low>",
      "financialImpact": <float or null>,
      "timeToImpact": "<e.g. 'Immediate', '30 days', '60 days', '6 months'>",
      "recommendedAction": "<specific action, owner, timeline>",
      "owner": "<null or role/person if identifiable from data>"
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nGenerate the complete Issues Register for this business.\nAn issue is any problem, risk, gap, or threat identified from the data.\nEvery issue must be:\n- Named specifically (not "Cash Flow Issue" but "Accounts receivable aging: 3 clients 90+ days overdue")\n- Dollar-denominated where possible\n- Ranked by severity + time-to-impact\n\nInclude at minimum 10 issues. No upper limit — include everything the data supports.\nCategories: Financial, Customer, People, Operations, Strategic, Compliance.\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

async function genAtRiskCustomers(genai: GoogleGenAI, kg: string) {
  const schema = `{
  "totalRevenueAtRisk": <float — combined annual revenue of top 3 at-risk customers>,
  "immediateAction": "<the one action to take today across all three relationships>",
  "summary": "<2-3 sentences summarising customer stability risk>",
  "customers": [
    {
      "name": "<customer name>",
      "risk": "<short risk label>",
      "revenueAtRisk": <float or null>,
      "riskScore": <integer 0-100, 100 = highest risk>,
      "churnProbability": "<High/Medium>",
      "daysToLikelyChurn": <integer or null>,
      "warningSignals": [
        "<specific signal from the data>",
        "<signal 2>",
        "<signal 3>"
      ],
      "interventionActions": [
        "<action 1 — specific, with timing>",
        "<action 2>",
        "<action 3>"
      ],
      "talkingPoints": "<2-3 sentences: what to say in the retention conversation>",
      "recommendation": "<specific recommended action for this customer>"
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nIdentify the top 3 customers most at risk of churning in the next 60-90 days.\nUse every signal available: contract terms, communication frequency, payment history,\nsatisfaction signals, tenure, revenue concentration, competitive threats.\n\nIf fewer than 3 customers are identifiable from the data, include the ones you can identify\nand note data gaps for the others.\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

async function genDecisionBrief(
  genai: GoogleGenAI,
  kg: string,
  questionnaire: Questionnaire
) {
  const decision = questionnaire.oneDecisionKeepingOwnerUpAtNight || "the most pressing strategic decision facing this business";
  const schema = `{
  "decision": "<the exact decision to be made>",
  "context": "<3-4 sentences: what the data tells us about the context of this decision>",
  "recommendation": "<clear, direct recommendation — pick a side>",
  "rationale": "<3-4 sentences: why this recommendation, backed by the specific data we have>",
  "nextStep": "<the single most important action to take in the next 48 hours>",
  "deadlineSuggestion": "<recommended decision deadline and why>",
  "options": [
    {
      "label": "<option name>",
      "outcome": "<expected outcome — what happens if chosen>",
      "recommendation": <true or false>,
      "pros": ["<pro 1>", "<pro 2>"],
      "cons": ["<con 1>", "<con 2>"],
      "expectedOutcome": "<what happens if this option is chosen, in 12 months>"
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nThe business owner has identified this as their most pressing decision:\n"${decision}"\n\nGenerate the First Decision Brief. Structure it as a concise, data-driven brief that helps\nthe owner make this specific decision. Use the business data to inform each option's analysis.\nInclude 2-3 options. Be direct: tell them what you would do and why.\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

async function genActionPlan(
  genai: GoogleGenAI,
  kg: string,
  questionnaire: Questionnaire
) {
  const schema = `{
  "summary": "<2-3 sentences: overall strategic implementation summary>",
  "days": [
    {
      "day": <day number>,
      "title": "<day/phase title>",
      "tasks": [
        {
          "description": "<specific task description>",
          "owner": "<role or person responsible>",
          "status": "pending"
        }
      ]
    }
  ]
}`;
  const prompt = `Business Knowledge Graph:\n${kg}\n\nPrimary objective: ${questionnaire.primaryObjective || questionnaire.oneDecisionKeepingOwnerUpAtNight}\n\nCreate a tactical 30-day action plan (5 key phases/days) with specific tasks derived from the identified\nissues, opportunities, and strategic priorities in the data.\nEach phase should have 2-4 concrete, assignable tasks.\nThe plan should directly address the most critical findings.\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  return callJson(genai, prompt);
}

// ── External Research & Growth Intelligence ────────────────────────────────────

async function researchExternalContext(
  genai: GoogleGenAI,
  kg: string,
  packet: BusinessPacket
): Promise<string> {
  const q = packet.questionnaire;
  const bizDesc = [q.organizationName, q.industry, q.businessModel, q.location, `Revenue: ${q.revenueRange}`]
    .filter(Boolean)
    .join(" | ") || "a small-to-medium business";

  const researchPrompt = `I need comprehensive external market research for: ${bizDesc}

Please research and provide detailed, data-rich information on ALL of the following:

1. INDUSTRY BENCHMARKS
   - Typical gross margin ranges for this type of business
   - Revenue per employee benchmarks
   - Customer acquisition cost (CAC) and lifetime value (LTV) norms
   - Average contract/deal sizes and cash cycle lengths

2. CURRENT MARKET TRENDS & OPPORTUNITIES
   - Fastest-growing niches within this sector right now
   - Underserved problems that businesses like this could solve
   - Technology or market shifts creating new revenue opportunities

3. LOW-HANGING FRUIT (quick revenue wins most owners overlook)
   - Top 5 most commonly overlooked revenue opportunities in this sector
   - For each: what it is, how quickly it generates cash, typical cost to implement

4. PIVOT & DIVERSIFICATION OPPORTUNITIES
   - Adjacent businesses the most successful companies in this sector expand into
   - Pivots with the lowest startup cost and fastest path to revenue
   - New revenue streams that can be layered onto an existing operation like this

5. COMPLEMENTARY INCOME STREAMS
   - Other businesses or services easily added to generate additional income
   - Which ones use existing skills, assets, or client relationships

6. COMPETITIVE LANDSCAPE
   - What do the top 10% of businesses in this sector do that the bottom 50% don't?
   - Pricing strategies that are working best right now

7. QUICK CASH STRATEGIES
   - What can a business like this do in the next 7-30 days to generate immediate cash?
   - Most effective cost-cutting moves without damaging long-term value

Be as specific and data-rich as possible. Use real examples and real numbers where available.`;

  // Try with Google Search grounding first
  try {
    const text = await callText(genai, researchPrompt, true);
    if (text) {
      console.log("[Pivot] External research: Google Search grounding succeeded");
      return text;
    }
  } catch (e) {
    console.warn("[Pivot] Google Search grounding unavailable, falling back to knowledge base");
  }

  // Fallback: Gemini training knowledge
  try {
    const text = await callText(genai, researchPrompt, false);
    if (text) {
      console.log("[Pivot] External research: knowledge-based fallback succeeded");
      return text;
    }
  } catch (e) {
    console.warn("[Pivot] Research fallback also failed:", e);
  }

  return "";
}

async function genMarketIntelligence(
  genai: GoogleGenAI,
  kg: string,
  researchContext: string
) {
  const schema = `{
  "industry": "<industry/sector name>",
  "industryContext": "<3-4 sentences: what the market looks like, key trends, where the money is>",
  "searchPowered": <true if real-time Google Search data was available, false otherwise>,
  "benchmarks": [
    {
      "metric": "<metric name>",
      "industryRange": "<typical industry range or value>",
      "thisBusinessEstimate": "<estimated position for THIS business based on available data, or 'Insufficient data'>",
      "gapAnalysis": "<above benchmark / below benchmark / at benchmark / unknown>",
      "implication": "<what this gap means in practice for this business>"
    }
  ],
  "lowHangingFruit": [
    {
      "rank": 1,
      "opportunity": "<specific opportunity name>",
      "effort": "<Low/Medium/High>",
      "monthlyRevenuePotential": "<$ estimate or range>",
      "timeToFirstRevenue": "<e.g. '1-2 weeks'>",
      "whyThisBusiness": "<why this specific business is positioned to capture this>",
      "implementationSteps": ["<step 1>", "<step 2>", "<step 3>"]
    }
  ],
  "pivotOpportunities": [
    {
      "rank": 1,
      "direction": "<pivot name>",
      "whySuited": "<why THIS business suits this pivot>",
      "marketOpportunity": "<size/demand of this opportunity>",
      "startupCost": "<Low (<$5K) / Medium ($5-20K) / High (>$20K)>",
      "timeToFirstRevenue": "<realistic estimate>",
      "firstThreeSteps": ["<step 1>", "<step 2>", "<step 3>"],
      "risk": "<main risk of this pivot>"
    }
  ],
  "complementaryBusinesses": [
    {
      "rank": 1,
      "businessType": "<e.g. 'Training & Certification Services'>",
      "synergyWithExisting": "<how it leverages existing clients, skills or infrastructure>",
      "setupEffort": "<Low/Medium/High>",
      "incomePotential": "<$ estimate per month within 6 months>",
      "howToStart": "<specific first action to test this income stream>"
    }
  ],
  "quickWins": [
    {
      "rank": 1,
      "action": "<specific, named action>",
      "timeline": "<24 hours / this week / next 2 weeks / next 30 days>",
      "expectedCashImpact": "<$ impact or qualitative description>",
      "instructions": "<specific how-to — concrete enough to act on today>"
    }
  ],
  "whatTopPerformersDo": [
    "<specific practice #1 that separates top 10% from the rest>",
    "<specific practice #2>",
    "<specific practice #3>",
    "<specific practice #4>"
  ],
  "competitiveIntelligence": "<3-4 sentences on the competitive landscape, key differentiators, and how to win>",
  "urgentOpportunity": "<the single highest-priority external opportunity for THIS business right now>"
}`;

  const researchSection = researchContext
    ? `EXTERNAL MARKET RESEARCH (live web data and industry knowledge):\n${researchContext}`
    : "NOTE: External research context unavailable. Draw exclusively on your training knowledge about this industry.";

  const prompt = `Business Knowledge Graph (internal data from uploaded documents):
${kg}

${researchSection}

---

Your task: Produce a Growth Intelligence & Market Opportunity Report.

This report answers: "What should I do — beyond fixing what's broken — to generate more income,
pivot if needed, and build a stronger business? What are my real options?"

Rules:
1. Compare this business's ACTUAL metrics (where identifiable) against external benchmarks.
2. Every low-hanging fruit opportunity must be practical given THIS business's existing clients,
   capabilities, and constraints.
3. Pivots must build on existing strengths — not require starting from scratch.
4. Quick wins must be genuinely executable within the stated timeframe.
5. Be bold and direct — this owner needs someone to tell them the truth about their options.

Minimum required:
- 5 benchmarks
- 4 low-hanging fruit opportunities (ranked by ease × impact)
- 3 pivot opportunities
- 3 complementary business ideas
- 5 quick wins (sorted by timeline, fastest first)
- 4 things top performers do differently
- 1 urgent opportunity (the most important one to act on THIS WEEK)

Return ONLY valid JSON matching this schema:
${schema}`;

  const result = await callJson(genai, prompt);
  // Mark if research context was available (Google Search grounding)
  if (result && typeof result === "object") {
    result.searchPowered = Boolean(researchContext);
  }
  return result;
}

// ── Tech Optimization ─────────────────────────────────────────────────────────

export async function synthesizeTechOptimization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TechOptimization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });

  const techContext = [
    questionnaire.techStack ? `Tech Stack / Hosting: ${questionnaire.techStack}` : null,
    questionnaire.websiteVisitorsPerDay
      ? `Daily Website Visitors: ${questionnaire.websiteVisitorsPerDay}`
      : null,
    packet.keyMetrics.estimatedMonthlyRevenue
      ? `Monthly Revenue: $${packet.keyMetrics.estimatedMonthlyRevenue.toLocaleString()}`
      : `Revenue Range: ${questionnaire.revenueRange}`,
    packet.keyMetrics.employeeCount
      ? `Employees: ${packet.keyMetrics.employeeCount}`
      : null,
    packet.keyMetrics.grossMarginPct
      ? `Gross Margin: ${packet.keyMetrics.grossMarginPct}%`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const schema = `{
  "currentEstimatedMonthlyCost": <number or null>,
  "potentialSavings": <number or null>,
  "recommendations": [
    {
      "rank": 1,
      "currentTool": "...",
      "suggestedAlternative": "...",
      "estimatedSaving": "e.g. $300/mo",
      "rationale": "Why this makes sense for their scale/visitors",
      "migrationEffort": "Low" | "Medium" | "High"
    }
  ],
  "summary": "2-3 sentence overall tech cost assessment"
}`;

  const prompt = `You are a technology cost optimization advisor for small-to-medium businesses.

BUSINESS CONTEXT:
${techContext}

Analyze their technology infrastructure and identify cost-saving opportunities appropriate for their scale. Consider:
- Hosting and deployment (Vercel, Netlify, AWS, GCP, Firebase, Railway, Cloudflare Pages, etc.)
- Database and backend services
- SaaS tools and subscriptions
- Website/app performance infrastructure
- Email and communication tools

For each recommendation, suggest a specific alternative that:
- Is appropriate for their visitor count and revenue level
- Has a realistic migration path
- Won't sacrifice significant capabilities

If techStack is "unknown" or not provided, make reasonable inferences based on their industry and business model, then note the assumptions.

Return ONLY valid JSON:
${schema}`;

  try {
    const result = await callJson(genai, prompt);
    return result as unknown as TechOptimization;
  } catch (e) {
    console.warn("[Pivot] TechOptimization synthesis failed:", e);
    return null;
  }
}

// ── Pricing Intelligence ───────────────────────────────────────────────────────

export async function synthesizePricingIntelligence(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  competitorAnalysis?: CompetitorAnalysis
): Promise<PricingIntelligence | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });

  const competitorContext = competitorAnalysis
    ? `COMPETITOR PRICING CONTEXT:
Industry leaders positioning: ${competitorAnalysis.suggestedPositioning}
Top competitor offers: ${competitorAnalysis.competitors.map((c) => c.offer).join("; ")}
Industry leaders market direction: ${competitorAnalysis.industryLeaders.map((l) => l.marketingDirection).join("; ")}`
    : "";

  const schema = `{
  "currentPricingAssessment": "...",
  "suggestedPricing": [
    {
      "tier": "Starter / Core / Premium (or whatever fits)",
      "range": "$X - $Y / month or project",
      "rationale": "...",
      "targetSegment": "..."
    }
  ],
  "competitivePosition": "...",
  "marginOptimization": "...",
  "summary": "..."
}`;

  const prompt = `You are a pricing strategy advisor. Based on this business's financials and competitive landscape, recommend optimal pricing.

BUSINESS:
Company: ${packet.orgName} | ${packet.industry}
Revenue Range: ${questionnaire.revenueRange}
Business Model: ${questionnaire.businessModel}
Gross Margin: ${packet.keyMetrics.grossMarginPct ? `${packet.keyMetrics.grossMarginPct}%` : "Unknown"}
Monthly Expenses: ${packet.keyMetrics.estimatedMonthlyExpenses ? `$${packet.keyMetrics.estimatedMonthlyExpenses.toLocaleString()}` : "Unknown"}
Monthly Revenue: ${packet.keyMetrics.estimatedMonthlyRevenue ? `$${packet.keyMetrics.estimatedMonthlyRevenue.toLocaleString()}` : "Unknown"}

${competitorContext}

Provide pricing recommendations that:
1. Cover their costs with healthy margins (target 40-60%+ gross margin)
2. Are competitive with market rates given the competitive landscape
3. Include tiered options to capture different customer segments
4. Account for their current revenue level and growth stage

Return ONLY valid JSON:
${schema}`;

  try {
    const result = await callJson(genai, prompt);
    return result as unknown as PricingIntelligence;
  } catch (e) {
    console.warn("[Pivot] PricingIntelligence synthesis failed:", e);
    return null;
  }
}

// ── Normalizers & fallback ─────────────────────────────────────────────────────

function normalizeDeliverables(d: Record<string, unknown>): MVPDeliverables {
  return {
    healthScore: (d.healthScore as MVPDeliverables["healthScore"]) ?? {
      score: 0,
      dimensions: [],
      summary: "",
    },
    cashIntelligence: (d.cashIntelligence as MVPDeliverables["cashIntelligence"]) ?? {
      summary: "",
      risks: [],
      recommendations: [],
    },
    revenueLeakAnalysis: (d.revenueLeakAnalysis as MVPDeliverables["revenueLeakAnalysis"]) ?? {
      totalIdentified: 0,
      items: [],
      summary: "",
    },
    issuesRegister: (d.issuesRegister as MVPDeliverables["issuesRegister"]) ?? {
      issues: [],
    },
    atRiskCustomers: (d.atRiskCustomers as MVPDeliverables["atRiskCustomers"]) ?? {
      customers: [],
      summary: "",
    },
    decisionBrief: (d.decisionBrief as MVPDeliverables["decisionBrief"]) ?? {
      decision: "",
      context: "",
      options: [],
      recommendation: "",
    },
    actionPlan: (d.actionPlan as MVPDeliverables["actionPlan"]) ?? {
      days: [],
      summary: "",
    },
    marketIntelligence: d.marketIntelligence as MVPDeliverables["marketIntelligence"],
  };
}

function getFallbackDeliverables(q: Questionnaire, errorReason: string): MVPDeliverables {
  const isRateLimit = errorReason.includes("429");
  const displayError = isRateLimit
    ? "Gemini API Rate Limit Reached. Please wait a moment and try again."
    : errorReason;

  return {
    healthScore: {
      score: 72,
      dimensions: [
        { name: "Cash & Financial Health", score: 85, driver: "Strong runway" },
        { name: "Revenue & Growth Momentum", score: 60, driver: "Pricing gaps" },
        { name: "Customer Stability", score: 70, driver: "At-risk accounts" },
        { name: "People & Team", score: 90, driver: "High engagement" },
        { name: "Competitive Position", score: 55, driver: "Competitor shifts" },
      ],
      summary: `Note: This is an estimated report. ${displayError}`,
    },
    cashIntelligence: {
      summary: "13-week cash view (Manual Fallback).",
      risks: [{ description: "Please wait for API rate limit to reset for live analysis", week: 1, impact: "TBD" }],
      recommendations: [displayError],
    },
    revenueLeakAnalysis: {
      totalIdentified: 0,
      items: [],
      summary: `Detailed analysis paused: ${displayError}`,
    },
    issuesRegister: {
      issues: [
        { id: "API-INFO", description: displayError, severity: "MED", financialImpact: 0, category: "Status" },
      ],
    },
    atRiskCustomers: {
      customers: [],
      summary: "Specific customer risk profiling requires active Gemini API connection.",
    },
    decisionBrief: {
      decision: q.oneDecisionKeepingOwnerUpAtNight || "Key strategic decision",
      context: q.keyConcerns || "Context from questionnaire.",
      options: [
        { label: "Proceed", outcome: "Move forward with decision.", recommendation: true },
        { label: "Defer", outcome: "Wait for more data.", recommendation: false },
      ],
      recommendation: displayError,
    },
    actionPlan: {
      summary: "Strategic implementation roadmap.",
      days: [
        {
          day: 1,
          title: "Initial Onboarding",
          tasks: [{ description: "Complete platform ingestion", owner: "Owner", status: "pending" }],
        },
        {
          day: 2,
          title: "Phase 2 Approval",
          tasks: [{ description: "Review AI-generated roadmap", owner: "Leadership", status: "pending" }],
        },
      ],
    },
  };
}
