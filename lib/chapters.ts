import {
  BarChart3, DollarSign, Users, Target, Sparkles,
  Megaphone, Zap, ShieldAlert,
} from "lucide-react";

export interface Chapter {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Keys of MVPDeliverables sections that belong to this chapter */
  sections: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "dashboard",
    label: "Executive Dashboard",
    description: "Business health at a glance",
    icon: BarChart3,
    sections: [
      "healthScore", "executiveSummary", "kpis", "kpiReport", "benchmarkScore",
      "healthChecklist", "masteryDashboard", "growthVelocityScore",
      "operationalMaturity", "futureReadiness", "businessModelCanvas",
      "kpiWatchlist", "trendForecast", "demandForecastingEngine",
      "benchmarkingEngine", "dataProvenance",
    ],
  },
  {
    id: "financial",
    label: "Financial Intelligence",
    description: "Cash, revenue, and financial health",
    icon: DollarSign,
    sections: [
      "cashIntelligence", "revenueLeakAnalysis", "revenueForecast", "unitEconomics",
      "cashOptimization", "revenueAttribution", "revenueDiversification",
      "revenueIntelligence", "cashFlowForecaster", "profitDriverTree",
      "revenueQualityIndex", "financialResilienceScore", "workingCapitalOptimizer",
      "revenueRunRate", "breakEvenModel", "operatingLeverageIndex",
      "grossMarginAnalysis", "budgetPlanning", "cashManagement",
      "expenseManagement", "revenueForecasting", "costStructureAnalysis",
      "revenueMixAnalysis", "revenueStreamMap", "costDriverAnalysis",
      "revenueLeakDetector", "revenueLeakageDetection", "anomalyDetection",
      "revenuePrediction", "revenuePredictionModeling", "cashConversionCycle",
      "financialControls", "financialReporting", "creditManagement",
      "debtStructure", "treasuryManagement", "invoiceAutomation",
      "paymentOptimization", "revenueWaterfall", "financialRatios",
      "cashBurnAnalysis", "revenuePerEmployee", "financialBenchmarking",
      "investmentPortfolio", "costAllocationModel", "marginWaterfall",
      "capitalAllocation", "capitalStructure", "financialModeling",
      "profitabilityMap", "costIntelligence", "revenueQualityScore",
      "cashReserveStrategy", "cashFlowSensitivity", "budgetOptimizer",
      "revenueDrivers", "marginOptimization", "workingCapital",
      "debtStrategy", "taxStrategy", "revenueOps", "billingOptimization",
      "contractIntelligence", "revenueRecognition", "subscriptionHealth",
      "revenueHealthIndex", "revenueSourceMapping",
    ],
  },
  {
    id: "customers",
    label: "Customers & Revenue",
    description: "Customer insights, retention, and growth",
    icon: Users,
    sections: [
      "atRiskCustomers", "customerSegmentation", "clvAnalysis",
      "retentionPlaybook", "churnPlaybook", "customerJourneyMap",
      "npsActionPlan", "customerHealthScore", "customerLifetimeValue",
      "sentimentAnalysis", "segmentProfitability", "referralAnalytics",
      "supportTicketAnalysis", "customerSuccess", "accountManagement",
      "accountPenetration", "customerAdvisoryBoard", "customerHealthDashboard",
      "customerDnaProfile", "propensityModel", "churnEarlyWarning",
      "customerEffortOptimizer", "loyaltyDriver", "accountIntelligence",
      "customerMaturityModel", "expansionSignals", "adoptionScorecard",
      "stakeholderSentiment", "valueRealization", "renewalPlaybook",
      "customerAcquisitionCost", "lifetimeValueOptimization", "churnPrediction",
      "netRevenueRetention", "customerAdvocacy", "feedbackLoop",
      "cohortAnalysis", "customerOnboardingMetrics", "healthScoreModel",
      "csExpansionPlaybook", "renewalForecasting", "csOperations",
      "customerMilestones", "customerVoice", "customerEffortScore",
      "accountExpansionMap", "loyaltyProgramDesign", "npsAnalysis",
      "supportTicketIntelligence", "voiceOfCustomer", "customerIntelPlatform",
      "referralEngine", "testimonialPipeline", "caseStudyFactory",
      "advocacyProgram", "referralMechanism", "npsActionPlan",
      "churnRecoveryPlan", "winbackProgram",
    ],
  },
  {
    id: "market",
    label: "Market & Competition",
    description: "Competitive landscape and market position",
    icon: Target,
    sections: [
      "competitorAnalysis", "competitiveMoat", "marketIntelligence",
      "marketSizing", "websiteAnalysis", "pricingIntelligence",
      "competitorTracking", "competitiveWinLoss", "gtmScorecard",
      "marketResearch", "industryTrends", "marketTiming",
      "competitiveIntelFeed", "marketEntryStrategy", "marketPenetration",
      "competitiveMonitoring", "marketTrendRadar", "industryBenchmarkIndex",
      "priceSensitivityModel", "demandSignalAnalysis", "competitivePositioning",
      "marketShareAnalysis", "valuePropCanvas", "competitivePricingMatrix",
      "marketSentimentIndex", "disruptionRadar", "ecosystemMap",
      "categoryCreation", "marketVelocity", "marketEntryPlaybook",
      "internationalReadiness", "revenueModelAnalysis",
      "competitiveWargame", "marketDisruptionModel", "firstMoverAnalysis",
      "defensibilityAudit", "pivotReadiness", "competitiveTimingModel",
      "marketSignalRadar", "competitorMoveTracker", "industryConvergenceMap",
      "emergingTechRadar", "competitivePriceTracker", "competitiveResponse",
      "competitiveBattlecards", "priceElasticityModel", "dynamicPricingEngine",
      "pricingArchitecture", "pricingExperiment", "priceSensitivityIndex",
      "pricingStrategyMatrix", "priceOptimizationModel",
    ],
  },
  {
    id: "growth",
    label: "Growth & Strategy",
    description: "Strategic planning and growth playbooks",
    icon: Sparkles,
    sections: [
      "swotAnalysis", "actionPlan", "decisionBrief", "goalTracker",
      "milestoneTracker", "scenarioPlanner", "roadmap", "expansionPlaybook",
      "fundingReadiness", "investorOnePager", "boardDeck", "productMarketFit",
      "strategicInitiatives", "innovationPipeline", "stakeholderMap",
      "decisionLog", "exitReadiness", "strategicRoadmap", "growthPlaybook",
      "fundingScenarioModel", "strategyExecution", "initiativeTracking",
      "resourceAllocationModel", "strategicBetting", "executionCadence",
      "alignmentIndex", "okrCascade", "okrFramework", "strategicPillars",
      "growthCorridors", "growthExperiments", "growthLeverAssessment",
      "changeManagement", "scenarioPlanning", "investorReadiness",
      "maReadiness", "strategicAlignment", "investorDeck", "fundingTimeline",
      "valuationModel", "capTableManagement", "investorCommunication",
      "boardReporting", "fundraisingStrategy", "captableManagement",
      "exitPlanning", "boardGovernance", "exitStrategy", "fundraisingReadiness",
      "investmentReadinessGate", "businessModelInnovation", "monetizationExperiment",
      "valueCapture", "experimentBoard", "disruptionPlaybook", "futureProofing",
      "innovationScoring", "ideaPipeline", "patentAnalysis",
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Brand",
    description: "Marketing strategy, brand health, and digital presence",
    icon: Megaphone,
    sections: [
      "marketingStrategy", "brandHealth", "socialMediaCalendar",
      "contentCalendar", "digitalPresence", "channelStrategy",
      "emailMarketing", "conversionOptimization", "abTestingFramework",
      "marketingAttribution", "demandGenEngine", "contentMarketingRoi",
      "seoStrategy", "paidMediaOptimization", "eventRoi",
      "influencerStrategy", "socialListening", "webAnalytics",
      "uxResearch", "brandPositionMap", "brandValuation",
      "brandHierarchy", "reputationAnalysis", "messagingFramework",
      "visualBranding", "brandEquity", "brandEquityIndex",
      "sentimentDashboard", "mediaShareOfVoice", "thoughtLeadership",
      "brandConsistency", "channelMixOptimization", "crossSellEngine",
      "promotionEffectiveness", "crisisCommsReadiness",
      "gtmCalendar", "launchReadiness", "messageTesting",
      "demandGenPlan", "channelActivation", "contentEngagement",
      "communityHealth", "pressStrategy", "thoughtLeadershipPlan",
      "brandStoryArc", "digitalMaturityIndex", "digitalMaturity",
      "channelMixModel", "pitchDeckAnalysis", "leadReport",
    ],
  },
  {
    id: "operations",
    label: "Operations & Team",
    description: "Operational efficiency, technology, and people",
    icon: Zap,
    sections: [
      "operationalEfficiency", "techOptimization", "hiringPlan",
      "talentGapAnalysis", "vendorScorecard", "cultureAssessment",
      "ipPortfolio", "processEfficiency", "capacityPlanning",
      "qualityMetrics", "knowledgeManagement", "teamPerformance",
      "employeeEngagement", "talentAcquisitionFunnel", "compensationBenchmark",
      "successionPlanning", "diversityMetrics", "employerBrand",
      "workforcePlanning", "skillsGapAnalysis", "remoteWorkEffectiveness",
      "teamVelocity", "burnoutRisk", "learningDevelopment",
      "processAutomation", "costBenchmark", "vendorNegotiation",
      "scalabilityAssessment", "incidentReadiness", "operationalRisk",
      "aiUseCases", "dataStrategy", "digitalTransformation",
      "featurePrioritization", "productUsageAnalytics", "techStackAudit",
      "apiStrategy", "platformScalability", "userOnboarding",
      "techDebtAssessment", "techDebtPrioritization", "releaseVelocity",
      "bugTrendAnalysis", "apiPerformance", "userExperienceScore",
      "productRoadmapHealth", "productAnalytics", "productVision",
      "featureRoadmap", "pmfAssessment", "productInsights",
      "releaseStrategy", "talentPipeline", "leadershipDevelopment",
      "successionReadiness", "compensationStrategy", "workforceAnalytics",
      "orgEffectiveness", "salesMotionDesign", "dealAnalytics",
      "territoryOptimization", "salesCompensation", "teamTopology",
      "onboardingOptimization", "meetingCulture", "documentManagement",
      "workflowAutomation", "qualityAssurance", "automationAudit",
      "processDigitization", "toolConsolidation", "recruitmentFunnel",
      "employerBranding", "talentMarketIntel", "employeeLifecycleMap",
      "skillsInventory", "teamDynamicsAnalysis", "hybridWorkModel",
      "compensationPhilosophy", "organizationalNetwork", "decisionEfficiency",
      "meetingEfficiency", "knowledgeCapital", "cultureAlignment",
      "salesPlaybook", "salesEnablement", "salesForecasting",
      "pipelineManagement", "dealVelocity", "territoryPlanning",
      "salesCollateral", "subscriptionMetrics",
      "toolsAutomationPlan",
    ],
  },
  {
    id: "risk",
    label: "Risk & Compliance",
    description: "Risk management, issues, and regulatory compliance",
    icon: ShieldAlert,
    sections: [
      "riskRegister", "issuesRegister", "complianceChecklist",
      "regulatoryLandscape", "crisisPlaybook", "complianceScorecard",
      "regulatoryRisk", "contractManagement", "ipStrategy",
      "legalSpendAnalysis", "policyCompliance", "auditReadiness",
      "contractLifecycle", "complianceAutomation", "legalRiskRegister",
      "intellectualPropertyAudit", "regulatoryCalendar", "privacyCompliance",
      "incidentResponse", "accessControl", "auditTrail",
      "penetrationTesting", "securityAwareness", "dataClassification",
      "cybersecurityPosture", "regulatoryCompliance", "businessContinuity",
      "ethicsFramework", "dataPrivacy", "dataGovernance",
      "regulatoryHorizon", "esgScorecard", "carbonFootprint",
      "socialImpact", "crisisManagement", "operationalResilience",
      "stakeholderMapping", "contingencyPlanning", "crisisCommunication",
      "internalComms", "investorNarrative", "sustainabilityScore",
      "carbonReduction", "circularEconomy", "communityImpact",
      "waterManagement", "wasteReduction", "sustainableInnovation",
      "impactMeasurementDashboard", "esgReportingCompliance",
      "stakeholderEngagementAnalytics", "communityInvestmentStrategy",
      "diversityMetricsAnalytics", "greenOperationsOptimization",
      "changeManagementScore",
    ],
  },
];

/**
 * Find which chapter a section key belongs to.
 * Returns the chapter id, or null if not mapped (shouldn't happen).
 */
export function getChapterForSection(sectionKey: string): string | null {
  for (const ch of CHAPTERS) {
    if (ch.sections.includes(sectionKey)) return ch.id;
  }
  return null;
}

/**
 * Given deliverables, return only chapters that have at least one populated section.
 */
export function getPopulatedChapters(
  deliverables: Record<string, unknown>,
  selectedSections?: string[],
): Chapter[] {
  const selected = selectedSections ? new Set(selectedSections) : null;

  return CHAPTERS.filter(ch => {
    return ch.sections.some(key => {
      const hasData = deliverables[key] != null && deliverables[key] !== "";
      const isSelected = !selected || selected.has(key);
      return hasData && isSelected;
    });
  });
}
