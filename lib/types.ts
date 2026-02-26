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

export interface CustomerSegment {
  tier: string;                // "Enterprise", "Mid-Market", "SMB", "Startup"
  name: string;                // "High-Value Accounts"
  customerCount: string;       // "~15 accounts"
  revenueShare: string;        // "68% of revenue"
  avgDealSize: string;
  churnRisk: "low" | "medium" | "high";
  growthPotential: "low" | "medium" | "high";
  idealProfile: string;        // "B2B SaaS companies, 50-200 employees, $5-20M revenue"
  engagementStrategy: string;
}

export interface CustomerSegmentation {
  segments: CustomerSegment[];
  idealCustomerProfile: { characteristic: string; importance: string }[];
  concentrationRisk: string;   // "Top 3 clients = 45% of revenue — HIGH RISK"
  expansionTargets: { segment: string; opportunity: string; estimatedRevenue: string }[];
  summary: string;
}

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
  customerSegmentation?: CustomerSegmentation;
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
  operationalEfficiency?: OperationalEfficiency;
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
  customerJourneyMap?: CustomerJourneyMap;
  complianceChecklist?: ComplianceChecklist;
  expansionPlaybook?: ExpansionPlaybook;
  vendorScorecard?: VendorScorecard;
  // Wave 7 features
  productMarketFit?: ProductMarketFit;
  brandHealth?: BrandHealth;
  pricingElasticity?: PricingElasticity;
  strategicInitiatives?: StrategicInitiatives;
  cashConversionCycle?: CashConversionCycle;
  innovationPipeline?: InnovationPipeline;
  // Wave 8 features
  stakeholderMap?: StakeholderMap;
  decisionLog?: DecisionLog;
  cultureAssessment?: CultureAssessment;
  ipPortfolio?: IPPortfolio;
  exitReadiness?: ExitReadiness;
  sustainabilityScore?: SustainabilityScore;
  // Wave 9 features
  acquisitionTargets?: AcquisitionTargets;
  financialRatios?: FinancialRatios;
  channelMixModel?: ChannelMixModel;
  supplyChainRisk?: SupplyChainRisk;
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
  customerHealthScore?: CustomerHealthScore;
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
  capacityPlanning?: CapacityPlanning;
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

export interface PartnerCandidate {
  name: string;
  type: "technology" | "distribution" | "strategic" | "content" | "referral";
  synergy: string;
  revenueImpact: string;
  approachStrategy: string;
  priority: "high" | "medium" | "low";
  contactSuggestion?: string;
}

export interface PartnershipOpportunities {
  partners: PartnerCandidate[];
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

export interface EfficiencyMetric {
  process: string;
  currentScore: number;     // 0-100
  industryBenchmark: number;
  gap: number;
  improvement: string;
  estimatedSavings: string;
  effort: "low" | "medium" | "high";
  priority: number;
}

export interface OperationalEfficiency {
  overallScore: number;
  metrics: EfficiencyMetric[];
  quickWins: string[];
  majorInitiatives: string[];
  estimatedTotalSavings: string;
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

export interface JourneyStage {
  name: string;                   // "Awareness", "Consideration", "Purchase", "Onboarding", "Retention", "Advocacy"
  description: string;
  touchpoints: string[];
  frictionPoints: string[];
  conversionRate?: string;
  dropOffRate?: string;
  improvements: string[];
}

export interface CustomerJourneyMap {
  summary: string;
  stages: JourneyStage[];
  criticalFrictionPoints: string[];
  quickWins: string[];
  longTermImprovements: string[];
  estimatedImpact: string;        // "Improving onboarding could increase retention by 15%"
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

export interface VendorAssessment {
  vendor: string;
  category: string;               // "Cloud Infrastructure", "Marketing Tools", "Payment Processing"
  annualCost: string;
  contractEnd?: string;
  satisfaction: number;            // 1-10
  alternatives: string[];
  potentialSaving: string;
  recommendation: "keep" | "renegotiate" | "replace" | "consolidate";
  notes: string;
}

export interface VendorScorecard {
  summary: string;
  totalVendorSpend: string;
  vendorCount: number;
  assessments: VendorAssessment[];
  consolidationOpportunities: string[];
  renegotiationTargets: string[];
  totalPotentialSavings: string;
  recommendations: string[];
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

export interface BrandDimension {
  dimension: string;              // "Awareness", "Perception", "Loyalty", "Differentiation"
  score: number;                  // 1-10
  insight: string;
  improvementAction: string;
}

export interface BrandHealth {
  summary: string;
  overallScore: number;           // 0-100
  brandStrength: "strong" | "developing" | "weak";
  dimensions: BrandDimension[];
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

export interface InnovationProject {
  name: string;
  description: string;
  stage: "ideation" | "validation" | "development" | "launch" | "scaling";
  investmentToDate: string;
  projectedRevenue: string;
  timeToMarket: string;
  riskLevel: "low" | "medium" | "high";
  keyAssumptions: string[];
}

export interface InnovationPipeline {
  summary: string;
  innovationScore: number;        // 0-100
  projects: InnovationProject[];
  portfolioBalance: string;       // "70% core, 20% adjacent, 10% transformational"
  totalInvestment: string;
  gapAreas: string[];
  recommendations: string[];
  innovationCulture: string;      // assessment of org's innovation readiness
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

export interface IPAsset {
  name: string;
  type: "patent" | "trademark" | "copyright" | "trade_secret" | "domain" | "software";
  status: "registered" | "pending" | "unprotected" | "expired";
  value: string;
  protectionStrategy: string;
  expirationDate?: string;
}

export interface IPPortfolio {
  summary: string;
  assets: IPAsset[];
  totalEstimatedValue: string;
  protectionGaps: string[];
  competitiveAdvantage: string;
  filingRecommendations: string[];
  risks: string[];
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

export interface AcquisitionTarget {
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
  targets: AcquisitionTarget[];
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

export interface SupplyChainNode {
  vendor: string;
  category: string;
  riskLevel: "high" | "medium" | "low";
  dependencyScore: number;        // 1-10
  alternativesAvailable: number;
  mitigationStrategy: string;
}

export interface SupplyChainRisk {
  summary: string;
  overallRiskScore: number;       // 0-100
  nodes: SupplyChainNode[];
  singlePointsOfFailure: string[];
  geographicConcentration: string[];
  contingencyPlans: string[];
  costOfDisruption: string;
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

export interface CustomerHealthIndicator {
  customer: string;
  healthScore: number;           // 0-100
  engagementLevel: "high" | "medium" | "low";
  revenueContribution: string;
  riskFactors: string[];
  growthPotential: string;
  lastInteraction: string;
}

export interface CustomerHealthScore {
  summary: string;
  overallPortfolioHealth: number; // 0-100
  customers: CustomerHealthIndicator[];
  atRiskCount: number;
  healthyCount: number;
  championCount: number;
  churnPredictors: string[];
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

export interface FunnelStage {
  stage: string;                 // "Awareness", "Interest", "Consideration", "Intent", "Purchase"
  volume: string;
  conversionRate: string;
  dropOffRate: string;
  avgTimeInStage: string;
  bottleneck: string;
}

export interface AcquisitionFunnel {
  summary: string;
  stages: FunnelStage[];
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

export interface ProcessBottleneck {
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
  processes: ProcessBottleneck[];
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

export interface CapacityDimension {
  resource: string;
  currentUtilization: string;
  maxCapacity: string;
  scalingTrigger: string;
  timeToScalingTrigger: string;
  headcountNeeded: number;
}

export interface CapacityPlanning {
  summary: string;
  overallUtilization: string;
  dimensions: CapacityDimension[];
  bottleneckResource: string;
  scalingTimeline: string;
  headcountPlan: { role: string; count: number; timeline: string }[];
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

export interface ComplianceArea {
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
  areas: ComplianceArea[];
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
