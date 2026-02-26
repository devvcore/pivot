/**
 * Business Relevance Engine
 *
 * Determines which deliverable sections are relevant for a given business
 * based on its model, industry, size, and characteristics. This prevents
 * generating irrelevant sections (e.g., "Fleet Management" for a SaaS startup)
 * and saves API calls.
 */

import { Questionnaire } from "@/lib/types";
import { GoogleGenAI } from "@google/genai";

// ── Section Categories ───────────────────────────────────────────────────────

export type SectionCategory =
  | "core"           // Always relevant for every business
  | "b2b"            // B2B-specific (enterprise clients, accounts, territories)
  | "b2c"            // B2C-specific (consumer, retail, e-commerce)
  | "saas"           // SaaS/subscription-specific
  | "physical"       // Physical products/locations (inventory, fleet, facilities)
  | "services"       // Service businesses (consulting, agency, professional services)
  | "startup"        // Early-stage / startup-specific
  | "enterprise"     // Large company / enterprise-specific
  | "tech"           // Technology companies
  | "esg"            // ESG / sustainability (relevant for larger or mission-driven)
  | "marketing"      // Marketing-heavy businesses
  | "financial"      // Financial planning (all businesses, but depth varies)
  | "hr"             // HR / people ops (relevant when team size > 5)
  | "product"        // Product companies (SaaS, physical products, platforms)
  | "sales"          // Sales-driven businesses
  | "platform"       // Platform / marketplace businesses
  | "investor"       // Investor-facing (funded startups, raising capital)
  | "compliance"     // Regulated industries
  | "brand"          // Consumer-facing brands
  | "operations";    // Operations-heavy businesses

// Map each deliverable key to its categories
const SECTION_CATEGORIES: Record<string, SectionCategory[]> = {
  // ── Core (always shown) ──
  healthScore: ["core"],
  cashIntelligence: ["core"],
  revenueLeakAnalysis: ["core"],
  issuesRegister: ["core"],
  decisionBrief: ["core"],
  executiveSummary: ["core"],
  swotAnalysis: ["core"],
  goalTracker: ["core"],
  riskRegister: ["core"],

  // ── Customer-facing ──
  atRiskCustomers: ["b2b", "saas", "services"],
  customerSegmentation: ["b2b", "b2c", "saas"],
  customerJourneyMap: ["b2b", "b2c", "saas"],
  clvAnalysis: ["b2b", "saas", "b2c"],
  retentionPlaybook: ["b2b", "saas", "b2c"],
  churnPlaybook: ["saas", "b2b"],
  npsActionPlan: ["b2b", "b2c", "saas"],
  customerAdvisoryBoard: ["b2b", "saas", "enterprise"],
  customerHealthDashboard: ["b2b", "saas"],
  customerLifetimeValue: ["b2b", "saas", "b2c"],
  sentimentAnalysis: ["b2b", "b2c", "saas", "brand"],
  segmentProfitability: ["b2b", "b2c", "saas"],
  referralAnalytics: ["b2b", "b2c", "saas"],
  supportTicketAnalysis: ["b2b", "saas", "b2c"],
  customerSuccess: ["b2b", "saas"],
  accountManagement: ["b2b", "enterprise"],
  accountPenetration: ["b2b", "enterprise"],

  // ── Financial ──
  cashOptimization: ["core"],
  unitEconomics: ["saas", "b2c", "startup"],
  revenueForecast: ["core"],
  revenueAttribution: ["marketing", "b2c", "saas"],
  revenueDiversification: ["core"],
  revenueIntelligence: ["core"],
  budgetPlanning: ["financial", "enterprise"],
  revenueForecasting: ["financial"],
  cashManagement: ["financial", "enterprise"],
  creditManagement: ["financial", "enterprise"],
  debtStructure: ["financial", "enterprise"],
  financialReporting: ["financial", "enterprise"],
  treasuryManagement: ["financial", "enterprise"],
  expenseManagement: ["financial"],
  invoiceAutomation: ["b2b", "services", "financial"],
  paymentOptimization: ["b2b", "b2c", "financial"],
  financialControls: ["financial", "enterprise", "compliance"],
  procurementEfficiency: ["enterprise", "operations", "physical"],
  revenuePrediction: ["financial", "sales"],

  // ── Sales ──
  salesPlaybook: ["sales", "b2b"],
  salesMotionDesign: ["sales", "b2b"],
  dealAnalytics: ["sales", "b2b"],
  territoryOptimization: ["sales", "b2b", "enterprise"],
  salesCompensation: ["sales", "b2b", "enterprise"],
  salesEnablement: ["sales", "b2b"],
  salesForecasting: ["sales", "b2b"],
  pipelineManagement: ["sales", "b2b"],
  dealVelocity: ["sales", "b2b"],
  territoryPlanning: ["sales", "b2b"],

  // ── Marketing ──
  marketingStrategy: ["marketing", "b2c", "saas"],
  emailMarketing: ["marketing", "b2c", "saas", "b2b"],
  conversionOptimization: ["marketing", "b2c", "saas"],
  abTestingFramework: ["marketing", "saas", "b2c"],
  marketingAttribution: ["marketing", "b2c", "saas"],
  contentCalendar: ["marketing", "b2c", "saas"],
  socialMediaCalendar: ["marketing", "b2c", "brand"],
  demandGenEngine: ["marketing", "b2b", "saas"],
  contentMarketingRoi: ["marketing", "b2b", "saas"],
  seoStrategy: ["marketing", "b2c", "saas"],
  paidMediaOptimization: ["marketing", "b2c", "saas"],
  eventRoi: ["marketing", "b2b", "enterprise"],
  influencerStrategy: ["marketing", "b2c", "brand"],
  socialListening: ["marketing", "brand", "b2c"],

  // ── Product ──
  roadmap: ["product", "saas", "tech"],
  productMarketFit: ["product", "saas", "startup"],
  productVision: ["product", "saas", "tech"],
  featureRoadmap: ["product", "saas", "tech"],
  pmfAssessment: ["product", "saas", "startup"],
  userActivation: ["product", "saas", "b2c"],
  productInsights: ["product", "saas", "tech"],
  releaseStrategy: ["product", "saas", "tech"],
  featurePrioritization: ["product", "saas", "tech"],
  userOnboarding: ["product", "saas", "b2c"],
  productAnalytics: ["product", "saas", "tech"],
  productLedMetrics: ["saas", "product"],
  activationFunnel: ["saas", "product", "b2c"],
  featureAdoption: ["saas", "product"],
  virality: ["saas", "b2c", "product"],
  productQualifiedLeads: ["saas", "product"],
  timeToValue: ["saas", "product"],

  // ── Technology ──
  techOptimization: ["tech", "saas"],
  apiDesign: ["tech", "saas", "platform"],
  microservicesArchitecture: ["tech", "saas", "enterprise"],
  cloudOptimization: ["tech", "saas"],
  devopsMaturity: ["tech", "saas"],
  systemMonitoring: ["tech", "saas"],
  codeQuality: ["tech", "saas"],
  dataWarehouseStrategy: ["tech", "enterprise"],
  biDashboardDesign: ["tech", "enterprise"],
  predictiveModelCatalog: ["tech", "enterprise"],
  dataLineageMap: ["tech", "enterprise"],
  metricsDictionary: ["tech", "enterprise"],
  analyticsGovernance: ["tech", "enterprise"],

  // ── Platform ──
  platformEconomics: ["platform"],
  developerExperience: ["platform", "tech"],
  apiMonetization: ["platform", "tech"],
  marketplaceStrategy: ["platform"],
  platformGovernance: ["platform"],
  platformNetworkDynamics: ["platform"],

  // ── HR / People ──
  hiringPlan: ["hr", "startup"],
  talentGapAnalysis: ["hr"],
  talentAcquisition: ["hr", "enterprise"],
  talentPipeline: ["hr", "enterprise"],
  leadershipDevelopment: ["hr", "enterprise"],
  successionReadiness: ["hr", "enterprise"],
  compensationStrategy: ["hr", "enterprise"],
  workforceAnalytics: ["hr", "enterprise"],
  orgEffectiveness: ["hr", "enterprise"],
  employeeJourney: ["hr", "enterprise"],
  workplaceWellness: ["hr", "enterprise"],
  learningPathways: ["hr", "enterprise"],
  performanceFramework: ["hr", "enterprise"],
  payEquityAnalysis: ["hr", "enterprise"],
  deiBenchmark: ["hr", "enterprise"],
  recruitmentFunnel: ["hr"],
  employerBranding: ["hr", "enterprise"],
  teamTopology: ["hr", "tech"],
  onboardingOptimization: ["hr"],

  // ── Investor / Fundraising ──
  investorOnePager: ["investor", "startup"],
  fundingReadiness: ["investor", "startup"],
  boardDeck: ["investor", "startup", "enterprise"],
  investorDeck: ["investor", "startup"],
  fundingTimeline: ["investor", "startup"],
  valuationModel: ["investor", "startup"],
  capTableManagement: ["investor", "startup"],
  investorCommunication: ["investor", "startup"],
  boardReporting: ["investor", "enterprise"],
  fundraisingStrategy: ["investor", "startup"],
  captableManagement: ["investor", "startup"],
  exitPlanning: ["investor", "startup"],
  boardGovernance: ["investor", "enterprise"],

  // ── Operations ──
  operationalEfficiency: ["operations"],
  milestoneTracker: ["core"],
  benchmarkScore: ["core"],
  scenarioPlanner: ["core"],
  operatingRhythm: ["operations", "enterprise"],
  crossFunctionalSync: ["operations", "enterprise"],
  wardRoomStrategy: ["operations", "enterprise"],
  meetingCulture: ["operations"],
  documentManagement: ["operations"],
  workflowAutomation: ["operations", "tech"],
  qualityAssurance: ["tech", "operations"],

  // ── Competitive ──
  competitiveWinLoss: ["b2b", "sales"],
  competitiveMoat: ["core"],
  competitorTracking: ["core"],
  websiteAnalysis: ["marketing", "b2c", "saas"],
  competitorAnalysis: ["core"],

  // ── GTM ──
  gtmScorecard: ["marketing", "sales", "saas"],
  expansionPlaybook: ["b2b", "saas", "enterprise"],
  partnershipOpportunities: ["b2b", "enterprise"],
  geoExpansionStrategy: ["enterprise", "b2b"],
  localMarketEntry: ["enterprise"],
  marketRegulations: ["enterprise", "compliance"],
  partnerLocalization: ["enterprise"],
  culturalAdaptation: ["enterprise"],
  expansionRoi: ["enterprise"],
  marketResearch: ["marketing", "startup"],
  industryTrends: ["core"],
  uxResearch: ["product", "saas", "b2c"],
  webAnalytics: ["marketing", "saas", "b2c"],
  marketSizing: ["startup", "investor"],

  // ── Compliance / Legal ──
  complianceChecklist: ["compliance"],
  vendorScorecard: ["operations", "enterprise"],
  contractLifecycle: ["compliance", "enterprise", "b2b"],
  complianceAutomation: ["compliance", "enterprise"],
  legalRiskRegister: ["compliance", "enterprise"],
  intellectualPropertyAudit: ["compliance", "tech"],
  regulatoryCalendar: ["compliance"],
  privacyCompliance: ["compliance", "tech"],
  incidentResponse: ["tech", "compliance"],
  accessControl: ["tech", "compliance"],
  auditTrail: ["compliance", "enterprise"],
  penetrationTesting: ["tech", "compliance"],
  securityAwareness: ["tech", "compliance", "enterprise"],
  dataClassification: ["tech", "compliance"],

  // ── Brand ──
  brandPositionMap: ["brand", "b2c", "marketing"],
  brandValuation: ["brand", "enterprise"],
  brandHierarchy: ["brand", "enterprise"],
  reputationAnalysis: ["brand", "b2c", "enterprise"],
  messagingFramework: ["brand", "marketing"],
  visualBranding: ["brand", "b2c", "marketing"],
  brandEquity: ["brand", "b2c"],
  advocacyProgram: ["brand", "b2b", "b2c"],
  referralMechanism: ["b2c", "saas"],
  testimonialPipeline: ["b2b", "b2c", "saas"],
  caseStudyFactory: ["b2b"],
  channelStrategy: ["marketing", "b2c", "b2b"],
  digitalPresence: ["marketing", "b2c"],

  // ── ESG / Sustainability ──
  carbonReduction: ["esg", "enterprise", "physical"],
  circularEconomy: ["esg", "physical"],
  communityImpact: ["esg", "enterprise"],
  waterManagement: ["esg", "physical"],
  wasteReduction: ["esg", "physical"],
  sustainableInnovation: ["esg", "enterprise"],

  // ── Business Model ──
  businessModelCanvas: ["startup", "core"],
  revenueModelDesign: ["startup"],
  valueChainOptimization: ["operations", "enterprise"],
  costStructureAnalysis: ["financial"],
  partnershipModel: ["b2b", "enterprise"],
  growthLeverAssessment: ["startup", "saas"],
  kpis: ["core"],
  healthChecklist: ["core"],

  // ── AI ──
  aiReadinessScore: ["tech", "enterprise"],
  mlUseCasePriority: ["tech", "enterprise"],
  dataInfrastructure: ["tech", "enterprise"],
  aiTalentGap: ["tech", "enterprise"],
  ethicalAiFramework: ["tech", "enterprise"],
  aiRoiProjection: ["tech", "enterprise"],

  // ── Monetization ──
  pricingIntelligence: ["core"],
  pricingStrategy: ["saas", "b2c"],
  freeTrialConversion: ["saas"],
  usageBasedPricing: ["saas", "platform"],
  bundleOptimization: ["b2c", "saas"],
  discountDiscipline: ["b2b", "sales"],
  revenueLeakageDetection: ["financial"],

  // ── Customer Education ──
  customerAcademy: ["saas", "b2b"],
  contentEngagement: ["marketing", "saas"],
  communityHealth: ["saas", "platform"],
  certificationProgram: ["saas", "platform", "b2b"],
  selfServiceAdoption: ["saas"],
  supportDeflection: ["saas", "b2b"],

  // ── Crisis / Resilience ──
  crisisManagement: ["enterprise", "operations"],
  operationalResilience: ["enterprise", "operations"],
  stakeholderMapping: ["enterprise", "b2b"],
  contingencyPlanning: ["operations", "enterprise"],
  innovationPortfolio: ["enterprise", "tech"],

  // ── Supply Chain / Facilities ──
  vendorManagement: ["operations", "physical", "enterprise"],
  supplyChainVisibility: ["physical", "operations"],
  sustainableSourcing: ["physical", "esg"],
  facilityOptimization: ["physical", "operations"],
  fleetManagement: ["physical"],
};

// ── Business Profile Classification ─────────────────────────────────────────

interface BusinessProfile {
  categories: Set<SectionCategory>;
}

/**
 * Classify business into categories based on questionnaire answers.
 * This is a fast, local classification (no API calls).
 */
export function classifyBusiness(q: Questionnaire): BusinessProfile {
  const categories = new Set<SectionCategory>(["core" as SectionCategory]);
  const model = (q.businessModel || "").toLowerCase();
  const industry = (q.industry || "").toLowerCase();
  const revenue = (q.revenueRange || "").toLowerCase();
  const concerns = (q.keyConcerns || "").toLowerCase();
  const objective = (q.primaryObjective || "").toLowerCase();

  // ── Business Model Detection ──
  if (model.includes("b2b") || model.includes("enterprise") || model.includes("business to business")) {
    categories.add("b2b");
    categories.add("sales");
  }
  if (model.includes("b2c") || model.includes("consumer") || model.includes("retail") || model.includes("e-commerce") || model.includes("ecommerce") || model.includes("direct to consumer") || model.includes("d2c")) {
    categories.add("b2c");
    categories.add("brand");
  }
  if (model.includes("saas") || model.includes("subscription") || model.includes("software") || model.includes("cloud") || model.includes("app")) {
    categories.add("saas");
    categories.add("product");
    categories.add("tech");
  }
  if (model.includes("platform") || model.includes("marketplace")) {
    categories.add("platform");
    categories.add("tech");
  }
  if (model.includes("service") || model.includes("consulting") || model.includes("agency") || model.includes("freelance") || model.includes("professional")) {
    categories.add("services");
  }
  if (model.includes("product") || model.includes("manufacturing") || model.includes("physical") || model.includes("hardware")) {
    categories.add("physical");
    categories.add("product");
    categories.add("operations");
  }

  // ── Industry Detection ──
  if (industry.includes("tech") || industry.includes("software") || industry.includes("it") || industry.includes("digital") || industry.includes("ai") || industry.includes("cyber")) {
    categories.add("tech");
  }
  if (industry.includes("retail") || industry.includes("consumer") || industry.includes("fashion") || industry.includes("food") || industry.includes("restaurant") || industry.includes("hospitality")) {
    categories.add("b2c");
    categories.add("brand");
    categories.add("physical");
  }
  if (industry.includes("manufactur") || industry.includes("logistics") || industry.includes("supply chain") || industry.includes("transport") || industry.includes("warehouse") || industry.includes("distribution")) {
    categories.add("physical");
    categories.add("operations");
  }
  if (industry.includes("fintech") || industry.includes("finance") || industry.includes("banking") || industry.includes("insurance") || industry.includes("accounting")) {
    categories.add("financial");
    categories.add("compliance");
  }
  if (industry.includes("health") || industry.includes("pharma") || industry.includes("medical") || industry.includes("bio")) {
    categories.add("compliance");
  }
  if (industry.includes("legal") || industry.includes("regulat")) {
    categories.add("compliance");
  }
  if (industry.includes("media") || industry.includes("entertainment") || industry.includes("creative") || industry.includes("marketing") || industry.includes("advertising")) {
    categories.add("marketing");
    categories.add("brand");
  }
  if (industry.includes("real estate") || industry.includes("construction") || industry.includes("property")) {
    categories.add("physical");
    categories.add("operations");
  }
  if (industry.includes("energy") || industry.includes("oil") || industry.includes("mining") || industry.includes("utilities")) {
    categories.add("physical");
    categories.add("esg");
    categories.add("compliance");
  }
  if (industry.includes("education") || industry.includes("edtech")) {
    categories.add("services");
  }
  if (industry.includes("nonprofit") || industry.includes("ngo") || industry.includes("social enterprise")) {
    categories.add("esg");
  }

  // ── Revenue / Size Detection ──
  const isSmall = revenue.includes("0") || revenue.includes("under") || revenue.includes("<") || revenue.includes("pre-revenue") || revenue.includes("seed") || revenue.includes("early");
  const isLarge = revenue.includes("10m") || revenue.includes("50m") || revenue.includes("100m") || revenue.includes("billion") || revenue.includes("enterprise");

  if (isSmall) {
    categories.add("startup");
  }
  if (isLarge) {
    categories.add("enterprise");
    categories.add("compliance");
    categories.add("hr");
    categories.add("operations");
    categories.add("financial");
  }

  // ── Concerns / Objectives Detection ──
  const text = `${concerns} ${objective}`;
  if (text.includes("funding") || text.includes("investor") || text.includes("raise") || text.includes("capital") || text.includes("vc") || text.includes("seed") || text.includes("series")) {
    categories.add("investor");
    categories.add("startup");
  }
  if (text.includes("hiring") || text.includes("team") || text.includes("talent") || text.includes("culture") || text.includes("retention") || text.includes("employees")) {
    categories.add("hr");
  }
  if (text.includes("marketing") || text.includes("brand") || text.includes("growth") || text.includes("acquisition") || text.includes("leads") || text.includes("awareness")) {
    categories.add("marketing");
    categories.add("brand");
  }
  if (text.includes("sales") || text.includes("pipeline") || text.includes("deals") || text.includes("closing") || text.includes("quota")) {
    categories.add("sales");
  }
  if (text.includes("product") || text.includes("feature") || text.includes("roadmap") || text.includes("launch")) {
    categories.add("product");
  }
  if (text.includes("compliance") || text.includes("regulation") || text.includes("legal") || text.includes("gdpr") || text.includes("hipaa")) {
    categories.add("compliance");
  }
  if (text.includes("sustainab") || text.includes("esg") || text.includes("climate") || text.includes("green") || text.includes("carbon")) {
    categories.add("esg");
  }
  if (text.includes("operations") || text.includes("efficiency") || text.includes("automat") || text.includes("process")) {
    categories.add("operations");
  }

  // ── Always include financial and marketing for any business ──
  categories.add("financial");
  categories.add("marketing");

  return { categories };
}

/**
 * Returns the set of deliverable keys that are relevant for this business.
 * Sections tagged "core" are always included. Other sections are included
 * only if the business matches at least one of their categories.
 */
export function getRelevantSections(q: Questionnaire): Set<string> {
  const profile = classifyBusiness(q);
  const relevant = new Set<string>();

  for (const [sectionKey, sectionCategories] of Object.entries(SECTION_CATEGORIES)) {
    // Include if any of the section's categories match the business profile
    if (sectionCategories.some(cat => profile.categories.has(cat))) {
      relevant.add(sectionKey);
    }
  }

  return relevant;
}

/**
 * Check if a specific section is relevant for this business.
 */
export function isSectionRelevant(q: Questionnaire, sectionKey: string): boolean {
  const sectionCategories = SECTION_CATEGORIES[sectionKey];
  if (!sectionCategories) return true; // Unknown sections are included by default

  const profile = classifyBusiness(q);
  return sectionCategories.some(cat => profile.categories.has(cat));
}

/**
 * AI-enhanced relevance classification (optional, costs ~1 API call).
 * Uses Gemini to refine the relevance set for edge cases.
 * Only called when the questionnaire has unusual characteristics.
 */
export async function getAIRelevantSections(q: Questionnaire): Promise<Set<string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genai = new GoogleGenAI({ apiKey });
    const allSections = Object.keys(SECTION_CATEGORIES);

    const prompt = `You are classifying which business intelligence sections are relevant for this specific business.

Business: ${q.organizationName}
Industry: ${q.industry}
Revenue: ${q.revenueRange}
Model: ${q.businessModel}
Concerns: ${q.keyConcerns}
Objective: ${q.primaryObjective || "Not specified"}

Here are ALL available section keys (${allSections.length} total):
${allSections.join(", ")}

Return ONLY a JSON array of section keys that are RELEVANT for this specific business.
Include "core" sections (healthScore, cashIntelligence, etc.) plus any sections that make sense for their business model and industry.
Exclude sections that would be irrelevant or confusing (e.g., fleetManagement for a SaaS company, or carbonReduction for a solo consultant).

Return ONLY the JSON array, no other text.`;

    const result = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = result.text?.trim() || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as string[];
    return new Set(parsed);
  } catch (e) {
    console.warn("[Pivot] AI relevance classification failed, falling back to rule-based:", e);
    return null;
  }
}
