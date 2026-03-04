export interface SectionGroup {
  id: string;
  label: string;
  description: string;
  sections: string[];
}

export const CHAPTER_GROUPS: Record<string, SectionGroup[]> = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: [
    { id: "overview", label: "Business Overview", description: "Health scores and executive summary", sections: ["healthScore", "executiveSummary", "kpis", "kpiReport", "benchmarkScore", "healthChecklist", "masteryDashboard"] },
    { id: "performance", label: "Performance Metrics", description: "Growth velocity and operational maturity", sections: ["growthVelocityScore", "operationalMaturity", "futureReadiness", "businessModelCanvas"] },
    { id: "forecasts", label: "Forecasts & Trends", description: "Trend analysis and demand forecasting", sections: ["kpiWatchlist", "trendForecast", "demandForecastingEngine", "benchmarkingEngine", "dataProvenance"] },
  ],

  // ── Financial Intelligence ────────────────────────────────────────────────
  financial: [
    { id: "cash", label: "Cash & Liquidity", description: "Cash position, runway, and treasury", sections: ["cashIntelligence", "cashOptimization", "cashFlowForecaster", "cashManagement", "cashBurnAnalysis", "cashConversionCycle", "cashReserveStrategy", "cashFlowSensitivity", "workingCapital", "workingCapitalOptimizer", "treasuryManagement", "creditManagement"] },
    { id: "revenue", label: "Revenue Intelligence", description: "Revenue health, forecasting, and attribution", sections: ["revenueLeakAnalysis", "revenueLeakDetector", "revenueLeakageDetection", "revenueForecast", "revenueForecasting", "revenueIntelligence", "revenuePrediction", "revenuePredictionModeling", "revenueAttribution", "revenuePerEmployee", "revenueQualityIndex", "revenueQualityScore", "revenueHealthIndex", "revenueRunRate", "revenueSourceMapping", "revenueDrivers", "revenueWaterfall"] },
    { id: "revenue-mix", label: "Revenue Composition", description: "Revenue streams, diversification, and subscriptions", sections: ["revenueDiversification", "revenueMixAnalysis", "revenueStreamMap", "unitEconomics", "revenueOps", "billingOptimization", "subscriptionHealth", "revenueRecognition", "contractIntelligence"] },
    { id: "profitability", label: "Profitability & Margins", description: "Margin analysis, cost drivers, and optimization", sections: ["profitDriverTree", "profitabilityMap", "grossMarginAnalysis", "marginOptimization", "marginWaterfall", "operatingLeverageIndex", "costStructureAnalysis", "costDriverAnalysis", "costIntelligence", "costAllocationModel"] },
    { id: "expenses", label: "Costs & Expenses", description: "Expense management and anomaly detection", sections: ["expenseManagement", "anomalyDetection", "invoiceAutomation", "paymentOptimization"] },
    { id: "planning", label: "Budget & Planning", description: "Financial models, budgets, and scenarios", sections: ["budgetPlanning", "budgetOptimizer", "financialModeling", "breakEvenModel"] },
    { id: "health", label: "Financial Health", description: "Ratios, benchmarks, and reporting", sections: ["financialResilienceScore", "financialRatios", "financialBenchmarking", "financialControls", "financialReporting"] },
    { id: "capital", label: "Capital & Debt", description: "Capital structure, debt, and tax strategy", sections: ["debtStructure", "debtStrategy", "capitalAllocation", "capitalStructure", "taxStrategy", "investmentPortfolio"] },
  ],

  // ── Customers & Revenue ───────────────────────────────────────────────────
  customers: [
    { id: "health", label: "Customer Health & Segments", description: "Segmentation, health scores, and sentiment", sections: ["customerSegmentation", "customerHealthScore", "customerHealthDashboard", "customerDnaProfile", "segmentProfitability", "sentimentAnalysis", "stakeholderSentiment", "cohortAnalysis", "customerMaturityModel"] },
    { id: "value", label: "Lifetime Value & Economics", description: "CLV, CAC, and unit economics", sections: ["clvAnalysis", "customerLifetimeValue", "lifetimeValueOptimization", "customerAcquisitionCost"] },
    { id: "churn", label: "Churn & Retention", description: "Churn prediction, at-risk customers, and retention", sections: ["churnPlaybook", "churnPrediction", "churnEarlyWarning", "atRiskCustomers", "retentionPlaybook", "churnRecoveryPlan", "winbackProgram"] },
    { id: "expansion", label: "Expansion & Upsell", description: "Account growth and expansion signals", sections: ["expansionSignals", "accountExpansionMap", "csExpansionPlaybook", "netRevenueRetention", "accountPenetration"] },
    { id: "onboarding", label: "Onboarding & Adoption", description: "Customer onboarding and feature adoption", sections: ["customerOnboardingMetrics", "adoptionScorecard", "valueRealization", "customerEffortScore", "customerEffortOptimizer"] },
    { id: "renewal", label: "Renewals & Accounts", description: "Renewal forecasting and account management", sections: ["renewalPlaybook", "renewalForecasting", "accountManagement", "accountIntelligence"] },
    { id: "support", label: "Support & Success Ops", description: "CS operations and support analytics", sections: ["customerSuccess", "csOperations", "supportTicketAnalysis", "supportTicketIntelligence"] },
    { id: "voice", label: "Voice of Customer", description: "Feedback, NPS, and customer journey", sections: ["customerVoice", "voiceOfCustomer", "feedbackLoop", "customerJourneyMap", "npsAnalysis", "npsActionPlan", "customerMilestones"] },
    { id: "advocacy", label: "Advocacy & Referrals", description: "Referral programs and customer advocacy", sections: ["customerAdvocacy", "advocacyProgram", "referralAnalytics", "referralEngine", "referralMechanism", "testimonialPipeline", "caseStudyFactory"] },
    { id: "intelligence", label: "Customer Intelligence", description: "Predictive models and loyalty", sections: ["customerIntelPlatform", "propensityModel", "loyaltyDriver", "loyaltyProgramDesign", "healthScoreModel", "customerAdvisoryBoard"] },
  ],

  // ── Market & Competition ──────────────────────────────────────────────────
  market: [
    { id: "competitive", label: "Competitive Intelligence", description: "Competitor analysis and tracking", sections: ["competitorAnalysis", "competitiveMoat", "competitorTracking", "competitiveWinLoss", "competitiveMonitoring", "competitivePriceTracker", "competitiveResponse", "competitiveBattlecards", "competitorMoveTracker", "competitiveWargame", "competitiveTimingModel", "competitivePositioning"] },
    { id: "market-intel", label: "Market Intelligence", description: "Market sizing, trends, and signals", sections: ["marketIntelligence", "marketSizing", "marketResearch", "industryTrends", "marketTiming", "marketTrendRadar", "marketSentimentIndex", "marketVelocity", "marketSignalRadar", "industryConvergenceMap", "industryBenchmarkIndex"] },
    { id: "pricing", label: "Pricing Strategy", description: "Pricing optimization and elasticity", sections: ["pricingIntelligence", "competitivePricingMatrix", "priceSensitivityModel", "priceElasticityModel", "dynamicPricingEngine", "pricingArchitecture", "pricingExperiment", "priceSensitivityIndex", "pricingStrategyMatrix", "priceOptimizationModel"] },
    { id: "entry", label: "Market Entry & Expansion", description: "Entry strategy and international readiness", sections: ["marketEntryStrategy", "marketPenetration", "marketEntryPlaybook", "internationalReadiness", "categoryCreation"] },
    { id: "disruption", label: "Disruption & Innovation", description: "Disruption signals and emerging tech", sections: ["disruptionRadar", "marketDisruptionModel", "firstMoverAnalysis", "emergingTechRadar", "defensibilityAudit", "pivotReadiness"] },
    { id: "ecosystem", label: "Ecosystem & Positioning", description: "Market positioning and ecosystem mapping", sections: ["ecosystemMap", "valuePropCanvas", "marketShareAnalysis", "demandSignalAnalysis", "competitiveIntelFeed", "websiteAnalysis", "gtmScorecard", "revenueModelAnalysis"] },
  ],

  // ── Growth & Strategy ─────────────────────────────────────────────────────
  growth: [
    { id: "strategy", label: "Strategy & Planning", description: "Strategic pillars and execution", sections: ["swotAnalysis", "strategicPillars", "strategicRoadmap", "strategicInitiatives", "strategyExecution", "strategicAlignment", "strategicBetting"] },
    { id: "execution", label: "Goals & Execution", description: "OKRs, milestones, and tracking", sections: ["actionPlan", "goalTracker", "milestoneTracker", "executionCadence", "initiativeTracking", "okrCascade", "okrFramework", "alignmentIndex"] },
    { id: "growth-engine", label: "Growth Playbooks", description: "Growth levers, corridors, and experiments", sections: ["growthPlaybook", "growthCorridors", "growthExperiments", "growthLeverAssessment", "expansionPlaybook"] },
    { id: "decisions", label: "Decisions & Scenarios", description: "Decision frameworks and scenario planning", sections: ["decisionBrief", "decisionLog", "scenarioPlanner", "scenarioPlanning", "changeManagement"] },
    { id: "funding", label: "Funding & Investors", description: "Fundraising, investor relations, and valuation", sections: ["fundingReadiness", "fundingScenarioModel", "fundraisingStrategy", "fundraisingReadiness", "investorOnePager", "investorDeck", "investorReadiness", "investorCommunication", "investmentReadinessGate", "fundingTimeline", "valuationModel"] },
    { id: "board", label: "Board & Governance", description: "Board reporting and cap table", sections: ["boardDeck", "boardReporting", "boardGovernance", "capTableManagement", "captableManagement", "stakeholderMap"] },
    { id: "exit", label: "Exit & M&A", description: "Exit planning and readiness", sections: ["exitReadiness", "exitPlanning", "exitStrategy", "maReadiness"] },
    { id: "innovation", label: "Innovation & R&D", description: "Innovation pipeline and experiments", sections: ["innovationPipeline", "innovationScoring", "ideaPipeline", "patentAnalysis", "businessModelInnovation", "monetizationExperiment", "valueCapture", "experimentBoard", "disruptionPlaybook", "futureProofing", "productMarketFit", "roadmap", "resourceAllocationModel"] },
  ],

  // ── Marketing & Brand ─────────────────────────────────────────────────────
  marketing: [
    { id: "strategy", label: "Marketing Strategy", description: "Overall marketing and GTM approach", sections: ["marketingStrategy", "demandGenEngine", "demandGenPlan", "channelStrategy", "channelActivation", "channelMixOptimization", "channelMixModel", "gtmCalendar", "launchReadiness"] },
    { id: "brand", label: "Brand & Positioning", description: "Brand health, equity, and messaging", sections: ["brandHealth", "brandPositionMap", "brandValuation", "brandHierarchy", "brandEquity", "brandEquityIndex", "brandConsistency", "brandStoryArc", "messagingFramework", "messageTesting", "visualBranding", "reputationAnalysis"] },
    { id: "content", label: "Content & Social", description: "Content strategy, social media, and engagement", sections: ["contentCalendar", "socialMediaCalendar", "contentEngagement", "contentMarketingRoi", "socialListening", "communityHealth", "thoughtLeadership", "thoughtLeadershipPlan", "pressStrategy"] },
    { id: "digital", label: "Digital & Performance", description: "SEO, paid media, and conversion", sections: ["digitalPresence", "seoStrategy", "paidMediaOptimization", "emailMarketing", "conversionOptimization", "abTestingFramework", "webAnalytics", "digitalMaturityIndex", "digitalMaturity"] },
    { id: "attribution", label: "Attribution & ROI", description: "Marketing ROI and attribution", sections: ["marketingAttribution", "eventRoi", "influencerStrategy", "crossSellEngine", "promotionEffectiveness", "sentimentDashboard", "mediaShareOfVoice"] },
    { id: "campaigns", label: "Campaigns & Launch", description: "Campaign planning and crisis readiness", sections: ["crisisCommsReadiness", "pitchDeckAnalysis", "leadReport", "uxResearch"] },
  ],

  // ── Operations & Team ─────────────────────────────────────────────────────
  operations: [
    { id: "efficiency", label: "Operational Efficiency", description: "Process optimization and automation", sections: ["operationalEfficiency", "processEfficiency", "processAutomation", "workflowAutomation", "processDigitization", "automationAudit", "toolConsolidation", "toolsAutomationPlan", "documentManagement", "meetingEfficiency", "meetingCulture", "decisionEfficiency"] },
    { id: "tech", label: "Technology & Infrastructure", description: "Tech stack, APIs, and digital transformation", sections: ["techOptimization", "techStackAudit", "apiStrategy", "apiPerformance", "platformScalability", "dataStrategy", "digitalTransformation", "aiUseCases", "scalabilityAssessment", "incidentReadiness"] },
    { id: "product", label: "Product & Engineering", description: "Product roadmap, features, and quality", sections: ["featurePrioritization", "productAnalytics", "productUsageAnalytics", "productRoadmapHealth", "featureRoadmap", "productVision", "productInsights", "pmfAssessment", "userOnboarding", "releaseStrategy", "releaseVelocity", "techDebtAssessment", "techDebtPrioritization", "bugTrendAnalysis", "userExperienceScore", "qualityMetrics", "qualityAssurance"] },
    { id: "talent", label: "Talent & Hiring", description: "Recruitment, skills, and employer brand", sections: ["hiringPlan", "talentGapAnalysis", "talentAcquisitionFunnel", "talentPipeline", "talentMarketIntel", "recruitmentFunnel", "employerBrand", "employerBranding", "skillsGapAnalysis", "skillsInventory", "compensationBenchmark", "compensationStrategy", "compensationPhilosophy"] },
    { id: "people", label: "People & Culture", description: "Engagement, culture, and workforce planning", sections: ["cultureAssessment", "cultureAlignment", "employeeEngagement", "diversityMetrics", "workforcePlanning", "workforceAnalytics", "remoteWorkEffectiveness", "hybridWorkModel", "burnoutRisk", "learningDevelopment", "employeeLifecycleMap"] },
    { id: "leadership", label: "Leadership & Organization", description: "Team performance and succession planning", sections: ["teamPerformance", "teamVelocity", "teamDynamicsAnalysis", "teamTopology", "leadershipDevelopment", "successionPlanning", "successionReadiness", "orgEffectiveness", "organizationalNetwork", "onboardingOptimization", "knowledgeManagement", "knowledgeCapital"] },
    { id: "sales-ops", label: "Sales Operations", description: "Sales playbooks, pipeline, and territory", sections: ["salesPlaybook", "salesEnablement", "salesForecasting", "salesMotionDesign", "salesCompensation", "salesCollateral", "pipelineManagement", "dealAnalytics", "dealVelocity", "territoryOptimization", "territoryPlanning", "subscriptionMetrics"] },
    { id: "vendors", label: "Vendors & Capacity", description: "Vendor management and capacity planning", sections: ["vendorScorecard", "vendorNegotiation", "costBenchmark", "capacityPlanning", "ipPortfolio", "operationalRisk"] },
    { id: "integrations", label: "Integrations & Live Data", description: "Connected tool insights, communication health, and employee analytics", sections: ["integrationInsights", "employeeAnalytics", "communicationHealth"] },
  ],

  // ── Risk & Compliance ─────────────────────────────────────────────────────
  risk: [
    { id: "risk-mgmt", label: "Risk Management", description: "Risk register, issues, and crisis response", sections: ["riskRegister", "issuesRegister", "crisisPlaybook", "crisisManagement", "crisisCommunication", "operationalResilience", "contingencyPlanning", "businessContinuity", "incidentResponse"] },
    { id: "compliance", label: "Compliance & Regulatory", description: "Compliance frameworks and regulatory landscape", sections: ["complianceChecklist", "complianceScorecard", "regulatoryLandscape", "regulatoryRisk", "regulatoryCompliance", "regulatoryCalendar", "regulatoryHorizon", "policyCompliance", "complianceAutomation", "privacyCompliance", "auditReadiness", "auditTrail"] },
    { id: "legal", label: "Legal & IP", description: "Legal risk, contracts, and intellectual property", sections: ["contractManagement", "contractLifecycle", "ipStrategy", "intellectualPropertyAudit", "legalSpendAnalysis", "legalRiskRegister"] },
    { id: "security", label: "Security & Data", description: "Cybersecurity, data governance, and privacy", sections: ["cybersecurityPosture", "penetrationTesting", "securityAwareness", "accessControl", "dataClassification", "dataPrivacy", "dataGovernance"] },
    { id: "esg", label: "ESG & Sustainability", description: "Environmental, social, and governance metrics", sections: ["esgScorecard", "esgReportingCompliance", "carbonFootprint", "carbonReduction", "sustainabilityScore", "sustainableInnovation", "greenOperationsOptimization", "circularEconomy", "waterManagement", "wasteReduction"] },
    { id: "stakeholders", label: "Stakeholders & Community", description: "Stakeholder engagement and community impact", sections: ["stakeholderMapping", "stakeholderEngagementAnalytics", "communityImpact", "communityInvestmentStrategy", "socialImpact", "diversityMetricsAnalytics", "impactMeasurementDashboard", "changeManagementScore"] },
    { id: "communications", label: "Communications", description: "Internal and investor communications", sections: ["internalComms", "investorNarrative", "ethicsFramework"] },
  ],
};

/** Get populated groups for a chapter, filtering out groups with no data */
export function getPopulatedGroups(
  chapterId: string,
  deliverables: Record<string, unknown>,
): { group: SectionGroup; populatedSections: string[] }[] {
  const groups = CHAPTER_GROUPS[chapterId];
  if (!groups) return [];

  return groups
    .map(group => ({
      group,
      populatedSections: group.sections.filter(key => {
        const data = deliverables[key];
        return data != null && data !== "" && typeof data === "object";
      }),
    }))
    .filter(g => g.populatedSections.length > 0);
}
