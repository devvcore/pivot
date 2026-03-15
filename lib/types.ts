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
  progress?: { completed: number; total: number; currentStep: string; startedAt: number };
  relevantSections?: string[];  // sections relevant to this business (from relevance engine)
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

export interface ClaimValidation {
  field: string;
  value: number;
  matchedFact: { label: string; value: number; sourceFile: string } | null;
  status: "verified" | "estimated" | "conflicting" | "unverifiable";
  divergencePct: number | null;
}

export interface SectionRelevance {
  key: string;
  score: number;       // 0-100
  depth: "full" | "summary" | "skip";
  reason: string;      // why this score
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
  integrationData?: IntegrationContext; // data from connected tools (Composio)
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration Context — data from connected tools (Slack, QuickBooks, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export interface IntegrationDataRecord {
  provider: string;
  recordType: string;
  data: any;
  syncedAt: string;
}

export interface IntegrationContext {
  records: IntegrationDataRecord[];
  providers: string[];          // list of connected providers with data
  lastSyncedAt: string | null;  // most recent sync timestamp
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
  // Wave 45: Market Intelligence
  competitiveMonitoring?: CompetitiveMonitoring;
  marketTrendRadar?: MarketTrendRadar;
  industryBenchmarkIndex?: IndustryBenchmarkIndex;
  customerIntelPlatform?: CustomerIntelPlatform;
  priceSensitivityModel?: PriceSensitivityModel;
  demandSignalAnalysis?: DemandSignalAnalysis;
  // Wave 46: Digital Transformation
  digitalMaturityIndex?: DigitalMaturityIndex;
  cloudMigrationReadiness?: CloudMigrationReadiness;
  automationRoi?: AutomationRoi;
  digitalWorkplace?: DigitalWorkplace;
  cybersecurityPosture?: CybersecurityPosture;
  techVendorConsolidation?: TechVendorConsolidation;
  // Wave 47: Revenue Acceleration
  revenueSourceMapping?: RevenueSourceMapping;
  channelMixOptimization?: ChannelMixOptimization;
  crossSellEngine?: CrossSellEngine;
  priceOptimizationModel?: PriceOptimizationModel;
  promotionEffectiveness?: PromotionEffectiveness;
  revenueHealthIndex?: RevenueHealthIndex;
  // Wave 48: Organizational Health
  organizationalNetwork?: OrganizationalNetwork;
  decisionEfficiency?: DecisionEfficiency;
  meetingEfficiency?: MeetingEfficiency;
  knowledgeCapital?: KnowledgeCapital;
  changeManagementScore?: ChangeManagementScore;
  cultureAlignment?: CultureAlignment;
  // Wave 49: Partnership & Ecosystem
  partnerPerformance?: PartnerPerformance;
  ecosystemMapping?: EcosystemMapping;
  allianceStrategy?: AllianceStrategy;
  channelPartnerHealth?: ChannelPartnerHealth;
  coSellingPipeline?: CoSellingPipeline;
  integrationMarketplace?: IntegrationMarketplace;
  // Wave 50: Brand & Reputation
  brandEquityIndex?: BrandEquityIndex;
  sentimentDashboard?: SentimentDashboard;
  mediaShareOfVoice?: MediaShareOfVoice;
  crisisCommsReadiness?: CrisisCommsReadiness;
  thoughtLeadership?: ThoughtLeadership;
  brandConsistency?: BrandConsistency;
  // Wave 51: Pricing & Monetization
  monetizationModel?: MonetizationModel;
  freeTrialConversion?: FreeTrialConversion;
  usageBasedPricing?: UsageBasedPricing;
  bundleOptimization?: BundleOptimization;
  discountDiscipline?: DiscountDiscipline;
  revenueLeakageDetection?: RevenueLeakageDetection;
  // Wave 52: Customer Education
  customerAcademy?: CustomerAcademy;
  contentEngagement?: ContentEngagement;
  communityHealth?: CommunityHealth;
  certificationProgram?: CertificationProgram;
  selfServiceAdoption?: SelfServiceAdoption;
  supportDeflection?: SupportDeflection;
  // Wave 53: Investor Relations
  investorDeck?: InvestorDeck;
  fundingTimeline?: FundingTimeline;
  valuationModel?: ValuationModel;
  capTableManagement?: CapTableManagement;
  investorCommunication?: InvestorCommunication;
  boardReporting?: BoardReporting;
  // Wave 54: Market Expansion
  geoExpansionStrategy?: GeoExpansionStrategy;
  localMarketEntry?: LocalMarketEntry;
  marketRegulations?: MarketRegulations;
  partnerLocalization?: PartnerLocalization;
  culturalAdaptation?: CulturalAdaptation;
  expansionRoi?: ExpansionRoi;
  // Wave 55: Product-Led Growth
  productLedMetrics?: ProductLedMetrics;
  activationFunnel?: ActivationFunnel;
  featureAdoption?: FeatureAdoption;
  virality?: Virality;
  productQualifiedLeads?: ProductQualifiedLeads;
  timeToValue?: TimeToValue;
  // Wave 56: AI & Automation Readiness
  aiReadinessScore?: AiReadinessScore;
  mlUseCasePriority?: MlUseCasePriority;
  dataInfrastructure?: DataInfrastructure;
  aiTalentGap?: AiTalentGap;
  ethicalAiFramework?: EthicalAiFramework;
  aiRoiProjection?: AiRoiProjection;
  // Wave 57: Customer Advocacy
  advocacyProgram?: AdvocacyProgram;
  referralMechanism?: ReferralMechanism;
  testimonialPipeline?: TestimonialPipeline;
  caseStudyFactory?: CaseStudyFactory;
  customerAdvisoryBoard?: CustomerAdvisoryBoard;
  npsActionPlan?: NpsActionPlan;
  // Wave 58: Operational Finance
  procurementEfficiency?: ProcurementEfficiency;
  expenseManagement?: ExpenseManagement;
  invoiceAutomation?: InvoiceAutomation;
  paymentOptimization?: PaymentOptimization;
  financialControls?: FinancialControls;
  treasuryManagement?: TreasuryManagement;
  // Wave 59: Growth Marketing
  demandGenEngine?: DemandGenEngine;
  contentMarketingRoi?: ContentMarketingRoi;
  seoStrategy?: SeoStrategy;
  paidMediaOptimization?: PaidMediaOptimization;
  eventRoi?: EventRoi;
  influencerStrategy?: InfluencerStrategy;
  // Wave 60: Platform Strategy
  platformEconomics?: PlatformEconomics;
  developerExperience?: DeveloperExperience;
  apiMonetization?: ApiMonetization;
  marketplaceStrategy?: MarketplaceStrategy;
  platformGovernance?: PlatformGovernance;
  platformNetworkDynamics?: PlatformNetworkDynamics;
  // Wave 61: Legal & Compliance Operations
  contractLifecycle?: ContractLifecycle;
  complianceAutomation?: ComplianceAutomation;
  legalRiskRegister?: LegalRiskRegister;
  intellectualPropertyAudit?: IntellectualPropertyAudit;
  regulatoryCalendar?: RegulatoryCalendar;
  privacyCompliance?: PrivacyCompliance;
  // Wave 62: Data Analytics
  dataWarehouseStrategy?: DataWarehouseStrategy;
  biDashboardDesign?: BiDashboardDesign;
  predictiveModelCatalog?: PredictiveModelCatalog;
  dataLineageMap?: DataLineageMap;
  metricsDictionary?: MetricsDictionary;
  analyticsGovernance?: AnalyticsGovernance;
  // Wave 63: Employee Experience
  employeeJourney?: EmployeeJourney;
  workplaceWellness?: WorkplaceWellness;
  learningPathways?: LearningPathways;
  performanceFramework?: PerformanceFramework;
  payEquityAnalysis?: PayEquityAnalysis;
  deiBenchmark?: DeiBenchmark;
  // Wave 64: Business Model Innovation
  businessModelCanvas?: BusinessModelCanvas;
  revenueModelDesign?: RevenueModelDesign;
  valueChainOptimization?: ValueChainOptimization;
  costStructureAnalysis?: CostStructureAnalysis;
  partnershipModel?: PartnershipModel;
  growthLeverAssessment?: GrowthLeverAssessment;
  // Wave 65: Vendor & Procurement
  vendorManagement?: VendorManagement;
  supplyChainVisibility?: SupplyChainVisibility;
  sustainableSourcing?: SustainableSourcing;
  facilityOptimization?: FacilityOptimization;
  fleetManagement?: FleetManagement;
  customerSuccess?: CustomerSuccess;
  // Wave 66: Crisis & Resilience
  crisisManagement?: CrisisManagement;
  operationalResilience?: OperationalResilience;
  stakeholderMapping?: StakeholderMapping;
  digitalPresence?: DigitalPresence;
  channelStrategy?: ChannelStrategy;
  accountManagement?: AccountManagement;
  // Wave 67: Fundraising & Governance
  fundraisingStrategy?: FundraisingStrategy;
  captableManagement?: CaptableManagement;
  exitPlanning?: ExitPlanning;
  boardGovernance?: BoardGovernance;
  recruitmentFunnel?: RecruitmentFunnel;
  employerBranding?: EmployerBranding;
  // Wave 68: Team & Operations
  teamTopology?: TeamTopology;
  onboardingOptimization?: OnboardingOptimization;
  meetingCulture?: MeetingCulture;
  documentManagement?: DocumentManagement;
  workflowAutomation?: WorkflowAutomation;
  qualityAssurance?: QualityAssurance;
  // Wave 69: Cybersecurity & Compliance
  incidentResponse?: IncidentResponse;
  accessControl?: AccessControl;
  auditTrail?: AuditTrail;
  penetrationTesting?: PenetrationTesting;
  securityAwareness?: SecurityAwareness;
  dataClassification?: DataClassification;
  // Wave 70: Technical Infrastructure
  apiDesign?: ApiDesign;
  microservicesArchitecture?: MicroservicesArchitecture;
  cloudOptimization?: CloudOptimization;
  devopsMaturity?: DevopsMaturity;
  systemMonitoring?: SystemMonitoring;
  codeQuality?: CodeQuality;
  // Wave 71: Customer Intelligence
  customerLifetimeValue?: CustomerLifetimeValue;
  sentimentAnalysis?: SentimentAnalysis;
  supportTicketAnalysis?: SupportTicketAnalysis;
  segmentProfitability?: SegmentProfitability;
  referralAnalytics?: ReferralAnalytics;
  customerHealthDashboard?: CustomerHealthDashboard;
  // Wave 72: Strategic Planning
  innovationPortfolio?: InnovationPortfolio;
  contingencyPlanning?: ContingencyPlanning;
  operatingRhythm?: OperatingRhythm;
  crossFunctionalSync?: CrossFunctionalSync;
  wardRoomStrategy?: WardRoomStrategy;
  revenueIntelligence?: RevenueIntelligence;
  // Wave 73: Market Research & Insights
  marketResearch?: MarketResearch;
  competitorTracking?: CompetitorTracking;
  industryTrends?: IndustryTrends;
  socialListening?: SocialListening;
  uxResearch?: UxResearch;
  webAnalytics?: WebAnalytics;
  // Wave 74: Digital Marketing
  emailMarketing?: EmailMarketing;
  conversionOptimization?: ConversionOptimization;
  abTestingFramework?: AbTestingFramework;
  marketingAttribution?: MarketingAttribution;
  contentCalendar?: ContentCalendar;
  socialMediaCalendar?: SocialMediaCalendar;
  // Wave 75: Financial Planning
  budgetPlanning?: BudgetPlanning;
  revenueForecasting?: RevenueForecasting;
  cashManagement?: CashManagement;
  creditManagement?: CreditManagement;
  debtStructure?: DebtStructure;
  financialReporting?: FinancialReporting;
  // Wave 76: Sustainability & ESG
  carbonReduction?: CarbonReduction;
  circularEconomy?: CircularEconomy;
  communityImpact?: CommunityImpact;
  waterManagement?: WaterManagement;
  wasteReduction?: WasteReduction;
  sustainableInnovation?: SustainableInnovation;
  // Wave 77: Talent & People Analytics
  talentPipeline?: TalentPipeline;
  leadershipDevelopment?: LeadershipDevelopment;
  successionReadiness?: SuccessionReadiness;
  compensationStrategy?: CompensationStrategy;
  workforceAnalytics?: WorkforceAnalytics;
  orgEffectiveness?: OrgEffectiveness;
  // Wave 78: Sales Operations
  salesMotionDesign?: SalesMotionDesign;
  dealAnalytics?: DealAnalytics;
  territoryOptimization?: TerritoryOptimization;
  salesCompensation?: SalesCompensation;
  revenuePrediction?: RevenuePrediction;
  accountPenetration?: AccountPenetration;
  // Wave 79: Product Excellence
  productVision?: ProductVision;
  featureRoadmap?: FeatureRoadmap;
  pmfAssessment?: PmfAssessment;
  userActivation?: UserActivation;
  productInsights?: ProductInsights;
  releaseStrategy?: ReleaseStrategy;
  // Wave 80: Brand & Identity
  brandPositionMap?: BrandPositionMap;
  brandValuation?: BrandValuation;
  brandHierarchy?: BrandHierarchy;
  reputationAnalysis?: ReputationAnalysis;
  messagingFramework?: MessagingFramework;
  visualBranding?: VisualBranding;
  // Wave 81: Strategic Growth Planning
  growthPlaybook?: GrowthPlaybook;
  revenueRunRate?: RevenueRunRate;
  breakEvenModel?: BreakEvenModel;
  operatingLeverageIndex?: OperatingLeverageIndex;
  grossMarginAnalysis?: GrossMarginAnalysis;
  fundingScenarioModel?: FundingScenarioModel;
  // Wave 82: Competitive Wargaming
  competitiveWargame?: CompetitiveWargame;
  marketDisruptionModel?: MarketDisruptionModel;
  firstMoverAnalysis?: FirstMoverAnalysis;
  defensibilityAudit?: DefensibilityAudit;
  pivotReadiness?: PivotReadiness;
  competitiveTimingModel?: CompetitiveTimingModel;
  // Wave 83: Customer Success Advanced
  customerMaturityModel?: CustomerMaturityModel;
  expansionSignals?: ExpansionSignals;
  adoptionScorecard?: AdoptionScorecard;
  stakeholderSentiment?: StakeholderSentiment;
  valueRealization?: ValueRealization;
  renewalPlaybook?: RenewalPlaybook;
  // Wave 84: Business Model Design
  businessModelInnovation?: BusinessModelInnovation;
  monetizationExperiment?: MonetizationExperiment;
  pricingArchitecture?: PricingArchitecture;
  revenueStreamMap?: RevenueStreamMap;
  costDriverAnalysis?: CostDriverAnalysis;
  valueCapture?: ValueCapture;
  // Wave 85: Revenue Operations
  revenueProcessMap?: RevenueProcessMap;
  billingHealthCheck?: BillingHealthCheck;
  quoteToCloseAnalysis?: QuoteToCloseAnalysis;
  revenueLeakDetector?: RevenueLeakDetector;
  forecastAccuracyModel?: ForecastAccuracyModel;
  dealDeskOptimization?: DealDeskOptimization;
  // Wave 86: Workforce Strategy
  talentMarketIntel?: TalentMarketIntel;
  employeeLifecycleMap?: EmployeeLifecycleMap;
  skillsInventory?: SkillsInventory;
  teamDynamicsAnalysis?: TeamDynamicsAnalysis;
  hybridWorkModel?: HybridWorkModel;
  compensationPhilosophy?: CompensationPhilosophy;
  // Wave 87: Data & Intelligence
  dataMaturityAssessment?: DataMaturityAssessment;
  insightsPrioritization?: InsightsPrioritization;
  experimentVelocity?: ExperimentVelocity;
  decisionIntelligence?: DecisionIntelligence;
  feedbackIntelligence?: FeedbackIntelligence;
  benchmarkingEngine?: BenchmarkingEngine;
  // Wave 88: Ecosystem & Partnerships
  partnerValueMap?: PartnerValueMap;
  coInnovationPipeline?: CoInnovationPipeline;
  ecosystemRevenue?: EcosystemRevenue;
  allianceScorecard?: AllianceScorecard;
  partnerEnablementPlan?: PartnerEnablementPlan;
  marketplaceReadiness?: MarketplaceReadiness;
  // Wave 89: Strategic Execution
  strategyExecution?: StrategyExecution;
  initiativeTracking?: InitiativeTracking;
  resourceAllocationModel?: ResourceAllocationModel;
  strategicBetting?: StrategicBetting;
  executionCadence?: ExecutionCadence;
  alignmentIndex?: AlignmentIndex;
  // Wave 90: Market Intelligence Advanced
  marketSignalRadar?: MarketSignalRadar;
  competitorMoveTracker?: CompetitorMoveTracker;
  customerVoiceAggregator?: CustomerVoiceAggregator;
  industryConvergenceMap?: IndustryConvergenceMap;
  emergingTechRadar?: EmergingTechRadar;
  regulatoryHorizon?: RegulatoryHorizon;
  // Wave 91: Financial Health Deep
  cashFlowForecaster?: CashFlowForecaster;
  profitDriverTree?: ProfitDriverTree;
  revenueQualityIndex?: RevenueQualityIndex;
  financialResilienceScore?: FinancialResilienceScore;
  workingCapitalOptimizer?: WorkingCapitalOptimizer;
  investmentReadinessGate?: InvestmentReadinessGate;
  // Wave 92: Customer Intelligence Platform
  customerDnaProfile?: CustomerDnaProfile;
  propensityModel?: PropensityModel;
  churnEarlyWarning?: ChurnEarlyWarning;
  customerEffortOptimizer?: CustomerEffortOptimizer;
  loyaltyDriver?: LoyaltyDriver;
  accountIntelligence?: AccountIntelligence;
  // Wave 93: Go-to-Market Execution
  gtmCalendar?: GtmCalendar;
  launchReadiness?: LaunchReadiness;
  messageTesting?: MessageTesting;
  salesCollateral?: SalesCollateral;
  demandGenPlan?: DemandGenPlan;
  channelActivation?: ChannelActivation;
  // Wave 94: Pricing Science
  priceElasticityModel?: PriceElasticityModel;
  dynamicPricingEngine?: DynamicPricingEngine;
  discountImpactAnalysis?: DiscountImpactAnalysis;
  bundleDesigner?: BundleDesigner;
  competitivePriceTracker?: CompetitivePriceTracker;
  pricingExperiment?: PricingExperiment;
  // Wave 95: Business Intelligence Hub
  kpiWatchlist?: KpiWatchlist;
  alertFramework?: AlertFramework;
  anomalyDetection?: AnomalyDetection;
  trendForecast?: TrendForecast;
  dashboardDesign?: DashboardDesign;
  insightsCatalog?: InsightsCatalog;
  // Wave 96: Innovation Management
  ideaPipeline?: IdeaPipeline;
  innovationScoring?: InnovationScoring;
  experimentBoard?: ExperimentBoard;
  patentAnalysis?: PatentAnalysis;
  disruptionPlaybook?: DisruptionPlaybook;
  futureProofing?: FutureProofing;
  // Wave 97: Customer Revenue Management
  revenueMixAnalysis?: RevenueMixAnalysis;
  accountGrowthPlan?: AccountGrowthPlan;
  contractOptimizer?: ContractOptimizer;
  usagePatternAnalysis?: UsagePatternAnalysis;
  churnRecoveryPlan?: ChurnRecoveryPlan;
  winbackProgram?: WinbackProgram;
  // Wave 98: Operational Automation
  automationAudit?: AutomationAudit;
  processDigitization?: ProcessDigitization;
  botDeploymentPlan?: BotDeploymentPlan;
  workflowBenchmark?: WorkflowBenchmark;
  handoffEfficiency?: HandoffEfficiency;
  toolConsolidation?: ToolConsolidation;
  // Wave 99: Strategic Communications
  crisisCommunication?: CrisisCommunication;
  internalComms?: InternalComms;
  investorNarrative?: InvestorNarrative;
  pressStrategy?: PressStrategy;
  thoughtLeadershipPlan?: ThoughtLeadershipPlan;
  brandStoryArc?: BrandStoryArc;
  // Wave 100: Business Mastery Score
  masteryDashboard?: MasteryDashboard;
  growthVelocityScore?: GrowthVelocityScore;
  operationalMaturity?: OperationalMaturity;
  leadershipReadiness?: LeadershipReadiness;
  marketDominanceIndex?: MarketDominanceIndex;
  futureReadiness?: FutureReadiness;
  // Wave 101: AI & Machine Learning Readiness
  aiAdoptionPotential?: AIAdoptionPotential;
  mlUseCaseIdentification?: MLUseCaseIdentification;
  dataInfrastructureGapAnalysis?: DataInfrastructureGapAnalysis;
  automationROIModeling?: AutomationROIModeling;
  aiTalentNeedsAssessment?: AITalentNeedsAssessment;
  ethicalAIFramework?: EthicalAIFramework;
  // Wave 102: Geographic Expansion Intelligence
  marketEntryScoring?: MarketEntryScoring;
  regulatoryLandscapeMapping?: RegulatoryLandscapeMapping;
  culturalAdaptationStrategy?: CulturalAdaptationStrategy;
  logisticsExpansionAnalysis?: LogisticsExpansionAnalysis;
  localPartnershipStrategy?: LocalPartnershipStrategy;
  internationalPricingOptimization?: InternationalPricingOptimization;
  // Wave 103: Customer Lifecycle Optimization
  acquisitionFunnelIntelligence?: AcquisitionFunnelIntelligence;
  onboardingEffectivenessScore?: OnboardingEffectivenessScore;
  engagementScoringModel?: EngagementScoringModel;
  expansionRevenueOpportunities?: ExpansionRevenueOpportunities;
  advocacyProgramDesign?: AdvocacyProgramDesign;
  lifetimeValueModeling?: LifetimeValueModeling;
  // Wave 104: Platform & API Economy
  apiMonetizationStrategy?: APIMonetizationStrategy;
  platformEcosystemHealth?: PlatformEcosystemHealth;
  developerExperienceOptimization?: DeveloperExperienceOptimization;
  integrationMarketplaceAnalytics?: IntegrationMarketplaceAnalytics;
  partnerEnablementProgram?: PartnerEnablementProgram;
  platformGovernanceFramework?: PlatformGovernanceFramework;
  // Wave 105: Predictive Analytics Suite
  demandForecastingEngine?: DemandForecastingEngine;
  predictiveMaintenanceModeling?: PredictiveMaintenanceModeling;
  churnPredictionModel?: ChurnPredictionModel;
  leadScoringAI?: LeadScoringAI;
  inventoryOptimizationAI?: InventoryOptimizationAI;
  revenuePredictionModeling?: RevenuePredictionModeling;
  // Wave 106: Organizational Design
  orgStructureAnalysis?: OrgStructureAnalysis;
  spanOfControlOptimization?: SpanOfControlOptimization;
  decisionRightsMapping?: DecisionRightsMapping;
  collaborationNetworkMapping?: CollaborationNetworkMapping;
  roleOptimizationAnalysis?: RoleOptimizationAnalysis;
  successionPlanningFramework?: SuccessionPlanningFramework;
  // Wave 107: Social Impact & ESG
  impactMeasurementDashboard?: ImpactMeasurementDashboard;
  esgReportingCompliance?: ESGReportingCompliance;
  stakeholderEngagementAnalytics?: StakeholderEngagementAnalytics;
  communityInvestmentStrategy?: CommunityInvestmentStrategy;
  diversityMetricsAnalytics?: DiversityMetricsAnalytics;
  greenOperationsOptimization?: GreenOperationsOptimization;
  // Wave 108: Knowledge Management
  knowledgeAuditAssessment?: KnowledgeAuditAssessment;
  expertiseMappingSystem?: ExpertiseMappingSystem;
  documentationStrategyFramework?: DocumentationStrategyFramework;
  learningPathwaysDesign?: LearningPathwaysDesign;
  institutionalMemoryProtection?: InstitutionalMemoryProtection;
  knowledgeTransferOptimization?: KnowledgeTransferOptimization;

  // Tools & Automation
  toolsAutomationPlan?: ToolsAutomationPlan;

  // Integration Insights (live data from connected tools)
  integrationInsights?: {
    connectedProviders: string[];
    communicationHealth?: number;
    lastSyncAt?: string;
    employeeRankings?: Array<{
      name: string;
      netValue: number;
      roi: number;
      performanceScore: number;
      riskLevel: string;
      recommendation: string;
    }>;
    topFindings?: string[];
    bottlenecks?: string[];
  };

  // Anti-hallucination & relevance metadata
  claimValidations?: ClaimValidation[];
  relevanceScores?: SectionRelevance[];
  selectedSections?: string[];
  // Progress tracking (embedded in deliverables for DB simplicity)
  _progress?: { completed: number; total: number; currentStep: string; startedAt: number };
}

export interface ToolRecommendation {
  name: string;
  url: string;
  favicon: string;
  category: string; // "CRM", "Email Outreach", "Automation", "Analytics", "Project Management", etc.
  description: string;
  monthlyCost: string; // "$29/mo", "Free", "$99/mo"
  annualCost?: string;
  timeSaved: string; // "10 hours/week", "20 hours/month"
  moneySaved: string; // "$2,000/month", "$500/month"
  priority: "critical" | "high" | "medium" | "nice-to-have";
  reason: string; // Why this specific tool is recommended based on their data
  alternatives?: string[]; // Alternative tool names
}

export interface ToolsAutomationPlan {
  summary: string;
  totalMonthlyCost: number;
  totalMonthlySavings: number;
  roiMonths: number; // How many months until tools pay for themselves
  tools: ToolRecommendation[];
  automationOpportunities: {
    process: string;
    currentTimeCost: string;
    automatedTimeCost: string;
    toolToUse: string;
    implementationEffort: string;
  }[];
  techStackGrade: string; // A-F
  digitalMaturityScore: number; // 0-100
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
    solution?: string;
    solutionSteps?: string[];
    expectedROI?: string;
    implementationCost?: string;
    implementationTimeline?: string;
    alternativeSolutions?: string[];
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

export interface RevModelStream { stream: string; revenue: string; margin: string; growth: string; scalability: string; moatStrength: string; }
export interface RevenueModelAnalysis { summary: string; streams: RevModelStream[]; primaryModel: string; recurringPercentage: string; diversificationScore: number; modelFit: string; recommendations: string[]; }

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

// ── Wave 45: Market Intelligence ──────────────────────────────────────────────
export interface CompetitorSignal { competitor: string; signalType: string; description: string; severity: string; source: string; actionRequired: string; }
export interface CompetitiveMonitoring { summary: string; signals: CompetitorSignal[]; totalSignals: number; criticalAlerts: number; topThreat: string; monitoringCadence: string; recommendations: string[]; }
export interface MarketTrend { trend: string; category: string; momentum: string; relevance: string; timeHorizon: string; implication: string; }
export interface MarketTrendRadar { summary: string; trends: MarketTrend[]; topTrend: string; emergingThemes: string[]; disruptionRisk: string; opportunityWindow: string; recommendations: string[]; }
export interface BenchmarkMetric { metric: string; companyValue: string; industryAvg: string; topQuartile: string; percentileRank: string; trend: string; }
export interface IndustryBenchmarkIndex { summary: string; metrics: BenchmarkMetric[]; overallPercentile: string; strongestMetric: string; weakestMetric: string; peerGroup: string; recommendations: string[]; }
export interface IntelSource { source: string; dataType: string; frequency: string; reliability: string; coverage: string; insight: string; }
export interface CustomerIntelPlatform { summary: string; sources: IntelSource[]; totalDataPoints: string; integrationLevel: string; topInsight: string; blindSpots: string[]; recommendations: string[]; }
export interface PriceSensitivitySegment { segment: string; elasticity: string; optimalRange: string; currentPrice: string; willingness: string; switchingCost: string; }
export interface PriceSensitivityModel { summary: string; segments: PriceSensitivitySegment[]; overallElasticity: string; priceFloor: string; priceCeiling: string; optimalPrice: string; recommendations: string[]; }
export interface DemandIndicator { signal: string; source: string; strength: string; trend: string; leadTime: string; confidence: string; }
export interface DemandSignalAnalysis { summary: string; signals: DemandIndicator[]; overallDemand: string; growthIndicator: string; seasonalPattern: string; forecastAccuracy: string; recommendations: string[]; }

// ── Wave 46: Digital Transformation ───────────────────────────────────────────
export interface MaturityPillar { pillar: string; currentLevel: number; targetLevel: number; gap: string; investment: string; timeline: string; }
export interface DigitalMaturityIndex { summary: string; pillars: MaturityPillar[]; overallScore: number; industryAvg: number; topGap: string; digitalReadiness: string; recommendations: string[]; }
export interface MigrationWorkload { workload: string; currentState: string; targetState: string; complexity: string; estimatedCost: string; timeline: string; }
export interface CloudMigrationReadiness { summary: string; workloads: MigrationWorkload[]; overallReadiness: string; totalCost: string; riskLevel: string; quickWins: string[]; recommendations: string[]; }
export interface AutomationOpportunity { process: string; currentEffort: string; automationPotential: string; estimatedSavings: string; implementationCost: string; roiTimeline: string; }
export interface AutomationRoi { summary: string; opportunities: AutomationOpportunity[]; totalSavings: string; totalInvestment: string; overallRoi: string; topOpportunity: string; recommendations: string[]; }
export interface WorkplaceCapability { capability: string; adoption: string; effectiveness: string; gap: string; userSatisfaction: string; improvement: string; }
export interface DigitalWorkplace { summary: string; capabilities: WorkplaceCapability[]; overallAdoption: string; productivityImpact: string; employeeSatisfaction: string; topGap: string; recommendations: string[]; }
export interface SecurityDomain { domain: string; maturityLevel: string; riskScore: number; controls: number; gaps: string; investment: string; }
export interface CybersecurityPosture { summary: string; domains: SecurityDomain[]; overallScore: number; criticalGaps: number; complianceStatus: string; incidentReadinessLevel: string; recommendations: string[]; }
export interface VendorContract { vendor: string; category: string; annualSpend: string; overlap: string; consolidationPotential: string; recommendation: string; }
export interface TechVendorConsolidation { summary: string; vendors: VendorContract[]; totalSpend: string; potentialSavings: string; redundantTools: number; consolidationPlan: string; recommendations: string[]; }

// ── Wave 47: Revenue Acceleration ─────────────────────────────────────────────
export interface RevenueSource { source: string; contribution: string; growth: string; margin: string; reliability: string; optimization: string; }
export interface RevenueSourceMapping { summary: string; sources: RevenueSource[]; topSource: string; fastestGrowing: string; concentrationRisk: string; diversificationScore: string; recommendations: string[]; }
export interface ChannelPerformance { channel: string; revenue: string; cost: string; roi: string; growth: string; saturation: string; }
export interface ChannelMixOptimization { summary: string; channels: ChannelPerformance[]; topChannel: string; underperforming: string; optimalMix: string; reallocationPotential: string; recommendations: string[]; }
export interface CrossSellOpportunity { product: string; targetSegment: string; probability: string; estimatedRevenue: string; effort: string; trigger: string; }
export interface CrossSellEngine { summary: string; opportunities: CrossSellOpportunity[]; totalPotential: string; topOpportunity: string; conversionRate: string; implementationPlan: string; recommendations: string[]; }
export interface PriceScenario { scenario: string; priceChange: string; volumeImpact: string; revenueImpact: string; marginImpact: string; risk: string; }
export interface PriceOptimizationModel { summary: string; scenarios: PriceScenario[]; currentMargin: string; optimalPrice: string; elasticity: string; competitivePosition: string; recommendations: string[]; }
export interface PromotionCampaign { campaign: string; type: string; cost: string; revenue: string; roi: string; incrementalLift: string; }
export interface PromotionEffectiveness { summary: string; campaigns: PromotionCampaign[]; totalSpend: string; avgRoi: string; topCampaign: string; wastedSpend: string; recommendations: string[]; }
export interface RevenueHealthMetric { metric: string; value: string; benchmark: string; trend: string; risk: string; action: string; }
export interface RevenueHealthIndex { summary: string; metrics: RevenueHealthMetric[]; overallScore: number; topRisk: string; growthTrajectory: string; qualityScore: string; recommendations: string[]; }

// ── Wave 48: Organizational Health ────────────────────────────────────────────
export interface NetworkNode { team: string; connections: number; centrality: string; collaboration: string; bottleneck: boolean; influence: string; }
export interface OrganizationalNetwork { summary: string; nodes: NetworkNode[]; overallConnectivity: string; siloRisk: string; keyConnectors: string[]; collaborationScore: number; recommendations: string[]; }
export interface DecisionArea { area: string; avgDecisionTime: string; stakeholders: number; bottleneck: string; impact: string; improvement: string; }
export interface DecisionEfficiency { summary: string; areas: DecisionArea[]; overallVelocity: string; slowestArea: string; delegationScore: string; dataUsage: string; recommendations: string[]; }
export interface MeetingCategory { category: string; hoursPerWeek: string; attendees: number; effectiveness: string; actionItemRate: string; recommendation: string; }
export interface MeetingEfficiency { summary: string; categories: MeetingCategory[]; totalHoursPerWeek: string; effectiveRate: string; reclaimableHours: string; topIssue: string; recommendations: string[]; }
export interface KnowledgeArea { area: string; documentation: string; accessibility: string; freshness: string; singlePointRisk: string; improvement: string; }
export interface KnowledgeCapital { summary: string; areas: KnowledgeArea[]; overallScore: number; criticalGaps: number; documentationCoverage: string; knowledgeSharingIndex: string; recommendations: string[]; }
export interface ChangeReadinessArea { area: string; readinessLevel: string; resistance: string; leadership: string; communication: string; training: string; }
export interface ChangeManagementScore { summary: string; areas: ChangeReadinessArea[]; overallReadiness: string; biggestBarrier: string; changeFatigue: string; successRate: string; recommendations: string[]; }
export interface CultureDimension { dimension: string; currentState: string; desiredState: string; gap: string; sentiment: string; initiative: string; }
export interface CultureAlignment { summary: string; dimensions: CultureDimension[]; overallAlignment: number; strongestDimension: string; biggestMisalignment: string; engagementCorrelation: string; recommendations: string[]; }

// ── Wave 49: Partnership & Ecosystem ──────────────────────────────────────────
export interface PartnerMetric { partner: string; type: string; revenue: string; growth: string; satisfaction: string; tier: string; }
export interface PartnerPerformance { summary: string; partners: PartnerMetric[]; totalPartnerRevenue: string; topPartner: string; avgSatisfaction: string; churnRisk: string; recommendations: string[]; }
export interface EcosystemEntity { player: string; role: string; relationship: string; value: string; dependency: string; opportunity: string; }
export interface EcosystemMapping { summary: string; players: EcosystemEntity[]; ecosystemSize: string; networkEffect: string; keyDependency: string; whitespace: string; recommendations: string[]; }
export interface AllianceOpportunity { partner: string; type: string; synergy: string; effort: string; expectedValue: string; timeline: string; }
export interface AllianceStrategy { summary: string; opportunities: AllianceOpportunity[]; topAlliance: string; totalSynergy: string; currentAlliances: number; successRate: string; recommendations: string[]; }
export interface ChannelPartner { partner: string; region: string; revenue: string; pipeline: string; certificationLevel: string; health: string; }
export interface ChannelPartnerHealth { summary: string; partners: ChannelPartner[]; totalChannelRevenue: string; avgHealth: string; topPerformer: string; atRiskPartners: number; recommendations: string[]; }
export interface CoSellDeal { deal: string; partner: string; value: string; stage: string; winProbability: string; closeDate: string; }
export interface CoSellingPipeline { summary: string; deals: CoSellDeal[]; totalPipeline: string; avgDealSize: string; winRate: string; topDeal: string; recommendations: string[]; }
export interface IntegrationEntry { integration: string; category: string; users: string; satisfaction: string; revenue: string; status: string; }
export interface IntegrationMarketplace { summary: string; integrations: IntegrationEntry[]; totalIntegrations: number; topCategory: string; revenueFromIntegrations: string; adoptionRate: string; recommendations: string[]; }

// ── Wave 50: Brand & Reputation ───────────────────────────────────────────────
export interface BrandDimension { dimension: string; score: number; benchmark: number; trend: string; driver: string; action: string; }
export interface BrandEquityIndex { summary: string; dimensions: BrandDimension[]; overallScore: number; industryRank: string; brandValue: string; awareness: string; recommendations: string[]; }
export interface SentimentChannel { channel: string; positivePct: string; negativePct: string; neutralPct: string; volume: string; trend: string; }
export interface SentimentDashboard { summary: string; channels: SentimentChannel[]; overallSentiment: string; netSentimentScore: number; topPositive: string; topNegative: string; recommendations: string[]; }
export interface MediaChannel { channel: string; shareOfVoice: string; mentions: number; reach: string; sentiment: string; trend: string; }
export interface MediaShareOfVoice { summary: string; channels: MediaChannel[]; overallShare: string; topChannel: string; competitorComparison: string; viralMoments: string; recommendations: string[]; }
export interface CrisisScenario { scenario: string; likelihood: string; impact: string; responseTime: string; preparedness: string; gap: string; }
export interface CrisisCommsReadiness { summary: string; scenarios: CrisisScenario[]; overallReadiness: string; weakestArea: string; spokespersonReady: boolean; playbook: string; recommendations: string[]; }
export interface ThoughtLeadershipTopic { topic: string; authority: string; contentVolume: string; engagement: string; competitorActivity: string; opportunity: string; }
export interface ThoughtLeadership { summary: string; topics: ThoughtLeadershipTopic[]; overallAuthority: string; topTopic: string; contentGaps: string[]; audienceGrowth: string; recommendations: string[]; }
export interface BrandTouchpoint { touchpoint: string; consistency: string; quality: string; alignment: string; audience: string; improvement: string; }
export interface BrandConsistency { summary: string; touchpoints: BrandTouchpoint[]; overallConsistency: number; strongestTouchpoint: string; weakestTouchpoint: string; guidelinesAdherence: string; recommendations: string[]; }

// ── Wave 51: Pricing & Monetization ───────────────────────────────────────────
export interface MonetizationStream { stream: string; model: string; revenue: string; margin: string; growth: string; maturity: string; }
export interface MonetizationModel { summary: string; streams: MonetizationStream[]; primaryModel: string; diversificationScore: string; ltv: string; revenuePerUser: string; recommendations: string[]; }
export interface TrialCohort { cohort: string; trialStarts: number; conversions: number; conversionRate: string; avgTimeToConvert: string; topFeature: string; }
export interface FreeTrialConversion { summary: string; cohorts: TrialCohort[]; overallConversion: string; avgTrialLength: string; topBarrier: string; activationRate: string; recommendations: string[]; }
export interface UsageTier { tier: string; usageRange: string; pricePerUnit: string; customers: number; revenue: string; margin: string; }
export interface UsageBasedPricing { summary: string; tiers: UsageTier[]; avgUsage: string; revenuePerUnit: string; overageRate: string; predictability: string; recommendations: string[]; }
export interface BundleOption { bundle: string; products: string; price: string; takeRate: string; margin: string; cannibalRisk: string; }
export interface BundleOptimization { summary: string; bundles: BundleOption[]; topBundle: string; avgBundleSize: string; uplift: string; cannibalRate: string; recommendations: string[]; }
export interface DiscountCategory { category: string; avgDiscount: string; frequency: string; revenueImpact: string; necessity: string; recommendation: string; }
export interface DiscountDiscipline { summary: string; categories: DiscountCategory[]; avgDiscountRate: string; totalLeakage: string; approvalCompliance: string; topAbuse: string; recommendations: string[]; }
export interface LeakageSource { source: string; amount: string; frequency: string; rootCause: string; detectability: string; fix: string; }
export interface RevenueLeakageDetection { summary: string; sources: LeakageSource[]; totalLeakage: string; topSource: string; detectionRate: string; recoveryPotential: string; recommendations: string[]; }

// ── Wave 52: Customer Education ───────────────────────────────────────────────
export interface AcademyCourse { course: string; enrollments: number; completionRate: string; satisfaction: string; impact: string; format: string; }
export interface CustomerAcademy { summary: string; courses: AcademyCourse[]; totalEnrollments: number; avgCompletion: string; topCourse: string; revenueImpact: string; recommendations: string[]; }
export interface ContentPiece { content: string; type: string; views: string; engagement: string; conversion: string; freshness: string; }
export interface ContentEngagement { summary: string; pieces: ContentPiece[]; totalViews: string; avgEngagement: string; topContent: string; contentGaps: string[]; recommendations: string[]; }
export interface CommunityMetric { metric: string; value: string; trend: string; benchmark: string; driver: string; action: string; }
export interface CommunityHealth { summary: string; metrics: CommunityMetric[]; totalMembers: string; activeRate: string; sentimentScore: string; topContributor: string; recommendations: string[]; }
export interface CertificationLevel { level: string; enrolled: number; certified: number; passRate: string; avgScore: string; revenueImpact: string; }
export interface CertificationProgram { summary: string; levels: CertificationLevel[]; totalCertified: number; overallPassRate: string; topLevel: string; renewalRate: string; recommendations: string[]; }
export interface SelfServiceChannel { channel: string; usage: string; resolutionRate: string; satisfaction: string; costPerInteraction: string; deflectionRate: string; }
export interface SelfServiceAdoption { summary: string; channels: SelfServiceChannel[]; overallAdoption: string; avgResolution: string; costSavings: string; topChannel: string; recommendations: string[]; }
export interface DeflectionCategory { category: string; totalTickets: string; deflected: string; deflectionRate: string; savings: string; topArticle: string; }
export interface SupportDeflection { summary: string; categories: DeflectionCategory[]; overallDeflection: string; totalSavings: string; topCategory: string; improvementArea: string; recommendations: string[]; }

// ── Wave 53: Investor Relations ───────────────────────────────────────────────
export interface DeckSection { section: string; status: string; strength: string; weakness: string; investorAppeal: string; improvement: string; }
export interface InvestorDeck { summary: string; sections: DeckSection[]; overallReadiness: string; strongestSection: string; weakestSection: string; narrativeScore: number; recommendations: string[]; }
export interface FundingMilestone { milestone: string; targetDate: string; status: string; amount: string; dependency: string; risk: string; }
export interface FundingTimeline { summary: string; milestones: FundingMilestone[]; nextRound: string; targetAmount: string; runway: string; readinessScore: number; recommendations: string[]; }
export interface ValuationDriver { driver: string; impact: string; currentValue: string; benchmark: string; improvement: string; confidence: string; }
export interface ValuationModel { summary: string; drivers: ValuationDriver[]; estimatedRange: string; methodology: string; multipleUsed: string; keyAssumption: string; recommendations: string[]; }
export interface StakeholderEntry { stakeholder: string; ownership: string; shareClass: string; votingRights: string; vestingStatus: string; notes: string; }
export interface CapTableManagement { summary: string; stakeholders: StakeholderEntry[]; totalShares: string; dilutionRisk: string; optionPoolRemaining: string; cleanlinessScore: number; recommendations: string[]; }
export interface InvestorUpdate { topic: string; frequency: string; format: string; engagement: string; effectiveness: string; improvement: string; }
export interface InvestorCommunication { summary: string; updates: InvestorUpdate[]; overallTransparency: string; responseTime: string; reportingCadence: string; investorSatisfaction: string; recommendations: string[]; }
export interface BoardMetric { metric: string; currentValue: string; target: string; status: string; trend: string; actionItem: string; }
export interface BoardReporting { summary: string; metrics: BoardMetric[]; reportingFrequency: string; dashboardReadiness: string; keyDecisionsPending: number; governanceScore: number; recommendations: string[]; }

// ── Wave 54: Market Expansion ─────────────────────────────────────────────────
export interface GeoMarketTarget { market: string; tam: string; competition: string; readiness: string; investmentRequired: string; timeline: string; }
export interface GeoExpansionStrategy { summary: string; markets: GeoMarketTarget[]; topMarket: string; totalTam: string; expansionMode: string; riskLevel: string; recommendations: string[]; }
export interface EntryBarrier { barrier: string; severity: string; mitigationStrategy: string; cost: string; timeline: string; precedent: string; }
export interface LocalMarketEntry { summary: string; barriers: EntryBarrier[]; entryMode: string; estimatedCost: string; breakEvenTimeline: string; localPartnerNeed: string; recommendations: string[]; }
export interface RegulationArea { area: string; requirement: string; complianceStatus: string; risk: string; cost: string; deadline: string; }
export interface MarketRegulations { summary: string; areas: RegulationArea[]; overallCompliance: string; criticalGaps: number; estimatedComplianceCost: string; highestRisk: string; recommendations: string[]; }
export interface LocalizationArea { area: string; currentState: string; targetState: string; effort: string; cost: string; priority: string; }
export interface PartnerLocalization { summary: string; areas: LocalizationArea[]; overallReadiness: string; topPriority: string; totalInvestment: string; timeToMarket: string; recommendations: string[]; }
export interface CulturalFactor { factor: string; homeMarket: string; targetMarket: string; gap: string; risk: string; adaptation: string; }
export interface CulturalAdaptation { summary: string; factors: CulturalFactor[]; overallReadiness: string; biggestGap: string; trainingNeed: string; adaptationTimeline: string; recommendations: string[]; }
export interface ExpansionCostLine { category: string; investment: string; expectedReturn: string; paybackPeriod: string; risk: string; confidence: string; }
export interface ExpansionRoi { summary: string; costs: ExpansionCostLine[]; totalInvestment: string; projectedRoi: string; breakEven: string; irr: string; recommendations: string[]; }

// ── Wave 55: Product-Led Growth ───────────────────────────────────────────────
export interface PlgMetric { metric: string; value: string; benchmark: string; trend: string; impact: string; action: string; }
export interface ProductLedMetrics { summary: string; metrics: PlgMetric[]; overallPlgScore: number; topMetric: string; biggestGap: string; growthRate: string; recommendations: string[]; }
export interface FunnelStage { stage: string; users: string; conversionRate: string; dropoffRate: string; avgTime: string; improvement: string; }
export interface ActivationFunnel { summary: string; stages: FunnelStage[]; overallConversion: string; biggestDropoff: string; activationRate: string; medianTimeToActivate: string; recommendations: string[]; }
export interface FeatureMetric { feature: string; adoption: string; frequency: string; satisfaction: string; retention: string; revenue: string; }
export interface FeatureAdoption { summary: string; features: FeatureMetric[]; overallAdoption: string; topFeature: string; underusedFeature: string; stickinessScore: number; recommendations: string[]; }
export interface ViralLoop { loop: string; kFactor: string; cycleTime: string; inviteRate: string; acceptRate: string; contribution: string; }
export interface Virality { summary: string; loops: ViralLoop[]; overallKFactor: string; viralCycleTime: string; organicGrowthRate: string; topLoop: string; recommendations: string[]; }
export interface PqlCriteria { criteria: string; weight: string; threshold: string; currentRate: string; conversionToSql: string; optimization: string; }
export interface ProductQualifiedLeads { summary: string; criteria: PqlCriteria[]; totalPqls: string; pqlToSqlRate: string; avgDealSize: string; topCriteria: string; recommendations: string[]; }
export interface ValueMilestone { milestone: string; timeToReach: string; usersReaching: string; impact: string; correlationToRetention: string; optimization: string; }
export interface TimeToValue { summary: string; milestones: ValueMilestone[]; medianTtv: string; topMilestone: string; biggestDelay: string; retentionCorrelation: string; recommendations: string[]; }

// ── Wave 56: AI & Automation Readiness ────────────────────────────────────────
export interface AiDimension { dimension: string; readinessLevel: number; gap: string; investment: string; priority: string; timeline: string; }
export interface AiReadinessScore { summary: string; dimensions: AiDimension[]; overallScore: number; topStrength: string; topGap: string; estimatedInvestment: string; recommendations: string[]; }
export interface MlUseCase { useCase: string; businessValue: string; feasibility: string; dataReadiness: string; estimatedRoi: string; priority: string; }
export interface MlUseCasePriority { summary: string; useCases: MlUseCase[]; topUseCase: string; totalEstimatedValue: string; avgFeasibility: string; quickWins: number; recommendations: string[]; }
export interface InfraComponent { component: string; currentState: string; targetState: string; gap: string; cost: string; urgency: string; }
export interface DataInfrastructure { summary: string; components: InfraComponent[]; overallReadiness: string; biggestGap: string; totalInvestment: string; modernizationScore: number; recommendations: string[]; }
export interface TalentNeed { role: string; current: number; needed: number; gap: number; urgency: string; hiringDifficulty: string; }
export interface AiTalentGap { summary: string; needs: TalentNeed[]; totalGap: number; criticalRoles: number; buildVsBuy: string; trainingPotential: string; recommendations: string[]; }
export interface EthicalPrinciple { principle: string; implementation: string; compliance: string; gap: string; risk: string; action: string; }
export interface EthicalAiFramework { summary: string; principles: EthicalPrinciple[]; overallMaturity: string; biggestRisk: string; auditFrequency: string; transparencyScore: number; recommendations: string[]; }
export interface AiProjection { scenario: string; investment: string; expectedReturn: string; timeline: string; risk: string; confidence: string; }
export interface AiRoiProjection { summary: string; projections: AiProjection[]; totalInvestment: string; expectedRoi: string; paybackPeriod: string; topScenario: string; recommendations: string[]; }

// ── Wave 57: Customer Advocacy ────────────────────────────────────────────────
export interface AdvocacyTier { tier: string; advocates: number; activity: string; impact: string; retention: string; program: string; }
export interface AdvocacyProgram { summary: string; tiers: AdvocacyTier[]; totalAdvocates: number; activeRate: string; revenueInfluenced: string; topTier: string; recommendations: string[]; }
export interface ReferralChannel { channel: string; referrals: string; conversionRate: string; revenue: string; cost: string; roi: string; }
export interface ReferralMechanism { summary: string; channels: ReferralChannel[]; totalReferrals: string; overallConversion: string; topChannel: string; viralCoefficient: string; recommendations: string[]; }
export interface TestimonialAsset { customer: string; type: string; topic: string; quality: string; usage: string; impact: string; }
export interface TestimonialPipeline { summary: string; assets: TestimonialAsset[]; totalTestimonials: number; pipelineHealth: string; conversionLift: string; topAsset: string; recommendations: string[]; }
export interface CaseStudyEntry { title: string; customer: string; industry: string; results: string; stage: string; usage: string; }
export interface CaseStudyFactory { summary: string; studies: CaseStudyEntry[]; totalStudies: number; productionRate: string; avgImpact: string; topStudy: string; recommendations: string[]; }
export interface AdvisoryMember { member: string; segment: string; tenure: string; engagement: string; feedback: string; value: string; }
export interface CustomerAdvisoryBoard { summary: string; members: AdvisoryMember[]; totalMembers: number; engagementRate: string; insightsGenerated: string; topInitiative: string; recommendations: string[]; }
export interface NpsAction { driver: string; segment: string; currentNps: string; target: string; action: string; timeline: string; }
export interface NpsActionPlan { summary: string; actions: NpsAction[]; overallNps: string; promoterRate: string; detractorRate: string; topPriority: string; recommendations: string[]; }

// ── Wave 58: Operational Finance ──────────────────────────────────────────────
export interface ProcurementArea { area: string; spend: string; savingsAchieved: string; cycleTime: string; compliance: string; improvement: string; }
export interface ProcurementEfficiency { summary: string; areas: ProcurementArea[]; totalSpend: string; totalSavings: string; avgCycleTime: string; complianceRate: string; recommendations: string[]; }
export interface ExpenseCategory { category: string; amount: string; budget: string; variance: string; trend: string; control: string; }
export interface ExpenseManagement { summary: string; categories: ExpenseCategory[]; totalExpenses: string; budgetVariance: string; topCategory: string; savingsOpportunity: string; recommendations: string[]; }
export interface InvoiceMetric { metric: string; value: string; benchmark: string; trend: string; impact: string; automation: string; }
export interface InvoiceAutomation { summary: string; metrics: InvoiceMetric[]; automationRate: string; avgProcessingTime: string; errorRate: string; costPerInvoice: string; recommendations: string[]; }
export interface PaymentStream { stream: string; volume: string; avgDays: string; earlyPayment: string; latePayment: string; optimization: string; }
export interface PaymentOptimization { summary: string; streams: PaymentStream[]; avgDaysToPay: string; cashImpact: string; earlyPayDiscount: string; latePayPenalty: string; recommendations: string[]; }
export interface ControlArea { area: string; effectiveness: string; riskLevel: string; compliance: string; lastAudit: string; gap: string; }
export interface FinancialControls { summary: string; areas: ControlArea[]; overallEffectiveness: string; criticalGaps: number; auditReadiness: string; fraudRisk: string; recommendations: string[]; }
export interface TreasuryFunction { function: string; balance: string; yield: string; risk: string; liquidity: string; optimization: string; }
export interface TreasuryManagement { summary: string; functions: TreasuryFunction[]; totalCash: string; netPosition: string; yieldOptimization: string; liquidityRatio: string; recommendations: string[]; }

// ── Wave 59: Growth Marketing ─────────────────────────────────────────────────
export interface DemandChannel { channel: string; leads: string; mqls: string; conversionRate: string; cpl: string; roi: string; }
export interface DemandGenEngine { summary: string; channels: DemandChannel[]; totalLeads: string; totalMqls: string; avgCpl: string; topChannel: string; recommendations: string[]; }
export interface ContentAsset { asset: string; type: string; traffic: string; leads: string; conversion: string; roi: string; }
export interface ContentMarketingRoi { summary: string; assets: ContentAsset[]; totalTraffic: string; totalLeads: string; overallRoi: string; topAsset: string; recommendations: string[]; }
export interface SeoMetric { metric: string; value: string; trend: string; competitor: string; opportunity: string; action: string; }
export interface SeoStrategy { summary: string; metrics: SeoMetric[]; organicTraffic: string; domainAuthority: string; topKeyword: string; technicalHealth: string; recommendations: string[]; }
export interface PaidChannel { channel: string; spend: string; impressions: string; clicks: string; conversions: string; roas: string; }
export interface PaidMediaOptimization { summary: string; channels: PaidChannel[]; totalSpend: string; overallRoas: string; topChannel: string; wastedSpend: string; recommendations: string[]; }
export interface EventEntry { event: string; type: string; cost: string; attendees: string; leads: string; roi: string; }
export interface EventRoi { summary: string; events: EventEntry[]; totalSpend: string; totalLeads: string; avgRoi: string; topEvent: string; recommendations: string[]; }
export interface InfluencerPartner { influencer: string; platform: string; reach: string; engagement: string; cost: string; roi: string; }
export interface InfluencerStrategy { summary: string; partners: InfluencerPartner[]; totalReach: string; avgEngagement: string; totalSpend: string; topInfluencer: string; recommendations: string[]; }

// ── Wave 60: Platform Strategy ────────────────────────────────────────────────
export interface PlatformMetric { metric: string; value: string; growth: string; benchmark: string; monetization: string; action: string; }
export interface PlatformEconomics { summary: string; metrics: PlatformMetric[]; gmv: string; takeRate: string; platformMargin: string; growthRate: string; recommendations: string[]; }
export interface DxDimension { dimension: string; score: number; satisfaction: string; benchmark: string; gap: string; improvement: string; }
export interface DeveloperExperience { summary: string; dimensions: DxDimension[]; overallScore: number; devCount: string; sdkAdoption: string; topIssue: string; recommendations: string[]; }
export interface ApiProduct { api: string; calls: string; revenue: string; growth: string; tier: string; margin: string; }
export interface ApiMonetization { summary: string; products: ApiProduct[]; totalRevenue: string; avgRevenuePerApi: string; topApi: string; pricingModel: string; recommendations: string[]; }
export interface MarketplaceMetric { metric: string; value: string; growth: string; benchmark: string; health: string; action: string; }
export interface MarketplaceStrategy { summary: string; metrics: MarketplaceMetric[]; totalListings: string; transactionVolume: string; sellerSatisfaction: string; buyerSatisfaction: string; recommendations: string[]; }
export interface GovernancePolicy { policy: string; scope: string; compliance: string; enforcement: string; impact: string; review: string; }
export interface PlatformGovernance { summary: string; policies: GovernancePolicy[]; overallCompliance: string; disputeRate: string; trustScore: number; topIssue: string; recommendations: string[]; }
export interface NetworkDynamic { dynamic: string; strength: string; growth: string; moat: string; vulnerability: string; enhancement: string; }
export interface PlatformNetworkDynamics { summary: string; dynamics: NetworkDynamic[]; overallStrength: string; crossSideEffects: string; sameAsideEffects: string; moatScore: number; recommendations: string[]; }

// ── Wave 61: Legal & Compliance Operations ────────────────────────────────────
export interface ContractPhase { phase: string; duration: string; bottleneck: string; automationLevel: string; riskLevel: string; improvement: string; }
export interface ContractLifecycle { summary: string; phases: ContractPhase[]; avgCycleTime: string; renewalRate: string; bottleneck: string; automationScore: number; recommendations: string[]; }
export interface ComplianceRule { regulation: string; status: string; automationLevel: string; effort: string; riskIfNonCompliant: string; action: string; }
export interface ComplianceAutomation { summary: string; rules: ComplianceRule[]; automatedPct: string; manualPct: string; complianceScore: number; annualCost: string; recommendations: string[]; }
export interface LegalRiskItem { risk: string; category: string; likelihood: string; impact: string; mitigation: string; owner: string; }
export interface LegalRiskRegister { summary: string; risks: LegalRiskItem[]; totalRisks: number; highPriorityCount: number; mitigatedPct: string; topRisk: string; recommendations: string[]; }
export interface IpHolding { asset: string; type: string; status: string; value: string; expiryDate: string; action: string; }
export interface IntellectualPropertyAudit { summary: string; assets: IpHolding[]; totalAssets: number; protectedPct: string; estimatedValue: string; gaps: string[]; recommendations: string[]; }
export interface RegulatoryEvent { event: string; regulation: string; deadline: string; impact: string; readiness: string; owner: string; }
export interface RegulatoryCalendar { summary: string; events: RegulatoryEvent[]; upcomingCount: number; overdueCount: number; highImpactCount: number; nextDeadline: string; recommendations: string[]; }
export interface PrivacyRequirement { requirement: string; regulation: string; status: string; gap: string; effort: string; priority: string; }
export interface PrivacyCompliance { summary: string; requirements: PrivacyRequirement[]; overallScore: number; gdprReady: string; ccpaReady: string; dataBreachRisk: string; recommendations: string[]; }

// ── Wave 62: Data Analytics ───────────────────────────────────────────────────
export interface DataWarehouseRec { component: string; currentState: string; targetState: string; technology: string; effort: string; impact: string; }
export interface DataWarehouseStrategy { summary: string; components: DataWarehouseRec[]; maturityLevel: string; dataVolume: string; queryPerformance: string; costOptimization: string; recommendations: string[]; }
export interface BiDashboard { dashboard: string; audience: string; metrics: string; refreshRate: string; complexity: string; priority: string; }
export interface BiDashboardDesign { summary: string; dashboards: BiDashboard[]; totalDashboards: number; selfServicePct: string; adoptionRate: string; topDashboard: string; recommendations: string[]; }
export interface PredictiveModelSpec { model: string; useCase: string; accuracy: string; dataRequirements: string; businessImpact: string; deploymentStatus: string; }
export interface PredictiveModelCatalog { summary: string; models: PredictiveModelSpec[]; totalModels: number; deployedPct: string; avgAccuracy: string; topModel: string; recommendations: string[]; }
export interface DataLineageNode { dataset: string; source: string; transformations: string; consumers: string; quality: string; freshness: string; }
export interface DataLineageMap { summary: string; nodes: DataLineageNode[]; totalDatasets: number; qualityScore: number; coveragePct: string; stalePct: string; recommendations: string[]; }
export interface MetricEntry { metric: string; definition: string; formula: string; owner: string; frequency: string; target: string; }
export interface MetricsDictionary { summary: string; metrics: MetricEntry[]; totalMetrics: number; standardizedPct: string; ownershipCoverage: string; topGap: string; recommendations: string[]; }
export interface AnalyticsPolicy { policy: string; scope: string; enforcement: string; compliance: string; gap: string; action: string; }
export interface AnalyticsGovernance { summary: string; policies: AnalyticsPolicy[]; maturityScore: number; dataAccessControl: string; auditFrequency: string; topIssue: string; recommendations: string[]; }

// ── Wave 63: Employee Experience ──────────────────────────────────────────────
export interface JourneyStage { stage: string; satisfaction: number; painPoints: string; touchpoints: string; improvement: string; priority: string; }
export interface EmployeeJourney { summary: string; stages: JourneyStage[]; overallSatisfaction: number; enps: number; topPainPoint: string; retentionRisk: string; recommendations: string[]; }
export interface WellnessInitiative { initiative: string; category: string; participation: string; impact: string; cost: string; roi: string; }
export interface WorkplaceWellness { summary: string; initiatives: WellnessInitiative[]; overallScore: number; participationRate: string; absenteeismRate: string; topProgram: string; recommendations: string[]; }
export interface LearningPath { path: string; audience: string; duration: string; completionRate: string; skillGap: string; impact: string; }
export interface LearningPathways { summary: string; paths: LearningPath[]; totalPaths: number; avgCompletionRate: string; skillCoverage: string; topPath: string; recommendations: string[]; }
export interface PerformanceKpi { kpi: string; target: string; actual: string; gap: string; trend: string; action: string; }
export interface PerformanceFramework { summary: string; kpis: PerformanceKpi[]; overallScore: number; topPerformerPct: string; improvementAreaCount: number; reviewCadence: string; recommendations: string[]; }
export interface PayEquityGap { demographic: string; role: string; gap: string; affected: string; rootCause: string; remediation: string; }
export interface PayEquityAnalysis { summary: string; gaps: PayEquityGap[]; overallEquityScore: number; adjustmentNeeded: string; affectedEmployees: string; topGap: string; recommendations: string[]; }
export interface DeiIndicator { dimension: string; representation: string; target: string; gap: string; trend: string; initiative: string; }
export interface DeiBenchmark { summary: string; indicators: DeiIndicator[]; overallScore: number; diversityIndex: string; inclusionScore: number; topStrength: string; recommendations: string[]; }

// ── Wave 64: Business Model Innovation ────────────────────────────────────────
export interface BusinessModelBlock { block: string; current: string; innovation: string; impact: string; feasibility: string; priority: string; }
export interface BusinessModelCanvas { summary: string; blocks: BusinessModelBlock[]; modelType: string; innovationScore: number; disruptionRisk: string; pivotReadiness: string; recommendations: string[]; }
export interface RevenueChannel { channel: string; contribution: string; growth: string; margin: string; scalability: string; risk: string; }
export interface RevenueModelDesign { summary: string; channels: RevenueChannel[]; primaryModel: string; recurringPct: string; diversificationScore: number; topChannel: string; recommendations: string[]; }
export interface ValueChainLink { activity: string; cost: string; value: string; efficiency: string; outsourceCandidate: string; improvement: string; }
export interface ValueChainOptimization { summary: string; links: ValueChainLink[]; totalCost: string; valueCreated: string; efficiencyScore: number; topBottleneck: string; recommendations: string[]; }
export interface CostDriver { driver: string; amount: string; percentage: string; trend: string; benchmark: string; optimization: string; }
export interface CostStructureAnalysis { summary: string; drivers: CostDriver[]; totalCost: string; fixedPct: string; variablePct: string; topDriver: string; recommendations: string[]; }
export interface PartnershipArrangement { partner: string; type: string; value: string; synergy: string; risk: string; status: string; }
export interface PartnershipModel { summary: string; arrangements: PartnershipArrangement[]; totalPartners: number; strategicPct: string; revenueFromPartners: string; topPartner: string; recommendations: string[]; }
export interface GrowthLever { lever: string; impact: string; effort: string; timeframe: string; confidence: string; prerequisite: string; }
export interface GrowthLeverAssessment { summary: string; levers: GrowthLever[]; topLever: string; quickWinCount: number; totalImpact: string; readinessScore: number; recommendations: string[]; }

// ── Wave 65: Vendor & Procurement ─────────────────────────────────────────────
export interface VendorEntity { vendor: string; category: string; spend: string; performance: string; risk: string; contractEnd: string; }
export interface VendorManagement { summary: string; vendors: VendorEntity[]; totalVendors: number; totalSpend: string; topVendor: string; riskLevel: string; recommendations: string[]; }
export interface SupplyNode { node: string; tier: string; location: string; leadTime: string; risk: string; alternative: string; }
export interface SupplyChainVisibility { summary: string; nodes: SupplyNode[]; totalNodes: number; visibilityScore: number; criticalNodes: number; avgLeadTime: string; recommendations: string[]; }
export interface SourcingCategory { category: string; currentSource: string; sustainability: string; cost: string; risk: string; alternative: string; }
export interface SustainableSourcing { summary: string; categories: SourcingCategory[]; sustainabilityScore: number; certifiedPct: string; costPremium: string; topOpportunity: string; recommendations: string[]; }
export interface FacilityMetric { facility: string; utilization: string; cost: string; efficiency: string; condition: string; improvement: string; }
export interface FacilityOptimization { summary: string; facilities: FacilityMetric[]; totalFacilities: number; avgUtilization: string; totalCost: string; savingsOpportunity: string; recommendations: string[]; }
export interface FleetAsset { asset: string; type: string; utilization: string; cost: string; age: string; replacement: string; }
export interface FleetManagement { summary: string; assets: FleetAsset[]; totalAssets: number; avgUtilization: string; totalCost: string; replacementNeeded: number; recommendations: string[]; }
export interface SuccessMetric { metric: string; current: string; target: string; trend: string; impact: string; action: string; }
export interface CustomerSuccess { summary: string; metrics: SuccessMetric[]; overallScore: number; nps: string; churnRate: string; expansionRevenue: string; recommendations: string[]; }

// ── Wave 66: Crisis & Resilience ──────────────────────────────────────────────
export interface CrisisProtocol { scenario: string; severity: string; responseTime: string; team: string; communication: string; recovery: string; }
export interface CrisisManagement { summary: string; protocols: CrisisProtocol[]; readinessScore: number; plansCovered: number; lastDrill: string; topVulnerability: string; recommendations: string[]; }
export interface ResilienceDimension { dimension: string; score: number; maturity: string; gap: string; investment: string; priority: string; }
export interface OperationalResilience { summary: string; dimensions: ResilienceDimension[]; overallScore: number; recoveryTime: string; redundancyLevel: string; topRisk: string; recommendations: string[]; }
export interface StakeholderGroup { stakeholder: string; influence: string; interest: string; relationship: string; engagement: string; strategy: string; }
export interface StakeholderMapping { summary: string; stakeholders: StakeholderGroup[]; totalStakeholders: number; highInfluenceCount: number; engagementScore: number; topPriority: string; recommendations: string[]; }
export interface DigitalFootprint { channel: string; reach: string; engagement: string; growth: string; sentiment: string; action: string; }
export interface DigitalPresence { summary: string; channels: DigitalFootprint[]; overallScore: number; totalReach: string; avgEngagement: string; strongestChannel: string; recommendations: string[]; }
export interface ChannelEfficiency { channel: string; revenue: string; cost: string; roi: string; growth: string; optimization: string; }
export interface ChannelStrategy { summary: string; channels: ChannelEfficiency[]; totalChannels: number; topChannel: string; underperformer: string; diversificationScore: number; recommendations: string[]; }
export interface AccountProfile { account: string; revenue: string; growth: string; health: string; risk: string; opportunity: string; }
export interface AccountManagement { summary: string; accounts: AccountProfile[]; totalAccounts: number; topAccount: string; atRiskCount: number; expansionPotential: string; recommendations: string[]; }

// ── Wave 67: Fundraising & Governance ─────────────────────────────────────────
export interface FundingRound { round: string; amount: string; valuation: string; investors: string; date: string; terms: string; }
export interface FundraisingStrategy { summary: string; rounds: FundingRound[]; totalRaised: string; currentValuation: string; nextRound: string; readinessScore: number; recommendations: string[]; }
export interface CapTableEntry { holder: string; shares: string; percentage: string; type: string; vestingStatus: string; value: string; }
export interface CaptableManagement { summary: string; entries: CapTableEntry[]; totalShares: string; founderOwnership: string; investorOwnership: string; optionPool: string; recommendations: string[]; }
export interface ExitScenario { scenario: string; valuation: string; timeline: string; likelihood: string; returns: string; requirements: string; }
export interface ExitPlanning { summary: string; scenarios: ExitScenario[]; preferredExit: string; estimatedTimeline: string; currentValuation: string; readinessScore: number; recommendations: string[]; }
export interface GovernanceElement { element: string; status: string; maturity: string; gap: string; risk: string; action: string; }
export interface BoardGovernance { summary: string; elements: GovernanceElement[]; overallScore: number; boardSize: number; independentPct: string; meetingFrequency: string; recommendations: string[]; }
export interface RecruitStage { stage: string; candidates: string; conversionRate: string; avgDays: string; bottleneck: string; improvement: string; }
export interface RecruitmentFunnel { summary: string; stages: RecruitStage[]; totalOpenings: number; avgTimeToHire: string; costPerHire: string; topSource: string; recommendations: string[]; }
export interface BrandAttribute { attribute: string; score: number; benchmark: string; perception: string; gap: string; action: string; }
export interface EmployerBranding { summary: string; attributes: BrandAttribute[]; overallScore: number; glassdoorRating: string; applicationRate: string; topStrength: string; recommendations: string[]; }

// ── Wave 68: Team & Operations ────────────────────────────────────────────────
export interface TeamUnit { team: string; size: number; velocity: string; collaboration: string; autonomy: string; improvement: string; }
export interface TeamTopology { summary: string; teams: TeamUnit[]; totalTeams: number; avgSize: number; collaborationScore: number; topTeam: string; recommendations: string[]; }
export interface OnboardingPhase { phase: string; duration: string; completion: string; satisfaction: string; dropoff: string; improvement: string; }
export interface OnboardingOptimization { summary: string; phases: OnboardingPhase[]; overallCompletion: string; avgTimeToProductivity: string; satisfactionScore: number; topIssue: string; recommendations: string[]; }
export interface MeetingAssessment { category: string; hoursPerWeek: string; attendees: string; effectiveness: string; actionItems: string; recommendation: string; }
export interface MeetingCulture { summary: string; assessments: MeetingAssessment[]; totalHoursPerWeek: string; effectiveRate: string; reclaimableHours: string; topIssue: string; recommendations: string[]; }
export interface DocAsset { document: string; type: string; status: string; accessibility: string; lastUpdated: string; action: string; }
export interface DocumentManagement { summary: string; documents: DocAsset[]; totalDocuments: number; organizedPct: string; accessibilityScore: number; topGap: string; recommendations: string[]; }
export interface WorkflowStep { workflow: string; currentState: string; automationPotential: string; effort: string; savings: string; priority: string; }
export interface WorkflowAutomation { summary: string; workflows: WorkflowStep[]; totalWorkflows: number; automatedPct: string; totalSavings: string; topOpportunity: string; recommendations: string[]; }
export interface QaCheck { area: string; coverage: string; defectRate: string; automationLevel: string; trend: string; action: string; }
export interface QualityAssurance { summary: string; checks: QaCheck[]; overallScore: number; defectRate: string; automationPct: string; topIssue: string; recommendations: string[]; }

// ── Wave 69: Cybersecurity & Compliance ───────────────────────────────────────
export interface IncidentRecord { incident: string; severity: string; responseTime: string; resolution: string; impact: string; lessonsLearned: string; }
export interface IncidentResponse { summary: string; incidents: IncidentRecord[]; avgResponseTime: string; mttr: string; incidentCount: number; topThreat: string; recommendations: string[]; }
export interface AccessPolicy { resource: string; currentAccess: string; requiredAccess: string; gap: string; risk: string; remediation: string; }
export interface AccessControl { summary: string; policies: AccessPolicy[]; overallScore: number; mfaAdoption: string; privilegedAccounts: number; topRisk: string; recommendations: string[]; }
export interface AuditEntry { system: string; coverage: string; lastAudit: string; findings: string; compliance: string; action: string; }
export interface AuditTrail { summary: string; entries: AuditEntry[]; totalSystems: number; auditedPct: string; openFindings: number; complianceScore: number; recommendations: string[]; }
export interface PenTestFinding { finding: string; severity: string; system: string; exploitability: string; remediation: string; status: string; }
export interface PenetrationTesting { summary: string; findings: PenTestFinding[]; totalFindings: number; criticalCount: number; remediatedPct: string; lastTestDate: string; recommendations: string[]; }
export interface SecurityModule { topic: string; audience: string; completionRate: string; effectiveness: string; frequency: string; improvement: string; }
export interface SecurityAwareness { summary: string; modules: SecurityModule[]; overallScore: number; trainingCompletion: string; phishingClickRate: string; topRisk: string; recommendations: string[]; }
export interface DataCategory { category: string; sensitivity: string; volume: string; protection: string; retention: string; action: string; }
export interface DataClassification { summary: string; categories: DataCategory[]; totalDatasets: number; classifiedPct: string; highSensitivityPct: string; topGap: string; recommendations: string[]; }

// ── Wave 70: Technical Infrastructure ─────────────────────────────────────────
export interface ApiEndpoint { endpoint: string; version: string; usage: string; latency: string; errorRate: string; documentation: string; }
export interface ApiDesign { summary: string; endpoints: ApiEndpoint[]; totalApis: number; documentedPct: string; avgLatency: string; versioningStrategy: string; recommendations: string[]; }
export interface ServiceComponent { service: string; type: string; dependencies: string; healthScore: string; scalability: string; improvement: string; }
export interface MicroservicesArchitecture { summary: string; services: ServiceComponent[]; totalServices: number; avgHealthScore: number; couplingLevel: string; topBottleneck: string; recommendations: string[]; }
export interface CloudResource { resource: string; provider: string; utilization: string; cost: string; optimization: string; savings: string; }
export interface CloudOptimization { summary: string; resources: CloudResource[]; totalSpend: string; wastedSpend: string; savingsOpportunity: string; rightSizingCount: number; recommendations: string[]; }
export interface DevopsPractice { practice: string; maturityLevel: string; adoption: string; impact: string; gap: string; action: string; }
export interface DevopsMaturity { summary: string; practices: DevopsPractice[]; overallScore: number; deployFrequency: string; leadTime: string; changeFailRate: string; recommendations: string[]; }
export interface MonitoringCheck { system: string; coverage: string; alerting: string; responseTime: string; uptime: string; improvement: string; }
export interface SystemMonitoring { summary: string; checks: MonitoringCheck[]; overallUptime: string; avgResponseTime: string; alertFatigue: string; blindSpots: number; recommendations: string[]; }
export interface CodeMetric { metric: string; value: string; benchmark: string; trend: string; impact: string; action: string; }
export interface CodeQuality { summary: string; metrics: CodeMetric[]; overallScore: number; technicalDebt: string; testCoverage: string; topIssue: string; recommendations: string[]; }

// ── Wave 71: Customer Intelligence ────────────────────────────────────────────
export interface ClvSegment { segment: string; avgClv: string; retentionRate: string; acquisitionCost: string; paybackPeriod: string; trend: string; }
export interface CustomerLifetimeValue { summary: string; segments: ClvSegment[]; overallClv: string; topSegment: string; clvCacRatio: string; growthTrend: string; recommendations: string[]; }
export interface SentimentSignal { source: string; sentiment: string; volume: string; trend: string; keyTheme: string; action: string; }
export interface SentimentAnalysis { summary: string; signals: SentimentSignal[]; overallSentiment: string; positiveRatio: string; topTheme: string; trendDirection: string; recommendations: string[]; }
export interface SupportTicketGroup { category: string; volume: string; avgResolution: string; satisfaction: string; trend: string; improvement: string; }
export interface SupportTicketAnalysis { summary: string; categories: SupportTicketGroup[]; totalTickets: string; avgResolutionTime: string; satisfactionScore: number; topCategory: string; recommendations: string[]; }
export interface SegmentProfit { segment: string; revenue: string; cost: string; margin: string; growth: string; action: string; }
export interface SegmentProfitability { summary: string; segments: SegmentProfit[]; topSegment: string; lowestMargin: string; overallMargin: string; rebalanceOpportunity: string; recommendations: string[]; }
export interface ReferralSource { source: string; referrals: string; conversionRate: string; revenue: string; cost: string; roi: string; }
export interface ReferralAnalytics { summary: string; sources: ReferralSource[]; totalReferrals: string; overallConversion: string; topSource: string; viralCoefficient: string; recommendations: string[]; }
export interface HealthDimension { dimension: string; score: number; trend: string; benchmark: string; alert: string; action: string; }
export interface CustomerHealthDashboard { summary: string; dimensions: HealthDimension[]; overallHealth: number; greenPct: string; redPct: string; topAlert: string; recommendations: string[]; }

// ── Wave 72: Strategic Planning ───────────────────────────────────────────────
export interface InnovationProject { project: string; stage: string; investment: string; expectedReturn: string; risk: string; timeline: string; }
export interface InnovationPortfolio { summary: string; projects: InnovationProject[]; totalInvestment: string; pipelineValue: string; successRate: string; topProject: string; recommendations: string[]; }
export interface ContingencyPlan { scenario: string; probability: string; impact: string; trigger: string; response: string; owner: string; }
export interface ContingencyPlanning { summary: string; plans: ContingencyPlan[]; totalScenarios: number; coveredPct: string; lastReview: string; topGap: string; recommendations: string[]; }
export interface RhythmCadence { cadence: string; frequency: string; participants: string; purpose: string; effectiveness: string; improvement: string; }
export interface OperatingRhythm { summary: string; cadences: RhythmCadence[]; totalCadences: number; alignmentScore: number; executionVelocity: string; topImprovement: string; recommendations: string[]; }
export interface CrossFuncTeam { team: string; members: string; objective: string; progress: string; blockers: string; action: string; }
export interface CrossFunctionalSync { summary: string; teams: CrossFuncTeam[]; totalTeams: number; alignmentScore: number; blockerCount: number; topBlocker: string; recommendations: string[]; }
export interface WarRoomTopic { topic: string; priority: string; owner: string; status: string; deadline: string; impact: string; }
export interface WardRoomStrategy { summary: string; topics: WarRoomTopic[]; activePriorities: number; resolvedPct: string; avgResolutionTime: string; topPriority: string; recommendations: string[]; }
export interface RevenueInsight { insight: string; impact: string; confidence: string; source: string; timeframe: string; action: string; }
export interface RevenueIntelligence { summary: string; insights: RevenueInsight[]; totalOpportunity: string; topInsight: string; confidenceLevel: string; actionableCount: number; recommendations: string[]; }

// ── Wave 73: Market Research & Insights ───────────────────────────────────────
export interface MarketInsight { insight: string; source: string; confidence: string; relevance: string; actionability: string; implication: string; }
export interface MarketResearch { summary: string; insights: MarketInsight[]; totalInsights: number; marketSize: string; growthRate: string; topInsight: string; recommendations: string[]; }
export interface CompetitorUpdate { competitor: string; recentMove: string; impact: string; threatLevel: string; opportunity: string; response: string; }
export interface CompetitorTracking { summary: string; updates: CompetitorUpdate[]; totalCompetitors: number; topThreat: string; biggestOpportunity: string; marketShareTrend: string; recommendations: string[]; }
export interface TrendSignal { trend: string; category: string; maturity: string; relevance: string; timeToImpact: string; action: string; }
export interface IndustryTrends { summary: string; signals: TrendSignal[]; totalTrends: number; topTrend: string; disruptionRisk: string; opportunityWindow: string; recommendations: string[]; }
export interface SocialMention { platform: string; volume: string; sentiment: string; reach: string; topTopic: string; action: string; }
export interface SocialListening { summary: string; mentions: SocialMention[]; totalMentions: string; overallSentiment: string; shareOfVoice: string; topPlatform: string; recommendations: string[]; }
export interface UxFinding { finding: string; severity: string; affectedUsers: string; page: string; evidence: string; fix: string; }
export interface UxResearch { summary: string; findings: UxFinding[]; totalFindings: number; usabilityScore: number; taskCompletionRate: string; topIssue: string; recommendations: string[]; }
export interface WebMetric { metric: string; value: string; benchmark: string; trend: string; impact: string; action: string; }
export interface WebAnalytics { summary: string; metrics: WebMetric[]; totalVisitors: string; conversionRate: string; bounceRate: string; topPage: string; recommendations: string[]; }

// ── Wave 74: Digital Marketing ────────────────────────────────────────────────
export interface EmailCampaign { campaign: string; openRate: string; clickRate: string; conversionRate: string; revenue: string; improvement: string; }
export interface EmailMarketing { summary: string; campaigns: EmailCampaign[]; totalSubscribers: string; avgOpenRate: string; avgClickRate: string; topCampaign: string; recommendations: string[]; }
export interface ConversionStep { step: string; visitors: string; conversionRate: string; dropoff: string; optimization: string; priority: string; }
export interface ConversionOptimization { summary: string; steps: ConversionStep[]; overallConversion: string; topDropoff: string; revenueImpact: string; quickWinCount: number; recommendations: string[]; }
export interface AbTest { test: string; variant: string; sampleSize: string; improvement: string; confidence: string; status: string; }
export interface AbTestingFramework { summary: string; tests: AbTest[]; totalTests: number; winRate: string; avgImprovement: string; topWin: string; recommendations: string[]; }
export interface AttributionTouchpoint { touchpoint: string; firstTouch: string; lastTouch: string; linear: string; revenue: string; action: string; }
export interface MarketingAttribution { summary: string; touchpoints: AttributionTouchpoint[]; primaryModel: string; topChannel: string; crossChannelEffect: string; attributionGap: string; recommendations: string[]; }
export interface ContentItem { title: string; type: string; status: string; publishDate: string; performance: string; action: string; }
export interface ContentCalendar { summary: string; items: ContentItem[]; totalPlanned: number; publishedPct: string; avgEngagement: string; topContent: string; recommendations: string[]; }
export interface SocialPostSchedule { day: string; time: string; contentType: string; }
export interface SocialPlatformKPI { metric: string; current: string; target: string; timeframe: string; }
export interface CompetitorSocialBenchmark { competitor: string; platform: string; followers: number; engagement: string; }
export interface SocialPlatformAnalysis {
  name: string;
  currentFollowers?: number;
  engagementRate?: string;
  topPerformingContent?: string[];
  underperformingContent?: string[];
  recommendedContentTypes: string[];
  postingSchedule: SocialPostSchedule[];
  growthStrategy: string;
  kpis: SocialPlatformKPI[];
}
export interface SocialPost { platform: string; type: string; scheduledDate: string; status: string; engagement: string; action: string; }
export interface SocialMediaCalendar {
  summary: string;
  platforms: SocialPlatformAnalysis[];
  contentPillars: string[];
  brandVoice: string;
  competitorBenchmark?: CompetitorSocialBenchmark[];
  toolsRecommended: string[];
  monthlyBudgetRecommendation: string;
  posts: SocialPost[];
  totalScheduled: number;
  platformCoverage: string;
  avgEngagement: string;
  topPlatform: string;
  recommendations: string[];
}

// ── Wave 75: Financial Planning ───────────────────────────────────────────────
export interface BudgetLine { category: string; budgeted: string; actual: string; variance: string; trend: string; action: string; }
export interface BudgetPlanning { summary: string; lines: BudgetLine[]; totalBudget: string; totalActual: string; variancePct: string; topVariance: string; recommendations: string[]; }
export interface RevenueForecastItem { period: string; forecast: string; actual: string; accuracy: string; driver: string; adjustment: string; }
export interface RevenueForecasting { summary: string; forecasts: RevenueForecastItem[]; annualForecast: string; forecastAccuracy: string; growthRate: string; topDriver: string; recommendations: string[]; }
export interface CashPosition { account: string; balance: string; trend: string; daysOfCash: string; risk: string; action: string; }
export interface CashManagement { summary: string; positions: CashPosition[]; totalCash: string; burnRate: string; runway: string; topRisk: string; recommendations: string[]; }
export interface CreditFacility { facility: string; limit: string; utilized: string; rate: string; maturity: string; action: string; }
export interface CreditManagement { summary: string; facilities: CreditFacility[]; totalCredit: string; utilizationRate: string; avgRate: string; topRisk: string; recommendations: string[]; }
export interface DebtInstrument { instrument: string; principal: string; rate: string; maturity: string; payment: string; action: string; }
export interface DebtStructure { summary: string; instruments: DebtInstrument[]; totalDebt: string; avgRate: string; debtToEquity: string; nearestMaturity: string; recommendations: string[]; }
export interface FinancialReport { report: string; frequency: string; accuracy: string; timeliness: string; audience: string; improvement: string; }
export interface FinancialReporting { summary: string; reports: FinancialReport[]; totalReports: number; automatedPct: string; avgAccuracy: string; topGap: string; recommendations: string[]; }

// ── Wave 76: Sustainability & ESG ─────────────────────────────────────────────
export interface CarbonSource { source: string; emissions: string; percentage: string; trend: string; reduction: string; target: string; }
export interface CarbonReduction { summary: string; sources: CarbonSource[]; totalEmissions: string; reductionTarget: string; progressPct: string; topSource: string; recommendations: string[]; }
export interface CircularProcess { process: string; wasteReduced: string; materialsRecovered: string; costSaving: string; maturity: string; action: string; }
export interface CircularEconomy { summary: string; processes: CircularProcess[]; circularityScore: number; wasteReduction: string; materialRecovery: string; topProcess: string; recommendations: string[]; }
export interface CommunityProgram { program: string; reach: string; investment: string; impact: string; alignment: string; status: string; }
export interface CommunityImpact { summary: string; programs: CommunityProgram[]; totalInvestment: string; peopleReached: string; impactScore: number; topProgram: string; recommendations: string[]; }
export interface WaterSource { source: string; consumption: string; trend: string; efficiency: string; risk: string; action: string; }
export interface WaterManagement { summary: string; sources: WaterSource[]; totalConsumption: string; efficiencyScore: number; reductionTarget: string; topRisk: string; recommendations: string[]; }
export interface WasteStream { stream: string; volume: string; diversionRate: string; cost: string; trend: string; action: string; }
export interface WasteReduction { summary: string; streams: WasteStream[]; totalWaste: string; diversionRate: string; costSavings: string; topStream: string; recommendations: string[]; }
export interface GreenInitiative { initiative: string; category: string; investment: string; impact: string; roi: string; timeline: string; }
export interface SustainableInnovation { summary: string; initiatives: GreenInitiative[]; totalInvestment: string; avgRoi: string; innovationScore: number; topInitiative: string; recommendations: string[]; }

// ── Wave 77: Talent & People Analytics ────────────────────────────────────────
export interface TalentCandidate { role: string; stage: string; source: string; daysInPipeline: number; quality: string; action: string; }
export interface TalentPipeline { summary: string; candidates: TalentCandidate[]; totalOpen: number; avgTimeToHire: string; topSource: string; conversionRate: string; recommendations: string[]; }
export interface LeadershipCapability { capability: string; currentLevel: string; targetLevel: string; gap: string; developmentAction: string; timeline: string; }
export interface LeadershipDevelopment { summary: string; capabilities: LeadershipCapability[]; readinessScore: number; highPotentials: number; avgGap: string; topPriority: string; recommendations: string[]; }
export interface SuccessionRole { role: string; incumbent: string; readiness: string; candidateCount: number; risk: string; action: string; }
export interface SuccessionReadiness { summary: string; roles: SuccessionRole[]; criticalRoles: number; readyNowPct: string; avgCandidates: number; topRisk: string; recommendations: string[]; }
export interface CompBand { level: string; range: string; median: string; marketPosition: string; equityGap: string; action: string; }
export interface CompensationStrategy { summary: string; bands: CompBand[]; totalSpend: string; marketPosition: string; equityScore: number; topGap: string; recommendations: string[]; }
export interface WorkforceMetric { metric: string; current: string; trend: string; benchmark: string; gap: string; action: string; }
export interface WorkforceAnalytics { summary: string; metrics: WorkforceMetric[]; headcount: number; attritionRate: string; engagementScore: number; topInsight: string; recommendations: string[]; }
export interface OrgDimension { dimension: string; score: number; benchmark: number; gap: string; driver: string; action: string; }
export interface OrgEffectiveness { summary: string; dimensions: OrgDimension[]; overallScore: number; spanOfControl: string; layerCount: number; topOpportunity: string; recommendations: string[]; }

// ── Wave 78: Sales Operations ─────────────────────────────────────────────────
export interface SalesMotion { motion: string; targetSegment: string; avgDealSize: string; winRate: string; cycleLength: string; action: string; }
export interface SalesMotionDesign { summary: string; motions: SalesMotion[]; primaryMotion: string; avgWinRate: string; avgCycle: string; topOpportunity: string; recommendations: string[]; }
export interface DealMetric { stage: string; count: number; value: string; conversionRate: string; avgDays: number; bottleneck: string; }
export interface DealAnalytics { summary: string; metrics: DealMetric[]; totalPipeline: string; avgDealSize: string; winRate: string; topBottleneck: string; recommendations: string[]; }
export interface TerritoryZone { territory: string; accounts: number; potential: string; coverage: string; rep: string; action: string; }
export interface TerritoryOptimization { summary: string; zones: TerritoryZone[]; totalTerritories: number; balanceScore: number; untappedPotential: string; topGap: string; recommendations: string[]; }
export interface CompPlan { role: string; baseSalary: string; variablePct: string; ote: string; quotaAttainment: string; action: string; }
export interface SalesCompensation { summary: string; plans: CompPlan[]; totalCost: string; avgAttainment: string; topPerformerMultiplier: string; topIssue: string; recommendations: string[]; }
export interface RevenueForecast { period: string; predicted: string; confidence: string; drivers: string; risk: string; adjustment: string; }
export interface RevenuePrediction { summary: string; forecasts: RevenueForecast[]; annualPrediction: string; confidenceLevel: string; growthRate: string; topDriver: string; recommendations: string[]; }
export interface AccountOpportunity { account: string; currentSpend: string; potential: string; penetrationPct: string; nextProduct: string; action: string; }
export interface AccountPenetration { summary: string; opportunities: AccountOpportunity[]; avgPenetration: string; totalWhitespace: string; topAccount: string; crossSellRate: string; recommendations: string[]; }

// ── Wave 79: Product Excellence ───────────────────────────────────────────────
export interface VisionElement { element: string; description: string; timeline: string; impact: string; alignment: string; status: string; }
export interface ProductVision { summary: string; elements: VisionElement[]; northStar: string; timeHorizon: string; differentiator: string; confidenceScore: number; recommendations: string[]; }
export interface FeatureRoadmapItem { feature: string; priority: string; effort: string; impact: string; quarter: string; status: string; }
export interface FeatureRoadmap { summary: string; items: FeatureRoadmapItem[]; totalFeatures: number; nextRelease: string; capacityUtilization: string; topPriority: string; recommendations: string[]; }
export interface PmfSignal { signal: string; score: number; trend: string; benchmark: string; evidence: string; action: string; }
export interface PmfAssessment { summary: string; signals: PmfSignal[]; pmfScore: number; retentionRate: string; npsScore: number; topSignal: string; recommendations: string[]; }
export interface ActivationStep { step: string; completionRate: string; dropoffRate: string; avgTime: string; friction: string; action: string; }
export interface UserActivation { summary: string; steps: ActivationStep[]; overallRate: string; timeToValue: string; biggestDropoff: string; activationMetric: string; recommendations: string[]; }
export interface ProductInsightMetric { metric: string; value: string; trend: string; benchmark: string; segment: string; action: string; }
export interface ProductInsights { summary: string; metrics: ProductInsightMetric[]; topFeature: string; underusedFeatures: string[]; stickinessScore: number; powerUserPct: string; recommendations: string[]; }
export interface ReleasePhase { phase: string; duration: string; criteria: string; rolloutPct: string; rollbackPlan: string; status: string; }
export interface ReleaseStrategy { summary: string; phases: ReleasePhase[]; releaseFrequency: string; avgLeadTime: string; rollbackRate: string; topRisk: string; recommendations: string[]; }

// ── Wave 80: Brand & Identity ─────────────────────────────────────────────────
export interface PositionAxis { axis: string; currentPosition: string; targetPosition: string; gap: string; competitorPosition: string; action: string; }
export interface BrandPositionMap { summary: string; axes: PositionAxis[]; uniqueValue: string; targetAudience: string; competitiveDiff: string; positionStrength: number; recommendations: string[]; }
export interface ValuationDriver { driver: string; contribution: string; trend: string; benchmark: string; leverage: string; action: string; }
export interface BrandValuation { summary: string; drivers: ValuationDriver[]; estimatedValue: string; growthRate: string; awarenessLevel: string; topDriver: string; recommendations: string[]; }
export interface BrandLevel { level: string; brand: string; role: string; audience: string; relationship: string; action: string; }
export interface BrandHierarchy { summary: string; levels: BrandLevel[]; totalBrands: number; architectureType: string; coherenceScore: number; topIssue: string; recommendations: string[]; }
export interface ReputationDimension { dimension: string; score: number; sentiment: string; volume: string; trend: string; action: string; }
export interface ReputationAnalysis { summary: string; dimensions: ReputationDimension[]; overallScore: number; netSentiment: string; topPositive: string; topRisk: string; recommendations: string[]; }
export interface MessagePillar { pillar: string; headline: string; proofPoints: string; audience: string; channel: string; effectiveness: string; }
export interface MessagingFramework { summary: string; pillars: MessagePillar[]; tagline: string; elevatorPitch: string; toneOfVoice: string; topPillar: string; recommendations: string[]; }
export interface VisualElement { element: string; current: string; assessment: string; recommendation: string; priority: string; impact: string; }
export interface VisualBranding { summary: string; elements: VisualElement[]; consistencyScore: number; modernityScore: number; distinctiveness: string; topImprovement: string; recommendations: string[]; }

// ── Wave 81: Strategic Growth Planning ───────────────────────────────────────
export interface GrowthLever { lever: string; impact: string; effort: string; timeline: string; owner: string; status: string; }
export interface GrowthPlaybook { summary: string; levers: GrowthLever[]; topLever: string; growthRate: string; targetGrowth: string; confidenceScore: number; recommendations: string[]; }
export interface RunRatePeriod { period: string; revenue: number; growth: string; annualized: number; trend: string; driver: string; }
export interface RevenueRunRate { summary: string; periods: RunRatePeriod[]; currentRunRate: number; projectedAnnual: number; growthTrend: string; topRisk: string; recommendations: string[]; }
export interface BreakEvenScenario { scenario: string; fixedCosts: number; variableCostPct: number; breakEvenRevenue: number; unitsRequired: number; timeToBreakEven: string; }
export interface BreakEvenModel { summary: string; scenarios: BreakEvenScenario[]; currentStatus: string; breakEvenDate: string; marginOfSafety: string; sensitivityFactor: string; recommendations: string[]; }
export interface LeverageMetric { metric: string; value: number; benchmark: string; trend: string; impact: string; action: string; }
export interface OperatingLeverageIndex { summary: string; metrics: LeverageMetric[]; leverageRatio: number; fixedCostPct: string; scalabilityScore: number; topOpportunity: string; recommendations: string[]; }
export interface MarginDriver { driver: string; currentMargin: string; targetMargin: string; gap: string; action: string; impact: string; }
export interface GrossMarginAnalysis { summary: string; drivers: MarginDriver[]; overallMargin: string; industryBenchmark: string; marginTrend: string; topImprovement: string; recommendations: string[]; }
export interface FundingScenario { scenario: string; amountNeeded: number; timeline: string; dilution: string; useOfFunds: string; outcome: string; }
export interface FundingScenarioModel { summary: string; scenarios: FundingScenario[]; currentRunway: string; optimalRaise: string; bestTiming: string; topPriority: string; recommendations: string[]; }

// ── Wave 82: Competitive Wargaming ──────────────────────────────────────────
export interface WargameScenario { scenario: string; competitorMove: string; ourResponse: string; expectedOutcome: string; probability: string; prepAction: string; }
export interface CompetitiveWargame { summary: string; scenarios: WargameScenario[]; biggestThreat: string; bestDefense: string; offensiveOpportunity: string; readinessScore: number; recommendations: string[]; }
export interface DisruptionVector { vector: string; probability: string; timeHorizon: string; impact: string; currentPrep: string; action: string; }
export interface MarketDisruptionModel { summary: string; vectors: DisruptionVector[]; disruptionRisk: string; mostLikelyDisruptor: string; adaptabilityScore: number; topAction: string; recommendations: string[]; }
export interface MoverAdvantage { advantage: string; currentHolder: string; sustainability: string; ourPosition: string; action: string; value: string; }
export interface FirstMoverAnalysis { summary: string; advantages: MoverAdvantage[]; firstMoverScore: number; fastFollowerViability: string; windowOfOpportunity: string; topAdvantage: string; recommendations: string[]; }
export interface DefensibilityLayer { layer: string; strength: string; durability: string; investment: string; competitorAbility: string; action: string; }
export interface DefensibilityAudit { summary: string; layers: DefensibilityLayer[]; overallScore: number; strongestMoat: string; weakestPoint: string; investmentNeeded: string; recommendations: string[]; }
export interface PivotDimension { dimension: string; currentState: string; pivotOption: string; effort: string; risk: string; potential: string; }
export interface PivotReadiness { summary: string; dimensions: PivotDimension[]; readinessScore: number; bestPivotOption: string; pivotCost: string; timeToExecute: string; recommendations: string[]; }
export interface CompTimingFactor { factor: string; signal: string; status: string; window: string; confidence: string; action: string; }
export interface CompetitiveTimingModel { summary: string; factors: CompTimingFactor[]; optimalTiming: string; marketReadiness: string; competitorReadiness: string; urgencyScore: number; recommendations: string[]; }

// ── Wave 83: Customer Success Advanced ──────────────────────────────────────
export interface MaturityStage { stage: string; criteria: string; customerPct: string; avgRevenue: string; churnRate: string; action: string; }
export interface CustomerMaturityModel { summary: string; stages: MaturityStage[]; avgMaturity: string; maturationRate: string; topBlocker: string; revenueByStage: string; recommendations: string[]; }
export interface ExpansionSignal { signal: string; strength: string; accounts: number; potentialRevenue: string; action: string; timeline: string; }
export interface ExpansionSignals { summary: string; signals: ExpansionSignal[]; totalPotential: string; topSignal: string; readyAccounts: number; avgExpansionRate: string; recommendations: string[]; }
export interface AdoptionMetric { metric: string; score: number; benchmark: string; trend: string; segment: string; action: string; }
export interface AdoptionScorecard { summary: string; metrics: AdoptionMetric[]; overallAdoption: number; topFeature: string; lowestAdoption: string; adoptionTrend: string; recommendations: string[]; }
export interface SentimentDimension { dimension: string; score: number; trend: string; verbatims: string; keyDriver: string; action: string; }
export interface StakeholderSentiment { summary: string; dimensions: SentimentDimension[]; overallSentiment: number; topPositive: string; topNegative: string; npsCorrelation: string; recommendations: string[]; }
export interface ValueMilestone { milestone: string; achievedPct: string; avgTimeToAchieve: string; impact: string; blocker: string; action: string; }
export interface ValueRealization { summary: string; milestones: ValueMilestone[]; overallRealization: string; timeToFirstValue: string; valueGap: string; topAccelerator: string; recommendations: string[]; }
export interface RenewalTactic { tactic: string; applicability: string; impact: string; effort: string; timing: string; owner: string; }
export interface RenewalPlaybook { summary: string; tactics: RenewalTactic[]; renewalRate: string; atRiskRevenue: string; topTactic: string; renewalForecast: string; recommendations: string[]; }

// ── Wave 84: Business Model Design ──────────────────────────────────────────
export interface InnovationOption { option: string; description: string; feasibility: string; revenue: string; risk: string; timeline: string; }
export interface BusinessModelInnovation { summary: string; options: InnovationOption[]; currentModelStrength: string; topOpportunity: string; disruptionRisk: string; innovationScore: number; recommendations: string[]; }
export interface MonetizationTest { test: string; hypothesis: string; metric: string; targetOutcome: string; duration: string; status: string; }
export interface MonetizationExperiment { summary: string; tests: MonetizationTest[]; topExperiment: string; expectedUplift: string; testVelocity: string; successRate: string; recommendations: string[]; }
export interface PricingComponent { component: string; model: string; rationale: string; elasticity: string; competitorApproach: string; optimization: string; }
export interface PricingArchitecture { summary: string; components: PricingComponent[]; architectureType: string; complexity: string; customerClarity: number; revenueImpact: string; recommendations: string[]; }
export interface RevStreamItem { stream: string; revenue: string; growth: string; margin: string; risk: string; strategy: string; }
export interface RevenueStreamMap { summary: string; streams: RevStreamItem[]; totalStreams: number; topStream: string; diversificationScore: number; concentrationRisk: string; recommendations: string[]; }
export interface CostDriver { driver: string; amount: string; pctOfTotal: string; trend: string; controllability: string; action: string; }
export interface CostDriverAnalysis { summary: string; drivers: CostDriver[]; totalCosts: string; topDriver: string; fixedVsVariable: string; optimizationPotential: string; recommendations: string[]; }
export interface ValueCaptureMethod { method: string; currentCapture: string; potential: string; gap: string; barrier: string; action: string; }
export interface ValueCapture { summary: string; methods: ValueCaptureMethod[]; captureRate: string; totalValueCreated: string; leakageRate: string; topOpportunity: string; recommendations: string[]; }

// ── Wave 85: Revenue Operations ─────────────────────────────────────────────
export interface RevenueProcess { process: string; owner: string; cycleTime: string; automationLevel: string; bottleneck: string; improvement: string; }
export interface RevenueProcessMap { summary: string; processes: RevenueProcess[]; totalProcesses: number; avgCycleTime: string; automationRate: string; topBottleneck: string; recommendations: string[]; }
export interface BillingIssue { issue: string; severity: string; impactAmount: string; frequency: string; rootCause: string; fix: string; }
export interface BillingHealthCheck { summary: string; issues: BillingIssue[]; overallHealth: number; errorRate: string; revenueLost: string; topIssue: string; recommendations: string[]; }
export interface QuoteStage { stage: string; avgDuration: string; conversionRate: string; dropReason: string; automationLevel: string; improvement: string; }
export interface QuoteToCloseAnalysis { summary: string; stages: QuoteStage[]; totalCycleTime: string; overallConversion: string; biggestDelay: string; topImprovement: string; recommendations: string[]; }
export interface RevenueLeak { leak: string; amount: string; source: string; detectability: string; prevention: string; priority: string; }
export interface RevenueLeakDetector { summary: string; leaks: RevenueLeak[]; totalLeakage: string; topLeak: string; detectionRate: string; recoverable: string; recommendations: string[]; }
export interface ForecastDimension { dimension: string; accuracy: string; bias: string; method: string; improvement: string; impact: string; }
export interface ForecastAccuracyModel { summary: string; dimensions: ForecastDimension[]; overallAccuracy: string; avgBias: string; bestMethod: string; worstSegment: string; recommendations: string[]; }
export interface DealDeskMetric { metric: string; value: string; benchmark: string; trend: string; bottleneck: string; action: string; }
export interface DealDeskOptimization { summary: string; metrics: DealDeskMetric[]; avgDealTime: string; approvalRate: string; discountRate: string; topImprovement: string; recommendations: string[]; }

// ── Wave 86: Workforce Strategy ─────────────────────────────────────────────
export interface TalentMarketSignal { signal: string; market: string; supply: string; demand: string; salary: string; action: string; }
export interface TalentMarketIntel { summary: string; signals: TalentMarketSignal[]; talentAvailability: string; competitivePosition: string; criticalRole: string; salaryTrend: string; recommendations: string[]; }
export interface LifecyclePhase { phase: string; duration: string; satisfaction: string; attritionRisk: string; keyMoment: string; action: string; }
export interface EmployeeLifecycleMap { summary: string; phases: LifecyclePhase[]; avgTenure: string; criticalPhase: string; satisfactionTrend: string; topRisk: string; recommendations: string[]; }
export interface SkillCategory { category: string; currentLevel: string; requiredLevel: string; gap: string; urgency: string; developmentPlan: string; }
export interface SkillsInventory { summary: string; categories: SkillCategory[]; totalSkillGaps: number; criticalGap: string; readinessScore: number; topPriority: string; recommendations: string[]; }
export interface DynamicsDimension { dimension: string; score: number; trend: string; driver: string; risk: string; action: string; }
export interface TeamDynamicsAnalysis { summary: string; dimensions: DynamicsDimension[]; overallHealth: number; strongestDimension: string; weakestDimension: string; interventionNeeded: string; recommendations: string[]; }
export interface WorkDimension { dimension: string; policy: string; effectiveness: string; satisfaction: string; productivity: string; recommendation: string; }
export interface HybridWorkModel { summary: string; dimensions: WorkDimension[]; hybridScore: number; remoteReadiness: string; collaborationScore: string; topChallenge: string; recommendations: string[]; }
export interface CompPhilosophyElement { element: string; approach: string; marketPosition: string; competitiveness: string; alignment: string; action: string; }
export interface CompensationPhilosophy { summary: string; elements: CompPhilosophyElement[]; marketPosition: string; totalRewardsScore: number; equityApproach: string; topGap: string; recommendations: string[]; }

// ── Wave 87: Data & Intelligence ────────────────────────────────────────────
export interface DataMaturityDimension { dimension: string; currentLevel: string; targetLevel: string; gap: string; investment: string; action: string; }
export interface DataMaturityAssessment { summary: string; dimensions: DataMaturityDimension[]; overallMaturity: number; strongestArea: string; weakestArea: string; investmentNeeded: string; recommendations: string[]; }
export interface InsightOpportunity { insight: string; value: string; effort: string; dataReady: string; stakeholder: string; priority: string; }
export interface InsightsPrioritization { summary: string; opportunities: InsightOpportunity[]; totalOpportunities: number; topInsight: string; quickWins: number; dataGaps: string; recommendations: string[]; }
export interface ExperimentMetric { metric: string; velocity: string; successRate: string; avgDuration: string; learnings: string; action: string; }
export interface ExperimentVelocity { summary: string; metrics: ExperimentMetric[]; totalExperiments: number; avgCycleTime: string; winRate: string; topLearning: string; recommendations: string[]; }
export interface DecisionArea { area: string; decisionSpeed: string; quality: string; dataUsage: string; bottleneck: string; improvement: string; }
export interface DecisionIntelligence { summary: string; areas: DecisionArea[]; overallScore: number; avgDecisionTime: string; dataDrivernPct: string; topBottleneck: string; recommendations: string[]; }
export interface FeedbackIntelChannel { channel: string; volume: string; sentiment: string; responseTime: string; actionRate: string; insight: string; }
export interface FeedbackIntelligence { summary: string; channels: FeedbackIntelChannel[]; totalFeedback: string; netSentiment: string; topTheme: string; actionRate: string; recommendations: string[]; }
export interface BenchmarkCategory { category: string; ourScore: number; industryAvg: number; topPerformer: number; percentile: string; action: string; }
export interface BenchmarkingEngine { summary: string; categories: BenchmarkCategory[]; overallPercentile: string; topStrength: string; biggestGap: string; improvementPotential: string; recommendations: string[]; }

// ── Wave 88: Ecosystem & Partnerships ───────────────────────────────────────
export interface PartnerValue { partner: string; revenueContribution: string; strategicValue: string; health: string; risk: string; action: string; }
export interface PartnerValueMap { summary: string; partners: PartnerValue[]; totalPartnerRevenue: string; topPartner: string; avgPartnerHealth: number; atRiskPartners: number; recommendations: string[]; }
export interface CoInnovationProject { project: string; partner: string; stage: string; investment: string; expectedReturn: string; timeline: string; }
export interface CoInnovationPipeline { summary: string; projects: CoInnovationProject[]; totalProjects: number; totalInvestment: string; topProject: string; avgTimeline: string; recommendations: string[]; }
export interface EcosystemStream { stream: string; revenue: string; growth: string; margin: string; partner: string; strategy: string; }
export interface EcosystemRevenue { summary: string; streams: EcosystemStream[]; totalEcoRevenue: string; growthRate: string; topStream: string; diversification: string; recommendations: string[]; }
export interface AllianceDimension { dimension: string; score: number; target: number; gap: string; initiative: string; owner: string; }
export interface AllianceScorecard { summary: string; dimensions: AllianceDimension[]; overallScore: number; topAlliance: string; weakestDimension: string; roi: string; recommendations: string[]; }
export interface EnablementComponent { component: string; status: string; adoption: string; effectiveness: string; gap: string; action: string; }
export interface PartnerEnablementPlan { summary: string; components: EnablementComponent[]; overallReadiness: number; topPriority: string; adoptionRate: string; investmentNeeded: string; recommendations: string[]; }
export interface ReadinessDimension { dimension: string; score: number; requirement: string; gap: string; timeline: string; action: string; }
export interface MarketplaceReadiness { summary: string; dimensions: ReadinessDimension[]; overallReadiness: number; launchDate: string; topBlocker: string; revenueProjection: string; recommendations: string[]; }

// ── Wave 89: Strategic Execution ────────────────────────────────────────────
export interface ExecutionPillar { pillar: string; status: string; progress: string; owner: string; blocker: string; action: string; }
export interface StrategyExecution { summary: string; pillars: ExecutionPillar[]; overallProgress: string; onTrackPct: string; topBlocker: string; executionScore: number; recommendations: string[]; }
export interface InitiativeItem { initiative: string; status: string; progress: string; impact: string; deadline: string; owner: string; }
export interface InitiativeTracking { summary: string; initiatives: InitiativeItem[]; totalInitiatives: number; onTrackPct: string; completedPct: string; topPriority: string; recommendations: string[]; }
export interface AllocationUnit { unit: string; budget: string; headcount: string; utilization: string; roi: string; rebalance: string; }
export interface ResourceAllocationModel { summary: string; units: AllocationUnit[]; totalBudget: string; utilizationRate: string; topImbalance: string; optimizationPotential: string; recommendations: string[]; }
export interface StrategicBet { bet: string; thesis: string; investment: string; expectedReturn: string; risk: string; timeframe: string; }
export interface StrategicBetting { summary: string; bets: StrategicBet[]; totalInvestment: string; topBet: string; portfolioBalance: string; riskTolerance: string; recommendations: string[]; }
export interface CadenceElement { element: string; frequency: string; participants: string; purpose: string; effectiveness: string; improvement: string; }
export interface ExecutionCadence { summary: string; elements: CadenceElement[]; cadenceScore: number; meetingLoad: string; decisionSpeed: string; topGap: string; recommendations: string[]; }
export interface AlignmentDimension { dimension: string; score: number; gap: string; driver: string; barrier: string; action: string; }
export interface AlignmentIndex { summary: string; dimensions: AlignmentDimension[]; overallAlignment: number; strongestArea: string; weakestArea: string; improvementPlan: string; recommendations: string[]; }

// ── Wave 90: Market Intelligence Advanced ───────────────────────────────────
export interface MarketSignal { signal: string; source: string; strength: string; implication: string; timeframe: string; action: string; }
export interface MarketSignalRadar { summary: string; signals: MarketSignal[]; totalSignals: number; strongestSignal: string; emergingTrend: string; urgency: string; recommendations: string[]; }
export interface CompetitorMove { competitor: string; move: string; impact: string; timing: string; ourResponse: string; urgency: string; }
export interface CompetitorMoveTracker { summary: string; moves: CompetitorMove[]; totalMoves: number; biggestThreat: string; opportunityFromMoves: string; responseReadiness: string; recommendations: string[]; }
export interface AggVoiceTheme { theme: string; frequency: string; sentiment: string; source: string; trend: string; action: string; }
export interface CustomerVoiceAggregator { summary: string; themes: AggVoiceTheme[]; totalVoices: number; topTheme: string; sentimentTrend: string; actionableInsights: number; recommendations: string[]; }
export interface ConvergencePoint { point: string; industries: string; timeline: string; opportunity: string; threat: string; action: string; }
export interface IndustryConvergenceMap { summary: string; points: ConvergencePoint[]; convergenceLevel: string; topOpportunity: string; disruptionRisk: string; readiness: string; recommendations: string[]; }
export interface EmergingTech { technology: string; maturity: string; relevance: string; timeToImpact: string; investment: string; action: string; }
export interface EmergingTechRadar { summary: string; technologies: EmergingTech[]; totalTracked: number; topTech: string; adoptionReadiness: string; investmentNeeded: string; recommendations: string[]; }
export interface RegulatoryChange { regulation: string; jurisdiction: string; effectiveDate: string; impact: string; readiness: string; action: string; }
export interface RegulatoryHorizon { summary: string; changes: RegulatoryChange[]; totalChanges: number; highestImpact: string; complianceGap: string; prepTime: string; recommendations: string[]; }

// ── Wave 91: Financial Health Deep ──────────────────────────────────────────
export interface CashFlowPeriod { period: string; inflow: number; outflow: number; netCash: number; runwayMonths: number; driver: string; }
export interface CashFlowForecaster { summary: string; periods: CashFlowPeriod[]; currentCash: number; burnRate: string; runwayMonths: number; criticalDate: string; recommendations: string[]; }
export interface ProfitDriver { driver: string; contribution: string; trend: string; leverage: string; controllability: string; action: string; }
export interface ProfitDriverTree { summary: string; drivers: ProfitDriver[]; topDriver: string; profitMargin: string; improvementPotential: string; sensitivityFactor: string; recommendations: string[]; }
export interface QualityDimension { dimension: string; score: number; trend: string; benchmark: string; risk: string; action: string; }
export interface RevenueQualityIndex { summary: string; dimensions: QualityDimension[]; overallQuality: number; recurringPct: string; concentrationRisk: string; topImprovement: string; recommendations: string[]; }
export interface ResilienceFactor { factor: string; score: number; stressTest: string; threshold: string; buffer: string; action: string; }
export interface FinancialResilienceScore { summary: string; factors: ResilienceFactor[]; overallResilience: number; stressCapacity: string; recoveryTime: string; topVulnerability: string; recommendations: string[]; }
export interface CapitalComponent { component: string; amount: string; cycleTime: string; efficiency: string; benchmark: string; action: string; }
export interface WorkingCapitalOptimizer { summary: string; components: CapitalComponent[]; totalWorkingCapital: string; cycleDays: number; efficiencyScore: number; topOpportunity: string; recommendations: string[]; }
export interface ReadinessGate { gate: string; status: string; criteria: string; gap: string; effort: string; timeline: string; }
export interface InvestmentReadinessGate { summary: string; gates: ReadinessGate[]; overallReadiness: number; passedGates: number; totalGates: number; topBlocker: string; recommendations: string[]; }

// ── Wave 92: Customer Intelligence Platform ─────────────────────────────────
export interface DnaDimension { dimension: string; value: string; segment: string; behavior: string; prediction: string; action: string; }
export interface CustomerDnaProfile { summary: string; dimensions: DnaDimension[]; dominantSegment: string; avgLifetimeValue: string; retentionProbability: string; topInsight: string; recommendations: string[]; }
export interface PropensityFactor { factor: string; score: number; direction: string; confidence: string; segment: string; action: string; }
export interface PropensityModel { summary: string; factors: PropensityFactor[]; buyPropensity: string; churnPropensity: string; expandPropensity: string; topFactor: string; recommendations: string[]; }
export interface WarningSignal { signal: string; severity: string; accounts: number; revenueAtRisk: string; leadTime: string; intervention: string; }
export interface ChurnEarlyWarning { summary: string; signals: WarningSignal[]; totalAtRisk: number; revenueAtRisk: string; avgLeadTime: string; interventionSuccessRate: string; recommendations: string[]; }
export interface EffortPoint { point: string; effortScore: number; frequency: string; impact: string; rootCause: string; action: string; }
export interface CustomerEffortOptimizer { summary: string; points: EffortPoint[]; overallEffortScore: number; topFrictionPoint: string; automationOpportunity: string; satisfactionCorrelation: string; recommendations: string[]; }
export interface LoyaltyFactor { factor: string; impact: string; current: string; potential: string; gap: string; action: string; }
export interface LoyaltyDriver { summary: string; factors: LoyaltyFactor[]; overallLoyalty: number; topDriver: string; biggestDetractor: string; npsImpact: string; recommendations: string[]; }
export interface AccountDimension { dimension: string; value: string; trend: string; benchmark: string; opportunity: string; action: string; }
export interface AccountIntelligence { summary: string; dimensions: AccountDimension[]; totalAccounts: number; topAccount: string; growthOpportunity: string; riskConcentration: string; recommendations: string[]; }

// ── Wave 93: Go-to-Market Execution ──────────────────────────────────────────
export interface GtmMilestone { milestone: string; date: string; owner: string; status: string; dependencies: string; action: string; }
export interface GtmCalendar { summary: string; milestones: GtmMilestone[]; launchDate: string; totalMilestones: number; completedPct: string; topRisk: string; recommendations: string[]; }
export interface ReadinessGateItem { gate: string; status: string; score: number; criteria: string; blocker: string; action: string; }
export interface LaunchReadiness { summary: string; gates: ReadinessGateItem[]; overallReadiness: number; goNoGo: string; topBlocker: string; launchDate: string; recommendations: string[]; }
export interface MessageVariant { variant: string; headline: string; audience: string; channel: string; expectedResponse: string; testResult: string; }
export interface MessageTesting { summary: string; variants: MessageVariant[]; winningMessage: string; conversionLift: string; audienceFit: string; confidence: string; recommendations: string[]; }
export interface CollateralItem { name: string; type: string; audience: string; status: string; effectiveness: string; action: string; }
export interface SalesCollateral { summary: string; items: CollateralItem[]; totalPieces: number; coverageGap: string; topPerformer: string; updateNeeded: string; recommendations: string[]; }
export interface DemandGenChannel { channel: string; budget: string; expectedLeads: number; costPerLead: string; timeline: string; action: string; }
export interface DemandGenPlan { summary: string; channels: DemandGenChannel[]; totalBudget: string; expectedLeads: number; avgCostPerLead: string; topChannel: string; recommendations: string[]; }
export interface ChannelItem { channel: string; status: string; readiness: number; audience: string; investment: string; action: string; }
export interface ChannelActivation { summary: string; channels: ChannelItem[]; activeChannels: number; topChannel: string; activationGap: string; totalInvestment: string; recommendations: string[]; }

// ── Wave 94: Pricing Science ─────────────────────────────────────────────────
export interface ElasticityPoint { pricePoint: string; demand: string; revenue: string; elasticity: number; optimal: boolean; action: string; }
export interface PriceElasticityModel { summary: string; points: ElasticityPoint[]; currentPrice: string; optimalPrice: string; revenueImpact: string; sensitivity: string; recommendations: string[]; }
export interface PricingRule { rule: string; trigger: string; adjustment: string; frequency: string; guard: string; expectedImpact: string; }
export interface DynamicPricingEngine { summary: string; rules: PricingRule[]; revenueUplift: string; implementationComplexity: string; riskLevel: string; topOpportunity: string; recommendations: string[]; }
export interface DiscountScenario { scenario: string; discountPct: string; volumeChange: string; revenueImpact: string; marginImpact: string; recommendation: string; }
export interface DiscountImpactAnalysis { summary: string; scenarios: DiscountScenario[]; currentDiscountRate: string; optimalRate: string; revenueLeakage: string; topInsight: string; recommendations: string[]; }
export interface PriceBundleOption { bundle: string; products: string; price: string; savings: string; targetSegment: string; expectedUptake: string; }
export interface BundleDesigner { summary: string; bundles: PriceBundleOption[]; topBundle: string; revenueImpact: string; cannibalizationRisk: string; implementationEffort: string; recommendations: string[]; }
export interface PricePoint { competitor: string; product: string; price: string; positioning: string; trend: string; action: string; }
export interface CompetitivePriceTracker { summary: string; pricePoints: PricePoint[]; yourPosition: string; priceGap: string; trendDirection: string; alertCount: number; recommendations: string[]; }
export interface PricingExpItem { experiment: string; hypothesis: string; segment: string; duration: string; metric: string; expectedOutcome: string; }
export interface PricingExperiment { summary: string; experiments: PricingExpItem[]; totalExperiments: number; topPriority: string; expectedRevenueImpact: string; riskLevel: string; recommendations: string[]; }

// ── Wave 95: Business Intelligence Hub ───────────────────────────────────────
export interface WatchlistKpi { kpi: string; current: string; target: string; trend: string; alertStatus: string; action: string; }
export interface KpiWatchlist { summary: string; kpis: WatchlistKpi[]; totalTracked: number; onTrackPct: string; criticalCount: number; topAlert: string; recommendations: string[]; }
export interface AlertRule { alert: string; metric: string; threshold: string; severity: string; channel: string; action: string; }
export interface AlertFramework { summary: string; rules: AlertRule[]; totalRules: number; activatedCount: number; falsePositiveRate: string; topAlert: string; recommendations: string[]; }
export interface AnomalyItem { metric: string; anomalyType: string; deviation: string; detectedAt: string; rootCause: string; action: string; }
export interface AnomalyDetection { summary: string; anomalies: AnomalyItem[]; totalDetected: number; criticalCount: number; topAnomaly: string; detectionAccuracy: string; recommendations: string[]; }
export interface ForecastItem { metric: string; current: string; forecast30d: string; forecast90d: string; confidence: string; driver: string; }
export interface TrendForecast { summary: string; forecasts: ForecastItem[]; overallTrend: string; topGrowthMetric: string; topDeclineMetric: string; accuracy: string; recommendations: string[]; }
export interface DashboardPanel { panel: string; metrics: string; audience: string; refreshRate: string; dataSource: string; priority: string; }
export interface DashboardDesign { summary: string; panels: DashboardPanel[]; totalPanels: number; keyAudience: string; dataReadiness: string; buildEffort: string; recommendations: string[]; }
export interface InsightItem { insight: string; category: string; impact: string; confidence: string; actionability: string; action: string; }
export interface InsightsCatalog { summary: string; insights: InsightItem[]; totalInsights: number; highImpactCount: number; topInsight: string; coverageGap: string; recommendations: string[]; }

// ── Wave 96: Innovation Management ───────────────────────────────────────────
export interface IdeaItem { idea: string; source: string; category: string; feasibility: string; impact: string; status: string; }
export interface IdeaPipeline { summary: string; ideas: IdeaItem[]; totalIdeas: number; selectedCount: number; topIdea: string; pipelineHealth: string; recommendations: string[]; }
export interface ScoringCriterion { criterion: string; weight: number; score: number; benchmark: string; gap: string; action: string; }
export interface InnovationScoring { summary: string; criteria: ScoringCriterion[]; overallScore: number; innovationRank: string; topStrength: string; topWeakness: string; recommendations: string[]; }
export interface ExperimentItem { experiment: string; hypothesis: string; status: string; result: string; learnings: string; nextStep: string; }
export interface ExperimentBoard { summary: string; experiments: ExperimentItem[]; totalExperiments: number; successRate: string; avgCycleTime: string; topLearning: string; recommendations: string[]; }
export interface PatentItem { patent: string; status: string; category: string; value: string; expiry: string; action: string; }
export interface PatentAnalysis { summary: string; patents: PatentItem[]; totalPatents: number; portfolioValue: string; protectionCoverage: string; topGap: string; recommendations: string[]; }
export interface DisruptionScenario { scenario: string; probability: string; timeframe: string; impact: string; response: string; preparation: string; }
export interface DisruptionPlaybook { summary: string; scenarios: DisruptionScenario[]; topThreat: string; readinessScore: number; responseTime: string; investmentNeeded: string; recommendations: string[]; }
export interface FutureProofDimension { dimension: string; currentScore: number; targetScore: number; gap: string; trend: string; action: string; }
export interface FutureProofing { summary: string; dimensions: FutureProofDimension[]; overallScore: number; strongestDimension: string; weakestDimension: string; timeHorizon: string; recommendations: string[]; }

// ── Wave 97: Customer Revenue Management ─────────────────────────────────────
export interface RevenueSegment { segment: string; revenue: string; pct: string; growth: string; margin: string; action: string; }
export interface RevenueMixAnalysis { summary: string; segments: RevenueSegment[]; totalRevenue: string; topSegment: string; concentrationRisk: string; diversificationScore: string; recommendations: string[]; }
export interface GrowthPlanItem { account: string; currentRevenue: string; potential: string; strategy: string; timeline: string; action: string; }
export interface AccountGrowthPlan { summary: string; plans: GrowthPlanItem[]; totalGrowthPotential: string; topAccount: string; avgExpansionRate: string; coveragePct: string; recommendations: string[]; }
export interface ContractItem { contract: string; value: string; expiry: string; autoRenew: boolean; riskLevel: string; optimization: string; }
export interface ContractOptimizer { summary: string; contracts: ContractItem[]; totalValue: string; expiringCount: number; savingsOpportunity: string; topRisk: string; recommendations: string[]; }
export interface UsagePattern { pattern: string; segment: string; frequency: string; trend: string; monetization: string; action: string; }
export interface UsagePatternAnalysis { summary: string; patterns: UsagePattern[]; topPattern: string; underutilizedFeature: string; upsellOpportunity: string; churnCorrelation: string; recommendations: string[]; }
export interface RecoveryStep { step: string; target: string; channel: string; offer: string; timeline: string; expectedWinback: string; }
export interface ChurnRecoveryPlan { summary: string; steps: RecoveryStep[]; totalChurned: number; recoverableRevenue: string; expectedRecoveryRate: string; topOffer: string; recommendations: string[]; }
export interface WinbackSegment { segment: string; churnReason: string; winbackOffer: string; channel: string; successRate: string; revenue: string; }
export interface WinbackProgram { summary: string; segments: WinbackSegment[]; totalTargets: number; expectedRevenue: string; topSegment: string; bestChannel: string; recommendations: string[]; }

// ── Wave 98: Operational Automation ──────────────────────────────────────────
export interface AutomationOpp { process: string; currentTime: string; automatedTime: string; savings: string; complexity: string; tool: string; }
export interface AutomationAudit { summary: string; opportunities: AutomationOpp[]; totalSavings: string; topOpportunity: string; automationRate: string; investmentNeeded: string; recommendations: string[]; }
export interface DigitizationItem { process: string; currentState: string; targetState: string; effort: string; benefit: string; timeline: string; }
export interface ProcessDigitization { summary: string; items: DigitizationItem[]; digitizationScore: number; topPriority: string; totalProcesses: number; digitalPct: string; recommendations: string[]; }
export interface BotPlan { bot: string; useCase: string; platform: string; complexity: string; roi: string; timeline: string; }
export interface BotDeploymentPlan { summary: string; bots: BotPlan[]; totalBots: number; expectedSavings: string; topUseCase: string; implementationTime: string; recommendations: string[]; }
export interface WorkflowMetric { workflow: string; cycleTime: string; errorRate: string; throughput: string; benchmark: string; action: string; }
export interface WorkflowBenchmark { summary: string; workflows: WorkflowMetric[]; avgCycleTime: string; topPerformer: string; worstPerformer: string; improvementPotential: string; recommendations: string[]; }
export interface HandoffPoint { handoff: string; fromTeam: string; toTeam: string; avgDelay: string; errorRate: string; action: string; }
export interface HandoffEfficiency { summary: string; handoffs: HandoffPoint[]; totalHandoffs: number; avgDelay: string; topBottleneck: string; automationCandidate: string; recommendations: string[]; }
export interface ToolItem { tool: string; category: string; users: number; cost: string; overlap: string; recommendation: string; }
export interface ToolConsolidation { summary: string; tools: ToolItem[]; totalTools: number; potentialSavings: string; redundancyCount: number; topConsolidation: string; recommendations: string[]; }

// ── Wave 99: Strategic Communications ────────────────────────────────────────
export interface CrisisCommScenario { scenario: string; severity: string; audience: string; message: string; channel: string; timeline: string; }
export interface CrisisCommunication { summary: string; scenarios: CrisisCommScenario[]; readinessScore: number; topRisk: string; spokespersonReady: boolean; templateCount: number; recommendations: string[]; }
export interface InternalChannel { channel: string; audience: string; frequency: string; effectiveness: string; engagement: string; action: string; }
export interface InternalComms { summary: string; channels: InternalChannel[]; overallEffectiveness: number; topChannel: string; engagementGap: string; informationFlow: string; recommendations: string[]; }
export interface NarrativeComponent { component: string; message: string; evidence: string; audience: string; medium: string; timing: string; }
export interface InvestorNarrative { summary: string; components: NarrativeComponent[]; coreStory: string; keyMetrics: string; differentiator: string; askClarity: string; recommendations: string[]; }
export interface PressItem { topic: string; angle: string; outlet: string; timing: string; spokesperson: string; expectedReach: string; }
export interface PressStrategy { summary: string; items: PressItem[]; totalOpportunities: number; topStory: string; mediaReadiness: string; presenceScore: number; recommendations: string[]; }
export interface TlPillar { pillar: string; topic: string; format: string; audience: string; frequency: string; impact: string; }
export interface ThoughtLeadershipPlan { summary: string; pillars: TlPillar[]; totalPillars: number; topTopic: string; authorityScore: number; contentGap: string; recommendations: string[]; }
export interface StoryChapter { chapter: string; narrative: string; audience: string; emotion: string; proof: string; medium: string; }
export interface BrandStoryArc { summary: string; chapters: StoryChapter[]; coreNarrative: string; brandVoice: string; emotionalHook: string; consistency: string; recommendations: string[]; }

// ── Wave 100: Business Mastery Score ─────────────────────────────────────────
export interface MasteryDimension { dimension: string; score: number; grade: string; benchmark: string; trend: string; action: string; }
export interface MasteryDashboard { summary: string; dimensions: MasteryDimension[]; overallMastery: number; overallGrade: string; topStrength: string; topWeakness: string; recommendations: string[]; }
export interface GrowthVelocityMetric { metric: string; current: string; target: string; velocity: string; acceleration: string; action: string; }
export interface GrowthVelocityScore { summary: string; metrics: GrowthVelocityMetric[]; overallVelocity: number; accelerating: boolean; topDriver: string; topDrag: string; recommendations: string[]; }
export interface MaturityArea { area: string; level: string; score: number; benchmark: string; gap: string; nextLevel: string; }
export interface OperationalMaturity { summary: string; areas: MaturityArea[]; overallMaturity: number; maturityLevel: string; topStrength: string; topGap: string; recommendations: string[]; }
export interface LeadershipDimension { dimension: string; score: number; benchmark: string; gap: string; development: string; action: string; }
export interface LeadershipReadiness { summary: string; dimensions: LeadershipDimension[]; overallReadiness: number; readinessLevel: string; topStrength: string; developmentPriority: string; recommendations: string[]; }
export interface DominanceMetric { metric: string; score: number; marketShare: string; trend: string; competitorGap: string; action: string; }
export interface MarketDominanceIndex { summary: string; metrics: DominanceMetric[]; overallDominance: number; dominanceLevel: string; topAdvantage: string; topThreat: string; recommendations: string[]; }
export interface ReadinessDimensionItem { dimension: string; score: number; trend: string; timeHorizon: string; investment: string; action: string; }
export interface FutureReadiness { summary: string; dimensions: ReadinessDimensionItem[]; overallReadiness: number; readinessLevel: string; topStrength: string; biggestGap: string; recommendations: string[]; }

// ── Wave 101: AI & Machine Learning Readiness ─────────────────────────────────
export interface AIReadinessDimension { dimension: string; score: number; maturity: string; gaps: string; recommendation: string; timeline: string; }
export interface AIAdoptionPotential { summary: string; dimensions: AIReadinessDimension[]; overallReadiness: number; topOpportunity: string; biggestBarrier: string; investmentNeeded: string; recommendations: string[]; }
export interface MLUseCase { useCase: string; department: string; feasibility: number; impact: number; dataReadiness: string; implementation: string; }
export interface MLUseCaseIdentification { summary: string; useCases: MLUseCase[]; totalIdentified: number; topPriority: string; quickWin: string; dataGap: string; recommendations: string[]; }
export interface InfraGap { area: string; current: string; required: string; gap: string; priority: string; investment: string; }
export interface DataInfrastructureGapAnalysis { summary: string; gaps: InfraGap[]; overallMaturity: number; criticalGap: string; quickFix: string; totalInvestment: string; recommendations: string[]; }
export interface AutomationCase { process: string; currentCost: string; automationCost: string; annualSavings: string; paybackMonths: number; complexity: string; }
export interface AutomationROIModeling { summary: string; cases: AutomationCase[]; totalSavings: string; avgPayback: number; topROI: string; lowestRisk: string; recommendations: string[]; }
export interface AITalentGap { role: string; current: number; needed: number; gap: number; urgency: string; source: string; }
export interface AITalentNeedsAssessment { summary: string; gaps: AITalentGap[]; totalGap: number; criticalRole: string; trainingPriority: string; hiringTimeline: string; recommendations: string[]; }
export interface EthicalPrinciple { principle: string; policy: string; implementation: string; monitoring: string; risk: string; compliance: string; }
export interface EthicalAIFramework { summary: string; principles: EthicalPrinciple[]; overallMaturity: number; topRisk: string; complianceStatus: string; governanceGap: string; recommendations: string[]; }

// ── Wave 102: Geographic Expansion Intelligence ─────────────────────────────
export interface MarketEntry { market: string; attractiveness: number; barriers: string; competition: string; growthPotential: string; recommendation: string; }
export interface MarketEntryScoring { summary: string; markets: MarketEntry[]; topMarket: string; easiestEntry: string; highestPotential: string; overallStrategy: string; recommendations: string[]; }
export interface RegulatoryArea { area: string; requirement: string; complexity: string; timeline: string; cost: string; risk: string; }
export interface RegulatoryLandscapeMapping { summary: string; areas: RegulatoryArea[]; overallComplexity: number; topRisk: string; complianceCost: string; criticalDeadline: string; recommendations: string[]; }
export interface CulturalFactor { factor: string; impact: string; adaptation: string; priority: string; investment: string; timeline: string; }
export interface CulturalAdaptationStrategy { summary: string; factors: CulturalFactor[]; overallFit: number; topChallenge: string; quickAdaptation: string; localInsight: string; recommendations: string[]; }
export interface LogisticsComponent { component: string; current: string; required: string; gap: string; cost: string; timeline: string; }
export interface LogisticsExpansionAnalysis { summary: string; components: LogisticsComponent[]; totalInvestment: string; criticalPath: string; riskArea: string; partnerNeeds: string; recommendations: string[]; }
export interface PartnerCandidate { type: string; criteria: string; value: string; risk: string; model: string; priority: string; }
export interface LocalPartnershipStrategy { summary: string; candidates: PartnerCandidate[]; topPartnerType: string; collaborationModel: string; riskMitigation: string; expectedValue: string; recommendations: string[]; }
export interface PricingMarket { market: string; suggestedPrice: string; localCompetitor: string; purchasingPower: string; margin: string; strategy: string; }
export interface InternationalPricingOptimization { summary: string; markets: PricingMarket[]; pricingModel: string; currencyStrategy: string; topMargin: string; riskArea: string; recommendations: string[]; }

// ── Wave 103: Customer Lifecycle Optimization ─────────────────────────────────
export interface LifecycleFunnelStage { stage: string; conversionRate: number; dropOff: number; volume: string; bottleneck: string; optimization: string; }
export interface AcquisitionFunnelIntelligence { summary: string; stages: LifecycleFunnelStage[]; overallConversion: number; topBottleneck: string; quickWin: string; channelMix: string; recommendations: string[]; }
export interface OnboardingMetric { metric: string; current: string; benchmark: string; gap: string; impact: string; improvement: string; }
export interface OnboardingEffectivenessScore { summary: string; metrics: OnboardingMetric[]; overallScore: number; timeToValue: string; topFriction: string; bestPractice: string; recommendations: string[]; }
export interface EngagementSegment { segment: string; score: number; trend: string; drivers: string; riskLevel: string; intervention: string; }
export interface EngagementScoringModel { summary: string; segments: EngagementSegment[]; overallEngagement: number; topDriver: string; atRiskSegment: string; growthSegment: string; recommendations: string[]; }
export interface ExpansionOpportunity { account: string; currentRevenue: string; expansionPotential: string; product: string; propensity: number; action: string; }
export interface ExpansionRevenueOpportunities { summary: string; opportunities: ExpansionOpportunity[]; totalPotential: string; topAccount: string; quickWin: string; strategy: string; recommendations: string[]; }
export interface AdvocacyElement { element: string; mechanic: string; incentive: string; audience: string; expectedImpact: string; timeline: string; }
export interface AdvocacyProgramDesign { summary: string; elements: AdvocacyElement[]; programType: string; expectedReferrals: string; revenueImpact: string; launchTimeline: string; recommendations: string[]; }
export interface LTVSegment { segment: string; currentLTV: string; predictedLTV: string; retentionRate: string; growthDriver: string; investment: string; }
export interface LifetimeValueModeling { summary: string; segments: LTVSegment[]; overallLTV: string; topSegment: string; growthLever: string; retentionImpact: string; recommendations: string[]; }

// ── Wave 104: Platform & API Economy ──────────────────────────────────────────
export interface APITier { tier: string; features: string; pricing: string; targetUser: string; expectedAdoption: string; revenue: string; }
export interface APIMonetizationStrategy { summary: string; tiers: APITier[]; revenueModel: string; totalAddressable: string; topTier: string; pricingStrategy: string; recommendations: string[]; }
export interface EcosystemMetric { metric: string; value: string; trend: string; benchmark: string; health: string; action: string; }
export interface PlatformEcosystemHealth { summary: string; metrics: EcosystemMetric[]; overallHealth: number; networkEffects: string; topContributor: string; growthLever: string; recommendations: string[]; }
export interface DXMetric { area: string; score: number; feedback: string; pain: string; improvement: string; priority: string; }
export interface DeveloperExperienceOptimization { summary: string; metrics: DXMetric[]; overallDX: number; topPain: string; quickFix: string; sdkStrategy: string; recommendations: string[]; }
export interface IntegrationItem { integration: string; usage: string; revenue: string; satisfaction: number; growth: string; opportunity: string; }
export interface IntegrationMarketplaceAnalytics { summary: string; integrations: IntegrationItem[]; totalActive: number; topIntegration: string; biggestGap: string; revenuePerIntegration: string; recommendations: string[]; }
export interface EnablementModule { module: string; audience: string; format: string; duration: string; outcome: string; priority: string; }
export interface PartnerEnablementProgram { summary: string; modules: EnablementModule[]; certificationPath: string; supportModel: string; successMetric: string; launchTimeline: string; recommendations: string[]; }
export interface GovernancePolicy { area: string; policy: string; enforcement: string; monitoring: string; risk: string; compliance: string; }
export interface PlatformGovernanceFramework { summary: string; policies: GovernancePolicy[]; overallMaturity: number; topRisk: string; complianceGap: string; securityPosture: string; recommendations: string[]; }

// ── Wave 105: Predictive Analytics Suite ──────────────────────────────────────
export interface DemandForecastItem { product: string; currentDemand: string; forecastDemand: string; confidence: number; seasonality: string; action: string; }
export interface DemandForecastingEngine { summary: string; forecasts: DemandForecastItem[]; overallAccuracy: number; topGrowth: string; topDecline: string; capacityAlert: string; recommendations: string[]; }
export interface MaintenanceAsset { asset: string; failureProbability: number; lastMaintenance: string; nextRecommended: string; costAvoidance: string; priority: string; }
export interface PredictiveMaintenanceModeling { summary: string; assets: MaintenanceAsset[]; totalSavings: string; criticalAsset: string; scheduleOptimization: string; downtimeReduction: string; recommendations: string[]; }
export interface ChurnRiskCustomer { segment: string; riskScore: number; signals: string; revenueAtRisk: string; intervention: string; timeline: string; }
export interface ChurnPredictionModel { summary: string; customers: ChurnRiskCustomer[]; overallChurnRate: string; totalAtRisk: string; topSignal: string; retentionROI: string; recommendations: string[]; }
export interface ScoredLead { source: string; score: number; conversionProbability: number; dealSize: string; bestChannel: string; nextAction: string; }
export interface LeadScoringAI { summary: string; leads: ScoredLead[]; avgScore: number; topSource: string; conversionRate: string; pipelineValue: string; recommendations: string[]; }
export interface InventoryItem { product: string; currentStock: string; optimalStock: string; reorderPoint: string; carryingCost: string; action: string; }
export interface InventoryOptimizationAI { summary: string; items: InventoryItem[]; totalSavings: string; stockoutRisk: string; overStockValue: string; turnoverRate: string; recommendations: string[]; }
export interface RevenuePrediction { period: string; predicted: string; confidence: number; drivers: string; risks: string; scenario: string; }
export interface RevenuePredictionModeling { summary: string; predictions: RevenuePrediction[]; annualForecast: string; growthRate: string; topDriver: string; topRisk: string; recommendations: string[]; }

// ── Wave 106: Organizational Design ───────────────────────────────────────────
export interface OrgUnit { unit: string; headcount: number; efficiency: number; alignment: string; issue: string; recommendation: string; }
export interface OrgStructureAnalysis { summary: string; units: OrgUnit[]; overallEfficiency: number; structureType: string; topIssue: string; redesignPriority: string; recommendations: string[]; }
export interface SpanMetric { level: string; avgSpan: number; optimal: number; overloaded: string; underUtilized: string; action: string; }
export interface SpanOfControlOptimization { summary: string; metrics: SpanMetric[]; overallSpan: number; topBottleneck: string; flatteningOpportunity: string; costImpact: string; recommendations: string[]; }
export interface DecisionArea { area: string; currentAuthority: string; proposedAuthority: string; bottleneck: string; speed: string; action: string; }
export interface DecisionRightsMapping { summary: string; areas: DecisionArea[]; overallClarity: number; topBottleneck: string; empowermentGap: string; speedImpact: string; recommendations: string[]; }
export interface CollaborationLink { team1: string; team2: string; frequency: string; effectiveness: number; siloRisk: string; improvement: string; }
export interface CollaborationNetworkMapping { summary: string; links: CollaborationLink[]; overallCollaboration: number; topSilo: string; strongestLink: string; weakestLink: string; recommendations: string[]; }
export interface RoleIssue { role: string; issue: string; overlap: string; gap: string; impact: string; resolution: string; }
export interface RoleOptimizationAnalysis { summary: string; issues: RoleIssue[]; overallClarity: number; topOverlap: string; criticalGap: string; consolidationSaving: string; recommendations: string[]; }
export interface SuccessionRole { role: string; incumbent: string; readiness: string; candidates: number; gap: string; developmentPlan: string; }
export interface SuccessionPlanningFramework { summary: string; roles: SuccessionRole[]; overallReadiness: number; criticalVacancy: string; talentDepth: string; developmentPriority: string; recommendations: string[]; }

// ── Wave 107: Social Impact & ESG ─────────────────────────────────────────────
export interface ImpactKPI { kpi: string; value: string; target: string; trend: string; stakeholder: string; action: string; }
export interface ImpactMeasurementDashboard { summary: string; kpis: ImpactKPI[]; overallImpact: number; topAchievement: string; biggestGap: string; socialROI: string; recommendations: string[]; }
export interface ESGDimension { dimension: string; score: number; framework: string; compliance: string; gap: string; action: string; }
export interface ESGReportingCompliance { summary: string; dimensions: ESGDimension[]; overallScore: number; complianceLevel: string; topRisk: string; reportingGap: string; recommendations: string[]; }
export interface ESGStakeholderGroup { group: string; engagement: number; sentiment: string; concerns: string; channel: string; action: string; }
export interface StakeholderEngagementAnalytics { summary: string; groups: ESGStakeholderGroup[]; overallEngagement: number; topConcern: string; strongestRelation: string; attentionNeeded: string; recommendations: string[]; }
export interface CommunityProgram { program: string; investment: string; impact: string; beneficiaries: string; roi: string; timeline: string; }
export interface CommunityInvestmentStrategy { summary: string; programs: CommunityProgram[]; totalInvestment: string; topProgram: string; communityNeed: string; partnerOpportunity: string; recommendations: string[]; }
export interface DiversityDimension { dimension: string; current: string; target: string; gap: string; trend: string; action: string; }
export interface DiversityMetricsAnalytics { summary: string; dimensions: DiversityDimension[]; overallScore: number; topStrength: string; biggestGap: string; payEquity: string; recommendations: string[]; }
export interface GreenInitiative { initiative: string; currentImpact: string; targetReduction: string; investment: string; timeline: string; roi: string; }
export interface GreenOperationsOptimization { summary: string; initiatives: GreenInitiative[]; carbonFootprint: string; energyEfficiency: number; topOpportunity: string; quickWin: string; recommendations: string[]; }

// ── Wave 108: Knowledge Management ────────────────────────────────────────────
export interface KnowledgeAsset { asset: string; type: string; criticality: string; accessibility: number; owner: string; action: string; }
export interface KnowledgeAuditAssessment { summary: string; assets: KnowledgeAsset[]; totalAssets: number; criticalAssets: number; accessibilityScore: number; topGap: string; recommendations: string[]; }
export interface ExpertiseArea { area: string; experts: number; demand: string; coverage: string; riskIfLost: string; action: string; }
export interface ExpertiseMappingSystem { summary: string; areas: ExpertiseArea[]; totalExperts: number; criticalArea: string; knowledgeRisk: string; mentorshipGap: string; recommendations: string[]; }
export interface DocArea { area: string; coverage: string; quality: number; staleness: string; owner: string; action: string; }
export interface DocumentationStrategyFramework { summary: string; areas: DocArea[]; overallCoverage: number; topGap: string; qualityScore: number; governanceModel: string; recommendations: string[]; }
export interface LearningPath { role: string; pathway: string; skills: string; duration: string; format: string; outcome: string; }
export interface LearningPathwaysDesign { summary: string; pathways: LearningPath[]; totalPaths: number; topPriority: string; skillGap: string; certificationPlan: string; recommendations: string[]; }
export interface KnowledgeRisk { area: string; holder: string; risk: string; impact: string; captureMethod: string; timeline: string; }
export interface InstitutionalMemoryProtection { summary: string; risks: KnowledgeRisk[]; overallRisk: number; criticalArea: string; captureUrgency: string; retentionPlan: string; recommendations: string[]; }
export interface TransferProcess { process: string; method: string; effectiveness: number; duration: string; gap: string; improvement: string; }
export interface KnowledgeTransferOptimization { summary: string; processes: TransferProcess[]; overallEffectiveness: number; topMethod: string; biggestGap: string; onboardingImpact: string; recommendations: string[]; }
