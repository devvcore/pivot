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
  BenchmarkScore,
  ExecutiveSummary,
  MilestoneTracker,
  RiskRegister,
  PartnershipOpportunities,
  FundingReadiness,
  MarketSizing,
  ScenarioPlanner,
  OperationalEfficiency,
  CLVAnalysis,
  RetentionPlaybook,
  RevenueAttribution,
  BoardDeck,
  CompetitiveMoat,
  GTMScorecard,
  CashOptimization,
  TalentGapAnalysis,
  RevenueDiversification,
  CustomerJourneyMap,
  ComplianceChecklist,
  ExpansionPlaybook,
  VendorScorecard,
  ProductMarketFit,
  BrandHealth,
  PricingElasticity,
  StrategicInitiatives,
  CashConversionCycle,
  InnovationPipeline,
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

// ── Benchmark Score ───────────────────────────────────────────────────────

export async function synthesizeBenchmarkScore(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<BenchmarkScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const healthScore = deliverables.healthScore;
  const marketIntel = deliverables.marketIntelligence;
  const unitEcon = deliverables.unitEconomics;
  const deliverablesContext = `
HEALTH SCORE: ${healthScore?.score ?? "Unknown"}/100 (${healthScore?.grade ?? "?"})
DIMENSIONS: ${JSON.stringify(healthScore?.dimensions?.map(d => ({ name: d.name, score: d.score })) ?? [])}
INDUSTRY BENCHMARKS: ${JSON.stringify(marketIntel?.benchmarks?.slice(0, 5) ?? [])}
UNIT ECONOMICS: CAC=${unitEcon?.cac?.value ?? "Unknown"}, LTV=${unitEcon?.ltv?.value ?? "Unknown"}, Gross Margin=${unitEcon?.grossMargin?.value ?? "Unknown"}
INDUSTRY: ${marketIntel?.industry ?? questionnaire.industry}
INDUSTRY CONTEXT: ${marketIntel?.industryContext ?? "N/A"}`;

  const schema = `{
  "overallScore": <integer 0-100>,
  "overallPercentile": "<e.g. Top 25%, Average, Bottom 30%>",
  "dimensions": [
    {
      "name": "<Revenue Growth | Profit Margin | Customer Retention | Operational Efficiency | Market Position | Team & Culture>",
      "score": <0-100>,
      "industryAvg": <0-100>,
      "percentile": "<Top 10% | Top 25% | Average | Below Average | Bottom 25%>",
      "insight": "<1-2 sentences: what this score means and why>"
    }
  ],
  "topStrength": "<the single strongest area vs industry — name and explain>",
  "biggestGap": "<the single biggest gap vs industry — name and explain>",
  "industryContext": "<2-3 sentences: how this industry is performing overall and where the benchmarks come from>",
  "recommendations": [
    {
      "area": "<dimension name>",
      "current": "<current state/score>",
      "target": "<target state/score>",
      "action": "<specific action to close the gap>"
    }
  ],
  "summary": "<2-3 sentence benchmark overview>"
}`;

  const prompt = `You are an industry benchmarking expert comparing a specific business against industry averages.

BUSINESS DATA:
${ctx}

EXISTING ANALYSIS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}

Create a comprehensive benchmark scorecard comparing this business against industry averages across 6 key dimensions:
1. Revenue Growth — compare growth rate vs industry median
2. Profit Margin — gross and net margin vs peers
3. Customer Retention — churn rate, repeat business vs industry
4. Operational Efficiency — revenue per employee, cost ratios
5. Market Position — competitive standing, market share indicators
6. Team & Culture — team utilization, hiring velocity, talent indicators

For each dimension:
- Score the business 0-100 based on available data
- Set an industry average score (0-100) based on your knowledge of the industry
- Determine their percentile ranking
- Provide a specific insight tied to their actual data

ANTI-HALLUCINATION RULES:
- Use ONLY data from the VERIFIED FINANCIAL FACTS and uploaded documents for the business scores.
- Industry averages should come from your knowledge of the specific industry.
- If data is missing for a dimension, score conservatively (40-50) and note the data gap in the insight.
- NEVER fabricate specific numbers that aren't in the data.
- Include 3-5 recommendations, prioritized by gap size.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Benchmark Score...");
    const result = await callJson(genai, prompt);
    return result as unknown as BenchmarkScore;
  } catch (e) {
    console.warn("[Pivot] Benchmark Score synthesis failed:", e);
    return null;
  }
}

// ── Executive Summary ─────────────────────────────────────────────────────

export async function synthesizeExecutiveSummary(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<ExecutiveSummary | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });

  const health = deliverables.healthScore;
  const cash = deliverables.cashIntelligence;
  const leaks = deliverables.revenueLeakAnalysis;
  const issues = deliverables.issuesRegister;
  const atRisk = deliverables.atRiskCustomers;
  const actionPlan = deliverables.actionPlan;
  const marketIntel = deliverables.marketIntelligence;
  const benchmark = deliverables.benchmarkScore;

  const deliverablesContext = `
COMPANY: ${questionnaire.organizationName}
INDUSTRY: ${questionnaire.industry}
REVENUE RANGE: ${questionnaire.revenueRange}

HEALTH SCORE: ${health?.score ?? "Unknown"}/100 (Grade: ${health?.grade ?? "?"})
HEADLINE: ${health?.headline ?? "N/A"}
HEALTH SUMMARY: ${health?.summary ?? "N/A"}

CASH INTELLIGENCE: ${cash?.summary ?? "N/A"}
RUNWAY: ${cash?.runwayWeeks ?? "Unknown"} weeks
CASH POSITION: ${cash?.currentCashPosition != null ? `$${cash.currentCashPosition.toLocaleString()}` : "Unknown"}

REVENUE LEAKS: $${leaks?.totalIdentified?.toLocaleString() ?? "0"} identified
PRIORITY ACTION: ${leaks?.priorityAction ?? "N/A"}

ISSUES: ${issues?.totalIssues ?? issues?.issues?.length ?? 0} total, ${issues?.criticalCount ?? 0} critical
TOP ISSUE: ${issues?.issues?.[0]?.title ?? issues?.issues?.[0]?.description ?? "N/A"}

AT-RISK REVENUE: $${atRisk?.totalRevenueAtRisk?.toLocaleString() ?? "0"}
IMMEDIATE ACTION: ${atRisk?.immediateAction ?? "N/A"}

ACTION PLAN: ${actionPlan?.summary ?? "N/A"}

MARKET INTEL: ${marketIntel?.urgentOpportunity ?? "N/A"}

BENCHMARK: ${benchmark ? `Overall ${benchmark.overallScore}/100 (${benchmark.overallPercentile})` : "Not available"}
TOP STRENGTH: ${benchmark?.topStrength ?? "N/A"}
BIGGEST GAP: ${benchmark?.biggestGap ?? "N/A"}`;

  const schema = `{
  "subject": "<email subject line — punchy, specific, includes company name and key metric>",
  "greeting": "<professional greeting — e.g. Hi [Owner], here is your Pivot business intelligence report.>",
  "keyFindings": [
    "<finding 1 — the most important insight, with a specific number if available>",
    "<finding 2>",
    "<finding 3>",
    "<finding 4 (optional)>",
    "<finding 5 (optional)>"
  ],
  "criticalActions": [
    "<action 1 — the single most urgent thing to do this week>",
    "<action 2 — second priority>",
    "<action 3 — third priority>"
  ],
  "financialSummary": "<2-3 sentences: the financial picture — cash position, revenue leaks, risk exposure>",
  "outlook": "<one phrase: e.g. cautiously optimistic, urgent attention needed, strong momentum, critical crossroads>",
  "fullSummary": "<2-3 paragraphs: comprehensive summary suitable for an executive email — covers health, risks, opportunities, and recommended path forward>"
}`;

  const prompt = `You are a senior business advisor writing a concise executive summary email for a business owner.

ALL ANALYSIS RESULTS:
${deliverablesContext}

Distill the ENTIRE business analysis into a concise, email-ready executive summary. This should be:
- Professional but direct — no fluff
- Specific to THIS business with actual numbers from the analysis
- Actionable — the owner should know exactly what to do after reading this
- Balanced — acknowledge strengths before addressing weaknesses

The subject line should be compelling enough to open (include the company name and a key metric).
The greeting should be professional and warm.
Key findings should be the 3-5 most impactful discoveries from the entire analysis.
Critical actions should be the top 3 things to do THIS WEEK.
The financial summary should paint the cash/revenue picture in 2-3 sentences.
The outlook should be a single honest phrase capturing the overall trajectory.
The full summary should be 2-3 paragraphs covering: current state, key risks/opportunities, and recommended path forward.

ANTI-HALLUCINATION RULES:
- Use ONLY numbers and facts from the analysis results above.
- Do NOT invent specific dollar amounts, customer names, or metrics not present in the data.
- If a metric is "Unknown" or "N/A", do not reference it as if it were known.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Executive Summary...");
    const result = await callJson(genai, prompt);
    return result as unknown as ExecutiveSummary;
  } catch (e) {
    console.warn("[Pivot] Executive Summary synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Milestone Tracker ─────────────────────────────────────────────

export async function synthesizeMilestoneTracker(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MilestoneTracker | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "milestones": [{
    "title": "...",
    "description": "...",
    "targetDate": "YYYY-MM-DD",
    "status": "not_started|in_progress|completed|at_risk|blocked",
    "category": "revenue|product|team|funding|market|operations",
    "impact": "...",
    "dependencies": ["..."],
    "owner": "..."
  }],
  "nextMilestone": "title of the most immediate upcoming milestone",
  "completionRate": 0,
  "criticalPath": ["milestone title 1", "milestone title 2", "..."],
  "timeline": "overview of the 6-12 month timeline",
  "summary": "2-3 sentence milestone overview"
}`;

  const prompt = `You are a strategic business planner creating a milestone tracker.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Key Concern: ${questionnaire.keyConcerns}

Based on the business data, create a realistic 6-12 month milestone roadmap with 8-12 milestones:
- Revenue milestones: specific revenue targets, new customer acquisition goals, deal closures
- Product milestones: feature launches, product improvements, tech debt resolution
- Team milestones: key hires, training, organizational changes
- Funding milestones: fundraising rounds, profitability targets, cash flow goals
- Market milestones: market expansion, partnership launches, competitive positioning
- Operations milestones: process improvements, tool implementations, efficiency gains

For each milestone:
- Set a realistic target date based on the business's current state and resources
- Identify dependencies (what must happen first)
- Assess current status based on evidence in the data
- Describe the business impact in dollar terms where possible
- Assign a logical owner role

Identify the critical path — the sequence of milestones that determines the overall timeline.
Set completionRate to the percentage of milestones already completed or in progress (0-100).

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Milestone Tracker...");
    const result = await callJson(genai, prompt);
    return result as unknown as MilestoneTracker;
  } catch (e) {
    console.warn("[Pivot] Milestone Tracker synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Risk Register ─────────────────────────────────────────────────

export async function synthesizeRiskRegister(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RiskRegister | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "risks": [{
    "risk": "description of the risk",
    "category": "financial|operational|market|legal|technology|team",
    "likelihood": 1,
    "impact": 1,
    "riskScore": 1,
    "status": "open|mitigating|accepted|closed",
    "mitigation": "specific mitigation action",
    "owner": "role responsible",
    "timeline": "when mitigation should be complete"
  }],
  "overallRiskLevel": "low|moderate|high|critical",
  "topRisks": ["risk 1 title", "risk 2 title", "risk 3 title"],
  "mitigationBudget": "$X estimated budget for risk mitigation",
  "summary": "2-3 sentence risk overview"
}`;

  const prompt = `You are a risk management specialist building a comprehensive risk register.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns}

Identify and assess 8-15 business risks across all categories:

FINANCIAL RISKS: cash flow shortfalls, revenue concentration, pricing pressure, cost overruns, funding gaps
OPERATIONAL RISKS: key person dependency, process failures, supply chain, capacity constraints
MARKET RISKS: competitive threats, market shifts, regulatory changes, demand fluctuations
LEGAL RISKS: compliance gaps, IP exposure, contract risks, liability
TECHNOLOGY RISKS: technical debt, security vulnerabilities, platform dependencies, scalability
TEAM RISKS: talent retention, skill gaps, succession planning, culture issues

For each risk:
- Rate likelihood 1-5 (1=rare, 5=almost certain) based on evidence in the data
- Rate impact 1-5 (1=negligible, 5=catastrophic) based on financial and operational consequences
- Calculate riskScore = likelihood × impact
- Propose a specific, actionable mitigation strategy
- Assign an owner role and timeline for mitigation

Sort risks by riskScore descending. Set overallRiskLevel based on the distribution of risk scores.
Estimate a mitigation budget based on the actions required.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Risk Register...");
    const result = await callJson(genai, prompt);
    return result as unknown as RiskRegister;
  } catch (e) {
    console.warn("[Pivot] Risk Register synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Partnership Opportunities ─────────────────────────────────────

export async function synthesizePartnershipOpportunities(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PartnershipOpportunities | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "partners": [{
    "name": "partner company or type description",
    "type": "technology|distribution|strategic|content|referral",
    "synergy": "how this partnership creates mutual value",
    "revenueImpact": "$X estimated annual revenue impact",
    "approachStrategy": "specific steps to initiate the partnership",
    "priority": "high|medium|low",
    "contactSuggestion": "suggested outreach approach"
  }],
  "partnershipStrategy": "overall partnership strategy in 2-3 sentences",
  "quickWins": ["partnership 1 that can close in 30 days", "..."],
  "longTermPlays": ["strategic partnership 1 that takes 6+ months", "..."],
  "summary": "2-3 sentence partnership overview"
}`;

  const prompt = `You are a business development strategist identifying partnership opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Customers: ${questionnaire.keyCustomers ?? "Unknown"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Unknown"}

Identify 6-10 high-value partnership opportunities across these categories:

TECHNOLOGY PARTNERS: platforms, tools, or tech companies whose integration would enhance the product/service
DISTRIBUTION PARTNERS: companies with access to the target customer base who could resell or co-sell
STRATEGIC PARTNERS: larger companies where a formal alliance creates competitive advantage
CONTENT PARTNERS: thought leaders, media, or content creators who amplify brand reach
REFERRAL PARTNERS: complementary service providers who serve the same customers

For each potential partner:
- Be specific about the partner type (if a specific company name is evident from the data, use it; otherwise describe the ideal partner profile)
- Quantify the revenue impact based on realistic assumptions from the data
- Outline a concrete approach strategy with 3-5 steps
- Rate priority based on ease of execution and expected ROI

Separate into quick wins (closable in 30 days) and long-term strategic plays (6+ months).
Create an overarching partnership strategy that aligns with the business's goals.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Partnership Opportunities...");
    const result = await callJson(genai, prompt);
    return result as unknown as PartnershipOpportunities;
  } catch (e) {
    console.warn("[Pivot] Partnership Opportunities synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Funding Readiness ─────────────────────────────────────────────

export async function synthesizeFundingReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire,
  deliverables: MVPDeliverables
): Promise<FundingReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 35_000);

  const health = deliverables.healthScore;
  const cash = deliverables.cashIntelligence;
  const leaks = deliverables.revenueLeakAnalysis;
  const unitEcon = deliverables.unitEconomics;
  const marketIntel = deliverables.marketIntelligence;
  const deliverablesContext = `
HEALTH SCORE: ${health?.score ?? "Unknown"}/100 (Grade: ${health?.grade ?? "?"})
CASH POSITION: ${cash?.currentCashPosition != null ? `$${cash.currentCashPosition.toLocaleString()}` : "Unknown"}
RUNWAY: ${cash?.runwayWeeks ?? "Unknown"} weeks
REVENUE LEAKS: $${leaks?.totalIdentified?.toLocaleString() ?? "0"} identified
UNIT ECONOMICS: LTV/CAC = ${unitEcon?.ltvCacRatio?.value ?? "Unknown"}, Gross Margin = ${unitEcon?.grossMargin?.value ?? "Unknown"}
MARKET CONTEXT: ${marketIntel?.industryContext ?? "Unknown"}
URGENT OPPORTUNITY: ${marketIntel?.urgentOpportunity ?? "N/A"}`;

  const schema = `{
  "overallScore": 0,
  "grade": "A|B|C|D|F",
  "readinessLevel": "Seed Ready|Series A Ready|Series B Ready|Not Yet Ready|Bootstrap Optimal",
  "strengths": ["strength 1", "strength 2", "..."],
  "gaps": [{ "area": "...", "current": "...", "needed": "...", "action": "..." }],
  "suggestedRaise": "$X — rationale",
  "valuationRange": "$Xm - $Ym based on methodology",
  "investorTypes": ["Angel", "Seed VC", "Growth PE", "..."],
  "pitchReadiness": [{ "section": "Problem", "score": 0, "feedback": "..." }],
  "nextSteps": ["step 1", "step 2", "..."],
  "summary": "2-3 sentence funding readiness overview"
}`;

  const prompt = `You are a fundraising advisor assessing investor readiness.

BUSINESS DATA:
${ctx}

EXISTING ANALYSIS:
${deliverablesContext}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}

Perform a comprehensive funding readiness assessment:

1. OVERALL SCORE (0-100): Rate the business's readiness to raise capital based on all available metrics.
   Grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

2. READINESS LEVEL: Determine the appropriate funding stage:
   - Not Yet Ready: significant gaps that would deter investors
   - Seed Ready: has product/market fit signals, early traction
   - Series A Ready: proven unit economics, scalable model, growth metrics
   - Series B Ready: strong revenue growth, clear path to profitability
   - Bootstrap Optimal: business is better suited to bootstrapping (explain why)

3. STRENGTHS: What makes this business investable? (3-5 specific strengths with data)

4. GAPS: What needs improvement before fundraising? For each gap:
   - Current state (with evidence from data)
   - What investors expect
   - Specific action to close the gap

5. SUGGESTED RAISE: Based on the business stage, burn rate, and growth needs, suggest an amount and rationale.

6. VALUATION RANGE: Estimate based on revenue multiples, comparable companies, and growth rate.

7. INVESTOR TYPES: Which types of investors are the best fit?

8. PITCH READINESS: Score each standard pitch section (Problem, Solution, Market, Traction, Team, Financials, Ask) 0-100.

9. NEXT STEPS: 5-7 specific actions to improve funding readiness.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Funding Readiness...");
    const result = await callJson(genai, prompt);
    return result as unknown as FundingReadiness;
  } catch (e) {
    console.warn("[Pivot] Funding Readiness synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Market Sizing (TAM/SAM/SOM) ──────────────────────────────────

export async function synthesizeMarketSizing(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketSizing | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "tam": {
    "value": "$X billion/million",
    "methodology": "how TAM was calculated",
    "sources": ["source 1", "source 2"]
  },
  "sam": {
    "value": "$X billion/million",
    "methodology": "how SAM was derived from TAM",
    "filters": ["geographic filter", "segment filter", "..."]
  },
  "som": {
    "value": "$X million",
    "methodology": "how SOM was derived — realistic capture based on current resources",
    "assumptions": ["assumption 1", "assumption 2", "..."]
  },
  "growthRate": "X% CAGR with timeframe and basis",
  "marketTrends": ["trend 1", "trend 2", "..."],
  "entryBarriers": ["barrier 1", "barrier 2", "..."],
  "competitiveIntensity": "low|moderate|high|very_high — with explanation",
  "summary": "2-3 sentence market sizing overview"
}`;

  const prompt = `You are a market research analyst performing TAM/SAM/SOM analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Unknown"}
Key Customers: ${questionnaire.keyCustomers ?? "Unknown"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Unknown"}

Perform a rigorous market sizing analysis:

TAM (Total Addressable Market):
- Calculate the total global market for this business's product/service category
- Use a top-down approach based on industry size and growth data
- Cite methodology and data sources explicitly

SAM (Serviceable Addressable Market):
- Narrow TAM by geographic reach, customer segments, and business model constraints
- List each filter applied and its impact on the number

SOM (Serviceable Obtainable Market):
- Calculate the realistic market share this business can capture in the next 2-3 years
- Base it on current revenue, growth rate, competitive position, and resources
- List every assumption made

Also analyze:
- Market growth rate (CAGR) with supporting context
- 4-6 key market trends affecting this business
- 3-5 entry barriers (for this business and potential competitors)
- Competitive intensity assessment with rationale

ANTI-HALLUCINATION RULES:
- Use ONLY data from the business report for company-specific numbers.
- For market size estimates, clearly state these are estimates based on industry knowledge.
- If data is insufficient, say "Insufficient data" — do NOT invent numbers.
- Distinguish between facts from documents and industry estimates.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Sizing...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketSizing;
  } catch (e) {
    console.warn("[Pivot] Market Sizing synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Scenario Planner ──────────────────────────────────────────────

export async function synthesizeScenarioPlanner(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ScenarioPlanner | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "scenarios": [{
    "name": "scenario name",
    "description": "what happens in this scenario",
    "probability": "X% likelihood",
    "revenueImpact": "+/- $X or X%",
    "costImpact": "+/- $X or X%",
    "netOutcome": "net financial outcome",
    "triggers": ["event that triggers this scenario", "..."],
    "actions": ["recommended action if this scenario unfolds", "..."],
    "timeline": "when this scenario could materialize"
  }],
  "baseCase": "description of the most likely outcome",
  "bestCase": "description of the optimistic outcome",
  "worstCase": "description of the pessimistic outcome",
  "recommendedStrategy": "which strategy to pursue given the scenario analysis",
  "contingencyPlans": ["contingency 1", "contingency 2", "..."],
  "summary": "2-3 sentence scenario planning overview"
}`;

  const prompt = `You are a strategic planning consultant building business scenarios.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns}
Critical Decision: ${questionnaire.oneDecisionKeepingOwnerUpAtNight}

Create 4-6 distinct business scenarios for the next 12-18 months:

1. BASE CASE (most likely, ~50-60% probability):
   - Project the business's trajectory assuming current trends continue
   - Account for known risks and opportunities in the data

2. BEST CASE (optimistic, ~15-25% probability):
   - What happens if key opportunities are captured and risks are mitigated
   - Quantify the upside in revenue and profitability

3. WORST CASE (pessimistic, ~10-20% probability):
   - What happens if key risks materialize and opportunities are missed
   - Quantify the downside — cash impact, revenue loss, team impact

4-6. SPECIFIC SCENARIOS based on the business's unique situation:
   - A scenario tied to the owner's key decision/concern
   - A scenario tied to market or competitive shifts
   - A scenario tied to a growth opportunity or pivot

For EACH scenario:
- Assign a realistic probability that sums to approximately 100% across all scenarios
- Quantify revenue and cost impact using data from the documents
- Identify specific trigger events that signal this scenario is unfolding
- Recommend 3-5 concrete actions to take if the scenario materializes
- Specify the timeline for when this scenario would play out

Provide an overall recommended strategy and 3-5 contingency plans.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Scenario Planner...");
    const result = await callJson(genai, prompt);
    return result as unknown as ScenarioPlanner;
  } catch (e) {
    console.warn("[Pivot] Scenario Planner synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: Operational Efficiency ────────────────────────────────────────

export async function synthesizeOperationalEfficiency(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<OperationalEfficiency | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "overallScore": 0,
  "metrics": [{
    "process": "name of the business process",
    "currentScore": 0,
    "industryBenchmark": 0,
    "gap": 0,
    "improvement": "specific improvement recommendation",
    "estimatedSavings": "$X per year",
    "effort": "low|medium|high",
    "priority": 1
  }],
  "quickWins": ["quick win 1 — implementable in < 2 weeks", "..."],
  "majorInitiatives": ["initiative 1 — 1-3 month project", "..."],
  "estimatedTotalSavings": "$X per year across all improvements",
  "summary": "2-3 sentence operational efficiency overview"
}`;

  const prompt = `You are an operations consultant analyzing business efficiency.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Tech Stack: ${questionnaire.techStack ?? "Unknown"}

Perform a comprehensive operational efficiency audit across these dimensions:

1. SALES PROCESS: Lead-to-close cycle, conversion rates, pipeline management
2. CUSTOMER ONBOARDING: Time-to-value, onboarding completion, early churn indicators
3. SERVICE DELIVERY: Fulfillment speed, quality metrics, error rates
4. FINANCIAL OPERATIONS: Invoicing, collections, cash conversion cycle
5. TEAM PRODUCTIVITY: Revenue per employee, utilization rates, meeting overhead
6. TECHNOLOGY UTILIZATION: Tool ROI, automation level, integration efficiency
7. CUSTOMER SUPPORT: Response time, resolution rate, escalation frequency
8. MARKETING EFFICIENCY: CAC efficiency, channel ROI, content production rate

For each process:
- Score the business 0-100 based on evidence in the data
- Set an industry benchmark score (0-100) based on the specific industry
- Calculate the gap (benchmark - currentScore)
- Recommend a specific improvement tied to their actual operations
- Estimate annual savings in dollars based on the business's revenue scale
- Rate implementation effort (low/medium/high)
- Assign priority rank (1 = highest priority, based on savings-to-effort ratio)

Separate improvements into quick wins (< 2 weeks, low effort) and major initiatives (1-3 months).
Calculate total estimated annual savings across all recommended improvements.

Use ONLY data from the business report. If data is insufficient for a specific number, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Operational Efficiency...");
    const result = await callJson(genai, prompt);
    return result as unknown as OperationalEfficiency;
  } catch (e) {
    console.warn("[Pivot] Operational Efficiency synthesis failed:", e);
    return null;
  }
}

// ── Wave 4: CLV Analysis ─────────────────────────────────────────────────

export async function synthesizeCLVAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CLVAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "overallCLV": "$X average customer lifetime value",
  "overallCACRatio": 0,
  "segments": [{
    "segment": "segment name",
    "avgCLV": "$X",
    "acquisitionCost": "$X",
    "clvCacRatio": 0,
    "retentionRate": "X%",
    "avgLifespan": "X months/years",
    "revenueContribution": "X% of total revenue"
  }],
  "highValueDrivers": ["driver 1 that increases CLV", "..."],
  "churnRiskFactors": ["factor 1 that decreases CLV", "..."],
  "optimizationStrategies": ["strategy 1 to improve CLV", "..."],
  "projectedImpact": "$X additional lifetime value if strategies are implemented",
  "summary": "2-3 sentence CLV analysis overview"
}`;

  const prompt = `You are a customer analytics specialist performing Customer Lifetime Value analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Customers: ${questionnaire.keyCustomers ?? "Unknown"}

Perform a detailed Customer Lifetime Value (CLV) analysis:

1. OVERALL CLV: Calculate the average customer lifetime value using available data:
   - CLV = (Average Revenue per Customer × Gross Margin) × Average Customer Lifespan
   - If exact figures aren't available, estimate based on revenue range and customer count
   - Calculate overall CLV:CAC ratio

2. SEGMENT ANALYSIS: Break CLV down by 3-5 customer segments:
   - Enterprise / Mid-Market / SMB / Startup (or industry-appropriate segments)
   - For each segment calculate: average CLV, acquisition cost, CLV:CAC ratio, retention rate, average lifespan
   - Identify which segments drive the most revenue vs. the best unit economics

3. HIGH-VALUE DRIVERS: What behaviors or characteristics correlate with higher CLV?
   - Product usage patterns, engagement frequency, expansion triggers
   - Customer profile characteristics (size, industry, use case)

4. CHURN RISK FACTORS: What reduces CLV?
   - Early warning signs from the data
   - Common churn triggers for this business type

5. OPTIMIZATION STRATEGIES: 4-6 specific strategies to increase CLV:
   - Upsell/cross-sell opportunities with dollar estimates
   - Retention improvements with impact on average lifespan
   - Pricing optimization based on willingness-to-pay signals
   - Customer success interventions

6. PROJECTED IMPACT: Estimate the total additional lifetime value if the top strategies are implemented.

ANTI-HALLUCINATION RULES:
- Use ONLY data from the business report for company-specific numbers.
- Flag all estimates clearly — distinguish between document-derived facts and projections.
- If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating CLV Analysis...");
    const result = await callJson(genai, prompt);
    return result as unknown as CLVAnalysis;
  } catch (e) {
    console.warn("[Pivot] CLV Analysis synthesis failed:", e);
    return null;
  }
}

// ── Wave 5: Retention Playbook ─────────────────────────────────────────────

export async function synthesizeRetentionPlaybook(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RetentionPlaybook | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "overallRetentionRate": "X% estimated overall retention rate",
  "strategies": [{
    "segment": "customer segment name",
    "engagementScore": 0,
    "churnRisk": "low|medium|high",
    "triggers": ["trigger event 1", "..."],
    "interventions": ["intervention action 1", "..."],
    "expectedImpact": "description of expected retention improvement",
    "timeline": "implementation timeline"
  }],
  "quickWins": ["quick win 1", "quick win 2", "..."],
  "longTermInitiatives": ["long term initiative 1", "..."],
  "engagementMetrics": [{
    "metric": "metric name",
    "current": "current value",
    "target": "target value",
    "gap": "description of the gap"
  }],
  "summary": "2-3 sentence retention playbook overview"
}`;

  const prompt = `You are a customer retention strategist building a comprehensive retention playbook.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Customers: ${questionnaire.keyCustomers ?? "Unknown"}
Key Concern: ${questionnaire.keyConcerns}

Build a detailed retention playbook with the following:

1. OVERALL RETENTION RATE: Estimate the current retention rate based on available data.

2. SEGMENT STRATEGIES (4-6 segments): For each customer segment:
   - Assign an engagement score (0-100) based on available signals
   - Classify churn risk as low, medium, or high
   - Identify 2-3 specific churn triggers (events that precede churn)
   - Recommend 2-3 interventions to prevent churn
   - Estimate the expected impact on retention
   - Provide a realistic implementation timeline

3. QUICK WINS: 3-5 retention actions that can be implemented within 30 days with minimal effort.

4. LONG-TERM INITIATIVES: 3-5 strategic retention programs that require 3-6 months to implement.

5. ENGAGEMENT METRICS: 4-6 key engagement metrics to track, with current values (from data),
   target values, and the gap between them.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Retention Playbook...");
    const result = await callJson(genai, prompt);
    return result as unknown as RetentionPlaybook;
  } catch (e) {
    console.warn("[Pivot] Retention Playbook synthesis failed:", e);
    return null;
  }
}

// ── Wave 5: Revenue Attribution ────────────────────────────────────────────

export async function synthesizeRevenueAttribution(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueAttribution | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "channels": [{
    "channel": "channel name",
    "contribution": 0,
    "revenue": "$X",
    "cost": "$X",
    "roi": "X%",
    "trend": "growing|stable|declining"
  }],
  "topPerformer": "name of the highest ROI channel",
  "underperformer": "name of the lowest ROI channel",
  "recommendations": ["recommendation 1", "recommendation 2", "..."],
  "attributionModel": "description of the attribution model used",
  "summary": "2-3 sentence revenue attribution overview"
}`;

  const prompt = `You are a revenue analytics expert performing multi-channel revenue attribution analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}

Perform a detailed revenue attribution analysis:

1. CHANNEL BREAKDOWN: Identify 5-8 revenue channels/sources and for each:
   - Estimate the percentage contribution to total revenue
   - Estimate the revenue attributed to this channel
   - Estimate the cost of acquisition/operation for this channel
   - Calculate or estimate the ROI
   - Classify the trend as growing, stable, or declining

2. TOP PERFORMER: Identify the single channel delivering the best ROI and explain why.

3. UNDERPERFORMER: Identify the channel with the worst ROI or most wasted spend.

4. RECOMMENDATIONS: Provide 4-6 specific recommendations to optimize the revenue mix:
   - Which channels to double down on and why
   - Which channels to reduce investment in
   - New channels to explore based on industry benchmarks
   - Budget reallocation suggestions with expected revenue impact

5. ATTRIBUTION MODEL: Describe which attribution model best fits this business
   (first-touch, last-touch, linear, time-decay, data-driven) and why.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Attribution...");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueAttribution;
  } catch (e) {
    console.warn("[Pivot] Revenue Attribution synthesis failed:", e);
    return null;
  }
}

// ── Wave 5: Board Deck ────────────────────────────────────────────────────

export async function synthesizeBoardDeck(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<BoardDeck | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "period": "reporting period (e.g., Q1 2025)",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "financialOverview": [{
    "metric": "metric name",
    "value": "$X or X%",
    "change": "+X% or -X% vs prior period",
    "status": "up|down|flat"
  }],
  "keyMetrics": [{
    "name": "metric name",
    "value": "current value",
    "target": "target value",
    "status": "on_track|at_risk|behind"
  }],
  "strategicUpdates": ["update 1", "update 2", "..."],
  "risksAndChallenges": ["risk 1", "risk 2", "..."],
  "askAndNextSteps": ["ask or next step 1", "..."],
  "summary": "2-3 sentence board-ready overview"
}`;

  const prompt = `You are a CFO preparing a board-ready quarterly deck summary for investors and board members.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Key Concern: ${questionnaire.keyConcerns}

Create a concise, board-ready deck summary:

1. PERIOD: Identify the most recent reporting period from the data.

2. HIGHLIGHTS: 3-5 key wins or achievements to lead the board meeting with.

3. FINANCIAL OVERVIEW: 5-8 key financial metrics with:
   - Current value
   - Change vs. prior period (use data if available, otherwise estimate direction)
   - Status indicator (up/down/flat)

4. KEY METRICS: 5-7 operational KPIs with current value, target, and status:
   - on_track: within 10% of target
   - at_risk: 10-25% off target
   - behind: more than 25% off target

5. STRATEGIC UPDATES: 3-5 strategic initiatives and their progress.

6. RISKS AND CHALLENGES: 3-5 risks or challenges the board needs to be aware of.

7. ASK AND NEXT STEPS: 2-4 specific asks of the board or next steps requiring approval.

Tone: Concise, data-driven, executive-level. No fluff.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Board Deck...");
    const result = await callJson(genai, prompt);
    return result as unknown as BoardDeck;
  } catch (e) {
    console.warn("[Pivot] Board Deck synthesis failed:", e);
    return null;
  }
}

// ── Wave 5: Competitive Moat ──────────────────────────────────────────────

export async function synthesizeCompetitiveMoat(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CompetitiveMoat | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "overallMoatScore": 0,
  "moatType": "primary moat type (e.g., Network Effects, Switching Costs, Brand, Scale, IP, Data)",
  "dimensions": [{
    "dimension": "moat dimension name",
    "score": 0,
    "description": "assessment of this dimension",
    "threats": ["threat 1", "..."],
    "reinforcements": ["action to strengthen this dimension", "..."]
  }],
  "vulnerabilities": ["vulnerability 1", "vulnerability 2", "..."],
  "recommendations": ["recommendation 1", "recommendation 2", "..."],
  "competitorComparison": "brief comparison of moat strength vs. key competitors",
  "summary": "2-3 sentence competitive moat overview"
}`;

  const prompt = `You are a competitive strategy expert analyzing the business's competitive moat.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Competitors: ${questionnaire.keyCompetitors ?? "Unknown"}

Perform a comprehensive competitive moat analysis:

1. OVERALL MOAT SCORE (0-100): Rate the overall strength of the competitive moat.

2. MOAT TYPE: Identify the primary moat type:
   - Network Effects, Switching Costs, Brand/Reputation, Scale Economies,
     Intellectual Property, Data Advantages, Regulatory/Licensing, or a combination.

3. DIMENSIONS (5-7 dimensions): Evaluate each moat dimension:
   - Score each 0-10
   - Describe the current state with evidence from the data
   - Identify 2-3 threats that could erode this dimension
   - Recommend 2-3 actions to reinforce/strengthen it

   Dimensions to evaluate:
   - Brand & Reputation
   - Customer Lock-in / Switching Costs
   - Network Effects (if applicable)
   - Technology / IP Advantage
   - Data & Learning Advantages
   - Scale / Cost Advantages
   - Talent & Culture Moat

4. VULNERABILITIES: 3-5 specific vulnerabilities where the moat is weakest.

5. RECOMMENDATIONS: 4-6 high-impact actions to deepen the moat, ranked by priority.

6. COMPETITOR COMPARISON: Brief comparison of moat strength vs. known competitors.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Competitive Moat...");
    const result = await callJson(genai, prompt);
    return result as unknown as CompetitiveMoat;
  } catch (e) {
    console.warn("[Pivot] Competitive Moat synthesis failed:", e);
    return null;
  }
}

// ── Wave 5: GTM Scorecard ─────────────────────────────────────────────────

export async function synthesizeGTMScorecard(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<GTMScorecard | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "overallScore": 0,
  "grade": "A|B|C|D|F",
  "dimensions": [{
    "dimension": "GTM dimension name",
    "score": 0,
    "status": "strong|developing|weak",
    "insights": ["insight 1", "..."],
    "actions": ["action 1", "..."]
  }],
  "topStrength": "single strongest GTM dimension",
  "biggestGap": "single weakest GTM dimension needing most attention",
  "prioritizedActions": ["action 1 (highest priority)", "action 2", "..."],
  "summary": "2-3 sentence GTM scorecard overview"
}`;

  const prompt = `You are a go-to-market strategy expert evaluating the business's GTM effectiveness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Target Customers: ${questionnaire.keyCustomers ?? "Unknown"}

Evaluate the go-to-market strategy across all dimensions:

1. OVERALL SCORE (0-100) and GRADE (A-F): Rate the overall GTM effectiveness.

2. DIMENSIONS (6-8 dimensions): Evaluate each with a score (0-10), status, insights, and actions:

   a. Market Positioning & Messaging
      - Clarity of value proposition, differentiation, messaging consistency
   b. Sales Efficiency
      - Sales cycle length, win rates, pipeline health, quota attainment
   c. Marketing Effectiveness
      - Lead generation quality, CAC, marketing ROI, brand awareness
   d. Product-Market Fit
      - Retention signals, NPS/CSAT, feature adoption, expansion revenue
   e. Pricing Strategy
      - Pricing model alignment, willingness to pay, competitive pricing
   f. Channel Strategy
      - Distribution effectiveness, partner ecosystem, channel mix
   g. Customer Success
      - Onboarding efficiency, time to value, expansion rate, advocacy
   h. Data & Analytics
      - GTM data infrastructure, attribution capability, forecasting accuracy

3. TOP STRENGTH: The single strongest GTM area with evidence.

4. BIGGEST GAP: The single weakest area requiring immediate attention.

5. PRIORITIZED ACTIONS: 5-7 specific actions ranked by expected revenue impact.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating GTM Scorecard...");
    const result = await callJson(genai, prompt);
    return result as unknown as GTMScorecard;
  } catch (e) {
    console.warn("[Pivot] GTM Scorecard synthesis failed:", e);
    return null;
  }
}

// ── Wave 5: Cash Optimization ─────────────────────────────────────────────

export async function synthesizeCashOptimization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CashOptimization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "currentBurnRate": "$X/month current burn rate",
  "optimizedBurnRate": "$X/month projected optimized burn rate",
  "potentialSavings": "$X/month total potential savings",
  "recommendations": [{
    "area": "expense area or category",
    "current": "$X current monthly spend",
    "optimized": "$X optimized monthly spend",
    "saving": "$X monthly saving",
    "effort": "low|medium|high",
    "priority": 1
  }],
  "quickWins": ["quick win 1 with $ impact", "..."],
  "revenueAcceleration": ["revenue acceleration strategy 1", "..."],
  "extendedRunway": "X additional months of runway gained",
  "summary": "2-3 sentence cash optimization overview"
}`;

  const prompt = `You are a fractional CFO specializing in cash flow optimization for growing businesses.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}

Perform a comprehensive cash optimization analysis:

1. CURRENT BURN RATE: Estimate the monthly cash burn from available data.

2. OPTIMIZED BURN RATE: Project what the burn rate could be after optimizations.

3. POTENTIAL SAVINGS: Total monthly savings opportunity.

4. RECOMMENDATIONS (6-10 items): For each cost optimization opportunity:
   - Identify the expense area
   - Current monthly spend (from data or estimated)
   - Optimized monthly spend after action
   - Monthly saving amount
   - Implementation effort (low/medium/high)
   - Priority ranking (1 = highest priority)

   Areas to evaluate:
   - SaaS/tool stack consolidation
   - Vendor renegotiation opportunities
   - Staffing optimization (contractors vs. full-time)
   - Infrastructure/cloud cost reduction
   - Payment terms optimization (AP/AR)
   - Marketing spend efficiency
   - Office/overhead reduction
   - Insurance and compliance costs

5. QUICK WINS: 3-5 savings actions achievable within 30 days with dollar estimates.

6. REVENUE ACCELERATION: 3-5 strategies to bring revenue forward or increase cash inflows:
   - Annual prepayment discounts
   - Faster invoicing/collections
   - Deposit or milestone-based billing
   - Price increases on underpriced services

7. EXTENDED RUNWAY: Estimate how many additional months of runway these optimizations provide.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cash Optimization...");
    const result = await callJson(genai, prompt);
    return result as unknown as CashOptimization;
  } catch (e) {
    console.warn("[Pivot] Cash Optimization synthesis failed:", e);
    return null;
  }
}

// ── Wave 6: Talent Gap Analysis ────────────────────────────────────────────

export async function synthesizeTalentGapAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TalentGapAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence talent gap analysis overview",
  "currentTeamStrengths": ["strength 1", "strength 2", "..."],
  "skillGaps": [{
    "skill": "skill name",
    "currentLevel": "none|basic|intermediate|advanced",
    "requiredLevel": "basic|intermediate|advanced|expert",
    "priority": "critical|high|medium|low",
    "recommendation": "Hire senior data engineer or Train existing team"
  }],
  "roleRecommendations": [{
    "title": "Senior Data Engineer",
    "department": "Engineering",
    "urgency": "immediate|next_quarter|next_year",
    "rationale": "why this role is needed",
    "estimatedSalaryRange": "$120K-$160K"
  }],
  "teamStructureNotes": "org design suggestions and team structure recommendations",
  "trainingRecommendations": ["training recommendation 1", "..."],
  "totalHiringBudgetEstimate": "$X total estimated hiring budget"
}`;

  const prompt = `You are a talent strategy consultant analyzing workforce needs for a growing business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}

Perform a comprehensive talent gap analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the talent landscape and key findings.

2. CURRENT TEAM STRENGTHS (3-5): Identify the team's existing strengths based on what the business has achieved,
   its model, and available data about the team composition.

3. SKILL GAPS (5-8 gaps): Analyze critical skill gaps based on the business model, growth stage, competitive
   landscape, and stated objectives. For each gap:
   - Name the specific skill (e.g., "Product Analytics", "Enterprise Sales", "DevOps")
   - Assess current level vs. required level
   - Assign priority (critical = blocking growth, high = impacting performance, medium = would improve outcomes, low = nice to have)
   - Recommend whether to hire, train, or outsource

4. ROLE RECOMMENDATIONS (4-6 roles): Identify the most impactful hires. For each:
   - Job title and department
   - Urgency: immediate (within 30 days), next_quarter, or next_year
   - Business rationale tied to specific goals or gaps
   - Estimated salary range for the market

5. TEAM STRUCTURE NOTES: Suggest org design improvements — reporting lines, team topology, or structural changes.

6. TRAINING RECOMMENDATIONS (3-5): Identify upskilling opportunities for existing team members.

7. TOTAL HIRING BUDGET ESTIMATE: Sum the estimated cost of all recommended hires.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Talent Gap Analysis...");
    const result = await callJson(genai, prompt);
    return result as unknown as TalentGapAnalysis;
  } catch (e) {
    console.warn("[Pivot] Talent Gap Analysis synthesis failed:", e);
    return null;
  }
}

// ── Wave 6: Revenue Diversification ────────────────────────────────────────

export async function synthesizeRevenueDiversification(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueDiversification | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence revenue diversification overview",
  "concentrationRisk": "critical|high|moderate|low",
  "concentrationDetails": "description of revenue concentration risk",
  "currentStreams": [{
    "name": "SaaS Subscriptions",
    "currentRevenue": "$X",
    "revenueShare": 0,
    "growthRate": "X% YoY",
    "risk": "high|medium|low",
    "notes": "notes about this stream"
  }],
  "diversificationOpportunities": [{
    "stream": "new revenue stream name",
    "estimatedRevenue": "$X potential annual revenue",
    "timeToRevenue": "3-6 months",
    "investmentRequired": "$X upfront investment",
    "feasibility": "high|medium|low",
    "rationale": "why this opportunity makes sense"
  }],
  "recommendations": ["recommendation 1", "recommendation 2", "..."],
  "targetMix": "Aim for no single stream >40% of revenue"
}`;

  const prompt = `You are a revenue strategy consultant analyzing revenue concentration risk and diversification opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}

Perform a comprehensive revenue diversification analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the revenue diversification landscape.

2. CONCENTRATION RISK: Assess how concentrated revenue is (critical = one customer/stream >70%,
   high = >50%, moderate = >30%, low = well diversified). Explain the risk in detail.

3. CURRENT STREAMS (3-6 streams): Identify all current revenue streams. For each:
   - Name the stream (e.g., "SaaS Subscriptions", "Consulting", "Marketplace Fees")
   - Estimate current revenue (from data or note as estimate)
   - Revenue share as percentage (0-100)
   - Growth rate trend
   - Risk level (high if declining or concentrated, low if stable and growing)
   - Notes on sustainability and trajectory

4. DIVERSIFICATION OPPORTUNITIES (4-6 opportunities): For each new revenue stream opportunity:
   - Name the new stream
   - Estimated annual revenue potential
   - Time to first revenue (e.g., "3-6 months")
   - Investment required to launch
   - Feasibility rating (high = leverages existing assets, medium = requires some new capability, low = significant pivot)
   - Business rationale

5. RECOMMENDATIONS (4-6): Prioritized strategic recommendations for diversification.

6. TARGET MIX: Describe the ideal revenue mix the business should aim for.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Diversification...");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueDiversification;
  } catch (e) {
    console.warn("[Pivot] Revenue Diversification synthesis failed:", e);
    return null;
  }
}

// ── Wave 6: Customer Journey Map ───────────────────────────────────────────

export async function synthesizeCustomerJourneyMap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerJourneyMap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence customer journey overview",
  "stages": [{
    "name": "Awareness",
    "description": "how customers first discover the business",
    "touchpoints": ["touchpoint 1", "touchpoint 2"],
    "frictionPoints": ["friction point 1", "..."],
    "conversionRate": "X% estimated conversion to next stage",
    "dropOffRate": "X% estimated drop-off at this stage",
    "improvements": ["improvement 1", "improvement 2"]
  }],
  "criticalFrictionPoints": ["critical friction point 1", "..."],
  "quickWins": ["quick win 1 to improve journey", "..."],
  "longTermImprovements": ["long term improvement 1", "..."],
  "estimatedImpact": "Improving onboarding could increase retention by 15%"
}`;

  const prompt = `You are a customer experience strategist mapping the complete customer lifecycle.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Customers: ${questionnaire.keyCustomers ?? "Unknown"}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}

Map the full customer journey from awareness to advocacy:

1. SUMMARY: Provide a 2-3 sentence overview of the customer journey and key findings.

2. JOURNEY STAGES (6 stages): Map each stage of the customer lifecycle:
   - Awareness: How do customers first learn about the business?
   - Consideration: What drives evaluation and comparison?
   - Purchase: What is the buying experience like?
   - Onboarding: How are new customers activated and set up for success?
   - Retention: What keeps customers engaged and renewing?
   - Advocacy: What turns satisfied customers into referral sources?

   For each stage:
   - Describe what happens at this stage for THIS specific business
   - Identify 2-4 touchpoints (channels, interactions, moments)
   - Identify 1-3 friction points (barriers, pain points, drop-off causes)
   - Estimate conversion rate to the next stage (from data or as estimate)
   - Estimate drop-off rate at this stage
   - Recommend 2-3 specific improvements

3. CRITICAL FRICTION POINTS (3-5): The most impactful friction points across the entire journey
   that are costing the business the most revenue.

4. QUICK WINS (3-5): Journey improvements achievable within 30 days.

5. LONG-TERM IMPROVEMENTS (3-5): Strategic journey enhancements requiring 3-6 months.

6. ESTIMATED IMPACT: Quantify the potential revenue impact of fixing the top friction points.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Journey Map...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerJourneyMap;
  } catch (e) {
    console.warn("[Pivot] Customer Journey Map synthesis failed:", e);
    return null;
  }
}

// ── Wave 6: Compliance Checklist ───────────────────────────────────────────

export async function synthesizeComplianceChecklist(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ComplianceChecklist | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence compliance overview",
  "overallReadiness": "strong|adequate|needs_work|at_risk",
  "complianceScore": 0,
  "items": [{
    "requirement": "GDPR Data Processing Agreement",
    "category": "Data Privacy",
    "status": "compliant|partial|non_compliant|unknown",
    "priority": "critical|high|medium|low",
    "deadline": "date or regulatory deadline if applicable",
    "action": "specific action to achieve or maintain compliance",
    "estimatedCost": "$X estimated cost to remediate"
  }],
  "immediateActions": ["immediate action 1", "..."],
  "upcomingDeadlines": ["deadline 1 with date", "..."],
  "industrySpecificNotes": "notes specific to this industry's regulatory environment"
}`;

  const prompt = `You are a compliance and regulatory expert generating an industry-specific compliance checklist.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}

Generate a comprehensive compliance checklist:

1. SUMMARY: Provide a 2-3 sentence overview of compliance posture and key risks.

2. OVERALL READINESS: Rate overall compliance readiness (strong = minimal gaps, adequate = some gaps but manageable,
   needs_work = significant gaps, at_risk = critical gaps that could result in penalties).

3. COMPLIANCE SCORE (0-100): Quantify the compliance posture.

4. COMPLIANCE ITEMS (8-12 items): For each regulatory requirement relevant to this business:
   - Name the specific requirement (e.g., "GDPR Data Processing Agreement", "SOC 2 Type II", "PCI DSS")
   - Category: Data Privacy, Financial, Employment, Industry-Specific, Tax, IP/Legal
   - Status: compliant, partial, non_compliant, or unknown (if insufficient data)
   - Priority: critical (legal risk), high (financial risk), medium (operational risk), low (best practice)
   - Deadline if applicable (regulatory deadlines, renewal dates)
   - Specific action to achieve or maintain compliance
   - Estimated cost to remediate (if non-compliant or partial)

   Cover these areas based on the business's industry and model:
   - Data privacy (GDPR, CCPA, etc.)
   - Financial regulations (SOX, payment processing, etc.)
   - Employment law (labor compliance, contractor classification, etc.)
   - Industry-specific regulations
   - Tax compliance
   - Intellectual property protection
   - Security certifications (SOC 2, ISO 27001, etc.)

5. IMMEDIATE ACTIONS (3-5): Most urgent compliance actions to take within 30 days.

6. UPCOMING DEADLINES: Any known regulatory deadlines relevant to this business.

7. INDUSTRY-SPECIFIC NOTES: Key regulatory considerations unique to this industry.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.
If the compliance status cannot be determined from available data, mark as "unknown" — do NOT assume compliance.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Compliance Checklist...");
    const result = await callJson(genai, prompt);
    return result as unknown as ComplianceChecklist;
  } catch (e) {
    console.warn("[Pivot] Compliance Checklist synthesis failed:", e);
    return null;
  }
}

// ── Wave 6: Expansion Playbook ─────────────────────────────────────────────

export async function synthesizeExpansionPlaybook(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ExpansionPlaybook | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence expansion playbook overview",
  "currentMarketPosition": "description of current market position, geography, and segments served",
  "expansionMarkets": [{
    "market": "Southeast Asia or Healthcare Vertical",
    "type": "geographic|vertical|segment",
    "attractiveness": 0,
    "readiness": 0,
    "estimatedRevenue": "$X potential annual revenue",
    "timeToEntry": "6-12 months",
    "keyBarriers": ["barrier 1", "barrier 2"],
    "entryStrategy": "recommended approach to enter this market"
  }],
  "prioritizedSequence": ["market 1 (highest priority)", "market 2", "..."],
  "resourceRequirements": ["resource requirement 1", "..."],
  "riskFactors": ["risk factor 1", "..."],
  "timeline": "Phase 1: Q1-Q2, Phase 2: Q3-Q4"
}`;

  const prompt = `You are a market expansion strategist identifying growth opportunities beyond the current market.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Target Customers: ${questionnaire.keyCustomers ?? "Unknown"}

Develop a comprehensive expansion playbook:

1. SUMMARY: Provide a 2-3 sentence overview of expansion potential and top opportunities.

2. CURRENT MARKET POSITION: Describe the business's current market position including geography,
   verticals served, customer segments, and market share indicators.

3. EXPANSION MARKETS (5-7 opportunities): Identify expansion opportunities across three categories:
   - Geographic: New regions, countries, or local markets
   - Vertical: New industry verticals where the product/service applies
   - Segment: New customer segments (e.g., enterprise, SMB, consumer)

   For each opportunity:
   - Name the market
   - Type: geographic, vertical, or segment
   - Attractiveness score (1-10): Market size, growth rate, competitive intensity, margin potential
   - Readiness score (1-10): How prepared the business is (product fit, team, infrastructure, capital)
   - Estimated annual revenue potential
   - Time to market entry
   - Key barriers to entry (2-3)
   - Recommended entry strategy (partnership, direct, acquisition, etc.)

4. PRIORITIZED SEQUENCE: Rank the expansion markets in recommended order of pursuit,
   balancing attractiveness with readiness.

5. RESOURCE REQUIREMENTS (4-6): Key resources needed for expansion (capital, people, technology, partnerships).

6. RISK FACTORS (3-5): Major risks associated with expansion and mitigation strategies.

7. TIMELINE: Provide a phased timeline for pursuing the prioritized expansion markets.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Expansion Playbook...");
    const result = await callJson(genai, prompt);
    return result as unknown as ExpansionPlaybook;
  } catch (e) {
    console.warn("[Pivot] Expansion Playbook synthesis failed:", e);
    return null;
  }
}

// ── Wave 6: Vendor Scorecard ───────────────────────────────────────────────

export async function synthesizeVendorScorecard(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<VendorScorecard | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence vendor scorecard overview",
  "totalVendorSpend": "$X total annual vendor spend",
  "vendorCount": 0,
  "assessments": [{
    "vendor": "vendor name",
    "category": "Cloud Infrastructure",
    "annualCost": "$X annual cost",
    "contractEnd": "date or unknown",
    "satisfaction": 0,
    "alternatives": ["alternative vendor 1", "..."],
    "potentialSaving": "$X potential annual saving",
    "recommendation": "keep|renegotiate|replace|consolidate",
    "notes": "notes about this vendor relationship"
  }],
  "consolidationOpportunities": ["consolidation opportunity 1", "..."],
  "renegotiationTargets": ["vendor to renegotiate 1", "..."],
  "totalPotentialSavings": "$X total potential annual savings",
  "recommendations": ["recommendation 1", "recommendation 2", "..."]
}`;

  const prompt = `You are a procurement and vendor management expert analyzing vendor relationships and spend optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}

Perform a comprehensive vendor scorecard analysis:

1. SUMMARY: Provide a 2-3 sentence overview of vendor landscape and key findings.

2. TOTAL VENDOR SPEND: Estimate total annual spend on vendors/suppliers from available data.

3. VENDOR COUNT: Estimate the number of active vendor relationships.

4. VENDOR ASSESSMENTS (6-10 vendors): Analyze each vendor/supplier relationship. For each:
   - Vendor name or category (from data, or typical vendors for this business type)
   - Category: Cloud Infrastructure, Marketing Tools, Payment Processing, SaaS Tools,
     Professional Services, Office/Facilities, Insurance, etc.
   - Annual cost (from data or estimated for the business size)
   - Contract end date if known
   - Satisfaction score (1-10) based on value delivered vs. cost
   - 2-3 alternative vendors that could be evaluated
   - Potential annual saving if renegotiated or replaced
   - Recommendation: keep (good value), renegotiate (overpriced but good fit),
     replace (better alternatives exist), consolidate (overlap with other vendors)
   - Notes on the relationship quality and strategic importance

5. CONSOLIDATION OPPORTUNITIES (2-4): Identify vendors with overlapping capabilities that could be consolidated.

6. RENEGOTIATION TARGETS (2-4): Vendors where the business likely has leverage to negotiate better terms
   (approaching contract end, competitive alternatives, volume discounts).

7. TOTAL POTENTIAL SAVINGS: Sum the potential savings across all vendor optimizations.

8. RECOMMENDATIONS (4-6): Prioritized vendor management recommendations.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.
If specific vendors are not mentioned in the data, identify TYPICAL vendors for a business of this type and size,
and clearly note they are estimated/typical rather than confirmed.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Vendor Scorecard...");
    const result = await callJson(genai, prompt);
    return result as unknown as VendorScorecard;
  } catch (e) {
    console.warn("[Pivot] Vendor Scorecard synthesis failed:", e);
    return null;
  }
}

// ── Wave 7: Product-Market Fit ──────────────────────────────────────────────

export async function synthesizeProductMarketFit(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ProductMarketFit | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence product-market fit assessment",
  "overallScore": 0,
  "grade": "strong_fit|approaching_fit|weak_fit|no_fit",
  "indicators": [{
    "indicator": "Retention Rate > 40%",
    "status": "strong|moderate|weak",
    "evidence": "evidence from the data",
    "weight": 0.25
  }],
  "keyStrengths": ["strength 1", "..."],
  "keyGaps": ["gap 1", "..."],
  "improvementActions": ["action 1", "..."],
  "seanEllisScore": "X% would be very disappointed if this product disappeared",
  "targetSegmentFit": "description of best-fit customer segment"
}`;

  const prompt = `You are a product-market fit analyst evaluating how well a business's offering matches market demand.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Customers: ${questionnaire.keyCustomers ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}
Key Concern: ${questionnaire.keyConcerns}

Perform a comprehensive product-market fit analysis:

1. SUMMARY: Provide a 2-3 sentence PMF assessment based on available signals.

2. OVERALL SCORE (0-100): Score reflecting how strong the product-market fit is.
   - 80-100 = strong_fit (clear demand, high retention, organic growth)
   - 60-79 = approaching_fit (promising signals but gaps remain)
   - 40-59 = weak_fit (product solving a problem but market validation incomplete)
   - 0-39 = no_fit (significant misalignment between product and market)

3. GRADE: One of "strong_fit", "approaching_fit", "weak_fit", "no_fit".

4. INDICATORS (5-8): Assess PMF indicators such as:
   - Customer retention / repeat usage
   - Organic referral / word-of-mouth signals
   - Willingness-to-pay evidence
   - Customer engagement depth
   - Net Promoter Score signals
   - Revenue growth trajectory
   - Customer acquisition cost efficiency
   For each, assign a status (strong/moderate/weak), provide evidence, and weight (0-1, summing to ~1.0).

5. KEY STRENGTHS (3-5): What is working well for PMF.

6. KEY GAPS (3-5): What is preventing stronger PMF.

7. IMPROVEMENT ACTIONS (4-6): Specific steps to strengthen product-market fit.

8. SEAN ELLIS SCORE: Estimate what percentage of customers would be "very disappointed" if the product disappeared.
   Base this on retention signals, engagement data, and competitive alternatives.

9. TARGET SEGMENT FIT: Describe the customer segment with the strongest fit.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Product-Market Fit...");
    const result = await callJson(genai, prompt);
    return result as unknown as ProductMarketFit;
  } catch (e) {
    console.warn("[Pivot] Product-Market Fit synthesis failed:", e);
    return null;
  }
}

// ── Wave 7: Brand Health ────────────────────────────────────────────────────

export async function synthesizeBrandHealth(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<BrandHealth | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence brand health overview",
  "overallScore": 0,
  "brandStrength": "strong|developing|weak",
  "dimensions": [{
    "dimension": "Awareness",
    "score": 7,
    "insight": "insight about this dimension",
    "improvementAction": "specific action to improve"
  }],
  "brandPositioning": "description of current brand positioning",
  "competitiveDifferentiators": ["differentiator 1", "..."],
  "brandRisks": ["risk 1", "..."],
  "recommendations": ["recommendation 1", "..."],
  "messagingGuidelines": ["guideline 1", "..."]
}`;

  const prompt = `You are a brand strategist performing a comprehensive brand health assessment.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}
Website: ${questionnaire.website ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Perform a comprehensive brand health analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the brand's health and market position.

2. OVERALL SCORE (0-100): Composite brand health score.

3. BRAND STRENGTH: One of "strong", "developing", or "weak".

4. DIMENSIONS (4 required): Evaluate these four brand dimensions, each scored 1-10:
   a. Awareness — How well-known is the brand in its target market?
   b. Perception — How do customers perceive the brand quality and values?
   c. Loyalty — How strong is customer retention and repeat business?
   d. Differentiation — How distinct is the brand vs. competitors?
   For each, provide a score, an insight explaining the score, and a specific improvement action.

5. BRAND POSITIONING: Describe the brand's current market positioning — who it serves, what promise it makes, and how it's perceived relative to alternatives.

6. COMPETITIVE DIFFERENTIATORS (3-5): What makes this brand genuinely different from competitors.

7. BRAND RISKS (3-5): Threats to brand health — reputation risks, market shifts, competitor actions, messaging inconsistencies.

8. RECOMMENDATIONS (4-6): Prioritized actions to strengthen the brand.

9. MESSAGING GUIDELINES (3-5): Core messaging principles the brand should follow for consistency.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Brand Health...");
    const result = await callJson(genai, prompt);
    return result as unknown as BrandHealth;
  } catch (e) {
    console.warn("[Pivot] Brand Health synthesis failed:", e);
    return null;
  }
}

// ── Wave 7: Pricing Elasticity ──────────────────────────────────────────────

export async function synthesizePricingElasticity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PricingElasticity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence pricing elasticity overview",
  "overallSensitivity": "low|moderate|high",
  "priceTiers": [{
    "name": "Basic",
    "currentPrice": "$X/mo",
    "suggestedPrice": "$Y/mo",
    "elasticity": "inelastic|moderate|elastic",
    "rationale": "why this price change is recommended",
    "revenueImpact": "$X additional annual revenue"
  }],
  "priceIncreaseCapacity": "Can increase X% without significant churn",
  "competitivePricePosition": "description of price position vs competitors",
  "psychologicalPricePoints": ["$X.99 tier resonates", "..."],
  "bundlingOpportunities": ["bundling opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a pricing strategy expert analyzing price sensitivity and optimization opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Customers: ${questionnaire.keyCustomers ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}

Perform a comprehensive pricing elasticity analysis:

1. SUMMARY: Provide a 2-3 sentence overview of pricing sensitivity and key findings.

2. OVERALL SENSITIVITY: Classify the business's price sensitivity as "low" (customers value-driven, price-insensitive),
   "moderate" (some price sensitivity but room to optimize), or "high" (highly competitive, price-sensitive market).

3. PRICE TIERS (3-5 tiers): Analyze each pricing tier or product line. For each:
   - Name (e.g., "Basic", "Pro", "Enterprise" or product/service names)
   - Current price (from data or estimated)
   - Suggested optimal price based on value delivered and market positioning
   - Elasticity classification: inelastic (price changes won't affect demand much),
     moderate (some impact), or elastic (highly sensitive to price changes)
   - Rationale for the suggested price change
   - Estimated revenue impact of the price change

4. PRICE INCREASE CAPACITY: Estimate how much prices can increase without triggering meaningful churn.

5. COMPETITIVE PRICE POSITION: Where does this business sit vs. competitors — premium, mid-market, or budget?

6. PSYCHOLOGICAL PRICE POINTS (3-5): Specific price points that resonate with customers based on pricing psychology.

7. BUNDLING OPPORTUNITIES (3-5): Ways to package offerings for higher average deal value.

8. RECOMMENDATIONS (4-6): Prioritized pricing strategy recommendations.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Pricing Elasticity...");
    const result = await callJson(genai, prompt);
    return result as unknown as PricingElasticity;
  } catch (e) {
    console.warn("[Pivot] Pricing Elasticity synthesis failed:", e);
    return null;
  }
}

// ── Wave 7: Strategic Initiatives ───────────────────────────────────────────

export async function synthesizeStrategicInitiatives(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<StrategicInitiatives | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence strategic initiatives overview",
  "initiatives": [{
    "name": "initiative name",
    "description": "detailed description of the initiative",
    "status": "planning|in_progress|completed|on_hold|at_risk",
    "priority": "critical|high|medium|low",
    "owner": "recommended owner/team",
    "timeline": "Q1 2025 - Q3 2025",
    "investmentRequired": "$X estimated investment",
    "expectedROI": "X% ROI or $X return",
    "risks": ["risk 1", "..."],
    "milestones": ["milestone 1", "..."]
  }],
  "totalInvestment": "$X total investment across all initiatives",
  "expectedTotalROI": "$X or X% total expected return",
  "resourceConstraints": ["constraint 1", "..."],
  "recommendations": ["recommendation 1", "..."],
  "prioritizationFramework": "description of how to prioritize these initiatives"
}`;

  const prompt = `You are a strategic planning consultant identifying the key strategic bets a business should make.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Key Concern: ${questionnaire.keyConcerns}
Critical Decision: ${questionnaire.oneDecisionKeepingOwnerUpAtNight}

Perform a comprehensive strategic initiatives analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the strategic landscape and recommended bets.

2. INITIATIVES (5-8): Identify the most impactful strategic initiatives the business should pursue. For each:
   - Name and description of the initiative
   - Status: planning (not started), in_progress, completed, on_hold, or at_risk
   - Priority: critical (must-do for survival/growth), high, medium, or low
   - Recommended owner/team
   - Timeline with start and end estimates
   - Investment required (estimated dollar amount)
   - Expected ROI (percentage or dollar return)
   - Key risks (2-3 per initiative)
   - Key milestones (3-5 per initiative)

3. TOTAL INVESTMENT: Sum of all investment estimates.

4. EXPECTED TOTAL ROI: Aggregate expected return across all initiatives.

5. RESOURCE CONSTRAINTS (3-5): Key constraints that could limit execution — talent, capital, time, technology.

6. RECOMMENDATIONS (4-6): Overarching strategic recommendations.

7. PRIORITIZATION FRAMEWORK: Suggest a framework for prioritizing these initiatives (e.g., impact vs. effort matrix, RICE scoring).

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Strategic Initiatives...");
    const result = await callJson(genai, prompt);
    return result as unknown as StrategicInitiatives;
  } catch (e) {
    console.warn("[Pivot] Strategic Initiatives synthesis failed:", e);
    return null;
  }
}

// ── Wave 7: Cash Conversion Cycle ───────────────────────────────────────────

export async function synthesizeCashConversionCycle(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CashConversionCycle | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence cash conversion cycle overview",
  "cycleDays": 0,
  "industryAverage": 0,
  "metrics": [{
    "metric": "Days Sales Outstanding",
    "currentValue": "X days",
    "industryBenchmark": "Y days",
    "status": "good|average|needs_improvement",
    "improvementAction": "specific action to improve this metric"
  }],
  "workingCapitalEfficiency": "assessment of working capital management",
  "improvementOpportunities": ["opportunity 1", "..."],
  "cashFlowImpact": "Reducing cycle by X days frees $Y in working capital",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a treasury and working capital analyst evaluating cash conversion efficiency.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}

Perform a comprehensive cash conversion cycle analysis:

1. SUMMARY: Provide a 2-3 sentence overview of cash conversion efficiency and key findings.

2. CYCLE DAYS: Calculate the total cash conversion cycle in days (DSO + DIO - DPO).
   Use financial data from the business report. If exact figures are unavailable, estimate
   based on industry norms for the business model and revenue range.

3. INDUSTRY AVERAGE: Provide the typical cash conversion cycle for this industry and business model.

4. METRICS (3 required, plus any additional relevant metrics):
   a. Days Sales Outstanding (DSO) — How quickly the business collects receivables.
   b. Days Payable Outstanding (DPO) — How long the business takes to pay suppliers.
   c. Days Inventory Outstanding (DIO) — How long inventory sits before being sold (if applicable).
   For each metric, provide:
   - Current value (from data or estimated with clear notation)
   - Industry benchmark for comparison
   - Status: good (better than benchmark), average (near benchmark), or needs_improvement (worse)
   - Specific improvement action

5. WORKING CAPITAL EFFICIENCY: Assess how effectively the business manages its working capital.

6. IMPROVEMENT OPPORTUNITIES (4-6): Specific, actionable opportunities to shorten the cash conversion cycle.

7. CASH FLOW IMPACT: Quantify the dollar impact of reducing the cycle — "Reducing the cycle by X days would free approximately $Y in working capital."

8. RECOMMENDATIONS (4-6): Prioritized recommendations for improving cash conversion.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.
If the business is a services/SaaS business with no inventory, note DIO as 0 or N/A and focus on DSO and DPO.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cash Conversion Cycle...");
    const result = await callJson(genai, prompt);
    return result as unknown as CashConversionCycle;
  } catch (e) {
    console.warn("[Pivot] Cash Conversion Cycle synthesis failed:", e);
    return null;
  }
}

// ── Wave 7: Innovation Pipeline ─────────────────────────────────────────────

export async function synthesizeInnovationPipeline(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<InnovationPipeline | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence innovation pipeline overview",
  "innovationScore": 0,
  "projects": [{
    "name": "project name",
    "description": "what this innovation initiative involves",
    "stage": "ideation|validation|development|launch|scaling",
    "investmentToDate": "$X invested so far",
    "projectedRevenue": "$X projected annual revenue at maturity",
    "timeToMarket": "X months to launch",
    "riskLevel": "low|medium|high",
    "keyAssumptions": ["assumption 1", "..."]
  }],
  "portfolioBalance": "X% core, Y% adjacent, Z% transformational",
  "totalInvestment": "$X total innovation investment",
  "gapAreas": ["gap area 1", "..."],
  "recommendations": ["recommendation 1", "..."],
  "innovationCulture": "assessment of the organization's innovation readiness and culture"
}`;

  const prompt = `You are an innovation strategy consultant assessing R&D portfolio health and innovation readiness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Tech Stack: ${questionnaire.techStack ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive innovation pipeline analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the innovation landscape and key findings.

2. INNOVATION SCORE (0-100): Composite score reflecting innovation readiness and pipeline strength.
   - Consider: investment levels, pipeline diversity, time-to-market, organizational culture, competitive positioning.

3. PROJECTS (5-8): Identify current and recommended innovation initiatives. For each:
   - Name and description
   - Stage: ideation (concept phase), validation (testing assumptions), development (building),
     launch (going to market), or scaling (growing post-launch)
   - Investment to date (from data or estimated)
   - Projected revenue at maturity
   - Time to market (months)
   - Risk level: low (incremental improvement), medium (adjacent innovation), high (transformational bet)
   - Key assumptions (2-3) that must hold true for success

4. PORTFOLIO BALANCE: Assess the mix using the 70-20-10 framework:
   - Core innovation (70%): Improvements to existing products/services
   - Adjacent innovation (20%): Extensions into new markets or capabilities
   - Transformational innovation (10%): Breakthrough bets
   State the current and recommended balance.

5. TOTAL INVESTMENT: Sum of all innovation-related investment.

6. GAP AREAS (3-5): Areas where the business is under-investing in innovation relative to competitors or market needs.

7. RECOMMENDATIONS (4-6): Prioritized actions to strengthen the innovation pipeline.

8. INNOVATION CULTURE: Assess the organization's innovation readiness — processes, talent, risk tolerance, experimentation habits.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Innovation Pipeline...");
    const result = await callJson(genai, prompt);
    return result as unknown as InnovationPipeline;
  } catch (e) {
    console.warn("[Pivot] Innovation Pipeline synthesis failed:", e);
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
