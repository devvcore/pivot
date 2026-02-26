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
