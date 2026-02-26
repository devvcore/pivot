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
  StakeholderMap,
  DecisionLog,
  CultureAssessment,
  ExitReadiness,
  SustainabilityScore,
  AcquisitionTargets,
  FinancialRatios,
  ChannelMixModel,
  SupplyChainRisk,
  RegulatoryLandscape,
  CrisisPlaybook,
  AIReadiness,
  NetworkEffects,
  DataMonetization,
  SubscriptionMetrics,
  MarketTiming,
  ScenarioStressTest,
  PricingStrategyMatrix,
  CustomerHealthScore,
  RevenueWaterfall,
  TechDebtAssessment,
  TeamPerformance,
  MarketEntryStrategy,
  CompetitiveIntelFeed,
  CashFlowSensitivity,
  DigitalMaturity,
  AcquisitionFunnel,
  StrategicAlignment,
  BudgetOptimizer,
  ProcessEfficiency,
  VendorRisk,
  QualityMetrics,
  CapacityPlanning,
  KnowledgeManagement,
  ComplianceScorecard,
  RevenueDrivers,
  MarginOptimization,
  DemandForecasting,
  CohortAnalysis,
  WinLossAnalysis,
  SalesForecast,
  MarketPenetration,
  FlywheelAnalysis,
  PartnershipsStrategy,
  InternationalExpansion,
  RDEffectiveness,
  BrandEquity,
  WorkingCapital,
  DebtStrategy,
  TaxStrategy,
  InvestorReadiness,
  MAReadiness,
  StrategicRoadmap,
  CustomerVoice,
  ReferralEngine,
  PriceSensitivityIndex,
  CustomerEffortScore,
  AccountExpansionMap,
  LoyaltyProgramDesign,
  CompetitivePricingMatrix,
  MarketSentimentIndex,
  DisruptionRadar,
  EcosystemMap,
  CategoryCreation,
  MarketVelocity,
  OKRCascade,
  MeetingEffectiveness,
  CommunicationAudit,
  DecisionVelocity,
  ResourceOptimizer,
  ChangeManagement,
  CashReserveStrategy,
  RevenueQualityScore,
  CostIntelligence,
  FinancialModeling,
  ProfitabilityMap,
  CapitalAllocation,
  SalesPipelineHealth,
  DealVelocity,
  WinRateOptimizer,
  SalesEnablement,
  TerritoryPlanning,
  QuotaIntelligence,
  FeaturePrioritization,
  ProductUsageAnalytics,
  TechStackAudit,
  ApiStrategy,
  PlatformScalability,
  UserOnboarding,
  EmployeeEngagement,
  TalentAcquisitionFunnel,
  CompensationBenchmark,
  SuccessionPlanning,
  DiversityMetrics,
  EmployerBrand,
  DataGovernance,
  AnalyticsMaturity,
  CustomerDataPlatform,
  PredictiveModeling,
  ReportingFramework,
  DataQualityScore,
  IpPortfolio,
  RdEfficiency,
  TechnologyReadiness,
  PartnershipEcosystem,
  MergersAcquisitions,
  EsgScorecard,
  CarbonFootprint,
  RegulatoryCompliance,
  BusinessContinuity,
  EthicsFramework,
  SocialImpact,
  InventoryOptimization,
  QualityManagement,
  NpsAnalysis,
  SupportTicketIntelligence,
  VoiceOfCustomer,
  DealPipeline,
  SalesForecasting,
  AccountBasedMarketing,
  CommissionOptimization,
  ProductAnalytics,
  CompetitiveResponse,
  ScenarioPlanning,
  CapitalStructure,
  FundraisingReadiness,
  ExitStrategy,
  TalentAcquisition,
  DiversityInclusion,
  MarketEntryPlaybook,
  PartnerChannelStrategy,
  AcquisitionIntegration,
  InternationalReadiness,
  RevenueModelAnalysis,
  GrowthExperiments,
  CustomerAcquisitionCost,
  LifetimeValueOptimization,
  ChurnPrediction,
  NetRevenueRetention,
  CustomerAdvocacy,
  FeedbackLoop,
  ProcessAutomation,
  CostBenchmark,
  VendorNegotiation,
  ScalabilityAssessment,
  IncidentReadiness,
  OperationalRisk,
  DataStrategy,
  AiUseCases,
  AnalyticsRoadmap,
  DataPrivacy,
  MlOpsReadiness,
  DigitalTransformation,
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

// ── Customer Segmentation — (moved to Wave 26 block below) ───────────────────

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

// ── Wave 4: Operational Efficiency — (moved to Wave 25 block below) ──────────

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

// ── Wave 6: Customer Journey Map — (moved to Wave 26 block below) ────────────

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

// ── Wave 6: Vendor Scorecard — (moved to Wave 25 block below) ────────────────

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

// ── Wave 7: Innovation Pipeline — (moved to Wave 27 block below) ─────────────

// ── Wave 8: Stakeholder Map ──────────────────────────────────────────────────

export async function synthesizeStakeholderMap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<StakeholderMap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence stakeholder landscape overview",
  "stakeholders": [{
    "name": "stakeholder name or role title",
    "role": "their role in the organization or ecosystem",
    "influenceLevel": "high|medium|low",
    "supportLevel": "champion|supporter|neutral|skeptic|blocker",
    "interests": ["interest 1", "..."],
    "communicationStyle": "preferred communication approach",
    "engagementStrategy": "specific strategy to engage this stakeholder"
  }],
  "powerDynamics": "description of power dynamics between key stakeholders",
  "communicationPlan": "recommended communication cadence and approach",
  "keyRelationships": ["relationship 1", "..."],
  "risks": ["stakeholder risk 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational strategist mapping stakeholder relationships and influence patterns.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}
Key Decision: ${questionnaire.oneDecisionKeepingOwnerUpAtNight}
Key Customers: ${questionnaire.keyCustomers ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive stakeholder mapping analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the stakeholder landscape and key dynamics.

2. STAKEHOLDERS (6-10): Identify the most important internal and external stakeholders. For each:
   - Name or role title (use role titles if names are not in the data)
   - Their role in the organization or ecosystem
   - Influence level: high (can block or accelerate decisions), medium (provides input), low (affected but limited influence)
   - Support level: champion (actively promotes), supporter (positive), neutral, skeptic (has concerns), blocker (actively opposes)
   - Interests (2-3): What they care most about
   - Communication style: How they prefer to receive information
   - Engagement strategy: Specific approach to keep them aligned

3. POWER DYNAMICS: Describe the relationships and tensions between key stakeholders — who influences whom, where alliances and conflicts exist.

4. COMMUNICATION PLAN: Recommended communication cadence and channels for stakeholder management.

5. KEY RELATIONSHIPS (4-6): The most important stakeholder relationships that must be managed.

6. RISKS (3-5): Stakeholder-related risks — disengagement, misalignment, competing interests.

7. RECOMMENDATIONS (4-6): Prioritized actions to improve stakeholder alignment and engagement.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent names or relationships.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Stakeholder Map...");
    const result = await callJson(genai, prompt);
    return result as unknown as StakeholderMap;
  } catch (e) {
    console.warn("[Pivot] Stakeholder Map synthesis failed:", e);
    return null;
  }
}

// ── Wave 8: Decision Log ─────────────────────────────────────────────────────

export async function synthesizeDecisionLog(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DecisionLog | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence decision landscape overview",
  "decisions": [{
    "title": "decision title",
    "description": "what this decision involves",
    "category": "Strategic|Financial|Operational|Product",
    "status": "pending|made|deferred|reversed",
    "urgency": "critical|high|medium|low",
    "rationale": "why this decision matters now",
    "alternatives": ["alternative 1", "..."],
    "expectedOutcome": "what happens if this decision is made",
    "risks": ["risk if wrong", "..."],
    "owner": "who should own this decision",
    "deadline": "recommended deadline"
  }],
  "decisionFramework": "recommended framework for making these decisions",
  "pendingCount": 0,
  "criticalDecisions": ["critical decision 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a decision intelligence analyst identifying and prioritizing business decisions.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}
Key Decision: ${questionnaire.oneDecisionKeepingOwnerUpAtNight}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}

Perform a comprehensive decision log analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the decision landscape and priorities.

2. DECISIONS (6-10): Identify the most important pending and recent business decisions. For each:
   - Title: Short name for the decision
   - Description: What this decision involves
   - Category: Strategic, Financial, Operational, or Product
   - Status: pending (not yet decided), made (decided recently), deferred (postponed), reversed (changed course)
   - Urgency: critical (decide this week), high (decide this month), medium (this quarter), low (can wait)
   - Rationale: Why this decision matters now
   - Alternatives (2-3): Other options considered
   - Expected outcome: What happens if the recommended path is taken
   - Risks (1-3): What could go wrong
   - Owner: Who should own this decision
   - Deadline: Recommended decision deadline

   IMPORTANT: The first decision should be based on "${questionnaire.oneDecisionKeepingOwnerUpAtNight}"

3. DECISION FRAMEWORK: Recommend a decision-making framework appropriate for this business (e.g., RAPID, DACI, or a simplified approach).

4. PENDING COUNT: How many decisions are currently pending.

5. CRITICAL DECISIONS (2-4): Which decisions need immediate attention and why.

6. RECOMMENDATIONS (4-6): Actions to improve decision-making speed and quality.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent specifics.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Decision Log...");
    const result = await callJson(genai, prompt);
    return result as unknown as DecisionLog;
  } catch (e) {
    console.warn("[Pivot] Decision Log synthesis failed:", e);
    return null;
  }
}

// ── Wave 8: Culture Assessment (Legacy — superseded by Wave 32) ─────────────

export async function synthesizeCultureAssessmentLegacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CultureAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence culture assessment overview",
  "overallScore": 0,
  "cultureType": "Clan|Adhocracy|Market|Hierarchy",
  "dimensions": [{
    "dimension": "Innovation",
    "score": 7,
    "description": "description of this cultural dimension",
    "strengths": ["strength 1", "..."],
    "weaknesses": ["weakness 1", "..."],
    "improvementAction": "specific action to improve this dimension"
  }],
  "coreValues": ["value 1", "..."],
  "alignmentGaps": ["gap 1", "..."],
  "retentionRisks": ["risk 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational psychologist assessing company culture and team dynamics.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}

Perform a comprehensive organizational culture assessment:

1. SUMMARY: Provide a 2-3 sentence overview of the organizational culture and key findings.

2. OVERALL SCORE (0-100): Composite culture health score reflecting alignment, engagement, and effectiveness.

3. CULTURE TYPE: Classify using the Competing Values Framework:
   - Clan: Collaborative, family-like, mentorship-focused
   - Adhocracy: Creative, entrepreneurial, risk-taking
   - Market: Results-oriented, competitive, achievement-focused
   - Hierarchy: Structured, process-driven, efficiency-focused

4. DIMENSIONS (4 required): Evaluate these cultural dimensions, each scored 1-10:
   a. Innovation — How well does the culture support experimentation and new ideas?
   b. Collaboration — How effectively do teams work together across functions?
   c. Accountability — Is there clear ownership and follow-through on commitments?
   d. Agility — How quickly can the organization adapt to change?
   For each, provide a score, description, strengths, weaknesses, and a specific improvement action.

5. CORE VALUES (3-5): The implicit or explicit values that drive behavior in this organization.

6. ALIGNMENT GAPS (3-5): Where the stated culture and actual behavior diverge — the "say-do gap."

7. RETENTION RISKS (3-5): Cultural factors that may drive talent attrition.

8. RECOMMENDATIONS (4-6): Prioritized actions to strengthen organizational culture.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent specifics.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Culture Assessment...");
    const result = await callJson(genai, prompt);
    return result as unknown as CultureAssessment;
  } catch (e) {
    console.warn("[Pivot] Culture Assessment synthesis failed:", e);
    return null;
  }
}

// ── Wave 8: IP Portfolio ─────────────────────────────────────────────────────

export async function synthesizeIPPortfolio(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<IpPortfolio | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence IP portfolio overview",
  "assets": [{
    "name": "asset name",
    "type": "patent|trademark|copyright|trade_secret|domain|software",
    "status": "registered|pending|unprotected|expired",
    "value": "$X estimated value",
    "protectionStrategy": "how to protect this asset",
    "expirationDate": "YYYY-MM-DD or null"
  }],
  "totalEstimatedValue": "$X total portfolio value",
  "protectionGaps": ["gap 1", "..."],
  "competitiveAdvantage": "how IP contributes to competitive moat",
  "filingRecommendations": ["filing recommendation 1", "..."],
  "risks": ["IP risk 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an intellectual property strategist assessing a company's IP portfolio and protection strategy.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Website: ${questionnaire.website ?? "Not specified"}
Tech Stack: ${questionnaire.techStack ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive intellectual property portfolio analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the IP landscape and key findings.

2. ASSETS (4-8): Identify known and potential IP assets. For each:
   - Name: The specific asset (brand name, product name, process, technology, etc.)
   - Type: patent, trademark, copyright, trade_secret, domain, or software
   - Status: registered (formally protected), pending (application in progress), unprotected (not yet filed), expired
   - Value: Estimated monetary value or strategic value
   - Protection strategy: Recommended approach to secure/maintain protection
   - Expiration date: If applicable (null otherwise)

3. TOTAL ESTIMATED VALUE: Aggregate estimated value of the IP portfolio.

4. PROTECTION GAPS (3-5): Areas where valuable IP is unprotected or under-protected.

5. COMPETITIVE ADVANTAGE: How the IP portfolio contributes to the company's competitive moat.

6. FILING RECOMMENDATIONS (3-5): Specific IP filings or registrations the company should pursue.

7. RISKS (3-5): IP-related risks — infringement exposure, expiring protections, competitor actions.

8. RECOMMENDATIONS (4-6): Prioritized actions to strengthen the IP portfolio.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent asset names or values.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating IP Portfolio...");
    const result = await callJson(genai, prompt);
    return result as unknown as IpPortfolio;
  } catch (e) {
    console.warn("[Pivot] IP Portfolio synthesis failed:", e);
    return null;
  }
}

// ── Wave 8: Exit Readiness ───────────────────────────────────────────────────

export async function synthesizeExitReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ExitReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence exit readiness overview",
  "overallScore": 0,
  "exitTimeline": "X-Y months to be exit-ready",
  "valuationRange": "$XM-$YM based on current metrics",
  "dimensions": [{
    "dimension": "Financial Performance",
    "score": 7,
    "status": "ready|needs_work|not_ready",
    "gapToClose": "what needs to happen to be ready"
  }],
  "valuationDrivers": ["driver 1", "..."],
  "valuationDetractors": ["detractor 1", "..."],
  "buyerProfiles": ["buyer profile 1", "..."],
  "preparationSteps": ["step 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an M&A advisor assessing a company's readiness for exit (acquisition, merger, or IPO).

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concern: ${questionnaire.keyConcerns}
Primary Objective: ${questionnaire.primaryObjective ?? "Growth"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive exit readiness assessment:

1. SUMMARY: Provide a 2-3 sentence overview of exit readiness and key findings.

2. OVERALL SCORE (0-100): Composite exit readiness score.

3. EXIT TIMELINE: Estimated time to be exit-ready (e.g., "12-18 months to be exit-ready").

4. VALUATION RANGE: Estimated valuation range based on available data, revenue multiples, and industry benchmarks.

5. DIMENSIONS (5 required): Evaluate these exit readiness dimensions, each scored 1-10:
   a. Financial Performance — Revenue growth, profitability, clean financials
   b. Growth Trajectory — Growth rate, market opportunity, scalability
   c. Market Position — Competitive advantage, market share, brand strength
   d. Operational Maturity — Processes, team, technology infrastructure
   e. Legal & Compliance — IP protection, contracts, regulatory compliance
   For each, provide a score, status (ready / needs_work / not_ready), and the gap to close.

6. VALUATION DRIVERS (4-6): Factors that increase the company's value to potential buyers.

7. VALUATION DETRACTORS (3-5): Factors that decrease value or create buyer concern.

8. BUYER PROFILES (3-5): Types of buyers most likely to be interested and why.

9. PREPARATION STEPS (5-8): Ordered steps to improve exit readiness.

10. RECOMMENDATIONS (4-6): Prioritized actions to maximize exit value.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent valuation figures.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Exit Readiness...");
    const result = await callJson(genai, prompt);
    return result as unknown as ExitReadiness;
  } catch (e) {
    console.warn("[Pivot] Exit Readiness synthesis failed:", e);
    return null;
  }
}

// ── Wave 8: Sustainability Score ─────────────────────────────────────────────

export async function synthesizeSustainabilityScore(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SustainabilityScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence sustainability overview",
  "overallScore": 0,
  "grade": "A|B|C|D|F",
  "dimensions": [{
    "area": "Environmental",
    "score": 7,
    "initiatives": ["initiative 1", "..."],
    "gaps": ["gap 1", "..."],
    "quickWins": ["quick win 1", "..."]
  }],
  "materialIssues": ["material issue 1", "..."],
  "stakeholderExpectations": ["expectation 1", "..."],
  "regulatoryRequirements": ["requirement 1", "..."],
  "competitiveAdvantage": "how sustainability contributes to competitive positioning",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an ESG (Environmental, Social, Governance) analyst assessing a company's sustainability posture.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive sustainability and ESG assessment:

1. SUMMARY: Provide a 2-3 sentence overview of the company's sustainability posture.

2. OVERALL SCORE (0-100): Composite ESG score reflecting environmental, social, and governance performance.

3. GRADE: Letter grade (A = exemplary, B = strong, C = average, D = below average, F = failing).

4. DIMENSIONS (3 required): Evaluate these ESG pillars, each scored 1-10:
   a. Environmental — Carbon footprint, resource usage, waste management, environmental initiatives.
   b. Social — Employee welfare, community impact, diversity and inclusion, labor practices.
   c. Governance — Board structure, transparency, ethics, compliance, stakeholder engagement.
   For each, provide a score, current initiatives, gaps, and quick wins.

5. MATERIAL ISSUES (3-5): The ESG issues most material to this specific business and industry — the issues that could most significantly impact financial performance or stakeholder trust.

6. STAKEHOLDER EXPECTATIONS (3-5): What customers, employees, investors, and regulators expect from this company on sustainability.

7. REGULATORY REQUIREMENTS (3-5): Current and upcoming ESG regulations relevant to this business's industry and location.

8. COMPETITIVE ADVANTAGE: How sustainability initiatives can strengthen competitive positioning and create value.

9. RECOMMENDATIONS (4-6): Prioritized actions to improve the sustainability posture.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent metrics or initiatives.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Sustainability Score...");
    const result = await callJson(genai, prompt);
    return result as unknown as SustainabilityScore;
  } catch (e) {
    console.warn("[Pivot] Sustainability Score synthesis failed:", e);
    return null;
  }
}

/* ─────────────────────────  Wave 10  ───────────────────────── */

export async function synthesizeAIReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AIReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence AI readiness overview",
  "overallScore": 0,
  "dataReadiness": 0,
  "teamReadiness": 0,
  "infrastructureReadiness": 0,
  "capabilities": [{
    "area": "Customer Service",
    "currentMaturity": "none|exploring|piloting|scaling|optimized",
    "opportunity": "description of AI opportunity",
    "estimatedImpact": "$X/year or X% improvement",
    "implementationEffort": "low|medium|high",
    "toolsRecommended": ["tool 1", "..."]
  }],
  "quickWins": ["quick win 1", "..."],
  "investmentRequired": "$X total estimated investment",
  "roadmap": ["Phase 1: ...", "Phase 2: ...", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an AI strategy consultant assessing a company's readiness to adopt artificial intelligence across its operations.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive AI readiness assessment:

1. SUMMARY: Provide a 2-3 sentence overview of how ready this business is to adopt AI.

2. OVERALL SCORE (0-100): Composite AI readiness score reflecting data, team, and infrastructure.

3. DATA READINESS (0-100): Evaluate the quality, accessibility, and volume of data available for AI use cases. Consider data pipelines, storage, labeling, and governance.

4. TEAM READINESS (0-100): Evaluate whether the team has the skills, culture, and leadership support to implement AI. Consider technical talent, AI literacy, and change management capacity.

5. INFRASTRUCTURE READINESS (0-100): Evaluate whether the technology stack supports AI workloads. Consider cloud infrastructure, APIs, integration points, and compute resources.

6. CAPABILITIES (4-6): For each business area (Customer Service, Operations, Marketing, Product, Finance, HR), assess:
   - Current AI maturity level (none, exploring, piloting, scaling, optimized)
   - Specific AI opportunity for this business
   - Estimated impact in dollar terms or percentage improvement
   - Implementation effort (low, medium, high)
   - Specific tools or platforms recommended

7. QUICK WINS (3-5): AI implementations that can deliver value within 30-90 days with minimal investment.

8. INVESTMENT REQUIRED: Total estimated investment to reach next maturity level.

9. ROADMAP (4-6 phases): Phased implementation plan with timelines and milestones.

10. RECOMMENDATIONS (4-6): Prioritized actions to improve AI readiness and adoption.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating AI Readiness...");
    const result = await callJson(genai, prompt);
    return result as unknown as AIReadiness;
  } catch (e) {
    console.warn("[Pivot] AI Readiness synthesis failed:", e);
    return null;
  }
}

export async function synthesizeNetworkEffects(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<NetworkEffects | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence network effects overview",
  "overallScore": 0,
  "hasNetworkEffects": true,
  "effectTypes": [{
    "type": "Direct|Indirect|Data|Platform",
    "strength": "strong|moderate|weak|none",
    "description": "how this network effect works for the business",
    "growthMultiplier": "estimated multiplier effect",
    "defensibility": "how defensible this effect is"
  }],
  "viralCoefficient": "estimated viral coefficient or qualitative assessment",
  "criticalMass": "users/customers needed for network effects to kick in",
  "moatStrength": "strong|moderate|weak",
  "growthStrategies": ["strategy 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a network effects strategist analyzing whether a business has or can build network effects and competitive moats.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive network effects analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the business's network effects potential.

2. OVERALL SCORE (0-100): Composite score reflecting the strength and potential of network effects.

3. HAS NETWORK EFFECTS: Boolean — does this business currently benefit from any network effects?

4. EFFECT TYPES (analyze all 4):
   a. Direct Network Effects — Does the product become more valuable as more users join? (e.g., messaging apps, social networks)
   b. Indirect Network Effects — Does growth on one side of the platform attract the other side? (e.g., marketplaces, app stores)
   c. Data Network Effects — Does more usage generate more data that improves the product? (e.g., recommendation engines, AI products)
   d. Platform Network Effects — Does the business serve as a platform where third parties build value? (e.g., APIs, ecosystems)
   For each, assess strength (strong/moderate/weak/none), describe the effect, estimate the growth multiplier, and evaluate defensibility.

5. VIRAL COEFFICIENT: Estimate the viral coefficient (K-factor) — how many new users each existing user brings in. Provide a number or qualitative assessment.

6. CRITICAL MASS: Estimate the number of users/customers needed for network effects to become self-sustaining.

7. MOAT STRENGTH: Overall assessment of competitive moat from network effects (strong/moderate/weak).

8. GROWTH STRATEGIES (3-5): Specific strategies to build, strengthen, or leverage network effects.

9. RECOMMENDATIONS (4-6): Prioritized actions to maximize network effects and defensibility.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Network Effects...");
    const result = await callJson(genai, prompt);
    return result as unknown as NetworkEffects;
  } catch (e) {
    console.warn("[Pivot] Network Effects synthesis failed:", e);
    return null;
  }
}

export async function synthesizeDataMonetization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DataMonetization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence data monetization overview",
  "totalOpportunityValue": "$X total estimated opportunity",
  "dataAssets": [{
    "asset": "Customer behavior data",
    "monetizationMethod": "Analytics product",
    "estimatedValue": "$X/year",
    "effortToMonetize": "low|medium|high",
    "privacyConsiderations": "privacy risks and mitigations",
    "timeToRevenue": "X months"
  }],
  "privacyCompliance": "assessment of privacy compliance posture",
  "competitiveAdvantage": "how data monetization strengthens competitive position",
  "implementationRoadmap": ["Phase 1: ...", "Phase 2: ...", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a data strategy consultant identifying opportunities to monetize a company's existing data assets.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive data monetization assessment:

1. SUMMARY: Provide a 2-3 sentence overview of the data monetization opportunity.

2. TOTAL OPPORTUNITY VALUE: Estimate the total annual revenue opportunity from data monetization.

3. DATA ASSETS (4-6): Identify each data asset the business possesses or generates, and for each:
   - Asset name and description (e.g., "Customer behavior data", "Transaction history", "Usage analytics")
   - Monetization method (e.g., "Analytics product", "API access", "Insights reports", "Data licensing", "Predictive models")
   - Estimated annual value in dollars
   - Effort to monetize (low/medium/high)
   - Privacy considerations — specific risks and required mitigations (GDPR, CCPA, etc.)
   - Time to revenue — how long to start generating revenue from this asset

4. PRIVACY COMPLIANCE: Overall assessment of the company's readiness to monetize data while maintaining privacy compliance.

5. COMPETITIVE ADVANTAGE: How data monetization can strengthen the business's competitive moat.

6. IMPLEMENTATION ROADMAP (4-6 phases): Phased plan to build data monetization capabilities, from quick wins to mature data products.

7. RECOMMENDATIONS (4-6): Prioritized actions to capture the data monetization opportunity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Data Monetization...");
    const result = await callJson(genai, prompt);
    return result as unknown as DataMonetization;
  } catch (e) {
    console.warn("[Pivot] Data Monetization synthesis failed:", e);
    return null;
  }
}

export async function synthesizeSubscriptionMetrics(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SubscriptionMetrics | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence subscription health overview",
  "overallHealth": "strong|moderate|weak",
  "metrics": [{
    "metric": "MRR",
    "currentValue": "$X",
    "benchmark": "$X or X% (industry benchmark)",
    "status": "excellent|good|needs_improvement|critical",
    "trend": "improving|stable|declining",
    "insight": "specific insight about this metric"
  }],
  "cohortAnalysis": "analysis of customer cohort behavior",
  "expansionRevenue": "assessment of expansion revenue",
  "netRevenueRetention": "NRR percentage and analysis",
  "paybackPeriod": "CAC payback period",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a SaaS metrics analyst evaluating a subscription business's key performance indicators.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive subscription metrics analysis:

1. SUMMARY: Provide a 2-3 sentence overview of the subscription business health.

2. OVERALL HEALTH: Assessment of subscription health (strong/moderate/weak).

3. METRICS (analyze all 6 core SaaS metrics):
   a. MRR (Monthly Recurring Revenue) — Current value, industry benchmark, status, trend, and insight.
   b. ARR (Annual Recurring Revenue) — Current value, industry benchmark, status, trend, and insight.
   c. CAC (Customer Acquisition Cost) — Current value, industry benchmark, status, trend, and insight.
   d. LTV (Lifetime Value) — Current value, industry benchmark, status, trend, and insight.
   e. Churn Rate — Current value, industry benchmark, status, trend, and insight.
   f. NRR (Net Revenue Retention) — Current value, industry benchmark, status, trend, and insight.
   For each: status is excellent/good/needs_improvement/critical, trend is improving/stable/declining.

4. COHORT ANALYSIS: Insights from analyzing customer cohorts — are newer cohorts performing better or worse than older ones?

5. EXPANSION REVENUE: Assessment of upsell, cross-sell, and expansion revenue performance and opportunities.

6. NET REVENUE RETENTION: Detailed NRR analysis — what percentage of revenue is retained and expanded from existing customers?

7. PAYBACK PERIOD: How long does it take to recoup the cost of acquiring a customer?

8. RECOMMENDATIONS (4-6): Prioritized actions to improve subscription metrics.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Subscription Metrics...");
    const result = await callJson(genai, prompt);
    return result as unknown as SubscriptionMetrics;
  } catch (e) {
    console.warn("[Pivot] Subscription Metrics synthesis failed:", e);
    return null;
  }
}

export async function synthesizeMarketTiming(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketTiming | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence market timing overview",
  "overallTiming": "excellent|good|fair|poor",
  "factors": [{
    "factor": "Market maturity",
    "timing": "favorable|neutral|unfavorable",
    "window": "Next 6 months",
    "confidence": "high|medium|low",
    "rationale": "why this timing assessment"
  }],
  "windowOfOpportunity": "description of the window",
  "firstMoverAdvantage": "assessment of first mover advantage",
  "marketCyclePosition": "where in the market cycle",
  "urgentActions": ["urgent action 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a market timing strategist assessing whether conditions are favorable for a business's key initiatives.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive market timing analysis:

1. SUMMARY: Provide a 2-3 sentence overview of market timing conditions for this business.

2. OVERALL TIMING: Assessment of overall market timing (excellent/good/fair/poor).

3. FACTORS (analyze at least 4):
   a. Market Maturity — Is the market early-stage, growing, mature, or declining? Is this favorable for the business?
   b. Competitor Activity — What are competitors doing? Is there a window before they consolidate?
   c. Regulatory Changes — Are there upcoming regulatory changes that create opportunity or risk?
   d. Technology Shifts — Are there technology trends that create a timing advantage?
   e. Economic Conditions — How do macro-economic conditions affect timing?
   f. Customer Readiness — Are customers ready to adopt what the business offers?
   For each: assess timing (favorable/neutral/unfavorable), window of opportunity, confidence level, and rationale.

4. WINDOW OF OPPORTUNITY: Describe the specific window of opportunity — how long it will remain open and what could close it.

5. FIRST MOVER ADVANTAGE: Assess whether there is a first mover advantage and how significant it is.

6. MARKET CYCLE POSITION: Where is this market in its cycle? (early adoption, growth, peak, decline, renewal)

7. URGENT ACTIONS (3-5): Time-sensitive actions that must be taken within the next 90 days to capitalize on favorable timing.

8. RECOMMENDATIONS (4-6): Prioritized strategic actions based on the timing analysis.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Timing...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketTiming;
  } catch (e) {
    console.warn("[Pivot] Market Timing synthesis failed:", e);
    return null;
  }
}

export async function synthesizeScenarioStressTest(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ScenarioStressTest | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence stress test overview",
  "baselineCashRunway": "X months at current burn rate",
  "scenarios": [{
    "name": "Revenue -30%",
    "description": "detailed scenario description",
    "revenueImpact": "-$X or -X%",
    "cashRunway": "X months under this scenario",
    "breakEvenShift": "how break-even point changes",
    "survivalProbability": 75,
    "mitigationActions": ["action 1", "..."]
  }],
  "worstCaseSurvival": "description of worst case outcome",
  "resilience": "high|moderate|low",
  "capitalBuffer": "assessment of capital buffer adequacy",
  "triggerPoints": ["trigger point 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a financial stress testing analyst evaluating a business's resilience under adverse scenarios.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive scenario stress test:

1. SUMMARY: Provide a 2-3 sentence overview of the business's resilience under stress.

2. BASELINE CASH RUNWAY: How many months of cash runway does the business have at the current burn rate?

3. SCENARIOS (analyze at least 4 adverse scenarios):
   a. Revenue Drop -30% — What happens if revenue falls by 30%?
   b. Key Client Loss — What happens if the largest client or revenue source is lost?
   c. Market Downturn — What happens in a broad economic recession?
   d. Cost Spike — What happens if key costs (talent, materials, SaaS tools) increase 25%?
   e. Competitive Disruption — What happens if a well-funded competitor enters the market?
   For each scenario:
   - Detailed description of the scenario
   - Revenue impact in dollars and/or percentage
   - Adjusted cash runway under the scenario
   - How the break-even point shifts
   - Survival probability (0-100)
   - Specific mitigation actions (3-5 per scenario)

4. WORST CASE SURVIVAL: Description of the worst case outcome and whether the business can survive it.

5. RESILIENCE: Overall resilience rating (high/moderate/low).

6. CAPITAL BUFFER: Is the current capital buffer adequate to weather adverse scenarios? What additional buffer is needed?

7. TRIGGER POINTS (3-5): Early warning indicators that signal a scenario is materializing — the metrics to watch.

8. RECOMMENDATIONS (4-6): Prioritized actions to improve resilience and prepare for adverse scenarios.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Scenario Stress Test...");
    const result = await callJson(genai, prompt);
    return result as unknown as ScenarioStressTest;
  } catch (e) {
    console.warn("[Pivot] Scenario Stress Test synthesis failed:", e);
    return null;
  }
}

// ── Wave 9: Acquisition Targets ──────────────────────────────────────────────

export async function synthesizeAcquisitionTargets(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AcquisitionTargets | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of M&A strategy and opportunities",
  "strategy": "horizontal|vertical|talent|technology",
  "targets": [{
    "companyName": "Target Company",
    "industry": "Industry",
    "rationale": "Why this target is a fit",
    "estimatedValue": "$X-$Y range",
    "synergies": ["synergy 1", "..."],
    "risks": ["risk 1", "..."],
    "fitScore": 8
  }],
  "budgetRange": "$X-$Y estimated acquisition budget",
  "timeline": "Expected timeline for execution",
  "dueDiligenceChecklist": ["item 1", "..."],
  "integrationPlan": ["step 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an M&A (Mergers & Acquisitions) strategist analyzing a company for potential acquisition opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

Perform a comprehensive acquisition target analysis:

1. SUMMARY: 2-3 sentence overview of the company's M&A opportunity landscape.

2. STRATEGY: Identify the most appropriate acquisition strategy type — "horizontal" (same industry competitors), "vertical" (supply chain integration), "talent" (acqui-hires), or "technology" (tech/IP acquisition).

3. TARGETS (3-5): For each potential acquisition target, provide:
   - Company name or profile (can be hypothetical archetypes if specific names are unavailable)
   - Industry
   - Rationale for acquisition
   - Estimated value range
   - Expected synergies
   - Key risks
   - Fit score (1-10)

4. BUDGET RANGE: Realistic acquisition budget range given the company's financial position.

5. TIMELINE: Expected timeline from target identification through integration.

6. DUE DILIGENCE CHECKLIST (5-8 items): Key items to investigate before proceeding.

7. INTEGRATION PLAN (4-6 steps): Post-acquisition integration roadmap.

8. RECOMMENDATIONS (4-6): Strategic recommendations for the M&A approach.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Acquisition Targets...");
    const result = await callJson(genai, prompt);
    return result as unknown as AcquisitionTargets;
  } catch (e) {
    console.warn("[Pivot] Acquisition Targets synthesis failed:", e);
    return null;
  }
}

// ── Wave 9: Financial Ratios ─────────────────────────────────────────────────

export async function synthesizeFinancialRatios(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<FinancialRatios | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the company's financial ratio health",
  "overallHealth": "strong|moderate|weak",
  "liquidityRatios": [{
    "name": "Current Ratio",
    "value": 1.5,
    "industryAvg": 1.8,
    "status": "above|at|below",
    "interpretation": "What this ratio means for the business"
  }],
  "profitabilityRatios": [{ "name": "...", "value": 0, "industryAvg": 0, "status": "above|at|below", "interpretation": "..." }],
  "leverageRatios": [{ "name": "...", "value": 0, "industryAvg": 0, "status": "above|at|below", "interpretation": "..." }],
  "efficiencyRatios": [{ "name": "...", "value": 0, "industryAvg": 0, "status": "above|at|below", "interpretation": "..." }],
  "trendInsights": ["insight 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a financial analyst computing and evaluating key financial ratios for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Compute or estimate key financial ratios from the provided data and compare each against industry averages:

1. SUMMARY: 2-3 sentence overview of the company's financial ratio health.

2. OVERALL HEALTH: Rate the overall financial health as "strong", "moderate", or "weak".

3. LIQUIDITY RATIOS (2-4): e.g., Current Ratio, Quick Ratio, Working Capital Ratio.
   For each: name, computed value, industry average, status (above/at/below), and interpretation.

4. PROFITABILITY RATIOS (2-4): e.g., Gross Margin, Net Profit Margin, ROE, ROA.
   For each: name, computed value, industry average, status, and interpretation.

5. LEVERAGE RATIOS (2-3): e.g., Debt-to-Equity, Interest Coverage, Debt Ratio.
   For each: name, computed value, industry average, status, and interpretation.

6. EFFICIENCY RATIOS (2-3): e.g., Inventory Turnover, Receivables Turnover, Asset Turnover.
   For each: name, computed value, industry average, status, and interpretation.

7. TREND INSIGHTS (3-5): Key trends or patterns visible in the financial data.

8. RECOMMENDATIONS (4-6): Actionable steps to improve financial ratio performance.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Financial Ratios...");
    const result = await callJson(genai, prompt);
    return result as unknown as FinancialRatios;
  } catch (e) {
    console.warn("[Pivot] Financial Ratios synthesis failed:", e);
    return null;
  }
}

// ── Wave 9: Channel Mix Model ────────────────────────────────────────────────

export async function synthesizeChannelMixModel(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ChannelMixModel | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of channel mix performance",
  "channels": [{
    "channel": "Organic Search",
    "attributedRevenue": "$X",
    "costPerAcquisition": "$X",
    "roi": "X%",
    "contribution": 25,
    "trend": "growing|stable|declining"
  }],
  "optimalBudgetAllocation": [{
    "channel": "Organic Search",
    "currentPct": 20,
    "recommendedPct": 30
  }],
  "topPerformingChannel": "Channel name",
  "underperformingChannels": ["channel 1", "..."],
  "budgetRecommendation": "Overall budget reallocation guidance",
  "seasonalInsights": ["insight 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a marketing analytics expert analyzing channel performance and recommending optimal budget allocation.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Analyze marketing channel performance and recommend an optimal channel mix:

1. SUMMARY: 2-3 sentence overview of the company's marketing channel performance.

2. CHANNELS (4-8): For each marketing channel (e.g., Organic Search, Paid Social, Email, Direct, Referral, Paid Search, Content Marketing, Events):
   - Channel name
   - Attributed revenue (estimated if needed)
   - Cost per acquisition
   - ROI percentage
   - Contribution to total (percentage)
   - Trend: "growing", "stable", or "declining"

3. OPTIMAL BUDGET ALLOCATION: For each channel, provide the current percentage of budget and the recommended percentage — showing where to shift spend.

4. TOP PERFORMING CHANNEL: Identify the single best-performing channel.

5. UNDERPERFORMING CHANNELS: List channels that are underperforming relative to spend.

6. BUDGET RECOMMENDATION: Overall guidance on budget reallocation strategy.

7. SEASONAL INSIGHTS (2-4): Timing-based patterns or seasonal recommendations.

8. RECOMMENDATIONS (4-6): Actionable steps to optimize the channel mix.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Channel Mix Model...");
    const result = await callJson(genai, prompt);
    return result as unknown as ChannelMixModel;
  } catch (e) {
    console.warn("[Pivot] Channel Mix Model synthesis failed:", e);
    return null;
  }
}

// ── Wave 9: Supply Chain Risk — (moved to Wave 25 block below) ───────────────

// ── Wave 9: Regulatory Landscape ─────────────────────────────────────────────

export async function synthesizeRegulatoryLandscape(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RegulatoryLandscape | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the regulatory landscape",
  "overallComplianceScore": 0,
  "currentRegulations": [{
    "regulation": "Regulation Name",
    "jurisdiction": "Federal/State/EU/etc.",
    "status": "compliant|partial|non_compliant|not_applicable",
    "deadline": "Date or ongoing",
    "impact": "high|medium|low",
    "actionRequired": "What the company must do"
  }],
  "upcomingRegulations": [{
    "regulation": "Upcoming Regulation",
    "jurisdiction": "Jurisdiction",
    "status": "compliant|partial|non_compliant|not_applicable",
    "deadline": "Expected effective date",
    "impact": "high|medium|low",
    "actionRequired": "Preparation steps needed"
  }],
  "industrySpecificRisks": ["risk 1", "..."],
  "complianceCosts": "Estimated total compliance costs",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a regulatory compliance analyst assessing the regulatory landscape for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Analyze current and upcoming regulatory requirements:

1. SUMMARY: 2-3 sentence overview of the company's regulatory landscape and compliance posture.

2. OVERALL COMPLIANCE SCORE (0-100): Composite score reflecting estimated compliance across all relevant regulations.

3. CURRENT REGULATIONS (3-6): For each active regulation affecting this business:
   - Regulation name
   - Jurisdiction (Federal, State, EU, Industry body, etc.)
   - Compliance status: "compliant", "partial", "non_compliant", or "not_applicable"
   - Deadline or "ongoing"
   - Impact level: "high", "medium", or "low"
   - Action required to achieve or maintain compliance

4. UPCOMING REGULATIONS (2-4): For each upcoming or proposed regulation:
   - Regulation name
   - Jurisdiction
   - Status (likely "non_compliant" or "partial" since not yet in force)
   - Expected effective date
   - Impact level
   - Preparation steps needed

5. INDUSTRY-SPECIFIC RISKS (3-5): Regulatory risks unique to this company's industry.

6. COMPLIANCE COSTS: Estimated total cost of achieving and maintaining compliance.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen regulatory compliance.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Regulatory Landscape...");
    const result = await callJson(genai, prompt);
    return result as unknown as RegulatoryLandscape;
  } catch (e) {
    console.warn("[Pivot] Regulatory Landscape synthesis failed:", e);
    return null;
  }
}

// ── Wave 9: Crisis Playbook ──────────────────────────────────────────────────

export async function synthesizeCrisisPlaybook(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CrisisPlaybook | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of crisis preparedness",
  "scenarios": [{
    "scenario": "Crisis scenario name",
    "probability": "high|medium|low",
    "severity": "critical|major|moderate|minor",
    "responseSteps": ["step 1", "step 2", "..."],
    "communicationPlan": "How to communicate during this crisis",
    "recoveryTimeline": "Expected recovery time"
  }],
  "emergencyContacts": ["role/contact 1", "..."],
  "communicationTemplates": ["template description 1", "..."],
  "businessContinuityPlan": ["continuity step 1", "..."],
  "insuranceRecommendations": ["insurance type 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a crisis management consultant building pre-built response plans for common business crises.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive crisis playbook:

1. SUMMARY: 2-3 sentence overview of the company's crisis preparedness and key vulnerabilities.

2. SCENARIOS (4-7): For each potential crisis scenario relevant to this business:
   - Scenario name (e.g., "Key employee departure", "Data breach", "Cash flow crisis", "Supply chain disruption", "PR/reputation crisis", "Regulatory action", "Natural disaster")
   - Probability: "high", "medium", or "low"
   - Severity: "critical", "major", "moderate", or "minor"
   - Response steps (4-8 ordered steps)
   - Communication plan (internal and external messaging approach)
   - Recovery timeline (estimated time to return to normal operations)

3. EMERGENCY CONTACTS (4-6): Key roles and contact types needed during a crisis (e.g., "Legal counsel", "PR firm", "Insurance broker", "IT security team").

4. COMMUNICATION TEMPLATES (3-5): Brief descriptions of pre-drafted communication templates (e.g., "Customer data breach notification", "Employee all-hands crisis briefing", "Press statement template").

5. BUSINESS CONTINUITY PLAN (4-6 steps): Core steps to maintain operations during a crisis.

6. INSURANCE RECOMMENDATIONS (3-5): Types of insurance coverage relevant to the identified risks.

7. RECOMMENDATIONS (4-6): Actionable steps to improve overall crisis preparedness.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Crisis Playbook...");
    const result = await callJson(genai, prompt);
    return result as unknown as CrisisPlaybook;
  } catch (e) {
    console.warn("[Pivot] Crisis Playbook synthesis failed:", e);
    return null;
  }
}

// ── Wave 12: Competitive Intel Feed ─────────────────────────────────────────

export async function synthesizeCompetitiveIntelFeed(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CompetitiveIntelFeed | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of competitive landscape intelligence",
  "signals": [{
    "competitor": "Competitor name",
    "signalType": "Product Launch|Pricing Change|Hiring|Funding",
    "description": "What was observed",
    "impact": "high|medium|low",
    "responseNeeded": "Recommended response",
    "urgency": "immediate|soon|monitor"
  }],
  "marketShiftIndicators": ["shift 1", "..."],
  "opportunityWindows": ["opportunity 1", "..."],
  "threatLevel": "high|moderate|low",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a competitive intelligence analyst building a real-time competitor signal feed.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive competitive intelligence feed:

1. SUMMARY: 2-3 sentence overview of the competitive landscape and key dynamics affecting this business.

2. SIGNALS (4-8): For each competitor signal detected or inferred from the business data:
   - Competitor name
   - Signal type: "Product Launch", "Pricing Change", "Hiring", "Funding", or other relevant type
   - Description of the signal
   - Impact on this business: "high", "medium", or "low"
   - Response needed: specific action this business should take
   - Urgency: "immediate", "soon", or "monitor"

3. MARKET SHIFT INDICATORS (3-5): Broader market trends or shifts that could affect competitive positioning.

4. OPPORTUNITY WINDOWS (3-5): Time-sensitive opportunities this business can exploit based on competitor gaps or market changes.

5. THREAT LEVEL: Overall threat level from competition — "high", "moderate", or "low".

6. RECOMMENDATIONS (4-6): Actionable competitive strategy recommendations.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Competitive Intel Feed...");
    const result = await callJson(genai, prompt);
    return result as unknown as CompetitiveIntelFeed;
  } catch (e) {
    console.warn("[Pivot] Competitive Intel Feed synthesis failed:", e);
    return null;
  }
}

// ── Wave 12: Cash Flow Sensitivity ──────────────────────────────────────────

export async function synthesizeCashFlowSensitivity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CashFlowSensitivity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of cash flow sensitivity",
  "variables": [{
    "variable": "Revenue Growth|COGS|OpEx|Headcount",
    "currentValue": "Current value with units",
    "bestCase": "Best case value",
    "worstCase": "Worst case value",
    "cashImpact": "Dollar impact on cash flow",
    "sensitivity": "high|medium|low"
  }],
  "mostSensitiveVariable": "The variable with highest cash impact",
  "breakEvenSensitivity": "How close the business is to break-even under stress",
  "safetyMargin": "Cash buffer description",
  "scenarioComparison": "Comparison of best vs worst case scenarios",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a financial analyst performing sensitivity analysis on cash flow variables.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive cash flow sensitivity analysis:

1. SUMMARY: 2-3 sentence overview of cash flow sensitivity and key risk variables.

2. VARIABLES (4-7): For each key cash flow variable:
   - Variable name (e.g., "Revenue Growth", "COGS", "OpEx", "Headcount", "Payment Terms", "Churn Rate")
   - Current value with units
   - Best case value (optimistic scenario)
   - Worst case value (pessimistic scenario)
   - Cash impact: dollar-denominated impact on monthly/annual cash flow
   - Sensitivity: "high", "medium", or "low"

3. MOST SENSITIVE VARIABLE: Which single variable has the largest cash flow impact.

4. BREAK-EVEN SENSITIVITY: How much the most sensitive variable would need to change to push the business to break-even or negative cash flow.

5. SAFETY MARGIN: Current cash buffer and how many months of runway exist under worst-case assumptions.

6. SCENARIO COMPARISON: Narrative comparing best-case vs worst-case overall cash position.

7. RECOMMENDATIONS (4-6): Actions to reduce cash flow sensitivity and increase resilience.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cash Flow Sensitivity...");
    const result = await callJson(genai, prompt);
    return result as unknown as CashFlowSensitivity;
  } catch (e) {
    console.warn("[Pivot] Cash Flow Sensitivity synthesis failed:", e);
    return null;
  }
}

// ── Wave 12: Digital Maturity ───────────────────────────────────────────────

export async function synthesizeDigitalMaturity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DigitalMaturity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of digital maturity",
  "overallScore": 0,
  "dimensions": [{
    "dimension": "Customer Experience|Operations|Technology|Data & Analytics",
    "maturity": "leading|advanced|intermediate|developing|nascent",
    "score": 0,
    "gaps": ["gap 1", "..."],
    "nextSteps": ["step 1", "..."]
  }],
  "industryComparison": "How this business compares to industry peers digitally",
  "transformationPriorities": ["priority 1", "..."],
  "investmentAreas": ["area 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a digital transformation consultant assessing organizational digital readiness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive digital maturity assessment:

1. SUMMARY: 2-3 sentence overview of digital transformation readiness and key findings.

2. OVERALL SCORE: 0-100 composite digital maturity score.

3. DIMENSIONS (4-6): For each digital dimension:
   - Dimension name (e.g., "Customer Experience", "Operations", "Technology", "Data & Analytics", "Culture & Talent", "Innovation")
   - Maturity level: "leading", "advanced", "intermediate", "developing", or "nascent"
   - Score: 0-100
   - Gaps (2-4): Specific capability gaps in this dimension
   - Next steps (2-3): Immediate actions to advance maturity

4. INDUSTRY COMPARISON: How this business's digital maturity compares to industry peers and benchmarks.

5. TRANSFORMATION PRIORITIES (3-5): Ranked list of highest-impact digital transformation initiatives.

6. INVESTMENT AREAS (3-5): Where digital investment would yield the highest returns.

7. RECOMMENDATIONS (4-6): Actionable steps to advance digital maturity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Digital Maturity...");
    const result = await callJson(genai, prompt);
    return result as unknown as DigitalMaturity;
  } catch (e) {
    console.warn("[Pivot] Digital Maturity synthesis failed:", e);
    return null;
  }
}

// ── Wave 12: Acquisition Funnel ─────────────────────────────────────────────

export async function synthesizeAcquisitionFunnel(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AcquisitionFunnel | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer acquisition funnel",
  "stages": [{
    "stage": "Awareness|Interest|Consideration|Intent|Purchase",
    "volume": "Number or estimate at this stage",
    "conversionRate": "Percentage converting to next stage",
    "dropOffRate": "Percentage lost at this stage",
    "avgTimeInStage": "Average time spent in this stage",
    "bottleneck": "Key issue causing drop-off"
  }],
  "overallConversionRate": "End-to-end conversion rate",
  "biggestBottleneck": "The single largest funnel bottleneck",
  "costPerAcquisition": "Average CPA",
  "channelBreakdown": [{
    "channel": "Channel name",
    "contribution": "Percentage of acquisitions",
    "cpa": "Cost per acquisition for this channel"
  }],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a growth marketing analyst mapping the customer acquisition funnel end-to-end.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive customer acquisition funnel analysis:

1. SUMMARY: 2-3 sentence overview of acquisition funnel health and key findings.

2. STAGES (4-6): For each funnel stage:
   - Stage name (e.g., "Awareness", "Interest", "Consideration", "Intent", "Purchase", "Onboarding")
   - Volume: number or estimate of prospects at this stage
   - Conversion rate to next stage (percentage)
   - Drop-off rate at this stage (percentage)
   - Average time in stage
   - Key bottleneck or friction point causing drop-off

3. OVERALL CONVERSION RATE: End-to-end conversion from top of funnel to customer.

4. BIGGEST BOTTLENECK: The single stage with the most impactful drop-off, with explanation.

5. COST PER ACQUISITION: Average CPA across all channels.

6. CHANNEL BREAKDOWN (3-6): For each acquisition channel:
   - Channel name (e.g., "Organic Search", "Paid Ads", "Referrals", "Social Media", "Direct Sales")
   - Contribution: percentage of total acquisitions
   - CPA for this channel

7. RECOMMENDATIONS (4-6): Actionable steps to improve funnel conversion and reduce CPA.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Acquisition Funnel...");
    const result = await callJson(genai, prompt);
    return result as unknown as AcquisitionFunnel;
  } catch (e) {
    console.warn("[Pivot] Acquisition Funnel synthesis failed:", e);
    return null;
  }
}

// ── Wave 12: Strategic Alignment ────────────────────────────────────────────

export async function synthesizeStrategicAlignment(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<StrategicAlignment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of strategic alignment",
  "overallScore": 0,
  "areas": [{
    "area": "Vision|Goals|Resources|Execution",
    "alignmentScore": 0,
    "gaps": ["gap 1", "..."],
    "actions": ["action 1", "..."]
  }],
  "missionVisionClarity": "Assessment of mission/vision clarity",
  "resourceAllocationFit": "How well resources match stated priorities",
  "executionGaps": ["gap 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a strategy consultant assessing the alignment between vision, goals, resources, and execution.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive strategic alignment assessment:

1. SUMMARY: 2-3 sentence overview of how well the organization's strategy is aligned across dimensions.

2. OVERALL SCORE: 0-100 composite alignment score.

3. AREAS (4): For each alignment area:
   - Area name: "Vision", "Goals", "Resources", "Execution"
   - Alignment score: 0-100
   - Gaps (2-4): Specific misalignments or disconnects
   - Actions (2-3): Steps to close each gap

4. MISSION/VISION CLARITY: Assessment of how clearly the mission and vision are defined and communicated.

5. RESOURCE ALLOCATION FIT: How well current resource allocation matches stated strategic priorities.

6. EXECUTION GAPS (3-5): Specific areas where strategy is not translating into action.

7. RECOMMENDATIONS (4-6): Actionable steps to improve strategic alignment.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Strategic Alignment...");
    const result = await callJson(genai, prompt);
    return result as unknown as StrategicAlignment;
  } catch (e) {
    console.warn("[Pivot] Strategic Alignment synthesis failed:", e);
    return null;
  }
}

// ── Wave 12: Budget Optimizer ───────────────────────────────────────────────

export async function synthesizeBudgetOptimizer(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<BudgetOptimizer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of budget optimization findings",
  "totalBudget": "Total annual or monthly budget",
  "categories": [{
    "category": "Marketing|Engineering|Sales|Operations|R&D",
    "currentAllocation": "Current spend amount or percentage",
    "recommendedAllocation": "Recommended spend amount or percentage",
    "roi": "Estimated ROI for this category",
    "efficiency": "optimal|over_allocated|under_allocated",
    "reallocationSuggestion": "Specific reallocation recommendation"
  }],
  "savingsOpportunity": "Total potential savings",
  "roiImprovementPotential": "Estimated ROI improvement from optimization",
  "topReallocation": "Single highest-impact budget reallocation",
  "wastageAreas": ["wastage area 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a financial optimization consultant analyzing budget allocation for maximum ROI.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Build a comprehensive budget optimization analysis:

1. SUMMARY: 2-3 sentence overview of budget efficiency and key optimization opportunities.

2. TOTAL BUDGET: The total budget being analyzed (annual or monthly, with units).

3. CATEGORIES (4-7): For each budget category:
   - Category name (e.g., "Marketing", "Engineering", "Sales", "Operations", "R&D", "G&A", "Customer Success")
   - Current allocation: current spend amount or percentage
   - Recommended allocation: optimized spend amount or percentage
   - ROI: estimated return on investment for this category
   - Efficiency: "optimal", "over_allocated", or "under_allocated"
   - Reallocation suggestion: specific recommendation for how to adjust

4. SAVINGS OPPORTUNITY: Total potential savings from optimization.

5. ROI IMPROVEMENT POTENTIAL: Estimated overall ROI improvement if recommendations are implemented.

6. TOP REALLOCATION: The single highest-impact budget reallocation move.

7. WASTAGE AREAS (3-5): Specific areas where budget is being wasted or underperforming.

8. RECOMMENDATIONS (4-6): Actionable budget optimization steps.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Budget Optimizer...");
    const result = await callJson(genai, prompt);
    return result as unknown as BudgetOptimizer;
  } catch (e) {
    console.warn("[Pivot] Budget Optimizer synthesis failed:", e);
    return null;
  }
}

// ── Wave 11: Pricing Strategy Matrix ─────────────────────────────────────────

export async function synthesizePricingStrategyMatrix(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PricingStrategyMatrix | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of pricing strategy",
  "currentStrategy": "Description of current pricing approach",
  "recommendedStrategy": "Recommended pricing model/approach",
  "tiers": [{
    "tierName": "Tier name",
    "priceRange": "$X - $Y",
    "targetSegment": "Target customer segment",
    "valueProposition": "Key value proposition for this tier",
    "marginEstimate": "Estimated margin %",
    "competitorComparison": "How this compares to competitor pricing"
  }],
  "priceAnchor": "Recommended price anchor strategy",
  "psychologicalPricingTips": ["tip 1", "..."],
  "bundlingOpportunities": ["opportunity 1", "..."],
  "discountPolicy": "Recommended discount policy",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a pricing strategy expert analyzing a business's pricing model and recommending optimizations.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive pricing strategy matrix:

1. SUMMARY: 2-3 sentence overview of the current pricing posture and top opportunity.

2. CURRENT STRATEGY: Describe the business's current pricing approach based on the data provided.

3. RECOMMENDED STRATEGY: A clear recommendation for the optimal pricing model (value-based, cost-plus, competitive, freemium, usage-based, etc.) and why.

4. TIERS (3-5): For each pricing tier:
   - Tier name (e.g., "Starter", "Professional", "Enterprise")
   - Price range
   - Target customer segment
   - Value proposition specific to this tier
   - Estimated margin percentage
   - How it compares to competitors

5. PRICE ANCHOR: A specific anchor pricing strategy to frame value perception.

6. PSYCHOLOGICAL PRICING TIPS (3-5): Tactics like charm pricing, decoy effect, price framing.

7. BUNDLING OPPORTUNITIES (3-5): Product/service bundles that could increase average deal size.

8. DISCOUNT POLICY: A recommended discount policy that protects margins while enabling sales flexibility.

9. RECOMMENDATIONS (4-6): Actionable steps to optimize pricing for revenue growth.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Pricing Strategy Matrix...");
    const result = await callJson(genai, prompt);
    return result as unknown as PricingStrategyMatrix;
  } catch (e) {
    console.warn("[Pivot] Pricing Strategy Matrix synthesis failed:", e);
    return null;
  }
}

// ── Wave 11: Customer Health Score — (moved to Wave 26 block below) ──────────

// ── Wave 11: Revenue Waterfall ───────────────────────────────────────────────

export async function synthesizeRevenueWaterfall(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueWaterfall | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of revenue waterfall dynamics",
  "period": "Analysis period (e.g., Last 12 months)",
  "items": [{
    "category": "Beginning MRR|New|Expansion|Contraction|Churn|Ending MRR",
    "amount": "$X",
    "percentage": "X%",
    "trend": "positive|neutral|negative"
  }],
  "netRevenueRetention": "X%",
  "grossRevenueRetention": "X%",
  "expansionRate": "X%",
  "contractionRate": "X%",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a SaaS/revenue analytics expert building a monthly recurring revenue waterfall analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive MRR waterfall analysis:

1. SUMMARY: 2-3 sentence overview of revenue dynamics — is the business growing, contracting, or stagnating, and why?

2. PERIOD: The time period this analysis covers.

3. ITEMS (6 required categories): Build the waterfall with these exact categories:
   - "Beginning MRR" — starting monthly recurring revenue
   - "New" — MRR from new customers acquired during the period
   - "Expansion" — MRR increase from upsells, cross-sells, upgrades of existing customers
   - "Contraction" — MRR decrease from downgrades of existing customers
   - "Churn" — MRR lost from customers who left entirely
   - "Ending MRR" — resulting MRR at end of period
   For each: amount (dollar value), percentage (of beginning MRR), and trend ("positive", "neutral", or "negative").

4. NET REVENUE RETENTION (NRR): Percentage — (Beginning MRR + Expansion - Contraction - Churn) / Beginning MRR.

5. GROSS REVENUE RETENTION (GRR): Percentage — (Beginning MRR - Contraction - Churn) / Beginning MRR.

6. EXPANSION RATE: Expansion MRR as a percentage of Beginning MRR.

7. CONTRACTION RATE: Contraction MRR as a percentage of Beginning MRR.

8. RECOMMENDATIONS (4-6): Actionable steps to improve NRR and reduce churn/contraction.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Waterfall...");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueWaterfall;
  } catch (e) {
    console.warn("[Pivot] Revenue Waterfall synthesis failed:", e);
    return null;
  }
}

// ── Wave 11: Tech Debt Assessment ────────────────────────────────────────────

export async function synthesizeTechDebtAssessment(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TechDebtAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of technical debt posture",
  "overallScore": 0,
  "totalEstimatedCost": "$X",
  "items": [{
    "area": "Architecture|Dependencies|Testing|Security|Infrastructure|Code Quality",
    "severity": "critical|high|medium|low",
    "description": "Description of the debt item",
    "businessImpact": "How this affects the business",
    "estimatedEffort": "Time/cost to remediate",
    "priority": 1
  }],
  "quickWins": ["quick win 1", "..."],
  "longTermInvestments": ["investment 1", "..."],
  "riskIfIgnored": "Description of risk if tech debt is not addressed",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a technical debt analyst assessing the technical health and debt burden of a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive technical debt assessment:

1. SUMMARY: 2-3 sentence overview of the company's technical debt posture and its business impact.

2. OVERALL SCORE (0-100): Higher means less debt / healthier codebase. Score conservatively based on available data.

3. TOTAL ESTIMATED COST: Estimated total cost to remediate all identified technical debt.

4. ITEMS (5-8): For each technical debt item:
   - Area: "Architecture", "Dependencies", "Testing", "Security", "Infrastructure", or "Code Quality"
   - Severity: "critical", "high", "medium", or "low"
   - Description of the specific debt
   - Business impact: How this technical debt affects revenue, velocity, reliability, or growth
   - Estimated effort to remediate (person-weeks or dollar cost)
   - Priority (1-10, where 1 is highest priority)

5. QUICK WINS (3-5): Low-effort, high-impact technical debt items that can be resolved quickly.

6. LONG-TERM INVESTMENTS (3-5): Strategic technical investments that require significant effort but yield large returns.

7. RISK IF IGNORED: Clear description of what happens if the tech debt is not addressed over the next 12-18 months.

8. RECOMMENDATIONS (4-6): Actionable steps to systematically reduce technical debt.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Tech Debt Assessment...");
    const result = await callJson(genai, prompt);
    return result as unknown as TechDebtAssessment;
  } catch (e) {
    console.warn("[Pivot] Tech Debt Assessment synthesis failed:", e);
    return null;
  }
}

// ── Wave 11: Team Performance ────────────────────────────────────────────────

export async function synthesizeTeamPerformance(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TeamPerformance | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of team performance",
  "overallScore": 0,
  "metrics": [{
    "metric": "Productivity|Collaboration|Skill Coverage|Retention|Innovation|Execution Speed",
    "score": 0,
    "benchmark": "Industry benchmark comparison",
    "insight": "Specific insight about this metric"
  }],
  "strengths": ["strength 1", "..."],
  "gaps": ["gap 1", "..."],
  "trainingNeeds": ["training need 1", "..."],
  "cultureInsights": ["culture insight 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational performance analyst evaluating team effectiveness and identifying improvement areas.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive team performance analysis:

1. SUMMARY: 2-3 sentence overview of team performance and the most important finding.

2. OVERALL SCORE (0-100): Composite team performance score reflecting productivity, collaboration, skill coverage, and execution.

3. METRICS (5-7): For each performance dimension:
   - Metric name (e.g., "Productivity", "Collaboration", "Skill Coverage", "Retention", "Innovation", "Execution Speed")
   - Score (0-100)
   - Industry benchmark comparison
   - Specific insight about what's driving this score

4. STRENGTHS (3-5): Key team strengths that the business should leverage and protect.

5. GAPS (3-5): Critical skill gaps, resource gaps, or performance gaps holding the team back.

6. TRAINING NEEDS (3-5): Specific training or upskilling investments that would yield the highest ROI.

7. CULTURE INSIGHTS (3-5): Observations about team culture, morale, and organizational health.

8. RECOMMENDATIONS (4-6): Actionable steps to improve team performance, close gaps, and build on strengths.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Team Performance...");
    const result = await callJson(genai, prompt);
    return result as unknown as TeamPerformance;
  } catch (e) {
    console.warn("[Pivot] Team Performance synthesis failed:", e);
    return null;
  }
}

// ── Wave 11: Market Entry Strategy ───────────────────────────────────────────

export async function synthesizeMarketEntryStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketEntryStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of market entry readiness and top opportunity",
  "readinessScore": 0,
  "markets": [{
    "market": "Market name/description",
    "entryMode": "Direct|Partnership|Acquisition|Franchise",
    "marketSize": "$X or description",
    "competitionLevel": "high|medium|low",
    "investmentRequired": "$X or description",
    "timeToRevenue": "Estimated time to first revenue",
    "riskLevel": "high|medium|low",
    "fitScore": 1
  }],
  "priorityMarket": "The single best market to enter first",
  "goToMarketApproach": "Recommended GTM approach for the priority market",
  "resourceRequirements": ["resource 1", "..."],
  "barriers": ["barrier 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a market expansion strategist evaluating new market entry opportunities for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive market entry strategy:

1. SUMMARY: 2-3 sentence overview of the company's readiness for market expansion and the top opportunity.

2. READINESS SCORE (0-100): How prepared is this business to enter a new market? Consider financial resources, product maturity, team capacity, and operational scalability.

3. MARKETS (3-5): For each potential new market:
   - Market name/description (geographic, vertical, or segment)
   - Entry mode: "Direct", "Partnership", "Acquisition", or "Franchise"
   - Market size (estimated TAM)
   - Competition level: "high", "medium", or "low"
   - Investment required to enter
   - Time to first revenue
   - Risk level: "high", "medium", or "low"
   - Fit score (1-10): How well does this market align with the company's current strengths?

4. PRIORITY MARKET: Which single market should the business enter first, and why?

5. GO-TO-MARKET APPROACH: A specific GTM strategy for the priority market.

6. RESOURCE REQUIREMENTS (4-6): What the business needs to invest (people, capital, technology, partnerships) to execute market entry.

7. BARRIERS (4-6): Key barriers to entry and how to overcome them.

8. RECOMMENDATIONS (4-6): Actionable steps to prepare for and execute market entry.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Entry Strategy...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketEntryStrategy;
  } catch (e) {
    console.warn("[Pivot] Market Entry Strategy synthesis failed:", e);
    return null;
  }
}

// ── Wave 16: Financial Planning & Strategy (Legacy — superseded by Wave 31) ──

export async function synthesizeWorkingCapitalLegacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<WorkingCapital | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of working capital position",
  "cashConversionCycleDays": 0,
  "metrics": [{
    "metric": "DSO|DPO|DIO",
    "current": "X days",
    "benchmark": "X days (industry average)",
    "trend": "improving|stable|worsening",
    "impact": "dollar or operational impact description"
  }],
  "currentWorkingCapital": "$X",
  "optimizedWorkingCapital": "$X",
  "freeableCash": "$X",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a working capital optimization specialist analyzing cash conversion efficiency and identifying trapped cash.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive working capital analysis:

1. SUMMARY: 2-3 sentence overview of working capital health and the biggest optimization opportunity.

2. CASH CONVERSION CYCLE: Calculate the total cash conversion cycle in days (DSO + DIO - DPO). If exact data is unavailable, estimate conservatively based on industry and revenue range.

3. METRICS (3 required — DSO, DPO, DIO): For each:
   - Metric name ("DSO" for Days Sales Outstanding, "DPO" for Days Payable Outstanding, "DIO" for Days Inventory Outstanding)
   - Current value in days
   - Industry benchmark in days
   - Trend: improving, stable, or worsening
   - Dollar or operational impact of the current position

4. CURRENT WORKING CAPITAL: The current net working capital position (current assets minus current liabilities).

5. OPTIMIZED WORKING CAPITAL: What working capital would be if DSO/DPO/DIO were brought to industry benchmarks.

6. FREEABLE CASH: The dollar amount that could be freed by optimizing the cash conversion cycle to benchmarks.

7. RECOMMENDATIONS (4-6): Specific, actionable steps to optimize working capital — accelerate receivables, manage payables, reduce inventory, etc.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Working Capital...");
    const result = await callJson(genai, prompt);
    return result as unknown as WorkingCapital;
  } catch (e) {
    console.warn("[Pivot] Working Capital synthesis failed:", e);
    return null;
  }
}

export async function synthesizeDebtStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DebtStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of debt position and strategy",
  "totalDebt": "$X",
  "debtToEquity": "X.Xx",
  "interestCoverage": "X.Xx",
  "instruments": [{
    "type": "Term Loan|Line of Credit|Bond|Convertible Note|SBA Loan|Other",
    "amount": "$X",
    "interestRate": "X.X%",
    "maturity": "YYYY-MM or description",
    "covenantStatus": "in_compliance|at_risk|breached",
    "refinancingOpportunity": true
  }],
  "optimalStructure": "description of optimal debt structure",
  "debtCapacity": "$X additional debt capacity",
  "refinancingSavings": "$X annual savings from refinancing",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a debt strategy advisor analyzing capital structure, debt capacity, and refinancing opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive debt strategy analysis:

1. SUMMARY: 2-3 sentence overview of the company's debt position and the most impactful strategic recommendation.

2. TOTAL DEBT: Sum of all outstanding debt obligations.

3. DEBT-TO-EQUITY RATIO: Current ratio and how it compares to industry norms.

4. INTEREST COVERAGE RATIO: EBIT divided by interest expense — how comfortably can the business service its debt?

5. INSTRUMENTS (list all identified debt instruments): For each:
   - Type (Term Loan, Line of Credit, Bond, Convertible Note, SBA Loan, etc.)
   - Outstanding amount
   - Interest rate
   - Maturity date or term
   - Covenant status: "in_compliance", "at_risk", or "breached"
   - Whether there is a refinancing opportunity (true/false)

6. OPTIMAL STRUCTURE: What would the ideal debt structure look like for this business given its size, industry, and growth stage?

7. DEBT CAPACITY: How much additional debt could this business responsibly take on?

8. REFINANCING SAVINGS: Estimated annual interest savings if existing debt were refinanced at current market rates.

9. RECOMMENDATIONS (4-6): Actionable steps to optimize debt structure, reduce interest costs, maintain covenant compliance, and leverage debt capacity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Debt Strategy...");
    const result = await callJson(genai, prompt);
    return result as unknown as DebtStrategy;
  } catch (e) {
    console.warn("[Pivot] Debt Strategy synthesis failed:", e);
    return null;
  }
}

// Legacy — superseded by Wave 31
export async function synthesizeTaxStrategyLegacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TaxStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of tax position and optimization opportunities",
  "effectiveTaxRate": "X.X%",
  "optimizedTaxRate": "X.X%",
  "opportunities": [{
    "strategy": "description of the tax strategy",
    "estimatedSavings": "$X",
    "complexity": "low|medium|high",
    "timeline": "immediate|1-3 months|3-6 months|6-12 months",
    "requirements": ["requirement 1", "..."]
  }],
  "rdCredits": "assessment of R&D tax credit eligibility and estimated value",
  "entityStructure": "analysis of current entity structure and optimization options",
  "jurisdictionAnalysis": "analysis of tax jurisdiction positioning",
  "totalPotentialSavings": "$X",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a tax strategy advisor analyzing tax efficiency, credits, entity structure, and jurisdiction optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive tax strategy analysis:

1. SUMMARY: 2-3 sentence overview of the company's tax position and the highest-value optimization opportunity.

2. EFFECTIVE TAX RATE: Current effective tax rate based on available financial data.

3. OPTIMIZED TAX RATE: What the effective tax rate could be with proper tax planning.

4. OPPORTUNITIES (4-6): For each tax optimization opportunity:
   - Strategy description
   - Estimated annual savings
   - Complexity: "low", "medium", or "high"
   - Timeline to implement: "immediate", "1-3 months", "3-6 months", or "6-12 months"
   - Requirements to execute (list of prerequisites)

5. R&D CREDITS: Assessment of R&D tax credit eligibility — does the business qualify? Estimated credit value? What activities qualify?

6. ENTITY STRUCTURE: Analysis of whether the current entity structure (LLC, S-Corp, C-Corp, etc.) is optimal for tax purposes. What changes could reduce tax burden?

7. JURISDICTION ANALYSIS: Are there state, local, or international tax positioning opportunities given the business's location and operations?

8. TOTAL POTENTIAL SAVINGS: Sum of all identified tax optimization opportunities.

9. RECOMMENDATIONS (4-6): Prioritized, actionable tax planning steps. Note: this is strategic guidance, not legal/tax advice — recommend consulting a CPA/tax attorney for implementation.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Tax Strategy...");
    const result = await callJson(genai, prompt);
    return result as unknown as TaxStrategy;
  } catch (e) {
    console.warn("[Pivot] Tax Strategy synthesis failed:", e);
    return null;
  }
}

export async function synthesizeInvestorReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<InvestorReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of investor readiness",
  "overallScore": 0,
  "areas": [{
    "area": "Financial Metrics|Team & Governance|Product & Market|Legal & Compliance|Pitch & Story",
    "score": 0,
    "gaps": ["gap 1", "..."],
    "actions": ["action to close gap", "..."]
  }],
  "pitchDeckReadiness": "assessment of pitch deck completeness and quality",
  "metricsCompleteness": "assessment of key investor metrics availability",
  "governanceScore": 0,
  "dueDiligencePrep": "assessment of due diligence readiness",
  "targetValuation": "$X or range",
  "fundingStage": "Pre-Seed|Seed|Series A|Series B|Growth|Late Stage",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an investor readiness advisor evaluating how prepared a business is to raise capital from investors.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive investor readiness assessment:

1. SUMMARY: 2-3 sentence overview of how ready this business is for fundraising and the most critical gap to close.

2. OVERALL SCORE (0-100): Composite investor readiness score across all dimensions.

3. AREAS (5 required): For each investor readiness dimension:
   - Area name: "Financial Metrics", "Team & Governance", "Product & Market", "Legal & Compliance", "Pitch & Story"
   - Score (0-100)
   - Gaps: What's missing or weak in this area? (2-4 items)
   - Actions: Specific steps to close each gap (2-4 items)

4. PITCH DECK READINESS: Is the business able to tell a compelling investment story? What elements are strong and what's missing?

5. METRICS COMPLETENESS: Does the business track and can it present the key metrics investors expect (MRR, CAC, LTV, churn, growth rate, unit economics)?

6. GOVERNANCE SCORE (0-100): How mature is the company's governance — board structure, cap table, legal docs, financial controls?

7. DUE DILIGENCE PREP: How prepared is the business for investor due diligence? What data room items are ready vs. missing?

8. TARGET VALUATION: Based on metrics, growth, and market, what valuation range is defensible?

9. FUNDING STAGE: What funding stage is appropriate — Pre-Seed, Seed, Series A, Series B, Growth, or Late Stage?

10. RECOMMENDATIONS (4-6): Prioritized steps to become investor-ready, with specific timelines.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Investor Readiness...");
    const result = await callJson(genai, prompt);
    return result as unknown as InvestorReadiness;
  } catch (e) {
    console.warn("[Pivot] Investor Readiness synthesis failed:", e);
    return null;
  }
}

export async function synthesizeMAReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MAReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of M&A readiness",
  "overallReadiness": 0,
  "valuationMultiple": "X.Xx revenue or EBITDA multiple",
  "estimatedValuation": "$X",
  "synergies": [{
    "area": "description of synergy area",
    "type": "revenue|cost|strategic",
    "estimatedValue": "$X",
    "probability": "high|medium|low",
    "timeline": "0-6 months|6-12 months|12-24 months"
  }],
  "integrationComplexity": "low|medium|high",
  "dealStructure": "recommended deal structure description",
  "keyRisks": ["risk 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an M&A readiness advisor evaluating whether a business is prepared for acquisition (as target or acquirer) and identifying value optimization opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive M&A readiness assessment:

1. SUMMARY: 2-3 sentence overview of M&A readiness and the most important finding.

2. OVERALL READINESS (0-100): How prepared is this business for an M&A transaction?

3. VALUATION MULTIPLE: What revenue or EBITDA multiple is appropriate for this business given its industry, growth rate, and profitability?

4. ESTIMATED VALUATION: Based on the multiple and available financial data, what is the estimated enterprise value?

5. SYNERGIES (3-5): For each potential synergy area in an M&A scenario:
   - Area description
   - Type: "revenue" (cross-sell, market access), "cost" (eliminating redundancies), or "strategic" (IP, talent, positioning)
   - Estimated value
   - Probability: "high", "medium", or "low"
   - Timeline to realize: "0-6 months", "6-12 months", or "12-24 months"

6. INTEGRATION COMPLEXITY: How complex would integrating this business be — "low", "medium", or "high"? Consider technology, culture, operations, and customer overlap.

7. DEAL STRUCTURE: What deal structure would be most favorable (all-cash, stock swap, earnout, etc.) and why?

8. KEY RISKS (4-6): Major risks that could derail or devalue an M&A transaction.

9. RECOMMENDATIONS (4-6): Actionable steps to increase M&A readiness and maximize valuation.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating M&A Readiness...");
    const result = await callJson(genai, prompt);
    return result as unknown as MAReadiness;
  } catch (e) {
    console.warn("[Pivot] M&A Readiness synthesis failed:", e);
    return null;
  }
}

export async function synthesizeStrategicRoadmap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<StrategicRoadmap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the strategic roadmap",
  "vision": "1-2 sentence long-term vision statement",
  "strategicPillars": ["pillar 1", "pillar 2", "..."],
  "milestones": [{
    "milestone": "description of the milestone",
    "timeframe": "Q1 2025|Year 2|etc.",
    "status": "on_track|at_risk|behind|not_started",
    "dependencies": ["dependency 1", "..."],
    "kpis": ["KPI to measure progress", "..."]
  }],
  "yearOneGoals": ["goal 1", "..."],
  "yearThreeGoals": ["goal 1", "..."],
  "yearFiveGoals": ["goal 1", "..."],
  "okrs": [{
    "objective": "strategic objective",
    "keyResults": ["key result 1", "key result 2", "..."]
  }],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a strategic planning advisor building a comprehensive multi-year roadmap with measurable milestones and OKRs.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Primary Objective: ${questionnaire.primaryObjective ?? "Not specified"}

Produce a comprehensive strategic roadmap:

1. SUMMARY: 2-3 sentence overview of the strategic direction and the most critical priorities.

2. VISION: A compelling 1-2 sentence long-term vision statement for where this business should be in 5 years.

3. STRATEGIC PILLARS (3-5): The core strategic themes that should guide all decisions and resource allocation.

4. MILESTONES (6-10): Key milestones across the 1/3/5 year horizon. For each:
   - Milestone description
   - Timeframe (e.g., "Q2 2025", "Year 1 H2", "Year 3")
   - Status: "not_started" for future milestones, or assess based on current data
   - Dependencies: What must happen first? (1-3 items)
   - KPIs: How will progress be measured? (1-3 metrics)

5. YEAR ONE GOALS (4-6): Specific, measurable goals for the next 12 months.

6. YEAR THREE GOALS (3-5): Where should the business be in 3 years? Revenue, market position, team size, product maturity.

7. YEAR FIVE GOALS (3-4): The ambitious 5-year targets that align with the vision.

8. OKRs (3-5): Objectives and Key Results framework for the next 12 months. Each OKR should have 1 objective and 2-4 measurable key results.

9. RECOMMENDATIONS (4-6): Actionable strategic planning steps — what to start, stop, and continue.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Strategic Roadmap...");
    const result = await callJson(genai, prompt);
    return result as unknown as StrategicRoadmap;
  } catch (e) {
    console.warn("[Pivot] Strategic Roadmap synthesis failed:", e);
    return null;
  }
}

// ── Wave 14: Process Efficiency ──────────────────────────────────────────────

export async function synthesizeProcessEfficiency(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ProcessEfficiency | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of process efficiency posture",
  "overallEfficiencyScore": 0,
  "processes": [{
    "process": "Process name",
    "currentCycleTime": "Current cycle time",
    "benchmarkCycleTime": "Industry benchmark cycle time",
    "bottleneck": "Primary bottleneck in this process",
    "automationPotential": "high|medium|low",
    "estimatedSavings": "$X or time savings"
  }],
  "topBottleneck": "The single biggest bottleneck across all processes",
  "totalAutomationSavings": "$X total estimated automation savings",
  "leanScore": 0,
  "wastageAreas": ["wastage area 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an operational excellence consultant performing a process efficiency audit for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive process efficiency analysis:

1. SUMMARY: 2-3 sentence overview of the company's operational efficiency posture and the biggest improvement opportunity.

2. OVERALL EFFICIENCY SCORE (0-100): A composite score reflecting how efficiently the business runs its core processes. Consider cycle times, automation levels, handoff friction, and rework rates.

3. PROCESSES (4-6): For each key business process:
   - Process name (e.g., "Order Fulfillment", "Customer Onboarding", "Invoice-to-Cash")
   - Current cycle time (estimated duration)
   - Benchmark cycle time (industry best practice)
   - Bottleneck: the primary constraint slowing this process
   - Automation potential: "high", "medium", or "low"
   - Estimated savings from optimizing this process

4. TOP BOTTLENECK: Identify the single biggest bottleneck across all processes and explain why it matters most.

5. TOTAL AUTOMATION SAVINGS: Aggregate estimated savings if all high-potential automation opportunities are realized.

6. LEAN SCORE (0-100): How well does the business adhere to lean principles (waste elimination, continuous improvement, value-stream focus)?

7. WASTAGE AREAS (4-6): Specific areas where the business is wasting time, money, or resources.

8. RECOMMENDATIONS (4-6): Actionable steps to improve process efficiency, prioritized by impact.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Process Efficiency...");
    const result = await callJson(genai, prompt);
    return result as unknown as ProcessEfficiency;
  } catch (e) {
    console.warn("[Pivot] Process Efficiency synthesis failed:", e);
    return null;
  }
}

// ── Wave 14: Vendor Risk ─────────────────────────────────────────────────────

export async function synthesizeVendorRisk(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<VendorRisk | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of vendor risk posture",
  "overallRiskScore": 0,
  "vendors": [{
    "vendor": "Vendor name",
    "category": "Vendor category (e.g., Cloud, SaaS, Logistics)",
    "dependencyLevel": "critical|high|medium|low",
    "concentrationRisk": "Description of concentration risk",
    "slaCompliance": "SLA compliance status or percentage",
    "alternativeAvailable": true,
    "contractExpiry": "Contract expiry date or timeframe"
  }],
  "criticalDependencies": ["dependency 1", "..."],
  "singlePointsOfFailure": ["SPOF 1", "..."],
  "diversificationScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a vendor risk management specialist assessing third-party vendor risks for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive vendor risk assessment:

1. SUMMARY: 2-3 sentence overview of the company's vendor risk posture and top vulnerability.

2. OVERALL RISK SCORE (0-100): A composite score where higher means more risk. Consider vendor concentration, dependency levels, SLA performance, and alternative availability.

3. VENDORS (4-6): For each key vendor/supplier:
   - Vendor name or category
   - Category (e.g., "Cloud Infrastructure", "Payment Processing", "Logistics")
   - Dependency level: "critical", "high", "medium", or "low"
   - Concentration risk: what happens if this vendor fails
   - SLA compliance: current compliance status or percentage
   - Alternative available: true or false
   - Contract expiry: when the current contract ends

4. CRITICAL DEPENDENCIES (3-5): Vendors or services where disruption would halt business operations.

5. SINGLE POINTS OF FAILURE (3-5): Vendors with no viable alternative and high dependency.

6. DIVERSIFICATION SCORE (0-100): How well-diversified is the vendor portfolio? 100 = fully diversified, 0 = dangerously concentrated.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce vendor risk, prioritized by urgency.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Vendor Risk...");
    const result = await callJson(genai, prompt);
    return result as unknown as VendorRisk;
  } catch (e) {
    console.warn("[Pivot] Vendor Risk synthesis failed:", e);
    return null;
  }
}

// ── Wave 14: Quality Metrics ─────────────────────────────────────────────────

export async function synthesizeQualityMetrics(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<QualityMetrics | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of quality posture",
  "overallQualityScore": 0,
  "csatScore": "CSAT score or estimate",
  "npsScore": "NPS score or estimate",
  "indicators": [{
    "metric": "Quality metric name",
    "current": "Current value",
    "benchmark": "Industry benchmark",
    "trend": "improving|stable|declining",
    "impact": "Business impact description"
  }],
  "defectRate": "Current defect/error rate",
  "resolutionTime": "Average issue resolution time",
  "costOfQuality": "Estimated cost of quality (prevention + appraisal + failure)",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a quality management expert assessing product/service quality metrics for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive quality metrics analysis:

1. SUMMARY: 2-3 sentence overview of the company's quality posture and the most impactful improvement area.

2. OVERALL QUALITY SCORE (0-100): A composite score reflecting product/service quality. Consider customer satisfaction, defect rates, resolution times, and quality consistency.

3. CSAT SCORE: Customer satisfaction score (estimated from available data, or "Insufficient data").

4. NPS SCORE: Net Promoter Score (estimated from available data, or "Insufficient data").

5. INDICATORS (4-6): For each quality indicator:
   - Metric name (e.g., "First Call Resolution", "Product Defect Rate", "On-Time Delivery")
   - Current value
   - Industry benchmark
   - Trend: "improving", "stable", or "declining"
   - Business impact of this metric

6. DEFECT RATE: The current defect or error rate for the primary product/service.

7. RESOLUTION TIME: Average time to resolve customer issues or quality defects.

8. COST OF QUALITY: Estimated total cost of quality including prevention, appraisal, and failure costs.

9. RECOMMENDATIONS (4-6): Actionable steps to improve quality metrics, prioritized by customer impact.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Quality Metrics...");
    const result = await callJson(genai, prompt);
    return result as unknown as QualityMetrics;
  } catch (e) {
    console.warn("[Pivot] Quality Metrics synthesis failed:", e);
    return null;
  }
}

// ── Wave 14: Capacity Planning — (moved to Wave 25 block below) ──────────────

// ── Wave 14: Knowledge Management ────────────────────────────────────────────

export async function synthesizeKnowledgeManagement(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<KnowledgeManagement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of knowledge management maturity",
  "overallMaturityScore": 0,
  "gaps": [{
    "area": "Knowledge area or domain",
    "riskLevel": "critical|high|medium|low",
    "tribalKnowledgeHolder": "Person or role holding undocumented knowledge",
    "documentationStatus": "none|partial|complete",
    "impact": "Business impact if this knowledge is lost"
  }],
  "criticalRisks": ["risk 1", "..."],
  "onboardingEfficiency": "Assessment of onboarding speed and effectiveness",
  "documentationCoverage": "Percentage or description of documentation coverage",
  "knowledgeSharingScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a knowledge management consultant assessing how well a business captures, retains, and shares institutional knowledge.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive knowledge management assessment:

1. SUMMARY: 2-3 sentence overview of the company's knowledge management maturity and biggest vulnerability.

2. OVERALL MATURITY SCORE (0-100): How mature is the organization's knowledge management? Consider documentation, knowledge sharing, onboarding processes, and tribal knowledge risk.

3. GAPS (4-6): For each knowledge gap:
   - Area or domain (e.g., "Technical Architecture", "Customer Relationships", "Financial Modeling")
   - Risk level: "critical", "high", "medium", or "low"
   - Tribal knowledge holder: the person or role holding undocumented knowledge
   - Documentation status: "none", "partial", or "complete"
   - Business impact if this knowledge is lost

4. CRITICAL RISKS (3-5): The highest-risk knowledge vulnerabilities — situations where key knowledge resides in a single person's head.

5. ONBOARDING EFFICIENCY: How quickly and effectively can new employees become productive? Assess documentation quality and training processes.

6. DOCUMENTATION COVERAGE: What percentage of critical processes, systems, and decisions are adequately documented?

7. KNOWLEDGE SHARING SCORE (0-100): How effectively does the organization share knowledge across teams? Consider cross-training, documentation culture, and collaboration tools.

8. RECOMMENDATIONS (4-6): Actionable steps to improve knowledge management, prioritized by risk reduction.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Knowledge Management...");
    const result = await callJson(genai, prompt);
    return result as unknown as KnowledgeManagement;
  } catch (e) {
    console.warn("[Pivot] Knowledge Management synthesis failed:", e);
    return null;
  }
}

// ── Wave 14: Compliance Scorecard ────────────────────────────────────────────

export async function synthesizeComplianceScorecard(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ComplianceScorecard | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of compliance posture",
  "overallComplianceScore": 0,
  "areas": [{
    "regulation": "Regulation or compliance area name",
    "status": "compliant|partial|non_compliant",
    "riskExposure": "Financial or operational risk if non-compliant",
    "gapDescription": "Description of compliance gap",
    "remediationEffort": "Estimated effort to remediate",
    "deadline": "Compliance deadline if applicable"
  }],
  "auditReadiness": "ready|needs_work|not_ready",
  "criticalGaps": ["gap 1", "..."],
  "upcomingDeadlines": ["deadline 1", "..."],
  "riskExposure": "Total risk exposure from compliance gaps",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a compliance and regulatory expert assessing a business's compliance posture across all relevant regulations and standards.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive compliance scorecard:

1. SUMMARY: 2-3 sentence overview of the company's compliance posture and the most urgent gap.

2. OVERALL COMPLIANCE SCORE (0-100): A composite score reflecting how well the business meets its regulatory and compliance obligations. 100 = fully compliant, 0 = critically non-compliant.

3. AREAS (4-6): For each compliance area:
   - Regulation or standard name (e.g., "GDPR", "SOC 2", "HIPAA", "PCI-DSS", "Tax Compliance", "Labor Law")
   - Status: "compliant", "partial", or "non_compliant"
   - Risk exposure: financial or operational risk if the business remains non-compliant
   - Gap description: what specifically is missing or inadequate
   - Remediation effort: estimated time and resources to achieve compliance
   - Deadline: any upcoming compliance deadline (if applicable)

4. AUDIT READINESS: "ready", "needs_work", or "not_ready" — could the business pass an audit today?

5. CRITICAL GAPS (3-5): The most urgent compliance deficiencies that need immediate attention.

6. UPCOMING DEADLINES (3-5): Key compliance deadlines the business must meet in the near term.

7. RISK EXPOSURE: Total financial and operational risk from all compliance gaps combined.

8. RECOMMENDATIONS (4-6): Actionable steps to improve compliance posture, prioritized by risk and deadline urgency.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Compliance Scorecard...");
    const result = await callJson(genai, prompt);
    return result as unknown as ComplianceScorecard;
  } catch (e) {
    console.warn("[Pivot] Compliance Scorecard synthesis failed:", e);
    return null;
  }
}

// ── Wave 15: Growth & Market Intelligence ─────────────────────────────────

export async function synthesizeMarketPenetration(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketPenetration | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of market penetration position",
  "overallPenetrationRate": "X% of total addressable market captured",
  "shareOfWallet": "Average share of customer spend captured",
  "segments": [{
    "segment": "Segment name",
    "totalAddressable": "Total addressable value/customers in this segment",
    "currentCapture": "Current captured value/customers",
    "penetrationRate": "X% penetration",
    "growthOpportunity": "Dollar or percentage growth opportunity",
    "strategy": "How to increase penetration in this segment"
  }],
  "untappedMarket": "Description and size of untapped market",
  "expansionPriority": "Which segment/market to prioritize for expansion",
  "competitiveGap": "Gap between this business and market leader in penetration",
  "timeToFullPenetration": "Estimated time to reach target penetration",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a market penetration analyst evaluating how deeply a business has captured its addressable market.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive market penetration analysis:

1. SUMMARY: 2-3 sentence overview of the company's market penetration position and the biggest opportunity.

2. OVERALL PENETRATION RATE: What percentage of the total addressable market has this business captured?

3. SHARE OF WALLET: What share of each customer's total relevant spend does this business capture on average?

4. SEGMENTS (3-5): For each market segment:
   - Segment name/description
   - Total addressable size (customers or dollars)
   - Current capture (customers or dollars)
   - Penetration rate as a percentage
   - Growth opportunity in dollars or percentage
   - Specific strategy to increase penetration

5. UNTAPPED MARKET: Describe the size and nature of the market not yet captured.

6. EXPANSION PRIORITY: Which single segment or sub-market should the business prioritize for growth?

7. COMPETITIVE GAP: How does this business's penetration compare to the market leader?

8. TIME TO FULL PENETRATION: Estimate how long it would take to reach target penetration at current growth rates.

9. RECOMMENDATIONS (4-6): Actionable steps to increase market penetration.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Penetration...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketPenetration;
  } catch (e) {
    console.warn("[Pivot] Market Penetration synthesis failed:", e);
    return null;
  }
}

// ── Wave 15: Flywheel Analysis ────────────────────────────────────────────

export async function synthesizeFlywheelAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<FlywheelAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of growth flywheel dynamics",
  "overallMomentum": 0,
  "loops": [{
    "name": "Name of the growth loop",
    "type": "viral|content|paid|product|sales",
    "velocity": "How fast this loop cycles (e.g., days per cycle)",
    "frictionPoints": ["friction 1", "..."],
    "amplificationFactors": ["amplifier 1", "..."],
    "impactScore": 0
  }],
  "primaryFlywheel": "The dominant growth loop driving the business",
  "biggestFriction": "The single biggest friction point slowing growth",
  "biggestAmplifier": "The single biggest factor that could accelerate growth",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a growth strategist analyzing the flywheel dynamics and growth loops of a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive flywheel analysis:

1. SUMMARY: 2-3 sentence overview of the business's growth flywheel dynamics and momentum.

2. OVERALL MOMENTUM (0-100): How much momentum does the business's growth engine have? Consider loop velocity, friction, and compounding effects.

3. GROWTH LOOPS (3-5): For each identified growth loop:
   - Name of the loop (e.g., "Referral Loop", "Content-SEO Loop", "Product-Led Growth")
   - Type: "viral", "content", "paid", "product", or "sales"
   - Velocity: How fast the loop cycles (e.g., "7-day cycle" or "30-day payback")
   - Friction points (2-3): What slows this loop down
   - Amplification factors (2-3): What could make this loop spin faster
   - Impact score (1-10): How impactful this loop is to overall growth

4. PRIMARY FLYWHEEL: Which single growth loop is the dominant driver of the business?

5. BIGGEST FRICTION: The single most impactful friction point slowing overall growth.

6. BIGGEST AMPLIFIER: The single most impactful factor that could accelerate growth if invested in.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce friction and amplify growth loops.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Flywheel Analysis...");
    const result = await callJson(genai, prompt);
    return result as unknown as FlywheelAnalysis;
  } catch (e) {
    console.warn("[Pivot] Flywheel Analysis synthesis failed:", e);
    return null;
  }
}

// ── Wave 15: Partnerships Strategy ────────────────────────────────────────

export async function synthesizePartnershipsStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PartnershipsStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of partnership strategy",
  "overallPartnershipReadiness": 0,
  "partners": [{
    "name": "Potential partner name or type",
    "partnerType": "technology|channel|strategic|distribution|co-marketing",
    "revenueShareModel": "Description of revenue sharing approach",
    "integrationComplexity": "low|medium|high",
    "estimatedImpact": "Expected revenue or growth impact",
    "synergy": "Why this partnership makes sense"
  }],
  "priorityPartnership": "The single highest-priority partnership to pursue first",
  "ecosystemStrategy": "Overall strategy for building a partner ecosystem",
  "partnershipModels": ["model 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a partnerships strategist evaluating potential partnerships and alliance opportunities for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive partnerships strategy:

1. SUMMARY: 2-3 sentence overview of the company's partnership landscape and top opportunity.

2. OVERALL PARTNERSHIP READINESS (0-100): How ready is this business to establish and manage partnerships? Consider product maturity, team capacity, and integration capabilities.

3. PARTNERS (4-6): For each potential partner:
   - Partner name or type (e.g., specific company or category like "CRM platforms")
   - Partner type: "technology", "channel", "strategic", "distribution", or "co-marketing"
   - Revenue share model: How revenue or value would be shared
   - Integration complexity: "low", "medium", or "high"
   - Estimated impact: Expected revenue or growth impact from the partnership
   - Synergy: Why this partnership makes strategic sense

4. PRIORITY PARTNERSHIP: Which single partnership should the business pursue first, and why?

5. ECOSYSTEM STRATEGY: The overarching strategy for building a partner ecosystem over 12-24 months.

6. PARTNERSHIP MODELS (3-5): Types of partnership structures that would work for this business (e.g., "White-label reseller", "API integration partner", "Co-selling agreement").

7. RECOMMENDATIONS (4-6): Actionable steps to identify, approach, and close partnership deals.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Partnerships Strategy...");
    const result = await callJson(genai, prompt);
    return result as unknown as PartnershipsStrategy;
  } catch (e) {
    console.warn("[Pivot] Partnerships Strategy synthesis failed:", e);
    return null;
  }
}

// ── Wave 15: International Expansion ──────────────────────────────────────

export async function synthesizeInternationalExpansion(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<InternationalExpansion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of international expansion potential",
  "expansionReadiness": 0,
  "markets": [{
    "country": "Country name",
    "region": "Geographic region (e.g., Europe, Asia-Pacific)",
    "marketSize": "Estimated market size",
    "growthRate": "Market growth rate",
    "attractivenessScore": 0,
    "regulatoryBarrier": "low|medium|high",
    "localizationNeeds": ["localization need 1", "..."],
    "entryStrategy": "Recommended entry approach"
  }],
  "priorityMarket": "The single best market to enter first and why",
  "totalAddressableMarket": "Combined TAM across all target markets",
  "regulatoryComplexity": "Overall assessment of regulatory challenges",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an international expansion strategist evaluating global market opportunities for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive international expansion analysis:

1. SUMMARY: 2-3 sentence overview of the company's international expansion potential and the top market opportunity.

2. EXPANSION READINESS (0-100): How prepared is this business for international expansion? Consider product readiness, financial resources, team capabilities, and operational scalability.

3. MARKETS (4-6): For each potential international market:
   - Country name
   - Geographic region (e.g., "Europe", "Asia-Pacific", "Latin America")
   - Estimated market size for the company's product/service
   - Market growth rate
   - Attractiveness score (1-10): Overall market attractiveness considering size, growth, competition, and fit
   - Regulatory barrier: "low", "medium", or "high"
   - Localization needs (2-4): What must be adapted (language, payment, compliance, culture)
   - Entry strategy: Recommended approach (direct, partnership, acquisition, etc.)

4. PRIORITY MARKET: Which single international market should the business enter first, and why?

5. TOTAL ADDRESSABLE MARKET: Combined TAM across all identified international markets.

6. REGULATORY COMPLEXITY: Overall assessment of the regulatory landscape across target markets.

7. RECOMMENDATIONS (4-6): Actionable steps to prepare for and execute international expansion.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating International Expansion...");
    const result = await callJson(genai, prompt);
    return result as unknown as InternationalExpansion;
  } catch (e) {
    console.warn("[Pivot] International Expansion synthesis failed:", e);
    return null;
  }
}

// ── Wave 15: R&D Effectiveness ────────────────────────────────────────────

export async function synthesizeRDEffectiveness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RDEffectiveness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of R&D effectiveness",
  "rdSpendAsPercentRevenue": "X% of revenue allocated to R&D",
  "overallROI": "Overall return on R&D investment",
  "projects": [{
    "project": "Project name or description",
    "investment": "Amount invested",
    "roi": "Return on investment",
    "timeToValue": "Time from start to value delivery",
    "successProbability": "Estimated probability of success",
    "stage": "research|development|testing|launched|retired",
    "learnings": "Key learnings from this project"
  }],
  "successRate": "Percentage of R&D projects that achieved goals",
  "averageTimeToValue": "Average time from R&D start to market value",
  "innovationVelocity": "Rate of innovation output (features, products, patents per quarter)",
  "portfolioBalance": "Assessment of R&D portfolio balance across risk levels",
  "biggestWin": "The single most impactful R&D success",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an R&D effectiveness analyst evaluating the return on innovation investment for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive R&D effectiveness analysis:

1. SUMMARY: 2-3 sentence overview of R&D effectiveness and the most important finding.

2. R&D SPEND AS % OF REVENUE: What percentage of revenue is allocated to research and development?

3. OVERALL ROI: What is the overall return on R&D investment?

4. PROJECTS (4-6): For each R&D project or initiative:
   - Project name or description
   - Investment amount
   - ROI achieved or projected
   - Time to value: How long from start to delivering market value
   - Success probability: Likelihood of achieving intended goals
   - Stage: "research", "development", "testing", "launched", or "retired"
   - Key learnings from this project

5. SUCCESS RATE: What percentage of R&D projects have achieved their intended goals?

6. AVERAGE TIME TO VALUE: Average time from R&D initiation to market value delivery.

7. INNOVATION VELOCITY: Rate of innovation output (features shipped, products launched, patents filed per quarter).

8. PORTFOLIO BALANCE: Is the R&D portfolio balanced across moonshots, incremental improvements, and maintenance?

9. BIGGEST WIN: The single most impactful R&D success and its business impact.

10. RECOMMENDATIONS (4-6): Actionable steps to improve R&D effectiveness and innovation ROI.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating R&D Effectiveness...");
    const result = await callJson(genai, prompt);
    return result as unknown as RDEffectiveness;
  } catch (e) {
    console.warn("[Pivot] R&D Effectiveness synthesis failed:", e);
    return null;
  }
}

// ── Wave 15: Brand Equity ─────────────────────────────────────────────────

export async function synthesizeBrandEquity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<BrandEquity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of brand equity position",
  "overallBrandScore": 0,
  "estimatedBrandValue": "Estimated monetary value of the brand",
  "dimensions": [{
    "dimension": "Awareness|Perception|Loyalty|Advocacy",
    "score": 0,
    "benchmark": 0,
    "strengths": ["strength 1", "..."],
    "weaknesses": ["weakness 1", "..."]
  }],
  "brandPromise": "The core promise the brand makes to customers",
  "brandPersonality": "Description of the brand's personality traits",
  "competitivePositioning": "How the brand is positioned vs competitors",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a brand strategist evaluating brand equity and competitive positioning for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive brand equity analysis:

1. SUMMARY: 2-3 sentence overview of the brand's equity position and the most important finding.

2. OVERALL BRAND SCORE (0-100): Composite brand equity score reflecting awareness, perception, loyalty, and advocacy.

3. ESTIMATED BRAND VALUE: Estimated monetary value of the brand as an intangible asset.

4. DIMENSIONS (4): For each brand dimension:
   - Dimension: "Awareness", "Perception", "Loyalty", or "Advocacy"
   - Score (0-100): Current performance on this dimension
   - Benchmark (0-100): Industry benchmark for comparison
   - Strengths (2-3): What the brand does well in this dimension
   - Weaknesses (2-3): Where the brand falls short in this dimension

5. BRAND PROMISE: The core promise the brand makes to its customers — what they can consistently expect.

6. BRAND PERSONALITY: Description of the brand's personality traits (e.g., "innovative and approachable" or "premium and authoritative").

7. COMPETITIVE POSITIONING: How the brand is positioned relative to competitors — what makes it distinct.

8. RECOMMENDATIONS (4-6): Actionable steps to strengthen brand equity, close perception gaps, and build loyalty.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Brand Equity...");
    const result = await callJson(genai, prompt);
    return result as unknown as BrandEquity;
  } catch (e) {
    console.warn("[Pivot] Brand Equity synthesis failed:", e);
    return null;
  }
}

// ── Wave 13: Revenue Drivers ──────────────────────────────────────────────

export async function synthesizeRevenueDrivers(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueDrivers | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of revenue drivers and the most critical finding",
  "topDrivers": [{
    "driver": "Name of the revenue driver",
    "contribution": "Dollar or percentage contribution to total revenue",
    "growth": "Growth rate of this driver",
    "trend": "accelerating|stable|decelerating",
    "leverage": "high|medium|low",
    "actionability": "Specific action to amplify or protect this driver"
  }],
  "primaryGrowthEngine": "The single biggest source of revenue growth",
  "revenueConcentrationRisk": "Assessment of revenue concentration risk",
  "growthRate": "Overall revenue growth rate",
  "organicVsPaid": "Breakdown of organic vs paid revenue acquisition",
  "seasonalityPattern": "Description of seasonal revenue patterns",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a revenue strategist analyzing what is driving revenue growth or decline for a business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive revenue drivers analysis:

1. SUMMARY: 2-3 sentence overview of the revenue drivers landscape and the single most important finding.

2. TOP DRIVERS (4-7): For each revenue driver:
   - Driver name (product line, customer segment, channel, geography, etc.)
   - Contribution: dollar amount or percentage of total revenue
   - Growth rate of this driver over the available period
   - Trend: "accelerating", "stable", or "decelerating"
   - Leverage: "high", "medium", or "low" — how much control does the business have?
   - Actionability: a specific action to amplify or protect this driver

3. PRIMARY GROWTH ENGINE: What single factor is contributing the most to revenue growth right now?

4. REVENUE CONCENTRATION RISK: How concentrated is revenue across customers, products, or channels? Flag dangerous dependencies.

5. GROWTH RATE: Overall revenue growth rate based on available data.

6. ORGANIC VS PAID: What proportion of revenue comes from organic sources vs paid acquisition? What is the trend?

7. SEASONALITY PATTERN: Describe any seasonal revenue patterns and their magnitude.

8. RECOMMENDATIONS (4-6): Actionable steps to diversify revenue, accelerate growth, and reduce concentration risk.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Drivers...");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueDrivers;
  } catch (e) {
    console.warn("[Pivot] Revenue Drivers synthesis failed:", e);
    return null;
  }
}

// ── Wave 13: Margin Optimization ──────────────────────────────────────────────

export async function synthesizeMarginOptimization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarginOptimization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of margin health and the biggest optimization opportunity",
  "overallGrossMargin": "Overall gross margin percentage",
  "overallNetMargin": "Overall net margin percentage",
  "items": [{
    "product": "Product or service name",
    "grossMargin": "Gross margin for this product",
    "netMargin": "Net margin for this product",
    "costBreakdown": [{ "category": "Cost category", "amount": "$X", "percentage": "X%" }],
    "optimizationPotential": "Description of margin improvement opportunity"
  }],
  "biggestMarginDrain": "The single largest margin drain and its dollar impact",
  "quickWins": ["quick win 1", "..."],
  "totalOptimizationPotential": "Total dollar or percentage margin improvement possible",
  "costStructureHealth": "healthy|needs_attention|critical",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a margin optimization specialist analyzing cost structures and identifying profit improvement opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive margin optimization analysis:

1. SUMMARY: 2-3 sentence overview of the company's margin health and the biggest opportunity.

2. OVERALL GROSS MARGIN: The company's gross margin based on available data.

3. OVERALL NET MARGIN: The company's net margin based on available data.

4. ITEMS (3-6): For each major product or service line:
   - Product/service name
   - Gross margin
   - Net margin
   - Cost breakdown: top cost categories with amounts and percentages
   - Optimization potential: specific opportunity to improve margins for this item

5. BIGGEST MARGIN DRAIN: What single cost or inefficiency is eating the most margin? Quantify the impact.

6. QUICK WINS (3-5): Low-effort, high-impact margin improvements that can be implemented within 30-90 days.

7. TOTAL OPTIMIZATION POTENTIAL: Estimated total margin improvement if all recommendations are implemented.

8. COST STRUCTURE HEALTH: "healthy", "needs_attention", or "critical" — overall assessment of the cost structure.

9. RECOMMENDATIONS (4-6): Actionable steps to improve margins, reduce costs, and optimize pricing.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Margin Optimization...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarginOptimization;
  } catch (e) {
    console.warn("[Pivot] Margin Optimization synthesis failed:", e);
    return null;
  }
}

// ── Wave 13: Demand Forecasting ───────────────────────────────────────────────

export async function synthesizeDemandForecasting(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DemandForecasting | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of demand outlook and key signals",
  "shortTermForecast": "0-3 month demand forecast",
  "mediumTermForecast": "3-12 month demand forecast",
  "longTermForecast": "1-3 year demand forecast",
  "signals": [{
    "signal": "Name of the demand signal",
    "strength": "strong|moderate|weak",
    "timeframe": "When this signal will manifest",
    "confidence": 0.0,
    "dataSource": "Where this signal was observed"
  }],
  "seasonalityIndex": "Description of seasonal demand patterns with magnitude",
  "trendDirection": "growing|stable|declining",
  "peakPeriod": "The period of highest demand",
  "troughPeriod": "The period of lowest demand",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a demand forecasting analyst predicting future demand patterns and identifying leading indicators.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive demand forecasting analysis:

1. SUMMARY: 2-3 sentence overview of the demand outlook and the most important signal.

2. SHORT-TERM FORECAST (0-3 months): Based on current pipeline, recent trends, and leading indicators, what is the demand outlook for the next quarter?

3. MEDIUM-TERM FORECAST (3-12 months): Based on market trends, customer behavior, and seasonal patterns, where is demand heading?

4. LONG-TERM FORECAST (1-3 years): Based on macro trends, industry trajectory, and competitive dynamics, what is the long-range demand outlook?

5. SIGNALS (4-7): For each demand signal:
   - Signal name (e.g., "Website traffic surge", "Pipeline growth", "Market expansion", "Competitor exit")
   - Strength: "strong", "moderate", or "weak"
   - Timeframe: when this signal will impact demand
   - Confidence: 0.0 to 1.0
   - Data source: where this signal was observed in the data

6. SEASONALITY INDEX: Describe seasonal demand patterns and their magnitude (e.g., "Q4 peak at 140% of average, Q1 trough at 70%").

7. TREND DIRECTION: "growing", "stable", or "declining" — the underlying demand trend.

8. PEAK PERIOD: When does demand peak?

9. TROUGH PERIOD: When does demand bottom out?

10. RECOMMENDATIONS (4-6): Actionable steps to capitalize on demand trends, prepare for peaks, and mitigate troughs.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Demand Forecasting...");
    const result = await callJson(genai, prompt);
    return result as unknown as DemandForecasting;
  } catch (e) {
    console.warn("[Pivot] Demand Forecasting synthesis failed:", e);
    return null;
  }
}

// ── Wave 13: Cohort Analysis ──────────────────────────────────────────────────

export async function synthesizeCohortAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CohortAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of cohort performance and the most important retention insight",
  "cohorts": [{
    "period": "Cohort period (e.g., Q1 2024, Jan 2024)",
    "startingCustomers": 0,
    "retainedMonth1": "Retention rate at month 1",
    "retainedMonth3": "Retention rate at month 3",
    "retainedMonth6": "Retention rate at month 6",
    "retainedMonth12": "Retention rate at month 12",
    "revenueRetention": "Revenue retention for this cohort",
    "expansionRevenue": "Expansion revenue from this cohort"
  }],
  "bestCohort": "The cohort with the best retention and why",
  "worstCohort": "The cohort with the worst retention and why",
  "averageRetention12Month": "Average 12-month retention across all cohorts",
  "netRevenueRetention": "Net revenue retention rate",
  "churnTrend": "improving|stable|worsening",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a retention analytics specialist analyzing customer cohort behavior to identify retention patterns and revenue trends.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive cohort analysis:

1. SUMMARY: 2-3 sentence overview of cohort performance and the single most important retention insight.

2. COHORTS (4-8): For each customer cohort (by sign-up period):
   - Period (e.g., "Q1 2024", "Jan 2024")
   - Starting customers count
   - Retained at month 1, month 3, month 6, month 12 (as percentages)
   - Revenue retention: how much of the initial revenue is retained
   - Expansion revenue: additional revenue generated by this cohort over time

3. BEST COHORT: Which cohort has the strongest retention and why? What made that cohort different?

4. WORST COHORT: Which cohort has the weakest retention and why? What went wrong?

5. AVERAGE 12-MONTH RETENTION: The average retention rate at the 12-month mark across all cohorts.

6. NET REVENUE RETENTION: The overall NRR — including expansion, contraction, and churn.

7. CHURN TREND: "improving", "stable", or "worsening" — is retention getting better or worse over time?

8. RECOMMENDATIONS (4-6): Actionable steps to improve retention, increase NRR, and replicate the best cohort's success.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cohort Analysis...");
    const result = await callJson(genai, prompt);
    return result as unknown as CohortAnalysis;
  } catch (e) {
    console.warn("[Pivot] Cohort Analysis synthesis failed:", e);
    return null;
  }
}

// ── Wave 13: Win/Loss Analysis ────────────────────────────────────────────────

export async function synthesizeWinLossAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<WinLossAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of win/loss performance and the most critical pattern",
  "overallWinRate": "Overall deal win rate as a percentage",
  "deals": [{
    "dealType": "Type or category of deal",
    "outcome": "won|lost",
    "reason": "Primary reason for the outcome",
    "competitor": "Competitor involved if applicable",
    "dealSize": "Dollar value of the deal",
    "salesCycle": "Length of the sales cycle"
  }],
  "topWinReasons": ["reason 1", "..."],
  "topLossReasons": ["reason 1", "..."],
  "competitiveLosses": [{ "competitor": "Competitor name", "lossRate": "Loss rate against this competitor" }],
  "averageSalesCycle": "Average length of the sales cycle",
  "commonObjections": ["objection 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales effectiveness analyst evaluating deal outcomes to identify patterns in wins and losses.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive win/loss analysis:

1. SUMMARY: 2-3 sentence overview of win/loss performance and the single most actionable pattern.

2. OVERALL WIN RATE: The overall deal win rate based on available data.

3. DEALS (5-8): Representative deal outcomes showing the pattern:
   - Deal type or category
   - Outcome: "won" or "lost"
   - Primary reason for the outcome
   - Competitor involved (if applicable)
   - Deal size
   - Sales cycle length

4. TOP WIN REASONS (3-5): The most common reasons deals are won. Be specific — not generic.

5. TOP LOSS REASONS (3-5): The most common reasons deals are lost. Be brutally honest.

6. COMPETITIVE LOSSES (2-4): For each competitor the business loses to:
   - Competitor name
   - Loss rate against this competitor

7. AVERAGE SALES CYCLE: The average time from first contact to close.

8. COMMON OBJECTIONS (3-5): The most frequent objections heard during the sales process.

9. RECOMMENDATIONS (4-6): Actionable steps to improve win rates, shorten sales cycles, and counter competitive threats.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Win/Loss Analysis...");
    const result = await callJson(genai, prompt);
    return result as unknown as WinLossAnalysis;
  } catch (e) {
    console.warn("[Pivot] Win/Loss Analysis synthesis failed:", e);
    return null;
  }
}

// ── Wave 13: Sales Forecast ───────────────────────────────────────────────────

export async function synthesizeSalesForecast(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SalesForecast | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of sales forecast and pipeline health",
  "forecastPeriod": "The period being forecasted (e.g., Next 4 quarters)",
  "quarters": [{
    "quarter": "Quarter label (e.g., Q2 2025)",
    "pipelineWeighted": "Pipeline-weighted forecast amount",
    "bestCase": "Best case scenario amount",
    "worstCase": "Worst case scenario amount",
    "confidence": 0.0
  }],
  "totalForecast": "Total forecasted revenue across all quarters",
  "quotaAttainment": "Projected quota attainment percentage",
  "dealStageConversion": [{
    "stage": "Deal stage name",
    "conversionRate": "Conversion rate from this stage to next",
    "avgDaysInStage": 0
  }],
  "pipelineHealth": "strong|adequate|weak",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales forecasting analyst building pipeline-weighted revenue projections and evaluating sales execution.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive sales forecast:

1. SUMMARY: 2-3 sentence overview of the sales forecast outlook and pipeline health.

2. FORECAST PERIOD: The time period being forecasted (e.g., "Next 4 quarters" or "FY 2025").

3. QUARTERS (3-4): For each forecasted quarter:
   - Quarter label (e.g., "Q2 2025")
   - Pipeline-weighted forecast: probability-adjusted revenue forecast
   - Best case: optimistic scenario amount
   - Worst case: conservative scenario amount
   - Confidence: 0.0 to 1.0

4. TOTAL FORECAST: Sum of pipeline-weighted forecasts across all quarters.

5. QUOTA ATTAINMENT: Projected quota attainment percentage based on current pipeline and historical conversion rates.

6. DEAL STAGE CONVERSION (4-6): For each stage in the sales pipeline:
   - Stage name (e.g., "Prospect", "Qualified", "Proposal", "Negotiation", "Closed")
   - Conversion rate from this stage to the next
   - Average days spent in this stage

7. PIPELINE HEALTH: "strong", "adequate", or "weak" — overall assessment of whether the pipeline can support the forecast.

8. RECOMMENDATIONS (4-6): Actionable steps to improve forecast accuracy, accelerate pipeline, and close gaps.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Sales Forecast...");
    const result = await callJson(genai, prompt);
    return result as unknown as SalesForecast;
  } catch (e) {
    console.warn("[Pivot] Sales Forecast synthesis failed:", e);
    return null;
  }
}

// ── Wave 19: OKR Cascade ──────────────────────────────────────────────────────

export async function synthesizeOKRCascade(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<OKRCascade | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of OKR alignment health and the biggest gap",
  "companyObjectives": ["Company-level objective 1", "..."],
  "teams": [{
    "team": "Team name",
    "objective": "Team-level objective",
    "keyResults": ["Key result 1", "..."],
    "alignmentScore": 0,
    "blockers": ["Blocker 1", "..."]
  }],
  "crossFunctionalDeps": ["Dependency description 1", "..."],
  "alignmentScore": 0,
  "cascadeDepth": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an OKR alignment specialist analyzing how company objectives cascade into team-level goals and identifying misalignment.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive OKR cascade analysis:

1. SUMMARY: 2-3 sentence overview of OKR alignment health and the single biggest alignment gap.

2. COMPANY OBJECTIVES (3-5): The top-level strategic objectives for the organization.

3. TEAMS (3-6): For each team or department:
   - Team name
   - Team-level objective (should clearly ladder up to a company objective)
   - Key results (2-4 measurable outcomes)
   - Alignment score: 0-100 indicating how well team OKRs align with company objectives
   - Blockers: anything preventing this team from achieving its key results

4. CROSS-FUNCTIONAL DEPENDENCIES (3-5): Identify where teams depend on each other to hit their key results. Flag any unresolved dependency risks.

5. ALIGNMENT SCORE: Overall alignment score (0-100) across all teams.

6. CASCADE DEPTH: How many levels deep OKRs cascade (e.g., 2 = company → team, 3 = company → team → individual).

7. RECOMMENDATIONS (4-6): Actionable steps to improve OKR alignment, resolve dependency conflicts, and strengthen cascade discipline.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating OKR Cascade...");
    const result = await callJson(genai, prompt);
    return result as unknown as OKRCascade;
  } catch (e) {
    console.warn("[Pivot] OKR Cascade synthesis failed:", e);
    return null;
  }
}

// ── Wave 19: Meeting Effectiveness ────────────────────────────────────────────

export async function synthesizeMeetingEffectiveness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MeetingEffectiveness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of meeting culture health and the biggest time sink",
  "totalMeetingHours": "Estimated total meeting hours per week across the organization",
  "meetingTypes": [{
    "type": "Meeting type (e.g., All-hands, Sprint planning, 1:1s)",
    "frequencyPerWeek": 0,
    "avgDuration": "Average duration (e.g., 45 min)",
    "attendees": 0,
    "decisionRate": "Percentage of meetings that produce a clear decision",
    "actionItemCompletion": "Percentage of action items completed on time",
    "effectiveness": "effective|needs_improvement|wasteful"
  }],
  "decisionVelocity": "How quickly decisions are made in meetings vs. deferred",
  "actionItemTracker": "Assessment of action item follow-through across the org",
  "wastefulMeetings": "Estimated percentage or hours of meetings that could be eliminated or replaced with async",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a productivity analyst evaluating meeting culture, time investment, and decision velocity to reclaim wasted time.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive meeting effectiveness analysis:

1. SUMMARY: 2-3 sentence overview of meeting culture and the single biggest time sink.

2. TOTAL MEETING HOURS: Estimated total hours spent in meetings per week across the organization.

3. MEETING TYPES (4-7): For each type of recurring meeting:
   - Type (e.g., "All-hands", "Sprint planning", "1:1s", "Client calls", "Status updates")
   - Frequency per week
   - Average duration
   - Average number of attendees
   - Decision rate: what percentage of these meetings produce a clear decision
   - Action item completion: what percentage of action items from these meetings are completed on time
   - Effectiveness: "effective", "needs_improvement", or "wasteful"

4. DECISION VELOCITY: How quickly are decisions made in meetings vs. deferred to follow-ups or email threads?

5. ACTION ITEM TRACKER: Overall assessment of action item follow-through — are decisions being executed?

6. WASTEFUL MEETINGS: Estimate the percentage or hours of meetings that could be eliminated, shortened, or replaced with async communication.

7. RECOMMENDATIONS (4-6): Specific, actionable steps to improve meeting effectiveness — eliminate waste, speed up decisions, and improve follow-through.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Meeting Effectiveness...");
    const result = await callJson(genai, prompt);
    return result as unknown as MeetingEffectiveness;
  } catch (e) {
    console.warn("[Pivot] Meeting Effectiveness synthesis failed:", e);
    return null;
  }
}

// ── Wave 19: Communication Audit ──────────────────────────────────────────────

export async function synthesizeCommunicationAudit(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CommunicationAudit | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of internal communications health and the most critical gap",
  "overallHealth": 0,
  "channels": [{
    "channel": "Communication channel (e.g., Slack, Email, Meetings)",
    "usage": "How heavily this channel is used",
    "effectiveness": "How effective this channel is for its purpose",
    "gaps": ["Gap or issue with this channel"]
  }],
  "informationFlowScore": 0,
  "alignmentGaps": ["Alignment gap description 1", "..."],
  "siloBridges": ["Silo bridge recommendation 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational communications specialist auditing internal communication channels, information flow, and alignment gaps.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive communication audit:

1. SUMMARY: 2-3 sentence overview of internal communications health and the single most critical gap.

2. OVERALL HEALTH: Score from 0-100 representing the overall health of internal communications.

3. CHANNELS (4-6): For each communication channel in use:
   - Channel name (e.g., "Slack", "Email", "Meetings", "Internal wiki", "All-hands")
   - Usage: how heavily the channel is used
   - Effectiveness: how effective the channel is at achieving its purpose
   - Gaps: specific problems or inefficiencies with this channel

4. INFORMATION FLOW SCORE: 0-100 score for how effectively information flows across the organization — from leadership to teams and between teams.

5. ALIGNMENT GAPS (3-5): Specific areas where miscommunication or lack of communication is causing misalignment, duplicated effort, or missed opportunities.

6. SILO BRIDGES (3-5): Specific recommendations for breaking down information silos between teams or departments.

7. RECOMMENDATIONS (4-6): Actionable steps to improve communication health, close alignment gaps, and strengthen information flow.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Communication Audit...");
    const result = await callJson(genai, prompt);
    return result as unknown as CommunicationAudit;
  } catch (e) {
    console.warn("[Pivot] Communication Audit synthesis failed:", e);
    return null;
  }
}

// ── Wave 19: Decision Velocity ────────────────────────────────────────────────

export async function synthesizeDecisionVelocity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DecisionVelocity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of decision-making speed and the biggest bottleneck",
  "overallScore": 0,
  "avgTimeToDecision": "Average time from issue identification to decision",
  "bottlenecks": [{
    "area": "Area or function where decisions stall",
    "avgTimeToDecision": "Average time to decision in this area",
    "cause": "Root cause of the bottleneck",
    "impact": "Business impact of delayed decisions",
    "fix": "Specific fix to accelerate decisions here"
  }],
  "delegationEffectiveness": "Assessment of how well decision authority is delegated",
  "autonomyLevel": "Assessment of team autonomy in making decisions",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational effectiveness analyst evaluating decision-making speed, delegation practices, and decision bottlenecks.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive decision velocity analysis:

1. SUMMARY: 2-3 sentence overview of decision-making speed and the single biggest bottleneck.

2. OVERALL SCORE: 0-100 score representing overall decision velocity — how quickly and effectively the organization makes decisions.

3. AVERAGE TIME TO DECISION: The average time from when an issue or opportunity is identified to when a decision is made.

4. BOTTLENECKS (3-5): For each decision bottleneck:
   - Area or function where decisions stall (e.g., "Product roadmap", "Hiring", "Budget approval")
   - Average time to decision in this area
   - Root cause of the delay
   - Business impact of the delay (dollar amount or opportunity cost where possible)
   - Specific fix to accelerate decisions in this area

5. DELEGATION EFFECTIVENESS: Assessment of how well decision authority is delegated down the organization — are leaders making decisions that should be made by their teams?

6. AUTONOMY LEVEL: Assessment of team autonomy — can teams make decisions independently or do they need approval chains?

7. RECOMMENDATIONS (4-6): Actionable steps to accelerate decision-making, improve delegation, and remove bottlenecks.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Decision Velocity...");
    const result = await callJson(genai, prompt);
    return result as unknown as DecisionVelocity;
  } catch (e) {
    console.warn("[Pivot] Decision Velocity synthesis failed:", e);
    return null;
  }
}

// ── Wave 19: Resource Optimizer ───────────────────────────────────────────────

export async function synthesizeResourceOptimizer(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ResourceOptimizer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of resource allocation efficiency and the biggest imbalance",
  "overallEfficiency": 0,
  "gaps": [{
    "resource": "Resource type or area (e.g., Engineering, Marketing budget, Sales headcount)",
    "currentAllocation": "Current allocation amount or percentage",
    "optimalAllocation": "Recommended allocation amount or percentage",
    "gap": "The difference between current and optimal",
    "priority": "high|medium|low"
  }],
  "underutilized": ["Underutilized resource description 1", "..."],
  "overloaded": ["Overloaded resource description 1", "..."],
  "rebalancingPlan": "A concise plan for rebalancing resources to maximize ROI",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a resource optimization analyst evaluating how effectively the business allocates people, budget, and capacity across priorities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive resource optimization analysis:

1. SUMMARY: 2-3 sentence overview of resource allocation efficiency and the single biggest imbalance.

2. OVERALL EFFICIENCY: 0-100 score representing how effectively resources are allocated relative to strategic priorities.

3. RESOURCE GAPS (4-6): For each area where allocation is misaligned:
   - Resource type or area (e.g., "Engineering headcount", "Marketing budget", "Sales capacity")
   - Current allocation (amount or percentage)
   - Optimal allocation based on strategic priorities
   - Gap between current and optimal
   - Priority: "high", "medium", or "low"

4. UNDERUTILIZED RESOURCES (2-4): Resources that are not being fully leveraged — people, tools, budget, or capacity sitting idle or below potential.

5. OVERLOADED RESOURCES (2-4): Resources that are stretched beyond sustainable capacity — bottlenecks, burnout risks, or single points of failure.

6. REBALANCING PLAN: A concise, actionable plan for rebalancing resources to maximize ROI without increasing total spend.

7. RECOMMENDATIONS (4-6): Specific steps to improve allocation efficiency, eliminate waste, and rebalance toward highest-impact areas.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Resource Optimizer...");
    const result = await callJson(genai, prompt);
    return result as unknown as ResourceOptimizer;
  } catch (e) {
    console.warn("[Pivot] Resource Optimizer synthesis failed:", e);
    return null;
  }
}

// ── Wave 19: Change Management ────────────────────────────────────────────────

export async function synthesizeChangeManagement(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ChangeManagement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of organizational change readiness and the most critical transformation",
  "readinessScore": 0,
  "initiatives": [{
    "initiative": "Name of the change initiative",
    "phase": "planning|execution|adoption|complete",
    "adoptionRate": "Current adoption rate as a percentage",
    "resistanceLevel": "Assessment of resistance to this change",
    "champion": "Who is championing this initiative",
    "timeline": "Expected timeline for completion"
  }],
  "resistanceMap": "Overview of where and why resistance exists in the organization",
  "adoptionStrategy": "Strategy for driving adoption across all initiatives",
  "communicationPlan": "Plan for communicating changes effectively",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a change management strategist evaluating organizational transformation readiness, adoption tracking, and resistance patterns.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive change management analysis:

1. SUMMARY: 2-3 sentence overview of organizational change readiness and the most critical transformation underway or needed.

2. READINESS SCORE: 0-100 score representing the organization's overall readiness for change — considering culture, leadership buy-in, communication, and execution capability.

3. INITIATIVES (3-6): For each active or needed change initiative:
   - Initiative name (e.g., "CRM migration", "New pricing model", "Remote work policy", "Market expansion")
   - Phase: "planning", "execution", "adoption", or "complete"
   - Adoption rate: current adoption percentage among affected stakeholders
   - Resistance level: assessment of resistance (e.g., "High — sales team pushback on new CRM")
   - Champion: who is driving this initiative
   - Timeline: expected timeline for completion

4. RESISTANCE MAP: Where does resistance exist, who is resisting, and why? Be specific about departments, roles, or individuals (based on available data).

5. ADOPTION STRATEGY: A clear strategy for driving adoption across all major initiatives — training, incentives, communication, and support.

6. COMMUNICATION PLAN: How should leadership communicate changes to minimize resistance and maximize buy-in?

7. RECOMMENDATIONS (4-6): Actionable steps to improve change readiness, overcome resistance, and accelerate adoption.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Change Management...");
    const result = await callJson(genai, prompt);
    return result as unknown as ChangeManagement;
  } catch (e) {
    console.warn("[Pivot] Change Management synthesis failed:", e);
    return null;
  }
}

// ── Wave 20: Cash Reserve Strategy ────────────────────────────────────────────

export async function synthesizeCashReserveStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CashReserveStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of cash reserve position and the most important adjustment needed",
  "optimalReserve": "Dollar amount of the optimal cash reserve",
  "currentReserve": "Dollar amount of current cash reserves",
  "reserveRatio": "Current reserve ratio (months of operating expenses covered)",
  "scenarios": [{
    "scenario": "Scenario name (e.g., Revenue drop 30%, Key client loss, Market downturn)",
    "requiredReserve": "Cash reserve needed to survive this scenario",
    "currentCoverage": "How long current reserves would last in this scenario",
    "gap": "Shortfall between current reserves and what this scenario requires"
  }],
  "investmentAllocation": "How excess reserves above the optimal level should be invested",
  "contingencyPlan": "Step-by-step plan if reserves drop below the critical threshold",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a treasury strategist analyzing cash reserve adequacy, stress-testing scenarios, and contingency planning.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive cash reserve strategy:

1. SUMMARY: 2-3 sentence overview of cash reserve position and the single most important adjustment needed.

2. OPTIMAL RESERVE: The recommended cash reserve amount based on the business's burn rate, revenue volatility, and industry norms.

3. CURRENT RESERVE: The current cash reserve based on available data.

4. RESERVE RATIO: How many months of operating expenses the current reserve covers.

5. SCENARIOS (3-5): Stress-test the reserves against plausible adverse scenarios:
   - Scenario name (e.g., "30% revenue drop", "Key client loss", "6-month market downturn")
   - Required reserve to survive this scenario
   - How long current reserves would last under this scenario
   - Gap between current reserves and what this scenario requires

6. INVESTMENT ALLOCATION: If reserves exceed the optimal level, how should the excess be allocated (e.g., short-term instruments, growth investment)?

7. CONTINGENCY PLAN: Step-by-step plan if reserves fall below the critical threshold — cost cuts, credit lines, emergency fundraising.

8. RECOMMENDATIONS (4-6): Actionable steps to optimize the cash reserve position — build to optimal, invest excess, and prepare for downside scenarios.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cash Reserve Strategy...");
    const result = await callJson(genai, prompt);
    return result as unknown as CashReserveStrategy;
  } catch (e) {
    console.warn("[Pivot] Cash Reserve Strategy synthesis failed:", e);
    return null;
  }
}

// ── Wave 20: Revenue Quality Score ────────────────────────────────────────────

export async function synthesizeRevenueQualityScore(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueQualityScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of revenue quality and the biggest risk to revenue durability",
  "overallScore": 0,
  "recurringRevenuePct": "Percentage of revenue that is recurring (subscriptions, contracts, retainers)",
  "concentrationRisk": "Assessment of customer/product concentration risk",
  "predictability": "Assessment of revenue predictability (e.g., high, moderate, low)",
  "durability": "Assessment of how durable/defensible the revenue streams are",
  "dimensions": [{
    "dimension": "Quality dimension (e.g., Recurring %, Concentration, Predictability, Durability, Margin quality)",
    "score": 0,
    "weight": 0,
    "trend": "improving|stable|declining",
    "evidence": "Specific data point supporting this score"
  }],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a revenue quality analyst evaluating the composition, predictability, and durability of the business's revenue streams.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive revenue quality score:

1. SUMMARY: 2-3 sentence overview of revenue quality and the single biggest risk to revenue durability.

2. OVERALL SCORE: 0-100 composite score representing the overall quality of the revenue base.

3. RECURRING REVENUE PERCENTAGE: What percentage of total revenue is recurring (subscriptions, long-term contracts, retainers) vs. one-time or transactional?

4. CONCENTRATION RISK: How concentrated is revenue across customers, products, or channels? Identify dangerous dependencies.

5. PREDICTABILITY: How predictable is revenue from quarter to quarter? Based on contract structure, pipeline visibility, and historical variance.

6. DURABILITY: How defensible and durable are the revenue streams? Consider switching costs, competitive moats, and contract terms.

7. DIMENSIONS (4-6): Score each quality dimension:
   - Dimension name (e.g., "Recurring %", "Concentration risk", "Predictability", "Durability", "Margin quality")
   - Score: 0-100
   - Weight: how much this dimension contributes to the overall score (weights should sum to 1.0)
   - Trend: "improving", "stable", or "declining"
   - Evidence: specific data point from the business report supporting this score

8. RECOMMENDATIONS (4-6): Actionable steps to improve revenue quality — increase recurring revenue, reduce concentration, improve predictability.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Quality Score...");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueQualityScore;
  } catch (e) {
    console.warn("[Pivot] Revenue Quality Score synthesis failed:", e);
    return null;
  }
}

// ── Wave 20: Cost Intelligence ────────────────────────────────────────────────

export async function synthesizeCostIntelligence(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CostIntelligence | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of cost structure and the biggest savings opportunity",
  "totalCosts": "Total operating costs",
  "costCategories": [{
    "category": "Cost category (e.g., Payroll, Marketing, Infrastructure, COGS)",
    "currentSpend": "Current spend in this category",
    "benchmark": "Industry benchmark for this category",
    "variance": "Variance from benchmark (over/under and by how much)",
    "savingsOpportunity": "Potential savings if brought to benchmark"
  }],
  "topSavings": "The single biggest savings opportunity with estimated dollar impact",
  "spendTrend": "Overall spending trend — growing, stable, or declining relative to revenue",
  "costPerRevenueDollar": "Cost per dollar of revenue generated",
  "benchmarkPosition": "How the business's cost structure compares to industry peers",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a cost intelligence analyst benchmarking the business's cost structure against industry norms and identifying savings opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive cost intelligence analysis:

1. SUMMARY: 2-3 sentence overview of the cost structure and the single biggest savings opportunity.

2. TOTAL COSTS: Total operating costs based on available data.

3. COST CATEGORIES (5-8): For each major cost category:
   - Category name (e.g., "Payroll", "Marketing", "Infrastructure", "COGS", "Software", "Rent")
   - Current spend
   - Industry benchmark for a business of this size and type
   - Variance from benchmark (over or under, and by how much)
   - Savings opportunity if brought to benchmark level

4. TOP SAVINGS: The single biggest savings opportunity — what it is, how much could be saved, and how to capture it.

5. SPEND TREND: Is overall spending growing, stable, or declining relative to revenue? Is the business becoming more or less efficient?

6. COST PER REVENUE DOLLAR: How much does it cost to generate one dollar of revenue?

7. BENCHMARK POSITION: How does the overall cost structure compare to industry peers — leaner, comparable, or bloated?

8. RECOMMENDATIONS (4-6): Actionable steps to reduce costs, improve efficiency, and optimize spending without sacrificing growth.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cost Intelligence...");
    const result = await callJson(genai, prompt);
    return result as unknown as CostIntelligence;
  } catch (e) {
    console.warn("[Pivot] Cost Intelligence synthesis failed:", e);
    return null;
  }
}

// ── Wave 20: Financial Modeling ───────────────────────────────────────────────

export async function synthesizeFinancialModeling(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<FinancialModeling | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of financial model outputs and the most critical scenario",
  "baseCase": {
    "name": "Base Case",
    "assumptions": ["Key assumption 1", "..."],
    "projectedRevenue": "Projected revenue under this scenario",
    "projectedProfit": "Projected profit under this scenario",
    "breakEvenPoint": "When break-even is reached under this scenario",
    "probability": "Probability of this scenario occurring"
  },
  "scenarios": [{
    "name": "Scenario name (e.g., Upside, Downside, Aggressive growth)",
    "assumptions": ["Key assumption 1", "..."],
    "projectedRevenue": "Projected revenue",
    "projectedProfit": "Projected profit",
    "breakEvenPoint": "Break-even point",
    "probability": "Probability of this scenario"
  }],
  "sensitivityVariables": ["Variable that most impacts outcomes 1", "..."],
  "breakEvenAnalysis": "Detailed break-even analysis — units, revenue, or time to break even",
  "keyAssumptions": ["Critical assumption underpinning the model 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a financial modeling specialist building scenario-based projections, break-even analysis, and sensitivity testing.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive financial model:

1. SUMMARY: 2-3 sentence overview of financial model outputs and the most critical scenario the business should prepare for.

2. BASE CASE: The most likely scenario:
   - Name: "Base Case"
   - Key assumptions (3-5)
   - Projected revenue
   - Projected profit
   - Break-even point
   - Probability of this scenario

3. SCENARIOS (2-3 additional): For each alternative scenario (e.g., Upside, Downside, Aggressive growth):
   - Scenario name
   - Key assumptions that differ from base case (3-5)
   - Projected revenue
   - Projected profit
   - Break-even point
   - Probability

4. SENSITIVITY VARIABLES (3-5): Which variables have the biggest impact on outcomes? (e.g., "Customer acquisition cost", "Churn rate", "Average deal size")

5. BREAK-EVEN ANALYSIS: Detailed break-even analysis — how many units, how much revenue, or how long until the business breaks even under each scenario.

6. KEY ASSUMPTIONS (4-6): The critical assumptions underpinning the entire model — what must be true for the projections to hold.

7. RECOMMENDATIONS (4-6): Actionable steps to improve the financial trajectory, hedge against downside scenarios, and capitalize on upside.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Financial Modeling...");
    const result = await callJson(genai, prompt);
    return result as unknown as FinancialModeling;
  } catch (e) {
    console.warn("[Pivot] Financial Modeling synthesis failed:", e);
    return null;
  }
}

// ── Wave 20: Profitability Map ────────────────────────────────────────────────

export async function synthesizeProfitabilityMap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ProfitabilityMap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of profitability across segments and the biggest cross-subsidy",
  "overallMargin": "Overall profit margin across the business",
  "segments": [{
    "segment": "Business segment or product line",
    "revenue": "Revenue from this segment",
    "costs": "Costs attributed to this segment",
    "margin": "Profit margin for this segment",
    "contribution": "Contribution to overall profit",
    "trend": "Margin trend — improving, stable, or declining"
  }],
  "mostProfitable": "The most profitable segment and why",
  "leastProfitable": "The least profitable segment and why",
  "crossSubsidies": ["Cross-subsidy description 1 (e.g., Segment A profits subsidize Segment B losses)", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a profitability analyst mapping profit and loss across business segments to identify cross-subsidies and margin optimization opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive profitability map:

1. SUMMARY: 2-3 sentence overview of profitability across segments and the single biggest cross-subsidy or margin issue.

2. OVERALL MARGIN: The overall profit margin across the entire business.

3. SEGMENTS (4-7): For each business segment, product line, or service area:
   - Segment name
   - Revenue attributed to this segment
   - Costs attributed to this segment (including allocated overhead)
   - Profit margin for this segment
   - Contribution to overall profit (percentage of total profit)
   - Trend: margin is "improving", "stable", or "declining"

4. MOST PROFITABLE: Which segment is the most profitable, and what makes it so? Be specific about the margin drivers.

5. LEAST PROFITABLE: Which segment is the least profitable (or unprofitable), and why? Should it be fixed, repriced, or eliminated?

6. CROSS-SUBSIDIES (2-4): Identify where profits from one segment are subsidizing losses or low margins in another. Is this intentional and strategic, or accidental?

7. RECOMMENDATIONS (4-6): Actionable steps to improve overall profitability — fix underperforming segments, double down on high-margin areas, and eliminate unhealthy cross-subsidies.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Profitability Map...");
    const result = await callJson(genai, prompt);
    return result as unknown as ProfitabilityMap;
  } catch (e) {
    console.warn("[Pivot] Profitability Map synthesis failed:", e);
    return null;
  }
}

// ── Wave 20: Capital Allocation ───────────────────────────────────────────────

export async function synthesizeCapitalAllocation(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CapitalAllocation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of capital allocation effectiveness and the highest-ROIC opportunity",
  "totalCapital": "Total capital available for allocation",
  "investments": [{
    "option": "Investment option name",
    "amount": "Allocated or recommended amount",
    "expectedROIC": "Expected return on invested capital",
    "paybackPeriod": "Expected payback period",
    "riskLevel": "Risk level (low, moderate, high)",
    "strategicFit": "How well this investment aligns with strategic priorities"
  }],
  "roicTarget": "Target ROIC for the portfolio",
  "currentROIC": "Current overall ROIC",
  "allocationStrategy": "Overall strategy for allocating capital across investment options",
  "rebalancingNeeds": ["Rebalancing action needed 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a capital allocation strategist evaluating investment priorities, ROIC performance, and portfolio rebalancing needs.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive capital allocation analysis:

1. SUMMARY: 2-3 sentence overview of capital allocation effectiveness and the single highest-ROIC opportunity.

2. TOTAL CAPITAL: Total capital available for allocation (retained earnings, cash reserves, credit facilities, etc.).

3. INVESTMENTS (4-7): For each current or recommended investment:
   - Investment option name (e.g., "Product development", "Sales team expansion", "Marketing", "Debt repayment", "M&A")
   - Allocated or recommended amount
   - Expected ROIC (return on invested capital)
   - Expected payback period
   - Risk level: "low", "moderate", or "high"
   - Strategic fit: how well this investment aligns with the company's strategic priorities

4. ROIC TARGET: What ROIC should the business target for its capital allocation portfolio?

5. CURRENT ROIC: What is the current overall ROIC based on existing investments and capital deployment?

6. ALLOCATION STRATEGY: The overall philosophy for allocating capital — growth vs. efficiency, concentration vs. diversification, short-term vs. long-term.

7. REBALANCING NEEDS (3-5): Specific rebalancing actions needed — where to increase investment, where to pull back, and why.

8. RECOMMENDATIONS (4-6): Actionable steps to improve capital allocation — prioritize highest-ROIC investments, exit low-return commitments, and optimize the portfolio.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Capital Allocation...");
    const result = await callJson(genai, prompt);
    return result as unknown as CapitalAllocation;
  } catch (e) {
    console.warn("[Pivot] Capital Allocation synthesis failed:", e);
    return null;
  }
}

// ── Wave 17: Customer Voice ────────────────────────────────────────────────

export async function synthesizeCustomerVoice(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerVoice | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer sentiment and the most important feedback theme",
  "overallSentiment": "positive|neutral|negative — the dominant customer sentiment",
  "themes": [{
    "theme": "Name of the sentiment theme",
    "sentiment": "positive|negative|neutral",
    "frequency": "How often this theme appears (e.g., '45% of feedback')",
    "impact": "Business impact of this theme",
    "exampleQuotes": ["Representative customer quote 1", "..."]
  }],
  "topFeatureRequests": ["Feature request 1", "..."],
  "satisfactionDrivers": ["What customers love 1", "..."],
  "dissatisfactionDrivers": ["What frustrates customers 1", "..."],
  "npsAnalysis": "NPS score analysis and what it means for the business",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer insights analyst synthesizing the voice of the customer from all available feedback, reviews, and interaction data.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Voice analysis:

1. SUMMARY: 2-3 sentence overview of overall customer sentiment and the most important feedback theme.

2. OVERALL SENTIMENT: "positive", "neutral", or "negative" — the dominant sentiment across all feedback sources.

3. THEMES (4-7): For each sentiment theme:
   - Theme name (e.g., "Product reliability", "Pricing concerns", "Support responsiveness")
   - Sentiment: "positive", "negative", or "neutral"
   - Frequency: how often this theme appears
   - Impact: business impact of this theme
   - Example quotes: 1-3 representative customer statements

4. TOP FEATURE REQUESTS (3-5): The most requested features or improvements.

5. SATISFACTION DRIVERS (3-5): What customers consistently praise.

6. DISSATISFACTION DRIVERS (3-5): What consistently frustrates customers.

7. NPS ANALYSIS: Net Promoter Score analysis — score estimate, promoter/detractor breakdown, and what it means.

8. RECOMMENDATIONS (4-6): Actionable steps to amplify positive sentiment and address negative themes.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Voice...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerVoice;
  } catch (e) {
    console.warn("[Pivot] Customer Voice synthesis failed:", e);
    return null;
  }
}

// ── Wave 17: Referral Engine ──────────────────────────────────────────────────

export async function synthesizeReferralEngine(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ReferralEngine | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of referral dynamics and viral growth potential",
  "viralCoefficient": "Estimated viral coefficient (e.g., 0.3 — each customer brings 0.3 new customers)",
  "referralRate": "Percentage of customers who actively refer others",
  "channels": [{
    "channel": "Referral channel name (e.g., Word of mouth, Social sharing, Partner program)",
    "referrals": 0,
    "conversionRate": "Conversion rate from referral to customer",
    "revenueGenerated": "Revenue generated through this channel",
    "costPerReferral": "Cost to acquire each referral"
  }],
  "topAdvocates": ["Top advocate segment or customer type 1", "..."],
  "programEffectiveness": "Assessment of current referral program effectiveness",
  "revenueFromReferrals": "Total revenue attributable to referrals",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a growth analyst evaluating referral dynamics, viral potential, and advocate-driven revenue.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Referral Engine analysis:

1. SUMMARY: 2-3 sentence overview of referral dynamics and viral growth potential.

2. VIRAL COEFFICIENT: Estimated viral coefficient — how many new customers each existing customer generates.

3. REFERRAL RATE: What percentage of customers actively refer others?

4. CHANNELS (3-5): For each referral channel:
   - Channel name (e.g., "Word of mouth", "Social sharing", "Partner referrals", "Review sites")
   - Number of referrals generated
   - Conversion rate from referral to paying customer
   - Revenue generated through this channel
   - Cost per referral acquired

5. TOP ADVOCATES (3-5): The customer segments or types most likely to refer others.

6. PROGRAM EFFECTIVENESS: Assessment of any existing referral/advocacy program.

7. REVENUE FROM REFERRALS: Total revenue attributable to referral activity.

8. RECOMMENDATIONS (4-6): Actionable steps to increase viral coefficient, activate advocates, and build referral loops.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Referral Engine...");
    const result = await callJson(genai, prompt);
    return result as unknown as ReferralEngine;
  } catch (e) {
    console.warn("[Pivot] Referral Engine synthesis failed:", e);
    return null;
  }
}

// ── Wave 17: Price Sensitivity Index ──────────────────────────────────────────

export async function synthesizePriceSensitivityIndex(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PriceSensitivityIndex | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of price sensitivity landscape and key pricing insight",
  "overallSensitivity": "high|medium|low — overall price sensitivity of the customer base",
  "segments": [{
    "segment": "Customer segment name",
    "willingnessToPay": "How much this segment is willing to pay",
    "priceAnchor": "The reference price this segment compares against",
    "sensitivity": "high|medium|low",
    "optimalPriceRange": "The optimal price range for this segment"
  }],
  "priceFloor": "The minimum viable price below which perceived quality drops",
  "priceCeiling": "The maximum price the market will bear",
  "elasticityScore": 0.0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a pricing analyst evaluating customer willingness to pay and price sensitivity across segments.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Price Sensitivity Index:

1. SUMMARY: 2-3 sentence overview of the price sensitivity landscape and the most important pricing insight.

2. OVERALL SENSITIVITY: "high", "medium", or "low" — how price-sensitive is the overall customer base?

3. SEGMENTS (3-5): For each customer segment:
   - Segment name (e.g., "Enterprise", "SMB", "Price-conscious consumers")
   - Willingness to pay: what this segment will pay for the core offering
   - Price anchor: the reference price they compare against (competitor, previous price, etc.)
   - Sensitivity: "high", "medium", or "low"
   - Optimal price range: the sweet spot for this segment

4. PRICE FLOOR: The minimum price below which perceived quality or trust drops.

5. PRICE CEILING: The maximum price the market will bear before significant volume loss.

6. ELASTICITY SCORE: 0-10 scale — how much does demand change with price changes? (10 = extremely elastic)

7. RECOMMENDATIONS (4-6): Actionable pricing strategies to maximize revenue while managing sensitivity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Price Sensitivity Index...");
    const result = await callJson(genai, prompt);
    return result as unknown as PriceSensitivityIndex;
  } catch (e) {
    console.warn("[Pivot] Price Sensitivity Index synthesis failed:", e);
    return null;
  }
}

// ── Wave 17: Customer Effort Score ────────────────────────────────────────────

export async function synthesizeCustomerEffortScore(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerEffortScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer effort landscape and the highest-friction area",
  "overallCES": 0.0,
  "touchpoints": [{
    "touchpoint": "Customer touchpoint name",
    "effortScore": 0.0,
    "frictionLevel": "high|medium|low",
    "resolutionEase": "How easy it is to resolve issues at this touchpoint",
    "improvement": "Specific improvement to reduce effort at this touchpoint"
  }],
  "highestFriction": "The touchpoint or process causing the most customer effort",
  "selfServiceRate": "Percentage of issues resolved without human intervention",
  "resolutionRate": "First-contact resolution rate",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer experience analyst evaluating how much effort customers must exert to accomplish their goals with this business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Effort Score analysis:

1. SUMMARY: 2-3 sentence overview of the customer effort landscape and the highest-friction area.

2. OVERALL CES: 1-7 scale (1 = very low effort, 7 = very high effort) — the aggregate customer effort score.

3. TOUCHPOINTS (4-7): For each customer touchpoint:
   - Touchpoint name (e.g., "Onboarding", "Support ticket", "Billing", "Product setup", "Renewal")
   - Effort score: 1-7
   - Friction level: "high", "medium", or "low"
   - Resolution ease: how easy it is to resolve issues at this touchpoint
   - Improvement: specific improvement to reduce effort

4. HIGHEST FRICTION: The single touchpoint or process causing the most customer effort.

5. SELF-SERVICE RATE: Percentage of issues customers can resolve without contacting support.

6. RESOLUTION RATE: First-contact resolution rate for support interactions.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce customer effort, increase self-service, and smooth high-friction touchpoints.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Effort Score...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerEffortScore;
  } catch (e) {
    console.warn("[Pivot] Customer Effort Score synthesis failed:", e);
    return null;
  }
}

// ── Wave 17: Account Expansion Map ────────────────────────────────────────────

export async function synthesizeAccountExpansionMap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AccountExpansionMap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of account expansion potential and the biggest opportunity",
  "totalExpansionRevenue": "Total estimated expansion revenue across all accounts",
  "opportunities": [{
    "account": "Account or segment name",
    "currentSpend": "Current annual spend by this account",
    "expansionPotential": "Estimated additional revenue from expansion",
    "trigger": "What would trigger expansion (e.g., usage milestone, contract renewal)",
    "product": "Product or service for upsell/cross-sell",
    "probability": "Likelihood of successful expansion"
  }],
  "topOpportunity": "The single highest-value expansion opportunity",
  "averageWalletShare": "Average share of customer wallet currently captured",
  "crossSellRate": "Current cross-sell success rate",
  "upsellRate": "Current upsell success rate",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an account growth strategist identifying upsell, cross-sell, and expansion opportunities within the existing customer base.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Account Expansion Map:

1. SUMMARY: 2-3 sentence overview of expansion potential and the single biggest opportunity.

2. TOTAL EXPANSION REVENUE: Estimated total revenue from expanding existing accounts.

3. OPPORTUNITIES (4-7): For each expansion opportunity:
   - Account or segment name
   - Current spend: what this account currently pays
   - Expansion potential: estimated additional revenue
   - Trigger: what event or milestone would trigger expansion
   - Product: which product or service to upsell/cross-sell
   - Probability: likelihood of successful expansion

4. TOP OPPORTUNITY: The single highest-value expansion opportunity with rationale.

5. AVERAGE WALLET SHARE: What percentage of each customer's total addressable spend is currently captured?

6. CROSS-SELL RATE: Current cross-sell success rate.

7. UPSELL RATE: Current upsell success rate.

8. RECOMMENDATIONS (4-6): Actionable steps to accelerate account expansion, improve wallet share, and systematize growth.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Account Expansion Map...");
    const result = await callJson(genai, prompt);
    return result as unknown as AccountExpansionMap;
  } catch (e) {
    console.warn("[Pivot] Account Expansion Map synthesis failed:", e);
    return null;
  }
}

// ── Wave 17: Loyalty Program Design ───────────────────────────────────────────

export async function synthesizeLoyaltyProgramDesign(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<LoyaltyProgramDesign | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the recommended loyalty program and expected impact",
  "programType": "The type of loyalty program recommended (e.g., Points-based, Tiered, Subscription, Coalition)",
  "tiers": [{
    "tier": "Tier name (e.g., Silver, Gold, Platinum)",
    "criteria": "What qualifies a customer for this tier",
    "benefits": ["Benefit 1", "Benefit 2", "..."],
    "memberCount": "Estimated number of members in this tier",
    "retention": "Expected retention rate for this tier"
  }],
  "estimatedROI": "Projected return on investment for the program",
  "implementationCost": "Estimated cost to build and launch the program",
  "rewardsStrategy": "Overall approach to rewards and incentives",
  "engagementMechanics": ["Engagement mechanic 1 (e.g., Streak bonuses)", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a loyalty program architect designing a customer retention and engagement program tailored to this business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Loyalty Program Design:

1. SUMMARY: 2-3 sentence overview of the recommended loyalty program and its expected impact on retention and revenue.

2. PROGRAM TYPE: The recommended loyalty program structure (e.g., "Points-based", "Tiered", "Subscription perks", "Coalition").

3. TIERS (3-5): For each program tier:
   - Tier name (e.g., "Silver", "Gold", "Platinum")
   - Qualification criteria (spend threshold, tenure, engagement level)
   - Benefits: 3-5 specific benefits for this tier
   - Estimated member count
   - Expected retention rate for members in this tier

4. ESTIMATED ROI: Projected return on investment — revenue uplift vs. program cost.

5. IMPLEMENTATION COST: Estimated cost to build, launch, and maintain the program.

6. REWARDS STRATEGY: Overall approach to rewards — what is given, how it is earned, and why it drives behavior.

7. ENGAGEMENT MECHANICS (3-5): Specific mechanics to drive engagement (e.g., streak bonuses, milestone rewards, referral multipliers, exclusive access).

8. RECOMMENDATIONS (4-6): Actionable steps to launch, iterate, and scale the loyalty program.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Loyalty Program Design...");
    const result = await callJson(genai, prompt);
    return result as unknown as LoyaltyProgramDesign;
  } catch (e) {
    console.warn("[Pivot] Loyalty Program Design synthesis failed:", e);
    return null;
  }
}

// ── Wave 18: Competitive Pricing Matrix ───────────────────────────────────────

export async function synthesizeCompetitivePricingMatrix(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CompetitivePricingMatrix | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of competitive pricing landscape and positioning",
  "competitorPrices": [{
    "competitor": "Competitor name",
    "product": "Product or service being compared",
    "price": "Their price point or range",
    "positioning": "How they position (premium, mid-market, budget)",
    "differentiator": "What justifies their price"
  }],
  "pricePosition": "Where this business sits relative to competitors (e.g., '15% above market average')",
  "premiumJustification": "What justifies a premium price or what must change if underpriced",
  "gapAnalysis": "Pricing gaps and opportunities identified in the competitive set",
  "underCutRisk": "Risk assessment of being undercut by competitors",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a competitive pricing analyst mapping the competitive pricing landscape and evaluating price positioning.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Competitive Pricing Matrix:

1. SUMMARY: 2-3 sentence overview of the competitive pricing landscape and this business's positioning.

2. COMPETITOR PRICES (4-7): For each major competitor:
   - Competitor name
   - Product or service being compared
   - Their price point or range
   - Positioning: premium, mid-market, or budget
   - Key differentiator that justifies their price

3. PRICE POSITION: Where does this business sit relative to competitors? (e.g., "15% above market average", "lowest in segment")

4. PREMIUM JUSTIFICATION: If priced above market, what justifies the premium? If below, what upside is being left on the table?

5. GAP ANALYSIS: Pricing gaps and white-space opportunities in the competitive set.

6. UNDERCUT RISK: How vulnerable is the business to being undercut by competitors or new entrants?

7. RECOMMENDATIONS (4-6): Actionable pricing strategies to optimize positioning, capture value, and defend against competitive threats.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Competitive Pricing Matrix...");
    const result = await callJson(genai, prompt);
    return result as unknown as CompetitivePricingMatrix;
  } catch (e) {
    console.warn("[Pivot] Competitive Pricing Matrix synthesis failed:", e);
    return null;
  }
}

// ── Wave 18: Market Sentiment Index ───────────────────────────────────────────

export async function synthesizeMarketSentimentIndex(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketSentimentIndex | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of market sentiment and the most important sentiment driver",
  "overallSentiment": "bullish|neutral|bearish — the dominant market mood",
  "sentimentScore": 0,
  "drivers": [{
    "factor": "Factor influencing sentiment",
    "sentiment": "bullish|neutral|bearish",
    "weight": 0.0,
    "evidence": "Evidence supporting this sentiment assessment"
  }],
  "investorConfidence": "Assessment of investor sentiment toward this market and business",
  "consumerConfidence": "Assessment of consumer willingness to spend in this category",
  "industryOutlook": "6-18 month industry outlook",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a market sentiment analyst evaluating the overall mood of the industry, investor confidence, and consumer behavior trends.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Market Sentiment Index:

1. SUMMARY: 2-3 sentence overview of market sentiment and the single most important driver.

2. OVERALL SENTIMENT: "bullish", "neutral", or "bearish" — the dominant market mood for this industry.

3. SENTIMENT SCORE: -100 to +100 (negative = bearish, 0 = neutral, positive = bullish).

4. DRIVERS (4-7): For each sentiment driver:
   - Factor name (e.g., "VC funding trends", "Regulatory changes", "Consumer demand shifts")
   - Sentiment: "bullish", "neutral", or "bearish"
   - Weight: 0.0 to 1.0 — how much this factor influences overall sentiment
   - Evidence: specific data point or observation supporting this assessment

5. INVESTOR CONFIDENCE: Assessment of investor appetite for this market and business type.

6. CONSUMER CONFIDENCE: Assessment of consumer willingness to spend in this category.

7. INDUSTRY OUTLOOK: 6-18 month outlook — where is the industry headed and why?

8. RECOMMENDATIONS (4-6): Actionable steps to capitalize on positive sentiment or hedge against negative trends.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Sentiment Index...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketSentimentIndex;
  } catch (e) {
    console.warn("[Pivot] Market Sentiment Index synthesis failed:", e);
    return null;
  }
}

// ── Wave 18: Disruption Radar ─────────────────────────────────────────────────

export async function synthesizeDisruptionRadar(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DisruptionRadar | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the disruption landscape and most critical threat",
  "threatLevel": "critical|high|moderate|low — overall disruption threat level",
  "threats": [{
    "threat": "Name of the disruption threat",
    "category": "technology|regulatory|market_entrant|consumer_shift|economic",
    "probability": "Likelihood of this disruption materializing",
    "timeframe": "When this threat could impact the business",
    "impact": "Severity of impact if it materializes",
    "preparedness": "How prepared this business is to respond"
  }],
  "mostImminent": "The threat most likely to materialize first",
  "biggestImpact": "The threat with the highest potential damage",
  "preparednessScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a strategic disruption analyst scanning for emerging threats, technology shifts, and market disruptions that could impact this business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Disruption Radar:

1. SUMMARY: 2-3 sentence overview of the disruption landscape and the most critical threat.

2. THREAT LEVEL: "critical", "high", "moderate", or "low" — overall disruption threat level for this business.

3. THREATS (4-7): For each disruption threat:
   - Threat name (e.g., "AI automation of core service", "New regulatory framework", "Well-funded market entrant")
   - Category: "technology", "regulatory", "market_entrant", "consumer_shift", or "economic"
   - Probability: likelihood of materializing
   - Timeframe: when it could impact the business (e.g., "6-12 months", "2-3 years")
   - Impact: severity of impact if it materializes
   - Preparedness: how prepared the business is to respond

4. MOST IMMINENT: The disruption most likely to materialize first and why.

5. BIGGEST IMPACT: The disruption with the highest potential damage and why.

6. PREPAREDNESS SCORE: 0-100 — how prepared is this business overall for disruption?

7. RECOMMENDATIONS (4-6): Actionable steps to monitor threats, build resilience, and turn disruptions into opportunities.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Disruption Radar...");
    const result = await callJson(genai, prompt);
    return result as unknown as DisruptionRadar;
  } catch (e) {
    console.warn("[Pivot] Disruption Radar synthesis failed:", e);
    return null;
  }
}

// ── Wave 18: Ecosystem Map ────────────────────────────────────────────────────

export async function synthesizeEcosystemMap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<EcosystemMap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the ecosystem position and key dependencies",
  "ecosystemPosition": "Where this business sits in the value chain (e.g., 'Platform enabler', 'End-user provider', 'Infrastructure layer')",
  "players": [{
    "name": "Name of the ecosystem player",
    "role": "Their role in the ecosystem",
    "relationship": "partner|supplier|competitor|complementor|platform",
    "dependencyLevel": "How dependent the business is on this player (critical|moderate|low)",
    "opportunity": "Strategic opportunity with this player"
  }],
  "platformOpportunities": ["Platform or ecosystem opportunity 1", "..."],
  "valueChainPosition": "Where in the value chain the business creates and captures value",
  "networkStrength": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an ecosystem strategist mapping the value chain, partner dependencies, and platform opportunities for this business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Ecosystem Map:

1. SUMMARY: 2-3 sentence overview of ecosystem position and the most important dependency or opportunity.

2. ECOSYSTEM POSITION: Where does this business sit? (e.g., "Platform enabler", "End-user provider", "Infrastructure layer", "Marketplace connector")

3. PLAYERS (5-8): For each significant ecosystem player:
   - Name of the player (company, platform, or entity)
   - Role in the ecosystem
   - Relationship type: "partner", "supplier", "competitor", "complementor", or "platform"
   - Dependency level: how dependent is the business on this player? ("critical", "moderate", "low")
   - Opportunity: strategic opportunity with this player

4. PLATFORM OPPORTUNITIES (3-5): Opportunities to build platform effects, integrations, or ecosystem leverage.

5. VALUE CHAIN POSITION: Where in the value chain does the business create and capture value?

6. NETWORK STRENGTH: 0-100 — how strong and defensible is the business's ecosystem position?

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen ecosystem position, reduce dangerous dependencies, and capture platform value.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Ecosystem Map...");
    const result = await callJson(genai, prompt);
    return result as unknown as EcosystemMap;
  } catch (e) {
    console.warn("[Pivot] Ecosystem Map synthesis failed:", e);
    return null;
  }
}

// ── Wave 18: Category Creation ────────────────────────────────────────────────

export async function synthesizeCategoryCreation(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CategoryCreation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of category creation potential and the recommended approach",
  "categoryName": "The proposed new category name this business could own",
  "marketSize": "Estimated addressable market for the new category",
  "positioningFramework": "How to position as the category definer (e.g., 'The first X for Y')",
  "thoughtLeadershipPlan": ["Thought leadership action 1", "..."],
  "narrativeAnchors": ["Key narrative anchor point 1 (e.g., 'The old way is broken because...')", "..."],
  "competitiveAdvantage": "Why this business is uniquely positioned to define this category",
  "timeToEstablish": "Estimated time to establish category ownership",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a category design strategist evaluating whether this business can define and own a new market category.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Category Creation analysis:

1. SUMMARY: 2-3 sentence overview of category creation potential and the recommended approach.

2. CATEGORY NAME: Propose a compelling new category name this business could own (e.g., "Revenue Intelligence", "Customer Success Platform").

3. MARKET SIZE: Estimated total addressable market for the new category.

4. POSITIONING FRAMEWORK: How to position as the category definer — the "first X for Y" or "the Z of [industry]" framing.

5. THOUGHT LEADERSHIP PLAN (4-6): Specific actions to establish thought leadership in the new category (e.g., publish research, host events, coin terminology).

6. NARRATIVE ANCHORS (3-5): Key story elements that make the category compelling (e.g., "The old way is broken because...", "The market has shifted to...", "Customers now demand...").

7. COMPETITIVE ADVANTAGE: Why this business is uniquely positioned to define and own this category.

8. TIME TO ESTABLISH: Estimated time to establish meaningful category ownership.

9. RECOMMENDATIONS (4-6): Actionable steps to launch, evangelize, and defend the new category.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Category Creation...");
    const result = await callJson(genai, prompt);
    return result as unknown as CategoryCreation;
  } catch (e) {
    console.warn("[Pivot] Category Creation synthesis failed:", e);
    return null;
  }
}

// ── Wave 18: Market Velocity ──────────────────────────────────────────────────

export async function synthesizeMarketVelocity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketVelocity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of market velocity and how this business compares to market growth",
  "overallVelocity": "accelerating|stable|decelerating — the overall market pace",
  "metrics": [{
    "metric": "Velocity metric name",
    "currentRate": "Current rate for this business",
    "benchmark": "Industry benchmark or competitor rate",
    "acceleration": "accelerating|stable|decelerating",
    "driver": "What is driving the velocity for this metric"
  }],
  "accelerationFactors": ["Factor accelerating market growth 1", "..."],
  "decelerationRisks": ["Risk that could slow growth 1", "..."],
  "marketGrowthRate": "The overall market growth rate",
  "relativePosition": "How this business's growth compares to the market (e.g., '2x market rate', 'below market')",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a market dynamics analyst benchmarking growth velocity and identifying acceleration and deceleration factors.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Market Velocity analysis:

1. SUMMARY: 2-3 sentence overview of market velocity and how this business compares to market growth.

2. OVERALL VELOCITY: "accelerating", "stable", or "decelerating" — the overall pace of this market.

3. METRICS (4-7): For each velocity metric:
   - Metric name (e.g., "Revenue growth rate", "Customer acquisition rate", "Market share change", "Deal velocity")
   - Current rate: this business's current rate
   - Benchmark: industry benchmark or competitor rate
   - Acceleration: "accelerating", "stable", or "decelerating"
   - Driver: what is driving the velocity for this metric

4. ACCELERATION FACTORS (3-5): Forces accelerating market growth (e.g., "Digital transformation spend increasing 20% YoY", "Regulatory tailwinds").

5. DECELERATION RISKS (3-5): Factors that could slow growth (e.g., "Market saturation in core segment", "Recession risk").

6. MARKET GROWTH RATE: The overall market growth rate for this industry.

7. RELATIVE POSITION: How does this business's growth compare to the market? (e.g., "Growing at 2x market rate", "Below market average").

8. RECOMMENDATIONS (4-6): Actionable steps to accelerate growth, outpace the market, and mitigate deceleration risks.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Velocity...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketVelocity;
  } catch (e) {
    console.warn("[Pivot] Market Velocity synthesis failed:", e);
    return null;
  }
}

// ── Wave 23: People & Culture (Legacy — superseded by Wave 32) ───────────────

export async function synthesizeEmployeeEngagementLegacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<EmployeeEngagement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of employee engagement health and key risks",
  "overallScore": "1-100 engagement score based on available signals",
  "eNPS": "Estimated employee Net Promoter Score or 'Insufficient data'",
  "engagementDrivers": [{
    "driver": "Engagement driver name",
    "score": "1-10 score for this driver",
    "trend": "improving|stable|declining",
    "evidence": "What data supports this assessment"
  }],
  "turnoverRisk": {
    "overallRisk": "low|medium|high|critical",
    "estimatedTurnoverRate": "Estimated annual turnover rate or 'Insufficient data'",
    "atRiskSegments": ["Segment at risk of turnover 1", "..."],
    "costOfTurnover": "Estimated annual cost of turnover or 'Insufficient data'"
  },
  "topConcerns": ["Employee concern 1", "..."],
  "strengths": ["Engagement strength 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a people analytics specialist assessing employee engagement, satisfaction, and retention risk.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Employee Engagement analysis:

1. SUMMARY: 2-3 sentence overview of employee engagement health and key risks.

2. OVERALL SCORE: A 1-100 engagement score based on all available signals.

3. eNPS: Estimated employee Net Promoter Score based on available data.

4. ENGAGEMENT DRIVERS (5-8): For each driver:
   - Driver name (e.g., "Leadership trust", "Career growth", "Compensation satisfaction", "Work-life balance")
   - Score: 1-10 rating
   - Trend: "improving", "stable", or "declining"
   - Evidence: what data supports this assessment

5. TURNOVER RISK: Overall risk level, estimated turnover rate, at-risk segments, and cost of turnover.

6. TOP CONCERNS (3-5): The most pressing employee concerns or pain points.

7. STRENGTHS (3-5): Areas where engagement is strongest.

8. RECOMMENDATIONS (4-6): Actionable steps to improve engagement and reduce turnover risk.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Employee Engagement...");
    const result = await callJson(genai, prompt);
    return result as unknown as EmployeeEngagement;
  } catch (e) {
    console.warn("[Pivot] Employee Engagement synthesis failed:", e);
    return null;
  }
}

// ── Wave 23: Talent Acquisition Funnel ────────────────────────────────────────

export async function synthesizeTalentAcquisitionFunnel(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TalentAcquisitionFunnel | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of talent acquisition efficiency and bottlenecks",
  "overallEfficiency": "high|medium|low — overall hiring funnel efficiency",
  "funnelStages": [{
    "stage": "Funnel stage name",
    "volume": "Number or estimate of candidates at this stage",
    "conversionRate": "Conversion rate to next stage",
    "avgDaysInStage": "Average days candidates spend in this stage",
    "bottleneck": true or false
  }],
  "timeToHire": "Average time to hire across all roles or 'Insufficient data'",
  "costPerHire": "Average cost per hire or 'Insufficient data'",
  "sourceEffectiveness": [{
    "source": "Recruiting source name",
    "volume": "Candidates from this source",
    "qualityScore": "1-10 quality rating",
    "costPerCandidate": "Cost per candidate from this source or 'Insufficient data'"
  }],
  "criticalRoles": ["Hard-to-fill role 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a talent acquisition analyst evaluating recruiting funnel performance, time-to-hire, and sourcing effectiveness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Talent Acquisition Funnel analysis:

1. SUMMARY: 2-3 sentence overview of hiring efficiency and biggest bottlenecks.

2. OVERALL EFFICIENCY: "high", "medium", or "low" — overall funnel efficiency.

3. FUNNEL STAGES (4-7): For each stage (e.g., "Application", "Phone Screen", "Technical Interview", "Onsite", "Offer", "Accepted"):
   - Stage name
   - Volume: candidates at this stage
   - Conversion rate to next stage
   - Average days in stage
   - Whether this stage is a bottleneck

4. TIME TO HIRE: Average days from application to accepted offer.

5. COST PER HIRE: Average total cost per hire.

6. SOURCE EFFECTIVENESS (3-6): For each recruiting source (e.g., "LinkedIn", "Referrals", "Job boards"):
   - Source name, volume, quality score (1-10), cost per candidate

7. CRITICAL ROLES (3-5): Hardest-to-fill positions and why.

8. RECOMMENDATIONS (4-6): Actionable steps to improve funnel efficiency and reduce time/cost to hire.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Talent Acquisition Funnel...");
    const result = await callJson(genai, prompt);
    return result as unknown as TalentAcquisitionFunnel;
  } catch (e) {
    console.warn("[Pivot] Talent Acquisition Funnel synthesis failed:", e);
    return null;
  }
}

// ── Wave 23: Compensation Benchmark (Legacy — superseded by Wave 32) ────────

export async function synthesizeCompensationBenchmarkLegacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CompensationBenchmark | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of compensation competitiveness and key gaps",
  "overallCompetitiveness": "above-market|at-market|below-market — overall comp positioning",
  "roleBenchmarks": [{
    "role": "Role or job title",
    "currentComp": "Current total compensation for this role or 'Insufficient data'",
    "marketMedian": "Market median compensation",
    "percentile": "Where this role's comp falls (e.g., '25th percentile')",
    "gap": "Dollar or percentage gap to market median",
    "risk": "low|medium|high — flight risk due to comp"
  }],
  "equityStrategy": {
    "currentApproach": "Description of current equity/bonus strategy",
    "marketComparison": "How equity strategy compares to market",
    "recommendations": ["Equity strategy recommendation 1", "..."]
  },
  "benefitsGaps": ["Benefits gap vs market 1", "..."],
  "totalRewardsScore": "1-100 score for total rewards competitiveness",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a compensation analyst benchmarking this company's pay and total rewards against market data.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Compensation Benchmark analysis:

1. SUMMARY: 2-3 sentence overview of compensation competitiveness and key gaps.

2. OVERALL COMPETITIVENESS: "above-market", "at-market", or "below-market" positioning.

3. ROLE BENCHMARKS (5-8): For each key role:
   - Role title
   - Current compensation (or "Insufficient data")
   - Market median
   - Percentile ranking
   - Dollar/percentage gap to median
   - Flight risk due to comp (low/medium/high)

4. EQUITY STRATEGY: Current approach, market comparison, and recommendations for equity/bonus programs.

5. BENEFITS GAPS (3-5): Where benefits fall short of market expectations.

6. TOTAL REWARDS SCORE: 1-100 score for overall total rewards competitiveness.

7. RECOMMENDATIONS (4-6): Actionable steps to close compensation gaps and improve retention through total rewards.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Compensation Benchmark...");
    const result = await callJson(genai, prompt);
    return result as unknown as CompensationBenchmark;
  } catch (e) {
    console.warn("[Pivot] Compensation Benchmark synthesis failed:", e);
    return null;
  }
}

// ── Wave 23: Succession Planning (Legacy — superseded by Wave 32) ───────────

export async function synthesizeSuccessionPlanningLegacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SuccessionPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of succession readiness and key vulnerability areas",
  "overallReadiness": "strong|moderate|weak|critical — overall succession planning readiness",
  "criticalRoles": [{
    "role": "Critical role title",
    "currentHolder": "Current person or 'Unknown'",
    "benchStrength": "Number of ready-now successors",
    "readinessLevel": "ready-now|1-2 years|2+ years|no successor",
    "riskIfVacant": "Business impact if this role is suddenly vacant",
    "developmentPlan": "Plan to develop successors for this role"
  }],
  "riskAreas": [{
    "area": "Risk area name",
    "severity": "low|medium|high|critical",
    "description": "Why this is a succession risk"
  }],
  "keyPersonDependencies": ["Key person dependency 1", "..."],
  "benchStrengthScore": "1-100 overall bench strength score",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational development consultant assessing succession planning readiness and key-person risk.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Succession Planning analysis:

1. SUMMARY: 2-3 sentence overview of succession readiness and key vulnerabilities.

2. OVERALL READINESS: "strong", "moderate", "weak", or "critical" — succession planning maturity.

3. CRITICAL ROLES (5-8): For each critical role:
   - Role title
   - Current holder (or "Unknown")
   - Bench strength: number of ready-now successors
   - Readiness level: "ready-now", "1-2 years", "2+ years", or "no successor"
   - Risk if vacant: business impact of sudden vacancy
   - Development plan for successors

4. RISK AREAS (3-5): Key succession risk areas with severity and description.

5. KEY PERSON DEPENDENCIES (3-5): Roles or people where too much knowledge/authority is concentrated.

6. BENCH STRENGTH SCORE: 1-100 overall bench strength score.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen succession pipelines and reduce key-person risk.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Succession Planning...");
    const result = await callJson(genai, prompt);
    return result as unknown as SuccessionPlanning;
  } catch (e) {
    console.warn("[Pivot] Succession Planning synthesis failed:", e);
    return null;
  }
}

// ── Wave 23: Diversity Metrics ───────────────────────────────────────────────

export async function synthesizeDiversityMetrics(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DiversityMetrics | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of diversity and inclusion health",
  "overallInclusionIndex": "1-100 inclusion index score based on available signals",
  "diversityDimensions": [{
    "dimension": "Diversity dimension name",
    "currentState": "Current representation or 'Insufficient data'",
    "benchmark": "Industry benchmark for this dimension",
    "gap": "Gap vs benchmark or 'Insufficient data'",
    "trend": "improving|stable|declining"
  }],
  "payEquity": {
    "status": "equitable|minor-gaps|significant-gaps|insufficient-data",
    "findings": ["Pay equity finding 1", "..."],
    "estimatedGap": "Estimated pay equity gap or 'Insufficient data'"
  },
  "inclusionIndicators": [{
    "indicator": "Inclusion indicator name",
    "score": "1-10 score",
    "evidence": "Evidence for this score"
  }],
  "strengths": ["Diversity strength 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a diversity, equity, and inclusion analyst assessing representation, pay equity, and inclusion health.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Diversity Metrics analysis:

1. SUMMARY: 2-3 sentence overview of diversity and inclusion health.

2. OVERALL INCLUSION INDEX: 1-100 score based on all available D&I signals.

3. DIVERSITY DIMENSIONS (4-6): For each dimension (e.g., "Gender", "Ethnicity", "Age", "Disability", "Leadership diversity"):
   - Dimension name
   - Current state: representation levels or "Insufficient data"
   - Benchmark: industry benchmark
   - Gap vs benchmark
   - Trend: "improving", "stable", or "declining"

4. PAY EQUITY: Status (equitable/minor-gaps/significant-gaps/insufficient-data), specific findings, and estimated gap.

5. INCLUSION INDICATORS (3-5): For each indicator (e.g., "Belonging score", "Promotion equity", "Retention parity"):
   - Indicator name, score (1-10), and supporting evidence

6. STRENGTHS (3-5): Areas where diversity and inclusion are strongest.

7. RECOMMENDATIONS (4-6): Actionable steps to improve diversity, close pay equity gaps, and strengthen inclusion.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Diversity Metrics...");
    const result = await callJson(genai, prompt);
    return result as unknown as DiversityMetrics;
  } catch (e) {
    console.warn("[Pivot] Diversity Metrics synthesis failed:", e);
    return null;
  }
}

// ── Wave 23: Employer Brand ──────────────────────────────────────────────────

export async function synthesizeEmployerBrand(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<EmployerBrand | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of employer brand strength and perception",
  "overallScore": "1-100 employer brand score",
  "brandSignals": [{
    "signal": "Brand signal name",
    "score": "1-10 score for this signal",
    "source": "Where this signal comes from",
    "sentiment": "positive|neutral|negative"
  }],
  "glassdoorRating": "Estimated Glassdoor rating or 'Insufficient data'",
  "offerAcceptRate": "Offer acceptance rate or 'Insufficient data'",
  "evp": {
    "currentEVP": "Description of current Employee Value Proposition",
    "strengths": ["EVP strength 1", "..."],
    "gaps": ["EVP gap 1", "..."],
    "competitorComparison": "How EVP compares to key competitors"
  },
  "candidateExperience": {
    "score": "1-10 candidate experience score",
    "strengths": ["Candidate experience strength 1", "..."],
    "painPoints": ["Pain point 1", "..."]
  },
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an employer branding strategist evaluating brand perception, Glassdoor presence, candidate experience, and Employee Value Proposition.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Employer Brand analysis:

1. SUMMARY: 2-3 sentence overview of employer brand strength and market perception.

2. OVERALL SCORE: 1-100 employer brand score.

3. BRAND SIGNALS (5-8): For each signal (e.g., "Social media presence", "Employee reviews", "Career page quality", "Referral rate", "Award/recognition"):
   - Signal name
   - Score: 1-10
   - Source: where this signal comes from
   - Sentiment: "positive", "neutral", or "negative"

4. GLASSDOOR RATING: Estimated or actual Glassdoor rating.

5. OFFER ACCEPT RATE: Percentage of offers accepted.

6. EVP (Employee Value Proposition):
   - Current EVP description
   - Strengths: what makes the EVP compelling
   - Gaps: where the EVP falls short
   - Competitor comparison: how it stacks up

7. CANDIDATE EXPERIENCE: Score (1-10), strengths, and pain points.

8. RECOMMENDATIONS (4-6): Actionable steps to strengthen employer brand, improve EVP, and increase offer acceptance.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Employer Brand...");
    const result = await callJson(genai, prompt);
    return result as unknown as EmployerBrand;
  } catch (e) {
    console.warn("[Pivot] Employer Brand synthesis failed:", e);
    return null;
  }
}

// ── Wave 24: Data Governance ─────────────────────────────────────────────────

export async function synthesizeDataGovernance(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DataGovernance | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of data governance maturity and critical gaps",
  "maturityLevel": "initial|developing|defined|managed|optimized — overall data governance maturity",
  "maturityScore": "1-100 data governance maturity score",
  "governanceAreas": [{
    "area": "Governance area name",
    "maturity": "initial|developing|defined|managed|optimized",
    "score": "1-10 score for this area",
    "keyPolicies": ["Existing policy 1", "..."],
    "gaps": ["Gap in this area 1", "..."]
  }],
  "complianceGaps": [{
    "regulation": "Regulation or standard name",
    "currentStatus": "compliant|partial|non-compliant|unknown",
    "gaps": ["Specific compliance gap 1", "..."],
    "riskLevel": "low|medium|high|critical",
    "remediationCost": "Estimated cost to remediate or 'Insufficient data'"
  }],
  "dataOwnership": {
    "clarity": "clear|partial|unclear",
    "issues": ["Ownership issue 1", "..."]
  },
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a data governance specialist assessing governance maturity, compliance readiness, and data stewardship practices.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Data Governance analysis:

1. SUMMARY: 2-3 sentence overview of data governance maturity and critical gaps.

2. MATURITY LEVEL: "initial", "developing", "defined", "managed", or "optimized" — overall maturity.

3. MATURITY SCORE: 1-100 data governance maturity score.

4. GOVERNANCE AREAS (5-7): For each area (e.g., "Data quality", "Data security", "Data privacy", "Metadata management", "Data lineage", "Master data management"):
   - Area name
   - Maturity: initial/developing/defined/managed/optimized
   - Score: 1-10
   - Existing policies
   - Gaps in this area

5. COMPLIANCE GAPS (3-5): For each regulation (e.g., "GDPR", "CCPA", "SOC 2", "HIPAA"):
   - Regulation name
   - Current compliance status
   - Specific gaps
   - Risk level
   - Estimated remediation cost

6. DATA OWNERSHIP: Clarity level and ownership issues.

7. RECOMMENDATIONS (4-6): Actionable steps to improve governance maturity and close compliance gaps.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Data Governance...");
    const result = await callJson(genai, prompt);
    return result as unknown as DataGovernance;
  } catch (e) {
    console.warn("[Pivot] Data Governance synthesis failed:", e);
    return null;
  }
}

// ── Wave 24: Analytics Maturity ──────────────────────────────────────────────

export async function synthesizeAnalyticsMaturity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AnalyticsMaturity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of analytics maturity and key improvement areas",
  "overallMaturity": "descriptive|diagnostic|predictive|prescriptive — overall analytics maturity stage",
  "maturityScore": "1-100 analytics maturity score",
  "maturityDimensions": [{
    "dimension": "Maturity dimension name",
    "currentLevel": "descriptive|diagnostic|predictive|prescriptive",
    "score": "1-10 score for this dimension",
    "capabilities": ["Current capability 1", "..."],
    "gaps": ["Gap in this dimension 1", "..."]
  }],
  "toolStack": [{
    "category": "Tool category name",
    "currentTools": ["Tool 1", "..."],
    "adequacy": "adequate|needs-upgrade|missing",
    "recommendation": "Recommended tool or improvement"
  }],
  "skillGaps": [{
    "skill": "Analytics skill name",
    "currentLevel": "none|basic|intermediate|advanced",
    "requiredLevel": "basic|intermediate|advanced|expert",
    "gap": "Description of the gap",
    "priority": "low|medium|high|critical"
  }],
  "dataLiteracy": "1-10 organizational data literacy score",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an analytics strategy consultant assessing organizational analytics maturity, tool stack, and skill readiness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Analytics Maturity analysis:

1. SUMMARY: 2-3 sentence overview of analytics maturity and key improvement areas.

2. OVERALL MATURITY: "descriptive", "diagnostic", "predictive", or "prescriptive" — current analytics stage.

3. MATURITY SCORE: 1-100 analytics maturity score.

4. MATURITY DIMENSIONS (5-7): For each dimension (e.g., "Data infrastructure", "Reporting", "Advanced analytics", "ML/AI", "Self-service", "Data culture"):
   - Dimension name
   - Current level: descriptive/diagnostic/predictive/prescriptive
   - Score: 1-10
   - Current capabilities
   - Gaps

5. TOOL STACK (4-6): For each tool category (e.g., "BI/Visualization", "ETL/Data pipeline", "Data warehouse", "ML platform"):
   - Category, current tools, adequacy, and recommendation

6. SKILL GAPS (4-6): For each analytics skill:
   - Skill name, current level, required level, gap description, and priority

7. DATA LITERACY: 1-10 organizational data literacy score.

8. RECOMMENDATIONS (4-6): Actionable steps to advance analytics maturity and close skill gaps.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Analytics Maturity...");
    const result = await callJson(genai, prompt);
    return result as unknown as AnalyticsMaturity;
  } catch (e) {
    console.warn("[Pivot] Analytics Maturity synthesis failed:", e);
    return null;
  }
}

// ── Wave 24: Customer Data Platform ──────────────────────────────────────────

export async function synthesizeCustomerDataPlatform(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerDataPlatform | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer data unification and readiness",
  "overallReadiness": "advanced|intermediate|basic|not-started — CDP readiness level",
  "unifiedProfiles": {
    "status": "unified|partial|fragmented",
    "estimatedProfileCount": "Number of unified customer profiles or 'Insufficient data'",
    "completenessScore": "1-10 profile completeness score",
    "keyAttributes": ["Key profile attribute 1", "..."]
  },
  "dataSources": [{
    "source": "Data source name",
    "type": "first-party|second-party|third-party",
    "dataTypes": ["Data type 1", "..."],
    "integrationStatus": "integrated|partial|not-integrated",
    "quality": "high|medium|low"
  }],
  "identityResolution": {
    "approach": "Description of current identity resolution approach",
    "matchRate": "Estimated match rate across sources or 'Insufficient data'",
    "challenges": ["Identity resolution challenge 1", "..."],
    "maturity": "advanced|intermediate|basic|none"
  },
  "activationChannels": ["Channel where data can be activated 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer data strategist assessing data unification, identity resolution, and CDP readiness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Data Platform analysis:

1. SUMMARY: 2-3 sentence overview of customer data unification and readiness.

2. OVERALL READINESS: "advanced", "intermediate", "basic", or "not-started" — CDP readiness level.

3. UNIFIED PROFILES:
   - Status: "unified", "partial", or "fragmented"
   - Estimated profile count
   - Completeness score (1-10)
   - Key attributes tracked

4. DATA SOURCES (4-7): For each source (e.g., "CRM", "Website analytics", "Email platform", "Social media", "Purchase history"):
   - Source name, type (first/second/third-party), data types, integration status, quality

5. IDENTITY RESOLUTION:
   - Current approach description
   - Estimated match rate across sources
   - Key challenges
   - Maturity: advanced/intermediate/basic/none

6. ACTIVATION CHANNELS (3-5): Channels where unified data can be activated (e.g., "Email personalization", "Ad targeting", "Sales outreach").

7. RECOMMENDATIONS (4-6): Actionable steps to unify customer data, improve identity resolution, and enable data activation.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Data Platform...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerDataPlatform;
  } catch (e) {
    console.warn("[Pivot] Customer Data Platform synthesis failed:", e);
    return null;
  }
}

// ── Wave 24: Predictive Modeling ─────────────────────────────────────────────

export async function synthesizePredictiveModeling(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PredictiveModeling | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of predictive modeling opportunities and data readiness",
  "overallReadiness": "high|medium|low — overall readiness for predictive modeling",
  "models": [{
    "model": "Predictive model name",
    "useCase": "Business use case for this model",
    "dataReadiness": "ready|needs-work|not-ready — data readiness for this model",
    "expectedAccuracy": "Expected accuracy range or 'Insufficient data'",
    "implementationCost": "Estimated implementation cost or 'Insufficient data'",
    "estimatedROI": "Estimated ROI or 'Insufficient data'",
    "priority": "high|medium|low",
    "timeline": "Estimated implementation timeline"
  }],
  "dataReadiness": {
    "overallScore": "1-10 overall data readiness score",
    "strengths": ["Data readiness strength 1", "..."],
    "gaps": ["Data readiness gap 1", "..."]
  },
  "quickWins": ["Quick win predictive use case 1", "..."],
  "infrastructureNeeds": ["Infrastructure need 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a machine learning strategist evaluating predictive modeling opportunities, data readiness, and expected ROI.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Predictive Modeling analysis:

1. SUMMARY: 2-3 sentence overview of predictive modeling opportunities and data readiness.

2. OVERALL READINESS: "high", "medium", or "low" — readiness to implement predictive models.

3. MODELS (5-8): For each potential predictive model:
   - Model name (e.g., "Churn prediction", "Lead scoring", "Demand forecasting", "Price optimization")
   - Use case: business problem it solves
   - Data readiness: "ready", "needs-work", or "not-ready"
   - Expected accuracy range
   - Implementation cost estimate
   - Estimated ROI
   - Priority: high/medium/low
   - Implementation timeline

4. DATA READINESS: Overall score (1-10), strengths, and gaps for predictive modeling.

5. QUICK WINS (3-5): Predictive use cases that can be implemented quickly with existing data.

6. INFRASTRUCTURE NEEDS (3-5): What infrastructure is needed to support predictive modeling.

7. RECOMMENDATIONS (4-6): Actionable steps to build predictive modeling capability and capture the highest-ROI opportunities.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Predictive Modeling...");
    const result = await callJson(genai, prompt);
    return result as unknown as PredictiveModeling;
  } catch (e) {
    console.warn("[Pivot] Predictive Modeling synthesis failed:", e);
    return null;
  }
}

// ── Wave 24: Reporting Framework ─────────────────────────────────────────────

export async function synthesizeReportingFramework(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ReportingFramework | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of reporting effectiveness and coverage gaps",
  "overallEffectiveness": "excellent|good|adequate|poor — overall reporting framework effectiveness",
  "reports": [{
    "report": "Report name",
    "audience": "Who uses this report",
    "frequency": "How often it is produced",
    "format": "Dashboard|spreadsheet|presentation|automated|manual",
    "effectiveness": "1-10 effectiveness score",
    "issues": ["Issue with this report 1", "..."]
  }],
  "kpiCoverage": {
    "score": "1-100 KPI coverage score — what percentage of critical KPIs are tracked",
    "trackedKPIs": ["Tracked KPI 1", "..."],
    "missingKPIs": ["Missing critical KPI 1", "..."]
  },
  "selfServiceRate": "Percentage of reporting that is self-service or 'Insufficient data'",
  "dataFreshness": "How current the data in reports typically is (e.g., 'real-time', 'daily', 'weekly')",
  "reportingDebt": ["Reporting debt item 1 (e.g., manual reports that should be automated)", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a business intelligence architect evaluating reporting framework effectiveness, KPI coverage, and self-service analytics adoption.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Reporting Framework analysis:

1. SUMMARY: 2-3 sentence overview of reporting effectiveness and coverage gaps.

2. OVERALL EFFECTIVENESS: "excellent", "good", "adequate", or "poor" — overall framework quality.

3. REPORTS (5-8): For each key report:
   - Report name (e.g., "Executive dashboard", "Sales pipeline report", "Financial P&L", "Marketing attribution")
   - Audience: who uses it
   - Frequency: how often produced
   - Format: dashboard/spreadsheet/presentation/automated/manual
   - Effectiveness: 1-10 score
   - Issues with this report

4. KPI COVERAGE:
   - Coverage score (1-100): what percentage of critical KPIs are actively tracked
   - Tracked KPIs: list of KPIs being tracked
   - Missing KPIs: critical KPIs not currently tracked

5. SELF-SERVICE RATE: What percentage of reporting is self-service vs. requiring analyst support.

6. DATA FRESHNESS: How current the data in key reports typically is.

7. REPORTING DEBT (3-5): Manual or outdated reports that need modernization.

8. RECOMMENDATIONS (4-6): Actionable steps to improve reporting coverage, self-service adoption, and data freshness.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Reporting Framework...");
    const result = await callJson(genai, prompt);
    return result as unknown as ReportingFramework;
  } catch (e) {
    console.warn("[Pivot] Reporting Framework synthesis failed:", e);
    return null;
  }
}

// ── Wave 24: Data Quality Score ──────────────────────────────────────────────

export async function synthesizeDataQualityScore(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DataQualityScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of data quality health and critical issues",
  "overallScore": "1-100 overall data quality score",
  "qualityDimensions": [{
    "dimension": "Data quality dimension name",
    "score": "1-10 score for this dimension",
    "status": "good|acceptable|poor|critical",
    "evidence": "What data supports this assessment",
    "impactOfIssues": "Business impact of quality issues in this dimension"
  }],
  "criticalIssues": [{
    "issue": "Critical data quality issue name",
    "severity": "low|medium|high|critical",
    "affectedSystems": ["Affected system 1", "..."],
    "businessImpact": "Dollar impact or business consequence",
    "remediationEffort": "small|medium|large — effort to fix"
  }],
  "automationLevel": {
    "score": "1-10 data quality automation score",
    "currentAutomation": ["Automated process 1", "..."],
    "manualProcesses": ["Manual process that should be automated 1", "..."]
  },
  "dataDebt": "Estimated data quality debt — cost of not fixing current issues or 'Insufficient data'",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a data quality engineer assessing data quality across all dimensions, identifying critical issues, and evaluating automation maturity.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Data Quality Score analysis:

1. SUMMARY: 2-3 sentence overview of data quality health and critical issues.

2. OVERALL SCORE: 1-100 overall data quality score.

3. QUALITY DIMENSIONS (5-7): For each dimension (e.g., "Completeness", "Accuracy", "Consistency", "Timeliness", "Validity", "Uniqueness"):
   - Dimension name
   - Score: 1-10
   - Status: "good", "acceptable", "poor", or "critical"
   - Evidence: what supports this assessment
   - Impact of issues in this dimension

4. CRITICAL ISSUES (3-6): For each critical data quality issue:
   - Issue name
   - Severity: low/medium/high/critical
   - Affected systems
   - Business impact (dollar impact where possible)
   - Remediation effort: small/medium/large

5. AUTOMATION LEVEL:
   - Score (1-10): how automated data quality management is
   - Current automated processes
   - Manual processes that should be automated

6. DATA DEBT: Estimated cost of accumulated data quality issues.

7. RECOMMENDATIONS (4-6): Actionable steps to improve data quality, automate monitoring, and reduce data debt.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Data Quality Score...");
    const result = await callJson(genai, prompt);
    return result as unknown as DataQualityScore;
  } catch (e) {
    console.warn("[Pivot] Data Quality Score synthesis failed:", e);
    return null;
  }
}

// ── Wave 21: Sales Pipeline Health ────────────────────────────────────────────

export async function synthesizeSalesPipelineHealth(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SalesPipelineHealth | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of sales pipeline health and the biggest risk or opportunity",
  "totalPipelineValue": "Total dollar value currently in pipeline",
  "stages": [{
    "name": "Stage name (e.g., Prospecting, Qualification, Proposal, Negotiation, Closed Won)",
    "dealCount": 0,
    "value": "Dollar value in this stage",
    "conversionRate": "Percentage of deals advancing from this stage",
    "avgTimeInStage": "Average days deals spend in this stage"
  }],
  "coverageRatio": "Pipeline-to-quota coverage ratio (e.g., 3.2x)",
  "velocity": "Overall pipeline velocity — average revenue per day flowing through the pipeline",
  "atRiskDeals": [{
    "deal": "Deal or account name",
    "value": "Deal value",
    "risk": "Why this deal is at risk",
    "recommendedAction": "What to do to save it"
  }],
  "healthScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales pipeline analyst evaluating the health, coverage, velocity, and risk profile of the sales pipeline.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Sales Pipeline Health analysis:

1. SUMMARY: 2-3 sentence overview of pipeline health highlighting the single biggest risk or opportunity.

2. TOTAL PIPELINE VALUE: The total dollar value of all deals currently in the pipeline.

3. STAGES (4-6): For each pipeline stage:
   - Stage name (e.g., "Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won")
   - Deal count in this stage
   - Dollar value in this stage
   - Conversion rate: percentage of deals that advance from this stage
   - Average time in stage: how many days deals typically spend here

4. COVERAGE RATIO: Pipeline-to-quota coverage ratio (healthy is typically 3x+).

5. VELOCITY: Overall pipeline velocity — average revenue per day flowing through the pipeline.

6. AT-RISK DEALS (3-5): For each at-risk deal:
   - Deal or account name
   - Deal value
   - Why this deal is at risk (stalled, competitor threat, champion left, etc.)
   - Recommended action to save or accelerate it

7. HEALTH SCORE: 0-100 — overall pipeline health rating.

8. RECOMMENDATIONS (4-6): Actionable steps to improve pipeline health, coverage, and velocity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Sales Pipeline Health...");
    const result = await callJson(genai, prompt);
    return result as unknown as SalesPipelineHealth;
  } catch (e) {
    console.warn("[Pivot] Sales Pipeline Health synthesis failed:", e);
    return null;
  }
}

// ── Wave 21: Deal Velocity ────────────────────────────────────────────────────

export async function synthesizeDealVelocity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DealVelocity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of deal velocity and the most impactful bottleneck",
  "averageCycleTime": "Average number of days from first contact to close",
  "stageVelocity": [{
    "stage": "Pipeline stage name",
    "avgDays": 0,
    "benchmark": "Industry benchmark for this stage in days",
    "bottleneck": true,
    "cause": "If bottleneck, what is causing the delay"
  }],
  "segmentSpeed": [{
    "segment": "Customer segment (e.g., Enterprise, Mid-Market, SMB)",
    "avgCycleTime": "Average days to close for this segment",
    "trend": "accelerating|stable|slowing",
    "driver": "What is driving the speed for this segment"
  }],
  "bottlenecks": [{
    "stage": "Where the bottleneck occurs",
    "impact": "How much revenue or time is lost",
    "rootCause": "Root cause of the bottleneck",
    "fix": "Recommended fix"
  }],
  "velocityScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales velocity analyst measuring deal cycle times, identifying bottlenecks, and benchmarking speed by segment.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Deal Velocity analysis:

1. SUMMARY: 2-3 sentence overview of deal velocity and the single most impactful bottleneck.

2. AVERAGE CYCLE TIME: Average number of days from first contact to closed-won.

3. STAGE VELOCITY (4-6): For each pipeline stage:
   - Stage name
   - Average days deals spend in this stage
   - Industry benchmark (days)
   - Whether this stage is a bottleneck (true/false)
   - If bottleneck, what is causing the delay

4. SEGMENT SPEED (2-4): For each customer segment:
   - Segment name (e.g., "Enterprise", "Mid-Market", "SMB")
   - Average cycle time for this segment
   - Trend: "accelerating", "stable", or "slowing"
   - What is driving the speed for this segment

5. BOTTLENECKS (2-4): For each identified bottleneck:
   - Where it occurs in the pipeline
   - Revenue or time impact
   - Root cause
   - Recommended fix

6. VELOCITY SCORE: 0-100 — overall deal velocity rating.

7. RECOMMENDATIONS (4-6): Actionable steps to accelerate deal velocity and remove bottlenecks.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Deal Velocity...");
    const result = await callJson(genai, prompt);
    return result as unknown as DealVelocity;
  } catch (e) {
    console.warn("[Pivot] Deal Velocity synthesis failed:", e);
    return null;
  }
}

// ── Wave 21: Win Rate Optimizer ───────────────────────────────────────────────

export async function synthesizeWinRateOptimizer(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<WinRateOptimizer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of win rates and the single biggest factor affecting close rates",
  "overallWinRate": "Overall win rate as a percentage",
  "winFactors": [{
    "factor": "Factor that increases win probability",
    "impact": "How much this factor improves win rate (e.g., '+15% win rate')",
    "evidence": "Evidence from the business data"
  }],
  "lossReasons": [{
    "reason": "Why deals are lost",
    "frequency": "How often this reason appears (e.g., '35% of losses')",
    "revenueImpact": "Dollar amount lost to this reason",
    "mitigation": "How to address this loss reason"
  }],
  "competitiveWinRates": [{
    "competitor": "Competitor name",
    "winRate": "Win rate against this competitor",
    "advantage": "Where the business wins against them",
    "vulnerability": "Where the business loses to them"
  }],
  "winRateBySegment": [{
    "segment": "Customer segment",
    "winRate": "Win rate for this segment",
    "trend": "improving|stable|declining"
  }],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a win/loss analyst identifying the factors that drive wins, the reasons for losses, and competitive win rates.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Win Rate Optimizer analysis:

1. SUMMARY: 2-3 sentence overview of win rates and the single biggest factor affecting close rates.

2. OVERALL WIN RATE: The overall win rate as a percentage.

3. WIN FACTORS (3-5): For each factor that increases win probability:
   - Factor name (e.g., "Champion identified early", "Custom demo delivered", "Executive sponsor engaged")
   - Impact on win rate (e.g., "+15% win rate when present")
   - Evidence from the business data

4. LOSS REASONS (3-5): For each common loss reason:
   - Reason (e.g., "Price objection", "Feature gap", "Competitor incumbent")
   - Frequency: how often this reason appears
   - Revenue impact: dollar amount lost
   - Mitigation: how to address it

5. COMPETITIVE WIN RATES (2-4): For each key competitor:
   - Competitor name
   - Win rate against them
   - Where the business wins (advantage)
   - Where the business loses (vulnerability)

6. WIN RATE BY SEGMENT (2-4): For each customer segment:
   - Segment name
   - Win rate
   - Trend: "improving", "stable", or "declining"

7. RECOMMENDATIONS (4-6): Actionable steps to improve win rates across segments and against competitors.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Win Rate Optimizer...");
    const result = await callJson(genai, prompt);
    return result as unknown as WinRateOptimizer;
  } catch (e) {
    console.warn("[Pivot] Win Rate Optimizer synthesis failed:", e);
    return null;
  }
}

// ── Wave 21: Sales Enablement ─────────────────────────────────────────────────

export async function synthesizeSalesEnablement(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SalesEnablement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of sales enablement readiness and the most critical gap",
  "readinessScore": 0,
  "assets": [{
    "name": "Enablement asset name (e.g., Battle cards, ROI calculator, Case studies)",
    "status": "available|partial|missing",
    "quality": "Rating of asset quality if available",
    "usage": "How frequently reps use this asset",
    "impact": "Impact on deal outcomes when used"
  }],
  "trainingGaps": [{
    "area": "Training area with a gap",
    "currentLevel": "Current proficiency level",
    "targetLevel": "Required proficiency level",
    "impactOnRevenue": "How this gap affects revenue",
    "recommendation": "How to close this gap"
  }],
  "toolAdoption": [{
    "tool": "Sales tool name (e.g., CRM, email sequencing, call intelligence)",
    "adoptionRate": "Percentage of reps actively using this tool",
    "effectiveness": "How effective the tool is at driving outcomes",
    "barrier": "What prevents higher adoption"
  }],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales enablement strategist assessing the readiness of the sales team, quality of enablement assets, training gaps, and tool adoption.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Sales Enablement analysis:

1. SUMMARY: 2-3 sentence overview of sales enablement readiness and the single most critical gap.

2. READINESS SCORE: 0-100 — overall sales enablement readiness.

3. ASSETS (4-6): For each key enablement asset:
   - Asset name (e.g., "Battle cards", "ROI calculator", "Case studies", "Product demos", "Competitive briefs")
   - Status: "available", "partial", or "missing"
   - Quality: rating of asset quality if available
   - Usage: how frequently reps use this asset
   - Impact: impact on deal outcomes when the asset is used

4. TRAINING GAPS (3-5): For each training gap:
   - Area (e.g., "Product knowledge", "Objection handling", "Discovery skills", "Negotiation")
   - Current proficiency level
   - Target proficiency level
   - Impact on revenue: how this gap affects deal outcomes
   - Recommendation: how to close this gap

5. TOOL ADOPTION (3-5): For each sales tool:
   - Tool name (e.g., "CRM", "Email sequencing", "Call intelligence", "Content management")
   - Adoption rate: percentage of reps actively using it
   - Effectiveness: how effective the tool is
   - Barrier: what prevents higher adoption

6. RECOMMENDATIONS (4-6): Actionable steps to improve enablement, close training gaps, and increase tool adoption.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Sales Enablement...");
    const result = await callJson(genai, prompt);
    return result as unknown as SalesEnablement;
  } catch (e) {
    console.warn("[Pivot] Sales Enablement synthesis failed:", e);
    return null;
  }
}

// ── Wave 21: Territory Planning ───────────────────────────────────────────────

export async function synthesizeTerritoryPlanning(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TerritoryPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of territory balance and the biggest coverage gap or untapped opportunity",
  "territories": [{
    "name": "Territory name (geographic, vertical, or named account list)",
    "repCount": 0,
    "accountCount": 0,
    "pipelineValue": "Dollar value of pipeline in this territory",
    "revenue": "Current revenue from this territory",
    "balance": "overstaffed|balanced|understaffed",
    "potential": "Estimated untapped potential in this territory"
  }],
  "coverageGaps": [{
    "area": "Geographic or segment area with a coverage gap",
    "estimatedOpportunity": "Dollar opportunity being missed",
    "reason": "Why coverage is lacking",
    "fix": "How to address the gap"
  }],
  "untappedPotential": [{
    "opportunity": "Untapped territory or segment opportunity",
    "estimatedValue": "Estimated dollar value",
    "requiredInvestment": "What investment is needed to capture it",
    "timeline": "How long to realize the value"
  }],
  "balanceScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a territory planning strategist evaluating sales territory balance, coverage gaps, and untapped market potential.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Territory Planning analysis:

1. SUMMARY: 2-3 sentence overview of territory balance and the biggest coverage gap or untapped opportunity.

2. TERRITORIES (3-6): For each sales territory:
   - Territory name (geographic region, vertical, or named account list)
   - Number of reps assigned
   - Number of accounts
   - Pipeline value in this territory
   - Current revenue from this territory
   - Balance assessment: "overstaffed", "balanced", or "understaffed"
   - Estimated untapped potential

3. COVERAGE GAPS (2-4): For each coverage gap:
   - Area with the gap (geographic or segment)
   - Estimated dollar opportunity being missed
   - Why coverage is lacking
   - How to address the gap

4. UNTAPPED POTENTIAL (2-4): For each untapped opportunity:
   - Description of the opportunity
   - Estimated dollar value
   - Required investment to capture it
   - Timeline to realize value

5. BALANCE SCORE: 0-100 — overall territory balance and coverage rating.

6. RECOMMENDATIONS (4-6): Actionable steps to rebalance territories, close coverage gaps, and capture untapped potential.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Territory Planning...");
    const result = await callJson(genai, prompt);
    return result as unknown as TerritoryPlanning;
  } catch (e) {
    console.warn("[Pivot] Territory Planning synthesis failed:", e);
    return null;
  }
}

// ── Wave 21: Quota Intelligence ───────────────────────────────────────────────

export async function synthesizeQuotaIntelligence(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<QuotaIntelligence | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of quota attainment and the biggest quota-setting issue",
  "overallAttainment": "Overall quota attainment percentage across the team",
  "attainmentDistribution": [{
    "bucket": "Attainment bucket (e.g., <50%, 50-80%, 80-100%, 100-120%, >120%)",
    "repCount": 0,
    "percentOfTeam": "Percentage of team in this bucket",
    "insight": "What this bucket tells us about quota setting or rep performance"
  }],
  "quotaFit": [{
    "segment": "Segment or role",
    "currentQuota": "Current quota level",
    "recommendedQuota": "Recommended quota based on market data",
    "gap": "Difference between current and recommended",
    "rationale": "Why the adjustment is needed"
  }],
  "rampAnalysis": [{
    "cohort": "Rep cohort (e.g., 0-3 months, 3-6 months, 6-12 months, 12+ months)",
    "avgAttainment": "Average attainment for this cohort",
    "rampTarget": "Expected ramp target for this tenure",
    "onTrack": true,
    "action": "Recommended action for this cohort"
  }],
  "quotaScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales compensation and quota analyst evaluating quota attainment, quota fit, and rep ramp performance.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Quota Intelligence analysis:

1. SUMMARY: 2-3 sentence overview of quota attainment and the single biggest quota-setting issue.

2. OVERALL ATTAINMENT: Overall quota attainment percentage across the sales team.

3. ATTAINMENT DISTRIBUTION (4-5): For each attainment bucket:
   - Bucket (e.g., "<50%", "50-80%", "80-100%", "100-120%", ">120%")
   - Number of reps in this bucket
   - Percentage of team
   - Insight: what this distribution tells us about quota setting or rep quality

4. QUOTA FIT (2-4): For each segment or role:
   - Segment or role name
   - Current quota level
   - Recommended quota based on market data and territory potential
   - Gap between current and recommended
   - Rationale for the adjustment

5. RAMP ANALYSIS (3-4): For each rep tenure cohort:
   - Cohort (e.g., "0-3 months", "3-6 months", "6-12 months", "12+ months")
   - Average attainment for this cohort
   - Expected ramp target for this tenure
   - Whether the cohort is on track (true/false)
   - Recommended action

6. QUOTA SCORE: 0-100 — overall quota design and attainment health.

7. RECOMMENDATIONS (4-6): Actionable steps to improve quota setting, attainment, and ramp effectiveness.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Quota Intelligence...");
    const result = await callJson(genai, prompt);
    return result as unknown as QuotaIntelligence;
  } catch (e) {
    console.warn("[Pivot] Quota Intelligence synthesis failed:", e);
    return null;
  }
}

// ── Wave 22: Feature Prioritization ───────────────────────────────────────────

export async function synthesizeFeaturePrioritization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<FeaturePrioritization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of feature prioritization and the highest-impact opportunity",
  "features": [{
    "name": "Feature name",
    "reach": "Number of users or customers impacted",
    "impact": "high|medium|low — expected business impact",
    "confidence": "high|medium|low — confidence in the estimate",
    "effort": "Estimated effort (e.g., '2 sprints', '1 quarter')",
    "riceScore": 0,
    "category": "quick-win|strategic-bet|tech-debt|nice-to-have"
  }],
  "quickWins": [{
    "feature": "Quick win feature name",
    "impact": "Expected impact",
    "effort": "Estimated effort",
    "rationale": "Why this is a quick win"
  }],
  "techDebt": [{
    "item": "Tech debt item",
    "severity": "critical|moderate|low",
    "costOfDelay": "Cost of not addressing this debt",
    "recommendation": "How to address it"
  }],
  "impactEffortMatrix": {
    "highImpactLowEffort": ["feature 1", "..."],
    "highImpactHighEffort": ["feature 1", "..."],
    "lowImpactLowEffort": ["feature 1", "..."],
    "lowImpactHighEffort": ["feature 1", "..."]
  },
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a product strategist creating a RICE-based feature prioritization framework with an impact-effort matrix.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Feature Prioritization analysis:

1. SUMMARY: 2-3 sentence overview of feature prioritization and the single highest-impact opportunity.

2. FEATURES (5-8): For each feature or initiative:
   - Feature name
   - Reach: number of users or customers impacted
   - Impact: "high", "medium", or "low"
   - Confidence: "high", "medium", or "low" — confidence in the estimates
   - Effort: estimated effort (e.g., "2 sprints", "1 quarter")
   - RICE score: calculated priority score (0-100)
   - Category: "quick-win", "strategic-bet", "tech-debt", or "nice-to-have"

3. QUICK WINS (2-4): Features that are high-impact and low-effort:
   - Feature name
   - Expected impact
   - Estimated effort
   - Rationale for why this is a quick win

4. TECH DEBT (2-4): Technical debt items to address:
   - Item description
   - Severity: "critical", "moderate", or "low"
   - Cost of delay: what happens if this isn't addressed
   - Recommendation: how to address it

5. IMPACT-EFFORT MATRIX: Categorize features into four quadrants:
   - High Impact / Low Effort (do first)
   - High Impact / High Effort (plan carefully)
   - Low Impact / Low Effort (fill gaps)
   - Low Impact / High Effort (avoid)

6. RECOMMENDATIONS (4-6): Actionable steps for product roadmap prioritization.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Feature Prioritization...");
    const result = await callJson(genai, prompt);
    return result as unknown as FeaturePrioritization;
  } catch (e) {
    console.warn("[Pivot] Feature Prioritization synthesis failed:", e);
    return null;
  }
}

// ── Wave 22: Product Usage Analytics ──────────────────────────────────────────

export async function synthesizeProductUsageAnalytics(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ProductUsageAnalytics | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of product usage patterns and the most important engagement insight",
  "dauMau": "DAU/MAU ratio (e.g., '0.35' or '35%')",
  "dauMauTrend": "improving|stable|declining",
  "stickyFeatures": [{
    "feature": "Feature name",
    "usageRate": "Percentage of active users who use this feature",
    "retentionCorrelation": "How strongly this feature correlates with retention",
    "insight": "Why this feature drives stickiness"
  }],
  "churnCorrelation": [{
    "signal": "Usage signal that correlates with churn",
    "correlation": "How strongly this signal predicts churn (e.g., 'strong', '0.72')",
    "threshold": "At what level does this signal become dangerous",
    "intervention": "Recommended intervention when this signal is detected"
  }],
  "engagementSegments": [{
    "segment": "User engagement segment (e.g., Power Users, Regular, At-Risk, Dormant)",
    "percentage": "Percentage of users in this segment",
    "behavior": "Key behavioral characteristics",
    "strategy": "Engagement strategy for this segment"
  }],
  "usageScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a product analytics expert analyzing user engagement, feature stickiness, and churn correlation patterns.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Product Usage Analytics analysis:

1. SUMMARY: 2-3 sentence overview of product usage patterns and the most important engagement insight.

2. DAU/MAU: The DAU/MAU ratio and its trend ("improving", "stable", or "declining").

3. STICKY FEATURES (3-5): For each feature that drives retention:
   - Feature name
   - Usage rate: percentage of active users who use this feature
   - Retention correlation: how strongly using this feature correlates with retention
   - Insight: why this feature drives stickiness

4. CHURN CORRELATION (3-5): For each usage signal that predicts churn:
   - Signal description (e.g., "Login frequency drops below 2x/week", "Key feature unused for 14 days")
   - Correlation strength
   - Threshold: at what level does this signal become dangerous
   - Recommended intervention

5. ENGAGEMENT SEGMENTS (3-4): For each user segment:
   - Segment name (e.g., "Power Users", "Regular", "At-Risk", "Dormant")
   - Percentage of users
   - Key behavioral characteristics
   - Engagement strategy

6. USAGE SCORE: 0-100 — overall product engagement health.

7. RECOMMENDATIONS (4-6): Actionable steps to improve engagement, increase stickiness, and reduce churn.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Product Usage Analytics...");
    const result = await callJson(genai, prompt);
    return result as unknown as ProductUsageAnalytics;
  } catch (e) {
    console.warn("[Pivot] Product Usage Analytics synthesis failed:", e);
    return null;
  }
}

// ── Wave 22: Tech Stack Audit ─────────────────────────────────────────────────

export async function synthesizeTechStackAudit(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TechStackAudit | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of tech stack health and the most critical finding",
  "components": [{
    "name": "Technology or tool name",
    "category": "Category (e.g., Infrastructure, Database, Frontend, Backend, DevOps, Analytics, Security)",
    "annualCost": "Annual cost for this component",
    "utilization": "How well utilized this component is (e.g., '60%', 'underutilized')",
    "risk": "high|medium|low — operational or security risk",
    "verdict": "keep|optimize|replace|consolidate"
  }],
  "totalAnnualCost": "Total annual tech stack spend",
  "redundancies": [{
    "tools": ["Tool A", "Tool B"],
    "overlap": "What functionality overlaps",
    "savingsOpportunity": "Dollar savings from consolidation",
    "recommendation": "Which to keep and which to retire"
  }],
  "securityGaps": [{
    "gap": "Security gap description",
    "severity": "critical|high|medium|low",
    "affectedComponents": ["Component 1", "..."],
    "remediation": "How to address this gap"
  }],
  "stackScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a technology strategist auditing the full tech stack for cost efficiency, redundancies, security gaps, and modernization opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Tech Stack Audit:

1. SUMMARY: 2-3 sentence overview of tech stack health and the single most critical finding.

2. COMPONENTS (5-8): For each significant technology component:
   - Technology or tool name
   - Category (e.g., "Infrastructure", "Database", "Frontend", "Backend", "DevOps", "Analytics", "Security")
   - Annual cost
   - Utilization: how well utilized
   - Risk level: "high", "medium", or "low"
   - Verdict: "keep", "optimize", "replace", or "consolidate"

3. TOTAL ANNUAL COST: Total annual tech stack spend.

4. REDUNDANCIES (2-4): For each identified redundancy:
   - Which tools overlap
   - What functionality overlaps
   - Dollar savings from consolidation
   - Recommendation: which to keep and which to retire

5. SECURITY GAPS (2-4): For each security gap:
   - Gap description
   - Severity: "critical", "high", "medium", or "low"
   - Affected components
   - Remediation steps

6. STACK SCORE: 0-100 — overall tech stack health rating.

7. RECOMMENDATIONS (4-6): Actionable steps to optimize the tech stack, reduce costs, close security gaps, and eliminate redundancies.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Tech Stack Audit...");
    const result = await callJson(genai, prompt);
    return result as unknown as TechStackAudit;
  } catch (e) {
    console.warn("[Pivot] Tech Stack Audit synthesis failed:", e);
    return null;
  }
}

// ── Wave 22: API Strategy ─────────────────────────────────────────────────────

export async function synthesizeApiStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ApiStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of API strategy and the biggest monetization or integration opportunity",
  "endpoints": [{
    "endpoint": "API endpoint or capability",
    "purpose": "What this API does",
    "usage": "Current usage level or demand signal",
    "monetizable": true,
    "priority": "high|medium|low"
  }],
  "monetization": [{
    "model": "Monetization model (e.g., usage-based, tiered, freemium, revenue share)",
    "revenueEstimate": "Estimated annual revenue from this model",
    "targetAudience": "Who would pay for this API access",
    "rationale": "Why this model fits"
  }],
  "developerExperience": {
    "documentation": "Assessment of API documentation quality",
    "onboarding": "How easy is it for developers to get started",
    "sdkSupport": "Available SDKs and language coverage",
    "support": "Developer support quality and channels",
    "score": 0
  },
  "integrationPartners": [{
    "partner": "Potential integration partner",
    "type": "Type of integration (e.g., data sync, embedded, marketplace)",
    "revenueOpportunity": "Estimated revenue from this integration",
    "effort": "Effort to build the integration"
  }],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an API strategy consultant evaluating API endpoints, monetization opportunities, developer experience, and integration partnerships.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive API Strategy analysis:

1. SUMMARY: 2-3 sentence overview of API strategy and the biggest monetization or integration opportunity.

2. ENDPOINTS (4-6): For each API endpoint or capability:
   - Endpoint or capability name
   - Purpose: what this API does
   - Usage: current usage level or demand signal
   - Monetizable: true/false — can this endpoint generate revenue
   - Priority: "high", "medium", or "low"

3. MONETIZATION (2-3): For each monetization model:
   - Model name (e.g., "Usage-based pricing", "Tiered access", "Freemium", "Revenue share")
   - Revenue estimate: estimated annual revenue
   - Target audience: who would pay for API access
   - Rationale: why this model fits the business

4. DEVELOPER EXPERIENCE: Assessment of:
   - Documentation quality
   - Onboarding ease
   - SDK support and language coverage
   - Developer support quality
   - DX score: 0-100

5. INTEGRATION PARTNERS (3-5): For each potential partner:
   - Partner name
   - Integration type (e.g., "Data sync", "Embedded", "Marketplace")
   - Revenue opportunity
   - Effort to build

6. RECOMMENDATIONS (4-6): Actionable steps to improve API strategy, monetization, and developer experience.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating API Strategy...");
    const result = await callJson(genai, prompt);
    return result as unknown as ApiStrategy;
  } catch (e) {
    console.warn("[Pivot] API Strategy synthesis failed:", e);
    return null;
  }
}

// ── Wave 22: Platform Scalability ─────────────────────────────────────────────

export async function synthesizePlatformScalability(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PlatformScalability | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of platform scalability and the most pressing bottleneck",
  "dimensions": [{
    "dimension": "Scalability dimension (e.g., Compute, Storage, Network, Database, Application layer)",
    "currentCapacity": "Current capacity for this dimension",
    "peakUsage": "Peak usage level",
    "headroom": "How much headroom before hitting limits (e.g., '3x before scaling needed')",
    "scalingStrategy": "How to scale this dimension when needed",
    "risk": "high|medium|low"
  }],
  "overallHeadroom": "Overall scaling headroom before major architectural changes are needed",
  "costPerUnit": [{
    "metric": "Unit metric (e.g., cost per user, cost per transaction, cost per GB)",
    "currentCost": "Current cost per unit",
    "trend": "increasing|stable|decreasing",
    "benchmark": "Industry benchmark for this cost",
    "optimization": "How to reduce this cost"
  }],
  "bottlenecks": [{
    "component": "Component that will bottleneck first",
    "threshold": "At what scale will it break",
    "impact": "What happens when it breaks",
    "mitigation": "How to prevent or address it"
  }],
  "scalabilityScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a platform scalability architect evaluating the scaling dimensions, headroom, cost efficiency, and bottleneck risks of the technology platform.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Platform Scalability analysis:

1. SUMMARY: 2-3 sentence overview of platform scalability and the most pressing bottleneck.

2. DIMENSIONS (4-6): For each scalability dimension:
   - Dimension name (e.g., "Compute", "Storage", "Network", "Database", "Application layer")
   - Current capacity
   - Peak usage level
   - Headroom: how much room before hitting limits
   - Scaling strategy: how to scale when needed
   - Risk level: "high", "medium", or "low"

3. OVERALL HEADROOM: Overall scaling headroom before major architectural changes are required.

4. COST PER UNIT (3-5): For each unit economics metric:
   - Metric name (e.g., "Cost per user", "Cost per transaction", "Cost per GB stored")
   - Current cost per unit
   - Trend: "increasing", "stable", or "decreasing"
   - Industry benchmark
   - Optimization opportunity

5. BOTTLENECKS (2-4): For each potential bottleneck:
   - Component that will bottleneck first
   - At what scale it will break
   - Impact when it breaks
   - Mitigation strategy

6. SCALABILITY SCORE: 0-100 — overall platform scalability rating.

7. RECOMMENDATIONS (4-6): Actionable steps to improve scalability, reduce unit costs, and eliminate bottlenecks.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Platform Scalability...");
    const result = await callJson(genai, prompt);
    return result as unknown as PlatformScalability;
  } catch (e) {
    console.warn("[Pivot] Platform Scalability synthesis failed:", e);
    return null;
  }
}

// ── Wave 22: User Onboarding ──────────────────────────────────────────────────

export async function synthesizeUserOnboarding(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<UserOnboarding | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of user onboarding effectiveness and the biggest dropoff risk",
  "completionRate": "Percentage of users who complete the full onboarding flow",
  "timeToValue": "Average time from signup to first value moment (e.g., '3.2 days')",
  "steps": [{
    "step": "Onboarding step name",
    "completionRate": "Percentage of users who complete this step",
    "avgTime": "Average time to complete this step",
    "dropoffRate": "Percentage of users who drop off at this step",
    "friction": "What causes friction at this step"
  }],
  "dropoffPoints": [{
    "point": "Where users drop off",
    "dropoffRate": "Percentage of users lost at this point",
    "cause": "Root cause of the dropoff",
    "revenueImpact": "Revenue impact of users lost here",
    "fix": "How to fix this dropoff"
  }],
  "segmentPerformance": [{
    "segment": "User segment (e.g., by plan, industry, or source)",
    "completionRate": "Completion rate for this segment",
    "timeToValue": "Time to value for this segment",
    "insight": "Key insight about this segment's onboarding behavior"
  }],
  "onboardingScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a user onboarding expert analyzing completion rates, time to value, dropoff points, and segment-level performance.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive User Onboarding analysis:

1. SUMMARY: 2-3 sentence overview of onboarding effectiveness and the biggest dropoff risk.

2. COMPLETION RATE: Percentage of users who complete the full onboarding flow.

3. TIME TO VALUE: Average time from signup to first value moment.

4. STEPS (4-6): For each onboarding step:
   - Step name (e.g., "Account creation", "Profile setup", "First integration", "First use case", "Team invite")
   - Completion rate for this step
   - Average time to complete
   - Dropoff rate at this step
   - What causes friction

5. DROPOFF POINTS (2-4): For each significant dropoff:
   - Where users drop off
   - Dropoff rate
   - Root cause
   - Revenue impact of users lost
   - How to fix it

6. SEGMENT PERFORMANCE (2-4): For each user segment:
   - Segment name (by plan, industry, acquisition source, etc.)
   - Completion rate
   - Time to value
   - Key insight about onboarding behavior

7. ONBOARDING SCORE: 0-100 — overall onboarding effectiveness rating.

8. RECOMMENDATIONS (4-6): Actionable steps to improve onboarding completion, reduce time to value, and fix dropoff points.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating User Onboarding...");
    const result = await callJson(genai, prompt);
    return result as unknown as UserOnboarding;
  } catch (e) {
    console.warn("[Pivot] User Onboarding synthesis failed:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wave 25: Supply Chain & Operations
// ═══════════════════════════════════════════════════════════════════════════════

export async function synthesizeSupplyChainRisk(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SupplyChainRisk | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of supply chain vulnerabilities and risk posture",
  "overallRiskScore": 0,
  "vulnerabilities": [{
    "supplier": "Supplier name or category",
    "component": "Component or service supplied",
    "riskLevel": "critical|high|medium|low",
    "singleSource": true,
    "geography": "Geographic region of supplier",
    "mitigationPlan": "Plan to mitigate this vulnerability"
  }],
  "singleSourceDependencies": 0,
  "geographicConcentration": "Description of geographic concentration risk",
  "contingencyPlans": ["contingency plan 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a supply chain risk analyst specializing in vulnerability assessment, single-source dependency analysis, and geographic concentration risk.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Supply Chain Risk analysis:

1. SUMMARY: 2-3 sentence overview of supply chain vulnerabilities and overall risk posture.

2. OVERALL RISK SCORE (0-100): Composite supply chain risk score where 0 = minimal risk, 100 = critical risk.

3. VULNERABILITIES (4-8): For each supply chain vulnerability:
   - Supplier name or category
   - Component or service supplied
   - Risk level: "critical", "high", "medium", or "low"
   - Whether this is a single-source dependency (true/false)
   - Geographic region of the supplier
   - Mitigation plan for this vulnerability

4. SINGLE SOURCE DEPENDENCIES: Count of suppliers where no alternative exists.

5. GEOGRAPHIC CONCENTRATION: Description of geographic concentration risk across the supply chain.

6. CONTINGENCY PLANS (3-5): Pre-built contingency plans for key disruption scenarios.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce supply chain risk, diversify suppliers, and improve resilience.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Supply Chain Risk (Wave 25)...");
    const result = await callJson(genai, prompt);
    return result as unknown as SupplyChainRisk;
  } catch (e) {
    console.warn("[Pivot] Supply Chain Risk synthesis failed:", e);
    return null;
  }
}

// ── Wave 25: Inventory Optimization ──────────────────────────────────────────

export async function synthesizeInventoryOptimization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<InventoryOptimization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of inventory health, turnover efficiency, and dead stock risk",
  "totalCarryingCost": "Total annual inventory carrying cost or 'Insufficient data'",
  "items": [{
    "category": "Inventory category name",
    "turnoverRate": 0,
    "carryingCost": "Annual carrying cost for this category",
    "daysOnHand": 0,
    "reorderPoint": "Optimal reorder point or trigger",
    "deadStockRisk": "Description of dead stock risk for this category"
  }],
  "deadStockValue": "Total estimated dead stock value or 'Insufficient data'",
  "turnoverRatio": 0,
  "cashFreedUp": "Estimated cash that could be freed by optimizing inventory or 'Insufficient data'",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an inventory optimization expert analyzing inventory turnover, carrying costs, reorder points, and dead stock across the business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Inventory Optimization analysis:

1. SUMMARY: 2-3 sentence overview of inventory health, turnover efficiency, and dead stock risk.

2. TOTAL CARRYING COST: Total annual cost of holding inventory.

3. ITEMS (4-8): For each inventory category:
   - Category name (e.g., "Raw Materials", "Finished Goods", "Work-in-Progress", "MRO Supplies")
   - Turnover rate (number of times inventory is sold/used per year)
   - Carrying cost for this category
   - Days on hand (average days inventory sits before use/sale)
   - Optimal reorder point or trigger
   - Dead stock risk description

4. DEAD STOCK VALUE: Total estimated value of inventory unlikely to sell or be used.

5. TURNOVER RATIO: Overall inventory turnover ratio for the business.

6. CASH FREED UP: Estimated cash that could be freed by optimizing inventory levels.

7. RECOMMENDATIONS (4-6): Actionable steps to improve turnover, reduce carrying costs, eliminate dead stock, and optimize reorder points.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Inventory Optimization...");
    const result = await callJson(genai, prompt);
    return result as unknown as InventoryOptimization;
  } catch (e) {
    console.warn("[Pivot] Inventory Optimization synthesis failed:", e);
    return null;
  }
}

// ── Wave 25: Vendor Scorecard ────────────────────────────────────────────────

export async function synthesizeVendorScorecard(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<VendorScorecard | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of vendor performance, reliability, and cost trends",
  "totalVendors": 0,
  "vendors": [{
    "vendor": "Vendor name",
    "overallScore": 0,
    "deliveryReliability": "Delivery reliability percentage or description",
    "qualityScore": 0,
    "costTrend": "Description of cost trend (increasing, stable, decreasing)",
    "contractStatus": "Contract status (active, expiring, up for renewal)",
    "risk": "Risk assessment for this vendor"
  }],
  "topPerformer": "Name of the highest-performing vendor",
  "atRiskVendors": ["at-risk vendor 1", "..."],
  "consolidationOpportunities": ["consolidation opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a vendor management expert evaluating vendor performance ratings, delivery reliability, quality metrics, and cost trends.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Vendor Scorecard analysis:

1. SUMMARY: 2-3 sentence overview of vendor performance, reliability, and cost trends.

2. TOTAL VENDORS: Number of active vendor relationships.

3. VENDORS (5-10): For each key vendor:
   - Vendor name or category
   - Overall score (0-100)
   - Delivery reliability (percentage or description)
   - Quality score (0-100)
   - Cost trend (increasing, stable, or decreasing)
   - Contract status (active, expiring, up for renewal)
   - Risk assessment for this vendor

4. TOP PERFORMER: The highest-performing vendor by overall score.

5. AT-RISK VENDORS (2-4): Vendors with poor performance or high risk.

6. CONSOLIDATION OPPORTUNITIES (2-4): Vendors with overlapping capabilities that could be consolidated.

7. RECOMMENDATIONS (4-6): Actionable steps to improve vendor management, renegotiate terms, and reduce vendor risk.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Vendor Scorecard (Wave 25)...");
    const result = await callJson(genai, prompt);
    return result as unknown as VendorScorecard;
  } catch (e) {
    console.warn("[Pivot] Vendor Scorecard synthesis failed:", e);
    return null;
  }
}

// ── Wave 25: Operational Efficiency ──────────────────────────────────────────

export async function synthesizeOperationalEfficiency(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<OperationalEfficiency | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of process bottlenecks, cycle times, and throughput optimization opportunities",
  "overallScore": 0,
  "processes": [{
    "process": "Process name",
    "cycleTime": "Average cycle time for this process",
    "throughput": "Current throughput (units/period)",
    "utilization": "Resource utilization percentage",
    "bottleneck": "Primary bottleneck in this process",
    "improvement": "Specific improvement recommendation"
  }],
  "totalWaste": "Total estimated waste from inefficiencies or 'Insufficient data'",
  "automationOpportunities": ["automation opportunity 1", "..."],
  "quickWins": ["quick win 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an operational efficiency expert specializing in process bottleneck identification, cycle time analysis, and throughput optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Operational Efficiency analysis:

1. SUMMARY: 2-3 sentence overview of process bottlenecks, cycle times, and throughput optimization opportunities.

2. OVERALL SCORE (0-100): Composite operational efficiency score.

3. PROCESSES (5-8): For each key business process:
   - Process name (e.g., "Order Fulfillment", "Customer Onboarding", "Invoice Processing")
   - Cycle time: average time to complete one cycle
   - Throughput: current units processed per period
   - Utilization: resource utilization percentage
   - Bottleneck: the primary constraint in this process
   - Improvement: specific recommendation to improve this process

4. TOTAL WASTE: Estimated total dollar waste from process inefficiencies.

5. AUTOMATION OPPORTUNITIES (3-5): Processes or tasks that could be automated for significant gains.

6. QUICK WINS (3-5): Low-effort improvements achievable within 30 days.

7. RECOMMENDATIONS (4-6): Actionable steps to eliminate bottlenecks, reduce cycle times, and optimize throughput.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Operational Efficiency (Wave 25)...");
    const result = await callJson(genai, prompt);
    return result as unknown as OperationalEfficiency;
  } catch (e) {
    console.warn("[Pivot] Operational Efficiency synthesis failed:", e);
    return null;
  }
}

// ── Wave 25: Quality Management ──────────────────────────────────────────────

export async function synthesizeQualityManagement(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<QualityManagement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of quality posture, defect rates, and improvement opportunities",
  "overallDefectRate": "Overall defect rate percentage or 'Insufficient data'",
  "metrics": [{
    "area": "Quality area name",
    "defectRate": "Defect rate for this area",
    "costOfQuality": "Cost of quality issues in this area",
    "trend": "Trend direction (improving, stable, degrading)",
    "rootCause": "Primary root cause of defects",
    "improvement": "Specific improvement recommendation"
  }],
  "costOfPoorQuality": "Total cost of poor quality across all areas or 'Insufficient data'",
  "sixSigmaLevel": "Estimated Six Sigma level or 'Insufficient data'",
  "continuousImprovements": ["continuous improvement initiative 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a quality management expert analyzing defect rates, quality costs, and continuous improvement opportunities across the business.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Quality Management analysis:

1. SUMMARY: 2-3 sentence overview of quality posture, defect rates, and improvement opportunities.

2. OVERALL DEFECT RATE: The aggregate defect rate across products/services.

3. METRICS (4-6): For each quality area:
   - Area name (e.g., "Product Quality", "Service Delivery", "Software Bugs", "Customer Complaints", "Process Errors")
   - Defect rate for this area
   - Cost of quality issues in this area (dollar amount where possible)
   - Trend: "improving", "stable", or "degrading"
   - Root cause of defects in this area
   - Specific improvement recommendation

4. COST OF POOR QUALITY: Total estimated cost of all quality issues combined.

5. SIX SIGMA LEVEL: Estimated Six Sigma process capability level (1-6 sigma).

6. CONTINUOUS IMPROVEMENTS (3-5): Ongoing improvement initiatives that should be implemented.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce defects, lower quality costs, and build a culture of continuous improvement.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Quality Management...");
    const result = await callJson(genai, prompt);
    return result as unknown as QualityManagement;
  } catch (e) {
    console.warn("[Pivot] Quality Management synthesis failed:", e);
    return null;
  }
}

// ── Wave 25: Capacity Planning ───────────────────────────────────────────────

export async function synthesizeCapacityPlanning(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CapacityPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of utilization rates, growth headroom, and scaling needs",
  "overallUtilization": "Overall utilization rate across key resources",
  "resources": [{
    "resource": "Resource name",
    "currentUtilization": "Current utilization percentage or description",
    "maxCapacity": "Maximum capacity for this resource",
    "headroom": "Remaining headroom before capacity is reached",
    "scalingTrigger": "Event or metric that triggers scaling",
    "investmentNeeded": "Investment required to scale this resource"
  }],
  "growthHeadroom": "Overall growth headroom description before major investment is needed",
  "nextBottleneck": "The resource that will hit capacity first",
  "scalingTimeline": "Estimated timeline until scaling is required",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a capacity planning expert analyzing utilization rates, growth headroom, scaling triggers, and infrastructure needs.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Capacity Planning analysis:

1. SUMMARY: 2-3 sentence overview of utilization rates, growth headroom, and scaling needs.

2. OVERALL UTILIZATION: Aggregate resource utilization rate across key business resources.

3. RESOURCES (4-6): For each key resource:
   - Resource name (e.g., "Engineering Team", "Server Infrastructure", "Sales Capacity", "Support Staff", "Warehouse Space")
   - Current utilization percentage or description
   - Maximum capacity for this resource
   - Headroom: remaining capacity before limits are reached
   - Scaling trigger: what event or metric triggers the need to invest in more capacity
   - Investment needed: cost estimate to scale this resource

4. GROWTH HEADROOM: Overall description of how much the business can grow before major investment is required.

5. NEXT BOTTLENECK: The single resource that will hit capacity limits first.

6. SCALING TIMELINE: Estimated timeline until the next major scaling effort is needed.

7. RECOMMENDATIONS (4-6): Actionable steps to optimize utilization, prepare for scaling triggers, and address infrastructure needs.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Capacity Planning (Wave 25)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CapacityPlanning;
  } catch (e) {
    console.warn("[Pivot] Capacity Planning synthesis failed:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wave 26: Customer Experience & Journey
// ═══════════════════════════════════════════════════════════════════════════════

export async function synthesizeCustomerJourneyMap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerJourneyMap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the customer journey, key friction points, and moments of truth",
  "stages": [{
    "stage": "Journey stage name",
    "touchpoint": "Key touchpoint at this stage",
    "satisfaction": 0,
    "frictionLevel": "Description of friction level (none, low, medium, high)",
    "momentOfTruth": true,
    "optimization": "Specific optimization recommendation for this touchpoint"
  }],
  "topFrictionPoints": ["friction point 1", "..."],
  "momentsOfTruth": ["moment of truth 1", "..."],
  "dropoffPoints": ["dropoff point 1", "..."],
  "overallSatisfaction": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer experience strategist specializing in touchpoint analysis, friction point identification, and moments of truth across the customer journey.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Journey Map analysis:

1. SUMMARY: 2-3 sentence overview of the customer journey, key friction points, and moments of truth.

2. STAGES (6-10): For each journey stage/touchpoint:
   - Stage name (e.g., "Awareness", "Consideration", "Purchase", "Onboarding", "Usage", "Support", "Renewal", "Advocacy")
   - Key touchpoint at this stage
   - Satisfaction score (0-100) for this touchpoint
   - Friction level: "none", "low", "medium", or "high"
   - Whether this is a moment of truth (true/false)
   - Specific optimization recommendation

3. TOP FRICTION POINTS (3-5): The most impactful friction points costing the business revenue or satisfaction.

4. MOMENTS OF TRUTH (3-5): Critical interactions that disproportionately shape customer perception.

5. DROPOFF POINTS (2-4): Where customers are most likely to disengage or churn.

6. OVERALL SATISFACTION (0-100): Composite customer satisfaction score across the entire journey.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce friction, optimize moments of truth, and improve the overall journey.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Journey Map (Wave 26)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerJourneyMap;
  } catch (e) {
    console.warn("[Pivot] Customer Journey Map synthesis failed:", e);
    return null;
  }
}

// ── Wave 26: NPS Analysis ────────────────────────────────────────────────────

export async function synthesizeNpsAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<NpsAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of Net Promoter Score health and key drivers",
  "overallNps": 0,
  "segments": [{
    "segment": "Customer segment name",
    "score": 0,
    "respondents": 0,
    "trend": "Trend direction (improving, stable, declining)",
    "topDriver": "Primary driver of this segment's score"
  }],
  "promoterPercentage": "Percentage of promoters (score 9-10)",
  "detractorPercentage": "Percentage of detractors (score 0-6)",
  "topImprovementDrivers": ["improvement driver 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer loyalty expert specializing in Net Promoter Score analysis, promoter/detractor segmentation, and loyalty driver identification.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive NPS Analysis:

1. SUMMARY: 2-3 sentence overview of NPS health, promoter/detractor balance, and key improvement drivers.

2. OVERALL NPS: Net Promoter Score (-100 to +100).

3. SEGMENTS (3-6): For each customer segment:
   - Segment name (e.g., by product line, plan tier, geography, tenure)
   - NPS score for this segment
   - Number of respondents
   - Trend: "improving", "stable", or "declining"
   - Primary driver of this segment's score

4. PROMOTER PERCENTAGE: Percentage of customers who are promoters (9-10 score).

5. DETRACTOR PERCENTAGE: Percentage of customers who are detractors (0-6 score).

6. TOP IMPROVEMENT DRIVERS (3-5): The actions most likely to convert detractors to passives and passives to promoters.

7. RECOMMENDATIONS (4-6): Actionable steps to improve NPS, grow the promoter base, and reduce detractors.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating NPS Analysis...");
    const result = await callJson(genai, prompt);
    return result as unknown as NpsAnalysis;
  } catch (e) {
    console.warn("[Pivot] NPS Analysis synthesis failed:", e);
    return null;
  }
}

// ── Wave 26: Support Ticket Intelligence ─────────────────────────────────────

export async function synthesizeSupportTicketIntelligence(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SupportTicketIntelligence | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of support ticket patterns, resolution effectiveness, and escalation risks",
  "totalTickets": 0,
  "categories": [{
    "category": "Ticket category name",
    "volume": 0,
    "avgResolutionTime": "Average time to resolve tickets in this category",
    "escalationRate": "Percentage of tickets escalated in this category",
    "selfServiceable": true,
    "trend": "Trend direction (increasing, stable, decreasing)"
  }],
  "avgResolutionTime": "Overall average resolution time across all categories",
  "firstContactResolution": "Percentage of tickets resolved on first contact or 'Insufficient data'",
  "selfServiceOpportunity": "Description of self-service opportunities to reduce ticket volume",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer support intelligence analyst specializing in ticket categorization, resolution trend analysis, and escalation pattern identification.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Support Ticket Intelligence analysis:

1. SUMMARY: 2-3 sentence overview of support ticket patterns, resolution effectiveness, and escalation risks.

2. TOTAL TICKETS: Estimated total ticket volume (monthly or annual).

3. CATEGORIES (4-8): For each ticket category:
   - Category name (e.g., "Billing Issues", "Technical Bugs", "Feature Requests", "Onboarding Help", "Account Management")
   - Volume: number of tickets in this category
   - Average resolution time for this category
   - Escalation rate: percentage of tickets that get escalated
   - Self-serviceable: whether this category could be addressed via self-service (true/false)
   - Trend: "increasing", "stable", or "decreasing"

4. AVERAGE RESOLUTION TIME: Overall average time to resolve a support ticket.

5. FIRST CONTACT RESOLUTION: Percentage of tickets resolved on the first interaction.

6. SELF-SERVICE OPPORTUNITY: Description of which ticket categories could be deflected through self-service tools (knowledge base, chatbot, FAQ).

7. RECOMMENDATIONS (4-6): Actionable steps to reduce ticket volume, improve resolution times, lower escalation rates, and expand self-service.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Support Ticket Intelligence...");
    const result = await callJson(genai, prompt);
    return result as unknown as SupportTicketIntelligence;
  } catch (e) {
    console.warn("[Pivot] Support Ticket Intelligence synthesis failed:", e);
    return null;
  }
}

// ── Wave 26: Customer Health Score ───────────────────────────────────────────

export async function synthesizeCustomerHealthScore(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerHealthScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer health, churn signals, and expansion signals",
  "overallScore": 0,
  "indicators": [{
    "indicator": "Health indicator name",
    "weight": 0,
    "score": 0,
    "signal": "positive|neutral|negative",
    "detail": "Detailed explanation of this indicator's status"
  }],
  "atRiskPercentage": "Percentage of customers classified as at-risk or 'Insufficient data'",
  "expansionReadyPercentage": "Percentage of customers ready for expansion or 'Insufficient data'",
  "churnPrediction": "Churn prediction summary or 'Insufficient data'",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer success expert specializing in composite health metrics, churn signal detection, and expansion signal identification.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Health Score analysis:

1. SUMMARY: 2-3 sentence overview of customer health, churn signals, and expansion signals.

2. OVERALL SCORE (0-100): Composite customer health score across the entire customer base.

3. INDICATORS (5-8): For each health indicator:
   - Indicator name (e.g., "Product Usage Frequency", "Support Ticket Volume", "Payment Timeliness", "Feature Adoption", "NPS Score", "Engagement Recency", "Contract Value Trend")
   - Weight: relative importance of this indicator (0.0-1.0, should sum to ~1.0)
   - Score: 0-100 score for this indicator
   - Signal: "positive", "neutral", or "negative"
   - Detail: explanation of what this indicator reveals

4. AT-RISK PERCENTAGE: Percentage of customers showing churn signals.

5. EXPANSION-READY PERCENTAGE: Percentage of customers showing signals for upsell/cross-sell.

6. CHURN PREDICTION: Summary of expected churn and leading churn indicators.

7. RECOMMENDATIONS (4-6): Actionable steps to improve customer health, reduce churn risk, and capitalize on expansion opportunities.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Health Score (Wave 26)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerHealthScore;
  } catch (e) {
    console.warn("[Pivot] Customer Health Score synthesis failed:", e);
    return null;
  }
}

// ── Wave 26: Voice of Customer ───────────────────────────────────────────────

export async function synthesizeVoiceOfCustomer(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<VoiceOfCustomer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer sentiment themes, top requests, and complaint patterns",
  "themes": [{
    "theme": "Theme name",
    "sentiment": "positive|negative|mixed",
    "frequency": 0,
    "impact": "Business impact of this theme",
    "sampleQuote": "Representative customer quote or paraphrase"
  }],
  "topFeatureRequests": ["feature request 1", "..."],
  "topComplaints": ["complaint 1", "..."],
  "topPraise": ["praise item 1", "..."],
  "sentimentTrend": "Overall sentiment trend description (improving, stable, declining)",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a voice-of-customer analyst specializing in sentiment theme extraction, feature request prioritization, and complaint pattern analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Voice of Customer analysis:

1. SUMMARY: 2-3 sentence overview of customer sentiment themes, top requests, and complaint patterns.

2. THEMES (5-8): For each customer feedback theme:
   - Theme name (e.g., "Ease of Use", "Pricing Fairness", "Feature Gaps", "Support Quality", "Reliability")
   - Sentiment: "positive", "negative", or "mixed"
   - Frequency: relative frequency score (1-100, how often this theme appears)
   - Impact: business impact of this theme
   - Sample quote: a representative customer quote or paraphrase

3. TOP FEATURE REQUESTS (3-5): Most frequently requested features or improvements.

4. TOP COMPLAINTS (3-5): Most common customer complaints and pain points.

5. TOP PRAISE (3-5): Most common positive feedback and what customers love.

6. SENTIMENT TREND: Overall sentiment trend across customer feedback (improving, stable, declining).

7. RECOMMENDATIONS (4-6): Actionable steps to address complaints, prioritize feature requests, and amplify what customers love.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Voice of Customer...");
    const result = await callJson(genai, prompt);
    return result as unknown as VoiceOfCustomer;
  } catch (e) {
    console.warn("[Pivot] Voice of Customer synthesis failed:", e);
    return null;
  }
}

// ── Wave 26: Customer Segmentation ───────────────────────────────────────────

export async function synthesizeCustomerSegmentation(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerSegmentation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of behavioral segments, value tiers, and engagement clusters",
  "segments": [{
    "segment": "Segment name",
    "size": "Number or percentage of customers in this segment",
    "revenue": "Revenue contribution from this segment",
    "avgLifetimeValue": "Average lifetime value for this segment",
    "behavior": "Key behavioral characteristics of this segment",
    "engagementLevel": "Engagement level description (high, medium, low)",
    "strategy": "Recommended strategy for this segment"
  }],
  "highValuePercentage": "Percentage of customers in the high-value tier or 'Insufficient data'",
  "growthSegment": "The segment with the highest growth potential",
  "atRiskSegment": "The segment with the highest churn risk",
  "personalizationOpportunities": ["personalization opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer segmentation expert specializing in behavioral segmentation, value tier analysis, and engagement cluster identification.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Segmentation analysis:

1. SUMMARY: 2-3 sentence overview of behavioral segments, value tiers, and engagement clusters.

2. SEGMENTS (4-7): For each customer segment:
   - Segment name (e.g., "Power Users", "Casual Adopters", "Price-Sensitive", "Enterprise Champions", "At-Risk Churners")
   - Size: number or percentage of customers in this segment
   - Revenue: revenue contribution from this segment
   - Average lifetime value for customers in this segment
   - Behavior: key behavioral characteristics
   - Engagement level: "high", "medium", or "low"
   - Strategy: recommended go-to-market or retention strategy

3. HIGH-VALUE PERCENTAGE: Percentage of customers in the high-value tier.

4. GROWTH SEGMENT: The segment with the highest growth potential and why.

5. AT-RISK SEGMENT: The segment with the highest churn risk and why.

6. PERSONALIZATION OPPORTUNITIES (3-5): Ways to personalize the experience for different segments to improve retention and revenue.

7. RECOMMENDATIONS (4-6): Actionable steps to optimize segment targeting, improve engagement, and maximize customer lifetime value.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Segmentation (Wave 26)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerSegmentation;
  } catch (e) {
    console.warn("[Pivot] Customer Segmentation synthesis failed:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wave 27: Innovation & IP
// ═══════════════════════════════════════════════════════════════════════════════

export async function synthesizeInnovationPipeline(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<InnovationPipeline | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of the innovation pipeline health",
  "totalIdeas": 0,
  "ideas": [{
    "idea": "Innovation idea name",
    "stage": "ideation|validation|development|launch",
    "potential": "Revenue or strategic potential assessment",
    "timeToMarket": "Estimated time to market",
    "investmentNeeded": "Investment required",
    "status": "Current status"
  }],
  "killRate": "Percentage of ideas killed before launch",
  "avgTimeToMarket": "Average time from ideation to launch",
  "innovationIndex": "Overall innovation effectiveness score",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an innovation strategy expert analyzing the idea funnel, stage-gate progress, time-to-market velocity, and kill rate.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Innovation Pipeline analysis:

1. SUMMARY: 2-3 sentence overview of the innovation pipeline health and key findings.

2. TOTAL IDEAS: Number of ideas currently in the pipeline.

3. IDEAS (4-6): For each idea in the funnel:
   - Idea name
   - Stage: ideation, validation, development, or launch
   - Potential: revenue or strategic potential
   - Time to market estimate
   - Investment needed
   - Current status

4. KILL RATE: Percentage of ideas killed before reaching launch.

5. AVG TIME TO MARKET: Average time from ideation to launch.

6. INNOVATION INDEX: Overall innovation effectiveness score or assessment.

7. RECOMMENDATIONS (4-6): Actionable steps to improve the innovation pipeline.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Innovation Pipeline (Wave 27)...");
    const result = await callJson(genai, prompt);
    return result as unknown as InnovationPipeline;
  } catch (e) {
    console.warn("[Pivot] Innovation Pipeline (Wave 27) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeIpPortfolio(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<IpPortfolio | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of IP portfolio strength and gaps",
  "totalAssets": 0,
  "assets": [{
    "type": "patent|trademark|copyright|trade_secret",
    "name": "IP asset name",
    "status": "Current status (registered, pending, etc.)",
    "jurisdiction": "Jurisdiction of protection",
    "expiryDate": "Expiry or renewal date",
    "value": "Estimated value"
  }],
  "protectionGaps": ["gap 1", "..."],
  "licensingOpportunities": ["opportunity 1", "..."],
  "competitiveIpLandscape": "Assessment of competitive IP positioning",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an intellectual property strategist analyzing patent/trademark inventory, protection gaps, and licensing opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive IP Portfolio analysis:

1. SUMMARY: 2-3 sentence overview of IP portfolio strength and critical gaps.

2. TOTAL ASSETS: Number of IP assets identified.

3. ASSETS (3-6): For each IP asset:
   - Type: patent, trademark, copyright, or trade_secret
   - Name of the asset
   - Status: registered, pending, unprotected, etc.
   - Jurisdiction of protection
   - Expiry or renewal date
   - Estimated value

4. PROTECTION GAPS (3-5): Areas where IP is unprotected or under-protected.

5. LICENSING OPPORTUNITIES (2-4): Potential revenue from licensing existing IP.

6. COMPETITIVE IP LANDSCAPE: How the business IP compares to competitors.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen the IP portfolio.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating IP Portfolio (Wave 27)...");
    const result = await callJson(genai, prompt);
    return result as unknown as IpPortfolio;
  } catch (e) {
    console.warn("[Pivot] IP Portfolio (Wave 27) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeRdEfficiency(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RdEfficiency | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of R&D efficiency and spending effectiveness",
  "totalSpend": "Total R&D spend amount",
  "projects": [{
    "project": "R&D project name",
    "investment": "Investment amount",
    "stage": "Current stage of the project",
    "successProbability": "Estimated probability of success",
    "expectedReturn": "Expected return on investment",
    "timeline": "Project timeline"
  }],
  "spendToRevenueRatio": "R&D spend as percentage of revenue",
  "successRate": "Percentage of R&D projects that succeed",
  "portfolioBalance": "Balance across research types",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an R&D efficiency analyst evaluating R&D spend ratios, output per dollar invested, and project success rates.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive R&D Efficiency analysis:

1. SUMMARY: 2-3 sentence overview of R&D spending effectiveness and key findings.

2. TOTAL SPEND: Total R&D expenditure amount.

3. PROJECTS (3-6): For each R&D project:
   - Project name
   - Investment amount
   - Current stage
   - Success probability
   - Expected return
   - Timeline

4. SPEND TO REVENUE RATIO: R&D spend as a percentage of revenue.

5. SUCCESS RATE: Percentage of R&D projects that achieve their goals.

6. PORTFOLIO BALANCE: Assessment of balance across basic research, applied research, and development.

7. RECOMMENDATIONS (4-6): Actionable steps to improve R&D efficiency and ROI.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating R&D Efficiency (Wave 27)...");
    const result = await callJson(genai, prompt);
    return result as unknown as RdEfficiency;
  } catch (e) {
    console.warn("[Pivot] R&D Efficiency (Wave 27) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeTechnologyReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TechnologyReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of technology maturity and readiness",
  "overallReadiness": 0,
  "areas": [{
    "technology": "Technology area name",
    "maturityLevel": "Maturity level assessment",
    "adoptionPhase": "Current adoption phase",
    "migrationNeeded": true,
    "techDebt": "Technical debt assessment for this area",
    "readiness": "Readiness rating"
  }],
  "migrationRoadmap": ["migration step 1", "..."],
  "techDebtTotal": "Total estimated technical debt",
  "modernizationPriorities": ["priority 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a technology readiness assessor evaluating tech maturity levels, adoption curves, and migration roadmaps.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Tech Stack: ${questionnaire.techStack ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Technology Readiness analysis:

1. SUMMARY: 2-3 sentence overview of technology maturity and readiness posture.

2. OVERALL READINESS (0-100): Composite technology readiness score.

3. AREAS (4-6): For each technology area:
   - Technology name
   - Maturity level (emerging, growing, mature, declining)
   - Adoption phase (innovator, early adopter, early majority, late majority, laggard)
   - Whether migration is needed (true/false)
   - Technical debt assessment
   - Readiness rating

4. MIGRATION ROADMAP (3-5): Ordered steps for technology migration.

5. TECH DEBT TOTAL: Estimated total technical debt across all areas.

6. MODERNIZATION PRIORITIES (3-5): Most urgent modernization needs.

7. RECOMMENDATIONS (4-6): Actionable steps to improve technology readiness.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Technology Readiness (Wave 27)...");
    const result = await callJson(genai, prompt);
    return result as unknown as TechnologyReadiness;
  } catch (e) {
    console.warn("[Pivot] Technology Readiness (Wave 27) synthesis failed:", e);
    return null;
  }
}

export async function synthesizePartnershipEcosystem(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PartnershipEcosystem | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of partnership ecosystem health",
  "totalPartners": 0,
  "partnerships": [{
    "partner": "Partner name",
    "type": "Partnership type (strategic, technology, distribution, etc.)",
    "valueExchange": "What each party provides",
    "strategicFit": 0,
    "revenue": "Revenue generated through this partnership",
    "status": "Current partnership status"
  }],
  "revenueFromPartners": "Total revenue attributable to partnerships",
  "strategicGaps": ["gap 1", "..."],
  "newOpportunities": ["opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a partnership strategy expert analyzing partnership inventory, value exchange dynamics, and strategic fit.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Partnership Ecosystem analysis:

1. SUMMARY: 2-3 sentence overview of partnership ecosystem health and strategic value.

2. TOTAL PARTNERS: Number of active partnerships.

3. PARTNERSHIPS (3-6): For each partnership:
   - Partner name
   - Type: strategic, technology, distribution, channel, etc.
   - Value exchange: what each party provides
   - Strategic fit score (1-10)
   - Revenue generated
   - Current status

4. REVENUE FROM PARTNERS: Total revenue attributable to partnerships.

5. STRATEGIC GAPS (3-5): Partnership areas that are missing or under-developed.

6. NEW OPPORTUNITIES (3-5): Potential new partnerships to pursue.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen the partnership ecosystem.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Partnership Ecosystem (Wave 27)...");
    const result = await callJson(genai, prompt);
    return result as unknown as PartnershipEcosystem;
  } catch (e) {
    console.warn("[Pivot] Partnership Ecosystem (Wave 27) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeMergersAcquisitions(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MergersAcquisitions | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of M&A landscape and opportunities",
  "targets": [{
    "target": "Acquisition target name or profile",
    "rationale": "Strategic rationale for acquisition",
    "estimatedValue": "Estimated acquisition cost",
    "synergyPotential": "Expected synergy value",
    "integrationComplexity": "low|medium|high — integration difficulty",
    "fitScore": 0
  }],
  "totalSynergyPotential": "Total synergy value across all targets",
  "topTarget": "Highest-priority acquisition target",
  "budgetRequired": "Total budget needed for recommended acquisitions",
  "timelineEstimate": "Expected timeline for M&A execution",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an M&A strategy advisor scoring acquisition targets, assessing synergy potential, and evaluating integration complexity.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Mergers & Acquisitions analysis:

1. SUMMARY: 2-3 sentence overview of M&A landscape and strategic opportunity.

2. TARGETS (3-5): For each potential acquisition target:
   - Target name or profile
   - Strategic rationale
   - Estimated acquisition cost
   - Synergy potential (revenue and cost synergies)
   - Integration complexity: low, medium, or high
   - Fit score (1-10)

3. TOTAL SYNERGY POTENTIAL: Combined synergy value across all targets.

4. TOP TARGET: Highest-priority acquisition target and why.

5. BUDGET REQUIRED: Total capital needed for recommended acquisitions.

6. TIMELINE ESTIMATE: Expected timeline for M&A execution.

7. RECOMMENDATIONS (4-6): Actionable M&A strategy steps.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Mergers & Acquisitions (Wave 27)...");
    const result = await callJson(genai, prompt);
    return result as unknown as MergersAcquisitions;
  } catch (e) {
    console.warn("[Pivot] Mergers & Acquisitions (Wave 27) synthesis failed:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wave 28: Sustainability & Governance
// ═══════════════════════════════════════════════════════════════════════════════

export async function synthesizeEsgScorecard(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<EsgScorecard | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of ESG performance and critical gaps",
  "overallScore": 0,
  "dimensions": [{
    "dimension": "environmental|social|governance",
    "score": 0,
    "benchmark": 0,
    "topIssue": "Most critical issue in this dimension",
    "improvement": "Key improvement action"
  }],
  "industryRank": "Ranking relative to industry peers",
  "reportingReadiness": "Readiness for ESG reporting frameworks",
  "materialIssues": ["material issue 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an ESG (Environmental, Social, Governance) analyst providing ESG scoring, industry benchmarks, and improvement roadmaps.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive ESG Scorecard analysis:

1. SUMMARY: 2-3 sentence overview of ESG performance and critical gaps.

2. OVERALL SCORE (0-100): Composite ESG score.

3. DIMENSIONS (3 required — environmental, social, governance): For each:
   - Dimension name
   - Score (0-100)
   - Industry benchmark score
   - Top issue in this dimension
   - Key improvement action

4. INDUSTRY RANK: How this business ranks relative to industry peers on ESG.

5. REPORTING READINESS: Readiness for ESG reporting frameworks (GRI, SASB, TCFD, etc.).

6. MATERIAL ISSUES (3-5): Most material ESG issues for this business.

7. RECOMMENDATIONS (4-6): Actionable steps to improve ESG performance.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating ESG Scorecard (Wave 28)...");
    const result = await callJson(genai, prompt);
    return result as unknown as EsgScorecard;
  } catch (e) {
    console.warn("[Pivot] ESG Scorecard (Wave 28) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCarbonFootprint(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CarbonFootprint | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of carbon footprint and reduction priorities",
  "totalEmissions": "Total annual emissions estimate",
  "sources": [{
    "source": "Emission source name",
    "scope": "scope1|scope2|scope3",
    "annualEmissions": "Annual emissions from this source",
    "percentage": "Percentage of total emissions",
    "reductionPotential": "Potential reduction achievable"
  }],
  "reductionTarget": "Recommended emissions reduction target",
  "offsetCost": "Estimated cost to offset remaining emissions",
  "regulatoryRisk": "Regulatory risk from current emissions profile",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a carbon footprint analyst assessing emissions inventory, reduction targets, and offset opportunities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Carbon Footprint analysis:

1. SUMMARY: 2-3 sentence overview of carbon footprint and reduction priorities.

2. TOTAL EMISSIONS: Total estimated annual emissions (in metric tons CO2e).

3. SOURCES (3-6): For each emission source:
   - Source name (e.g., electricity, transportation, supply chain)
   - Scope: scope1 (direct), scope2 (energy), or scope3 (value chain)
   - Annual emissions from this source
   - Percentage of total emissions
   - Reduction potential

4. REDUCTION TARGET: Recommended emissions reduction target and timeline.

5. OFFSET COST: Estimated cost to offset remaining emissions.

6. REGULATORY RISK: Assessment of regulatory risk from current emissions.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce carbon footprint.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Carbon Footprint (Wave 28)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CarbonFootprint;
  } catch (e) {
    console.warn("[Pivot] Carbon Footprint (Wave 28) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeRegulatoryCompliance(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RegulatoryCompliance | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of compliance posture and critical risks",
  "overallStatus": "Overall compliance status assessment",
  "areas": [{
    "area": "Compliance area name",
    "status": "compliant|partial|non_compliant",
    "riskLevel": "Risk level assessment",
    "lastAudit": "Date or timeframe of last audit",
    "nextDeadline": "Next compliance deadline",
    "gaps": "Description of compliance gaps"
  }],
  "upcomingRegulations": ["upcoming regulation 1", "..."],
  "auditReadiness": "Assessment of readiness for regulatory audit",
  "fineExposure": "Estimated financial exposure from non-compliance",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a regulatory compliance expert assessing compliance inventory, risk levels, and audit readiness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Regulatory Compliance analysis:

1. SUMMARY: 2-3 sentence overview of compliance posture and critical risks.

2. OVERALL STATUS: High-level compliance status assessment.

3. AREAS (4-6): For each compliance area:
   - Area name (e.g., data privacy, financial reporting, employment law, industry-specific)
   - Status: compliant, partial, or non_compliant
   - Risk level
   - Last audit date or timeframe
   - Next compliance deadline
   - Description of gaps

4. UPCOMING REGULATIONS (2-4): New or changing regulations that will affect this business.

5. AUDIT READINESS: Assessment of readiness for a regulatory audit.

6. FINE EXPOSURE: Estimated financial exposure from current non-compliance areas.

7. RECOMMENDATIONS (4-6): Actionable steps to improve compliance posture.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Regulatory Compliance (Wave 28)...");
    const result = await callJson(genai, prompt);
    return result as unknown as RegulatoryCompliance;
  } catch (e) {
    console.warn("[Pivot] Regulatory Compliance (Wave 28) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeBusinessContinuity(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<BusinessContinuity | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of business continuity readiness",
  "overallReadiness": "Overall readiness assessment",
  "functions": [{
    "function": "Critical business function name",
    "rto": "Recovery Time Objective",
    "rpo": "Recovery Point Objective",
    "currentCapability": "Current recovery capability",
    "gap": "Gap between target and current capability",
    "priority": "Recovery priority level"
  }],
  "disasterRecoveryPlan": "Assessment of current disaster recovery plan",
  "testFrequency": "How often DR plans are tested",
  "singlePointsOfFailure": ["single point of failure 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a business continuity expert assessing disaster recovery readiness and critical function mapping.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Business Continuity analysis:

1. SUMMARY: 2-3 sentence overview of business continuity readiness and biggest vulnerability.

2. OVERALL READINESS: High-level readiness assessment.

3. FUNCTIONS (4-6): For each critical business function:
   - Function name (e.g., order processing, customer support, IT infrastructure, payroll)
   - RTO: Recovery Time Objective (target time to restore)
   - RPO: Recovery Point Objective (acceptable data loss window)
   - Current capability: current recovery capability
   - Gap: difference between target and actual capability
   - Priority: recovery priority level

4. DISASTER RECOVERY PLAN: Assessment of current DR plan quality and completeness.

5. TEST FREQUENCY: How often disaster recovery plans are tested.

6. SINGLE POINTS OF FAILURE (3-5): Critical single points of failure in the business.

7. RECOMMENDATIONS (4-6): Actionable steps to improve business continuity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Business Continuity (Wave 28)...");
    const result = await callJson(genai, prompt);
    return result as unknown as BusinessContinuity;
  } catch (e) {
    console.warn("[Pivot] Business Continuity (Wave 28) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeEthicsFramework(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<EthicsFramework | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of ethical risk posture and governance maturity",
  "overallMaturity": "Overall ethics framework maturity level",
  "risks": [{
    "area": "Ethical risk area",
    "riskLevel": "Risk level assessment",
    "currentPolicy": "Current policy in place",
    "gap": "Gap in current policy or practice",
    "stakeholderImpact": "Impact on stakeholders",
    "mitigation": "Recommended mitigation"
  }],
  "policyGaps": ["policy gap 1", "..."],
  "governanceStructure": "Assessment of ethics governance structure",
  "trainingCoverage": "Ethics training coverage assessment",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a business ethics expert assessing ethical risk, policy gaps, and governance structure.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Ethics Framework analysis:

1. SUMMARY: 2-3 sentence overview of ethical risk posture and governance maturity.

2. OVERALL MATURITY: Ethics framework maturity level (nascent, developing, established, advanced).

3. RISKS (4-6): For each ethical risk area:
   - Area name (e.g., data ethics, labor practices, environmental impact, supply chain ethics, AI ethics)
   - Risk level
   - Current policy in place
   - Gap in policy or practice
   - Stakeholder impact
   - Recommended mitigation

4. POLICY GAPS (3-5): Missing or insufficient ethics policies.

5. GOVERNANCE STRUCTURE: Assessment of ethics governance (board oversight, ethics committee, reporting channels).

6. TRAINING COVERAGE: How well ethics training covers the organization.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen the ethics framework.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Ethics Framework (Wave 28)...");
    const result = await callJson(genai, prompt);
    return result as unknown as EthicsFramework;
  } catch (e) {
    console.warn("[Pivot] Ethics Framework (Wave 28) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeSocialImpact(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SocialImpact | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of social impact and community engagement",
  "overallScore": 0,
  "metrics": [{
    "area": "Impact area name",
    "metric": "Specific metric being measured",
    "currentValue": "Current metric value",
    "target": "Target value",
    "socialROI": "Social return on investment",
    "stakeholder": "Primary stakeholder affected"
  }],
  "communityInvestment": "Total community investment amount or assessment",
  "volunteerHours": "Employee volunteer hours or assessment",
  "reportingFramework": "Social impact reporting framework used or recommended",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a social impact analyst measuring community impact metrics, social ROI, and sustainability reporting.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Social Impact analysis:

1. SUMMARY: 2-3 sentence overview of social impact and community engagement.

2. OVERALL SCORE (0-100): Composite social impact score.

3. METRICS (4-6): For each impact area:
   - Area name (e.g., community development, education, health, environment, economic opportunity)
   - Specific metric being measured
   - Current value
   - Target value
   - Social ROI assessment
   - Primary stakeholder affected

4. COMMUNITY INVESTMENT: Total community investment amount or assessment.

5. VOLUNTEER HOURS: Employee volunteer hours contribution.

6. REPORTING FRAMEWORK: Social impact reporting framework used or recommended (e.g., B Corp, UN SDGs, GRI).

7. RECOMMENDATIONS (4-6): Actionable steps to increase social impact and improve reporting.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Social Impact (Wave 28)...");
    const result = await callJson(genai, prompt);
    return result as unknown as SocialImpact;
  } catch (e) {
    console.warn("[Pivot] Social Impact (Wave 28) synthesis failed:", e);
    return null;
  }
}

// ── Wave 31: Financial Planning & Analysis ────────────────────────────────────

export async function synthesizeScenarioPlanning(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ScenarioPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of scenario planning analysis and strategic outlook",
  "scenarios": [{
    "name": "Scenario name",
    "probability": "Estimated probability",
    "revenue": "Projected revenue under this scenario",
    "costs": "Projected costs under this scenario",
    "profit": "Projected profit under this scenario",
    "cashPosition": "Expected cash position",
    "keyAssumptions": ["assumption 1", "..."]
  }],
  "baseCase": "Description of the base-case scenario",
  "bestCase": "Description of the best-case scenario",
  "worstCase": "Description of the worst-case scenario",
  "criticalVariables": ["variable 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a financial planning strategist building scenario models for executive decision-making.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Scenario Planning analysis:

1. SUMMARY: 2-3 sentence overview of the scenario planning analysis and strategic outlook.

2. SCENARIOS (3-5): For each scenario:
   - Name (e.g., "Aggressive Growth", "Market Contraction", "Steady State", "Disruption", "Regulatory Shift")
   - Probability of occurrence
   - Projected revenue
   - Projected costs
   - Projected profit
   - Expected cash position
   - Key assumptions driving this scenario (3-5)

3. BASE CASE: Description of the most likely scenario with key metrics.

4. BEST CASE: Description of the optimistic scenario with upside potential.

5. WORST CASE: Description of the pessimistic scenario with downside risk and survival implications.

6. CRITICAL VARIABLES (4-6): The key variables that most influence which scenario materializes.

7. RECOMMENDATIONS (4-6): Actionable steps to prepare for multiple scenarios and maximize optionality.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Scenario Planning (Wave 31)...");
    const result = await callJson(genai, prompt);
    return result as unknown as ScenarioPlanning;
  } catch (e) {
    console.warn("[Pivot] Scenario Planning (Wave 31) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCapitalStructure(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CapitalStructure | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of capital structure and financing mix",
  "components": [{
    "type": "Capital type (e.g., equity, term debt, revolving credit, convertible notes)",
    "amount": "Dollar amount or percentage",
    "cost": "Cost of this capital component",
    "percentage": "Percentage of total capital",
    "maturity": "Maturity or duration",
    "flexibility": "Flexibility assessment"
  }],
  "wacc": "Weighted average cost of capital estimate",
  "debtToEquity": "Current debt-to-equity ratio",
  "optimalStructure": "Recommended optimal capital structure",
  "refinancingOpportunities": ["opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a corporate finance expert analyzing capital structure, cost of capital, and financing optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Capital Structure analysis:

1. SUMMARY: 2-3 sentence overview of the current capital structure and financing mix.

2. COMPONENTS (3-6): For each capital component:
   - Type (equity, term debt, revolving credit, convertible notes, etc.)
   - Amount or percentage of total
   - Cost of this capital
   - Percentage of total capital structure
   - Maturity or term
   - Flexibility assessment (ability to adjust)

3. WACC: Estimated weighted average cost of capital.

4. DEBT-TO-EQUITY: Current debt-to-equity ratio with industry comparison.

5. OPTIMAL STRUCTURE: Recommended optimal capital structure given growth stage and risk profile.

6. REFINANCING OPPORTUNITIES (3-5): Specific opportunities to lower cost of capital or improve terms.

7. RECOMMENDATIONS (4-6): Actionable steps to optimize capital structure and reduce financing costs.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Capital Structure (Wave 31)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CapitalStructure;
  } catch (e) {
    console.warn("[Pivot] Capital Structure (Wave 31) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeWorkingCapital(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<WorkingCapital | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of working capital efficiency and cash conversion",
  "items": [{
    "component": "Working capital component (e.g., accounts receivable, inventory, accounts payable)",
    "currentDays": 0,
    "benchmarkDays": 0,
    "cashImpact": "Dollar impact of optimizing this component",
    "trend": "Improving / Stable / Deteriorating",
    "improvement": "Specific improvement action"
  }],
  "cashConversionCycle": 0,
  "netWorkingCapital": "Net working capital amount",
  "improvementPotential": "Total cash that could be freed by optimizing working capital",
  "seasonalityImpact": "How seasonality affects working capital needs",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a treasury and working capital specialist analyzing cash conversion efficiency and liquidity management.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Working Capital analysis:

1. SUMMARY: 2-3 sentence overview of working capital efficiency and cash conversion performance.

2. ITEMS (4-6): For each working capital component:
   - Component name (accounts receivable, inventory, accounts payable, prepaid expenses, etc.)
   - Current days outstanding (DSO, DIO, DPO, etc.)
   - Industry benchmark days
   - Dollar impact of optimizing this component
   - Trend direction (Improving / Stable / Deteriorating)
   - Specific improvement action

3. CASH CONVERSION CYCLE: Total days in the cash conversion cycle (DSO + DIO - DPO).

4. NET WORKING CAPITAL: Current net working capital position.

5. IMPROVEMENT POTENTIAL: Total cash that could be freed by optimizing working capital to benchmarks.

6. SEASONALITY IMPACT: How seasonal patterns affect working capital needs and timing.

7. RECOMMENDATIONS (4-6): Actionable steps to improve working capital efficiency and free up cash.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Working Capital (Wave 31)...");
    const result = await callJson(genai, prompt);
    return result as unknown as WorkingCapital;
  } catch (e) {
    console.warn("[Pivot] Working Capital (Wave 31) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeTaxStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TaxStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of tax position and optimization opportunities",
  "effectiveRate": "Current effective tax rate",
  "areas": [{
    "area": "Tax optimization area",
    "currentRate": "Current rate or treatment",
    "optimizedRate": "Potential optimized rate or treatment",
    "savingsPotential": "Dollar savings potential",
    "complexity": "Implementation complexity (Low / Medium / High)",
    "timeline": "Time to implement"
  }],
  "totalSavings": "Total estimated tax savings across all areas",
  "complianceRisk": "Overall compliance risk assessment",
  "structuralChanges": ["structural change 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a tax strategy advisor analyzing tax efficiency, compliance, and optimization opportunities for businesses.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Tax Strategy analysis:

1. SUMMARY: 2-3 sentence overview of the current tax position and key optimization opportunities.

2. EFFECTIVE RATE: Current effective tax rate across all jurisdictions.

3. AREAS (4-6): For each tax optimization area:
   - Area name (e.g., R&D credits, depreciation strategy, entity structure, transfer pricing, state/local optimization, deferred compensation)
   - Current rate or treatment
   - Potential optimized rate or treatment
   - Dollar savings potential
   - Implementation complexity (Low / Medium / High)
   - Timeline to implement

4. TOTAL SAVINGS: Aggregate estimated annual tax savings if all recommendations implemented.

5. COMPLIANCE RISK: Overall assessment of current compliance posture and audit risk.

6. STRUCTURAL CHANGES (3-5): Entity structure or jurisdictional changes that could improve tax efficiency.

7. RECOMMENDATIONS (4-6): Actionable steps to reduce tax burden while maintaining full compliance.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Tax Strategy (Wave 31)...");
    const result = await callJson(genai, prompt);
    return result as unknown as TaxStrategy;
  } catch (e) {
    console.warn("[Pivot] Tax Strategy (Wave 31) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeFundraisingReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<FundraisingReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of fundraising readiness and investor attractiveness",
  "overallScore": 0,
  "dimensions": [{
    "dimension": "Readiness dimension (e.g., financials, traction, team, market, product, governance)",
    "score": 0,
    "benchmark": 0,
    "gap": "Gap description between current state and fundraising-ready",
    "action": "Specific action to close the gap"
  }],
  "suggestedRound": "Recommended fundraising round type and size",
  "valuationRange": "Estimated valuation range based on metrics",
  "timeToReady": "Estimated time to reach fundraising readiness",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a venture capital advisor evaluating a company's readiness to raise funding from institutional investors.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Fundraising Readiness assessment:

1. SUMMARY: 2-3 sentence overview of current fundraising readiness and investor attractiveness.

2. OVERALL SCORE (0-100): Composite readiness score weighted across all dimensions.

3. DIMENSIONS (5-7): For each readiness dimension:
   - Dimension name (financials, traction/metrics, team depth, market size, product maturity, governance/legal, data room)
   - Current score (0-100)
   - Benchmark score for successful raises in this stage
   - Gap description
   - Specific action to close the gap

4. SUGGESTED ROUND: Recommended round type (Pre-Seed, Seed, Series A, etc.) and target raise amount.

5. VALUATION RANGE: Estimated valuation range based on current metrics and comparable transactions.

6. TIME TO READY: Estimated calendar time to reach fundraising-ready state.

7. RECOMMENDATIONS (4-6): Actionable steps to maximize fundraising success and valuation.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Fundraising Readiness (Wave 31)...");
    const result = await callJson(genai, prompt);
    return result as unknown as FundraisingReadiness;
  } catch (e) {
    console.warn("[Pivot] Fundraising Readiness (Wave 31) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeExitStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ExitStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of exit options and value maximization strategy",
  "options": [{
    "type": "Exit type (e.g., strategic acquisition, PE buyout, IPO, management buyout, merger)",
    "likelihood": "Likelihood assessment for this exit path",
    "valuationMultiple": "Expected valuation multiple",
    "timeline": "Estimated timeline to execute",
    "requirements": ["requirement 1", "..."],
    "risks": "Key risks for this exit path"
  }],
  "bestOption": "Recommended best exit option given current position",
  "currentValuation": "Estimated current company valuation",
  "targetValuation": "Target valuation to maximize exit value",
  "gapToClose": ["gap 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an M&A and exit strategy advisor helping business owners understand and maximize their exit options.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Exit Strategy analysis:

1. SUMMARY: 2-3 sentence overview of available exit paths and value maximization strategy.

2. OPTIONS (3-5): For each exit path:
   - Exit type (strategic acquisition, private equity buyout, IPO, management buyout, merger, ESOP, etc.)
   - Likelihood of successful execution
   - Expected valuation multiple (revenue or EBITDA multiple)
   - Estimated timeline to execute
   - Key requirements to pursue this path (3-5)
   - Primary risks

3. BEST OPTION: Recommended optimal exit path given the company's current position, growth trajectory, and owner goals.

4. CURRENT VALUATION: Estimated current company valuation based on available financial data and comparable transactions.

5. TARGET VALUATION: Target valuation to achieve before pursuing exit, with justification.

6. GAP TO CLOSE (4-6): Specific gaps between current state and exit-ready state that must be addressed.

7. RECOMMENDATIONS (4-6): Actionable steps to maximize exit value and prepare for a successful transaction.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Exit Strategy (Wave 31)...");
    const result = await callJson(genai, prompt);
    return result as unknown as ExitStrategy;
  } catch (e) {
    console.warn("[Pivot] Exit Strategy (Wave 31) synthesis failed:", e);
    return null;
  }
}

// ── Wave 32: People & Culture Analytics ───────────────────────────────────────

export async function synthesizeTalentAcquisition(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<TalentAcquisition | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of talent acquisition effectiveness and hiring pipeline",
  "openRoles": 0,
  "needs": [{
    "role": "Role title",
    "priority": "Critical / High / Medium / Low",
    "department": "Department or team",
    "timeToFill": "Expected time to fill",
    "salaryRange": "Estimated salary range",
    "source": "Best sourcing channel for this role"
  }],
  "avgTimeToFill": "Average time to fill across all roles",
  "costPerHire": "Average cost per hire",
  "topSourceChannel": "Most effective sourcing channel",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a talent acquisition strategist analyzing hiring effectiveness, pipeline health, and recruitment optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Talent Acquisition analysis:

1. SUMMARY: 2-3 sentence overview of talent acquisition effectiveness and hiring pipeline health.

2. OPEN ROLES: Estimated number of open or needed roles based on growth trajectory and current gaps.

3. NEEDS (4-6): For each critical hiring need:
   - Role title
   - Priority level (Critical / High / Medium / Low)
   - Department or team
   - Expected time to fill based on market conditions
   - Estimated salary range for the market
   - Best sourcing channel (referrals, LinkedIn, agencies, job boards, etc.)

4. AVG TIME TO FILL: Average time to fill positions across all role types.

5. COST PER HIRE: Estimated average cost per hire including sourcing, interviewing, and onboarding.

6. TOP SOURCE CHANNEL: Most effective sourcing channel for this company's hiring needs.

7. RECOMMENDATIONS (4-6): Actionable steps to improve hiring velocity, quality, and employer brand.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Talent Acquisition (Wave 32)...");
    const result = await callJson(genai, prompt);
    return result as unknown as TalentAcquisition;
  } catch (e) {
    console.warn("[Pivot] Talent Acquisition (Wave 32) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeEmployeeEngagement(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<EmployeeEngagement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of employee engagement health and cultural vitality",
  "overallScore": 0,
  "drivers": [{
    "driver": "Engagement driver name",
    "score": 0,
    "benchmark": 0,
    "trend": "Improving / Stable / Declining",
    "impact": "Impact on retention and productivity",
    "action": "Specific improvement action"
  }],
  "eNPS": 0,
  "turnoverRate": "Current or estimated turnover rate",
  "topConcern": "The single biggest engagement risk",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational psychologist and employee engagement specialist analyzing workforce satisfaction, motivation, and retention risk.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Employee Engagement analysis:

1. SUMMARY: 2-3 sentence overview of employee engagement health and cultural vitality.

2. OVERALL SCORE (0-100): Composite engagement score based on all available signals.

3. DRIVERS (5-7): For each engagement driver:
   - Driver name (e.g., leadership trust, career growth, compensation fairness, work-life balance, mission alignment, team collaboration, recognition)
   - Current score (0-100)
   - Industry benchmark score
   - Trend direction (Improving / Stable / Declining)
   - Impact on retention and productivity
   - Specific action to improve this driver

4. eNPS: Estimated Employee Net Promoter Score (-100 to 100).

5. TURNOVER RATE: Current or estimated annual turnover rate with industry comparison.

6. TOP CONCERN: The single biggest engagement risk that could drive attrition.

7. RECOMMENDATIONS (4-6): Actionable steps to boost engagement, reduce turnover, and strengthen culture.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Employee Engagement (Wave 32)...");
    const result = await callJson(genai, prompt);
    return result as unknown as EmployeeEngagement;
  } catch (e) {
    console.warn("[Pivot] Employee Engagement (Wave 32) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCompensationBenchmark(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CompensationBenchmark | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of compensation competitiveness and pay equity",
  "bands": [{
    "role": "Role or job family",
    "currentPay": "Current compensation level",
    "marketMedian": "Market median for this role",
    "percentile": "Current pay percentile vs market",
    "gap": "Gap between current and target percentile",
    "attritionRisk": "Attrition risk due to compensation (Low / Medium / High)"
  }],
  "overallCompetitiveness": "Overall compensation competitiveness assessment",
  "totalCompSpend": "Total compensation spend or estimate",
  "equityAnalysis": "Equity/stock option competitiveness analysis",
  "benefitsGap": "Gap in benefits compared to market expectations",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a total rewards and compensation analyst benchmarking pay, equity, and benefits against market data.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Compensation Benchmark analysis:

1. SUMMARY: 2-3 sentence overview of compensation competitiveness and pay equity posture.

2. BANDS (4-6): For each key role or job family:
   - Role or job family name
   - Current compensation level (base + bonus if available)
   - Market median compensation
   - Current pay percentile vs market (e.g., 50th, 75th)
   - Gap between current and target percentile in dollar or percentage terms
   - Attrition risk due to compensation gap (Low / Medium / High)

3. OVERALL COMPETITIVENESS: Assessment of overall compensation positioning vs market (e.g., "Below market at 40th percentile").

4. TOTAL COMP SPEND: Total compensation spend or estimate as percentage of revenue.

5. EQUITY ANALYSIS: Competitiveness of equity/stock option program vs peers at similar stage.

6. BENEFITS GAP: Key gaps in benefits package compared to market and employee expectations.

7. RECOMMENDATIONS (4-6): Actionable steps to optimize compensation strategy, close critical gaps, and improve retention.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Compensation Benchmark (Wave 32)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CompensationBenchmark;
  } catch (e) {
    console.warn("[Pivot] Compensation Benchmark (Wave 32) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeSuccessionPlanning(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SuccessionPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of succession readiness and leadership pipeline strength",
  "roles": [{
    "role": "Critical leadership role",
    "incumbent": "Current incumbent or description",
    "readiness": "Succession readiness level (Ready Now / 1-2 Years / 3+ Years / No Successor)",
    "successors": ["potential successor 1", "..."],
    "developmentGap": "Key gap that needs to be closed for successor readiness",
    "urgency": "Urgency level (Immediate / Near-term / Long-term)"
  }],
  "criticalRolesAtRisk": 0,
  "benchStrength": "Overall bench strength assessment",
  "developmentInvestment": "Recommended investment in leadership development",
  "timelineToReady": "Average timeline to develop succession-ready candidates",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an executive leadership and succession planning consultant assessing leadership pipeline depth and continuity risk.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Succession Planning analysis:

1. SUMMARY: 2-3 sentence overview of succession readiness and leadership pipeline strength.

2. ROLES (4-6): For each critical leadership role:
   - Role title (CEO, CTO, VP Sales, Head of Product, etc.)
   - Current incumbent or description
   - Succession readiness level (Ready Now / 1-2 Years / 3+ Years / No Successor)
   - Potential internal successors
   - Key development gap that needs to be closed
   - Urgency level (Immediate / Near-term / Long-term)

3. CRITICAL ROLES AT RISK: Count of critical roles with no succession plan or no ready successor.

4. BENCH STRENGTH: Overall assessment of leadership bench depth (e.g., "Weak — 4 of 6 critical roles have no identified successor").

5. DEVELOPMENT INVESTMENT: Recommended annual investment in leadership development programs.

6. TIMELINE TO READY: Average estimated timeline to develop succession-ready candidates.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen the leadership pipeline and reduce key-person risk.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Succession Planning (Wave 32)...");
    const result = await callJson(genai, prompt);
    return result as unknown as SuccessionPlanning;
  } catch (e) {
    console.warn("[Pivot] Succession Planning (Wave 32) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeDiversityInclusion(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DiversityInclusion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of diversity, equity, and inclusion posture",
  "metrics": [{
    "category": "DEI category (e.g., gender, ethnicity, age, disability, leadership representation)",
    "currentState": "Current state assessment",
    "benchmark": "Industry benchmark",
    "trend": "Improving / Stable / Declining",
    "gap": "Gap between current state and benchmark or target",
    "initiative": "Recommended initiative to address this gap"
  }],
  "overallScore": 0,
  "representationGaps": ["gap 1", "..."],
  "inclusionIndex": "Inclusion index score or assessment",
  "payEquity": "Pay equity assessment across demographics",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a diversity, equity, and inclusion strategist analyzing workforce composition, inclusion culture, and equitable practices.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Diversity & Inclusion analysis:

1. SUMMARY: 2-3 sentence overview of the company's DEI posture, strengths, and areas for improvement.

2. METRICS (4-6): For each DEI category:
   - Category (gender, ethnicity, age, disability, leadership representation, supplier diversity, etc.)
   - Current state assessment
   - Industry benchmark for this category
   - Trend direction (Improving / Stable / Declining)
   - Gap between current state and target
   - Recommended initiative to close the gap

3. OVERALL SCORE (0-100): Composite DEI maturity score.

4. REPRESENTATION GAPS (3-5): Specific representation gaps at leadership, management, and individual contributor levels.

5. INCLUSION INDEX: Assessment of inclusion culture — do employees of all backgrounds feel valued and heard?

6. PAY EQUITY: Assessment of pay equity across demographics, including any identified disparities.

7. RECOMMENDATIONS (4-6): Actionable, measurable steps to advance DEI goals and create lasting cultural change.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Diversity & Inclusion (Wave 32)...");
    const result = await callJson(genai, prompt);
    return result as unknown as DiversityInclusion;
  } catch (e) {
    console.warn("[Pivot] Diversity & Inclusion (Wave 32) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCultureAssessment(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CultureAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of organizational culture health and alignment",
  "dimensions": [{
    "dimension": "Culture dimension (e.g., innovation, accountability, collaboration, customer focus, agility)",
    "score": 0,
    "alignment": "Alignment with stated values (Strong / Moderate / Weak)",
    "strength": "Key strength in this dimension",
    "risk": "Key risk or gap in this dimension"
  }],
  "overallHealth": 0,
  "coreValues": ["value 1", "..."],
  "subcultures": ["subculture description 1", "..."],
  "toxicityRisk": "Assessment of cultural toxicity risk and warning signs",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an organizational culture expert assessing cultural health, values alignment, and organizational dynamics.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns ?? "Not specified"}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Culture Assessment:

1. SUMMARY: 2-3 sentence overview of organizational culture health and alignment with business strategy.

2. DIMENSIONS (5-7): For each culture dimension:
   - Dimension name (innovation, accountability, collaboration, customer focus, agility, transparency, psychological safety, etc.)
   - Score (0-100)
   - Alignment with stated company values (Strong / Moderate / Weak)
   - Key strength in this dimension
   - Key risk or gap in this dimension

3. OVERALL HEALTH (0-100): Composite cultural health score.

4. CORE VALUES (3-5): Identified or stated core values and assessment of whether they are lived vs. aspirational.

5. SUBCULTURES (2-4): Distinct subcultures that exist within the organization (e.g., engineering vs. sales culture, remote vs. in-office) and their impact.

6. TOXICITY RISK: Assessment of cultural toxicity risk — warning signs such as fear-based management, blame culture, burnout, lack of psychological safety.

7. RECOMMENDATIONS (4-6): Actionable steps to strengthen healthy cultural elements and address toxic patterns.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Culture Assessment (Wave 32)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CultureAssessment;
  } catch (e) {
    console.warn("[Pivot] Culture Assessment (Wave 32) synthesis failed:", e);
    return null;
  }
}

// ── NOTE: Wave 29-30 functions (if added by another agent) should appear above this line ──

// ── Wave 29: Revenue Intelligence & Sales Analytics ──────────────────────────

export async function synthesizeDealPipeline(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DealPipeline | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of deal pipeline health and velocity",
  "totalPipelineValue": "$X.XM total pipeline value",
  "stages": [{
    "stage": "Stage name",
    "dealCount": 0,
    "totalValue": "$X.XM",
    "avgDaysInStage": 0,
    "conversionRate": "XX%",
    "dropoffReason": "Primary reason deals drop off at this stage"
  }],
  "avgDealCycle": "XX days average deal cycle",
  "winRate": "XX% overall win rate",
  "velocityTrend": "Improving/Declining/Stable with context",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a revenue operations analyst specializing in deal pipeline optimization and sales velocity metrics.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Deal Pipeline analysis:

1. SUMMARY: 2-3 sentence overview of deal pipeline health and velocity.
2. TOTAL PIPELINE VALUE: Estimated total pipeline value.
3. STAGES (4-6): For each pipeline stage — deal count, total value, avg days in stage, conversion rate, primary dropoff reason.
4. AVG DEAL CYCLE: Average days from first contact to close.
5. WIN RATE: Overall win rate percentage.
6. VELOCITY TREND: Whether pipeline velocity is improving, declining, or stable.
7. RECOMMENDATIONS (4-6): Actionable steps to improve pipeline health and velocity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Deal Pipeline (Wave 29)...");
    const result = await callJson(genai, prompt);
    return result as unknown as DealPipeline;
  } catch (e) {
    console.warn("[Pivot] Deal Pipeline (Wave 29) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeSalesForecasting(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<SalesForecasting | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of sales forecast accuracy and outlook",
  "forecastAccuracy": "XX% historical forecast accuracy",
  "periods": [{
    "period": "Q1 2025, Q2 2025, etc.",
    "predicted": "$X.XM predicted revenue",
    "confidence": 0,
    "drivers": ["driver 1", "driver 2"],
    "risks": ["risk 1", "risk 2"]
  }],
  "quotaAttainment": "XX% average quota attainment",
  "pipelineCoverage": "X.Xx pipeline coverage ratio",
  "upliftOpportunities": ["opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales forecasting analyst specializing in predictive revenue modeling and quota planning.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Sales Forecasting analysis:

1. SUMMARY: 2-3 sentence overview of forecast accuracy and sales outlook.
2. FORECAST ACCURACY: Historical forecast accuracy percentage.
3. PERIODS (3-4): For each forecast period — predicted revenue, confidence level (0-100), key drivers, key risks.
4. QUOTA ATTAINMENT: Average quota attainment across the team.
5. PIPELINE COVERAGE: Pipeline coverage ratio (pipeline / quota).
6. UPLIFT OPPORTUNITIES (3-5): Areas where forecast can be improved.
7. RECOMMENDATIONS (4-6): Actionable steps to improve forecast accuracy.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Sales Forecasting (Wave 29)...");
    const result = await callJson(genai, prompt);
    return result as unknown as SalesForecasting;
  } catch (e) {
    console.warn("[Pivot] Sales Forecasting (Wave 29) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeAccountBasedMarketing(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AccountBasedMarketing | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of ABM strategy and target account performance",
  "totalTargetAccounts": 0,
  "accounts": [{
    "account": "Account name",
    "tier": "Tier 1/2/3",
    "engagementScore": 0,
    "intent": "High/Medium/Low buying intent",
    "champion": "Internal champion status",
    "nextAction": "Recommended next action"
  }],
  "avgEngagementScore": 0,
  "pipelineInfluenced": "$X.XM pipeline influenced by ABM",
  "conversionRate": "XX% ABM conversion rate",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an account-based marketing strategist specializing in target account identification, engagement scoring, and ABM campaign optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Account-Based Marketing analysis:

1. SUMMARY: 2-3 sentence overview of ABM strategy effectiveness.
2. TOTAL TARGET ACCOUNTS: Number of accounts in ABM program.
3. ACCOUNTS (4-6): For each target account — tier, engagement score (0-100), buying intent, champion status, next action.
4. AVG ENGAGEMENT SCORE: Average engagement score across all target accounts.
5. PIPELINE INFLUENCED: Total pipeline value influenced by ABM efforts.
6. CONVERSION RATE: ABM-specific conversion rate.
7. RECOMMENDATIONS (4-6): Actionable steps to improve ABM effectiveness.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Account-Based Marketing (Wave 29)...");
    const result = await callJson(genai, prompt);
    return result as unknown as AccountBasedMarketing;
  } catch (e) {
    console.warn("[Pivot] Account-Based Marketing (Wave 29) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCommissionOptimization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CommissionOptimization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of commission structure and optimization opportunities",
  "plans": [{
    "role": "Sales role name",
    "baseSplit": "XX% base salary",
    "variableSplit": "XX% variable compensation",
    "quota": "$X.XM quota",
    "onTargetEarnings": "$XXXk OTE",
    "accelerators": "Description of accelerator structure"
  }],
  "totalCommissionSpend": "$X.XM total commission spend",
  "revPerCommissionDollar": "$X.XX revenue per commission dollar",
  "alignmentScore": 0,
  "topPerformerRetention": "XX% top performer retention rate",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a sales compensation analyst specializing in incentive plan design, commission optimization, and sales performance alignment.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Commission Optimization analysis:

1. SUMMARY: 2-3 sentence overview of commission structure effectiveness.
2. PLANS (3-5): For each sales role — base/variable split, quota, OTE, accelerator structure.
3. TOTAL COMMISSION SPEND: Total annual commission spend.
4. REVENUE PER COMMISSION DOLLAR: Revenue generated per dollar of commission spent.
5. ALIGNMENT SCORE (0-100): How well commissions align with business objectives.
6. TOP PERFORMER RETENTION: Retention rate of top-performing salespeople.
7. RECOMMENDATIONS (4-6): Actionable steps to optimize commission structure.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Commission Optimization (Wave 29)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CommissionOptimization;
  } catch (e) {
    console.warn("[Pivot] Commission Optimization (Wave 29) synthesis failed:", e);
    return null;
  }
}

// ── Wave 30: Product & Market Intelligence ───────────────────────────────────

export async function synthesizeProductAnalytics(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ProductAnalytics | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of product usage patterns and engagement",
  "metrics": [{
    "feature": "Feature name",
    "dailyActive": "XX% DAU",
    "weeklyActive": "XX% WAU",
    "adoptionRate": "XX% adoption",
    "satisfaction": "X.X/5 satisfaction",
    "trend": "Growing/Declining/Stable"
  }],
  "topFeature": "Most used or valuable feature",
  "underusedFeatures": ["feature 1", "feature 2"],
  "stickinessRatio": "XX% DAU/MAU ratio",
  "powerUserPercentage": "XX% power users",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a product analytics expert specializing in usage metrics, feature adoption, and product-led growth strategies.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Product Analytics analysis:

1. SUMMARY: 2-3 sentence overview of product usage patterns.
2. METRICS (4-6): For each key feature — daily active, weekly active, adoption rate, satisfaction, trend.
3. TOP FEATURE: Most used or most valuable feature.
4. UNDERUSED FEATURES (2-4): Features with low adoption that have high potential.
5. STICKINESS RATIO: DAU/MAU ratio.
6. POWER USER PERCENTAGE: Percentage of users who are power users.
7. RECOMMENDATIONS (4-6): Actionable steps to improve product engagement.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Product Analytics (Wave 30)...");
    const result = await callJson(genai, prompt);
    return result as unknown as ProductAnalytics;
  } catch (e) {
    console.warn("[Pivot] Product Analytics (Wave 30) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCompetitiveResponse(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CompetitiveResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of competitive landscape and response readiness",
  "moves": [{
    "competitor": "Competitor name",
    "move": "Recent competitive move",
    "impact": "High/Medium/Low impact",
    "urgency": "Immediate/Near-term/Long-term",
    "response": "Recommended response strategy",
    "timeline": "Response timeline"
  }],
  "threatLevel": "Overall competitive threat level",
  "defensiveActions": ["action 1", "..."],
  "offensiveOpportunities": ["opportunity 1", "..."],
  "blindSpots": ["blind spot 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a competitive intelligence analyst specializing in competitor monitoring, threat assessment, and strategic response planning.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Competitive Response analysis:

1. SUMMARY: 2-3 sentence overview of competitive landscape.
2. MOVES (4-6): For each competitor move — competitor, move description, impact, urgency, response, timeline.
3. THREAT LEVEL: Overall competitive threat assessment.
4. DEFENSIVE ACTIONS (3-5): Immediate defensive actions needed.
5. OFFENSIVE OPPORTUNITIES (3-5): Opportunities to gain competitive advantage.
6. BLIND SPOTS (2-4): Areas where competitive intelligence is lacking.
7. RECOMMENDATIONS (4-6): Actionable steps for competitive response.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Competitive Response (Wave 30)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CompetitiveResponse;
  } catch (e) {
    console.warn("[Pivot] Competitive Response (Wave 30) synthesis failed:", e);
    return null;
  }
}

// ── Wave 33: Strategic Growth ─────────────────────────────────────────────────

export async function synthesizeMarketEntryPlaybook(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MarketEntryPlaybook | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of market entry opportunities and strategy",
  "entries": [{
    "market": "Target market name",
    "strategy": "Entry strategy (direct, partnership, acquisition, etc.)",
    "investmentRequired": "$X.XM estimated investment",
    "timeToBreakeven": "Estimated time to breakeven",
    "riskLevel": "High / Medium / Low",
    "competitors": "Key competitors in this market",
    "keyBarrier": "Primary barrier to entry"
  }],
  "topOpportunity": "Single best market entry opportunity",
  "totalInvestmentNeeded": "$X.XM total across all entries",
  "sequencingStrategy": "Recommended order and timing of market entries",
  "riskMitigation": ["mitigation strategy 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a market expansion strategist specializing in new market entry planning, go-to-market sequencing, and international growth.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Market Entry Playbook:

1. SUMMARY: 2-3 sentence overview of market entry opportunities and readiness.
2. ENTRIES (4-6): For each target market — market name, entry strategy, investment required, time to breakeven, risk level, key competitors, primary barrier.
3. TOP OPPORTUNITY: The single best market to enter first and why.
4. TOTAL INVESTMENT NEEDED: Total investment across all recommended entries.
5. SEQUENCING STRATEGY: Recommended order and timing of market entries.
6. RISK MITIGATION (3-5): Strategies to mitigate market entry risks.
7. RECOMMENDATIONS (4-6): Actionable steps to execute market entry plans.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Market Entry Playbook (Wave 33)...");
    const result = await callJson(genai, prompt);
    return result as unknown as MarketEntryPlaybook;
  } catch (e) {
    console.warn("[Pivot] Market Entry Playbook (Wave 33) synthesis failed:", e);
    return null;
  }
}

export async function synthesizePartnerChannelStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<PartnerChannelStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of partner and channel strategy effectiveness",
  "partners": [{
    "partner": "Partner name or type",
    "channel": "Channel type (reseller, referral, OEM, integration, etc.)",
    "revenueContribution": "$X.XM or XX% of revenue",
    "margin": "XX% margin on partner channel",
    "performance": "Performance rating or assessment",
    "growthPotential": "Growth potential assessment"
  }],
  "channelMix": "Overview of current channel mix and balance",
  "topChannel": "Best performing channel and why",
  "underperformingChannels": ["channel 1", "..."],
  "newChannelOpportunities": ["opportunity 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a channel strategy consultant specializing in partner ecosystem development, channel optimization, and indirect revenue growth.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Partner Channel Strategy:

1. SUMMARY: 2-3 sentence overview of partner and channel strategy effectiveness.
2. PARTNERS (4-6): For each partner or channel — partner name/type, channel type, revenue contribution, margin, performance, growth potential.
3. CHANNEL MIX: Overview of current channel mix and balance across direct vs. indirect.
4. TOP CHANNEL: Best performing channel and why it succeeds.
5. UNDERPERFORMING CHANNELS (2-4): Channels that are underperforming and why.
6. NEW CHANNEL OPPORTUNITIES (3-5): New channel opportunities to explore.
7. RECOMMENDATIONS (4-6): Actionable steps to optimize channel strategy.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Partner Channel Strategy (Wave 33)...");
    const result = await callJson(genai, prompt);
    return result as unknown as PartnerChannelStrategy;
  } catch (e) {
    console.warn("[Pivot] Partner Channel Strategy (Wave 33) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeAcquisitionIntegration(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AcquisitionIntegration | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of acquisition integration readiness and execution",
  "workstreams": [{
    "workstream": "Integration workstream name",
    "status": "Not Started / In Progress / Complete / At Risk",
    "completion": "XX% completion",
    "blockers": "Key blockers or challenges",
    "owner": "Responsible team or role",
    "deadline": "Target completion date"
  }],
  "synergyRealized": "$X.XM or XX% of target synergies realized",
  "culturalAlignment": "Assessment of cultural alignment between entities",
  "retentionRate": "XX% key talent retention rate post-acquisition",
  "topRisk": "Single biggest integration risk",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an M&A integration specialist analyzing post-acquisition integration planning, synergy capture, and cultural alignment.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Acquisition Integration analysis:

1. SUMMARY: 2-3 sentence overview of acquisition integration readiness and execution status.
2. WORKSTREAMS (4-6): For each integration workstream — name, status, completion percentage, blockers, owner, deadline.
3. SYNERGY REALIZED: Amount or percentage of target synergies realized so far.
4. CULTURAL ALIGNMENT: Assessment of cultural alignment between acquiring and acquired entities.
5. RETENTION RATE: Key talent retention rate post-acquisition.
6. TOP RISK: The single biggest integration risk and its potential impact.
7. RECOMMENDATIONS (4-6): Actionable steps to improve integration outcomes.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Acquisition Integration (Wave 33)...");
    const result = await callJson(genai, prompt);
    return result as unknown as AcquisitionIntegration;
  } catch (e) {
    console.warn("[Pivot] Acquisition Integration (Wave 33) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeInternationalReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<InternationalReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of international expansion readiness",
  "overallScore": 0,
  "areas": [{
    "area": "Readiness area (legal, financial, product, operations, talent, etc.)",
    "score": 0,
    "requirement": "What is required for international expansion in this area",
    "currentState": "Current state assessment",
    "gap": "Gap between current state and requirement",
    "action": "Specific action to close the gap"
  }],
  "topMarkets": ["market 1", "market 2"],
  "regulatoryBarriers": ["barrier 1", "..."],
  "localizationNeeds": ["need 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an international business strategist assessing readiness for global expansion across legal, financial, product, operational, and talent dimensions.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive International Readiness assessment:

1. SUMMARY: 2-3 sentence overview of international expansion readiness.
2. OVERALL SCORE (0-100): Composite international readiness score.
3. AREAS (5-7): For each readiness area — area name, score (0-100), requirement, current state, gap, action needed.
4. TOP MARKETS (3-5): Most promising international markets to enter.
5. REGULATORY BARRIERS (3-5): Key regulatory barriers to international expansion.
6. LOCALIZATION NEEDS (3-5): Product, content, and operational localization requirements.
7. RECOMMENDATIONS (4-6): Actionable steps to improve international readiness.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating International Readiness (Wave 33)...");
    const result = await callJson(genai, prompt);
    return result as unknown as InternationalReadiness;
  } catch (e) {
    console.warn("[Pivot] International Readiness (Wave 33) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeRevenueModelAnalysis(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<RevenueModelAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of revenue model health and diversification",
  "streams": [{
    "stream": "Revenue stream name",
    "revenue": "$X.XM or XX% of total",
    "margin": "XX% gross margin",
    "growth": "XX% growth rate",
    "scalability": "High / Medium / Low scalability",
    "moatStrength": "Strong / Moderate / Weak competitive moat"
  }],
  "primaryModel": "Primary revenue model (subscription, transactional, etc.)",
  "recurringPercentage": "XX% recurring revenue",
  "diversificationScore": 0,
  "modelFit": "How well the revenue model fits the market and customer base",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a revenue strategy analyst specializing in business model evaluation, revenue stream diversification, and monetization optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Revenue Model Analysis:

1. SUMMARY: 2-3 sentence overview of revenue model health and diversification.
2. STREAMS (4-6): For each revenue stream — stream name, revenue amount/percentage, gross margin, growth rate, scalability, moat strength.
3. PRIMARY MODEL: Primary revenue model identification and assessment.
4. RECURRING PERCENTAGE: Percentage of revenue that is recurring.
5. DIVERSIFICATION SCORE (0-100): How well-diversified the revenue base is.
6. MODEL FIT: How well the revenue model fits the target market and customer base.
7. RECOMMENDATIONS (4-6): Actionable steps to optimize the revenue model.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Revenue Model Analysis (Wave 33)...");
    const result = await callJson(genai, prompt);
    return result as unknown as RevenueModelAnalysis;
  } catch (e) {
    console.warn("[Pivot] Revenue Model Analysis (Wave 33) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeGrowthExperiments(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<GrowthExperiments | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of growth experimentation culture and results",
  "experiments": [{
    "name": "Experiment name",
    "hypothesis": "What the experiment tests",
    "metric": "Primary metric being measured",
    "status": "Proposed / Running / Complete / Failed",
    "result": "Result or expected result",
    "nextStep": "Next action based on result"
  }],
  "activeExperiments": 0,
  "winRate": "XX% of experiments producing positive results",
  "topLearning": "Most impactful learning from experimentation",
  "velocityScore": 0,
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a growth hacking strategist specializing in rapid experimentation, hypothesis-driven growth, and data-driven iteration.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Growth Experiments analysis:

1. SUMMARY: 2-3 sentence overview of growth experimentation culture and velocity.
2. EXPERIMENTS (5-7): For each experiment — name, hypothesis, primary metric, status, result, next step.
3. ACTIVE EXPERIMENTS: Number of currently active experiments.
4. WIN RATE: Percentage of experiments producing positive results.
5. TOP LEARNING: The most impactful learning from experimentation so far.
6. VELOCITY SCORE (0-100): How fast the organization runs and learns from experiments.
7. RECOMMENDATIONS (4-6): Actionable steps to improve experimentation velocity and quality.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Growth Experiments (Wave 33)...");
    const result = await callJson(genai, prompt);
    return result as unknown as GrowthExperiments;
  } catch (e) {
    console.warn("[Pivot] Growth Experiments (Wave 33) synthesis failed:", e);
    return null;
  }
}

// ── Wave 34: Customer Intelligence ────────────────────────────────────────────

export async function synthesizeCustomerAcquisitionCost(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerAcquisitionCost | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer acquisition cost efficiency",
  "blendedCac": "$XXX blended CAC across all channels",
  "channels": [{
    "channel": "Acquisition channel name",
    "spend": "$X.XM spend",
    "customers": 0,
    "cac": "$XXX CAC for this channel",
    "paybackPeriod": "XX months payback period",
    "trend": "Improving / Stable / Worsening"
  }],
  "cacToLtvRatio": "1:X CAC to LTV ratio",
  "topChannel": "Most efficient acquisition channel",
  "improvementPotential": "Estimated CAC reduction potential",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer acquisition analyst specializing in CAC optimization, channel efficiency, and payback period analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Acquisition Cost analysis:

1. SUMMARY: 2-3 sentence overview of CAC efficiency and trends.
2. BLENDED CAC: Blended customer acquisition cost across all channels.
3. CHANNELS (4-6): For each acquisition channel — channel name, spend, customers acquired, CAC, payback period, trend.
4. CAC TO LTV RATIO: Overall CAC to LTV ratio assessment.
5. TOP CHANNEL: Most efficient acquisition channel and why.
6. IMPROVEMENT POTENTIAL: Estimated CAC reduction potential with specific actions.
7. RECOMMENDATIONS (4-6): Actionable steps to reduce CAC and improve acquisition efficiency.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Acquisition Cost (Wave 34)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerAcquisitionCost;
  } catch (e) {
    console.warn("[Pivot] Customer Acquisition Cost (Wave 34) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeLifetimeValueOptimization(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<LifetimeValueOptimization | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer lifetime value and optimization opportunities",
  "overallLtv": "$X,XXX overall average LTV",
  "segments": [{
    "segment": "Customer segment name",
    "avgLtv": "$X,XXX average LTV",
    "retentionRate": "XX% retention rate",
    "expansionRevenue": "$XXX average expansion revenue",
    "costToServe": "$XXX cost to serve",
    "netLtv": "$X,XXX net LTV after costs"
  }],
  "topDriver": "Primary driver of LTV growth",
  "expansionOpportunity": "Biggest expansion revenue opportunity",
  "costReduction": "Biggest cost-to-serve reduction opportunity",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer lifetime value analyst specializing in LTV optimization, expansion revenue, and customer economics.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Lifetime Value Optimization analysis:

1. SUMMARY: 2-3 sentence overview of LTV health and optimization opportunities.
2. OVERALL LTV: Average customer lifetime value across all segments.
3. SEGMENTS (4-6): For each customer segment — segment name, average LTV, retention rate, expansion revenue, cost to serve, net LTV.
4. TOP DRIVER: Primary driver of LTV growth.
5. EXPANSION OPPORTUNITY: Biggest opportunity to increase expansion revenue.
6. COST REDUCTION: Biggest opportunity to reduce cost-to-serve.
7. RECOMMENDATIONS (4-6): Actionable steps to increase LTV across segments.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Lifetime Value Optimization (Wave 34)...");
    const result = await callJson(genai, prompt);
    return result as unknown as LifetimeValueOptimization;
  } catch (e) {
    console.warn("[Pivot] Lifetime Value Optimization (Wave 34) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeChurnPrediction(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ChurnPrediction | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of churn risk and prediction capabilities",
  "predictedChurnRate": "XX% predicted churn rate for next period",
  "signals": [{
    "signal": "Churn signal name",
    "strength": "Strong / Moderate / Weak signal strength",
    "leadTime": "XX days/weeks lead time before churn",
    "affectedSegment": "Customer segment most affected",
    "preventionAction": "Specific prevention action",
    "confidence": "High / Medium / Low confidence"
  }],
  "highRiskAccounts": 0,
  "revenueAtRisk": "$X.XM revenue at risk from predicted churn",
  "interventionROI": "Expected ROI from churn interventions",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer retention analyst specializing in churn prediction, early warning systems, and proactive intervention strategies.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Churn Prediction analysis:

1. SUMMARY: 2-3 sentence overview of churn risk and prediction capabilities.
2. PREDICTED CHURN RATE: Predicted churn rate for the next period.
3. SIGNALS (5-7): For each churn signal — signal name, strength, lead time, affected segment, prevention action, confidence level.
4. HIGH RISK ACCOUNTS: Number of accounts currently at high churn risk.
5. REVENUE AT RISK: Total revenue at risk from predicted churn.
6. INTERVENTION ROI: Expected ROI from churn intervention programs.
7. RECOMMENDATIONS (4-6): Actionable steps to reduce churn and improve prediction accuracy.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Churn Prediction (Wave 34)...");
    const result = await callJson(genai, prompt);
    return result as unknown as ChurnPrediction;
  } catch (e) {
    console.warn("[Pivot] Churn Prediction (Wave 34) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeNetRevenueRetention(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<NetRevenueRetention | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of net revenue retention health and trends",
  "overallNrr": "XXX% overall net revenue retention",
  "cohorts": [{
    "cohort": "Cohort name or period",
    "startingMrr": "$X.XM starting MRR",
    "expansion": "$XXXk expansion revenue",
    "contraction": "$XXXk contraction",
    "churn": "$XXXk churned revenue",
    "netRetention": "XXX% net retention for this cohort"
  }],
  "expansionRate": "XX% expansion rate",
  "contractionRate": "XX% contraction rate",
  "topExpansionDriver": "Primary driver of expansion revenue",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a revenue retention analyst specializing in net revenue retention, expansion revenue, and cohort-based retention analysis.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Net Revenue Retention analysis:

1. SUMMARY: 2-3 sentence overview of NRR health and trends.
2. OVERALL NRR: Overall net revenue retention percentage.
3. COHORTS (4-6): For each cohort — cohort name, starting MRR, expansion revenue, contraction, churn, net retention.
4. EXPANSION RATE: Overall expansion revenue rate.
5. CONTRACTION RATE: Overall contraction rate and primary causes.
6. TOP EXPANSION DRIVER: Primary driver of expansion revenue and how to amplify it.
7. RECOMMENDATIONS (4-6): Actionable steps to improve NRR.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Net Revenue Retention (Wave 34)...");
    const result = await callJson(genai, prompt);
    return result as unknown as NetRevenueRetention;
  } catch (e) {
    console.warn("[Pivot] Net Revenue Retention (Wave 34) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCustomerAdvocacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CustomerAdvocacy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer advocacy and referral program health",
  "programs": [{
    "program": "Advocacy program name",
    "participants": 0,
    "referrals": "Number or rate of referrals generated",
    "revenue": "$XXXk revenue from this program",
    "satisfaction": "X.X/5 participant satisfaction",
    "nps": "XX NPS of program participants"
  }],
  "totalAdvocates": 0,
  "referralRevenue": "$X.XM total referral-driven revenue",
  "advocateNps": "XX average NPS among advocates",
  "topProgram": "Best performing advocacy program",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a customer advocacy strategist specializing in referral programs, brand ambassadors, and customer-driven growth.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Customer Advocacy analysis:

1. SUMMARY: 2-3 sentence overview of customer advocacy health and referral program effectiveness.
2. PROGRAMS (3-5): For each advocacy program — program name, participants, referrals generated, revenue, satisfaction, NPS.
3. TOTAL ADVOCATES: Total number of active customer advocates.
4. REFERRAL REVENUE: Total revenue driven by customer referrals and advocacy.
5. ADVOCATE NPS: Average NPS among active advocates.
6. TOP PROGRAM: Best performing advocacy program and why.
7. RECOMMENDATIONS (4-6): Actionable steps to grow customer advocacy and referral revenue.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Customer Advocacy (Wave 34)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CustomerAdvocacy;
  } catch (e) {
    console.warn("[Pivot] Customer Advocacy (Wave 34) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeFeedbackLoop(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<FeedbackLoop | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of customer feedback collection and action effectiveness",
  "channels": [{
    "channel": "Feedback channel name",
    "volume": 0,
    "responseRate": "XX% response rate",
    "avgResolutionTime": "XX hours/days average resolution",
    "satisfaction": "X.X/5 satisfaction with resolution",
    "topTheme": "Most common feedback theme"
  }],
  "totalFeedback": 0,
  "actionRate": "XX% of feedback items acted upon",
  "closedLoopPercentage": "XX% of feedback with closed-loop follow-up",
  "topInsight": "Most impactful insight from customer feedback",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a Voice of Customer analyst specializing in feedback loop optimization, closed-loop processes, and customer insight generation.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Feedback Loop analysis:

1. SUMMARY: 2-3 sentence overview of feedback collection and action effectiveness.
2. CHANNELS (4-6): For each feedback channel — channel name, volume, response rate, avg resolution time, satisfaction, top theme.
3. TOTAL FEEDBACK: Total feedback items collected across all channels.
4. ACTION RATE: Percentage of feedback items that were acted upon.
5. CLOSED LOOP PERCENTAGE: Percentage of feedback with closed-loop follow-up to the customer.
6. TOP INSIGHT: Most impactful insight derived from customer feedback.
7. RECOMMENDATIONS (4-6): Actionable steps to improve feedback collection and close the loop faster.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Feedback Loop (Wave 34)...");
    const result = await callJson(genai, prompt);
    return result as unknown as FeedbackLoop;
  } catch (e) {
    console.warn("[Pivot] Feedback Loop (Wave 34) synthesis failed:", e);
    return null;
  }
}

// ── Wave 35: Operational Excellence ───────────────────────────────────────────

export async function synthesizeProcessAutomation(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ProcessAutomation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of process automation opportunities and maturity",
  "opportunities": [{
    "process": "Process name",
    "currentTime": "Current time/effort to complete",
    "automatedTime": "Time/effort after automation",
    "savingsPerYear": "$XXXk annual savings",
    "complexity": "High / Medium / Low implementation complexity",
    "priority": "P1 / P2 / P3 priority"
  }],
  "totalSavings": "$X.XM total annual savings potential",
  "quickWins": ["quick win 1", "..."],
  "roiTimeline": "Expected timeline to positive ROI",
  "techRequirements": ["requirement 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a process automation consultant specializing in workflow optimization, RPA, and operational efficiency improvement.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Process Automation analysis:

1. SUMMARY: 2-3 sentence overview of automation maturity and opportunities.
2. OPPORTUNITIES (5-7): For each automation opportunity — process name, current time/effort, automated time/effort, annual savings, complexity, priority.
3. TOTAL SAVINGS: Total annual savings potential from all automation opportunities.
4. QUICK WINS (3-5): Automation opportunities that can be implemented quickly with high impact.
5. ROI TIMELINE: Expected timeline to achieve positive ROI from automation investments.
6. TECH REQUIREMENTS (3-5): Technology and infrastructure requirements for automation.
7. RECOMMENDATIONS (4-6): Actionable steps to accelerate automation adoption.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Process Automation (Wave 35)...");
    const result = await callJson(genai, prompt);
    return result as unknown as ProcessAutomation;
  } catch (e) {
    console.warn("[Pivot] Process Automation (Wave 35) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeCostBenchmark(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<CostBenchmark | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of cost competitiveness versus industry benchmarks",
  "areas": [{
    "area": "Cost area name",
    "currentCost": "$X.XM or XX% of revenue",
    "benchmark": "$X.XM or XX% industry benchmark",
    "gap": "$XXXk or XX% gap",
    "savingsPotential": "$XXXk potential savings",
    "difficulty": "Easy / Medium / Hard to optimize"
  }],
  "totalOverspend": "$X.XM total overspend vs benchmarks",
  "topSavingsArea": "Area with the largest savings potential",
  "industryPosition": "Overall cost positioning vs industry (e.g., above median, top quartile)",
  "quickSavings": ["quick saving 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a cost benchmarking analyst specializing in industry cost comparisons, spend optimization, and operational cost reduction.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Cost Benchmark analysis:

1. SUMMARY: 2-3 sentence overview of cost competitiveness and benchmark positioning.
2. AREAS (5-7): For each cost area — area name, current cost, industry benchmark, gap, savings potential, optimization difficulty.
3. TOTAL OVERSPEND: Total overspend compared to industry benchmarks.
4. TOP SAVINGS AREA: The single area with the largest savings potential.
5. INDUSTRY POSITION: Overall cost positioning relative to industry peers.
6. QUICK SAVINGS (3-5): Cost reductions that can be achieved quickly.
7. RECOMMENDATIONS (4-6): Actionable steps to bring costs in line with or below benchmarks.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Cost Benchmark (Wave 35)...");
    const result = await callJson(genai, prompt);
    return result as unknown as CostBenchmark;
  } catch (e) {
    console.warn("[Pivot] Cost Benchmark (Wave 35) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeVendorNegotiation(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<VendorNegotiation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of vendor negotiation opportunities and leverage",
  "items": [{
    "vendor": "Vendor name or category",
    "currentTerms": "Current contract terms and pricing",
    "targetTerms": "Target terms after negotiation",
    "leverage": "Negotiation leverage available",
    "savingsPotential": "$XXXk potential savings",
    "strategy": "Recommended negotiation strategy"
  }],
  "totalSavings": "$X.XM total savings from vendor negotiations",
  "topPriority": "Highest priority vendor negotiation",
  "timelineToSavings": "Expected timeline to realize savings",
  "riskFactors": ["risk 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a procurement and vendor management strategist specializing in contract negotiation, vendor consolidation, and cost optimization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Vendor Negotiation analysis:

1. SUMMARY: 2-3 sentence overview of vendor negotiation opportunities.
2. ITEMS (4-6): For each negotiation opportunity — vendor name, current terms, target terms, leverage, savings potential, strategy.
3. TOTAL SAVINGS: Total potential savings from all vendor negotiations.
4. TOP PRIORITY: The highest-priority vendor negotiation and why.
5. TIMELINE TO SAVINGS: Expected timeline to realize negotiated savings.
6. RISK FACTORS (3-5): Risks associated with vendor renegotiation (e.g., service disruption, relationship damage).
7. RECOMMENDATIONS (4-6): Actionable steps to execute vendor negotiations effectively.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Vendor Negotiation (Wave 35)...");
    const result = await callJson(genai, prompt);
    return result as unknown as VendorNegotiation;
  } catch (e) {
    console.warn("[Pivot] Vendor Negotiation (Wave 35) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeScalabilityAssessment(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<ScalabilityAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of scalability readiness and bottlenecks",
  "overallScore": 0,
  "dimensions": [{
    "dimension": "Scalability dimension (infrastructure, team, process, product, financial)",
    "currentCapacity": "Current capacity assessment",
    "projectedNeed": "Projected need at 2-3x scale",
    "headroom": "XX% headroom before bottleneck",
    "bottleneck": "Primary bottleneck in this dimension",
    "investmentNeeded": "$XXXk investment to scale"
  }],
  "criticalBottleneck": "The single most critical scalability bottleneck",
  "scalingTimeline": "Timeline to reach next scale milestone",
  "totalInvestment": "$X.XM total investment needed for scaling",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a scalability architect analyzing infrastructure, team, process, product, and financial readiness to scale operations 2-5x.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Scalability Assessment:

1. SUMMARY: 2-3 sentence overview of scalability readiness and key constraints.
2. OVERALL SCORE (0-100): Composite scalability readiness score.
3. DIMENSIONS (5-7): For each scalability dimension — dimension name, current capacity, projected need at 2-3x, headroom, bottleneck, investment needed.
4. CRITICAL BOTTLENECK: The single most critical bottleneck that would prevent scaling.
5. SCALING TIMELINE: Realistic timeline to reach the next major scale milestone.
6. TOTAL INVESTMENT: Total investment required across all dimensions to scale.
7. RECOMMENDATIONS (4-6): Actionable steps to remove scaling bottlenecks.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Scalability Assessment (Wave 35)...");
    const result = await callJson(genai, prompt);
    return result as unknown as ScalabilityAssessment;
  } catch (e) {
    console.warn("[Pivot] Scalability Assessment (Wave 35) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeIncidentReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<IncidentReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of incident response readiness and resilience",
  "overallReadiness": 0,
  "scenarios": [{
    "scenario": "Incident scenario name",
    "likelihood": "High / Medium / Low likelihood",
    "impact": "Critical / High / Medium / Low impact",
    "currentReadiness": "Current readiness level for this scenario",
    "gap": "Key gap in preparedness",
    "requiredAction": "Action needed to close the gap"
  }],
  "responseTime": "Current average or estimated incident response time",
  "recoveryCapability": "Recovery capability assessment (RTO/RPO)",
  "lastDrillDate": "Last incident drill or test date",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a business continuity and incident response specialist assessing organizational preparedness for critical incidents, outages, and crises.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Incident Readiness assessment:

1. SUMMARY: 2-3 sentence overview of incident response readiness.
2. OVERALL READINESS (0-100): Composite incident readiness score.
3. SCENARIOS (5-7): For each incident scenario — scenario name, likelihood, impact, current readiness, gap, required action.
4. RESPONSE TIME: Average or estimated incident response time.
5. RECOVERY CAPABILITY: Recovery time objective (RTO) and recovery point objective (RPO) assessment.
6. LAST DRILL DATE: When was the last incident response drill or tabletop exercise conducted.
7. RECOMMENDATIONS (4-6): Actionable steps to improve incident readiness and response.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Incident Readiness (Wave 35)...");
    const result = await callJson(genai, prompt);
    return result as unknown as IncidentReadiness;
  } catch (e) {
    console.warn("[Pivot] Incident Readiness (Wave 35) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeOperationalRisk(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<OperationalRisk | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of operational risk exposure and mitigation posture",
  "overallRisk": "High / Medium / Low overall operational risk",
  "areas": [{
    "area": "Operational risk area",
    "riskLevel": "Critical / High / Medium / Low",
    "likelihood": "High / Medium / Low likelihood of occurrence",
    "impact": "Description of potential business impact",
    "currentMitigation": "Current mitigation measures in place",
    "residualRisk": "Residual risk after current mitigations"
  }],
  "topRisk": "The single highest operational risk and its potential impact",
  "mitigationBudget": "Recommended budget for risk mitigation activities",
  "insuranceCoverage": "Assessment of insurance coverage adequacy",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an operational risk management specialist assessing enterprise operational risks, mitigation effectiveness, and residual risk exposure.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Operational Risk analysis:

1. SUMMARY: 2-3 sentence overview of operational risk exposure.
2. OVERALL RISK: Overall operational risk level assessment.
3. AREAS (5-7): For each risk area — area name, risk level, likelihood, impact, current mitigation, residual risk.
4. TOP RISK: The single highest operational risk and its potential business impact.
5. MITIGATION BUDGET: Recommended budget allocation for risk mitigation.
6. INSURANCE COVERAGE: Assessment of whether current insurance coverage is adequate for identified risks.
7. RECOMMENDATIONS (4-6): Actionable steps to reduce operational risk exposure.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Operational Risk (Wave 35)...");
    const result = await callJson(genai, prompt);
    return result as unknown as OperationalRisk;
  } catch (e) {
    console.warn("[Pivot] Operational Risk (Wave 35) synthesis failed:", e);
    return null;
  }
}

// ── Wave 36: Data & AI Strategy ───────────────────────────────────────────────

export async function synthesizeDataStrategy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DataStrategy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of data strategy maturity and priorities",
  "domains": [{
    "domain": "Data domain name",
    "maturity": "Advanced / Intermediate / Basic / Ad Hoc",
    "quality": "High / Medium / Low data quality",
    "accessibility": "High / Medium / Low accessibility",
    "owner": "Data domain owner or responsible team",
    "priority": "P1 / P2 / P3 priority for improvement"
  }],
  "overallMaturity": 0,
  "dataDebtLevel": "Assessment of data debt (High / Medium / Low)",
  "governanceScore": "Data governance maturity assessment",
  "topPriority": "Single highest-priority data initiative",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a chief data strategist assessing enterprise data maturity, governance, quality, and strategic data asset management.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Data Strategy analysis:

1. SUMMARY: 2-3 sentence overview of data strategy maturity and priorities.
2. DOMAINS (5-7): For each data domain — domain name, maturity level, data quality, accessibility, owner, improvement priority.
3. OVERALL MATURITY (0-100): Composite data maturity score.
4. DATA DEBT LEVEL: Assessment of accumulated data debt and its business impact.
5. GOVERNANCE SCORE: Data governance maturity assessment.
6. TOP PRIORITY: The single highest-priority data initiative to drive business value.
7. RECOMMENDATIONS (4-6): Actionable steps to advance data strategy.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Data Strategy (Wave 36)...");
    const result = await callJson(genai, prompt);
    return result as unknown as DataStrategy;
  } catch (e) {
    console.warn("[Pivot] Data Strategy (Wave 36) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeAiUseCases(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AiUseCases | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of AI opportunity landscape and readiness",
  "useCases": [{
    "useCase": "AI use case name",
    "businessImpact": "High / Medium / Low business impact",
    "feasibility": "High / Medium / Low feasibility with current resources",
    "dataReadiness": "High / Medium / Low data readiness",
    "estimatedROI": "$XXXk or XX% estimated ROI",
    "timeline": "XX months to deploy"
  }],
  "topOpportunity": "Single highest-impact AI use case",
  "totalEstimatedROI": "$X.XM total estimated ROI from AI initiatives",
  "readinessScore": 0,
  "barriers": ["barrier 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an AI strategy consultant identifying high-impact AI use cases, assessing feasibility, and building an AI adoption roadmap.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive AI Use Cases analysis:

1. SUMMARY: 2-3 sentence overview of AI opportunity landscape and organizational readiness.
2. USE CASES (5-7): For each AI use case — use case name, business impact, feasibility, data readiness, estimated ROI, deployment timeline.
3. TOP OPPORTUNITY: The single highest-impact AI use case to pursue first.
4. TOTAL ESTIMATED ROI: Total estimated ROI from all identified AI initiatives.
5. READINESS SCORE (0-100): Overall AI readiness score.
6. BARRIERS (3-5): Key barriers to AI adoption (data, talent, culture, infrastructure, etc.).
7. RECOMMENDATIONS (4-6): Actionable steps to accelerate AI adoption.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating AI Use Cases (Wave 36)...");
    const result = await callJson(genai, prompt);
    return result as unknown as AiUseCases;
  } catch (e) {
    console.warn("[Pivot] AI Use Cases (Wave 36) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeAnalyticsRoadmap(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<AnalyticsRoadmap | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of analytics maturity and roadmap",
  "milestones": [{
    "milestone": "Analytics milestone name",
    "quarter": "Target quarter (e.g., Q2 2025)",
    "owner": "Responsible team or role",
    "dependencies": "Key dependencies",
    "status": "Not Started / In Progress / Complete",
    "impact": "Expected business impact"
  }],
  "currentMaturity": 0,
  "targetMaturity": 0,
  "investmentNeeded": "$X.XM total investment for analytics roadmap",
  "quickWins": ["quick win 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an analytics strategy consultant building a roadmap to advance analytics maturity from descriptive to predictive and prescriptive capabilities.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Analytics Roadmap:

1. SUMMARY: 2-3 sentence overview of current analytics maturity and target state.
2. MILESTONES (5-7): For each milestone — milestone name, target quarter, owner, dependencies, status, expected impact.
3. CURRENT MATURITY (0-100): Current analytics maturity score.
4. TARGET MATURITY (0-100): Target analytics maturity score within 12-18 months.
5. INVESTMENT NEEDED: Total investment required to execute the analytics roadmap.
6. QUICK WINS (3-5): Analytics improvements that can be delivered quickly with high impact.
7. RECOMMENDATIONS (4-6): Actionable steps to advance analytics maturity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Analytics Roadmap (Wave 36)...");
    const result = await callJson(genai, prompt);
    return result as unknown as AnalyticsRoadmap;
  } catch (e) {
    console.warn("[Pivot] Analytics Roadmap (Wave 36) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeDataPrivacy(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DataPrivacy | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of data privacy compliance and risk posture",
  "areas": [{
    "area": "Privacy area (data collection, storage, processing, sharing, retention, etc.)",
    "compliance": "Compliant / Partially Compliant / Non-Compliant",
    "regulation": "Applicable regulation (GDPR, CCPA, HIPAA, etc.)",
    "gap": "Key compliance gap",
    "risk": "Risk level (Critical / High / Medium / Low)",
    "action": "Remediation action needed"
  }],
  "overallCompliance": "Overall compliance posture assessment",
  "regulations": ["applicable regulation 1", "..."],
  "consentRate": "XX% consent capture rate",
  "breachReadiness": "Data breach response readiness assessment",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a data privacy and compliance specialist assessing regulatory compliance, privacy risk, and data protection practices across the organization.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Data Privacy analysis:

1. SUMMARY: 2-3 sentence overview of data privacy posture and compliance.
2. AREAS (5-7): For each privacy area — area name, compliance status, applicable regulation, gap, risk level, remediation action.
3. OVERALL COMPLIANCE: Overall data privacy compliance posture.
4. REGULATIONS (3-5): All applicable data privacy regulations based on geography and industry.
5. CONSENT RATE: Current consent capture rate and opt-in effectiveness.
6. BREACH READINESS: Assessment of data breach notification and response readiness.
7. RECOMMENDATIONS (4-6): Actionable steps to strengthen data privacy compliance.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Data Privacy (Wave 36)...");
    const result = await callJson(genai, prompt);
    return result as unknown as DataPrivacy;
  } catch (e) {
    console.warn("[Pivot] Data Privacy (Wave 36) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeMlOpsReadiness(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<MlOpsReadiness | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of MLOps maturity and production ML capabilities",
  "capabilities": [{
    "capability": "MLOps capability (model training, versioning, deployment, monitoring, feature store, etc.)",
    "maturity": "Advanced / Intermediate / Basic / Not Present",
    "tooling": "Current tooling in use",
    "gap": "Key gap or limitation",
    "investment": "$XXXk estimated investment to close gap",
    "priority": "P1 / P2 / P3 priority"
  }],
  "overallScore": 0,
  "modelsInProduction": 0,
  "deploymentFrequency": "Frequency of model deployments (daily, weekly, monthly, ad hoc)",
  "monitoringCoverage": "XX% of production models with active monitoring",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are an MLOps engineer and platform architect assessing machine learning operations maturity, production ML capabilities, and ML infrastructure readiness.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive MLOps Readiness assessment:

1. SUMMARY: 2-3 sentence overview of MLOps maturity and production ML capabilities.
2. CAPABILITIES (5-7): For each MLOps capability — capability name, maturity level, current tooling, gap, investment needed, priority.
3. OVERALL SCORE (0-100): Composite MLOps readiness score.
4. MODELS IN PRODUCTION: Number of ML models currently running in production.
5. DEPLOYMENT FREQUENCY: How frequently models are deployed or updated.
6. MONITORING COVERAGE: Percentage of production models with active performance monitoring.
7. RECOMMENDATIONS (4-6): Actionable steps to improve MLOps maturity.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating MLOps Readiness (Wave 36)...");
    const result = await callJson(genai, prompt);
    return result as unknown as MlOpsReadiness;
  } catch (e) {
    console.warn("[Pivot] MLOps Readiness (Wave 36) synthesis failed:", e);
    return null;
  }
}

export async function synthesizeDigitalTransformation(
  packet: BusinessPacket,
  questionnaire: Questionnaire
): Promise<DigitalTransformation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genai = new GoogleGenAI({ apiKey });
  const ctx = formatPacketAsContext(packet).slice(0, 40_000);

  const schema = `{
  "summary": "2-3 sentence overview of digital transformation progress and strategy",
  "pillars": [{
    "pillar": "Transformation pillar (customer experience, operations, workforce, business model, technology, data)",
    "currentState": "Current state assessment",
    "targetState": "Target state description",
    "progress": "XX% progress toward target",
    "investment": "$XXXk investment allocated or needed",
    "timeline": "Expected timeline to reach target"
  }],
  "overallProgress": 0,
  "totalInvestment": "$X.XM total digital transformation investment",
  "biggestGap": "The single largest gap between current and target digital state",
  "changeReadiness": "Organizational change readiness assessment",
  "recommendations": ["recommendation 1", "..."]
}`;

  const prompt = `You are a digital transformation strategist assessing enterprise-wide digital maturity, transformation progress, and technology modernization across all business functions.

BUSINESS DATA:
${ctx}

Business: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Model: ${questionnaire.businessModel}
Location: ${questionnaire.location ?? "Not specified"}

Produce a comprehensive Digital Transformation analysis:

1. SUMMARY: 2-3 sentence overview of digital transformation progress and strategic priorities.
2. PILLARS (5-7): For each transformation pillar — pillar name, current state, target state, progress percentage, investment, timeline.
3. OVERALL PROGRESS (0-100): Composite digital transformation progress score.
4. TOTAL INVESTMENT: Total investment in digital transformation initiatives.
5. BIGGEST GAP: The single largest gap between current and target digital state.
6. CHANGE READINESS: Assessment of organizational readiness for digital change.
7. RECOMMENDATIONS (4-6): Actionable steps to accelerate digital transformation.

Use ONLY data from the business report. If data is insufficient, say "Insufficient data" — do NOT invent numbers.

Return ONLY valid JSON:
${schema}`;

  try {
    console.log("[Pivot] Generating Digital Transformation (Wave 36)...");
    const result = await callJson(genai, prompt);
    return result as unknown as DigitalTransformation;
  } catch (e) {
    console.warn("[Pivot] Digital Transformation (Wave 36) synthesis failed:", e);
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
