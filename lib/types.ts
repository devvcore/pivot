/** Questionnaire fields from MVP spec */
export interface Questionnaire {
  organizationName: string;
  industry: string;
  revenueRange: string;
  businessModel: string;
  keyConcerns: string;
  oneDecisionKeepingOwnerUpAtNight: string;
  primaryObjective?: string;
  keyCustomers?: string;
  keyCompetitors?: string;
  location?: string;
  website?: string;                  // business website URL for analysis
  websiteVisitorsPerDay?: number;    // daily website visitors (from onboarding)
  competitorUrls?: string[];         // competitor website URLs (from onboarding)
  techStack?: string;                // hosting/tools used (for cost optimization)
  orgId?: string;                    // which org this run belongs to
  marketingChannels?: string[];      // current marketing channels (Instagram, Cold Email, etc.)
  socialMediaUrls?: Record<string, string>; // platform → profile URL
  socialMediaPlatforms?: string[];   // platforms they're active on (if no URLs given)
}

export type JobStatus =
  | "pending"
  | "parsing"
  | "ingesting"
  | "synthesizing"
  | "formatting"
  | "completed"
  | "failed";

export interface Job {
  runId: string;
  status: JobStatus;
  phase?: "INGEST" | "PLAN" | "EXECUTE";
  questionnaire: Questionnaire;
  filePaths: string[];
  parsedContext?: string;
  knowledgeGraph?: KnowledgeGraph;
  error?: string;
  deliverables?: MVPDeliverables;
  createdAt: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-hallucination: Financial Facts & Data Provenance
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialFact {
  label: string;        // "Monthly Revenue", "Cash Position", etc.
  value: number;
  sourceFile: string;   // filename it was extracted from
  confidence: number;   // 0-100 from extraction
}

export interface CompanyIdentity {
  name: string;              // from questionnaire
  domain: string | null;     // extracted from website URL
  verifiedDomain: boolean;   // did we successfully fetch the website?
  aliases: string[];         // alternative names found in documents
}

export interface DataProvenance {
  documentSources: string[];         // filenames used
  financialFactCount: number;        // how many facts came from docs
  warnings: string[];                // conflicts or suspicious values
  coverageGaps: string[];            // what data was missing
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 output: BusinessPacket
// Lean, structured extraction produced by Gemini Lite ingestion agent.
// No raw text — only facts, metrics, and issues. Passed to Stage 2 Flash agents.
// ─────────────────────────────────────────────────────────────────────────────
export interface BusinessPacket {
  orgName: string;
  industry: string;
  location?: string;
  website?: string;
  questionnaire: Questionnaire;
  keyMetrics: {
    estimatedMonthlyRevenue?: number;
    estimatedMonthlyExpenses?: number;
    cashPosition?: number;
    cashRunwayWeeks?: number;
    employeeCount?: number;
    grossMarginPct?: number;
    topCustomers: string[];
    topCompetitors: string[];
  };
  categoryDossiers: {
    category: string;
    keyFacts: string[];
    criticalIssues: string[];
    financialAmounts: Record<string, number>;
  }[];
  consolidatedRisks: string[];
  consolidatedOpportunities: string[];
  dataCoverage: Record<string, boolean>;
  documentCount: number;
  financialFacts?: FinancialFact[];    // verified facts from source documents
  identity?: CompanyIdentity;          // anchored company identity
}

// ─────────────────────────────────────────────────────────────────────────────
// Website Analysis — output of the website grading agent
// ─────────────────────────────────────────────────────────────────────────────
export interface WebsiteAnalysis {
  url: string;
  grade: string;          // A–F
  score: number;          // 0–100
  synopsis: string;       // 2-3 sentence summary of the site
  actualOffer: string;    // what the site actually promotes
  perceivedOffer: string; // what visitors likely think you do
  offerGap: string;       // gap between the two
  topIssues: string[];    // top 3-5 issues
  recommendations: string[];
  suggestedHeadline: string;     // better homepage headline
  prominentFeatures: string[];   // what should be front and center
  marketingDirection: string;    // overall marketing strategy suggestion
  ctaAssessment: string;         // is the CTA clear?
  analyzedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Memory — lightweight compressed intelligence for the ARIA chat agent
// ~600 words. Loaded at the start of every conversation to avoid re-reading
// the full report. Agent calls get_report_section tool when it needs deep data.
// ─────────────────────────────────────────────────────────────────────────────
export interface AgentMemory {
  orgId: string;
  orgName: string;
  summary: string;   // compressed 500-700 word business intelligence
  keyNumbers: {
    healthScore?: number;
    healthGrade?: string;
    cashRunway?: number;
    revenueAtRisk?: number;
    totalLeaks?: number;
    lastAnalysisDate?: number;
  };
  reportSummaries: {
    runId: string;
    date: number;
    headline: string;
    score?: number;
    grade?: string;
  }[];
  websiteGrade?: string;
  lastUpdated: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat message for ARIA agent conversations
// ─────────────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Organization profile (multi-org support)
// ─────────────────────────────────────────────────────────────────────────────
export interface OrgProfile {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  iconUrl?: string;       // favicon URL or null (falls back to initial letter)
  themeColor?: string;    // hex color for org accent (auto-generated if not set)
  agentMemory?: AgentMemory;
  websiteAnalysis?: WebsiteAnalysis;
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitor & Market Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface CompetitorSiteAnalysis {
  name: string;             // company name or "Industry Leader #1"
  url: string;
  isIndustryLeader: boolean;
  websiteGrade?: string;    // A–F
  websiteScore?: number;    // 0–100
  offer: string;            // what they actually sell (distilled)
  strengths: string[];
  weaknesses: string[];
  marketingDirection: string;
}

export interface CompetitorAnalysis {
  userWebsiteGrade?: string;   // from websiteAnalysis (for side-by-side)
  competitors: CompetitorSiteAnalysis[];
  industryLeaders: CompetitorSiteAnalysis[];
  repositioningRecommendations: {
    rank: number;
    recommendation: string;
    rationale: string;
    implementation: string;
  }[];
  suggestedPositioning: string;      // one-liner positioning statement
  differentiationOpportunity: string;
  headlineComparison: {
    current?: string;         // user's current headline (from website analysis)
    suggested: string;        // improved headline informed by leaders
    theirs: string;           // how top leaders headline (pattern)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tech Cost Optimization
// ─────────────────────────────────────────────────────────────────────────────

export interface TechOptimization {
  currentEstimatedMonthlyCost?: number;
  potentialSavings?: number;
  recommendations: {
    rank: number;
    currentTool: string;
    suggestedAlternative: string;
    estimatedSaving: string;
    rationale: string;
    migrationEffort: "Low" | "Medium" | "High";
  }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingIntelligence {
  currentPricingAssessment: string;
  suggestedPricing: {
    tier: string;
    range: string;
    rationale: string;
    targetSegment: string;
  }[];
  competitivePosition: string;
  marginOptimization: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Social Media Profile Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface SocialProfileAnalysis {
  platform: string;           // "instagram" | "linkedin" | "tiktok" | "x" | "youtube" | "facebook"
  handle: string;
  url: string;
  followerCount?: string;     // "12.4K" — string because scraped
  postFrequency?: string;     // "3-4 posts/week"
  bioSummary: string;         // what their bio communicates
  contentThemes: string[];    // top 3-4 themes they post about
  engagementLevel: string;    // "High" | "Medium" | "Low"
  strengths: string[];
  weaknesses: string[];
  profileGrade: string;       // A-F
  profileScore: number;       // 0-100
  isCompetitor: boolean;      // true if this is a competitor/leader profile
  companyName?: string;       // whose profile this is
  verified?: boolean;         // true if profile confirmed to belong to the company
  verificationNote?: string;  // explanation if verification failed
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketing Intelligence — full marketing strategy deliverable
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketingStrategyReport {
  currentChannels: string[];
  socialProfiles: SocialProfileAnalysis[];
  competitorSocialProfiles: SocialProfileAnalysis[];
  channelRecommendations: {
    rank: number;
    channel: string;
    why: string;
    effort: "Low" | "Medium" | "High";
    expectedImpact: string;
    howToStart: string;
  }[];
  socialMediaStrategy: {
    platform: string;
    currentGrade?: string;
    vsCompetitorGrade?: string;
    improvements: string[];
    contentSuggestions: string[];
    postingFrequency: string;
  }[];
  websiteCopyRecommendations: {
    section: string;
    current: string;
    suggested: string;
    rationale: string;
  }[];
  offerPositioning: {
    currentPositioning: string;
    competitorPositioning: string[];
    suggestedRepositioning: string;
    keyMessages: string[];
  };
  contentStrategy: string;
  adSpendRecommendation?: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Terminology — adapts language to business model type
// ─────────────────────────────────────────────────────────────────────────────

export interface BusinessTerminology {
  businessType: "saas" | "services" | "retail" | "b2b" | "b2c" | "marketplace" | "other";
  terms: {
    customer: string;      // "user", "client", "customer", "account"
    revenue: string;       // "MRR", "retainer revenue", "sales", "deal value"
    churn: string;         // "churn rate", "client attrition", "customer loss"
    acquisition: string;   // "signup", "client acquisition", "purchase", "deal close"
    product: string;       // "platform", "service", "product", "solution"
    upsell: string;        // "expansion", "upsell", "cross-sell", "add-on"
    pipeline: string;      // "funnel", "pipeline", "sales cycle", "order flow"
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Identification
// ─────────────────────────────────────────────────────────────────────────────

export interface KPIDefinition {
  name: string;             // "Monthly Recurring Revenue"
  abbreviation: string;     // "MRR"
  currentValue?: string;    // "$42,000" or "Unknown"
  targetValue?: string;     // "$60,000"
  unit: string;             // "$", "%", "#", "days"
  frequency: string;        // "Monthly", "Weekly", "Daily"
  isNorthStar: boolean;     // true for top 2-3 KPIs
  category: string;         // "Revenue", "Growth", "Retention", "Operations", "Marketing"
  benchmark?: string;       // "Industry average: $50K"
  status: "on_track" | "at_risk" | "behind" | "unknown";
  sourceData: "from_documents" | "estimated" | "unknown";
}

export interface KPIReport {
  businessType: string;
  kpis: KPIDefinition[];
  summary: string;
  missingDataWarning?: string;   // "We couldn't find X data — upload it for better KPI tracking"
}

// ─────────────────────────────────────────────────────────────────────────────
// Roadmap / Calendar — 30-day action plan with daily tasks
// ─────────────────────────────────────────────────────────────────────────────

export interface RoadmapItem {
  day: number;             // 1-30
  date?: string;           // "2026-03-01"
  action: string;          // "Call top 3 at-risk clients"
  category: string;        // "Revenue Recovery", "Marketing", "Operations", "Sales"
  priority: "critical" | "high" | "medium" | "low";
  expectedImpact: string;  // "$15K revenue saved"
  owner: string;           // "Owner" by default
  source: string;          // "Quick Win #1" or "Issue Register #3"
  completed: boolean;
}

export interface RoadmapReport {
  items: RoadmapItem[];
  weeklyThemes: { week: number; theme: string; focus: string }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Health Checklist — gold standard checks
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthCheckItem {
  category: string;         // "Sales", "Operations", "Marketing", "Finance", "HR"
  item: string;             // "CRM System"
  description: string;      // "A system to track customer interactions and sales pipeline"
  status: "present" | "absent" | "partial" | "unknown";
  evidence?: string;        // "Found Salesforce mentions in documents"
  recommendation?: string;  // "Consider implementing HubSpot CRM (free tier available)"
  priority: "critical" | "important" | "nice_to_have";
  estimatedCost?: string;   // "$0 - $50/mo"
}

export interface HealthChecklist {
  items: HealthCheckItem[];
  score: number;            // 0-100 based on how many items are present
  grade: string;            // A-F
  summary: string;
  topGap: string;           // "Your biggest operational gap is..."
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead Generation — Nyne.ai powered leads
// ─────────────────────────────────────────────────────────────────────────────

export interface Lead {
  name: string;
  title?: string;
  company?: string;
  companyDomain?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
  estimatedCompanySize?: string;
  relevanceScore?: number;   // 0-100
  isDecisionMaker?: boolean;
  headline?: string;
}

export interface LeadReport {
  leads: Lead[];
  searchCriteria: {
    industry?: string;
    location?: string;
    roles?: string[];
    companySize?: string;
  };
  creditsUsed: number;
  totalAvailable: number;
  generatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coach Agent — team members and coaching
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  orgId: string;
  name: string;
  email?: string;
  role: "owner" | "employee";
  department?: string;
  title?: string;
  salary?: number;
  startDate?: string;
  kpis?: string[];          // assigned KPI names
  performanceNotes?: string; // from uploaded docs
}

// ─────────────────────────────────────────────────────────────────────────────
// SWOT Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface SWOTAnalysis {
  strengths: { point: string; evidence: string; leverage: string }[];
  weaknesses: { point: string; evidence: string; mitigation: string }[];
  opportunities: { point: string; timeframe: string; potentialImpact: string; actionRequired: string }[];
  threats: { point: string; likelihood: "high" | "medium" | "low"; severity: string; contingency: string }[];
  strategicPriorities: { priority: string; rationale: string; timeline: string }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Economics
// ─────────────────────────────────────────────────────────────────────────────

export interface UnitEconomics {
  cac: { value: string; source: "from_documents" | "estimated"; benchmark?: string };
  ltv: { value: string; source: "from_documents" | "estimated"; benchmark?: string };
  ltvCacRatio: { value: string; assessment: string; benchmark: string };
  paybackPeriodMonths: { value: string; source: "from_documents" | "estimated"; assessment: string };
  grossMargin: { value: string; source: "from_documents" | "estimated"; benchmark?: string };
  netMargin: { value: string; source: "from_documents" | "estimated" };
  revenuePerCustomer: { value: string; source: "from_documents" | "estimated" };
  burnMultiple: { value: string; assessment: string };
  recommendations: { metric: string; current: string; target: string; action: string }[];
  summary: string;
  dataQualityNote: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Segmentation
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Competitive Win/Loss Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface CompetitiveWinLoss {
  winReasons: { reason: string; frequency: string; evidence: string }[];
  lossReasons: { reason: string; frequency: string; remediation: string }[];
  competitiveAdvantages: { advantage: string; sustainability: "durable" | "temporary" | "at_risk" }[];
  competitiveDisadvantages: { disadvantage: string; urgency: "immediate" | "medium_term" | "long_term"; fix: string }[];
  battleCards: { competitor: string; theirStrength: string; yourCounter: string; talkTrack: string }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Investor One-Pager
// ─────────────────────────────────────────────────────────────────────────────

export interface InvestorOnePager {
  companyName: string;
  tagline: string;             // One-line pitch
  problem: string;
  solution: string;
  marketSize: string;
  businessModel: string;
  traction: string;            // Key metrics proving momentum
  team: string;
  competitiveEdge: string;
  financialHighlights: { metric: string; value: string }[];
  askAmount?: string;
  useOfFunds?: string;
  keyRisks: string[];
  whyNow: string;
  contactInfo?: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiring Recommendations
// ─────────────────────────────────────────────────────────────────────────────

export interface HiringRecommendation {
  rank: number;
  role: string;                // "VP of Sales", "Senior Developer"
  department: string;          // "Sales", "Engineering", "Marketing"
  urgency: "immediate" | "next_quarter" | "next_half";
  rationale: string;           // Why this hire matters
  expectedROI: string;         // "Could close $200K in new revenue within 6 months"
  estimatedSalary: string;     // "$80K-$120K"
  alternativeToHiring?: string; // "Could outsource to agency for $3K/mo instead"
  keyResponsibilities: string[];
}

export interface HiringPlan {
  recommendations: HiringRecommendation[];
  currentTeamGaps: { area: string; gap: string; impact: string }[];
  totalBudgetNeeded: string;
  priorityOrder: string;       // "Sales first, then marketing, then ops"
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Forecast Model
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueForecastScenario {
  name: string;                // "Conservative", "Base Case", "Optimistic"
  assumptions: string[];
  monthly: { month: string; revenue: number; costs: number; profit: number }[];
  totalRevenue12Mo: number;
  totalProfit12Mo: number;
  breakEvenMonth?: string;
}

export interface RevenueForecast {
  scenarios: RevenueForecastScenario[];
  currentMRR: string;
  currentARR: string;
  growthRate: string;
  keyDrivers: { driver: string; impact: string; confidence: "high" | "medium" | "low" }[];
  risks: { risk: string; revenueImpact: string; mitigant: string }[];
  summary: string;
  dataQualityNote: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Churn Prevention Playbook
// ─────────────────────────────────────────────────────────────────────────────

export interface ChurnPlaybookEntry {
  customerName: string;
  riskLevel: "critical" | "high" | "medium";
  revenueAtRisk: string;
  warningSignals: string[];
  predictedChurnWindow: string;  // "Within 30 days", "60-90 days"
  interventionPlan: { step: number; action: string; owner: string; deadline: string }[];
  talkingPoints: string[];       // What to say on the call
  offerToMake?: string;          // Discount, upgrade, etc.
  successMetric: string;         // How to know the intervention worked
}

export interface ChurnPlaybook {
  entries: ChurnPlaybookEntry[];
  totalRevenueAtRisk: string;
  overallStrategy: string;
  retentionTactics: { tactic: string; effort: string; impact: string }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Playbook
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesPlaybook {
  idealBuyerPersona: { title: string; painPoints: string[]; motivations: string[]; objections: string[] }[];
  salesProcess: { stage: string; actions: string[]; exitCriteria: string; avgDuration: string }[];
  objectionHandling: { objection: string; response: string; proof: string }[];
  emailTemplates: { purpose: string; subject: string; body: string }[];
  coldCallScript: { opening: string; qualifyingQuestions: string[]; pitchPoints: string[]; closingAsk: string };
  pricingTalkTrack: string;
  competitiveHandling: string;
  closingTechniques: { technique: string; whenToUse: string; example: string }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal Tracker / OKR System
// ─────────────────────────────────────────────────────────────────────────────

export interface OKRObjective {
  id: string;
  objective: string;           // "Increase monthly revenue to $100K"
  category: string;            // "Revenue", "Growth", "Operations", "Product"
  timeframe: string;           // "Q1 2026", "Next 90 days"
  keyResults: {
    id: string;
    description: string;       // "Close 5 enterprise deals"
    metric: string;            // "enterprise_deals_closed"
    current: string;           // "2"
    target: string;            // "5"
    unit: string;              // "#", "$", "%"
    progress: number;          // 0-100
    status: "on_track" | "at_risk" | "behind" | "completed";
  }[];
  overallProgress: number;     // 0-100
  status: "on_track" | "at_risk" | "behind" | "completed";
  linkedDeliverable?: string;  // "revenueLeakAnalysis", "kpiReport"
}

export interface GoalTracker {
  objectives: OKRObjective[];
  suggestedObjectives: { objective: string; rationale: string; category: string; keyResults: string[] }[];
  quarterlyTheme: string;      // "Revenue Recovery & Stabilization"
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deliverables
// ─────────────────────────────────────────────────────────────────────────────

export interface MVPDeliverables {
  healthScore: HealthScore;
  cashIntelligence: CashIntelligence;
  revenueLeakAnalysis: RevenueLeakAnalysis;
  issuesRegister: IssuesRegister;
  atRiskCustomers: AtRiskCustomers;
  decisionBrief: DecisionBrief;
  actionPlan: ActionPlan;
  marketIntelligence?: MarketIntelligence;
  websiteAnalysis?: WebsiteAnalysis;       // included if URL provided
  competitorAnalysis?: CompetitorAnalysis; // included if competitors/industry analyzed
  techOptimization?: TechOptimization;     // included if tech stack provided
  pricingIntelligence?: PricingIntelligence; // always included
  marketingStrategy?: MarketingStrategyReport; // marketing channels, social audit, copy recs
  pitchDeckAnalysis?: PitchDeckAnalysis;       // pitch deck review + generation
  dataProvenance?: DataProvenance;              // anti-hallucination metadata
  // New fields
  terminology?: BusinessTerminology;
  kpiReport?: KPIReport;
  roadmap?: RoadmapReport;
  healthChecklist?: HealthChecklist;
  leadReport?: LeadReport;
  // Wave 2 features
  swotAnalysis?: SWOTAnalysis;
  unitEconomics?: UnitEconomics;
  competitiveWinLoss?: CompetitiveWinLoss;
  investorOnePager?: InvestorOnePager;
  hiringPlan?: HiringPlan;
  revenueForecast?: RevenueForecast;
  churnPlaybook?: ChurnPlaybook;
  salesPlaybook?: SalesPlaybook;
  goalTracker?: GoalTracker;
  // Wave 3 features
  benchmarkScore?: BenchmarkScore;
  executiveSummary?: ExecutiveSummary;
  // Wave 4 features
  milestoneTracker?: MilestoneTracker;
  riskRegister?: RiskRegister;
  partnershipOpportunities?: PartnershipOpportunities;
  fundingReadiness?: FundingReadiness;
  marketSizing?: MarketSizing;
  scenarioPlanner?: ScenarioPlanner;
  clvAnalysis?: CLVAnalysis;
  // Wave 5 features
  retentionPlaybook?: RetentionPlaybook;
  revenueAttribution?: RevenueAttribution;
  boardDeck?: BoardDeck;
  competitiveMoat?: CompetitiveMoat;
  gtmScorecard?: GTMScorecard;
  cashOptimization?: CashOptimization;
  // Wave 6 features
  talentGapAnalysis?: TalentGapAnalysis;
  revenueDiversification?: RevenueDiversification;
  complianceChecklist?: ComplianceChecklist;
  expansionPlaybook?: ExpansionPlaybook;
  // Wave 7 features
  productMarketFit?: ProductMarketFit;
  brandHealth?: BrandHealth;
  pricingElasticity?: PricingElasticity;
  strategicInitiatives?: StrategicInitiatives;
  cashConversionCycle?: CashConversionCycle;
  // Wave 8 features
  stakeholderMap?: StakeholderMap;
  decisionLog?: DecisionLog;
  cultureAssessment?: CultureAssessment;
  exitReadiness?: ExitReadiness;
  sustainabilityScore?: SustainabilityScore;
  // Wave 9 features
  acquisitionTargets?: AcquisitionTargets;
  financialRatios?: FinancialRatios;
  channelMixModel?: ChannelMixModel;
  regulatoryLandscape?: RegulatoryLandscape;
  crisisPlaybook?: CrisisPlaybook;
  // Wave 10 features
  aiReadiness?: AIReadiness;
  networkEffects?: NetworkEffects;
  dataMonetization?: DataMonetization;
  subscriptionMetrics?: SubscriptionMetrics;
  marketTiming?: MarketTiming;
  scenarioStressTest?: ScenarioStressTest;
  // Wave 11 features
  pricingStrategyMatrix?: PricingStrategyMatrix;
  revenueWaterfall?: RevenueWaterfall;
  techDebtAssessment?: TechDebtAssessment;
  teamPerformance?: TeamPerformance;
  marketEntryStrategy?: MarketEntryStrategy;
  // Wave 12 features
  competitiveIntelFeed?: CompetitiveIntelFeed;
  cashFlowSensitivity?: CashFlowSensitivity;
  digitalMaturity?: DigitalMaturity;
  acquisitionFunnel?: AcquisitionFunnel;
  strategicAlignment?: StrategicAlignment;
  budgetOptimizer?: BudgetOptimizer;

  // Wave 13: Revenue Intelligence & Optimization
  revenueDrivers?: RevenueDrivers;
  marginOptimization?: MarginOptimization;
  demandForecasting?: DemandForecasting;
  cohortAnalysis?: CohortAnalysis;
  winLossAnalysis?: WinLossAnalysis;
  salesForecast?: SalesForecast;

  // Wave 14: Operational Excellence
  processEfficiency?: ProcessEfficiency;
  vendorRisk?: VendorRisk;
  qualityMetrics?: QualityMetrics;
  knowledgeManagement?: KnowledgeManagement;
  complianceScorecard?: ComplianceScorecard;

  // Wave 15: Growth & Market Intelligence
  marketPenetration?: MarketPenetration;
  flywheelAnalysis?: FlywheelAnalysis;
  partnershipsStrategy?: PartnershipsStrategy;
  internationalExpansion?: InternationalExpansion;
  rdEffectiveness?: RDEffectiveness;
  brandEquity?: BrandEquity;

  // Wave 16: Financial Planning & Strategy
  workingCapital?: WorkingCapital;
  debtStrategy?: DebtStrategy;
  taxStrategy?: TaxStrategy;
  investorReadiness?: InvestorReadiness;
  maReadiness?: MAReadiness;
  strategicRoadmap?: StrategicRoadmap;

  // Wave 17: Customer Intelligence
  customerVoice?: CustomerVoice;
  referralEngine?: ReferralEngine;
  priceSensitivityIndex?: PriceSensitivityIndex;
  customerEffortScore?: CustomerEffortScore;
  accountExpansionMap?: AccountExpansionMap;
  loyaltyProgramDesign?: LoyaltyProgramDesign;

  // Wave 18: Market Dynamics
  competitivePricingMatrix?: CompetitivePricingMatrix;
  marketSentimentIndex?: MarketSentimentIndex;
  disruptionRadar?: DisruptionRadar;
  ecosystemMap?: EcosystemMap;
  categoryCreation?: CategoryCreation;
  marketVelocity?: MarketVelocity;

  // Wave 19: Execution Excellence
  okrCascade?: OKRCascade;
  meetingEffectiveness?: MeetingEffectiveness;
  communicationAudit?: CommunicationAudit;
  decisionVelocity?: DecisionVelocity;
  resourceOptimizer?: ResourceOptimizer;
  changeManagement?: ChangeManagement;

  // Wave 20: Financial Mastery
  cashReserveStrategy?: CashReserveStrategy;
  revenueQualityScore?: RevenueQualityScore;
  costIntelligence?: CostIntelligence;
  financialModeling?: FinancialModeling;
  profitabilityMap?: ProfitabilityMap;
  capitalAllocation?: CapitalAllocation;
  // Wave 21: Sales Excellence
  salesPipelineHealth?: SalesPipelineHealth;
  dealVelocity?: DealVelocity;
  winRateOptimizer?: WinRateOptimizer;
  salesEnablement?: SalesEnablement;
  territoryPlanning?: TerritoryPlanning;
  quotaIntelligence?: QuotaIntelligence;
  // Wave 22: Product Intelligence
  featurePrioritization?: FeaturePrioritization;
  productUsageAnalytics?: ProductUsageAnalytics;
  techStackAudit?: TechStackAudit;
  apiStrategy?: ApiStrategy;
  platformScalability?: PlatformScalability;
  userOnboarding?: UserOnboarding;
  // Wave 23: People & Culture
  employeeEngagement?: EmployeeEngagement;
  talentAcquisitionFunnel?: TalentAcquisitionFunnel;
  compensationBenchmark?: CompensationBenchmark;
  successionPlanning?: SuccessionPlanning;
  diversityMetrics?: DiversityMetrics;
  employerBrand?: EmployerBrand;
  // Wave 24: Data & Analytics
  dataGovernance?: DataGovernance;
  analyticsMaturity?: AnalyticsMaturity;
  customerDataPlatform?: CustomerDataPlatform;
  predictiveModeling?: PredictiveModeling;
  reportingFramework?: ReportingFramework;
  dataQualityScore?: DataQualityScore;
  // Wave 25: Supply Chain & Operations
  supplyChainRisk?: SupplyChainRisk;
  inventoryOptimization?: InventoryOptimization;
  vendorScorecard?: VendorScorecard;
  operationalEfficiency?: OperationalEfficiency;
  qualityManagement?: QualityManagement;
  capacityPlanning?: CapacityPlanning;
  // Wave 26: Customer Experience & Journey
  customerJourneyMap?: CustomerJourneyMap;
  npsAnalysis?: NpsAnalysis;
  supportTicketIntelligence?: SupportTicketIntelligence;
  customerHealthScore?: CustomerHealthScore;
  voiceOfCustomer?: VoiceOfCustomer;
  customerSegmentation?: CustomerSegmentation;
  // Wave 27: Innovation & IP
  innovationPipeline?: InnovationPipeline;
  ipPortfolio?: IpPortfolio;
  rdEfficiency?: RdEfficiency;
  technologyReadiness?: TechnologyReadiness;
  partnershipEcosystem?: PartnershipEcosystem;
  mergersAcquisitions?: MergersAcquisitions;
  // Wave 28: Sustainability & Governance
  esgScorecard?: EsgScorecard;
  carbonFootprint?: CarbonFootprint;
  regulatoryCompliance?: RegulatoryCompliance;
  businessContinuity?: BusinessContinuity;
  ethicsFramework?: EthicsFramework;
  socialImpact?: SocialImpact;
  // Wave 29: Revenue Intelligence & Sales Analytics (new fields only)
  dealPipeline?: DealPipeline;
  salesForecasting?: SalesForecasting;
  accountBasedMarketing?: AccountBasedMarketing;
  commissionOptimization?: CommissionOptimization;
  // Wave 30: Product & Market Intelligence (new fields only)
  productAnalytics?: ProductAnalytics;
  competitiveResponse?: CompetitiveResponse;
  // Wave 31: Financial Planning & Analysis (new fields only)
  scenarioPlanning?: ScenarioPlanning;
  capitalStructure?: CapitalStructure;
  fundraisingReadiness?: FundraisingReadiness;
  exitStrategy?: ExitStrategy;
  // Wave 32: People & Culture Analytics (new fields only)
  talentAcquisition?: TalentAcquisition;
  diversityInclusion?: DiversityInclusion;
  // Wave 33: Strategic Growth
  marketEntryPlaybook?: MarketEntryPlaybook;
  partnerChannelStrategy?: PartnerChannelStrategy;
  acquisitionIntegration?: AcquisitionIntegration;
  internationalReadiness?: InternationalReadiness;
  revenueModelAnalysis?: RevenueModelAnalysis;
  growthExperiments?: GrowthExperiments;
  // Wave 34: Customer Intelligence
  customerAcquisitionCost?: CustomerAcquisitionCost;
  lifetimeValueOptimization?: LifetimeValueOptimization;
  churnPrediction?: ChurnPrediction;
  netRevenueRetention?: NetRevenueRetention;
  customerAdvocacy?: CustomerAdvocacy;
  feedbackLoop?: FeedbackLoop;
  // Wave 35: Operational Excellence
  processAutomation?: ProcessAutomation;
  costBenchmark?: CostBenchmark;
  vendorNegotiation?: VendorNegotiation;
  scalabilityAssessment?: ScalabilityAssessment;
  incidentReadiness?: IncidentReadiness;
  operationalRisk?: OperationalRisk;
  // Wave 36: Data & AI Strategy
  dataStrategy?: DataStrategy;
  aiUseCases?: AiUseCases;
  analyticsRoadmap?: AnalyticsRoadmap;
  dataPrivacy?: DataPrivacy;
  mlOpsReadiness?: MlOpsReadiness;
  digitalTransformation?: DigitalTransformation;
  // Wave 37: Revenue Operations
  revenueOps?: RevenueOps;
  billingOptimization?: BillingOptimization;
  contractIntelligence?: ContractIntelligence;
  commissionTracking?: CommissionTracking;
  revenueRecognition?: RevenueRecognition;
  subscriptionHealth?: SubscriptionHealth;
  // Wave 38: Product Intelligence
  productRoadmapHealth?: ProductRoadmapHealth;
  techDebtPrioritization?: TechDebtPrioritization;
  releaseVelocity?: ReleaseVelocity;
  bugTrendAnalysis?: BugTrendAnalysis;
  apiPerformance?: ApiPerformance;
  userExperienceScore?: UserExperienceScore;
  // Wave 39: Workforce Planning
  workforcePlanning?: WorkforcePlanning;
  skillsGapAnalysis?: SkillsGapAnalysis;
  remoteWorkEffectiveness?: RemoteWorkEffectiveness;
  teamVelocity?: TeamVelocity;
  burnoutRisk?: BurnoutRisk;
  learningDevelopment?: LearningDevelopment;
  // Wave 40: Compliance & Legal
  regulatoryRisk?: RegulatoryRisk;
  contractManagement?: ContractManagement;
  ipStrategy?: IpStrategy;
  legalSpendAnalysis?: LegalSpendAnalysis;
  policyCompliance?: PolicyCompliance;
  auditReadiness?: AuditReadiness;
  // Wave 41: Sales Excellence
  salesMethodology?: SalesMethodology;
  pipelineVelocity?: PipelineVelocity;
  dealQualification?: DealQualification;
  salesCoaching?: SalesCoaching;
  accountPlanning?: AccountPlanning;
  competitiveBattlecards?: CompetitiveBattlecards;
  // Wave 42: Financial Intelligence
  cashBurnAnalysis?: CashBurnAnalysis;
  revenuePerEmployee?: RevenuePerEmployee;
  financialBenchmarking?: FinancialBenchmarking;
  investmentPortfolio?: InvestmentPortfolio;
  costAllocationModel?: CostAllocationModel;
  marginWaterfall?: MarginWaterfall;
  // Wave 43: Customer Success
  customerOnboardingMetrics?: CustomerOnboardingMetrics;
  healthScoreModel?: HealthScoreModel;
  csExpansionPlaybook?: CsExpansionPlaybook;
  renewalForecasting?: RenewalForecasting;
  csOperations?: CsOperations;
  customerMilestones?: CustomerMilestones;
  // Wave 44: Strategic Planning
  okrFramework?: OkrFramework;
  strategicPillars?: StrategicPillars;
  competitivePositioning?: CompetitivePositioning;
  marketShareAnalysis?: MarketShareAnalysis;
  growthCorridors?: GrowthCorridors;
  valuePropCanvas?: ValuePropCanvas;
}

export interface BenchmarkDimension {
  name: string;           // "Revenue Growth", "Profit Margin", "Customer Retention"
  score: number;          // 0-100
  industryAvg: number;    // 0-100
  percentile: string;     // "Top 10%", "Bottom 25%", "Average"
  insight: string;
}

export interface BenchmarkScore {
  overallScore: number;    // 0-100
  overallPercentile: string;
  dimensions: BenchmarkDimension[];
  topStrength: string;
  biggestGap: string;
  industryContext: string;
  recommendations: { area: string; current: string; target: string; action: string }[];
  summary: string;
}

export interface ExecutiveSummary {
  subject: string;         // Email subject line
  greeting: string;
  keyFindings: string[];   // 3-5 bullet points
  criticalActions: string[];  // Top 3 urgent actions
  financialSummary: string;
  outlook: string;         // "cautiously optimistic", etc.
  fullSummary: string;     // 2-3 paragraphs
}

// ── Wave 4 Types ─────────────────────────────────────────────────────────────

export interface Milestone {
  title: string;
  description: string;
  targetDate: string;
  status: "not_started" | "in_progress" | "completed" | "at_risk" | "blocked";
  category: "revenue" | "product" | "team" | "funding" | "market" | "operations";
  impact: string;
  dependencies?: string[];
  owner?: string;
}

export interface MilestoneTracker {
  milestones: Milestone[];
  nextMilestone: string;
  completionRate: number;
  criticalPath: string[];
  timeline: string;
  summary: string;
}

export interface RiskItem {
  risk: string;
  category: "financial" | "operational" | "market" | "legal" | "technology" | "team";
  likelihood: number;    // 1-5
  impact: number;        // 1-5
  riskScore: number;     // likelihood * impact
  status: "open" | "mitigating" | "accepted" | "closed";
  mitigation: string;
  owner?: string;
  timeline?: string;
}

export interface RiskRegister {
  risks: RiskItem[];
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  topRisks: string[];
  mitigationBudget?: string;
  summary: string;
}

export interface PartnerOpportunityCandidate {
  name: string;
  type: "technology" | "distribution" | "strategic" | "content" | "referral";
  synergy: string;
  revenueImpact: string;
  approachStrategy: string;
  priority: "high" | "medium" | "low";
  contactSuggestion?: string;
}

export interface PartnershipOpportunities {
  partners: PartnerOpportunityCandidate[];
  partnershipStrategy: string;
  quickWins: string[];
  longTermPlays: string[];
  summary: string;
}

export interface FundingReadiness {
  overallScore: number;       // 0-100
  grade: string;              // A-F
  readinessLevel: string;     // "Seed Ready", "Series A Ready", etc.
  strengths: string[];
  gaps: { area: string; current: string; needed: string; action: string }[];
  suggestedRaise: string;
  valuationRange: string;
  investorTypes: string[];
  pitchReadiness: { section: string; score: number; feedback: string }[];
  nextSteps: string[];
  summary: string;
}

export interface MarketSizing {
  tam: { value: string; methodology: string; sources: string[] };
  sam: { value: string; methodology: string; filters: string[] };
  som: { value: string; methodology: string; assumptions: string[] };
  growthRate: string;
  marketTrends: string[];
  entryBarriers: string[];
  competitiveIntensity: string;
  summary: string;
}

export interface BusinessScenario {
  name: string;
  description: string;
  probability: string;
  revenueImpact: string;
  costImpact: string;
  netOutcome: string;
  triggers: string[];
  actions: string[];
  timeline: string;
}

export interface ScenarioPlanner {
  scenarios: BusinessScenario[];
  baseCase: string;
  bestCase: string;
  worstCase: string;
  recommendedStrategy: string;
  contingencyPlans: string[];
  summary: string;
}


export interface CLVSegment {
  segment: string;
  avgCLV: string;
  acquisitionCost: string;
  clvCacRatio: number;
  retentionRate: string;
  avgLifespan: string;
  revenueContribution: string;
}

export interface CLVAnalysis {
  overallCLV: string;
  overallCACRatio: number;
  segments: CLVSegment[];
  highValueDrivers: string[];
  churnRiskFactors: string[];
  optimizationStrategies: string[];
  projectedImpact: string;
  summary: string;
}

// ── Wave 5 Types ─────────────────────────────────────────────────────────────

export interface RetentionStrategy {
  segment: string;
  engagementScore: number;     // 0-100
  churnRisk: "low" | "medium" | "high";
  triggers: string[];
  interventions: string[];
  expectedImpact: string;
  timeline: string;
}

export interface RetentionPlaybook {
  overallRetentionRate: string;
  strategies: RetentionStrategy[];
  quickWins: string[];
  longTermInitiatives: string[];
  engagementMetrics: { metric: string; current: string; target: string; gap: string }[];
  summary: string;
}

export interface AttributionChannel {
  channel: string;
  contribution: number;        // percentage
  revenue: string;
  cost: string;
  roi: string;
  trend: "growing" | "stable" | "declining";
}

export interface RevenueAttribution {
  channels: AttributionChannel[];
  topPerformer: string;
  underperformer: string;
  recommendations: string[];
  attributionModel: string;
  summary: string;
}

export interface BoardDeck {
  period: string;
  highlights: string[];
  financialOverview: { metric: string; value: string; change: string; status: "up" | "down" | "flat" }[];
  keyMetrics: { name: string; value: string; target: string; status: "on_track" | "at_risk" | "behind" }[];
  strategicUpdates: string[];
  risksAndChallenges: string[];
  askAndNextSteps: string[];
  summary: string;
}

export interface MoatDimension {
  dimension: string;
  score: number;               // 0-10
  description: string;
  threats: string[];
  reinforcements: string[];
}

export interface CompetitiveMoat {
  overallMoatScore: number;    // 0-100
  moatType: string;            // "Network Effects", "Switching Costs", etc.
  dimensions: MoatDimension[];
  vulnerabilities: string[];
  recommendations: string[];
  competitorComparison: string;
  summary: string;
}

export interface GTMDimension {
  dimension: string;
  score: number;               // 0-10
  status: "strong" | "developing" | "weak";
  insights: string[];
  actions: string[];
}

export interface GTMScorecard {
  overallScore: number;        // 0-100
  grade: string;
  dimensions: GTMDimension[];
  topStrength: string;
  biggestGap: string;
  prioritizedActions: string[];
  summary: string;
}

export interface CashOptimization {
  currentBurnRate: string;
  optimizedBurnRate: string;
  potentialSavings: string;
  recommendations: { area: string; current: string; optimized: string; saving: string; effort: "low" | "medium" | "high"; priority: number }[];
  quickWins: string[];
  revenueAcceleration: string[];
  extendedRunway: string;
  summary: string;
}

export interface PitchDeckAnalysis {
  fileName: string;
  slideCount?: number;
  overallScore: number;          // 0-100
  overallGrade: string;          // A-F
  headline: string;              // One-line verdict
  extractedContent: {
    problemStatement?: string;
    solution?: string;
    marketOpportunity?: string;
    businessModel?: string;
    traction?: string;
    teamSummary?: string;
    fundingAsk?: string;
    useOfFunds?: string;
  };
  strengths: string[];
  weaknesses: string[];
  missingSlides: string[];       // e.g. "Team slide", "Financial projections"
  recommendations: {
    rank: number;
    area: string;
    current: string;
    suggested: string;
    rationale: string;
  }[];
  suggestedInfographics: {
    slide: string;               // which slide
    type: string;                // "bar chart", "timeline", "process flow", etc.
    description: string;
  }[];
  positioningAdvice: string;     // overall positioning guidance
  generatedDeckJobId?: string;   // 2slides job ID if a deck was generated
  generatedDeckUrl?: string;     // download URL from 2slides
}

export interface ActionPlan {
  days: {
    day: number;
    title: string;
    tasks: { description: string; owner: string; status: "pending" | "completed" }[];
  }[];
  summary: string;
}

export interface HealthScore {
  score: number;
  grade?: string;
  headline?: string;
  interpretation?: string;
  dimensions: {
    name: string;
    score: number;
    driver?: string;
    grade?: string;
    summary?: string;
    keyFinding?: string;
  }[];
  summary?: string;
}

export interface CashIntelligence {
  currentCashPosition?: number;
  runwayWeeks?: number;
  criticalWeeks?: number[];
  summary: string;
  topRisks?: string[];
  weeklyProjections?: {
    week: number;
    label: string;
    openingBalance: number;
    inflows: number;
    outflows: number;
    closingBalance: number;
    riskFlag?: string;
    action?: string;
  }[];
  risks: { description: string; week?: number; impact?: string }[];
  recommendations: string[];
}

export interface RevenueLeakAnalysis {
  totalIdentified: number;
  totalRecoverable?: number;
  day90RecoveryProjection?: number;
  priorityAction?: string;
  items: {
    description: string;
    amount: number;
    recoveryPlan?: string;
    rank?: number;
    category?: string;
    clientOrArea?: string;
    annualImpact?: number;
    confidence?: string;
    rootCause?: string;
    recoveryAction?: string;
    timeline?: string;
  }[];
  summary: string;
}

export interface IssuesRegister {
  totalIssues?: number;
  criticalCount?: number;
  highCount?: number;
  totalFinancialExposure?: number;
  issues: {
    id: string;
    title?: string;
    description: string;
    severity: "HIGH" | "MED" | "LOW" | "Critical" | "High" | "Medium" | "Low";
    financialImpact?: number;
    category?: string;
    timeToImpact?: string;
    recommendedAction?: string;
    recommendation?: string;
    owner?: string;
  }[];
}

export interface AtRiskCustomers {
  totalRevenueAtRisk?: number;
  immediateAction?: string;
  customers: {
    name: string;
    risk: string;
    revenueAtRisk?: number;
    recommendation: string;
    riskScore?: number;
    churnProbability?: string;
    daysToLikelyChurn?: number;
    warningSignals?: string[];
    interventionActions?: string[];
    talkingPoints?: string;
  }[];
  summary?: string;
}

export interface DecisionBrief {
  decision: string;
  context: string;
  options: {
    label: string;
    outcome: string;
    recommendation?: boolean;
    pros?: string[];
    cons?: string[];
    expectedOutcome?: string;
  }[];
  recommendation: string;
  rationale?: string;
  nextStep?: string;
  deadlineSuggestion?: string;
}

export interface MarketIntelligence {
  industry: string;
  industryContext: string;
  searchPowered: boolean;
  benchmarks: {
    metric: string;
    industryRange: string;
    thisBusinessEstimate: string;
    gapAnalysis: string;
    implication: string;
  }[];
  lowHangingFruit: {
    rank: number;
    opportunity: string;
    effort: string;
    monthlyRevenuePotential: string;
    timeToFirstRevenue: string;
    whyThisBusiness: string;
    implementationSteps: string[];
  }[];
  pivotOpportunities: {
    rank: number;
    direction: string;
    whySuited: string;
    marketOpportunity: string;
    startupCost: string;
    timeToFirstRevenue: string;
    firstThreeSteps: string[];
    risk: string;
  }[];
  complementaryBusinesses: {
    rank: number;
    businessType: string;
    synergyWithExisting: string;
    setupEffort: string;
    incomePotential: string;
    howToStart: string;
  }[];
  quickWins: {
    rank: number;
    action: string;
    timeline: string;
    expectedCashImpact: string;
    instructions: string;
  }[];
  whatTopPerformersDo: string[];
  competitiveIntelligence: string;
  urgentOpportunity: string;
}

// Legacy — keep for backward compat with existing stored reports
export interface KnowledgeGraph {
  questionnaire: Questionnaire;
  documentCount: number;
  categories: Record<string, CategorizedDoc[]>;
  schemaCoverage: Record<string, boolean>;
  allDocuments: CategorizedDoc[];
}

export interface CategorizedDoc {
  filename: string;
  fileType: string;
  category: string;
  summary: string;
  keyPoints: string[];
  entities: {
    people: string[];
    amounts: string[];
    dates: string[];
    companies: string[];
  };
  rawTextExcerpt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 6: Talent, Revenue Diversification, Customer Journey, Compliance,
//          Expansion, Vendor Scorecard
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillGap {
  skill: string;
  currentLevel: "none" | "basic" | "intermediate" | "advanced";
  requiredLevel: "basic" | "intermediate" | "advanced" | "expert";
  priority: "critical" | "high" | "medium" | "low";
  recommendation: string;         // "Hire senior data engineer" or "Train existing team"
}

export interface RoleRecommendation {
  title: string;                  // "Senior Data Engineer"
  department: string;             // "Engineering"
  urgency: "immediate" | "next_quarter" | "next_year";
  rationale: string;
  estimatedSalaryRange: string;   // "$120K-$160K"
  impact: string;                 // "Unlocks real-time analytics pipeline"
}

export interface TalentGapAnalysis {
  summary: string;
  currentTeamStrengths: string[];
  skillGaps: SkillGap[];
  roleRecommendations: RoleRecommendation[];
  teamStructureNotes: string;     // org design suggestions
  trainingRecommendations: string[];
  totalHiringBudgetEstimate: string;
}

export interface RevenueStream {
  name: string;                   // "SaaS Subscriptions", "Consulting", "Marketplace"
  currentRevenue: string;
  revenueShare: number;           // percentage 0-100
  growthRate: string;
  risk: "high" | "medium" | "low";
  notes: string;
}

export interface DiversificationOpportunity {
  stream: string;                 // new revenue stream name
  estimatedRevenue: string;
  timeToRevenue: string;          // "3-6 months"
  investmentRequired: string;
  feasibility: "high" | "medium" | "low";
  rationale: string;
}

export interface RevenueDiversification {
  summary: string;
  concentrationRisk: "critical" | "high" | "moderate" | "low";
  concentrationDetails: string;
  currentStreams: RevenueStream[];
  diversificationOpportunities: DiversificationOpportunity[];
  recommendations: string[];
  targetMix: string;              // "Aim for no single stream >40% of revenue"
}


export interface ComplianceItem {
  requirement: string;            // "GDPR Data Processing Agreement"
  category: string;               // "Data Privacy", "Financial", "Employment", "Industry-Specific"
  status: "compliant" | "partial" | "non_compliant" | "unknown";
  priority: "critical" | "high" | "medium" | "low";
  deadline?: string;
  action: string;
  estimatedCost?: string;
}

export interface ComplianceChecklist {
  summary: string;
  overallReadiness: "strong" | "adequate" | "needs_work" | "at_risk";
  complianceScore: number;        // 0-100
  items: ComplianceItem[];
  immediateActions: string[];
  upcomingDeadlines: string[];
  industrySpecificNotes: string;
}

export interface ExpansionMarket {
  market: string;                 // "Southeast Asia", "Healthcare Vertical", "Enterprise Segment"
  type: "geographic" | "vertical" | "segment";
  attractiveness: number;         // 1-10
  readiness: number;              // 1-10
  estimatedRevenue: string;
  timeToEntry: string;
  keyBarriers: string[];
  entryStrategy: string;
}

export interface ExpansionPlaybook {
  summary: string;
  currentMarketPosition: string;
  expansionMarkets: ExpansionMarket[];
  prioritizedSequence: string[];  // ordered list of which markets to enter first
  resourceRequirements: string[];
  riskFactors: string[];
  timeline: string;               // "Phase 1: Q1-Q2, Phase 2: Q3-Q4"
}


// ─────────────────────────────────────────────────────────────────────────────
// Wave 7: Product-Market Fit, Brand Health, Pricing Elasticity,
//          Strategic Initiatives, Cash Conversion Cycle, Innovation Pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface PMFIndicator {
  indicator: string;              // "Retention Rate > 40%", "NPS > 40"
  status: "strong" | "moderate" | "weak";
  evidence: string;
  weight: number;                 // 0-1 weight in overall score
}

export interface ProductMarketFit {
  summary: string;
  overallScore: number;           // 0-100
  grade: "strong_fit" | "approaching_fit" | "weak_fit" | "no_fit";
  indicators: PMFIndicator[];
  keyStrengths: string[];
  keyGaps: string[];
  improvementActions: string[];
  seanEllisScore?: string;        // "X% would be very disappointed"
  targetSegmentFit: string;       // best-fit segment description
}

export interface BrandHealthDimension {
  dimension: string;              // "Awareness", "Perception", "Loyalty", "Differentiation"
  score: number;                  // 1-10
  insight: string;
  improvementAction: string;
}

export interface BrandHealth {
  summary: string;
  overallScore: number;           // 0-100
  brandStrength: "strong" | "developing" | "weak";
  dimensions: BrandHealthDimension[];
  brandPositioning: string;
  competitiveDifferentiators: string[];
  brandRisks: string[];
  recommendations: string[];
  messagingGuidelines: string[];
}

export interface PriceTier {
  name: string;                   // "Basic", "Pro", "Enterprise"
  currentPrice: string;
  suggestedPrice: string;
  elasticity: "inelastic" | "moderate" | "elastic";
  rationale: string;
  revenueImpact: string;
}

export interface PricingElasticity {
  summary: string;
  overallSensitivity: "low" | "moderate" | "high";
  priceTiers: PriceTier[];
  priceIncreaseCapacity: string;  // "Can increase 10-15% without churn"
  competitivePricePosition: string;
  psychologicalPricePoints: string[];
  bundlingOpportunities: string[];
  recommendations: string[];
}

export interface StrategicInitiative {
  name: string;
  description: string;
  status: "planning" | "in_progress" | "completed" | "on_hold" | "at_risk";
  priority: "critical" | "high" | "medium" | "low";
  owner: string;
  timeline: string;
  investmentRequired: string;
  expectedROI: string;
  risks: string[];
  milestones: string[];
}

export interface StrategicInitiatives {
  summary: string;
  initiatives: StrategicInitiative[];
  totalInvestment: string;
  expectedTotalROI: string;
  resourceConstraints: string[];
  recommendations: string[];
  prioritizationFramework: string;
}

export interface CashConversionMetric {
  metric: string;                 // "Days Sales Outstanding", "Days Payable Outstanding"
  currentValue: string;
  industryBenchmark: string;
  status: "good" | "average" | "needs_improvement";
  improvementAction: string;
}

export interface CashConversionCycle {
  summary: string;
  cycleDays: number;              // total cash conversion cycle in days
  industryAverage: number;
  metrics: CashConversionMetric[];
  workingCapitalEfficiency: string;
  improvementOpportunities: string[];
  cashFlowImpact: string;        // "Reducing cycle by 10 days frees $50K"
  recommendations: string[];
}


// ─────────────────────────────────────────────────────────────────────────────
// Wave 8: Stakeholder Map, Decision Log, Culture Assessment,
//          IP Portfolio, Exit Readiness, Sustainability Score
// ─────────────────────────────────────────────────────────────────────────────

export interface Stakeholder {
  name: string;
  role: string;
  influenceLevel: "high" | "medium" | "low";
  supportLevel: "champion" | "supporter" | "neutral" | "skeptic" | "blocker";
  interests: string[];
  communicationStyle: string;
  engagementStrategy: string;
}

export interface StakeholderMap {
  summary: string;
  stakeholders: Stakeholder[];
  powerDynamics: string;
  communicationPlan: string;
  keyRelationships: string[];
  risks: string[];
  recommendations: string[];
}

export interface Decision {
  title: string;
  description: string;
  category: string;                // "Strategic", "Financial", "Operational", "Product"
  status: "pending" | "made" | "deferred" | "reversed";
  urgency: "critical" | "high" | "medium" | "low";
  rationale: string;
  alternatives: string[];
  expectedOutcome: string;
  risks: string[];
  owner: string;
  deadline?: string;
}

export interface DecisionLog {
  summary: string;
  decisions: Decision[];
  decisionFramework: string;
  pendingCount: number;
  criticalDecisions: string[];
  recommendations: string[];
}

export interface CultureDimension {
  dimension: string;              // "Innovation", "Collaboration", "Accountability", "Agility"
  score: number;                  // 1-10
  description: string;
  strengths: string[];
  weaknesses: string[];
  improvementAction: string;
}

export interface CultureAssessment {
  summary: string;
  overallScore: number;           // 0-100
  cultureType: string;            // "Clan", "Adhocracy", "Market", "Hierarchy"
  dimensions: CultureDimension[];
  coreValues: string[];
  alignmentGaps: string[];
  retentionRisks: string[];
  recommendations: string[];
}


export interface ExitDimension {
  dimension: string;              // "Financial Performance", "Growth Trajectory", "Market Position"
  score: number;                  // 1-10
  status: "ready" | "needs_work" | "not_ready";
  gapToClose: string;
}

export interface ExitReadiness {
  summary: string;
  overallScore: number;           // 0-100
  exitTimeline: string;           // "12-18 months to be exit-ready"
  valuationRange: string;         // "$5M-$8M based on current metrics"
  dimensions: ExitDimension[];
  valuationDrivers: string[];
  valuationDetractors: string[];
  buyerProfiles: string[];
  preparationSteps: string[];
  recommendations: string[];
}

export interface ESGDimension {
  area: string;                   // "Environmental", "Social", "Governance"
  score: number;                  // 1-10
  initiatives: string[];
  gaps: string[];
  quickWins: string[];
}

export interface SustainabilityScore {
  summary: string;
  overallScore: number;           // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: ESGDimension[];
  materialIssues: string[];
  stakeholderExpectations: string[];
  regulatoryRequirements: string[];
  competitiveAdvantage: string;
  recommendations: string[];
}

// ── Wave 9 Types ─────────────────────────────────────────────────────────────

export interface AcquisitionTargetCandidate {
  companyName: string;
  industry: string;
  rationale: string;
  estimatedValue: string;
  synergies: string[];
  risks: string[];
  fitScore: number;               // 1-10
}

export interface AcquisitionTargets {
  summary: string;
  strategy: string;               // "horizontal", "vertical", "talent", "technology"
  targets: AcquisitionTargetCandidate[];
  budgetRange: string;
  timeline: string;
  dueDiligenceChecklist: string[];
  integrationPlan: string[];
  recommendations: string[];
}

export interface FinancialRatio {
  name: string;                   // "Current Ratio", "Debt-to-Equity", "Gross Margin"
  value: number;
  industryAvg: number;
  status: "above" | "at" | "below";
  interpretation: string;
}

export interface FinancialRatios {
  summary: string;
  overallHealth: "strong" | "moderate" | "weak";
  liquidityRatios: FinancialRatio[];
  profitabilityRatios: FinancialRatio[];
  leverageRatios: FinancialRatio[];
  efficiencyRatios: FinancialRatio[];
  trendInsights: string[];
  recommendations: string[];
}

export interface ChannelPerformance {
  channel: string;                // "Organic Search", "Paid Social", "Email", etc.
  attributedRevenue: string;
  costPerAcquisition: string;
  roi: string;
  contribution: number;           // percentage of total
  trend: "growing" | "stable" | "declining";
}

export interface ChannelMixModel {
  summary: string;
  channels: ChannelPerformance[];
  optimalBudgetAllocation: { channel: string; currentPct: number; recommendedPct: number }[];
  topPerformingChannel: string;
  underperformingChannels: string[];
  budgetRecommendation: string;
  seasonalInsights: string[];
  recommendations: string[];
}


export interface RegulatoryItem {
  regulation: string;
  jurisdiction: string;
  status: "compliant" | "partial" | "non_compliant" | "not_applicable";
  deadline: string;
  impact: "high" | "medium" | "low";
  actionRequired: string;
}

export interface RegulatoryLandscape {
  summary: string;
  overallComplianceScore: number; // 0-100
  currentRegulations: RegulatoryItem[];
  upcomingRegulations: RegulatoryItem[];
  industrySpecificRisks: string[];
  complianceCosts: string;
  recommendations: string[];
}

export interface CrisisScenario {
  scenario: string;               // "Key employee departure", "Data breach", "Cash crisis"
  probability: "high" | "medium" | "low";
  severity: "critical" | "major" | "moderate" | "minor";
  responseSteps: string[];
  communicationPlan: string;
  recoveryTimeline: string;
}

export interface CrisisPlaybook {
  summary: string;
  scenarios: CrisisScenario[];
  emergencyContacts: string[];
  communicationTemplates: string[];
  businessContinuityPlan: string[];
  insuranceRecommendations: string[];
  recommendations: string[];
}

// ── Wave 10 Types ────────────────────────────────────────────────────────────

export interface AICapability {
  area: string;                   // "Customer Service", "Operations", "Marketing", "Product"
  currentMaturity: "none" | "exploring" | "piloting" | "scaling" | "optimized";
  opportunity: string;
  estimatedImpact: string;
  implementationEffort: "low" | "medium" | "high";
  toolsRecommended: string[];
}

export interface AIReadiness {
  summary: string;
  overallScore: number;           // 0-100
  dataReadiness: number;          // 0-100
  teamReadiness: number;          // 0-100
  infrastructureReadiness: number; // 0-100
  capabilities: AICapability[];
  quickWins: string[];
  investmentRequired: string;
  roadmap: string[];
  recommendations: string[];
}

export interface NetworkEffectType {
  type: string;                   // "Direct", "Indirect", "Data", "Platform"
  strength: "strong" | "moderate" | "weak" | "none";
  description: string;
  growthMultiplier: string;
  defensibility: string;
}

export interface NetworkEffects {
  summary: string;
  overallScore: number;           // 0-100
  hasNetworkEffects: boolean;
  effectTypes: NetworkEffectType[];
  viralCoefficient: string;
  criticalMass: string;
  moatStrength: "strong" | "moderate" | "weak";
  growthStrategies: string[];
  recommendations: string[];
}

export interface DataAsset {
  asset: string;                  // "Customer behavior data", "Transaction history"
  monetizationMethod: string;     // "Analytics product", "API access", "Insights reports"
  estimatedValue: string;
  effortToMonetize: "low" | "medium" | "high";
  privacyConsiderations: string;
  timeToRevenue: string;
}

export interface DataMonetization {
  summary: string;
  totalOpportunityValue: string;
  dataAssets: DataAsset[];
  privacyCompliance: string;
  competitiveAdvantage: string;
  implementationRoadmap: string[];
  recommendations: string[];
}

export interface SaaSMetric {
  metric: string;                 // "MRR", "ARR", "CAC", "LTV", "Churn Rate"
  currentValue: string;
  benchmark: string;
  status: "excellent" | "good" | "needs_improvement" | "critical";
  trend: "improving" | "stable" | "declining";
  insight: string;
}

export interface SubscriptionMetrics {
  summary: string;
  overallHealth: "strong" | "moderate" | "weak";
  metrics: SaaSMetric[];
  cohortAnalysis: string;
  expansionRevenue: string;
  netRevenueRetention: string;
  paybackPeriod: string;
  recommendations: string[];
}

export interface TimingFactor {
  factor: string;                 // "Market maturity", "Competitor activity", "Regulatory"
  timing: "favorable" | "neutral" | "unfavorable";
  window: string;                 // "Next 6 months", "12-18 months"
  confidence: "high" | "medium" | "low";
  rationale: string;
}

export interface MarketTiming {
  summary: string;
  overallTiming: "excellent" | "good" | "fair" | "poor";
  factors: TimingFactor[];
  windowOfOpportunity: string;
  firstMoverAdvantage: string;
  marketCyclePosition: string;
  urgentActions: string[];
  recommendations: string[];
}

export interface StressScenario {
  name: string;                   // "Revenue -30%", "Key client loss", "Market downturn"
  description: string;
  revenueImpact: string;
  cashRunway: string;
  breakEvenShift: string;
  survivalProbability: number;    // 0-100
  mitigationActions: string[];
}

export interface ScenarioStressTest {
  summary: string;
  baselineCashRunway: string;
  scenarios: StressScenario[];
  worstCaseSurvival: string;
  resilience: "high" | "moderate" | "low";
  capitalBuffer: string;
  triggerPoints: string[];
  recommendations: string[];
}

// ── Wave 11 Types ─────────────────────────────────────────────────────────────

export interface PricingTierStrategy {
  tierName: string;
  priceRange: string;
  targetSegment: string;
  valueProposition: string;
  marginEstimate: string;
  competitorComparison: string;
}

export interface PricingStrategyMatrix {
  summary: string;
  currentStrategy: string;
  recommendedStrategy: string;
  tiers: PricingTierStrategy[];
  priceAnchor: string;
  psychologicalPricingTips: string[];
  bundlingOpportunities: string[];
  discountPolicy: string;
  recommendations: string[];
}


export interface RevenueWaterfallItem {
  category: string;              // "Beginning MRR", "New", "Expansion", "Contraction", "Churn", "Ending MRR"
  amount: string;
  percentage: string;
  trend: "positive" | "neutral" | "negative";
}

export interface RevenueWaterfall {
  summary: string;
  period: string;
  items: RevenueWaterfallItem[];
  netRevenueRetention: string;
  grossRevenueRetention: string;
  expansionRate: string;
  contractionRate: string;
  recommendations: string[];
}

export interface TechDebtItem {
  area: string;                  // "Architecture", "Dependencies", "Testing", "Security"
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  businessImpact: string;
  estimatedEffort: string;
  priority: number;              // 1-10
}

export interface TechDebtAssessment {
  summary: string;
  overallScore: number;          // 0-100 (higher = less debt)
  totalEstimatedCost: string;
  items: TechDebtItem[];
  quickWins: string[];
  longTermInvestments: string[];
  riskIfIgnored: string;
  recommendations: string[];
}

export interface TeamMetric {
  metric: string;                // "Productivity", "Collaboration", "Skill Coverage"
  score: number;                 // 0-100
  benchmark: string;
  insight: string;
}

export interface TeamPerformance {
  summary: string;
  overallScore: number;          // 0-100
  metrics: TeamMetric[];
  strengths: string[];
  gaps: string[];
  trainingNeeds: string[];
  cultureInsights: string[];
  recommendations: string[];
}

export interface MarketEntryOption {
  market: string;
  entryMode: string;             // "Direct", "Partnership", "Acquisition", "Franchise"
  marketSize: string;
  competitionLevel: "high" | "medium" | "low";
  investmentRequired: string;
  timeToRevenue: string;
  riskLevel: "high" | "medium" | "low";
  fitScore: number;              // 1-10
}

export interface MarketEntryStrategy {
  summary: string;
  readinessScore: number;        // 0-100
  markets: MarketEntryOption[];
  priorityMarket: string;
  goToMarketApproach: string;
  resourceRequirements: string[];
  barriers: string[];
  recommendations: string[];
}

// ── Wave 12 Types ────────────────────────────────────────────────────────────

export interface CompetitorSignal {
  competitor: string;
  signalType: string;            // "Product Launch", "Pricing Change", "Hiring", "Funding"
  description: string;
  impact: "high" | "medium" | "low";
  responseNeeded: string;
  urgency: "immediate" | "soon" | "monitor";
}

export interface CompetitiveIntelFeed {
  summary: string;
  signals: CompetitorSignal[];
  marketShiftIndicators: string[];
  opportunityWindows: string[];
  threatLevel: "high" | "moderate" | "low";
  recommendations: string[];
}

export interface SensitivityVariable {
  variable: string;              // "Revenue Growth", "COGS", "OpEx", "Headcount"
  currentValue: string;
  bestCase: string;
  worstCase: string;
  cashImpact: string;
  sensitivity: "high" | "medium" | "low";
}

export interface CashFlowSensitivity {
  summary: string;
  variables: SensitivityVariable[];
  mostSensitiveVariable: string;
  breakEvenSensitivity: string;
  safetyMargin: string;
  scenarioComparison: string;
  recommendations: string[];
}

export interface DigitalDimension {
  dimension: string;             // "Customer Experience", "Operations", "Technology", "Data & Analytics"
  maturity: "leading" | "advanced" | "intermediate" | "developing" | "nascent";
  score: number;                 // 0-100
  gaps: string[];
  nextSteps: string[];
}

export interface DigitalMaturity {
  summary: string;
  overallScore: number;          // 0-100
  dimensions: DigitalDimension[];
  industryComparison: string;
  transformationPriorities: string[];
  investmentAreas: string[];
  recommendations: string[];
}

export interface AcquisitionFunnelStage {
  stage: string;                 // "Awareness", "Interest", "Consideration", "Intent", "Purchase"
  volume: string;
  conversionRate: string;
  dropOffRate: string;
  avgTimeInStage: string;
  bottleneck: string;
}

export interface AcquisitionFunnel {
  summary: string;
  stages: AcquisitionFunnelStage[];
  overallConversionRate: string;
  biggestBottleneck: string;
  costPerAcquisition: string;
  channelBreakdown: { channel: string; contribution: string; cpa: string }[];
  recommendations: string[];
}

export interface AlignmentArea {
  area: string;                  // "Vision", "Goals", "Resources", "Execution"
  alignmentScore: number;        // 0-100
  gaps: string[];
  actions: string[];
}

export interface StrategicAlignment {
  summary: string;
  overallScore: number;          // 0-100
  areas: AlignmentArea[];
  missionVisionClarity: string;
  resourceAllocationFit: string;
  executionGaps: string[];
  recommendations: string[];
}

export interface BudgetCategory {
  category: string;              // "Marketing", "Engineering", "Sales", "Operations", "R&D"
  currentAllocation: string;
  recommendedAllocation: string;
  roi: string;
  efficiency: "optimal" | "over_allocated" | "under_allocated";
  reallocationSuggestion: string;
}

export interface BudgetOptimizer {
  summary: string;
  totalBudget: string;
  categories: BudgetCategory[];
  savingsOpportunity: string;
  roiImprovementPotential: string;
  topReallocation: string;
  wastageAreas: string[];
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 13: Revenue Intelligence & Optimization
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueDriver {
  driver: string;
  contribution: string;
  growth: string;
  trend: "accelerating" | "stable" | "decelerating";
  leverage: "high" | "medium" | "low";
  actionability: string;
}

export interface RevenueDrivers {
  summary: string;
  topDrivers: RevenueDriver[];
  primaryGrowthEngine: string;
  revenueConcentrationRisk: string;
  growthRate: string;
  organicVsPaid: string;
  seasonalityPattern: string;
  recommendations: string[];
}

export interface MarginItem {
  product: string;
  grossMargin: string;
  netMargin: string;
  costBreakdown: { category: string; amount: string; percentage: string }[];
  optimizationPotential: string;
}

export interface MarginOptimization {
  summary: string;
  overallGrossMargin: string;
  overallNetMargin: string;
  items: MarginItem[];
  biggestMarginDrain: string;
  quickWins: string[];
  totalOptimizationPotential: string;
  costStructureHealth: "healthy" | "needs_attention" | "critical";
  recommendations: string[];
}

export interface DemandSignal {
  signal: string;
  strength: "strong" | "moderate" | "weak";
  timeframe: string;
  confidence: number;
  dataSource: string;
}

export interface DemandForecasting {
  summary: string;
  shortTermForecast: string;
  mediumTermForecast: string;
  longTermForecast: string;
  signals: DemandSignal[];
  seasonalityIndex: string;
  trendDirection: "growing" | "stable" | "declining";
  peakPeriod: string;
  troughPeriod: string;
  recommendations: string[];
}

export interface Cohort {
  period: string;
  startingCustomers: number;
  retainedMonth1: string;
  retainedMonth3: string;
  retainedMonth6: string;
  retainedMonth12: string;
  revenueRetention: string;
  expansionRevenue: string;
}

export interface CohortAnalysis {
  summary: string;
  cohorts: Cohort[];
  bestCohort: string;
  worstCohort: string;
  averageRetention12Month: string;
  netRevenueRetention: string;
  churnTrend: "improving" | "stable" | "worsening";
  recommendations: string[];
}

export interface WinLossDeal {
  dealType: string;
  outcome: "won" | "lost";
  reason: string;
  competitor?: string;
  dealSize: string;
  salesCycle: string;
}

export interface WinLossAnalysis {
  summary: string;
  overallWinRate: string;
  deals: WinLossDeal[];
  topWinReasons: string[];
  topLossReasons: string[];
  competitiveLosses: { competitor: string; lossRate: string }[];
  averageSalesCycle: string;
  commonObjections: string[];
  recommendations: string[];
}

export interface ForecastQuarter {
  quarter: string;
  pipelineWeighted: string;
  bestCase: string;
  worstCase: string;
  confidence: number;
}

export interface SalesForecast {
  summary: string;
  forecastPeriod: string;
  quarters: ForecastQuarter[];
  totalForecast: string;
  quotaAttainment: string;
  dealStageConversion: { stage: string; conversionRate: string; avgDaysInStage: number }[];
  pipelineHealth: "strong" | "adequate" | "weak";
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 14: Operational Excellence
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessEfficiencyBottleneck {
  process: string;
  currentCycleTime: string;
  benchmarkCycleTime: string;
  bottleneck: string;
  automationPotential: "high" | "medium" | "low";
  estimatedSavings: string;
}

export interface ProcessEfficiency {
  summary: string;
  overallEfficiencyScore: number;
  processes: ProcessEfficiencyBottleneck[];
  topBottleneck: string;
  totalAutomationSavings: string;
  leanScore: number;
  wastageAreas: string[];
  recommendations: string[];
}

export interface VendorProfile {
  vendor: string;
  category: string;
  dependencyLevel: "critical" | "high" | "medium" | "low";
  concentrationRisk: string;
  slaCompliance: string;
  alternativeAvailable: boolean;
  contractExpiry: string;
}

export interface VendorRisk {
  summary: string;
  overallRiskScore: number;
  vendors: VendorProfile[];
  criticalDependencies: string[];
  singlePointsOfFailure: string[];
  diversificationScore: number;
  recommendations: string[];
}

export interface QualityIndicator {
  metric: string;
  current: string;
  benchmark: string;
  trend: "improving" | "stable" | "declining";
  impact: string;
}

export interface QualityMetrics {
  summary: string;
  overallQualityScore: number;
  csatScore: string;
  npsScore: string;
  indicators: QualityIndicator[];
  defectRate: string;
  resolutionTime: string;
  costOfQuality: string;
  recommendations: string[];
}


export interface KnowledgeGap {
  area: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  tribalKnowledgeHolder: string;
  documentationStatus: "none" | "partial" | "complete";
  impact: string;
}

export interface KnowledgeManagement {
  summary: string;
  overallMaturityScore: number;
  gaps: KnowledgeGap[];
  criticalRisks: string[];
  onboardingEfficiency: string;
  documentationCoverage: string;
  knowledgeSharingScore: number;
  recommendations: string[];
}

export interface ComplianceScorecardArea {
  regulation: string;
  status: "compliant" | "partial" | "non_compliant";
  riskExposure: string;
  gapDescription: string;
  remediationEffort: string;
  deadline?: string;
}

export interface ComplianceScorecard {
  summary: string;
  overallComplianceScore: number;
  areas: ComplianceScorecardArea[];
  auditReadiness: "ready" | "needs_work" | "not_ready";
  criticalGaps: string[];
  upcomingDeadlines: string[];
  riskExposure: string;
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 15: Growth & Market Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface PenetrationSegment {
  segment: string;
  totalAddressable: string;
  currentCapture: string;
  penetrationRate: string;
  growthOpportunity: string;
  strategy: string;
}

export interface MarketPenetration {
  summary: string;
  overallPenetrationRate: string;
  shareOfWallet: string;
  segments: PenetrationSegment[];
  untappedMarket: string;
  expansionPriority: string;
  competitiveGap: string;
  timeToFullPenetration: string;
  recommendations: string[];
}

export interface GrowthLoop {
  name: string;
  type: "viral" | "content" | "paid" | "product" | "sales";
  velocity: string;
  frictionPoints: string[];
  amplificationFactors: string[];
  impactScore: number;
}

export interface FlywheelAnalysis {
  summary: string;
  overallMomentum: number;
  loops: GrowthLoop[];
  primaryFlywheel: string;
  biggestFriction: string;
  biggestAmplifier: string;
  recommendations: string[];
}

export interface PartnerCandidate {
  name: string;
  partnerType: "technology" | "channel" | "strategic" | "distribution" | "co-marketing";
  revenueShareModel: string;
  integrationComplexity: "low" | "medium" | "high";
  estimatedImpact: string;
  synergy: string;
}

export interface PartnershipsStrategy {
  summary: string;
  overallPartnershipReadiness: number;
  partners: PartnerCandidate[];
  priorityPartnership: string;
  ecosystemStrategy: string;
  partnershipModels: string[];
  recommendations: string[];
}

export interface MarketOpportunity {
  country: string;
  region: string;
  marketSize: string;
  growthRate: string;
  attractivenessScore: number;
  regulatoryBarrier: "low" | "medium" | "high";
  localizationNeeds: string[];
  entryStrategy: string;
}

export interface InternationalExpansion {
  summary: string;
  expansionReadiness: number;
  markets: MarketOpportunity[];
  priorityMarket: string;
  totalAddressableMarket: string;
  regulatoryComplexity: string;
  recommendations: string[];
}

export interface RDProject {
  project: string;
  investment: string;
  roi: string;
  timeToValue: string;
  successProbability: string;
  stage: "research" | "development" | "testing" | "launched" | "retired";
  learnings: string;
}

export interface RDEffectiveness {
  summary: string;
  rdSpendAsPercentRevenue: string;
  overallROI: string;
  projects: RDProject[];
  successRate: string;
  averageTimeToValue: string;
  innovationVelocity: string;
  portfolioBalance: string;
  biggestWin: string;
  recommendations: string[];
}

export interface BrandDimension {
  dimension: string;       // "Awareness", "Perception", "Loyalty", "Advocacy"
  score: number;
  benchmark: number;
  strengths: string[];
  weaknesses: string[];
}

export interface BrandEquity {
  summary: string;
  overallBrandScore: number;
  estimatedBrandValue: string;
  dimensions: BrandDimension[];
  brandPromise: string;
  brandPersonality: string;
  competitivePositioning: string;
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 16: Financial Planning & Strategy
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkingCapitalMetric {
  metric: string;          // "DSO", "DPO", "DIO"
  current: string;
  benchmark: string;
  trend: "improving" | "stable" | "worsening";
  impact: string;
}

export interface WorkingCapital {
  summary: string;
  cashConversionCycleDays: number;
  metrics: WorkingCapitalMetric[];
  currentWorkingCapital: string;
  optimizedWorkingCapital: string;
  freeableCash: string;
  recommendations: string[];
}

export interface DebtInstrument {
  type: string;
  amount: string;
  interestRate: string;
  maturity: string;
  covenantStatus: "in_compliance" | "at_risk" | "breached";
  refinancingOpportunity: boolean;
}

export interface DebtStrategy {
  summary: string;
  totalDebt: string;
  debtToEquity: string;
  interestCoverage: string;
  instruments: DebtInstrument[];
  optimalStructure: string;
  debtCapacity: string;
  refinancingSavings: string;
  recommendations: string[];
}

export interface TaxOpportunity {
  strategy: string;
  estimatedSavings: string;
  complexity: "low" | "medium" | "high";
  timeline: string;
  requirements: string[];
}

export interface TaxStrategy {
  summary: string;
  effectiveTaxRate: string;
  optimizedTaxRate: string;
  opportunities: TaxOpportunity[];
  rdCredits: string;
  entityStructure: string;
  jurisdictionAnalysis: string;
  totalPotentialSavings: string;
  recommendations: string[];
}

export interface InvestorReadinessArea {
  area: string;
  score: number;
  gaps: string[];
  actions: string[];
}

export interface InvestorReadiness {
  summary: string;
  overallScore: number;
  areas: InvestorReadinessArea[];
  pitchDeckReadiness: string;
  metricsCompleteness: string;
  governanceScore: number;
  dueDiligencePrep: string;
  targetValuation: string;
  fundingStage: string;
  recommendations: string[];
}

export interface SynergyArea {
  area: string;
  type: "revenue" | "cost" | "strategic";
  estimatedValue: string;
  probability: string;
  timeline: string;
}

export interface MAReadiness {
  summary: string;
  overallReadiness: number;
  valuationMultiple: string;
  estimatedValuation: string;
  synergies: SynergyArea[];
  integrationComplexity: "low" | "medium" | "high";
  dealStructure: string;
  keyRisks: string[];
  recommendations: string[];
}

export interface StrategicMilestone {
  milestone: string;
  timeframe: string;        // "Q1 2025", "Year 2", etc.
  status: "on_track" | "at_risk" | "behind" | "not_started";
  dependencies: string[];
  kpis: string[];
}

export interface StrategicRoadmap {
  summary: string;
  vision: string;
  strategicPillars: string[];
  milestones: StrategicMilestone[];
  yearOneGoals: string[];
  yearThreeGoals: string[];
  yearFiveGoals: string[];
  okrs: { objective: string; keyResults: string[] }[];
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 17: Customer Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface VoiceTheme { theme: string; sentiment: "positive" | "negative" | "neutral"; frequency: string; impact: string; exampleQuotes: string[]; }
export interface CustomerVoice { summary: string; overallSentiment: string; themes: VoiceTheme[]; topFeatureRequests: string[]; satisfactionDrivers: string[]; dissatisfactionDrivers: string[]; npsAnalysis: string; recommendations: string[]; }

export interface ReferralMetric { channel: string; referrals: number; conversionRate: string; revenueGenerated: string; costPerReferral: string; }
export interface ReferralEngine { summary: string; viralCoefficient: string; referralRate: string; channels: ReferralMetric[]; topAdvocates: string[]; programEffectiveness: string; revenueFromReferrals: string; recommendations: string[]; }

export interface SensitivitySegment { segment: string; willingnessToPay: string; priceAnchor: string; sensitivity: "high" | "medium" | "low"; optimalPriceRange: string; }
export interface PriceSensitivityIndex { summary: string; overallSensitivity: string; segments: SensitivitySegment[]; priceFloor: string; priceCeiling: string; elasticityScore: number; recommendations: string[]; }

export interface TouchpointScore { touchpoint: string; effortScore: number; frictionLevel: "high" | "medium" | "low"; resolutionEase: string; improvement: string; }
export interface CustomerEffortScore { summary: string; overallCES: number; touchpoints: TouchpointScore[]; highestFriction: string; selfServiceRate: string; resolutionRate: string; recommendations: string[]; }

export interface ExpansionOpportunity { account: string; currentSpend: string; expansionPotential: string; trigger: string; product: string; probability: string; }
export interface AccountExpansionMap { summary: string; totalExpansionRevenue: string; opportunities: ExpansionOpportunity[]; topOpportunity: string; averageWalletShare: string; crossSellRate: string; upsellRate: string; recommendations: string[]; }

export interface LoyaltyTier { tier: string; criteria: string; benefits: string[]; memberCount: string; retention: string; }
export interface LoyaltyProgramDesign { summary: string; programType: string; tiers: LoyaltyTier[]; estimatedROI: string; implementationCost: string; rewardsStrategy: string; engagementMechanics: string[]; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 18: Market Dynamics
// ─────────────────────────────────────────────────────────────────────────────

export interface CompetitorPrice { competitor: string; product: string; price: string; positioning: string; differentiator: string; }
export interface CompetitivePricingMatrix { summary: string; competitorPrices: CompetitorPrice[]; pricePosition: string; premiumJustification: string; gapAnalysis: string; underCutRisk: string; recommendations: string[]; }

export interface SentimentDriver { factor: string; sentiment: "bullish" | "neutral" | "bearish"; weight: number; evidence: string; }
export interface MarketSentimentIndex { summary: string; overallSentiment: string; sentimentScore: number; drivers: SentimentDriver[]; investorConfidence: string; consumerConfidence: string; industryOutlook: string; recommendations: string[]; }

export interface DisruptionThreat { threat: string; category: "technology" | "regulatory" | "market_entrant" | "consumer_shift" | "economic"; probability: string; timeframe: string; impact: string; preparedness: string; }
export interface DisruptionRadar { summary: string; threatLevel: string; threats: DisruptionThreat[]; mostImminent: string; biggestImpact: string; preparednessScore: number; recommendations: string[]; }

export interface EcosystemPlayer { name: string; role: string; relationship: "partner" | "supplier" | "competitor" | "complementor" | "platform"; dependencyLevel: string; opportunity: string; }
export interface EcosystemMap { summary: string; ecosystemPosition: string; players: EcosystemPlayer[]; platformOpportunities: string[]; valueChainPosition: string; networkStrength: number; recommendations: string[]; }

export interface CategoryCreation { summary: string; categoryName: string; marketSize: string; positioningFramework: string; thoughtLeadershipPlan: string[]; narrativeAnchors: string[]; competitiveAdvantage: string; timeToEstablish: string; recommendations: string[]; }

export interface VelocityMetric { metric: string; currentRate: string; benchmark: string; acceleration: "accelerating" | "stable" | "decelerating"; driver: string; }
export interface MarketVelocity { summary: string; overallVelocity: string; metrics: VelocityMetric[]; accelerationFactors: string[]; decelerationRisks: string[]; marketGrowthRate: string; relativePosition: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 19: Execution Excellence
// ─────────────────────────────────────────────────────────────────────────────

export interface OKRTeam { team: string; objective: string; keyResults: string[]; alignmentScore: number; blockers: string[]; }
export interface OKRCascade { summary: string; companyObjectives: string[]; teams: OKRTeam[]; crossFunctionalDeps: string[]; alignmentScore: number; cascadeDepth: number; recommendations: string[]; }

export interface MeetingType { type: string; frequencyPerWeek: number; avgDuration: string; attendees: number; decisionRate: string; actionItemCompletion: string; effectiveness: "effective" | "needs_improvement" | "wasteful"; }
export interface MeetingEffectiveness { summary: string; totalMeetingHours: string; meetingTypes: MeetingType[]; decisionVelocity: string; actionItemTracker: string; wastefulMeetings: string; recommendations: string[]; }

export interface CommChannel { channel: string; usage: string; effectiveness: string; gaps: string[]; }
export interface CommunicationAudit { summary: string; overallHealth: number; channels: CommChannel[]; informationFlowScore: number; alignmentGaps: string[]; siloBridges: string[]; recommendations: string[]; }

export interface DecisionBottleneck { area: string; avgTimeToDecision: string; cause: string; impact: string; fix: string; }
export interface DecisionVelocity { summary: string; overallScore: number; avgTimeToDecision: string; bottlenecks: DecisionBottleneck[]; delegationEffectiveness: string; autonomyLevel: string; recommendations: string[]; }

export interface ResourceGap { resource: string; currentAllocation: string; optimalAllocation: string; gap: string; priority: string; }
export interface ResourceOptimizer { summary: string; overallEfficiency: number; gaps: ResourceGap[]; underutilized: string[]; overloaded: string[]; rebalancingPlan: string; recommendations: string[]; }

export interface ChangeInitiative { initiative: string; phase: "planning" | "execution" | "adoption" | "complete"; adoptionRate: string; resistanceLevel: string; champion: string; timeline: string; }
export interface ChangeManagement { summary: string; readinessScore: number; initiatives: ChangeInitiative[]; resistanceMap: string; adoptionStrategy: string; communicationPlan: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 20: Financial Mastery
// ─────────────────────────────────────────────────────────────────────────────

export interface ReserveScenario { scenario: string; requiredReserve: string; currentCoverage: string; gap: string; }
export interface CashReserveStrategy { summary: string; optimalReserve: string; currentReserve: string; reserveRatio: string; scenarios: ReserveScenario[]; investmentAllocation: string; contingencyPlan: string; recommendations: string[]; }

export interface RevenueQualityDimension { dimension: string; score: number; weight: number; trend: "improving" | "stable" | "declining"; evidence: string; }
export interface RevenueQualityScore { summary: string; overallScore: number; recurringRevenuePct: string; concentrationRisk: string; predictability: string; durability: string; dimensions: RevenueQualityDimension[]; recommendations: string[]; }

export interface CostCategory { category: string; currentSpend: string; benchmark: string; variance: string; savingsOpportunity: string; }
export interface CostIntelligence { summary: string; totalCosts: string; costCategories: CostCategory[]; topSavings: string; spendTrend: string; costPerRevenueDollar: string; benchmarkPosition: string; recommendations: string[]; }

export interface FinancialScenario { name: string; assumptions: string[]; projectedRevenue: string; projectedProfit: string; breakEvenPoint: string; probability: string; }
export interface FinancialModeling { summary: string; baseCase: FinancialScenario; scenarios: FinancialScenario[]; sensitivityVariables: string[]; breakEvenAnalysis: string; keyAssumptions: string[]; recommendations: string[]; }

export interface ProfitSegment { segment: string; revenue: string; costs: string; margin: string; contribution: string; trend: string; }
export interface ProfitabilityMap { summary: string; overallMargin: string; segments: ProfitSegment[]; mostProfitable: string; leastProfitable: string; crossSubsidies: string[]; recommendations: string[]; }

export interface InvestmentOption { option: string; amount: string; expectedROIC: string; paybackPeriod: string; riskLevel: string; strategicFit: string; }
export interface CapitalAllocation { summary: string; totalCapital: string; investments: InvestmentOption[]; roicTarget: string; currentROIC: string; allocationStrategy: string; rebalancingNeeds: string[]; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 21: Sales Excellence
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineStage { stage: string; deals: number; value: string; conversionRate: string; avgTimeInStage: string; }
export interface SalesPipelineHealth { summary: string; totalPipelineValue: string; weightedPipeline: string; stages: PipelineStage[]; coverage: string; velocity: string; atRiskDeals: string[]; recommendations: string[]; }

export interface DealStageMetric { stage: string; avgDays: number; conversionRate: string; bottleneck: boolean; }
export interface DealVelocity { summary: string; avgDealCycle: string; medianDealCycle: string; stages: DealStageMetric[]; fastestSegment: string; slowestSegment: string; dealSizeImpact: string; recommendations: string[]; }

export interface WinFactor { factor: string; impact: "high" | "medium" | "low"; winCorrelation: string; improvementArea: string; }
export interface WinRateOptimizer { summary: string; overallWinRate: string; winFactors: WinFactor[]; topLossReasons: string[]; competitiveWinRate: string; dealSizeWinRate: string; recommendations: string[]; }

export interface EnablementAsset { type: string; coverage: string; usage: string; effectiveness: string; gap: string; }
export interface SalesEnablement { summary: string; readinessScore: number; assets: EnablementAsset[]; trainingGaps: string[]; contentEffectiveness: string; toolAdoption: string; recommendations: string[]; }

export interface Territory { name: string; accounts: number; revenue: string; potential: string; coverage: string; rep: string; }
export interface TerritoryPlanning { summary: string; territories: Territory[]; balanceScore: number; untappedPotential: string; overlapIssues: string[]; recommendations: string[]; }

export interface QuotaSegment { segment: string; quota: string; attainment: string; coverage: string; rampTime: string; }
export interface QuotaIntelligence { summary: string; overallAttainment: string; segments: QuotaSegment[]; quotaToTerritoryFit: string; rampAnalysis: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 22: Product Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureCandidate { feature: string; impact: "high" | "medium" | "low"; effort: "high" | "medium" | "low"; revenueImpact: string; customerDemand: string; strategicFit: string; }
export interface FeaturePrioritization { summary: string; framework: string; features: FeatureCandidate[]; topPriority: string; quickWins: string[]; technicalDebt: string[]; recommendations: string[]; }

export interface UsageMetric { feature: string; adoption: string; frequency: string; retention: string; satisfaction: string; }
export interface ProductUsageAnalytics { summary: string; dau: string; mau: string; metrics: UsageMetric[]; stickyFeatures: string[]; underusedFeatures: string[]; churnCorrelation: string; recommendations: string[]; }

export interface TechComponent { name: string; category: string; cost: string; usage: string; alternatives: string; riskLevel: string; }
export interface TechStackAudit { summary: string; totalCost: string; components: TechComponent[]; redundancies: string[]; securityGaps: string[]; modernizationNeeds: string[]; recommendations: string[]; }

export interface ApiEndpoint { endpoint: string; usage: string; revenue: string; reliability: string; version: string; }
export interface ApiStrategy { summary: string; apiCount: number; endpoints: ApiEndpoint[]; monetizationModel: string; developerExperience: string; versioningStrategy: string; recommendations: string[]; }

export interface ScalabilityDimension { dimension: string; current: string; limit: string; headroom: string; bottleneck: string; }
export interface PlatformScalability { summary: string; overallScore: number; dimensions: ScalabilityDimension[]; currentLoad: string; peakCapacity: string; costPerUnit: string; recommendations: string[]; }

export interface OnboardingStep { step: string; completionRate: string; dropoffRate: string; avgTime: string; friction: string; }
export interface UserOnboarding { summary: string; completionRate: string; timeToValue: string; steps: OnboardingStep[]; activationMetric: string; biggestDropoff: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 23: People & Culture
// ─────────────────────────────────────────────────────────────────────────────

export interface EngagementDriver { driver: string; score: number; trend: "improving" | "stable" | "declining"; benchmark: string; }
export interface EmployeeEngagement { summary: string; overallScore: number; drivers: EngagementDriver[]; eNPS: string; turnoverRisk: string; topConcerns: string[]; recommendations: string[]; }

export interface FunnelStage { stage: string; candidates: number; conversionRate: string; avgDays: number; cost: string; }
export interface TalentAcquisitionFunnel { summary: string; overallTimeToHire: string; stages: FunnelStage[]; topSources: string[]; costPerHire: string; qualityOfHire: string; recommendations: string[]; }

export interface CompRole { role: string; currentComp: string; marketMedian: string; percentile: string; gap: string; }
export interface CompensationBenchmark { summary: string; overallPosition: string; roles: CompRole[]; totalCompBudget: string; equityStrategy: string; recommendations: string[]; }

export interface SuccessionCandidate { role: string; incumbent: string; readyNow: string[]; readyIn1Year: string[]; gap: string; }
export interface SuccessionPlanning { summary: string; criticalRoles: number; candidates: SuccessionCandidate[]; benchStrength: string; riskAreas: string[]; recommendations: string[]; }

export interface DiversityDimension { dimension: string; current: string; goal: string; industryBenchmark: string; trend: string; }
export interface DiversityMetrics { summary: string; overallScore: number; dimensions: DiversityDimension[]; inclusionIndex: string; payEquity: string; recommendations: string[]; }

export interface BrandSignal { channel: string; score: number; reach: string; sentiment: string; improvement: string; }
export interface EmployerBrand { summary: string; overallScore: number; signals: BrandSignal[]; glassdoorRating: string; offerAcceptRate: string; evp: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 24: Data & Analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface GovernanceArea { area: string; maturity: string; owner: string; compliance: string; risk: string; }
export interface DataGovernance { summary: string; maturityLevel: string; areas: GovernanceArea[]; policies: string[]; complianceGaps: string[]; dataLineage: string; recommendations: string[]; }

export interface MaturityDimension { dimension: string; currentLevel: number; targetLevel: number; gap: string; priority: string; }
export interface AnalyticsMaturity { summary: string; overallLevel: number; dimensions: MaturityDimension[]; toolStack: string[]; skillGaps: string[]; recommendations: string[]; }

export interface DataSource { source: string; type: string; records: string; freshness: string; quality: string; integrated: boolean; }
export interface CustomerDataPlatform { summary: string; unifiedProfiles: string; sources: DataSource[]; identityResolution: string; activationChannels: string[]; dataCompleteness: string; recommendations: string[]; }

export interface PredictiveModel { model: string; accuracy: string; useCase: string; dataRequirements: string; businessImpact: string; readiness: string; }
export interface PredictiveModeling { summary: string; models: PredictiveModel[]; dataReadiness: string; topOpportunity: string; implementationCost: string; expectedROI: string; recommendations: string[]; }

export interface ReportItem { report: string; audience: string; frequency: string; automated: boolean; actionability: string; }
export interface ReportingFramework { summary: string; reports: ReportItem[]; kpiCoverage: string; dashboardCount: number; selfServiceRate: string; dataLatency: string; recommendations: string[]; }

export interface QualityDimension { dimension: string; score: number; issues: string; impactedProcesses: string; remediation: string; }
export interface DataQualityScore { summary: string; overallScore: number; dimensions: QualityDimension[]; criticalIssues: string[]; automationLevel: string; costOfPoorQuality: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 25: Supply Chain & Operations
// ─────────────────────────────────────────────────────────────────────────────

export interface SupplyChainVulnerability { supplier: string; component: string; riskLevel: "critical" | "high" | "medium" | "low"; singleSource: boolean; geography: string; mitigationPlan: string; }
export interface SupplyChainRisk { summary: string; overallRiskScore: number; vulnerabilities: SupplyChainVulnerability[]; singleSourceDependencies: number; geographicConcentration: string; contingencyPlans: string[]; recommendations: string[]; }

export interface InventoryItem { category: string; turnoverRate: number; carryingCost: string; daysOnHand: number; reorderPoint: string; deadStockRisk: string; }
export interface InventoryOptimization { summary: string; totalCarryingCost: string; items: InventoryItem[]; deadStockValue: string; turnoverRatio: number; cashFreedUp: string; recommendations: string[]; }

export interface VendorRating { vendor: string; overallScore: number; deliveryReliability: string; qualityScore: number; costTrend: string; contractStatus: string; risk: string; }
export interface VendorScorecard { summary: string; totalVendors: number; vendors: VendorRating[]; topPerformer: string; atRiskVendors: string[]; consolidationOpportunities: string[]; recommendations: string[]; }

export interface ProcessBottleneck { process: string; cycleTime: string; throughput: string; utilization: string; bottleneck: string; improvement: string; }
export interface OperationalEfficiency { summary: string; overallScore: number; processes: ProcessBottleneck[]; totalWaste: string; automationOpportunities: string[]; quickWins: string[]; recommendations: string[]; }

export interface QualityMetric { area: string; defectRate: string; costOfQuality: string; trend: string; rootCause: string; improvement: string; }
export interface QualityManagement { summary: string; overallDefectRate: string; metrics: QualityMetric[]; costOfPoorQuality: string; sixSigmaLevel: string; continuousImprovements: string[]; recommendations: string[]; }

export interface CapacityResource { resource: string; currentUtilization: string; maxCapacity: string; headroom: string; scalingTrigger: string; investmentNeeded: string; }
export interface CapacityPlanning { summary: string; overallUtilization: string; resources: CapacityResource[]; growthHeadroom: string; nextBottleneck: string; scalingTimeline: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 26: Customer Experience & Journey
// ─────────────────────────────────────────────────────────────────────────────

export interface JourneyTouchpoint { stage: string; touchpoint: string; satisfaction: number; frictionLevel: string; momentOfTruth: boolean; optimization: string; }
export interface CustomerJourneyMap { summary: string; stages: JourneyTouchpoint[]; topFrictionPoints: string[]; momentsOfTruth: string[]; dropoffPoints: string[]; overallSatisfaction: number; recommendations: string[]; }

export interface NpsSegment { segment: string; score: number; respondents: number; trend: string; topDriver: string; }
export interface NpsAnalysis { summary: string; overallNps: number; segments: NpsSegment[]; promoterPercentage: string; detractorPercentage: string; topImprovementDrivers: string[]; recommendations: string[]; }

export interface TicketCategory { category: string; volume: number; avgResolutionTime: string; escalationRate: string; selfServiceable: boolean; trend: string; }
export interface SupportTicketIntelligence { summary: string; totalTickets: number; categories: TicketCategory[]; avgResolutionTime: string; firstContactResolution: string; selfServiceOpportunity: string; recommendations: string[]; }

export interface HealthIndicator { indicator: string; weight: number; score: number; signal: "positive" | "neutral" | "negative"; detail: string; }
export interface CustomerHealthScore { summary: string; overallScore: number; indicators: HealthIndicator[]; atRiskPercentage: string; expansionReadyPercentage: string; churnPrediction: string; recommendations: string[]; }

export interface VocTheme { theme: string; sentiment: "positive" | "negative" | "mixed"; frequency: number; impact: string; sampleQuote: string; }
export interface VoiceOfCustomer { summary: string; themes: VocTheme[]; topFeatureRequests: string[]; topComplaints: string[]; topPraise: string[]; sentimentTrend: string; recommendations: string[]; }

export interface CustomerSegment { segment: string; size: string; revenue: string; avgLifetimeValue: string; behavior: string; engagementLevel: string; strategy: string; }
export interface CustomerSegmentation { summary: string; segments: CustomerSegment[]; highValuePercentage: string; growthSegment: string; atRiskSegment: string; personalizationOpportunities: string[]; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 27: Innovation & IP
// ─────────────────────────────────────────────────────────────────────────────

export interface InnovationIdea { idea: string; stage: "ideation" | "validation" | "development" | "launch"; potential: string; timeToMarket: string; investmentNeeded: string; status: string; }
export interface InnovationPipeline { summary: string; totalIdeas: number; ideas: InnovationIdea[]; killRate: string; avgTimeToMarket: string; innovationIndex: string; recommendations: string[]; }

export interface IpAsset { type: "patent" | "trademark" | "copyright" | "trade_secret"; name: string; status: string; jurisdiction: string; expiryDate: string; value: string; }
export interface IpPortfolio { summary: string; totalAssets: number; assets: IpAsset[]; protectionGaps: string[]; licensingOpportunities: string[]; competitiveIpLandscape: string; recommendations: string[]; }

export interface RdProject { project: string; investment: string; stage: string; successProbability: string; expectedReturn: string; timeline: string; }
export interface RdEfficiency { summary: string; totalSpend: string; projects: RdProject[]; spendToRevenueRatio: string; successRate: string; portfolioBalance: string; recommendations: string[]; }

export interface TechArea { technology: string; maturityLevel: string; adoptionPhase: string; migrationNeeded: boolean; techDebt: string; readiness: string; }
export interface TechnologyReadiness { summary: string; overallReadiness: number; areas: TechArea[]; migrationRoadmap: string[]; techDebtTotal: string; modernizationPriorities: string[]; recommendations: string[]; }

export interface Partnership { partner: string; type: string; valueExchange: string; strategicFit: number; revenue: string; status: string; }
export interface PartnershipEcosystem { summary: string; totalPartners: number; partnerships: Partnership[]; revenueFromPartners: string; strategicGaps: string[]; newOpportunities: string[]; recommendations: string[]; }

export interface AcquisitionTarget { target: string; rationale: string; estimatedValue: string; synergyPotential: string; integrationComplexity: string; fitScore: number; }
export interface MergersAcquisitions { summary: string; targets: AcquisitionTarget[]; totalSynergyPotential: string; topTarget: string; budgetRequired: string; timelineEstimate: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 28: Sustainability & Governance
// ─────────────────────────────────────────────────────────────────────────────

export interface EsgDimension { dimension: "environmental" | "social" | "governance"; score: number; benchmark: number; topIssue: string; improvement: string; }
export interface EsgScorecard { summary: string; overallScore: number; dimensions: EsgDimension[]; industryRank: string; reportingReadiness: string; materialIssues: string[]; recommendations: string[]; }

export interface EmissionSource { source: string; scope: "scope1" | "scope2" | "scope3"; annualEmissions: string; percentage: string; reductionPotential: string; }
export interface CarbonFootprint { summary: string; totalEmissions: string; sources: EmissionSource[]; reductionTarget: string; offsetCost: string; regulatoryRisk: string; recommendations: string[]; }

export interface ComplianceArea { area: string; status: "compliant" | "partial" | "non_compliant"; riskLevel: string; lastAudit: string; nextDeadline: string; gaps: string; }
export interface RegulatoryCompliance { summary: string; overallStatus: string; areas: ComplianceArea[]; upcomingRegulations: string[]; auditReadiness: string; fineExposure: string; recommendations: string[]; }

export interface CriticalFunction { function: string; rto: string; rpo: string; currentCapability: string; gap: string; priority: string; }
export interface BusinessContinuity { summary: string; overallReadiness: string; functions: CriticalFunction[]; disasterRecoveryPlan: string; testFrequency: string; singlePointsOfFailure: string[]; recommendations: string[]; }

export interface EthicalRisk { area: string; riskLevel: string; currentPolicy: string; gap: string; stakeholderImpact: string; mitigation: string; }
export interface EthicsFramework { summary: string; overallMaturity: string; risks: EthicalRisk[]; policyGaps: string[]; governanceStructure: string; trainingCoverage: string; recommendations: string[]; }

export interface ImpactMetric { area: string; metric: string; currentValue: string; target: string; socialROI: string; stakeholder: string; }
export interface SocialImpact { summary: string; overallScore: number; metrics: ImpactMetric[]; communityInvestment: string; volunteerHours: string; reportingFramework: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 29: Revenue Intelligence (new types only — others exist from earlier waves)
// ─────────────────────────────────────────────────────────────────────────────

export interface DealStage { stage: string; dealCount: number; totalValue: string; avgDaysInStage: number; conversionRate: string; dropoffReason: string; }
export interface DealPipeline { summary: string; totalPipelineValue: string; stages: DealStage[]; avgDealCycle: string; winRate: string; velocityTrend: string; recommendations: string[]; }

export interface ForecastPeriod { period: string; predicted: string; confidence: number; drivers: string[]; risks: string[]; }
export interface SalesForecasting { summary: string; forecastAccuracy: string; periods: ForecastPeriod[]; quotaAttainment: string; pipelineCoverage: string; upliftOpportunities: string[]; recommendations: string[]; }

export interface TargetAccount { account: string; tier: string; engagementScore: number; intent: string; champion: string; nextAction: string; }
export interface AccountBasedMarketing { summary: string; totalTargetAccounts: number; accounts: TargetAccount[]; avgEngagementScore: number; pipelineInfluenced: string; conversionRate: string; recommendations: string[]; }

export interface IncentivePlan { role: string; baseSplit: string; variableSplit: string; quota: string; onTargetEarnings: string; accelerators: string; }
export interface CommissionOptimization { summary: string; plans: IncentivePlan[]; totalCommissionSpend: string; revPerCommissionDollar: string; alignmentScore: number; topPerformerRetention: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 30: Product & Market Intelligence (new types only)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductUsageMetric { feature: string; dailyActive: string; weeklyActive: string; adoptionRate: string; satisfaction: string; trend: string; }
export interface ProductAnalytics { summary: string; metrics: ProductUsageMetric[]; topFeature: string; underusedFeatures: string[]; stickinessRatio: string; powerUserPercentage: string; recommendations: string[]; }

export interface CompetitorMove { competitor: string; move: string; impact: string; urgency: string; response: string; timeline: string; }
export interface CompetitiveResponse { summary: string; moves: CompetitorMove[]; threatLevel: string; defensiveActions: string[]; offensiveOpportunities: string[]; blindSpots: string[]; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 31: Financial Planning (new types only)
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialScenario { name: string; probability: string; revenue: string; costs: string; profit: string; cashPosition: string; keyAssumptions: string[]; }
export interface ScenarioPlanning { summary: string; scenarios: FinancialScenario[]; baseCase: string; bestCase: string; worstCase: string; criticalVariables: string[]; recommendations: string[]; }

export interface CapitalComponent { type: string; amount: string; cost: string; percentage: string; maturity: string; flexibility: string; }
export interface CapitalStructure { summary: string; components: CapitalComponent[]; wacc: string; debtToEquity: string; optimalStructure: string; refinancingOpportunities: string[]; recommendations: string[]; }

export interface ReadinessDimension { dimension: string; score: number; benchmark: number; gap: string; action: string; }
export interface FundraisingReadiness { summary: string; overallScore: number; dimensions: ReadinessDimension[]; suggestedRound: string; valuationRange: string; timeToReady: string; recommendations: string[]; }

export interface ExitOption { type: string; likelihood: string; valuationMultiple: string; timeline: string; requirements: string[]; risks: string; }
export interface ExitStrategy { summary: string; options: ExitOption[]; bestOption: string; currentValuation: string; targetValuation: string; gapToClose: string[]; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 32: People & Culture (new types only)
// ─────────────────────────────────────────────────────────────────────────────

export interface HiringNeed { role: string; priority: string; department: string; timeToFill: string; salaryRange: string; source: string; }
export interface TalentAcquisition { summary: string; openRoles: number; needs: HiringNeed[]; avgTimeToFill: string; costPerHire: string; topSourceChannel: string; recommendations: string[]; }

export interface DeiMetric { category: string; currentState: string; benchmark: string; trend: string; gap: string; initiative: string; }
export interface DiversityInclusion { summary: string; metrics: DeiMetric[]; overallScore: number; representationGaps: string[]; inclusionIndex: string; payEquity: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 33: Strategic Growth
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketEntry { market: string; strategy: string; investmentRequired: string; timeToBreakeven: string; riskLevel: string; competitors: string; keyBarrier: string; }
export interface MarketEntryPlaybook { summary: string; entries: MarketEntry[]; topOpportunity: string; totalInvestmentNeeded: string; sequencingStrategy: string; riskMitigation: string[]; recommendations: string[]; }

export interface ChannelPartner { partner: string; channel: string; revenueContribution: string; margin: string; performance: string; growthPotential: string; }
export interface PartnerChannelStrategy { summary: string; partners: ChannelPartner[]; channelMix: string; topChannel: string; underperformingChannels: string[]; newChannelOpportunities: string[]; recommendations: string[]; }

export interface IntegrationWorkstream { workstream: string; status: string; completion: string; blockers: string; owner: string; deadline: string; }
export interface AcquisitionIntegration { summary: string; workstreams: IntegrationWorkstream[]; synergyRealized: string; culturalAlignment: string; retentionRate: string; topRisk: string; recommendations: string[]; }

export interface ReadinessArea { area: string; score: number; requirement: string; currentState: string; gap: string; action: string; }
export interface InternationalReadiness { summary: string; overallScore: number; areas: ReadinessArea[]; topMarkets: string[]; regulatoryBarriers: string[]; localizationNeeds: string[]; recommendations: string[]; }

export interface RevenueStream { stream: string; revenue: string; margin: string; growth: string; scalability: string; moatStrength: string; }
export interface RevenueModelAnalysis { summary: string; streams: RevenueStream[]; primaryModel: string; recurringPercentage: string; diversificationScore: number; modelFit: string; recommendations: string[]; }

export interface Experiment { name: string; hypothesis: string; metric: string; status: string; result: string; nextStep: string; }
export interface GrowthExperiments { summary: string; experiments: Experiment[]; activeExperiments: number; winRate: string; topLearning: string; velocityScore: number; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 34: Customer Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface CacChannel { channel: string; spend: string; customers: number; cac: string; paybackPeriod: string; trend: string; }
export interface CustomerAcquisitionCost { summary: string; blendedCac: string; channels: CacChannel[]; cacToLtvRatio: string; topChannel: string; improvementPotential: string; recommendations: string[]; }

export interface LtvSegment { segment: string; avgLtv: string; retentionRate: string; expansionRevenue: string; costToServe: string; netLtv: string; }
export interface LifetimeValueOptimization { summary: string; overallLtv: string; segments: LtvSegment[]; topDriver: string; expansionOpportunity: string; costReduction: string; recommendations: string[]; }

export interface ChurnSignal { signal: string; strength: string; leadTime: string; affectedSegment: string; preventionAction: string; confidence: string; }
export interface ChurnPrediction { summary: string; predictedChurnRate: string; signals: ChurnSignal[]; highRiskAccounts: number; revenueAtRisk: string; interventionROI: string; recommendations: string[]; }

export interface RetentionCohortNRR { cohort: string; startingMrr: string; expansion: string; contraction: string; churn: string; netRetention: string; }
export interface NetRevenueRetention { summary: string; overallNrr: string; cohorts: RetentionCohortNRR[]; expansionRate: string; contractionRate: string; topExpansionDriver: string; recommendations: string[]; }

export interface AdvocateMetric { program: string; participants: number; referrals: string; revenue: string; satisfaction: string; nps: string; }
export interface CustomerAdvocacy { summary: string; programs: AdvocateMetric[]; totalAdvocates: number; referralRevenue: string; advocateNps: string; topProgram: string; recommendations: string[]; }

export interface FeedbackChannel { channel: string; volume: number; responseRate: string; avgResolutionTime: string; satisfaction: string; topTheme: string; }
export interface FeedbackLoop { summary: string; channels: FeedbackChannel[]; totalFeedback: number; actionRate: string; closedLoopPercentage: string; topInsight: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 35: Operational Excellence
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationOpportunity { process: string; currentTime: string; automatedTime: string; savingsPerYear: string; complexity: string; priority: string; }
export interface ProcessAutomation { summary: string; opportunities: AutomationOpportunity[]; totalSavings: string; quickWins: string[]; roiTimeline: string; techRequirements: string[]; recommendations: string[]; }

export interface CostArea { area: string; currentCost: string; benchmark: string; gap: string; savingsPotential: string; difficulty: string; }
export interface CostBenchmark { summary: string; areas: CostArea[]; totalOverspend: string; topSavingsArea: string; industryPosition: string; quickSavings: string[]; recommendations: string[]; }

export interface NegotiationItem { vendor: string; currentTerms: string; targetTerms: string; leverage: string; savingsPotential: string; strategy: string; }
export interface VendorNegotiation { summary: string; items: NegotiationItem[]; totalSavings: string; topPriority: string; timelineToSavings: string; riskFactors: string[]; recommendations: string[]; }

export interface ScalabilityDimension { dimension: string; currentCapacity: string; projectedNeed: string; headroom: string; bottleneck: string; investmentNeeded: string; }
export interface ScalabilityAssessment { summary: string; overallScore: number; dimensions: ScalabilityDimension[]; criticalBottleneck: string; scalingTimeline: string; totalInvestment: string; recommendations: string[]; }

export interface IncidentScenario { scenario: string; likelihood: string; impact: string; currentReadiness: string; gap: string; requiredAction: string; }
export interface IncidentReadiness { summary: string; overallReadiness: number; scenarios: IncidentScenario[]; responseTime: string; recoveryCapability: string; lastDrillDate: string; recommendations: string[]; }

export interface RiskArea { area: string; riskLevel: string; likelihood: string; impact: string; currentMitigation: string; residualRisk: string; }
export interface OperationalRisk { summary: string; overallRisk: string; areas: RiskArea[]; topRisk: string; mitigationBudget: string; insuranceCoverage: string; recommendations: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Wave 36: Data & AI Strategy
// ─────────────────────────────────────────────────────────────────────────────

export interface DataDomain { domain: string; maturity: string; quality: string; accessibility: string; owner: string; priority: string; }
export interface DataStrategy { summary: string; domains: DataDomain[]; overallMaturity: number; dataDebtLevel: string; governanceScore: string; topPriority: string; recommendations: string[]; }

export interface AiUseCase { useCase: string; businessImpact: string; feasibility: string; dataReadiness: string; estimatedROI: string; timeline: string; }
export interface AiUseCases { summary: string; useCases: AiUseCase[]; topOpportunity: string; totalEstimatedROI: string; readinessScore: number; barriers: string[]; recommendations: string[]; }

export interface AnalyticsMilestone { milestone: string; quarter: string; owner: string; dependencies: string; status: string; impact: string; }
export interface AnalyticsRoadmap { summary: string; milestones: AnalyticsMilestone[]; currentMaturity: number; targetMaturity: number; investmentNeeded: string; quickWins: string[]; recommendations: string[]; }

export interface PrivacyArea { area: string; compliance: string; regulation: string; gap: string; risk: string; action: string; }
export interface DataPrivacy { summary: string; areas: PrivacyArea[]; overallCompliance: string; regulations: string[]; consentRate: string; breachReadiness: string; recommendations: string[]; }

export interface MlOpsCapability { capability: string; maturity: string; tooling: string; gap: string; investment: string; priority: string; }
export interface MlOpsReadiness { summary: string; capabilities: MlOpsCapability[]; overallScore: number; modelsInProduction: number; deploymentFrequency: string; monitoringCoverage: string; recommendations: string[]; }

export interface TransformationPillar { pillar: string; currentState: string; targetState: string; progress: string; investment: string; timeline: string; }
export interface DigitalTransformation { summary: string; pillars: TransformationPillar[]; overallProgress: number; totalInvestment: string; biggestGap: string; changeReadiness: string; recommendations: string[]; }

// ── Wave 37: Revenue Operations ───────────────────────────────────────────────
export interface RevOpsMetric { metric: string; current: string; target: string; gap: string; owner: string; trend: string; }
export interface RevenueOps { summary: string; metrics: RevOpsMetric[]; overallAlignment: number; pipelineAccuracy: string; forecastBias: string; topGap: string; recommendations: string[]; }
export interface BillingItem { issue: string; revenue: string; frequency: string; rootCause: string; fix: string; priority: string; }
export interface BillingOptimization { summary: string; issues: BillingItem[]; totalLeakage: string; automationRate: string; errorRate: string; topFix: string; recommendations: string[]; }
export interface ContractInsight { contract: string; value: string; renewalDate: string; risk: string; opportunity: string; action: string; }
export interface ContractIntelligence { summary: string; contracts: ContractInsight[]; totalValue: string; renewalPipeline: string; atRiskRevenue: string; autoRenewalRate: string; recommendations: string[]; }
export interface CommissionPlan { role: string; structure: string; quota: string; attainment: string; effectiveness: string; cost: string; }
export interface CommissionTracking { summary: string; plans: CommissionPlan[]; totalCommissions: string; avgAttainment: string; costOfSales: string; topPerformer: string; recommendations: string[]; }
export interface RevenueRule { stream: string; recognitionMethod: string; deferredRevenue: string; compliance: string; risk: string; action: string; }
export interface RevenueRecognition { summary: string; rules: RevenueRule[]; deferredTotal: string; recognizedTotal: string; complianceScore: string; topRisk: string; recommendations: string[]; }
export interface SubHealthMetric { metric: string; value: string; benchmark: string; trend: string; segment: string; action: string; }
export interface SubscriptionHealth { summary: string; metrics: SubHealthMetric[]; overallScore: number; mrrGrowth: string; churnRate: string; expansionRate: string; recommendations: string[]; }

// ── Wave 38: Product Intelligence ─────────────────────────────────────────────
export interface ProductRoadmapEntry { feature: string; quarter: string; status: string; alignment: string; impact: string; risk: string; }
export interface ProductRoadmapHealth { summary: string; items: ProductRoadmapEntry[]; overallHealth: number; onTrackPercentage: string; topRisk: string; stakeholderAlignment: string; recommendations: string[]; }
export interface TechDebtEntry { area: string; severity: string; impact: string; effort: string; roi: string; priority: string; }
export interface TechDebtPrioritization { summary: string; items: TechDebtEntry[]; totalDebt: string; criticalItems: number; avgAge: string; velocityImpact: string; recommendations: string[]; }
export interface ReleaseMetric { metric: string; current: string; previous: string; trend: string; benchmark: string; action: string; }
export interface ReleaseVelocity { summary: string; metrics: ReleaseMetric[]; avgCycleTime: string; deployFrequency: string; changeFailRate: string; mttr: string; recommendations: string[]; }
export interface BugTrend { category: string; openCount: number; closedCount: number; trend: string; severity: string; avgResolutionTime: string; }
export interface BugTrendAnalysis { summary: string; trends: BugTrend[]; totalOpen: number; criticalBugs: number; resolutionRate: string; qualityTrend: string; recommendations: string[]; }
export interface ApiMetric { endpoint: string; latency: string; errorRate: string; throughput: string; availability: string; trend: string; }
export interface ApiPerformance { summary: string; endpoints: ApiMetric[]; overallAvailability: string; avgLatency: string; errorBudget: string; topBottleneck: string; recommendations: string[]; }
export interface UxDimension { dimension: string; score: number; benchmark: number; topIssue: string; improvement: string; impact: string; }
export interface UserExperienceScore { summary: string; dimensions: UxDimension[]; overallScore: number; nps: string; taskCompletionRate: string; topFriction: string; recommendations: string[]; }

// ── Wave 39: Workforce Planning ───────────────────────────────────────────────
export interface WorkforceSegment { segment: string; currentHeadcount: number; plannedHeadcount: number; gap: number; timeline: string; cost: string; }
export interface WorkforcePlanning { summary: string; segments: WorkforceSegment[]; totalGap: number; hiringBudget: string; attritionRate: string; timeToFill: string; recommendations: string[]; }
export interface SkillGapEntry { skill: string; currentLevel: string; requiredLevel: string; gap: string; affectedRoles: number; trainingOption: string; }
export interface SkillsGapAnalysis { summary: string; gaps: SkillGapEntry[]; criticalGaps: number; trainingBudget: string; topPriority: string; readinessScore: number; recommendations: string[]; }
export interface RemoteMetric { metric: string; remoteScore: string; officeScore: string; difference: string; trend: string; action: string; }
export interface RemoteWorkEffectiveness { summary: string; metrics: RemoteMetric[]; overallEffectiveness: number; collaborationScore: string; productivityIndex: string; employeeSatisfaction: string; recommendations: string[]; }
export interface VelocityMetric { team: string; velocity: string; capacity: string; utilization: string; trend: string; bottleneck: string; }
export interface TeamVelocity { summary: string; teams: VelocityMetric[]; avgVelocity: string; sprintCompletion: string; topBlocker: string; improvementRate: string; recommendations: string[]; }
export interface BurnoutIndicator { indicator: string; score: number; threshold: number; affectedTeams: string; trend: string; intervention: string; }
export interface BurnoutRisk { summary: string; indicators: BurnoutIndicator[]; overallRisk: number; highRiskTeams: number; avgWorkload: string; topCause: string; recommendations: string[]; }
export interface LearningProgram { program: string; participants: number; completionRate: string; impact: string; cost: string; roi: string; }
export interface LearningDevelopment { summary: string; programs: LearningProgram[]; totalInvestment: string; avgHoursPerEmployee: string; skillsImproved: number; topProgram: string; recommendations: string[]; }

// ── Wave 40: Compliance & Legal ───────────────────────────────────────────────
export interface RegulatoryItem { regulation: string; jurisdiction: string; complianceStatus: string; deadline: string; risk: string; action: string; }
export interface RegulatoryRisk { summary: string; items: RegulatoryItem[]; overallExposure: string; criticalDeadlines: number; fineRisk: string; preparednessScore: number; recommendations: string[]; }
export interface ContractRecord { contract: string; counterparty: string; value: string; status: string; renewalDate: string; risk: string; }
export interface ContractManagement { summary: string; contracts: ContractRecord[]; totalValue: string; expiringNext90: number; autoRenewalPercentage: string; topRisk: string; recommendations: string[]; }
export interface IpAssetEntry { asset: string; type: string; status: string; jurisdiction: string; expirationDate: string; value: string; }
export interface IpStrategy { summary: string; assets: IpAssetEntry[]; portfolioValue: string; pendingApplications: number; expiringProtections: number; competitiveAdvantage: string; recommendations: string[]; }
export interface LegalSpendItem { category: string; spend: string; budget: string; variance: string; trend: string; optimization: string; }
export interface LegalSpendAnalysis { summary: string; items: LegalSpendItem[]; totalSpend: string; budgetVariance: string; costPerMatter: string; topCategory: string; recommendations: string[]; }
export interface PolicyArea { area: string; status: string; lastReview: string; gapCount: number; risk: string; nextAction: string; }
export interface PolicyCompliance { summary: string; areas: PolicyArea[]; overallCompliance: string; policiesReviewed: number; gaps: number; topPriority: string; recommendations: string[]; }
export interface AuditArea { area: string; readiness: string; lastAudit: string; findings: number; resolvedFindings: number; risk: string; }
export interface AuditReadiness { summary: string; areas: AuditArea[]; overallReadiness: number; openFindings: number; criticalGaps: number; nextAuditDate: string; recommendations: string[]; }

// ── Wave 41: Sales Excellence ─────────────────────────────────────────────────
export interface MethodologyStage { stage: string; activities: string; tools: string; exitCriteria: string; avgDuration: string; conversionRate: string; }
export interface SalesMethodology { summary: string; stages: MethodologyStage[]; methodology: string; adoptionRate: string; avgDealCycle: string; winRate: string; recommendations: string[]; }
export interface PipelineStage { stage: string; deals: number; value: string; avgAge: string; conversionRate: string; velocity: string; }
export interface PipelineVelocity { summary: string; stages: PipelineStage[]; overallVelocity: string; avgDealSize: string; pipelineCoverage: string; forecastAccuracy: string; recommendations: string[]; }
export interface QualificationCriteria { criterion: string; weight: number; scoring: string; threshold: string; passRate: string; impact: string; }
export interface DealQualification { summary: string; criteria: QualificationCriteria[]; framework: string; qualificationRate: string; avgScore: number; topDisqualifier: string; recommendations: string[]; }
export interface CoachingArea { area: string; currentSkill: string; targetSkill: string; gap: string; method: string; timeline: string; }
export interface SalesCoaching { summary: string; areas: CoachingArea[]; teamAvgScore: number; topPerformerGap: string; coachingHours: string; impactOnQuota: string; recommendations: string[]; }
export interface AccountPlan { account: string; tier: string; revenue: string; whitespace: string; strategy: string; nextAction: string; }
export interface AccountPlanning { summary: string; plans: AccountPlan[]; totalWhitespace: string; topAccounts: number; penetrationRate: string; expansionPipeline: string; recommendations: string[]; }
export interface Battlecard { competitor: string; strengths: string; weaknesses: string; counterStrategy: string; winRate: string; keyDifferentiator: string; }
export interface CompetitiveBattlecards { summary: string; cards: Battlecard[]; totalCompetitors: number; overallWinRate: string; topThreat: string; bestCounter: string; recommendations: string[]; }

// ── Wave 42: Financial Intelligence ───────────────────────────────────────────
export interface BurnCategory { category: string; monthly: string; annual: string; trend: string; essential: boolean; optimizable: string; }
export interface CashBurnAnalysis { summary: string; categories: BurnCategory[]; monthlyBurn: string; runway: string; burnEfficiency: string; topBurnArea: string; recommendations: string[]; }
export interface RevenuePerDept { department: string; headcount: number; revenue: string; revenuePerHead: string; benchmark: string; gap: string; }
export interface RevenuePerEmployee { summary: string; departments: RevenuePerDept[]; overallRPE: string; industryBenchmark: string; topPerformer: string; improvementPotential: string; recommendations: string[]; }
export interface FinancialMetricBenchmark { metric: string; companyValue: string; industryMedian: string; topQuartile: string; percentile: string; action: string; }
export interface FinancialBenchmarking { summary: string; metrics: FinancialMetricBenchmark[]; overallPercentile: string; strongestMetric: string; weakestMetric: string; peerGroup: string; recommendations: string[]; }
export interface InvestmentItem { investment: string; amount: string; expectedReturn: string; timeline: string; risk: string; status: string; }
export interface InvestmentPortfolio { summary: string; investments: InvestmentItem[]; totalInvested: string; weightedReturn: string; riskProfile: string; topPerformer: string; recommendations: string[]; }
export interface CostCenter { center: string; allocated: string; actual: string; variance: string; driver: string; optimization: string; }
export interface CostAllocationModel { summary: string; centers: CostCenter[]; totalAllocated: string; unallocated: string; accuracyScore: string; topVariance: string; recommendations: string[]; }
export interface MarginLayer { layer: string; revenue: string; cost: string; margin: string; marginPercent: string; trend: string; }
export interface MarginWaterfall { summary: string; layers: MarginLayer[]; grossMargin: string; operatingMargin: string; netMargin: string; biggestLeakage: string; recommendations: string[]; }

// ── Wave 43: Customer Success ─────────────────────────────────────────────────
export interface OnboardingStep { step: string; completionRate: string; avgTime: string; dropoffRate: string; bottleneck: string; improvement: string; }
export interface CustomerOnboardingMetrics { summary: string; steps: OnboardingStep[]; overallCompletion: string; avgTimeToValue: string; activationRate: string; topDropoff: string; recommendations: string[]; }
export interface HealthDimension { dimension: string; weight: number; score: number; threshold: number; signal: string; action: string; }
export interface HealthScoreModel { summary: string; dimensions: HealthDimension[]; overallScore: number; healthyPercentage: string; atRiskPercentage: string; topPredictor: string; recommendations: string[]; }
export interface ExpansionOpportunity { account: string; opportunity: string; value: string; probability: string; trigger: string; playbook: string; }
export interface CsExpansionPlaybook { summary: string; opportunities: ExpansionOpportunity[]; totalPipeline: string; avgExpansionRate: string; topPlay: string; conversionRate: string; recommendations: string[]; }
export interface RenewalCohort { cohort: string; accounts: number; arr: string; renewalRate: string; risk: string; action: string; }
export interface RenewalForecasting { summary: string; cohorts: RenewalCohort[]; overallRenewalRate: string; atRiskArr: string; forecastAccuracy: string; topRisk: string; recommendations: string[]; }
export interface CsMetric { metric: string; current: string; target: string; trend: string; owner: string; action: string; }
export interface CsOperations { summary: string; metrics: CsMetric[]; teamEfficiency: string; caseloadPerCsm: string; responseTime: string; escalationRate: string; recommendations: string[]; }
export interface MilestoneEntry { milestone: string; segment: string; avgTimeToReach: string; completionRate: string; impact: string; blocker: string; }
export interface CustomerMilestones { summary: string; milestones: MilestoneEntry[]; avgMilestonesReached: number; topMilestone: string; biggestGap: string; correlationToRetention: string; recommendations: string[]; }

// ── Wave 44: Strategic Planning ───────────────────────────────────────────────
export interface OkrEntry { objective: string; keyResults: string; progress: string; owner: string; status: string; blockers: string; }
export interface OkrFramework { summary: string; okrs: OkrEntry[]; overallProgress: string; onTrackPercentage: string; topObjective: string; alignmentScore: number; recommendations: string[]; }
export interface StrategicPillar { pillar: string; description: string; initiatives: number; progress: string; investment: string; impact: string; }
export interface StrategicPillars { summary: string; pillars: StrategicPillar[]; totalInitiatives: number; overallProgress: string; topPillar: string; resourceAllocation: string; recommendations: string[]; }
export interface PositioningDimension { dimension: string; companyPosition: string; competitorAvg: string; gap: string; importance: string; action: string; }
export interface CompetitivePositioning { summary: string; dimensions: PositioningDimension[]; overallPosition: string; strongestDimension: string; weakestDimension: string; perceptionGap: string; recommendations: string[]; }
export interface MarketSegmentShare { segment: string; companyShare: string; leaderShare: string; gap: string; trend: string; opportunity: string; }
export interface MarketShareAnalysis { summary: string; segments: MarketSegmentShare[]; overallShare: string; samGrowth: string; shareGrowthRate: string; topOpportunity: string; recommendations: string[]; }
export interface GrowthCorridor { corridor: string; tam: string; currentPenetration: string; growthRate: string; competition: string; timeline: string; }
export interface GrowthCorridors { summary: string; corridors: GrowthCorridor[]; totalTam: string; topCorridor: string; avgGrowthRate: string; investmentRequired: string; recommendations: string[]; }
export interface CanvasElement { element: string; current: string; ideal: string; gap: string; evidence: string; action: string; }
export interface ValuePropCanvas { summary: string; elements: CanvasElement[]; overallFit: number; strongestElement: string; biggestGap: string; customerValidation: string; recommendations: string[]; }
