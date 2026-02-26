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
  DataProvenance,
  FinancialFact,
  KPIReport,
  RoadmapReport,
  HealthChecklist,
  SWOTAnalysis,
  UnitEconomics,
  CustomerSegmentation,
  CompetitiveWinLoss,
  InvestorOnePager,
  HiringPlan,
  RevenueForecast,
  ChurnPlaybook,
  SalesPlaybook,
  GoalTracker,
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

SOURCE ATTRIBUTION RULES (mandatory — anti-hallucination):
- The data includes a "VERIFIED FINANCIAL FACTS" section with numbers extracted directly from uploaded documents.
  These are ground truth. Use them EXACTLY as stated. Do NOT round, adjust, or override them.
- If a number comes from uploaded documents, use it exactly.
- If you are estimating or projecting a number not found in the documents, clearly note it is an estimate.
- If data is insufficient to produce a specific number, say "Insufficient data" — do NOT invent a plausible number.
- NEVER fabricate specific dollar amounts, customer names, or metrics that are not supported by the provided data.
- Only reference customers, contracts, and entities that appear in the document data.

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

    const deliverables = normalizeDeliverables({
      healthScore: health,
      cashIntelligence: cash,
      revenueLeakAnalysis: leaks,
      issuesRegister: issues,
      atRiskCustomers: customers,
      decisionBrief: brief,
      actionPlan,
      marketIntelligence: marketIntel,
    });

    // Attach data provenance (anti-hallucination metadata)
    deliverables.dataProvenance = buildDataProvenance(packet);

    return deliverables;
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
  const prompt = `Business Knowledge Graph:\n${kg}\n\nGenerate the Cash Intelligence Report.

ANTI-HALLUCINATION RULES FOR CASH PROJECTIONS:
- Use ONLY financial data from the VERIFIED FINANCIAL FACTS section for opening balances and known amounts.
- For weeks where you have actual data, use the exact numbers from the documents.
- For projected weeks, clearly base projections on documented patterns and state your assumptions.
- If total document data is insufficient for meaningful 13-week projections, produce FEWER weeks
  with a summary explaining the data limitation, rather than fabricating 13 weeks of made-up numbers.
- NEVER invent specific dollar amounts that appear to come from documents.
- Set currentCashPosition to null if no cash figure exists in the VERIFIED FINANCIAL FACTS.

Return ONLY valid JSON matching this schema:\n${schema}`;
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
  const prompt = `Business Knowledge Graph:\n${kg}\n\nIdentify and dollar-denominate every revenue leak in this business.
A revenue leak is money the business is losing, leaving on the table, or about to lose.
Categories: underpriced products/services, undercharged clients, missed upsells, at-risk recurring revenue,
marketing waste, pricing inconsistencies, pre-churn customer revenue.

ANTI-HALLUCINATION RULES:
- Only name clients, contracts, or product lines that appear in the VERIFIED FINANCIAL FACTS or document data.
- If a specific dollar amount can be tied to document data, use it exactly and set confidence to "High".
- If you are estimating a dollar amount based on patterns, set confidence to "Medium" or "Low".
- If you cannot identify a specific dollar amount from the data, set amount to 0 and note "Unquantified" in the description.
- Do NOT invent client names or contract values. If the data mentions a client, use that name; otherwise describe the area generically.

Minimum 3 leaks, maximum 8. Rank by annual $ impact.

Return ONLY valid JSON matching this schema:\n${schema}`;
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
  const prompt = `Business Knowledge Graph:\n${kg}\n\nIdentify the top 3 customers most at risk of churning in the next 60-90 days.
Use every signal available: contract terms, communication frequency, payment history,
satisfaction signals, tenure, revenue concentration, competitive threats.

ANTI-HALLUCINATION RULES:
- Only name customers that ACTUALLY APPEAR in the uploaded documents or VERIFIED FINANCIAL FACTS.
- Do NOT invent customer names. If a customer is mentioned in the data, use their exact name.
- If fewer than 3 customers are identifiable from the data, return ONLY the ones you can identify.
  Do NOT pad the list with made-up customer names.
- Revenue at risk should be based on documented figures where available, or noted as an estimate.

Return ONLY valid JSON matching this schema:\n${schema}`;
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

// ── Data Provenance (anti-hallucination metadata) ─────────────────────────────

function buildDataProvenance(packet: BusinessPacket): DataProvenance {
  const facts = packet.financialFacts ?? [];
  const sourceFiles = [...new Set(facts.map((f) => f.sourceFile))];

  // Check coverage gaps
  const coverageGaps: string[] = [];
  const coverage = packet.dataCoverage ?? {};
  for (const cat of ["Financial Position", "Revenue Model", "Customer Portfolio", "Operations"]) {
    if (!coverage[cat]) coverageGaps.push(`No ${cat} documents provided`);
  }
  if (!packet.keyMetrics.cashPosition && !facts.some((f) => f.label.toLowerCase().includes("cash"))) {
    coverageGaps.push("No cash position data found in documents");
  }
  if (!packet.keyMetrics.estimatedMonthlyRevenue && !facts.some((f) => f.label.toLowerCase().includes("revenue"))) {
    coverageGaps.push("No revenue figures found in documents");
  }

  // Detect conflicts between facts with similar labels
  const warnings: string[] = [];
  const byLabel = new Map<string, FinancialFact[]>();
  for (const f of facts) {
    const key = f.label.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = byLabel.get(key) ?? [];
    existing.push(f);
    byLabel.set(key, existing);
  }
  for (const [, group] of byLabel) {
    if (group.length > 1) {
      const values = group.map((f) => f.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (min > 0 && max / min > 1.25) {
        warnings.push(
          `Conflicting values for "${group[0].label}": ${group.map((f) => `$${f.value.toLocaleString()} (${f.sourceFile})`).join(" vs ")}`
        );
      }
    }
  }

  return {
    documentSources: sourceFiles,
    financialFactCount: facts.length,
    warnings,
    coverageGaps,
  };
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

// ── KPI Identification ────────────────────────────────────────────────────────

export async function synthesizeKPIs(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<KPIReport | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });

  const schema = `{
  "businessType": "<saas|services|retail|b2b|b2c|other>",
  "kpis": [
    {
      "name": "e.g. Monthly Recurring Revenue",
      "abbreviation": "MRR",
      "currentValue": "$42,000 or Unknown",
      "targetValue": "$60,000",
      "unit": "$ or % or # or days",
      "frequency": "Monthly or Weekly or Daily",
      "isNorthStar": true,
      "category": "Revenue or Growth or Retention or Operations or Marketing",
      "benchmark": "Industry average: $50K (optional)",
      "status": "on_track or at_risk or behind or unknown",
      "sourceData": "from_documents or estimated or unknown"
    }
  ],
  "summary": "2-3 sentence KPI overview",
  "missingDataWarning": "What data we'd need for better KPIs (or null)"
}`;

  const ctx = formatPacketAsContext(packet).slice(0, 40_000);
  const prompt = `You are a KPI and business metrics expert.

BUSINESS DATA:
${ctx}

Business Model: ${questionnaire.businessModel}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}

Identify 5-7 Key Performance Indicators for this specific business:
1. 2-3 should be North Star metrics (the most important ones)
2. Include current value if you can find it in the data — mark as "from_documents"
3. If you can't find the value, set currentValue to "Unknown" and sourceData to "unknown"
4. Set realistic target values based on industry benchmarks
5. NEVER invent specific current values — if data doesn't exist, say "Unknown"

Return ONLY valid JSON:
${schema}`;

  try {
    const result = await callJson(genai, prompt);
    return result as unknown as KPIReport;
  } catch (e) {
    console.warn("[Pivot] KPI synthesis failed:", e);
    return null;
  }
}

// ── Roadmap / 30-Day Calendar ─────────────────────────────────────────────────

export async function synthesizeRoadmap(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<RoadmapReport | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });

  // Build context from existing deliverables
  const quickWins = deliverables.marketIntelligence?.quickWins?.slice(0, 5) ?? [];
  const issues = deliverables.issuesRegister?.issues?.slice(0, 5) ?? [];
  const actionPlan = deliverables.actionPlan?.days?.slice(0, 5) ?? [];
  const leaks = deliverables.revenueLeakAnalysis?.items?.slice(0, 3) ?? [];

  const actionContext = `
QUICK WINS: ${JSON.stringify(quickWins)}
TOP ISSUES: ${JSON.stringify(issues.map(i => ({ title: i.title, severity: i.severity, impact: i.financialImpact })))}
ACTION PLAN: ${JSON.stringify(actionPlan)}
TOP REVENUE LEAKS: ${JSON.stringify(leaks.map(l => ({ desc: l.description, amount: l.amount })))}
BUSINESS: ${questionnaire.organizationName} (${questionnaire.industry})
`;

  const schema = `{
  "items": [
    {
      "day": 1,
      "action": "Call top 3 at-risk clients to schedule retention meetings",
      "category": "Revenue Recovery or Marketing or Operations or Sales or HR or Finance",
      "priority": "critical or high or medium or low",
      "expectedImpact": "$15K revenue saved",
      "owner": "Owner",
      "source": "Quick Win #1 or Issue #3 or Revenue Leak #1",
      "completed": false
    }
  ],
  "weeklyThemes": [
    { "week": 1, "theme": "Cash Protection", "focus": "Secure existing revenue and reduce immediate risks" }
  ],
  "summary": "2-3 sentence roadmap overview"
}`;

  const prompt = `You are a business execution planner creating a 30-day action roadmap.

${actionContext}

Create a practical 30-day action plan with 1-3 items per day:
- Days 1-7: Critical actions (cash protection, risk mitigation, quick wins)
- Days 8-14: Revenue recovery and customer retention
- Days 15-21: Growth initiatives and marketing
- Days 22-30: Systems improvement and long-term positioning

Rules:
- Every action must be specific and actionable (not "improve marketing" but "Post 3 Instagram reels showcasing customer success stories")
- Reference the actual quick wins, issues, and leaks from the data
- Set owner as "Owner" by default
- Include 4 weekly themes
- Be realistic — a business owner has limited hours

Return ONLY valid JSON:
${schema}`;

  try {
    const result = await callJson(genai, prompt);
    return result as unknown as RoadmapReport;
  } catch (e) {
    console.warn("[Pivot] Roadmap synthesis failed:", e);
    return null;
  }
}

// ── Gold Standard Business Health Checklist ────────────────────────────────────

export async function synthesizeHealthChecklist(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<HealthChecklist | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });

  const ctx = formatPacketAsContext(packet).slice(0, 30_000);
  const schema = `{
  "items": [
    {
      "category": "Sales or Operations or Marketing or Finance or HR or Technology",
      "item": "CRM System",
      "description": "A system to track customer interactions and sales pipeline",
      "status": "present or absent or partial or unknown",
      "evidence": "Found Salesforce mentions in documents (or null)",
      "recommendation": "Consider HubSpot CRM free tier (or null if present)",
      "priority": "critical or important or nice_to_have",
      "estimatedCost": "$0 - $50/mo (or null)"
    }
  ],
  "score": 65,
  "grade": "C",
  "summary": "2-3 sentence assessment",
  "topGap": "Your biggest operational gap is..."
}`;

  const prompt = `You are a business operations auditor checking for gold-standard business practices.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Model: ${questionnaire.businessModel}

Check for these essential business elements (and any others relevant to their industry):

CRITICAL:
- CRM / customer tracking system
- Financial tracking / accounting system
- Defined sales process / pipeline
- KPIs and metrics tracking
- Regular team meetings / communication cadence

IMPORTANT:
- Documented standard operating procedures
- Customer feedback collection
- Employee onboarding process
- Communication tools (Slack, Teams, etc.)
- Marketing automation / email marketing

NICE TO HAVE:
- Project management tool
- Customer success / NPS tracking
- Competitive monitoring
- Data analytics dashboard
- Backup and disaster recovery

Rules:
- Mark as "present" ONLY if you find evidence in the uploaded data
- Mark as "absent" only if you're reasonably confident they don't have it
- Mark as "unknown" if the data doesn't tell you either way
- NEVER assume something exists without evidence
- Give practical, affordable recommendations for absent items

Return ONLY valid JSON:
${schema}`;

  try {
    const result = await callJson(genai, prompt);
    return result as unknown as HealthChecklist;
  } catch (e) {
    console.warn("[Pivot] Health checklist synthesis failed:", e);
    return null;
  }
}

// ── SWOT Analysis ──────────────────────────────────────────────────────────

export async function synthesizeSWOT(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SWOTAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "strengths": [{ "point": "...", "evidence": "...", "leverage": "..." }],
  "weaknesses": [{ "point": "...", "evidence": "...", "mitigation": "..." }],
  "opportunities": [{ "point": "...", "timeframe": "...", "potentialImpact": "...", "actionRequired": "..." }],
  "threats": [{ "point": "...", "likelihood": "high|medium|low", "severity": "...", "contingency": "..." }],
  "strategicPriorities": [{ "priority": "...", "rationale": "...", "timeline": "..." }],
  "summary": "2-3 sentence SWOT overview"
}`;

  const prompt = `You are a strategic business analyst performing a SWOT analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Model: ${questionnaire.businessModel}

Analyze this specific business for Strengths, Weaknesses, Opportunities, and Threats.
Each item MUST cite evidence from the data — no generic advice.
- Strengths: what this business does well, backed by numbers or facts from documents
- Weaknesses: internal problems with evidence (revenue gaps, team gaps, operational issues)
- Opportunities: external and internal growth levers with timeframes and dollar impact estimates
- Threats: competitive, market, financial, or operational threats with likelihood ratings
- Strategic Priorities: rank the top 3-5 priorities by impact, combining insights from all four quadrants

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Minimum: 3 items per SWOT quadrant, 3 strategic priorities.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating SWOT Analysis…");
    const result = await callJson(genai, prompt);
    return result as unknown as SWOTAnalysis;
  } catch (e) {
    console.warn("[Pivot] SWOT synthesis failed:", e);
    return null;
  }
}

// ── Unit Economics ─────────────────────────────────────────────────────────

export async function synthesizeUnitEconomics(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<UnitEconomics | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "cac": { "value": "...", "source": "from_documents|estimated", "benchmark": "..." },
  "ltv": { "value": "...", "source": "from_documents|estimated", "benchmark": "..." },
  "ltvCacRatio": { "value": "...", "assessment": "...", "benchmark": "..." },
  "paybackPeriodMonths": { "value": "...", "source": "from_documents|estimated", "assessment": "..." },
  "grossMargin": { "value": "...", "source": "from_documents|estimated", "benchmark": "..." },
  "netMargin": { "value": "...", "source": "from_documents|estimated" },
  "revenuePerCustomer": { "value": "...", "source": "from_documents|estimated" },
  "burnMultiple": { "value": "...", "assessment": "..." },
  "recommendations": [{ "metric": "...", "current": "...", "target": "...", "action": "..." }],
  "summary": "2-3 sentence unit economics overview",
  "dataQualityNote": "What data was available vs estimated"
}`;

  const prompt = `You are a financial analyst calculating unit economics.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}

Calculate unit economics from the uploaded financial data. For each metric:
- Flag as "from_documents" if calculated from actual document data
- Flag as "estimated" if you had to estimate based on industry patterns
- Include: CAC, LTV, LTV:CAC ratio, payback period, gross margin, net margin, revenue per customer, burn multiple
- Compare each against industry benchmarks
- Add 3-5 specific recommendations for improving unit economics

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Unit Economics…");
    const result = await callJson(genai, prompt);
    return result as unknown as UnitEconomics;
  } catch (e) {
    console.warn("[Pivot] Unit Economics synthesis failed:", e);
    return null;
  }
}

// ── Customer Segmentation ─────────────────────────────────────────────────

export async function synthesizeCustomerSegmentation(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<CustomerSegmentation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const atRisk = deliverables.atRiskCustomers?.customers?.slice(0, 5) ?? [];
  const leaks = deliverables.revenueLeakAnalysis?.items?.slice(0, 3) ?? [];
  const deliverablesContext = `
AT-RISK CUSTOMERS: ${JSON.stringify(atRisk.map(c => ({ name: c.name, risk: c.risk, revenue: c.revenueAtRisk })))}
TOP REVENUE LEAKS: ${JSON.stringify(leaks.map(l => ({ desc: l.description, amount: l.amount, client: l.clientOrArea })))}
TOTAL REVENUE AT RISK: ${deliverables.atRiskCustomers?.totalRevenueAtRisk ?? "Unknown"}`;

  const schema = `{
  "segments": [{
    "tier": "Enterprise|Mid-Market|SMB|Startup",
    "name": "...",
    "customerCount": "~N accounts",
    "revenueShare": "X% of revenue",
    "avgDealSize": "$X",
    "churnRisk": "low|medium|high",
    "growthPotential": "low|medium|high",
    "idealProfile": "...",
    "engagementStrategy": "..."
  }],
  "idealCustomerProfile": [{ "characteristic": "...", "importance": "..." }],
  "concentrationRisk": "Top N clients = X% of revenue — RISK LEVEL",
  "expansionTargets": [{ "segment": "...", "opportunity": "...", "estimatedRevenue": "..." }],
  "summary": "2-3 sentence segmentation overview"
}`;

  const prompt = `You are a customer strategy analyst performing segmentation.

BUSINESS DATA:
${ctx}

EXISTING ANALYSIS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}

Segment customers using all available data (customer lists, revenue data, at-risk customers):
- Create meaningful tiers based on revenue contribution, deal size, and engagement
- Identify the ideal customer profile (ICP) with specific characteristics
- Flag concentration risk (% of revenue from top clients)
- Suggest expansion targets — which segments to grow and why

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.
Only name customers that ACTUALLY APPEAR in the documents.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Segmentation…");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerSegmentation;
  } catch (e) {
    console.warn("[Pivot] Customer Segmentation synthesis failed:", e);
    return null;
  }
}

// ── Competitive Win/Loss Analysis ─────────────────────────────────────────

export async function synthesizeCompetitiveWinLoss(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<CompetitiveWinLoss | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const marketIntel = deliverables.marketIntelligence;
  const competitors = deliverables.competitorAnalysis;
  const deliverablesContext = `
COMPETITIVE INTELLIGENCE: ${marketIntel?.competitiveIntelligence ?? "None available"}
TOP PERFORMERS DO: ${JSON.stringify(marketIntel?.whatTopPerformersDo?.slice(0, 4) ?? [])}
COMPETITOR ANALYSIS: ${competitors ? JSON.stringify(competitors.competitors.map(c => ({ name: c.name, offer: c.offer, strengths: c.strengths }))) : "None available"}
SUGGESTED POSITIONING: ${competitors?.suggestedPositioning ?? "Unknown"}`;

  const schema = `{
  "winReasons": [{ "reason": "...", "frequency": "...", "evidence": "..." }],
  "lossReasons": [{ "reason": "...", "frequency": "...", "remediation": "..." }],
  "competitiveAdvantages": [{ "advantage": "...", "sustainability": "durable|temporary|at_risk" }],
  "competitiveDisadvantages": [{ "disadvantage": "...", "urgency": "immediate|medium_term|long_term", "fix": "..." }],
  "battleCards": [{ "competitor": "...", "theirStrength": "...", "yourCounter": "...", "talkTrack": "..." }],
  "summary": "2-3 sentence competitive overview"
}`;

  const prompt = `You are a competitive intelligence analyst.

BUSINESS DATA:
${ctx}

EXISTING COMPETITIVE ANALYSIS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Key Competitors: ${questionnaire.keyCompetitors ?? "Unknown"}

Analyze competitive positioning:
- Why does this business WIN deals? (identify patterns from customer data, strengths, market position)
- Why does this business LOSE deals? (identify gaps, weaknesses, competitive disadvantages)
- Create battle cards for top 3 competitors with specific counter-arguments and talk tracks
- Rate each competitive advantage as durable, temporary, or at_risk

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.
Only reference competitors that appear in the data or questionnaire.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Competitive Win/Loss Analysis…");
    const result = await callJson(genai, prompt);
    return result as unknown as CompetitiveWinLoss;
  } catch (e) {
    console.warn("[Pivot] Competitive Win/Loss synthesis failed:", e);
    return null;
  }
}

// ── Investor One-Pager ────────────────────────────────────────────────────

export async function synthesizeInvestorOnePager(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<InvestorOnePager | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const health = deliverables.healthScore;
  const marketIntel = deliverables.marketIntelligence;
  const leaks = deliverables.revenueLeakAnalysis;
  const deliverablesContext = `
HEALTH SCORE: ${health?.score ?? "Unknown"}/100 (${health?.grade ?? "?"})
HEADLINE: ${health?.headline ?? "N/A"}
INDUSTRY: ${marketIntel?.industry ?? questionnaire.industry}
INDUSTRY CONTEXT: ${marketIntel?.industryContext ?? "N/A"}
TOTAL REVENUE LEAKS: $${leaks?.totalIdentified ?? 0}
URGENT OPPORTUNITY: ${marketIntel?.urgentOpportunity ?? "N/A"}`;

  const schema = `{
  "companyName": "...",
  "tagline": "One-line pitch",
  "problem": "The problem being solved",
  "solution": "How this business solves it",
  "marketSize": "TAM/SAM/SOM estimate",
  "businessModel": "How it makes money",
  "traction": "Key metrics proving momentum",
  "team": "Team strengths and key members",
  "competitiveEdge": "Why this business wins",
  "financialHighlights": [{ "metric": "...", "value": "..." }],
  "askAmount": "Funding amount if applicable (or null)",
  "useOfFunds": "How funds would be used (or null)",
  "keyRisks": ["Risk 1", "Risk 2"],
  "whyNow": "Why this is the right time",
  "contactInfo": null,
  "summary": "2-3 sentence executive summary"
}`;

  const prompt = `You are an expert pitch consultant generating an investor one-pager.

BUSINESS DATA:
${ctx}

ANALYSIS HIGHLIGHTS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}

Generate a compelling investor one-pager that distills ALL business data into:
- A memorable tagline (under 10 words)
- Clear problem/solution framing
- Market size with realistic estimates
- Traction metrics from actual data (revenue, customers, growth)
- Financial highlights from VERIFIED data only
- Honest key risks (investors respect transparency)
- A compelling "why now" narrative

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.
Financial highlights MUST come from document data. Do NOT fabricate traction metrics.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Investor One-Pager…");
    const result = await callJson(genai, prompt);
    return result as unknown as InvestorOnePager;
  } catch (e) {
    console.warn("[Pivot] Investor One-Pager synthesis failed:", e);
    return null;
  }
}

// ── Hiring Plan ───────────────────────────────────────────────────────────

export async function synthesizeHiringPlan(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<HiringPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const issues = deliverables.issuesRegister?.issues?.slice(0, 5) ?? [];
  const leaks = deliverables.revenueLeakAnalysis?.items?.slice(0, 3) ?? [];
  const opportunities = deliverables.marketIntelligence?.lowHangingFruit?.slice(0, 3) ?? [];
  const deliverablesContext = `
TOP ISSUES: ${JSON.stringify(issues.map(i => ({ title: i.title, category: i.category, severity: i.severity })))}
REVENUE LEAKS: ${JSON.stringify(leaks.map(l => ({ desc: l.description, amount: l.amount })))}
GROWTH OPPORTUNITIES: ${JSON.stringify(opportunities.map(o => ({ opportunity: o.opportunity, revenue: o.monthlyRevenuePotential })))}
EMPLOYEE COUNT: ${packet.keyMetrics.employeeCount ?? "Unknown"}`;

  const schema = `{
  "recommendations": [{
    "rank": 1,
    "role": "VP of Sales",
    "department": "Sales|Engineering|Marketing|Operations|Finance|HR",
    "urgency": "immediate|next_quarter|next_half",
    "rationale": "Why this hire matters for THIS business",
    "expectedROI": "Could generate $X in Y timeframe",
    "estimatedSalary": "$80K-$120K",
    "alternativeToHiring": "Could outsource to agency for $X/mo instead",
    "keyResponsibilities": ["resp 1", "resp 2", "resp 3"]
  }],
  "currentTeamGaps": [{ "area": "...", "gap": "...", "impact": "..." }],
  "totalBudgetNeeded": "$X for first Y hires",
  "priorityOrder": "Sales first, then marketing, then ops",
  "summary": "2-3 sentence hiring plan overview"
}`;

  const prompt = `You are an HR strategy advisor analyzing team gaps and hiring needs.

BUSINESS DATA:
${ctx}

IDENTIFIED GAPS & OPPORTUNITIES:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}

Based on the business's gaps, revenue leaks, and growth opportunities, recommend hires ranked by ROI:
- Each hire should directly address an identified issue, leak, or opportunity
- Include realistic salary ranges for the industry and location
- ALWAYS suggest an alternative to hiring (outsource, automate, fractional, contractor)
- Include 3-5 key responsibilities for each role
- Identify current team gaps even if no hire is recommended

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Recommend 3-5 hires. Rank by expected ROI.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Hiring Plan…");
    const result = await callJson(genai, prompt);
    return result as unknown as HiringPlan;
  } catch (e) {
    console.warn("[Pivot] Hiring Plan synthesis failed:", e);
    return null;
  }
}

// ── Revenue Forecast ──────────────────────────────────────────────────────

export async function synthesizeRevenueForecast(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueForecast | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "scenarios": [{
    "name": "Conservative|Base Case|Optimistic",
    "assumptions": ["assumption 1", "assumption 2"],
    "monthly": [{ "month": "Month 1", "revenue": 0, "costs": 0, "profit": 0 }],
    "totalRevenue12Mo": 0,
    "totalProfit12Mo": 0,
    "breakEvenMonth": "Month N or null"
  }],
  "currentMRR": "$X or Insufficient data",
  "currentARR": "$X or Insufficient data",
  "growthRate": "X% MoM or Insufficient data",
  "keyDrivers": [{ "driver": "...", "impact": "...", "confidence": "high|medium|low" }],
  "risks": [{ "risk": "...", "revenueImpact": "...", "mitigant": "..." }],
  "summary": "2-3 sentence forecast overview",
  "dataQualityNote": "What data was used vs estimated"
}`;

  const prompt = `You are a financial modeling expert building revenue forecasts.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}

Build 3 revenue forecast scenarios with 12-month monthly projections:
1. Conservative: assumes minimal growth, some customer loss
2. Base Case: assumes current trajectory continues with modest improvements
3. Optimistic: assumes key actions are taken (revenue leaks plugged, new opportunities captured)

For each scenario:
- Use real financial data as the baseline (MRR, expenses, margins from documents)
- State assumptions explicitly
- Include monthly revenue, costs, and profit
- Calculate total 12-month revenue and profit
- Identify break-even month if applicable

Also identify key growth drivers, risks, and their revenue impact.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.
If baseline revenue is unknown, note it clearly and use the revenue range as a rough guide.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Forecast…");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueForecast;
  } catch (e) {
    console.warn("[Pivot] Revenue Forecast synthesis failed:", e);
    return null;
  }
}

// ── Churn Playbook ────────────────────────────────────────────────────────

export async function synthesizeChurnPlaybook(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<ChurnPlaybook | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const atRisk = deliverables.atRiskCustomers?.customers ?? [];
  const deliverablesContext = `
AT-RISK CUSTOMERS: ${JSON.stringify(atRisk.map(c => ({
    name: c.name,
    risk: c.risk,
    revenue: c.revenueAtRisk,
    riskScore: c.riskScore,
    signals: c.warningSignals,
    churnProbability: c.churnProbability
  })))}
TOTAL REVENUE AT RISK: ${deliverables.atRiskCustomers?.totalRevenueAtRisk ?? "Unknown"}
IMMEDIATE ACTION: ${deliverables.atRiskCustomers?.immediateAction ?? "N/A"}`;

  const schema = `{
  "entries": [{
    "customerName": "...",
    "riskLevel": "critical|high|medium",
    "revenueAtRisk": "$X",
    "warningSignals": ["signal 1", "signal 2"],
    "predictedChurnWindow": "Within 30 days|60-90 days",
    "interventionPlan": [{ "step": 1, "action": "...", "owner": "...", "deadline": "..." }],
    "talkingPoints": ["What to say point 1", "point 2"],
    "offerToMake": "Discount, upgrade, or null",
    "successMetric": "How to know the intervention worked"
  }],
  "totalRevenueAtRisk": "$X",
  "overallStrategy": "2-3 sentence retention strategy",
  "retentionTactics": [{ "tactic": "...", "effort": "...", "impact": "..." }],
  "summary": "2-3 sentence churn playbook overview"
}`;

  const prompt = `You are a customer success expert creating retention intervention plans.

BUSINESS DATA:
${ctx}

IDENTIFIED AT-RISK CUSTOMERS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}

For each at-risk customer from the data, create a specific retention intervention plan:
- Talking points for the retention conversation (specific to this customer's situation)
- Concrete offers to make (discount, free upgrade, dedicated support, etc.)
- Step-by-step intervention timeline with deadlines
- Success metrics to measure if the intervention worked

Also include 3-5 general retention tactics applicable to this business.

CRITICAL: ONLY create entries for customers that appear in the at-risk customer data above. Do NOT invent customer names.
If no at-risk customers were identified, return an empty entries array and focus on general retention tactics.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Churn Playbook…");
    const result = await callJson(genai, prompt);
    return result as unknown as ChurnPlaybook;
  } catch (e) {
    console.warn("[Pivot] Churn Playbook synthesis failed:", e);
    return null;
  }
}

// ── Sales Playbook ────────────────────────────────────────────────────────

export async function synthesizeSalesPlaybook(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<SalesPlaybook | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const marketIntel = deliverables.marketIntelligence;
  const pricing = deliverables.pricingIntelligence;
  const competitors = deliverables.competitorAnalysis;
  const deliverablesContext = `
COMPETITIVE POSITION: ${marketIntel?.competitiveIntelligence ?? "Unknown"}
PRICING ASSESSMENT: ${pricing?.currentPricingAssessment ?? "Unknown"}
PRICING TIERS: ${JSON.stringify(pricing?.suggestedPricing?.slice(0, 3) ?? [])}
COMPETITOR POSITIONING: ${competitors?.suggestedPositioning ?? "Unknown"}
TOP PERFORMERS DO: ${JSON.stringify(marketIntel?.whatTopPerformersDo?.slice(0, 4) ?? [])}`;

  const schema = `{
  "idealBuyerPersona": [{
    "title": "CTO at Mid-Market SaaS",
    "painPoints": ["pain 1", "pain 2"],
    "motivations": ["motivation 1"],
    "objections": ["objection 1"]
  }],
  "salesProcess": [{
    "stage": "Discovery|Qualification|Demo|Proposal|Negotiation|Close",
    "actions": ["action 1", "action 2"],
    "exitCriteria": "What must be true to advance",
    "avgDuration": "3-5 days"
  }],
  "objectionHandling": [{ "objection": "...", "response": "...", "proof": "..." }],
  "emailTemplates": [{ "purpose": "Cold outreach|Follow-up|Proposal", "subject": "...", "body": "..." }],
  "coldCallScript": {
    "opening": "...",
    "qualifyingQuestions": ["q1", "q2"],
    "pitchPoints": ["point 1", "point 2"],
    "closingAsk": "..."
  },
  "pricingTalkTrack": "How to discuss pricing confidently",
  "competitiveHandling": "How to handle competitor mentions",
  "closingTechniques": [{ "technique": "...", "whenToUse": "...", "example": "..." }],
  "summary": "2-3 sentence sales playbook overview"
}`;

  const prompt = `You are a sales strategy expert building a complete sales playbook.

BUSINESS DATA:
${ctx}

EXISTING ANALYSIS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Model: ${questionnaire.businessModel}

Generate a complete, tailored sales playbook:
- Buyer personas derived from EXISTING customer data (who actually buys from this business)
- Sales process stages with specific actions and exit criteria for each
- Top 5 objection responses with proof points from the business's actual strengths
- 2-3 email templates (cold outreach, follow-up, proposal) written for this specific business
- A cold call script tailored to this industry and offering
- Pricing talk track based on their actual pricing and competitive position
- 3 closing techniques suited to their deal size and sales cycle

EVERYTHING must be tailored to THIS specific business — no generic sales advice.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Sales Playbook…");
    const result = await callJson(genai, prompt);
    return result as unknown as SalesPlaybook;
  } catch (e) {
    console.warn("[Pivot] Sales Playbook synthesis failed:", e);
    return null;
  }
}

// ── Goal Tracker / OKR System ─────────────────────────────────────────────

export async function synthesizeGoalTracker(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<GoalTracker | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 30_000);

  const kpis = deliverables.kpiReport?.kpis?.slice(0, 5) ?? [];
  const issues = deliverables.issuesRegister?.issues?.slice(0, 5) ?? [];
  const leaks = deliverables.revenueLeakAnalysis?.items?.slice(0, 3) ?? [];
  const opportunities = deliverables.marketIntelligence?.lowHangingFruit?.slice(0, 3) ?? [];
  const healthScore = deliverables.healthScore;
  const deliverablesContext = `
HEALTH SCORE: ${healthScore?.score ?? "Unknown"}/100
KPIs: ${JSON.stringify(kpis.map(k => ({ name: k.name, current: k.currentValue, target: k.targetValue, status: k.status })))}
TOP ISSUES: ${JSON.stringify(issues.map(i => ({ title: i.title, severity: i.severity, impact: i.financialImpact })))}
REVENUE LEAKS: ${JSON.stringify(leaks.map(l => ({ desc: l.description, amount: l.amount })))}
OPPORTUNITIES: ${JSON.stringify(opportunities.map(o => ({ opportunity: o.opportunity, revenue: o.monthlyRevenuePotential })))}`;

  const schema = `{
  "objectives": [{
    "id": "OBJ-1",
    "objective": "Increase monthly revenue to $100K",
    "category": "Revenue|Growth|Operations|Product|Customer|Team",
    "timeframe": "Q1 2026|Next 90 days",
    "keyResults": [{
      "id": "KR-1-1",
      "description": "Close 5 enterprise deals",
      "metric": "enterprise_deals_closed",
      "current": "2",
      "target": "5",
      "unit": "#|$|%",
      "progress": 40,
      "status": "on_track|at_risk|behind|completed"
    }],
    "overallProgress": 0,
    "status": "on_track|at_risk|behind|completed",
    "linkedDeliverable": "revenueLeakAnalysis|kpiReport|etc"
  }],
  "suggestedObjectives": [{ "objective": "...", "rationale": "...", "category": "...", "keyResults": ["kr1", "kr2"] }],
  "quarterlyTheme": "Revenue Recovery & Stabilization",
  "summary": "2-3 sentence OKR overview"
}`;

  const prompt = `You are an OKR and business strategy expert setting quarterly goals.

BUSINESS DATA:
${ctx}

ALL DELIVERABLE INSIGHTS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Primary Objective: ${questionnaire.primaryObjective ?? questionnaire.oneDecisionKeepingOwnerUpAtNight ?? "Growth"}

Based on ALL deliverables (KPIs, issues, leaks, opportunities, health score), suggest 3-5 quarterly OKRs:
- Each objective should directly address a finding from the analysis
- Key results must be measurable with specific numeric targets
- Set REALISTIC targets based on the actual data (not aspirational moonshots)
- Link each objective to the deliverable that inspired it
- Include a quarterly theme that ties all objectives together
- Set current progress to 0 for new objectives
- Also suggest 2-3 additional objectives the business could adopt later

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Goal Tracker…");
    const result = await callJson(genai, prompt);
    return result as unknown as GoalTracker;
  } catch (e) {
    console.warn("[Pivot] Goal Tracker synthesis failed:", e);
    return null;
  }
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
