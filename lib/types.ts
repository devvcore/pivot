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
