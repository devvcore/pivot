// @ts-nocheck
/**
 * Pivot Pipeline Runner — resumable
 *
 * Each stage persists its output before moving on. If the pipeline crashes,
 * calling runPipeline again on the same runId picks up where it left off.
 */
import { getJob, updateJob } from "@/lib/job-store";
import { parseFiles } from "./parse";
import { ingestDocuments } from "./ingest";
import { categorizeAndBuildGraph } from "./categorize";
import { getRelevantSections, scoreSectionRelevance, getRelevanceDepth } from "./relevance";
import {
  synthesizeDeliverables,
  synthesizeTechOptimization,
  synthesizePricingIntelligence,
  synthesizeKPIs,
  synthesizeRoadmap,
  synthesizeHealthChecklist,
  synthesizeSWOT,
  synthesizeUnitEconomics,
  synthesizeCustomerSegmentation,
  synthesizeCompetitiveWinLoss,
  synthesizeInvestorOnePager,
  synthesizeHiringPlan,
  synthesizeRevenueForecast,
  synthesizeChurnPlaybook,
  synthesizeSalesPlaybook,
  synthesizeGoalTracker,
  synthesizeBenchmarkScore,
  synthesizeExecutiveSummary,
  synthesizeMilestoneTracker,
  synthesizeRiskRegister,
  synthesizePartnershipOpportunities,
  synthesizeFundingReadiness,
  synthesizeMarketSizing,
  synthesizeScenarioPlanner,
  synthesizeOperationalEfficiency,
  synthesizeCLVAnalysis,
  synthesizeRetentionPlaybook,
  synthesizeRevenueAttribution,
  synthesizeBoardDeck,
  synthesizeCompetitiveMoat,
  synthesizeGTMScorecard,
  synthesizeCashOptimization,
  synthesizeTalentGapAnalysis,
  synthesizeRevenueDiversification,
  synthesizeCustomerJourneyMap,
  synthesizeComplianceChecklist,
  synthesizeExpansionPlaybook,
  synthesizeVendorScorecard,
  synthesizeProductMarketFit,
  synthesizeBrandHealth,
  synthesizePricingElasticity,
  synthesizeStrategicInitiatives,
  synthesizeCashConversionCycle,
  synthesizeInnovationPipeline,
  synthesizeStakeholderMap,
  synthesizeDecisionLog,
  synthesizeCultureAssessment,
  synthesizeIPPortfolio,
  synthesizeExitReadiness,
  synthesizeSustainabilityScore,
  synthesizeAcquisitionTargets,
  synthesizeFinancialRatios,
  synthesizeChannelMixModel,
  synthesizeSupplyChainRisk,
  synthesizeRegulatoryLandscape,
  synthesizeCrisisPlaybook,
  synthesizeAIReadiness,
  synthesizeNetworkEffects,
  synthesizeDataMonetization,
  synthesizeSubscriptionMetrics,
  synthesizeMarketTiming,
  synthesizeScenarioStressTest,
  synthesizePricingStrategyMatrix,
  synthesizeCustomerHealthScore,
  synthesizeRevenueWaterfall,
  synthesizeTechDebtAssessment,
  synthesizeTeamPerformance,
  synthesizeMarketEntryStrategy,
  synthesizeCompetitiveIntelFeed,
  synthesizeCashFlowSensitivity,
  synthesizeDigitalMaturity,
  synthesizeAcquisitionFunnel,
  synthesizeStrategicAlignment,
  synthesizeBudgetOptimizer,
  synthesizeRevenueDrivers,
  synthesizeMarginOptimization,
  synthesizeDemandForecasting,
  synthesizeCohortAnalysis,
  synthesizeWinLossAnalysis,
  synthesizeSalesForecast,
  synthesizeProcessEfficiency,
  synthesizeVendorRisk,
  synthesizeQualityMetrics,
  synthesizeCapacityPlanning,
  synthesizeKnowledgeManagement,
  synthesizeComplianceScorecard,
  synthesizeMarketPenetration,
  synthesizeFlywheelAnalysis,
  synthesizePartnershipsStrategy,
  synthesizeInternationalExpansion,
  synthesizeRDEffectiveness,
  synthesizeBrandEquity,
  synthesizeWorkingCapital,
  synthesizeDebtStrategy,
  synthesizeTaxStrategy,
  synthesizeInvestorReadiness,
  synthesizeMAReadiness,
  synthesizeStrategicRoadmap,
  // Wave 17
  synthesizeCustomerVoice,
  synthesizeReferralEngine,
  synthesizePriceSensitivityIndex,
  synthesizeCustomerEffortScore,
  synthesizeAccountExpansionMap,
  synthesizeLoyaltyProgramDesign,
  // Wave 18
  synthesizeCompetitivePricingMatrix,
  synthesizeMarketSentimentIndex,
  synthesizeDisruptionRadar,
  synthesizeEcosystemMap,
  synthesizeCategoryCreation,
  synthesizeMarketVelocity,
  // Wave 19
  synthesizeOKRCascade,
  synthesizeMeetingEffectiveness,
  synthesizeCommunicationAudit,
  synthesizeDecisionVelocity,
  synthesizeResourceOptimizer,
  synthesizeChangeManagement,
  // Wave 20
  synthesizeCashReserveStrategy,
  synthesizeRevenueQualityScore,
  synthesizeCostIntelligence,
  synthesizeFinancialModeling,
  synthesizeProfitabilityMap,
  synthesizeCapitalAllocation,
  // Wave 21
  synthesizeSalesPipelineHealth,
  synthesizeDealVelocity,
  synthesizeWinRateOptimizer,
  synthesizeSalesEnablement,
  synthesizeTerritoryPlanning,
  synthesizeQuotaIntelligence,
  // Wave 22
  synthesizeFeaturePrioritization,
  synthesizeProductUsageAnalytics,
  synthesizeTechStackAudit,
  synthesizeApiStrategy,
  synthesizePlatformScalability,
  synthesizeUserOnboarding,
  // Wave 23
  synthesizeEmployeeEngagement,
  synthesizeTalentAcquisitionFunnel,
  synthesizeCompensationBenchmark,
  synthesizeSuccessionPlanning,
  synthesizeDiversityMetrics,
  synthesizeEmployerBrand,
  // Wave 24
  synthesizeDataGovernance,
  synthesizeAnalyticsMaturity,
  synthesizeCustomerDataPlatform,
  synthesizePredictiveModeling,
  synthesizeReportingFramework,
  synthesizeDataQualityScore,
  // Wave 25
  synthesizeInventoryOptimization,
  synthesizeQualityManagement,
  // Wave 26
  synthesizeNpsAnalysis,
  synthesizeSupportTicketIntelligence,
  synthesizeVoiceOfCustomer,
  // Wave 27
  synthesizeIpPortfolio,
  synthesizeRdEfficiency,
  synthesizeTechnologyReadiness,
  synthesizePartnershipEcosystem,
  synthesizeMergersAcquisitions,
  // Wave 28
  synthesizeEsgScorecard,
  synthesizeCarbonFootprint,
  synthesizeRegulatoryCompliance,
  synthesizeBusinessContinuity,
  synthesizeEthicsFramework,
  synthesizeSocialImpact,
  // Wave 29 (new functions only)
  synthesizeDealPipeline,
  synthesizeSalesForecasting,
  synthesizeAccountBasedMarketing,
  synthesizeCommissionOptimization,
  // Wave 30 (new functions only)
  synthesizeProductAnalytics,
  synthesizeCompetitiveResponse,
  // Wave 31 (new functions only)
  synthesizeScenarioPlanning,
  synthesizeCapitalStructure,
  synthesizeFundraisingReadiness,
  synthesizeExitStrategy,
  // Wave 32 (new functions only)
  synthesizeTalentAcquisition,
  synthesizeDiversityInclusion,
  // Wave 33
  synthesizeMarketEntryPlaybook,
  synthesizePartnerChannelStrategy,
  synthesizeAcquisitionIntegration,
  synthesizeInternationalReadiness,
  synthesizeRevenueModelAnalysis,
  synthesizeGrowthExperiments,
  // Wave 34
  synthesizeCustomerAcquisitionCost,
  synthesizeLifetimeValueOptimization,
  synthesizeChurnPrediction,
  synthesizeNetRevenueRetention,
  synthesizeCustomerAdvocacy,
  synthesizeFeedbackLoop,
  // Wave 35
  synthesizeProcessAutomation,
  synthesizeCostBenchmark,
  synthesizeVendorNegotiation,
  synthesizeScalabilityAssessment,
  synthesizeIncidentReadiness,
  synthesizeOperationalRisk,
  // Wave 36
  synthesizeDataStrategy,
  synthesizeAiUseCases,
  synthesizeAnalyticsRoadmap,
  synthesizeDataPrivacy,
  synthesizeMlOpsReadiness,
  synthesizeDigitalTransformation,
  // Wave 37
  synthesizeRevenueOps,
  synthesizeBillingOptimization,
  synthesizeContractIntelligence,
  synthesizeCommissionTracking,
  synthesizeRevenueRecognition,
  synthesizeSubscriptionHealth,
  // Wave 38
  synthesizeProductRoadmapHealth,
  synthesizeTechDebtPrioritization,
  synthesizeReleaseVelocity,
  synthesizeBugTrendAnalysis,
  synthesizeApiPerformance,
  synthesizeUserExperienceScore,
  // Wave 39
  synthesizeWorkforcePlanning,
  synthesizeSkillsGapAnalysis,
  synthesizeRemoteWorkEffectiveness,
  synthesizeTeamVelocity,
  synthesizeBurnoutRisk,
  synthesizeLearningDevelopment,
  // Wave 40
  synthesizeRegulatoryRisk,
  synthesizeContractManagement,
  synthesizeIpStrategy,
  synthesizeLegalSpendAnalysis,
  synthesizePolicyCompliance,
  synthesizeAuditReadiness,
  // Wave 41
  synthesizeSalesMethodology,
  synthesizePipelineVelocity,
  synthesizeDealQualification,
  synthesizeSalesCoaching,
  synthesizeAccountPlanning,
  synthesizeCompetitiveBattlecards,
  // Wave 42
  synthesizeCashBurnAnalysis,
  synthesizeRevenuePerEmployee,
  synthesizeFinancialBenchmarking,
  synthesizeInvestmentPortfolio,
  synthesizeCostAllocationModel,
  synthesizeMarginWaterfall,
  // Wave 43
  synthesizeCustomerOnboardingMetrics,
  synthesizeHealthScoreModel,
  synthesizeCsExpansionPlaybook,
  synthesizeRenewalForecasting,
  synthesizeCsOperations,
  synthesizeCustomerMilestones,
  // Wave 44
  synthesizeOkrFramework,
  synthesizeStrategicPillars,
  synthesizeCompetitivePositioning,
  synthesizeMarketShareAnalysis,
  synthesizeGrowthCorridors,
  synthesizeValuePropCanvas,
  // Wave 45
  synthesizeCompetitiveMonitoring,
  synthesizeMarketTrendRadar,
  synthesizeIndustryBenchmarkIndex,
  synthesizeCustomerIntelPlatform,
  synthesizePriceSensitivityModel,
  synthesizeDemandSignalAnalysis,
  // Wave 46
  synthesizeDigitalMaturityIndex,
  synthesizeCloudMigrationReadiness,
  synthesizeAutomationRoi,
  synthesizeDigitalWorkplace,
  synthesizeCybersecurityPosture,
  synthesizeTechVendorConsolidation,
  // Wave 47
  synthesizeRevenueSourceMapping,
  synthesizeChannelMixOptimization,
  synthesizeCrossSellEngine,
  synthesizePriceOptimizationModel,
  synthesizePromotionEffectiveness,
  synthesizeRevenueHealthIndex,
  // Wave 48
  synthesizeOrganizationalNetwork,
  synthesizeDecisionEfficiency,
  synthesizeMeetingEfficiency,
  synthesizeKnowledgeCapital,
  synthesizeChangeManagementScore,
  synthesizeCultureAlignment,
  // Wave 49
  synthesizePartnerPerformance,
  synthesizeEcosystemMapping,
  synthesizeAllianceStrategy,
  synthesizeChannelPartnerHealth,
  synthesizeCoSellingPipeline,
  synthesizeIntegrationMarketplace,
  // Wave 50
  synthesizeBrandEquityIndex,
  synthesizeSentimentDashboard,
  synthesizeMediaShareOfVoice,
  synthesizeCrisisCommsReadiness,
  synthesizeThoughtLeadership,
  synthesizeBrandConsistency,
  // Wave 51
  synthesizeMonetizationModel,
  synthesizeFreeTrialConversion,
  synthesizeUsageBasedPricing,
  synthesizeBundleOptimization,
  synthesizeDiscountDiscipline,
  synthesizeRevenueLeakageDetection,
  // Wave 52
  synthesizeCustomerAcademy,
  synthesizeContentEngagement,
  synthesizeCommunityHealth,
  synthesizeCertificationProgram,
  synthesizeSelfServiceAdoption,
  synthesizeSupportDeflection,
  // Wave 53
  synthesizeInvestorDeck,
  synthesizeFundingTimeline,
  synthesizeValuationModel,
  synthesizeCapTableManagement,
  synthesizeInvestorCommunication,
  synthesizeBoardReporting,
  // Wave 54
  synthesizeGeoExpansionStrategy,
  synthesizeLocalMarketEntry,
  synthesizeMarketRegulations,
  synthesizePartnerLocalization,
  synthesizeCulturalAdaptation,
  synthesizeExpansionRoi,
  // Wave 55
  synthesizeProductLedMetrics,
  synthesizeActivationFunnel,
  synthesizeFeatureAdoption,
  synthesizeVirality,
  synthesizeProductQualifiedLeads,
  synthesizeTimeToValue,
  // Wave 56
  synthesizeAiReadinessScore,
  synthesizeMlUseCasePriority,
  synthesizeDataInfrastructure,
  synthesizeAiTalentGap,
  synthesizeEthicalAiFramework,
  synthesizeAiRoiProjection,
  // Wave 57
  synthesizeAdvocacyProgram,
  synthesizeReferralMechanism,
  synthesizeTestimonialPipeline,
  synthesizeCaseStudyFactory,
  synthesizeCustomerAdvisoryBoard,
  synthesizeNpsActionPlan,
  // Wave 58
  synthesizeProcurementEfficiency,
  synthesizeExpenseManagement,
  synthesizeInvoiceAutomation,
  synthesizePaymentOptimization,
  synthesizeFinancialControls,
  synthesizeTreasuryManagement,
  // Wave 59
  synthesizeDemandGenEngine,
  synthesizeContentMarketingRoi,
  synthesizeSeoStrategy,
  synthesizePaidMediaOptimization,
  synthesizeEventRoi,
  synthesizeInfluencerStrategy,
  // Wave 60
  synthesizePlatformEconomics,
  synthesizeDeveloperExperience,
  synthesizeApiMonetization,
  synthesizeMarketplaceStrategy,
  synthesizePlatformGovernance,
  synthesizePlatformNetworkDynamics,
  // Wave 61
  synthesizeContractLifecycle,
  synthesizeComplianceAutomation,
  synthesizeLegalRiskRegister,
  synthesizeIntellectualPropertyAudit,
  synthesizeRegulatoryCalendar,
  synthesizePrivacyCompliance,
  // Wave 62
  synthesizeDataWarehouseStrategy,
  synthesizeBiDashboardDesign,
  synthesizePredictiveModelCatalog,
  synthesizeDataLineageMap,
  synthesizeMetricsDictionary,
  synthesizeAnalyticsGovernance,
  // Wave 63
  synthesizeEmployeeJourney,
  synthesizeWorkplaceWellness,
  synthesizeLearningPathways,
  synthesizePerformanceFramework,
  synthesizePayEquityAnalysis,
  synthesizeDeiBenchmark,
  // Wave 64
  synthesizeBusinessModelCanvas,
  synthesizeRevenueModelDesign,
  synthesizeValueChainOptimization,
  synthesizeCostStructureAnalysis,
  synthesizePartnershipModel,
  synthesizeGrowthLeverAssessment,
  // Wave 65
  synthesizeVendorManagement,
  synthesizeSupplyChainVisibility,
  synthesizeSustainableSourcing,
  synthesizeFacilityOptimization,
  synthesizeFleetManagement,
  synthesizeCustomerSuccess,
  // Wave 66
  synthesizeCrisisManagement,
  synthesizeOperationalResilience,
  synthesizeStakeholderMapping,
  synthesizeDigitalPresence,
  synthesizeChannelStrategy,
  synthesizeAccountManagement,
  // Wave 67
  synthesizeFundraisingStrategy,
  synthesizeCaptableManagement,
  synthesizeExitPlanning,
  synthesizeBoardGovernance,
  synthesizeRecruitmentFunnel,
  synthesizeEmployerBranding,
  // Wave 68
  synthesizeTeamTopology,
  synthesizeOnboardingOptimization,
  synthesizeMeetingCulture,
  synthesizeDocumentManagement,
  synthesizeWorkflowAutomation,
  synthesizeQualityAssurance,
  // Wave 69
  synthesizeIncidentResponse,
  synthesizeAccessControl,
  synthesizeAuditTrail,
  synthesizePenetrationTesting,
  synthesizeSecurityAwareness,
  synthesizeDataClassification,
  // Wave 70
  synthesizeApiDesign,
  synthesizeMicroservicesArchitecture,
  synthesizeCloudOptimization,
  synthesizeDevopsMaturity,
  synthesizeSystemMonitoring,
  synthesizeCodeQuality,
  // Wave 71
  synthesizeCustomerLifetimeValue,
  synthesizeSentimentAnalysis,
  synthesizeSupportTicketAnalysis,
  synthesizeSegmentProfitability,
  synthesizeReferralAnalytics,
  synthesizeCustomerHealthDashboard,
  // Wave 72
  synthesizeInnovationPortfolio,
  synthesizeContingencyPlanning,
  synthesizeOperatingRhythm,
  synthesizeCrossFunctionalSync,
  synthesizeWardRoomStrategy,
  synthesizeRevenueIntelligence,
  // Wave 73
  synthesizeMarketResearch,
  synthesizeCompetitorTracking,
  synthesizeIndustryTrends,
  synthesizeSocialListening,
  synthesizeUxResearch,
  synthesizeWebAnalytics,
  // Wave 74
  synthesizeEmailMarketing,
  synthesizeConversionOptimization,
  synthesizeAbTestingFramework,
  synthesizeMarketingAttribution,
  synthesizeContentCalendar,
  synthesizeSocialMediaCalendar,
  // Wave 75
  synthesizeBudgetPlanning,
  synthesizeRevenueForecasting,
  synthesizeCashManagement,
  synthesizeCreditManagement,
  synthesizeDebtStructure,
  synthesizeFinancialReporting,
  // Wave 76
  synthesizeCarbonReduction,
  synthesizeCircularEconomy,
  synthesizeCommunityImpact,
  synthesizeWaterManagement,
  synthesizeWasteReduction,
  synthesizeSustainableInnovation,
  // Wave 77
  synthesizeTalentPipeline,
  synthesizeLeadershipDevelopment,
  synthesizeSuccessionReadiness,
  synthesizeCompensationStrategy,
  synthesizeWorkforceAnalytics,
  synthesizeOrgEffectiveness,
  // Wave 78
  synthesizeSalesMotionDesign,
  synthesizeDealAnalytics,
  synthesizeTerritoryOptimization,
  synthesizeSalesCompensation,
  synthesizeRevenuePrediction,
  synthesizeAccountPenetration,
  // Wave 79
  synthesizeProductVision,
  synthesizeFeatureRoadmap,
  synthesizePmfAssessment,
  synthesizeUserActivation,
  synthesizeProductInsights,
  synthesizeReleaseStrategy,
  // Wave 80
  synthesizeBrandPositionMap,
  synthesizeBrandValuation,
  synthesizeBrandHierarchy,
  synthesizeReputationAnalysis,
  synthesizeMessagingFramework,
  synthesizeVisualBranding,
  // Wave 81
  synthesizeGrowthPlaybook,
  synthesizeRevenueRunRate,
  synthesizeBreakEvenModel,
  synthesizeOperatingLeverageIndex,
  synthesizeGrossMarginAnalysis,
  synthesizeFundingScenarioModel,
  // Wave 82
  synthesizeCompetitiveWargame,
  synthesizeMarketDisruptionModel,
  synthesizeFirstMoverAnalysis,
  synthesizeDefensibilityAudit,
  synthesizePivotReadiness,
  synthesizeCompetitiveTimingModel,
  // Wave 83
  synthesizeCustomerMaturityModel,
  synthesizeExpansionSignals,
  synthesizeAdoptionScorecard,
  synthesizeStakeholderSentiment,
  synthesizeValueRealization,
  synthesizeRenewalPlaybook,
  // Wave 84
  synthesizeBusinessModelInnovation,
  synthesizeMonetizationExperiment,
  synthesizePricingArchitecture,
  synthesizeRevenueStreamMap,
  synthesizeCostDriverAnalysis,
  synthesizeValueCapture,
  // Wave 85
  synthesizeRevenueProcessMap,
  synthesizeBillingHealthCheck,
  synthesizeQuoteToCloseAnalysis,
  synthesizeRevenueLeakDetector,
  synthesizeForecastAccuracyModel,
  synthesizeDealDeskOptimization,
  // Wave 86
  synthesizeTalentMarketIntel,
  synthesizeEmployeeLifecycleMap,
  synthesizeSkillsInventory,
  synthesizeTeamDynamicsAnalysis,
  synthesizeHybridWorkModel,
  synthesizeCompensationPhilosophy,
  // Wave 87
  synthesizeDataMaturityAssessment,
  synthesizeInsightsPrioritization,
  synthesizeExperimentVelocity,
  synthesizeDecisionIntelligence,
  synthesizeFeedbackIntelligence,
  synthesizeBenchmarkingEngine,
  // Wave 88
  synthesizePartnerValueMap,
  synthesizeCoInnovationPipeline,
  synthesizeEcosystemRevenue,
  synthesizeAllianceScorecard,
  synthesizePartnerEnablementPlan,
  synthesizeMarketplaceReadiness,
  // Wave 89
  synthesizeStrategyExecution,
  synthesizeInitiativeTracking,
  synthesizeResourceAllocationModel,
  synthesizeStrategicBetting,
  synthesizeExecutionCadence,
  synthesizeAlignmentIndex,
  // Wave 90
  synthesizeMarketSignalRadar,
  synthesizeCompetitorMoveTracker,
  synthesizeCustomerVoiceAggregator,
  synthesizeIndustryConvergenceMap,
  synthesizeEmergingTechRadar,
  synthesizeRegulatoryHorizon,
  // Wave 91
  synthesizeCashFlowForecaster,
  synthesizeProfitDriverTree,
  synthesizeRevenueQualityIndex,
  synthesizeFinancialResilienceScore,
  synthesizeWorkingCapitalOptimizer,
  synthesizeInvestmentReadinessGate,
  // Wave 92
  synthesizeCustomerDnaProfile,
  synthesizePropensityModel,
  synthesizeChurnEarlyWarning,
  synthesizeCustomerEffortOptimizer,
  synthesizeLoyaltyDriver,
  synthesizeAccountIntelligence,
  // Wave 93
  synthGtmCalendar, synthLaunchReadiness, synthMessageTesting, synthSalesCollateral, synthDemandGenPlan, synthChannelActivation,
  // Wave 94
  synthPriceElasticityModel, synthDynamicPricingEngine, synthDiscountImpactAnalysis, synthBundleDesigner, synthCompetitivePriceTracker, synthPricingExperiment,
  // Wave 95
  synthKpiWatchlist, synthAlertFramework, synthAnomalyDetection, synthTrendForecast, synthDashboardDesign, synthInsightsCatalog,
  // Wave 96
  synthIdeaPipeline, synthInnovationScoring, synthExperimentBoard, synthPatentAnalysis, synthDisruptionPlaybook, synthFutureProofing,
  // Wave 97
  synthRevenueMixAnalysis, synthAccountGrowthPlan, synthContractOptimizer, synthUsagePatternAnalysis, synthChurnRecoveryPlan, synthWinbackProgram,
  // Wave 98
  synthAutomationAudit, synthProcessDigitization, synthBotDeploymentPlan, synthWorkflowBenchmark, synthHandoffEfficiency, synthToolConsolidation,
  // Wave 99
  synthCrisisCommunication, synthInternalComms, synthInvestorNarrative, synthPressStrategy, synthThoughtLeadershipPlan, synthBrandStoryArc,
  // Wave 100
  synthMasteryDashboard, synthGrowthVelocityScore, synthOperationalMaturity, synthLeadershipReadiness, synthMarketDominanceIndex, synthFutureReadiness,
  // Wave 101
  synthAIAdoptionPotential, synthMLUseCaseIdentification, synthDataInfrastructureGapAnalysis, synthAutomationROIModeling, synthAITalentNeedsAssessment, synthEthicalAIFramework,
  // Wave 102
  synthMarketEntryScoring, synthRegulatoryLandscapeMapping, synthCulturalAdaptationStrategy, synthLogisticsExpansionAnalysis, synthLocalPartnershipStrategy, synthInternationalPricingOptimization,
  // Wave 103
  synthAcquisitionFunnelIntelligence, synthOnboardingEffectivenessScore, synthEngagementScoringModel, synthExpansionRevenueOpportunities, synthAdvocacyProgramDesign, synthLifetimeValueModeling,
  // Wave 104
  synthAPIMonetizationStrategy, synthPlatformEcosystemHealth, synthDeveloperExperienceOptimization, synthIntegrationMarketplaceAnalytics, synthPartnerEnablementProgram, synthPlatformGovernanceFramework,
  // Wave 105
  synthDemandForecastingEngine, synthPredictiveMaintenanceModeling, synthChurnPredictionModel, synthLeadScoringAI, synthInventoryOptimizationAI, synthRevenuePredictionModeling,
  // Wave 106
  synthOrgStructureAnalysis, synthSpanOfControlOptimization, synthDecisionRightsMapping, synthCollaborationNetworkMapping, synthRoleOptimizationAnalysis, synthSuccessionPlanningFramework,
  // Wave 107
  synthImpactMeasurementDashboard, synthESGReportingCompliance, synthStakeholderEngagementAnalytics, synthCommunityInvestmentStrategy, synthDiversityMetricsAnalytics, synthGreenOperationsOptimization,
  // Wave 108
  synthKnowledgeAuditAssessment, synthExpertiseMappingSystem, synthDocumentationStrategyFramework, synthLearningPathwaysDesign, synthInstitutionalMemoryProtection, synthKnowledgeTransferOptimization,
  setSectionFacts,
  synthesizeSummaryOnly,
} from "./synthesize";
import { GoogleGenAI } from "@google/genai";
import { detectTerminology } from "./terminology";
import { formatAndSave } from "./format";
import { validateFinancialClaims } from "./validate-claims";
import { analyzeWebsite } from "@/lib/agent/website-analyzer";
import { buildAgentMemory, saveWebsiteAnalysis } from "@/lib/agent/memory";
import {
  analyzeCompetitorWebsites,
  findIndustryLeaderUrls,
  buildCompetitorAnalysis,
} from "@/lib/agent/competitor-analyzer";
import {
  gatherSocialProfiles,
  synthesizeMarketingStrategy,
} from "@/lib/pipeline/marketing";
import { analyzePitchDeck } from "@/lib/agent/pitch-deck-analyzer";
import type { BusinessPacket, MVPDeliverables, WebsiteAnalysis } from "@/lib/types";

const RESUMABLE_ENTRY_STATUSES = new Set(["pending", "parsing", "ingesting", "synthesizing", "formatting", "failed"]);

async function runExtendedWaves(
  runId: string,
  deliverables: MVPDeliverables,
  businessPacket: BusinessPacket,
  job: any,
  relevantSections?: Set<string>,
): Promise<MVPDeliverables> {
    // Helper: skip sections not relevant to this business
    const isRelevant = (key: string) => !relevantSections || relevantSections.has(key);
    // Create genai instance for summary-mode synthesis
    const apiKey = process.env.GEMINI_API_KEY || "";
    const genai = apiKey ? new GoogleGenAI({ apiKey }) : null;
    // Wrapper: only call synthesis if section is relevant AND not already done
    // Uses graduated relevance depth: "full" runs the full synthesis, "summary" runs a lightweight summary, "skip" returns null
    const synthIf = <T>(key: string, fn: () => Promise<T | null>): Promise<T | null> => {
      if (!isRelevant(key)) return Promise.resolve(null);
      if ((deliverables as unknown as Record<string, unknown>)[key]) return Promise.resolve(null);
      const depth = getRelevanceDepth(scoreSectionRelevance(job.questionnaire, key));
      if (depth === "skip") return Promise.resolve(null);
      if (depth === "summary" && genai) return synthesizeSummaryOnly(genai, key, businessPacket, job.questionnaire) as any;
      return fn();
    };
    if (!deliverables.pricingStrategyMatrix || !deliverables.customerHealthScore) {
      try {
        console.log("[Pivot] Synthesizing pricing strategy matrix + customer health score...");
        const [psm, chs] = await Promise.allSettled([
          synthIf('pricingStrategyMatrix', () => synthesizePricingStrategyMatrix(businessPacket, job.questionnaire)),
          synthIf('customerHealthScore', () => synthesizeCustomerHealthScore(businessPacket, job.questionnaire)),
        ]);
        if (psm.status === "fulfilled" && psm.value) deliverables = { ...deliverables, pricingStrategyMatrix: psm.value };
        if (chs.status === "fulfilled" && chs.value) deliverables = { ...deliverables, customerHealthScore: chs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PricingStrategyMatrix/CustomerHealthScore failed (non-fatal):", e);
      }
    }

    // ── Step 4ab: Wave 11 intelligence (revenue waterfall, tech debt assessment) ──
    if (!deliverables.revenueWaterfall || !deliverables.techDebtAssessment) {
      try {
        console.log("[Pivot] Synthesizing revenue waterfall + tech debt assessment...");
        const [rw, td] = await Promise.allSettled([
          synthIf('revenueWaterfall', () => synthesizeRevenueWaterfall(businessPacket, job.questionnaire)),
          synthIf('techDebtAssessment', () => synthesizeTechDebtAssessment(businessPacket, job.questionnaire)),
        ]);
        if (rw.status === "fulfilled" && rw.value) deliverables = { ...deliverables, revenueWaterfall: rw.value };
        if (td.status === "fulfilled" && td.value) deliverables = { ...deliverables, techDebtAssessment: td.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] RevenueWaterfall/TechDebtAssessment failed (non-fatal):", e);
      }
    }

    // ── Step 4ac: Wave 11 intelligence (team performance, market entry strategy) ──
    if (!deliverables.teamPerformance || !deliverables.marketEntryStrategy) {
      try {
        console.log("[Pivot] Synthesizing team performance + market entry strategy...");
        const [tp, me] = await Promise.allSettled([
          synthIf('teamPerformance', () => synthesizeTeamPerformance(businessPacket, job.questionnaire)),
          synthIf('marketEntryStrategy', () => synthesizeMarketEntryStrategy(businessPacket, job.questionnaire)),
        ]);
        if (tp.status === "fulfilled" && tp.value) deliverables = { ...deliverables, teamPerformance: tp.value };
        if (me.status === "fulfilled" && me.value) deliverables = { ...deliverables, marketEntryStrategy: me.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] TeamPerformance/MarketEntryStrategy failed (non-fatal):", e);
      }
    }

    // ── Step 4ad: Wave 12 intelligence (competitive intel feed, cash flow sensitivity) ──
    if (!deliverables.competitiveIntelFeed || !deliverables.cashFlowSensitivity) {
      try {
        console.log("[Pivot] Synthesizing competitive intel feed + cash flow sensitivity...");
        const [cif, cfs] = await Promise.allSettled([
          synthIf('competitiveIntelFeed', () => synthesizeCompetitiveIntelFeed(businessPacket, job.questionnaire)),
          synthIf('cashFlowSensitivity', () => synthesizeCashFlowSensitivity(businessPacket, job.questionnaire)),
        ]);
        if (cif.status === "fulfilled" && cif.value) deliverables = { ...deliverables, competitiveIntelFeed: cif.value };
        if (cfs.status === "fulfilled" && cfs.value) deliverables = { ...deliverables, cashFlowSensitivity: cfs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CompetitiveIntelFeed/CashFlowSensitivity failed (non-fatal):", e);
      }
    }

    // ── Step 4ae: Wave 12 intelligence (digital maturity, acquisition funnel) ──
    if (!deliverables.digitalMaturity || !deliverables.acquisitionFunnel) {
      try {
        console.log("[Pivot] Synthesizing digital maturity + acquisition funnel...");
        const [dm, af] = await Promise.allSettled([
          synthIf('digitalMaturity', () => synthesizeDigitalMaturity(businessPacket, job.questionnaire)),
          synthIf('acquisitionFunnel', () => synthesizeAcquisitionFunnel(businessPacket, job.questionnaire)),
        ]);
        if (dm.status === "fulfilled" && dm.value) deliverables = { ...deliverables, digitalMaturity: dm.value };
        if (af.status === "fulfilled" && af.value) deliverables = { ...deliverables, acquisitionFunnel: af.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] DigitalMaturity/AcquisitionFunnel failed (non-fatal):", e);
      }
    }

    // ── Step 4af: Wave 12 intelligence (strategic alignment, budget optimizer) ──
    if (!deliverables.strategicAlignment || !deliverables.budgetOptimizer) {
      try {
        console.log("[Pivot] Synthesizing strategic alignment + budget optimizer...");
        const [sa, bo] = await Promise.allSettled([
          synthIf('strategicAlignment', () => synthesizeStrategicAlignment(businessPacket, job.questionnaire)),
          synthIf('budgetOptimizer', () => synthesizeBudgetOptimizer(businessPacket, job.questionnaire)),
        ]);
        if (sa.status === "fulfilled" && sa.value) deliverables = { ...deliverables, strategicAlignment: sa.value };
        if (bo.status === "fulfilled" && bo.value) deliverables = { ...deliverables, budgetOptimizer: bo.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] StrategicAlignment/BudgetOptimizer failed (non-fatal):", e);
      }
    }

    // ── Step 4ag: Wave 13 intelligence (revenue drivers, margin optimization) ──
    if (!deliverables.revenueDrivers || !deliverables.marginOptimization) {
      try {
        console.log("[Pivot] Synthesizing revenue drivers + margin optimization...");
        const [rd, mo] = await Promise.allSettled([
          synthIf('revenueDrivers', () => synthesizeRevenueDrivers(businessPacket, job.questionnaire)),
          synthIf('marginOptimization', () => synthesizeMarginOptimization(businessPacket, job.questionnaire)),
        ]);
        if (rd.status === "fulfilled" && rd.value) deliverables = { ...deliverables, revenueDrivers: rd.value };
        if (mo.status === "fulfilled" && mo.value) deliverables = { ...deliverables, marginOptimization: mo.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] RevenueDrivers/MarginOptimization failed (non-fatal):", e);
      }
    }

    // ── Step 4ah: Wave 13 intelligence (demand forecasting, cohort analysis) ──
    if (!deliverables.demandForecasting || !deliverables.cohortAnalysis) {
      try {
        console.log("[Pivot] Synthesizing demand forecasting + cohort analysis...");
        const [df, ca] = await Promise.allSettled([
          synthIf('demandForecasting', () => synthesizeDemandForecasting(businessPacket, job.questionnaire)),
          synthIf('cohortAnalysis', () => synthesizeCohortAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (df.status === "fulfilled" && df.value) deliverables = { ...deliverables, demandForecasting: df.value };
        if (ca.status === "fulfilled" && ca.value) deliverables = { ...deliverables, cohortAnalysis: ca.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] DemandForecasting/CohortAnalysis failed (non-fatal):", e);
      }
    }

    // ── Step 4ai: Wave 13 intelligence (win/loss analysis, sales forecast) ──
    if (!deliverables.winLossAnalysis || !deliverables.salesForecast) {
      try {
        console.log("[Pivot] Synthesizing win/loss analysis + sales forecast...");
        const [wl, sf] = await Promise.allSettled([
          synthIf('winLossAnalysis', () => synthesizeWinLossAnalysis(businessPacket, job.questionnaire)),
          synthIf('salesForecast', () => synthesizeSalesForecast(businessPacket, job.questionnaire)),
        ]);
        if (wl.status === "fulfilled" && wl.value) deliverables = { ...deliverables, winLossAnalysis: wl.value };
        if (sf.status === "fulfilled" && sf.value) deliverables = { ...deliverables, salesForecast: sf.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] WinLossAnalysis/SalesForecast failed (non-fatal):", e);
      }
    }

    // ── Step 4aj: Wave 14 intelligence (process efficiency, vendor risk) ──
    if (!deliverables.processEfficiency || !deliverables.vendorRisk) {
      try {
        console.log("[Pivot] Synthesizing process efficiency + vendor risk...");
        const [pe, vr] = await Promise.allSettled([
          synthIf('processEfficiency', () => synthesizeProcessEfficiency(businessPacket, job.questionnaire)),
          synthIf('vendorRisk', () => synthesizeVendorRisk(businessPacket, job.questionnaire)),
        ]);
        if (pe.status === "fulfilled" && pe.value) deliverables = { ...deliverables, processEfficiency: pe.value };
        if (vr.status === "fulfilled" && vr.value) deliverables = { ...deliverables, vendorRisk: vr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ProcessEfficiency/VendorRisk failed (non-fatal):", e);
      }
    }

    // ── Step 4ak: Wave 14 intelligence (quality metrics, capacity planning) ──
    if (!deliverables.qualityMetrics || !deliverables.capacityPlanning) {
      try {
        console.log("[Pivot] Synthesizing quality metrics + capacity planning...");
        const [qm, cp] = await Promise.allSettled([
          synthIf('qualityMetrics', () => synthesizeQualityMetrics(businessPacket, job.questionnaire)),
          synthIf('capacityPlanning', () => synthesizeCapacityPlanning(businessPacket, job.questionnaire)),
        ]);
        if (qm.status === "fulfilled" && qm.value) deliverables = { ...deliverables, qualityMetrics: qm.value };
        if (cp.status === "fulfilled" && cp.value) deliverables = { ...deliverables, capacityPlanning: cp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] QualityMetrics/CapacityPlanning failed (non-fatal):", e);
      }
    }

    // ── Step 4al: Wave 14 intelligence (knowledge management, compliance scorecard) ──
    if (!deliverables.knowledgeManagement || !deliverables.complianceScorecard) {
      try {
        console.log("[Pivot] Synthesizing knowledge management + compliance scorecard...");
        const [km, cs] = await Promise.allSettled([
          synthIf('knowledgeManagement', () => synthesizeKnowledgeManagement(businessPacket, job.questionnaire)),
          synthIf('complianceScorecard', () => synthesizeComplianceScorecard(businessPacket, job.questionnaire)),
        ]);
        if (km.status === "fulfilled" && km.value) deliverables = { ...deliverables, knowledgeManagement: km.value };
        if (cs.status === "fulfilled" && cs.value) deliverables = { ...deliverables, complianceScorecard: cs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] KnowledgeManagement/ComplianceScorecard failed (non-fatal):", e);
      }
    }

    // ── Step 4am: Wave 15 intelligence (market penetration, flywheel analysis) ──
    if (!deliverables.marketPenetration || !deliverables.flywheelAnalysis) {
      try {
        console.log("[Pivot] Synthesizing market penetration + flywheel analysis...");
        const [mp, fa] = await Promise.allSettled([
          synthIf('marketPenetration', () => synthesizeMarketPenetration(businessPacket, job.questionnaire)),
          synthIf('flywheelAnalysis', () => synthesizeFlywheelAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (mp.status === "fulfilled" && mp.value) deliverables = { ...deliverables, marketPenetration: mp.value };
        if (fa.status === "fulfilled" && fa.value) deliverables = { ...deliverables, flywheelAnalysis: fa.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] MarketPenetration/FlywheelAnalysis failed (non-fatal):", e);
      }
    }

    // ── Step 4an: Wave 15 intelligence (partnerships strategy, international expansion) ──
    if (!deliverables.partnershipsStrategy || !deliverables.internationalExpansion) {
      try {
        console.log("[Pivot] Synthesizing partnerships strategy + international expansion...");
        const [ps, ie] = await Promise.allSettled([
          synthIf('partnershipsStrategy', () => synthesizePartnershipsStrategy(businessPacket, job.questionnaire)),
          synthIf('internationalExpansion', () => synthesizeInternationalExpansion(businessPacket, job.questionnaire)),
        ]);
        if (ps.status === "fulfilled" && ps.value) deliverables = { ...deliverables, partnershipsStrategy: ps.value };
        if (ie.status === "fulfilled" && ie.value) deliverables = { ...deliverables, internationalExpansion: ie.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PartnershipsStrategy/InternationalExpansion failed (non-fatal):", e);
      }
    }

    // ── Step 4ao: Wave 15 intelligence (R&D effectiveness, brand equity) ──
    if (!deliverables.rdEffectiveness || !deliverables.brandEquity) {
      try {
        console.log("[Pivot] Synthesizing R&D effectiveness + brand equity...");
        const [rd, be] = await Promise.allSettled([
          synthIf('rdEffectiveness', () => synthesizeRDEffectiveness(businessPacket, job.questionnaire)),
          synthIf('brandEquity', () => synthesizeBrandEquity(businessPacket, job.questionnaire)),
        ]);
        if (rd.status === "fulfilled" && rd.value) deliverables = { ...deliverables, rdEffectiveness: rd.value };
        if (be.status === "fulfilled" && be.value) deliverables = { ...deliverables, brandEquity: be.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] RDEffectiveness/BrandEquity failed (non-fatal):", e);
      }
    }

    // ── Step 4ap: Wave 16 intelligence (working capital, debt strategy) ──
    if (!deliverables.workingCapital || !deliverables.debtStrategy) {
      try {
        console.log("[Pivot] Synthesizing working capital + debt strategy...");
        const [wc, ds] = await Promise.allSettled([
          synthIf('workingCapital', () => synthesizeWorkingCapital(businessPacket, job.questionnaire)),
          synthIf('debtStrategy', () => synthesizeDebtStrategy(businessPacket, job.questionnaire)),
        ]);
        if (wc.status === "fulfilled" && wc.value) deliverables = { ...deliverables, workingCapital: wc.value };
        if (ds.status === "fulfilled" && ds.value) deliverables = { ...deliverables, debtStrategy: ds.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] WorkingCapital/DebtStrategy failed (non-fatal):", e);
      }
    }

    // ── Step 4aq: Wave 16 intelligence (tax strategy, investor readiness) ──
    if (!deliverables.taxStrategy || !deliverables.investorReadiness) {
      try {
        console.log("[Pivot] Synthesizing tax strategy + investor readiness...");
        const [ts, ir] = await Promise.allSettled([
          synthIf('taxStrategy', () => synthesizeTaxStrategy(businessPacket, job.questionnaire)),
          synthIf('investorReadiness', () => synthesizeInvestorReadiness(businessPacket, job.questionnaire)),
        ]);
        if (ts.status === "fulfilled" && ts.value) deliverables = { ...deliverables, taxStrategy: ts.value };
        if (ir.status === "fulfilled" && ir.value) deliverables = { ...deliverables, investorReadiness: ir.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] TaxStrategy/InvestorReadiness failed (non-fatal):", e);
      }
    }

    // ── Step 4ar: Wave 16 intelligence (M&A readiness, strategic roadmap) ──
    if (!deliverables.maReadiness || !deliverables.strategicRoadmap) {
      try {
        console.log("[Pivot] Synthesizing M&A readiness + strategic roadmap...");
        const [ma, sr] = await Promise.allSettled([
          synthIf('maReadiness', () => synthesizeMAReadiness(businessPacket, job.questionnaire)),
          synthIf('strategicRoadmap', () => synthesizeStrategicRoadmap(businessPacket, job.questionnaire)),
        ]);
        if (ma.status === "fulfilled" && ma.value) deliverables = { ...deliverables, maReadiness: ma.value };
        if (sr.status === "fulfilled" && sr.value) deliverables = { ...deliverables, strategicRoadmap: sr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] MAReadiness/StrategicRoadmap failed (non-fatal):", e);
      }
    }

    // ── Step 4as: Wave 17 intelligence (customer voice, referral engine) ──
    if (!deliverables.customerVoice || !deliverables.referralEngine) {
      try {
        console.log("[Pivot] Synthesizing customer voice + referral engine...");
        const [cv, re] = await Promise.allSettled([
          synthIf('customerVoice', () => synthesizeCustomerVoice(businessPacket, job.questionnaire)),
          synthIf('referralEngine', () => synthesizeReferralEngine(businessPacket, job.questionnaire)),
        ]);
        if (cv.status === "fulfilled" && cv.value) deliverables = { ...deliverables, customerVoice: cv.value };
        if (re.status === "fulfilled" && re.value) deliverables = { ...deliverables, referralEngine: re.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CustomerVoice/ReferralEngine failed (non-fatal):", e);
      }
    }

    // ── Step 4at: Wave 17 intelligence (price sensitivity index, customer effort score) ──
    if (!deliverables.priceSensitivityIndex || !deliverables.customerEffortScore) {
      try {
        console.log("[Pivot] Synthesizing price sensitivity index + customer effort score...");
        const [psi, ces] = await Promise.allSettled([
          synthIf('priceSensitivityIndex', () => synthesizePriceSensitivityIndex(businessPacket, job.questionnaire)),
          synthIf('customerEffortScore', () => synthesizeCustomerEffortScore(businessPacket, job.questionnaire)),
        ]);
        if (psi.status === "fulfilled" && psi.value) deliverables = { ...deliverables, priceSensitivityIndex: psi.value };
        if (ces.status === "fulfilled" && ces.value) deliverables = { ...deliverables, customerEffortScore: ces.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PriceSensitivityIndex/CustomerEffortScore failed (non-fatal):", e);
      }
    }

    // ── Step 4au: Wave 17 intelligence (account expansion map, loyalty program design) ──
    if (!deliverables.accountExpansionMap || !deliverables.loyaltyProgramDesign) {
      try {
        console.log("[Pivot] Synthesizing account expansion map + loyalty program design...");
        const [aem, lpd] = await Promise.allSettled([
          synthIf('accountExpansionMap', () => synthesizeAccountExpansionMap(businessPacket, job.questionnaire)),
          synthIf('loyaltyProgramDesign', () => synthesizeLoyaltyProgramDesign(businessPacket, job.questionnaire)),
        ]);
        if (aem.status === "fulfilled" && aem.value) deliverables = { ...deliverables, accountExpansionMap: aem.value };
        if (lpd.status === "fulfilled" && lpd.value) deliverables = { ...deliverables, loyaltyProgramDesign: lpd.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] AccountExpansionMap/LoyaltyProgramDesign failed (non-fatal):", e);
      }
    }

    // ── Step 4av: Wave 18 intelligence (competitive pricing matrix, market sentiment index) ──
    if (!deliverables.competitivePricingMatrix || !deliverables.marketSentimentIndex) {
      try {
        console.log("[Pivot] Synthesizing competitive pricing matrix + market sentiment index...");
        const [cpm, msi] = await Promise.allSettled([
          synthIf('competitivePricingMatrix', () => synthesizeCompetitivePricingMatrix(businessPacket, job.questionnaire)),
          synthIf('marketSentimentIndex', () => synthesizeMarketSentimentIndex(businessPacket, job.questionnaire)),
        ]);
        if (cpm.status === "fulfilled" && cpm.value) deliverables = { ...deliverables, competitivePricingMatrix: cpm.value };
        if (msi.status === "fulfilled" && msi.value) deliverables = { ...deliverables, marketSentimentIndex: msi.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CompetitivePricingMatrix/MarketSentimentIndex failed (non-fatal):", e);
      }
    }

    // ── Step 4aw: Wave 18 intelligence (disruption radar, ecosystem map) ──
    if (!deliverables.disruptionRadar || !deliverables.ecosystemMap) {
      try {
        console.log("[Pivot] Synthesizing disruption radar + ecosystem map...");
        const [dr, em] = await Promise.allSettled([
          synthIf('disruptionRadar', () => synthesizeDisruptionRadar(businessPacket, job.questionnaire)),
          synthIf('ecosystemMap', () => synthesizeEcosystemMap(businessPacket, job.questionnaire)),
        ]);
        if (dr.status === "fulfilled" && dr.value) deliverables = { ...deliverables, disruptionRadar: dr.value };
        if (em.status === "fulfilled" && em.value) deliverables = { ...deliverables, ecosystemMap: em.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] DisruptionRadar/EcosystemMap failed (non-fatal):", e);
      }
    }

    // ── Step 4ax: Wave 18 intelligence (category creation, market velocity) ──
    if (!deliverables.categoryCreation || !deliverables.marketVelocity) {
      try {
        console.log("[Pivot] Synthesizing category creation + market velocity...");
        const [cc, mv] = await Promise.allSettled([
          synthIf('categoryCreation', () => synthesizeCategoryCreation(businessPacket, job.questionnaire)),
          synthIf('marketVelocity', () => synthesizeMarketVelocity(businessPacket, job.questionnaire)),
        ]);
        if (cc.status === "fulfilled" && cc.value) deliverables = { ...deliverables, categoryCreation: cc.value };
        if (mv.status === "fulfilled" && mv.value) deliverables = { ...deliverables, marketVelocity: mv.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CategoryCreation/MarketVelocity failed (non-fatal):", e);
      }
    }

    // ── Step 4ay: Wave 19 intelligence (OKR cascade, meeting effectiveness) ──
    if (!deliverables.okrCascade || !deliverables.meetingEffectiveness) {
      try {
        console.log("[Pivot] Synthesizing OKR cascade + meeting effectiveness...");
        const [okr, me] = await Promise.allSettled([
          synthIf('okrCascade', () => synthesizeOKRCascade(businessPacket, job.questionnaire)),
          synthIf('meetingEffectiveness', () => synthesizeMeetingEffectiveness(businessPacket, job.questionnaire)),
        ]);
        if (okr.status === "fulfilled" && okr.value) deliverables = { ...deliverables, okrCascade: okr.value };
        if (me.status === "fulfilled" && me.value) deliverables = { ...deliverables, meetingEffectiveness: me.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] OKRCascade/MeetingEffectiveness failed (non-fatal):", e);
      }
    }

    // ── Step 4az: Wave 19 intelligence (communication audit, decision velocity) ──
    if (!deliverables.communicationAudit || !deliverables.decisionVelocity) {
      try {
        console.log("[Pivot] Synthesizing communication audit + decision velocity...");
        const [ca, dv] = await Promise.allSettled([
          synthIf('communicationAudit', () => synthesizeCommunicationAudit(businessPacket, job.questionnaire)),
          synthIf('decisionVelocity', () => synthesizeDecisionVelocity(businessPacket, job.questionnaire)),
        ]);
        if (ca.status === "fulfilled" && ca.value) deliverables = { ...deliverables, communicationAudit: ca.value };
        if (dv.status === "fulfilled" && dv.value) deliverables = { ...deliverables, decisionVelocity: dv.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CommunicationAudit/DecisionVelocity failed (non-fatal):", e);
      }
    }

    // ── Step 4ba: Wave 19 intelligence (resource optimizer, change management) ──
    if (!deliverables.resourceOptimizer || !deliverables.changeManagement) {
      try {
        console.log("[Pivot] Synthesizing resource optimizer + change management...");
        const [ro, cm] = await Promise.allSettled([
          synthIf('resourceOptimizer', () => synthesizeResourceOptimizer(businessPacket, job.questionnaire)),
          synthIf('changeManagement', () => synthesizeChangeManagement(businessPacket, job.questionnaire)),
        ]);
        if (ro.status === "fulfilled" && ro.value) deliverables = { ...deliverables, resourceOptimizer: ro.value };
        if (cm.status === "fulfilled" && cm.value) deliverables = { ...deliverables, changeManagement: cm.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ResourceOptimizer/ChangeManagement failed (non-fatal):", e);
      }
    }

    // ── Step 4bb: Wave 20 intelligence (cash reserve strategy, revenue quality score) ──
    if (!deliverables.cashReserveStrategy || !deliverables.revenueQualityScore) {
      try {
        console.log("[Pivot] Synthesizing cash reserve strategy + revenue quality score...");
        const [crs, rqs] = await Promise.allSettled([
          synthIf('cashReserveStrategy', () => synthesizeCashReserveStrategy(businessPacket, job.questionnaire)),
          synthIf('revenueQualityScore', () => synthesizeRevenueQualityScore(businessPacket, job.questionnaire)),
        ]);
        if (crs.status === "fulfilled" && crs.value) deliverables = { ...deliverables, cashReserveStrategy: crs.value };
        if (rqs.status === "fulfilled" && rqs.value) deliverables = { ...deliverables, revenueQualityScore: rqs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CashReserveStrategy/RevenueQualityScore failed (non-fatal):", e);
      }
    }

    // ── Step 4bc: Wave 20 intelligence (cost intelligence, financial modeling) ──
    if (!deliverables.costIntelligence || !deliverables.financialModeling) {
      try {
        console.log("[Pivot] Synthesizing cost intelligence + financial modeling...");
        const [ci, fm] = await Promise.allSettled([
          synthIf('costIntelligence', () => synthesizeCostIntelligence(businessPacket, job.questionnaire)),
          synthIf('financialModeling', () => synthesizeFinancialModeling(businessPacket, job.questionnaire)),
        ]);
        if (ci.status === "fulfilled" && ci.value) deliverables = { ...deliverables, costIntelligence: ci.value };
        if (fm.status === "fulfilled" && fm.value) deliverables = { ...deliverables, financialModeling: fm.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CostIntelligence/FinancialModeling failed (non-fatal):", e);
      }
    }

    // ── Step 4bd: Wave 20 intelligence (profitability map, capital allocation) ──
    if (!deliverables.profitabilityMap || !deliverables.capitalAllocation) {
      try {
        console.log("[Pivot] Synthesizing profitability map + capital allocation...");
        const [pm, cal] = await Promise.allSettled([
          synthIf('profitabilityMap', () => synthesizeProfitabilityMap(businessPacket, job.questionnaire)),
          synthIf('capitalAllocation', () => synthesizeCapitalAllocation(businessPacket, job.questionnaire)),
        ]);
        if (pm.status === "fulfilled" && pm.value) deliverables = { ...deliverables, profitabilityMap: pm.value };
        if (cal.status === "fulfilled" && cal.value) deliverables = { ...deliverables, capitalAllocation: cal.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ProfitabilityMap/CapitalAllocation failed (non-fatal):", e);
      }
    }

    // ── Step 4be: Wave 21 intelligence (sales pipeline health, deal velocity) ──
    if (!deliverables.salesPipelineHealth || !deliverables.dealVelocity) {
      try {
        console.log("[Pivot] Synthesizing sales pipeline health + deal velocity...");
        const [sph, dv] = await Promise.allSettled([
          synthIf('salesPipelineHealth', () => synthesizeSalesPipelineHealth(businessPacket, job.questionnaire)),
          synthIf('dealVelocity', () => synthesizeDealVelocity(businessPacket, job.questionnaire)),
        ]);
        if (sph.status === "fulfilled" && sph.value) deliverables = { ...deliverables, salesPipelineHealth: sph.value };
        if (dv.status === "fulfilled" && dv.value) deliverables = { ...deliverables, dealVelocity: dv.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] SalesPipelineHealth/DealVelocity failed (non-fatal):", e);
      }
    }

    // ── Step 4bf: Wave 21 intelligence (win rate optimizer, sales enablement) ──
    if (!deliverables.winRateOptimizer || !deliverables.salesEnablement) {
      try {
        console.log("[Pivot] Synthesizing win rate optimizer + sales enablement...");
        const [wro, se] = await Promise.allSettled([
          synthIf('winRateOptimizer', () => synthesizeWinRateOptimizer(businessPacket, job.questionnaire)),
          synthIf('salesEnablement', () => synthesizeSalesEnablement(businessPacket, job.questionnaire)),
        ]);
        if (wro.status === "fulfilled" && wro.value) deliverables = { ...deliverables, winRateOptimizer: wro.value };
        if (se.status === "fulfilled" && se.value) deliverables = { ...deliverables, salesEnablement: se.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] WinRateOptimizer/SalesEnablement failed (non-fatal):", e);
      }
    }

    // ── Step 4bg: Wave 21 intelligence (territory planning, quota intelligence) ──
    if (!deliverables.territoryPlanning || !deliverables.quotaIntelligence) {
      try {
        console.log("[Pivot] Synthesizing territory planning + quota intelligence...");
        const [tp, qi] = await Promise.allSettled([
          synthIf('territoryPlanning', () => synthesizeTerritoryPlanning(businessPacket, job.questionnaire)),
          synthIf('quotaIntelligence', () => synthesizeQuotaIntelligence(businessPacket, job.questionnaire)),
        ]);
        if (tp.status === "fulfilled" && tp.value) deliverables = { ...deliverables, territoryPlanning: tp.value };
        if (qi.status === "fulfilled" && qi.value) deliverables = { ...deliverables, quotaIntelligence: qi.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] TerritoryPlanning/QuotaIntelligence failed (non-fatal):", e);
      }
    }

    // ── Step 4bh: Wave 22 intelligence (feature prioritization, product usage analytics) ──
    if (!deliverables.featurePrioritization || !deliverables.productUsageAnalytics) {
      try {
        console.log("[Pivot] Synthesizing feature prioritization + product usage analytics...");
        const [fp, pua] = await Promise.allSettled([
          synthIf('featurePrioritization', () => synthesizeFeaturePrioritization(businessPacket, job.questionnaire)),
          synthIf('productUsageAnalytics', () => synthesizeProductUsageAnalytics(businessPacket, job.questionnaire)),
        ]);
        if (fp.status === "fulfilled" && fp.value) deliverables = { ...deliverables, featurePrioritization: fp.value };
        if (pua.status === "fulfilled" && pua.value) deliverables = { ...deliverables, productUsageAnalytics: pua.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] FeaturePrioritization/ProductUsageAnalytics failed (non-fatal):", e);
      }
    }

    // ── Step 4bi: Wave 22 intelligence (tech stack audit, API strategy) ──
    if (!deliverables.techStackAudit || !deliverables.apiStrategy) {
      try {
        console.log("[Pivot] Synthesizing tech stack audit + API strategy...");
        const [tsa, as_] = await Promise.allSettled([
          synthIf('techStackAudit', () => synthesizeTechStackAudit(businessPacket, job.questionnaire)),
          synthIf('apiStrategy', () => synthesizeApiStrategy(businessPacket, job.questionnaire)),
        ]);
        if (tsa.status === "fulfilled" && tsa.value) deliverables = { ...deliverables, techStackAudit: tsa.value };
        if (as_.status === "fulfilled" && as_.value) deliverables = { ...deliverables, apiStrategy: as_.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] TechStackAudit/ApiStrategy failed (non-fatal):", e);
      }
    }

    // ── Step 4bj: Wave 22 intelligence (platform scalability, user onboarding) ──
    if (!deliverables.platformScalability || !deliverables.userOnboarding) {
      try {
        console.log("[Pivot] Synthesizing platform scalability + user onboarding...");
        const [ps, uo] = await Promise.allSettled([
          synthIf('platformScalability', () => synthesizePlatformScalability(businessPacket, job.questionnaire)),
          synthIf('userOnboarding', () => synthesizeUserOnboarding(businessPacket, job.questionnaire)),
        ]);
        if (ps.status === "fulfilled" && ps.value) deliverables = { ...deliverables, platformScalability: ps.value };
        if (uo.status === "fulfilled" && uo.value) deliverables = { ...deliverables, userOnboarding: uo.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PlatformScalability/UserOnboarding failed (non-fatal):", e);
      }
    }

    // ── Step 4bk: Wave 23 intelligence (employee engagement, talent acquisition funnel) ──
    if (!deliverables.employeeEngagement || !deliverables.talentAcquisitionFunnel) {
      try {
        console.log("[Pivot] Synthesizing employee engagement + talent acquisition funnel...");
        const [ee, taf] = await Promise.allSettled([
          synthIf('employeeEngagement', () => synthesizeEmployeeEngagement(businessPacket, job.questionnaire)),
          synthIf('talentAcquisitionFunnel', () => synthesizeTalentAcquisitionFunnel(businessPacket, job.questionnaire)),
        ]);
        if (ee.status === "fulfilled" && ee.value) deliverables = { ...deliverables, employeeEngagement: ee.value };
        if (taf.status === "fulfilled" && taf.value) deliverables = { ...deliverables, talentAcquisitionFunnel: taf.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] EmployeeEngagement/TalentAcquisitionFunnel failed (non-fatal):", e);
      }
    }

    // ── Step 4bl: Wave 23 intelligence (compensation benchmark, succession planning) ──
    if (!deliverables.compensationBenchmark || !deliverables.successionPlanning) {
      try {
        console.log("[Pivot] Synthesizing compensation benchmark + succession planning...");
        const [cb, sp] = await Promise.allSettled([
          synthIf('compensationBenchmark', () => synthesizeCompensationBenchmark(businessPacket, job.questionnaire)),
          synthIf('successionPlanning', () => synthesizeSuccessionPlanning(businessPacket, job.questionnaire)),
        ]);
        if (cb.status === "fulfilled" && cb.value) deliverables = { ...deliverables, compensationBenchmark: cb.value };
        if (sp.status === "fulfilled" && sp.value) deliverables = { ...deliverables, successionPlanning: sp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CompensationBenchmark/SuccessionPlanning failed (non-fatal):", e);
      }
    }

    // ── Step 4bm: Wave 23 intelligence (diversity metrics, employer brand) ──
    if (!deliverables.diversityMetrics || !deliverables.employerBrand) {
      try {
        console.log("[Pivot] Synthesizing diversity metrics + employer brand...");
        const [dm, eb] = await Promise.allSettled([
          synthIf('diversityMetrics', () => synthesizeDiversityMetrics(businessPacket, job.questionnaire)),
          synthIf('employerBrand', () => synthesizeEmployerBrand(businessPacket, job.questionnaire)),
        ]);
        if (dm.status === "fulfilled" && dm.value) deliverables = { ...deliverables, diversityMetrics: dm.value };
        if (eb.status === "fulfilled" && eb.value) deliverables = { ...deliverables, employerBrand: eb.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] DiversityMetrics/EmployerBrand failed (non-fatal):", e);
      }
    }

    // ── Step 4bn: Wave 24 intelligence (data governance, analytics maturity) ──
    if (!deliverables.dataGovernance || !deliverables.analyticsMaturity) {
      try {
        console.log("[Pivot] Synthesizing data governance + analytics maturity...");
        const [dg, am] = await Promise.allSettled([
          synthIf('dataGovernance', () => synthesizeDataGovernance(businessPacket, job.questionnaire)),
          synthIf('analyticsMaturity', () => synthesizeAnalyticsMaturity(businessPacket, job.questionnaire)),
        ]);
        if (dg.status === "fulfilled" && dg.value) deliverables = { ...deliverables, dataGovernance: dg.value };
        if (am.status === "fulfilled" && am.value) deliverables = { ...deliverables, analyticsMaturity: am.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] DataGovernance/AnalyticsMaturity failed (non-fatal):", e);
      }
    }

    // ── Step 4bo: Wave 24 intelligence (customer data platform, predictive modeling) ──
    if (!deliverables.customerDataPlatform || !deliverables.predictiveModeling) {
      try {
        console.log("[Pivot] Synthesizing customer data platform + predictive modeling...");
        const [cdp, pm] = await Promise.allSettled([
          synthIf('customerDataPlatform', () => synthesizeCustomerDataPlatform(businessPacket, job.questionnaire)),
          synthIf('predictiveModeling', () => synthesizePredictiveModeling(businessPacket, job.questionnaire)),
        ]);
        if (cdp.status === "fulfilled" && cdp.value) deliverables = { ...deliverables, customerDataPlatform: cdp.value };
        if (pm.status === "fulfilled" && pm.value) deliverables = { ...deliverables, predictiveModeling: pm.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CustomerDataPlatform/PredictiveModeling failed (non-fatal):", e);
      }
    }

    // ── Step 4bp: Wave 24 intelligence (reporting framework, data quality score) ──
    if (!deliverables.reportingFramework || !deliverables.dataQualityScore) {
      try {
        console.log("[Pivot] Synthesizing reporting framework + data quality score...");
        const [rf, dqs] = await Promise.allSettled([
          synthIf('reportingFramework', () => synthesizeReportingFramework(businessPacket, job.questionnaire)),
          synthIf('dataQualityScore', () => synthesizeDataQualityScore(businessPacket, job.questionnaire)),
        ]);
        if (rf.status === "fulfilled" && rf.value) deliverables = { ...deliverables, reportingFramework: rf.value };
        if (dqs.status === "fulfilled" && dqs.value) deliverables = { ...deliverables, dataQualityScore: dqs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ReportingFramework/DataQualityScore failed (non-fatal):", e);
      }
    }

    // ── Step 4bq: Wave 25a intelligence (supply chain risk, inventory optimization) ──
    if (!deliverables.supplyChainRisk || !deliverables.inventoryOptimization) {
      try {
        console.log("[Pivot] Synthesizing supply chain risk + inventory optimization...");
        const [scr, io] = await Promise.allSettled([
          synthIf('supplyChainRisk', () => synthesizeSupplyChainRisk(businessPacket, job.questionnaire)),
          synthIf('inventoryOptimization', () => synthesizeInventoryOptimization(businessPacket, job.questionnaire)),
        ]);
        if (scr.status === "fulfilled" && scr.value) deliverables = { ...deliverables, supplyChainRisk: scr.value };
        if (io.status === "fulfilled" && io.value) deliverables = { ...deliverables, inventoryOptimization: io.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] SupplyChainRisk/InventoryOptimization failed (non-fatal):", e);
      }
    }

    // ── Step 4br: Wave 25b intelligence (vendor scorecard, operational efficiency) ──
    if (!deliverables.vendorScorecard || !deliverables.operationalEfficiency) {
      try {
        console.log("[Pivot] Synthesizing vendor scorecard + operational efficiency...");
        const [vs, oe] = await Promise.allSettled([
          synthIf('vendorScorecard', () => synthesizeVendorScorecard(businessPacket, job.questionnaire)),
          synthIf('operationalEfficiency', () => synthesizeOperationalEfficiency(businessPacket, job.questionnaire)),
        ]);
        if (vs.status === "fulfilled" && vs.value) deliverables = { ...deliverables, vendorScorecard: vs.value };
        if (oe.status === "fulfilled" && oe.value) deliverables = { ...deliverables, operationalEfficiency: oe.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] VendorScorecard/OperationalEfficiency failed (non-fatal):", e);
      }
    }

    // ── Step 4bs: Wave 25c intelligence (quality management, capacity planning) ──
    if (!deliverables.qualityManagement || !deliverables.capacityPlanning) {
      try {
        console.log("[Pivot] Synthesizing quality management + capacity planning...");
        const [qm, cp] = await Promise.allSettled([
          synthIf('qualityManagement', () => synthesizeQualityManagement(businessPacket, job.questionnaire)),
          synthIf('capacityPlanning', () => synthesizeCapacityPlanning(businessPacket, job.questionnaire)),
        ]);
        if (qm.status === "fulfilled" && qm.value) deliverables = { ...deliverables, qualityManagement: qm.value };
        if (cp.status === "fulfilled" && cp.value) deliverables = { ...deliverables, capacityPlanning: cp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] QualityManagement/CapacityPlanning failed (non-fatal):", e);
      }
    }

    // ── Step 4bt: Wave 26a intelligence (customer journey map, nps analysis) ──
    if (!deliverables.customerJourneyMap || !deliverables.npsAnalysis) {
      try {
        console.log("[Pivot] Synthesizing customer journey map + nps analysis...");
        const [cjm, nps] = await Promise.allSettled([
          synthIf('customerJourneyMap', () => synthesizeCustomerJourneyMap(businessPacket, job.questionnaire)),
          synthIf('npsAnalysis', () => synthesizeNpsAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (cjm.status === "fulfilled" && cjm.value) deliverables = { ...deliverables, customerJourneyMap: cjm.value };
        if (nps.status === "fulfilled" && nps.value) deliverables = { ...deliverables, npsAnalysis: nps.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CustomerJourneyMap/NpsAnalysis failed (non-fatal):", e);
      }
    }

    // ── Step 4bu: Wave 26b intelligence (support ticket intelligence, customer health score) ──
    if (!deliverables.supportTicketIntelligence || !deliverables.customerHealthScore) {
      try {
        console.log("[Pivot] Synthesizing support ticket intelligence + customer health score...");
        const [sti, chs] = await Promise.allSettled([
          synthIf('supportTicketIntelligence', () => synthesizeSupportTicketIntelligence(businessPacket, job.questionnaire)),
          synthIf('customerHealthScore', () => synthesizeCustomerHealthScore(businessPacket, job.questionnaire)),
        ]);
        if (sti.status === "fulfilled" && sti.value) deliverables = { ...deliverables, supportTicketIntelligence: sti.value };
        if (chs.status === "fulfilled" && chs.value) deliverables = { ...deliverables, customerHealthScore: chs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] SupportTicketIntelligence/CustomerHealthScore failed (non-fatal):", e);
      }
    }

    // ── Step 4bv: Wave 26c intelligence (voice of customer, customer segmentation) ──
    if (!deliverables.voiceOfCustomer || !deliverables.customerSegmentation) {
      try {
        console.log("[Pivot] Synthesizing voice of customer + customer segmentation...");
        const [voc, cs] = await Promise.allSettled([
          synthIf('voiceOfCustomer', () => synthesizeVoiceOfCustomer(businessPacket, job.questionnaire)),
          synthIf('customerSegmentation', () => synthesizeCustomerSegmentation(businessPacket, job.questionnaire)),
        ]);
        if (voc.status === "fulfilled" && voc.value) deliverables = { ...deliverables, voiceOfCustomer: voc.value };
        if (cs.status === "fulfilled" && cs.value) deliverables = { ...deliverables, customerSegmentation: cs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] VoiceOfCustomer/CustomerSegmentation failed (non-fatal):", e);
      }
    }

    // ── Step 4bw: Wave 27a intelligence (innovation pipeline, ip portfolio) ──
    if (!deliverables.innovationPipeline || !deliverables.ipPortfolio) {
      try {
        console.log("[Pivot] Synthesizing innovation pipeline + ip portfolio...");
        const [ip, ipp] = await Promise.allSettled([
          synthIf('innovationPipeline', () => synthesizeInnovationPipeline(businessPacket, job.questionnaire)),
          synthIf('ipPortfolio', () => synthesizeIpPortfolio(businessPacket, job.questionnaire)),
        ]);
        if (ip.status === "fulfilled" && ip.value) deliverables = { ...deliverables, innovationPipeline: ip.value };
        if (ipp.status === "fulfilled" && ipp.value) deliverables = { ...deliverables, ipPortfolio: ipp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] InnovationPipeline/IpPortfolio failed (non-fatal):", e);
      }
    }

    // ── Step 4bx: Wave 27b intelligence (rd efficiency, technology readiness) ──
    if (!deliverables.rdEfficiency || !deliverables.technologyReadiness) {
      try {
        console.log("[Pivot] Synthesizing rd efficiency + technology readiness...");
        const [rde, tr] = await Promise.allSettled([
          synthIf('rdEfficiency', () => synthesizeRdEfficiency(businessPacket, job.questionnaire)),
          synthIf('technologyReadiness', () => synthesizeTechnologyReadiness(businessPacket, job.questionnaire)),
        ]);
        if (rde.status === "fulfilled" && rde.value) deliverables = { ...deliverables, rdEfficiency: rde.value };
        if (tr.status === "fulfilled" && tr.value) deliverables = { ...deliverables, technologyReadiness: tr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] RdEfficiency/TechnologyReadiness failed (non-fatal):", e);
      }
    }

    // ── Step 4by: Wave 27c intelligence (partnership ecosystem, mergers acquisitions) ──
    if (!deliverables.partnershipEcosystem || !deliverables.mergersAcquisitions) {
      try {
        console.log("[Pivot] Synthesizing partnership ecosystem + mergers acquisitions...");
        const [pe, ma] = await Promise.allSettled([
          synthIf('partnershipEcosystem', () => synthesizePartnershipEcosystem(businessPacket, job.questionnaire)),
          synthIf('mergersAcquisitions', () => synthesizeMergersAcquisitions(businessPacket, job.questionnaire)),
        ]);
        if (pe.status === "fulfilled" && pe.value) deliverables = { ...deliverables, partnershipEcosystem: pe.value };
        if (ma.status === "fulfilled" && ma.value) deliverables = { ...deliverables, mergersAcquisitions: ma.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PartnershipEcosystem/MergersAcquisitions failed (non-fatal):", e);
      }
    }

    // ── Step 4bz: Wave 28a intelligence (esg scorecard, carbon footprint) ──
    if (!deliverables.esgScorecard || !deliverables.carbonFootprint) {
      try {
        console.log("[Pivot] Synthesizing esg scorecard + carbon footprint...");
        const [esg, cf] = await Promise.allSettled([
          synthIf('esgScorecard', () => synthesizeEsgScorecard(businessPacket, job.questionnaire)),
          synthIf('carbonFootprint', () => synthesizeCarbonFootprint(businessPacket, job.questionnaire)),
        ]);
        if (esg.status === "fulfilled" && esg.value) deliverables = { ...deliverables, esgScorecard: esg.value };
        if (cf.status === "fulfilled" && cf.value) deliverables = { ...deliverables, carbonFootprint: cf.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] EsgScorecard/CarbonFootprint failed (non-fatal):", e);
      }
    }

    // ── Step 4ca: Wave 28b intelligence (regulatory compliance, business continuity) ──
    if (!deliverables.regulatoryCompliance || !deliverables.businessContinuity) {
      try {
        console.log("[Pivot] Synthesizing regulatory compliance + business continuity...");
        const [rc, bc] = await Promise.allSettled([
          synthIf('regulatoryCompliance', () => synthesizeRegulatoryCompliance(businessPacket, job.questionnaire)),
          synthIf('businessContinuity', () => synthesizeBusinessContinuity(businessPacket, job.questionnaire)),
        ]);
        if (rc.status === "fulfilled" && rc.value) deliverables = { ...deliverables, regulatoryCompliance: rc.value };
        if (bc.status === "fulfilled" && bc.value) deliverables = { ...deliverables, businessContinuity: bc.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] RegulatoryCompliance/BusinessContinuity failed (non-fatal):", e);
      }
    }

    // ── Step 4cb: Wave 28c intelligence (ethics framework, social impact) ──
    if (!deliverables.ethicsFramework || !deliverables.socialImpact) {
      try {
        console.log("[Pivot] Synthesizing ethics framework + social impact...");
        const [ef, si] = await Promise.allSettled([
          synthIf('ethicsFramework', () => synthesizeEthicsFramework(businessPacket, job.questionnaire)),
          synthIf('socialImpact', () => synthesizeSocialImpact(businessPacket, job.questionnaire)),
        ]);
        if (ef.status === "fulfilled" && ef.value) deliverables = { ...deliverables, ethicsFramework: ef.value };
        if (si.status === "fulfilled" && si.value) deliverables = { ...deliverables, socialImpact: si.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] EthicsFramework/SocialImpact failed (non-fatal):", e);
      }
    }

    // ── Step 4cc: Deal Pipeline + Sales Forecasting ──
    if (!deliverables.dealPipeline || !deliverables.salesForecasting) {
      try {
        const [dp, sf] = await Promise.allSettled([
          synthesizeDealPipeline(businessPacket, job.questionnaire),
          synthesizeSalesForecasting(businessPacket, job.questionnaire),
        ]);
        if (dp.status === "fulfilled" && dp.value) deliverables.dealPipeline = dp.value;
        if (sf.status === "fulfilled" && sf.value) deliverables.salesForecasting = sf.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cc failed:", e); }
    }

    // ── Step 4cd: Account-Based Marketing + Sales Enablement ──
    if (!deliverables.accountBasedMarketing || !deliverables.salesEnablement) {
      try {
        const [abm, se] = await Promise.allSettled([
          synthesizeAccountBasedMarketing(businessPacket, job.questionnaire),
          synthesizeSalesEnablement(businessPacket, job.questionnaire),
        ]);
        if (abm.status === "fulfilled" && abm.value) deliverables.accountBasedMarketing = abm.value;
        if (se.status === "fulfilled" && se.value) deliverables.salesEnablement = se.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cd failed:", e); }
    }

    // ── Step 4ce: Revenue Attribution + Commission Optimization ──
    if (!deliverables.revenueAttribution || !deliverables.commissionOptimization) {
      try {
        const [ra, co] = await Promise.allSettled([
          synthesizeRevenueAttribution(businessPacket, job.questionnaire),
          synthesizeCommissionOptimization(businessPacket, job.questionnaire),
        ]);
        if (ra.status === "fulfilled" && ra.value) deliverables.revenueAttribution = ra.value;
        if (co.status === "fulfilled" && co.value) deliverables.commissionOptimization = co.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ce failed:", e); }
    }

    // ── Step 4cf: Product-Market Fit + Feature Prioritization ──
    if (!deliverables.productMarketFit || !deliverables.featurePrioritization) {
      try {
        const [pmf, fp] = await Promise.allSettled([
          synthesizeProductMarketFit(businessPacket, job.questionnaire),
          synthesizeFeaturePrioritization(businessPacket, job.questionnaire),
        ]);
        if (pmf.status === "fulfilled" && pmf.value) deliverables.productMarketFit = pmf.value;
        if (fp.status === "fulfilled" && fp.value) deliverables.featurePrioritization = fp.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cf failed:", e); }
    }

    // ── Step 4cg: User Onboarding + Product Analytics ──
    if (!deliverables.userOnboarding || !deliverables.productAnalytics) {
      try {
        const [uo, pa] = await Promise.allSettled([
          synthesizeUserOnboarding(businessPacket, job.questionnaire),
          synthesizeProductAnalytics(businessPacket, job.questionnaire),
        ]);
        if (uo.status === "fulfilled" && uo.value) deliverables.userOnboarding = uo.value;
        if (pa.status === "fulfilled" && pa.value) deliverables.productAnalytics = pa.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cg failed:", e); }
    }

    // ── Step 4ch: Market Timing + Competitive Response ──
    if (!deliverables.marketTiming || !deliverables.competitiveResponse) {
      try {
        const [mt, cr] = await Promise.allSettled([
          synthesizeMarketTiming(businessPacket, job.questionnaire),
          synthesizeCompetitiveResponse(businessPacket, job.questionnaire),
        ]);
        if (mt.status === "fulfilled" && mt.value) deliverables.marketTiming = mt.value;
        if (cr.status === "fulfilled" && cr.value) deliverables.competitiveResponse = cr.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ch failed:", e); }
    }

    // ── Step 4ci: Scenario Planning + Capital Structure ──
    if (!deliverables.scenarioPlanning || !deliverables.capitalStructure) {
      try {
        const [sp, cs] = await Promise.allSettled([
          synthesizeScenarioPlanning(businessPacket, job.questionnaire),
          synthesizeCapitalStructure(businessPacket, job.questionnaire),
        ]);
        if (sp.status === "fulfilled" && sp.value) deliverables.scenarioPlanning = sp.value;
        if (cs.status === "fulfilled" && cs.value) deliverables.capitalStructure = cs.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ci failed:", e); }
    }

    // ── Step 4cj: Working Capital + Tax Strategy ──
    if (!deliverables.workingCapital || !deliverables.taxStrategy) {
      try {
        const [wc, ts] = await Promise.allSettled([
          synthesizeWorkingCapital(businessPacket, job.questionnaire),
          synthesizeTaxStrategy(businessPacket, job.questionnaire),
        ]);
        if (wc.status === "fulfilled" && wc.value) deliverables.workingCapital = wc.value;
        if (ts.status === "fulfilled" && ts.value) deliverables.taxStrategy = ts.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cj failed:", e); }
    }

    // ── Step 4ck: Fundraising Readiness + Exit Strategy ──
    if (!deliverables.fundraisingReadiness || !deliverables.exitStrategy) {
      try {
        const [fr, es] = await Promise.allSettled([
          synthesizeFundraisingReadiness(businessPacket, job.questionnaire),
          synthesizeExitStrategy(businessPacket, job.questionnaire),
        ]);
        if (fr.status === "fulfilled" && fr.value) deliverables.fundraisingReadiness = fr.value;
        if (es.status === "fulfilled" && es.value) deliverables.exitStrategy = es.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ck failed:", e); }
    }

    // ── Step 4cl: Talent Acquisition + Employee Engagement ──
    if (!deliverables.talentAcquisition || !deliverables.employeeEngagement) {
      try {
        const [ta, ee] = await Promise.allSettled([
          synthesizeTalentAcquisition(businessPacket, job.questionnaire),
          synthesizeEmployeeEngagement(businessPacket, job.questionnaire),
        ]);
        if (ta.status === "fulfilled" && ta.value) deliverables.talentAcquisition = ta.value;
        if (ee.status === "fulfilled" && ee.value) deliverables.employeeEngagement = ee.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cl failed:", e); }
    }

    // ── Step 4cm: Compensation Benchmark + Succession Planning ──
    if (!deliverables.compensationBenchmark || !deliverables.successionPlanning) {
      try {
        const [cb, spl] = await Promise.allSettled([
          synthesizeCompensationBenchmark(businessPacket, job.questionnaire),
          synthesizeSuccessionPlanning(businessPacket, job.questionnaire),
        ]);
        if (cb.status === "fulfilled" && cb.value) deliverables.compensationBenchmark = cb.value;
        if (spl.status === "fulfilled" && spl.value) deliverables.successionPlanning = spl.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cm failed:", e); }
    }

    // ── Step 4cn: Diversity & Inclusion + Culture Assessment ──
    if (!deliverables.diversityInclusion || !deliverables.cultureAssessment) {
      try {
        const [di, ca] = await Promise.allSettled([
          synthesizeDiversityInclusion(businessPacket, job.questionnaire),
          synthesizeCultureAssessment(businessPacket, job.questionnaire),
        ]);
        if (di.status === "fulfilled" && di.value) deliverables.diversityInclusion = di.value;
        if (ca.status === "fulfilled" && ca.value) deliverables.cultureAssessment = ca.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cn failed:", e); }
    }

    // ── Step 4co: Market Entry Playbook + Partner Channel Strategy ──
    if (!deliverables.marketEntryPlaybook || !deliverables.partnerChannelStrategy) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMarketEntryPlaybook(businessPacket, job.questionnaire),
          synthesizePartnerChannelStrategy(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.marketEntryPlaybook = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.partnerChannelStrategy = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4co failed:", e); }
    }

    // ── Step 4cp: Acquisition Integration + International Readiness ──
    if (!deliverables.acquisitionIntegration || !deliverables.internationalReadiness) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAcquisitionIntegration(businessPacket, job.questionnaire),
          synthesizeInternationalReadiness(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.acquisitionIntegration = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.internationalReadiness = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cp failed:", e); }
    }

    // ── Step 4cq: Revenue Model Analysis + Growth Experiments ──
    if (!deliverables.revenueModelAnalysis || !deliverables.growthExperiments) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRevenueModelAnalysis(businessPacket, job.questionnaire),
          synthesizeGrowthExperiments(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.revenueModelAnalysis = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.growthExperiments = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cq failed:", e); }
    }

    // ── Step 4cr: Customer Acquisition Cost + Lifetime Value Optimization ──
    if (!deliverables.customerAcquisitionCost || !deliverables.lifetimeValueOptimization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCustomerAcquisitionCost(businessPacket, job.questionnaire),
          synthesizeLifetimeValueOptimization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.customerAcquisitionCost = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.lifetimeValueOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cr failed:", e); }
    }

    // ── Step 4cs: Churn Prediction + Net Revenue Retention ──
    if (!deliverables.churnPrediction || !deliverables.netRevenueRetention) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeChurnPrediction(businessPacket, job.questionnaire),
          synthesizeNetRevenueRetention(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.churnPrediction = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.netRevenueRetention = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cs failed:", e); }
    }

    // ── Step 4ct: Customer Advocacy + Feedback Loop ──
    if (!deliverables.customerAdvocacy || !deliverables.feedbackLoop) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCustomerAdvocacy(businessPacket, job.questionnaire),
          synthesizeFeedbackLoop(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.customerAdvocacy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.feedbackLoop = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ct failed:", e); }
    }

    // ── Step 4cu: Process Automation + Cost Benchmark ──
    if (!deliverables.processAutomation || !deliverables.costBenchmark) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeProcessAutomation(businessPacket, job.questionnaire),
          synthesizeCostBenchmark(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.processAutomation = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.costBenchmark = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cu failed:", e); }
    }

    // ── Step 4cv: Vendor Negotiation + Scalability Assessment ──
    if (!deliverables.vendorNegotiation || !deliverables.scalabilityAssessment) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeVendorNegotiation(businessPacket, job.questionnaire),
          synthesizeScalabilityAssessment(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.vendorNegotiation = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.scalabilityAssessment = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cv failed:", e); }
    }

    // ── Step 4cw: Incident Readiness + Operational Risk ──
    if (!deliverables.incidentReadiness || !deliverables.operationalRisk) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeIncidentReadiness(businessPacket, job.questionnaire),
          synthesizeOperationalRisk(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.incidentReadiness = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.operationalRisk = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cw failed:", e); }
    }

    // ── Step 4cx: Data Strategy + AI Use Cases ──
    if (!deliverables.dataStrategy || !deliverables.aiUseCases) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDataStrategy(businessPacket, job.questionnaire),
          synthesizeAiUseCases(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.dataStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.aiUseCases = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cx failed:", e); }
    }

    // ── Step 4cy: Analytics Roadmap + Data Privacy ──
    if (!deliverables.analyticsRoadmap || !deliverables.dataPrivacy) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAnalyticsRoadmap(businessPacket, job.questionnaire),
          synthesizeDataPrivacy(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.analyticsRoadmap = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.dataPrivacy = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cy failed:", e); }
    }

    // ── Step 4cz: MLOps Readiness + Digital Transformation ──
    if (!deliverables.mlOpsReadiness || !deliverables.digitalTransformation) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMlOpsReadiness(businessPacket, job.questionnaire),
          synthesizeDigitalTransformation(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.mlOpsReadiness = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.digitalTransformation = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4cz failed:", e); }
    }

    // ── Step 4da: Revenue Ops + Billing Optimization ──
    if (!deliverables.revenueOps || !deliverables.billingOptimization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRevenueOps(businessPacket, job.questionnaire),
          synthesizeBillingOptimization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.revenueOps = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.billingOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4da failed:", e); }
    }

    // ── Step 4db: Contract Intelligence + Commission Tracking ──
    if (!deliverables.contractIntelligence || !deliverables.commissionTracking) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeContractIntelligence(businessPacket, job.questionnaire),
          synthesizeCommissionTracking(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.contractIntelligence = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.commissionTracking = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4db failed:", e); }
    }

    // ── Step 4dc: Revenue Recognition + Subscription Health ──
    if (!deliverables.revenueRecognition || !deliverables.subscriptionHealth) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRevenueRecognition(businessPacket, job.questionnaire),
          synthesizeSubscriptionHealth(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.revenueRecognition = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.subscriptionHealth = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dc failed:", e); }
    }

    // ── Step 4dd: Product Roadmap Health + Tech Debt Prioritization ──
    if (!deliverables.productRoadmapHealth || !deliverables.techDebtPrioritization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeProductRoadmapHealth(businessPacket, job.questionnaire),
          synthesizeTechDebtPrioritization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.productRoadmapHealth = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.techDebtPrioritization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dd failed:", e); }
    }

    // ── Step 4de: Release Velocity + Bug Trend Analysis ──
    if (!deliverables.releaseVelocity || !deliverables.bugTrendAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeReleaseVelocity(businessPacket, job.questionnaire),
          synthesizeBugTrendAnalysis(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.releaseVelocity = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.bugTrendAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4de failed:", e); }
    }

    // ── Step 4df: API Performance + User Experience Score ──
    if (!deliverables.apiPerformance || !deliverables.userExperienceScore) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeApiPerformance(businessPacket, job.questionnaire),
          synthesizeUserExperienceScore(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.apiPerformance = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.userExperienceScore = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4df failed:", e); }
    }

    // ── Step 4dg: Workforce Planning + Skills Gap Analysis ──
    if (!deliverables.workforcePlanning || !deliverables.skillsGapAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeWorkforcePlanning(businessPacket, job.questionnaire),
          synthesizeSkillsGapAnalysis(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.workforcePlanning = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.skillsGapAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dg failed:", e); }
    }

    // ── Step 4dh: Remote Work Effectiveness + Team Velocity ──
    if (!deliverables.remoteWorkEffectiveness || !deliverables.teamVelocity) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRemoteWorkEffectiveness(businessPacket, job.questionnaire),
          synthesizeTeamVelocity(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.remoteWorkEffectiveness = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.teamVelocity = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dh failed:", e); }
    }

    // ── Step 4di: Burnout Risk + Learning & Development ──
    if (!deliverables.burnoutRisk || !deliverables.learningDevelopment) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeBurnoutRisk(businessPacket, job.questionnaire),
          synthesizeLearningDevelopment(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.burnoutRisk = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.learningDevelopment = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4di failed:", e); }
    }

    // ── Step 4dj: Regulatory Risk + Contract Management ──
    if (!deliverables.regulatoryRisk || !deliverables.contractManagement) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRegulatoryRisk(businessPacket, job.questionnaire),
          synthesizeContractManagement(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.regulatoryRisk = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.contractManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dj failed:", e); }
    }

    // ── Step 4dk: IP Strategy + Legal Spend Analysis ──
    if (!deliverables.ipStrategy || !deliverables.legalSpendAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeIpStrategy(businessPacket, job.questionnaire),
          synthesizeLegalSpendAnalysis(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.ipStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.legalSpendAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dk failed:", e); }
    }

    // ── Step 4dl: Policy Compliance + Audit Readiness ──
    if (!deliverables.policyCompliance || !deliverables.auditReadiness) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePolicyCompliance(businessPacket, job.questionnaire),
          synthesizeAuditReadiness(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.policyCompliance = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.auditReadiness = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dl failed:", e); }
    }

    // ── Step 4dm: Sales Methodology + Pipeline Velocity ──
    if (!deliverables.salesMethodology || !deliverables.pipelineVelocity) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeSalesMethodology(businessPacket, job.questionnaire),
          synthesizePipelineVelocity(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.salesMethodology = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.pipelineVelocity = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dm failed:", e); }
    }

    // ── Step 4dn: Deal Qualification + Sales Coaching ──
    if (!deliverables.dealQualification || !deliverables.salesCoaching) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDealQualification(businessPacket, job.questionnaire),
          synthesizeSalesCoaching(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.dealQualification = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.salesCoaching = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dn failed:", e); }
    }

    // ── Step 4do: Account Planning + Competitive Battlecards ──
    if (!deliverables.accountPlanning || !deliverables.competitiveBattlecards) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAccountPlanning(businessPacket, job.questionnaire),
          synthesizeCompetitiveBattlecards(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.accountPlanning = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.competitiveBattlecards = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4do failed:", e); }
    }

    // ── Step 4dp: Cash Burn Analysis + Revenue Per Employee ──
    if (!deliverables.cashBurnAnalysis || !deliverables.revenuePerEmployee) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCashBurnAnalysis(businessPacket, job.questionnaire),
          synthesizeRevenuePerEmployee(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.cashBurnAnalysis = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.revenuePerEmployee = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dp failed:", e); }
    }

    // ── Step 4dq: Financial Benchmarking + Investment Portfolio ──
    if (!deliverables.financialBenchmarking || !deliverables.investmentPortfolio) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeFinancialBenchmarking(businessPacket, job.questionnaire),
          synthesizeInvestmentPortfolio(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.financialBenchmarking = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.investmentPortfolio = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dq failed:", e); }
    }

    // ── Step 4dr: Cost Allocation Model + Margin Waterfall ──
    if (!deliverables.costAllocationModel || !deliverables.marginWaterfall) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCostAllocationModel(businessPacket, job.questionnaire),
          synthesizeMarginWaterfall(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.costAllocationModel = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.marginWaterfall = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dr failed:", e); }
    }

    // ── Step 4ds: Customer Onboarding Metrics + Health Score Model ──
    if (!deliverables.customerOnboardingMetrics || !deliverables.healthScoreModel) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCustomerOnboardingMetrics(businessPacket, job.questionnaire),
          synthesizeHealthScoreModel(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.customerOnboardingMetrics = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.healthScoreModel = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ds failed:", e); }
    }

    // ── Step 4dt: CS Expansion Playbook + Renewal Forecasting ──
    if (!deliverables.csExpansionPlaybook || !deliverables.renewalForecasting) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCsExpansionPlaybook(businessPacket, job.questionnaire),
          synthesizeRenewalForecasting(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.csExpansionPlaybook = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.renewalForecasting = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dt failed:", e); }
    }

    // ── Step 4du: CS Operations + Customer Milestones ──
    if (!deliverables.csOperations || !deliverables.customerMilestones) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCsOperations(businessPacket, job.questionnaire),
          synthesizeCustomerMilestones(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.csOperations = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.customerMilestones = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4du failed:", e); }
    }

    // ── Step 4dv: OKR Framework + Strategic Pillars ──
    if (!deliverables.okrFramework || !deliverables.strategicPillars) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeOkrFramework(businessPacket, job.questionnaire),
          synthesizeStrategicPillars(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.okrFramework = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.strategicPillars = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dv failed:", e); }
    }

    // ── Step 4dw: Competitive Positioning + Market Share Analysis ──
    if (!deliverables.competitivePositioning || !deliverables.marketShareAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCompetitivePositioning(businessPacket, job.questionnaire),
          synthesizeMarketShareAnalysis(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.competitivePositioning = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.marketShareAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dw failed:", e); }
    }

    // ── Step 4dx: Growth Corridors + Value Prop Canvas ──
    if (!deliverables.growthCorridors || !deliverables.valuePropCanvas) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeGrowthCorridors(businessPacket, job.questionnaire),
          synthesizeValuePropCanvas(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.growthCorridors = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.valuePropCanvas = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dx failed:", e); }
    }

    // ── Step 4dy: Competitive Monitoring + Market Trend Radar ──
    if (!deliverables.competitiveMonitoring || !deliverables.marketTrendRadar) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCompetitiveMonitoring(businessPacket, job.questionnaire),
          synthesizeMarketTrendRadar(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.competitiveMonitoring = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.marketTrendRadar = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dy failed:", e); }
    }

    // ── Step 4dz: Industry Benchmark Index + Customer Intel Platform ──
    if (!deliverables.industryBenchmarkIndex || !deliverables.customerIntelPlatform) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeIndustryBenchmarkIndex(businessPacket, job.questionnaire),
          synthesizeCustomerIntelPlatform(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.industryBenchmarkIndex = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.customerIntelPlatform = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4dz failed:", e); }
    }

    // ── Step 4ea: Price Sensitivity Model + Demand Signal Analysis ──
    if (!deliverables.priceSensitivityModel || !deliverables.demandSignalAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePriceSensitivityModel(businessPacket, job.questionnaire),
          synthesizeDemandSignalAnalysis(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.priceSensitivityModel = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.demandSignalAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ea failed:", e); }
    }

    // ── Step 4eb: Digital Maturity Index + Cloud Migration Readiness ──
    if (!deliverables.digitalMaturityIndex || !deliverables.cloudMigrationReadiness) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDigitalMaturityIndex(businessPacket, job.questionnaire),
          synthesizeCloudMigrationReadiness(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.digitalMaturityIndex = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.cloudMigrationReadiness = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4eb failed:", e); }
    }

    // ── Step 4ec: Automation ROI + Digital Workplace ──
    if (!deliverables.automationRoi || !deliverables.digitalWorkplace) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAutomationRoi(businessPacket, job.questionnaire),
          synthesizeDigitalWorkplace(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.automationRoi = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.digitalWorkplace = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ec failed:", e); }
    }

    // ── Step 4ed: Cybersecurity Posture + Tech Vendor Consolidation ──
    if (!deliverables.cybersecurityPosture || !deliverables.techVendorConsolidation) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCybersecurityPosture(businessPacket, job.questionnaire),
          synthesizeTechVendorConsolidation(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.cybersecurityPosture = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.techVendorConsolidation = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ed failed:", e); }
    }

    // ── Step 4ee: Revenue Source Mapping + Channel Mix Optimization ──
    if (!deliverables.revenueSourceMapping || !deliverables.channelMixOptimization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRevenueSourceMapping(businessPacket, job.questionnaire),
          synthesizeChannelMixOptimization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.revenueSourceMapping = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.channelMixOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ee failed:", e); }
    }

    // ── Step 4ef: Cross-Sell Engine + Price Optimization Model ──
    if (!deliverables.crossSellEngine || !deliverables.priceOptimizationModel) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCrossSellEngine(businessPacket, job.questionnaire),
          synthesizePriceOptimizationModel(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.crossSellEngine = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.priceOptimizationModel = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ef failed:", e); }
    }

    // ── Step 4eg: Promotion Effectiveness + Revenue Health Index ──
    if (!deliverables.promotionEffectiveness || !deliverables.revenueHealthIndex) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePromotionEffectiveness(businessPacket, job.questionnaire),
          synthesizeRevenueHealthIndex(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.promotionEffectiveness = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.revenueHealthIndex = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4eg failed:", e); }
    }

    // ── Step 4eh: Organizational Network + Decision Efficiency ──
    if (!deliverables.organizationalNetwork || !deliverables.decisionEfficiency) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeOrganizationalNetwork(businessPacket, job.questionnaire),
          synthesizeDecisionEfficiency(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.organizationalNetwork = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.decisionEfficiency = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4eh failed:", e); }
    }

    // ── Step 4ei: Meeting Efficiency + Knowledge Capital ──
    if (!deliverables.meetingEfficiency || !deliverables.knowledgeCapital) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMeetingEfficiency(businessPacket, job.questionnaire),
          synthesizeKnowledgeCapital(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.meetingEfficiency = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.knowledgeCapital = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ei failed:", e); }
    }

    // ── Step 4ej: Change Management Score + Culture Alignment ──
    if (!deliverables.changeManagementScore || !deliverables.cultureAlignment) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeChangeManagementScore(businessPacket, job.questionnaire),
          synthesizeCultureAlignment(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.changeManagementScore = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.cultureAlignment = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ej failed:", e); }
    }

    // ── Step 4ek: Partner Performance + Ecosystem Mapping ──
    if (!deliverables.partnerPerformance || !deliverables.ecosystemMapping) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePartnerPerformance(businessPacket, job.questionnaire),
          synthesizeEcosystemMapping(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.partnerPerformance = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.ecosystemMapping = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ek failed:", e); }
    }

    // ── Step 4el: Alliance Strategy + Channel Partner Health ──
    if (!deliverables.allianceStrategy || !deliverables.channelPartnerHealth) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAllianceStrategy(businessPacket, job.questionnaire),
          synthesizeChannelPartnerHealth(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.allianceStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.channelPartnerHealth = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4el failed:", e); }
    }

    // ── Step 4em: Co-Selling Pipeline + Integration Marketplace ──
    if (!deliverables.coSellingPipeline || !deliverables.integrationMarketplace) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCoSellingPipeline(businessPacket, job.questionnaire),
          synthesizeIntegrationMarketplace(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.coSellingPipeline = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.integrationMarketplace = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4em failed:", e); }
    }

    // ── Step 4en: Brand Equity Index + Sentiment Dashboard ──
    if (!deliverables.brandEquityIndex || !deliverables.sentimentDashboard) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeBrandEquityIndex(businessPacket, job.questionnaire),
          synthesizeSentimentDashboard(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.brandEquityIndex = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.sentimentDashboard = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4en failed:", e); }
    }

    // ── Step 4eo: Media Share of Voice + Crisis Comms Readiness ──
    if (!deliverables.mediaShareOfVoice || !deliverables.crisisCommsReadiness) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMediaShareOfVoice(businessPacket, job.questionnaire),
          synthesizeCrisisCommsReadiness(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.mediaShareOfVoice = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.crisisCommsReadiness = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4eo failed:", e); }
    }

    // ── Step 4ep: Thought Leadership + Brand Consistency ──
    if (!deliverables.thoughtLeadership || !deliverables.brandConsistency) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeThoughtLeadership(businessPacket, job.questionnaire),
          synthesizeBrandConsistency(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.thoughtLeadership = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.brandConsistency = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ep failed:", e); }
    }

    // ── Step 4eq: Monetization Model + Free Trial Conversion ──
    if (!deliverables.monetizationModel || !deliverables.freeTrialConversion) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMonetizationModel(businessPacket, job.questionnaire),
          synthesizeFreeTrialConversion(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.monetizationModel = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.freeTrialConversion = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4eq failed:", e); }
    }

    // ── Step 4er: Usage-Based Pricing + Bundle Optimization ──
    if (!deliverables.usageBasedPricing || !deliverables.bundleOptimization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeUsageBasedPricing(businessPacket, job.questionnaire),
          synthesizeBundleOptimization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.usageBasedPricing = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.bundleOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4er failed:", e); }
    }

    // ── Step 4es: Discount Discipline + Revenue Leakage Detection ──
    if (!deliverables.discountDiscipline || !deliverables.revenueLeakageDetection) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDiscountDiscipline(businessPacket, job.questionnaire),
          synthesizeRevenueLeakageDetection(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.discountDiscipline = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.revenueLeakageDetection = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4es failed:", e); }
    }

    // ── Step 4et: Customer Academy + Content Engagement ──
    if (!deliverables.customerAcademy || !deliverables.contentEngagement) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCustomerAcademy(businessPacket, job.questionnaire),
          synthesizeContentEngagement(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.customerAcademy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.contentEngagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4et failed:", e); }
    }

    // ── Step 4eu: Community Health + Certification Program ──
    if (!deliverables.communityHealth || !deliverables.certificationProgram) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCommunityHealth(businessPacket, job.questionnaire),
          synthesizeCertificationProgram(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.communityHealth = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.certificationProgram = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4eu failed:", e); }
    }

    // ── Step 4ev: Self-Service Adoption + Support Deflection ──
    if (!deliverables.selfServiceAdoption || !deliverables.supportDeflection) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeSelfServiceAdoption(businessPacket, job.questionnaire),
          synthesizeSupportDeflection(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.selfServiceAdoption = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.supportDeflection = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ev failed:", e); }
    }

    // ── Step 4ew: Investor Deck + Funding Timeline ──
    if (!deliverables.investorDeck || !deliverables.fundingTimeline) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeInvestorDeck(businessPacket, job.questionnaire),
          synthesizeFundingTimeline(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.investorDeck = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.fundingTimeline = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ew failed:", e); }
    }

    // ── Step 4ex: Valuation Model + Cap Table Management ──
    if (!deliverables.valuationModel || !deliverables.capTableManagement) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeValuationModel(businessPacket, job.questionnaire),
          synthesizeCapTableManagement(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.valuationModel = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.capTableManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ex failed:", e); }
    }

    // ── Step 4ey: Investor Communication + Board Reporting ──
    if (!deliverables.investorCommunication || !deliverables.boardReporting) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeInvestorCommunication(businessPacket, job.questionnaire),
          synthesizeBoardReporting(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.investorCommunication = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.boardReporting = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ey failed:", e); }
    }

    // ── Step 4ez: Geo Expansion Strategy + Local Market Entry ──
    if (!deliverables.geoExpansionStrategy || !deliverables.localMarketEntry) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeGeoExpansionStrategy(businessPacket, job.questionnaire),
          synthesizeLocalMarketEntry(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.geoExpansionStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.localMarketEntry = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ez failed:", e); }
    }

    // ── Step 4fa: Market Regulations + Partner Localization ──
    if (!deliverables.marketRegulations || !deliverables.partnerLocalization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMarketRegulations(businessPacket, job.questionnaire),
          synthesizePartnerLocalization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.marketRegulations = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.partnerLocalization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fa failed:", e); }
    }

    // ── Step 4fb: Cultural Adaptation + Expansion ROI ──
    if (!deliverables.culturalAdaptation || !deliverables.expansionRoi) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCulturalAdaptation(businessPacket, job.questionnaire),
          synthesizeExpansionRoi(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.culturalAdaptation = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.expansionRoi = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fb failed:", e); }
    }

    // ── Step 4fc: Product-Led Metrics + Activation Funnel ──
    if (!deliverables.productLedMetrics || !deliverables.activationFunnel) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeProductLedMetrics(businessPacket, job.questionnaire),
          synthesizeActivationFunnel(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.productLedMetrics = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.activationFunnel = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fc failed:", e); }
    }

    // ── Step 4fd: Feature Adoption + Virality ──
    if (!deliverables.featureAdoption || !deliverables.virality) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeFeatureAdoption(businessPacket, job.questionnaire),
          synthesizeVirality(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.featureAdoption = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.virality = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fd failed:", e); }
    }

    // ── Step 4fe: Product Qualified Leads + Time to Value ──
    if (!deliverables.productQualifiedLeads || !deliverables.timeToValue) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeProductQualifiedLeads(businessPacket, job.questionnaire),
          synthesizeTimeToValue(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.productQualifiedLeads = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.timeToValue = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fe failed:", e); }
    }

    // ── Step 4ff: AI Readiness Score + ML Use Case Priority ──
    if (!deliverables.aiReadinessScore || !deliverables.mlUseCasePriority) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAiReadinessScore(businessPacket, job.questionnaire),
          synthesizeMlUseCasePriority(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.aiReadinessScore = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.mlUseCasePriority = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ff failed:", e); }
    }

    // ── Step 4fg: Data Infrastructure + AI Talent Gap ──
    if (!deliverables.dataInfrastructure || !deliverables.aiTalentGap) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDataInfrastructure(businessPacket, job.questionnaire),
          synthesizeAiTalentGap(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.dataInfrastructure = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.aiTalentGap = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fg failed:", e); }
    }

    // ── Step 4fh: Ethical AI Framework + AI ROI Projection ──
    if (!deliverables.ethicalAiFramework || !deliverables.aiRoiProjection) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeEthicalAiFramework(businessPacket, job.questionnaire),
          synthesizeAiRoiProjection(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.ethicalAiFramework = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.aiRoiProjection = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fh failed:", e); }
    }

    // ── Wave 57 — Customer Advocacy ──

    // ── Step 4fi: Advocacy Program + Referral Mechanism ──
    if (!deliverables.advocacyProgram || !deliverables.referralMechanism) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeAdvocacyProgram(businessPacket, job.questionnaire),
          synthesizeReferralMechanism(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.advocacyProgram = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.referralMechanism = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fi failed:", e); }
    }

    // ── Step 4fj: Testimonial Pipeline + Case Study Factory ──
    if (!deliverables.testimonialPipeline || !deliverables.caseStudyFactory) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeTestimonialPipeline(businessPacket, job.questionnaire),
          synthesizeCaseStudyFactory(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.testimonialPipeline = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.caseStudyFactory = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fj failed:", e); }
    }

    // ── Step 4fk: Customer Advisory Board + NPS Action Plan ──
    if (!deliverables.customerAdvisoryBoard || !deliverables.npsActionPlan) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeCustomerAdvisoryBoard(businessPacket, job.questionnaire),
          synthesizeNpsActionPlan(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.customerAdvisoryBoard = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.npsActionPlan = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fk failed:", e); }
    }

    // ── Wave 58 — Operational Finance ──

    // ── Step 4fl: Procurement Efficiency + Expense Management ──
    if (!deliverables.procurementEfficiency || !deliverables.expenseManagement) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeProcurementEfficiency(businessPacket, job.questionnaire),
          synthesizeExpenseManagement(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.procurementEfficiency = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.expenseManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fl failed:", e); }
    }

    // ── Step 4fm: Invoice Automation + Payment Optimization ──
    if (!deliverables.invoiceAutomation || !deliverables.paymentOptimization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeInvoiceAutomation(businessPacket, job.questionnaire),
          synthesizePaymentOptimization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.invoiceAutomation = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.paymentOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fm failed:", e); }
    }

    // ── Step 4fn: Financial Controls + Treasury Management ──
    if (!deliverables.financialControls || !deliverables.treasuryManagement) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeFinancialControls(businessPacket, job.questionnaire),
          synthesizeTreasuryManagement(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.financialControls = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.treasuryManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fn failed:", e); }
    }

    // ── Wave 59 — Growth Marketing ──

    // ── Step 4fo: Demand Gen Engine + Content Marketing ROI ──
    if (!deliverables.demandGenEngine || !deliverables.contentMarketingRoi) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDemandGenEngine(businessPacket, job.questionnaire),
          synthesizeContentMarketingRoi(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.demandGenEngine = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.contentMarketingRoi = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fo failed:", e); }
    }

    // ── Step 4fp: SEO Strategy + Paid Media Optimization ──
    if (!deliverables.seoStrategy || !deliverables.paidMediaOptimization) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeSeoStrategy(businessPacket, job.questionnaire),
          synthesizePaidMediaOptimization(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.seoStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.paidMediaOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fp failed:", e); }
    }

    // ── Step 4fq: Event ROI + Influencer Strategy ──
    if (!deliverables.eventRoi || !deliverables.influencerStrategy) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeEventRoi(businessPacket, job.questionnaire),
          synthesizeInfluencerStrategy(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.eventRoi = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.influencerStrategy = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fq failed:", e); }
    }

    // ── Wave 60 — Platform Strategy ──

    // ── Step 4fr: Platform Economics + Developer Experience ──
    if (!deliverables.platformEconomics || !deliverables.developerExperience) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePlatformEconomics(businessPacket, job.questionnaire),
          synthesizeDeveloperExperience(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.platformEconomics = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.developerExperience = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fr failed:", e); }
    }

    // ── Step 4fs: API Monetization + Marketplace Strategy ──
    if (!deliverables.apiMonetization || !deliverables.marketplaceStrategy) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeApiMonetization(businessPacket, job.questionnaire),
          synthesizeMarketplaceStrategy(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.apiMonetization = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.marketplaceStrategy = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fs failed:", e); }
    }

    // ── Step 4ft: Platform Governance + Platform Network Dynamics ──
    if (!deliverables.platformGovernance || !deliverables.platformNetworkDynamics) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePlatformGovernance(businessPacket, job.questionnaire),
          synthesizePlatformNetworkDynamics(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.platformGovernance = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.platformNetworkDynamics = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ft failed:", e); }
    }

    // ── Step 4fu: Contract Lifecycle + Compliance Automation ──
    if (!deliverables.contractLifecycle || !deliverables.complianceAutomation) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeContractLifecycle(businessPacket, job.questionnaire),
          synthesizeComplianceAutomation(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.contractLifecycle = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.complianceAutomation = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fu failed:", e); }
    }

    // ── Step 4fv: Legal Risk Register + IP Audit ──
    if (!deliverables.legalRiskRegister || !deliverables.intellectualPropertyAudit) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeLegalRiskRegister(businessPacket, job.questionnaire),
          synthesizeIntellectualPropertyAudit(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.legalRiskRegister = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.intellectualPropertyAudit = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fv failed:", e); }
    }

    // ── Step 4fw: Regulatory Calendar + Privacy Compliance ──
    if (!deliverables.regulatoryCalendar || !deliverables.privacyCompliance) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeRegulatoryCalendar(businessPacket, job.questionnaire),
          synthesizePrivacyCompliance(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.regulatoryCalendar = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.privacyCompliance = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fw failed:", e); }
    }

    // ── Step 4fx: Data Warehouse Strategy + BI Dashboard Design ──
    if (!deliverables.dataWarehouseStrategy || !deliverables.biDashboardDesign) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeDataWarehouseStrategy(businessPacket, job.questionnaire),
          synthesizeBiDashboardDesign(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.dataWarehouseStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.biDashboardDesign = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fx failed:", e); }
    }

    // ── Step 4fy: Predictive Model Catalog + Data Lineage Map ──
    if (!deliverables.predictiveModelCatalog || !deliverables.dataLineageMap) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePredictiveModelCatalog(businessPacket, job.questionnaire),
          synthesizeDataLineageMap(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.predictiveModelCatalog = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.dataLineageMap = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fy failed:", e); }
    }

    // ── Step 4fz: Metrics Dictionary + Analytics Governance ──
    if (!deliverables.metricsDictionary || !deliverables.analyticsGovernance) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeMetricsDictionary(businessPacket, job.questionnaire),
          synthesizeAnalyticsGovernance(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.metricsDictionary = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.analyticsGovernance = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4fz failed:", e); }
    }

    // ── Step 4ga: Employee Journey + Workplace Wellness ──
    if (!deliverables.employeeJourney || !deliverables.workplaceWellness) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeEmployeeJourney(businessPacket, job.questionnaire),
          synthesizeWorkplaceWellness(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.employeeJourney = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.workplaceWellness = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ga failed:", e); }
    }

    // ── Step 4gb: Learning Pathways + Performance Framework ──
    if (!deliverables.learningPathways || !deliverables.performanceFramework) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeLearningPathways(businessPacket, job.questionnaire),
          synthesizePerformanceFramework(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.learningPathways = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.performanceFramework = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gb failed:", e); }
    }

    // ── Step 4gc: Pay Equity Analysis + DEI Benchmark ──
    if (!deliverables.payEquityAnalysis || !deliverables.deiBenchmark) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePayEquityAnalysis(businessPacket, job.questionnaire),
          synthesizeDeiBenchmark(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.payEquityAnalysis = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.deiBenchmark = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gc failed:", e); }
    }

    // ── Step 4gd: Business Model Canvas + Revenue Model Design ──
    if (!deliverables.businessModelCanvas || !deliverables.revenueModelDesign) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeBusinessModelCanvas(businessPacket, job.questionnaire),
          synthesizeRevenueModelDesign(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.businessModelCanvas = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.revenueModelDesign = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gd failed:", e); }
    }

    // ── Step 4ge: Value Chain Optimization + Cost Structure Analysis ──
    if (!deliverables.valueChainOptimization || !deliverables.costStructureAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizeValueChainOptimization(businessPacket, job.questionnaire),
          synthesizeCostStructureAnalysis(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.valueChainOptimization = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.costStructureAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ge failed:", e); }
    }

    // ── Step 4gf: Partnership Model + Growth Lever Assessment ──
    if (!deliverables.partnershipModel || !deliverables.growthLeverAssessment) {
      try {
        const [a, b] = await Promise.allSettled([
          synthesizePartnershipModel(businessPacket, job.questionnaire),
          synthesizeGrowthLeverAssessment(businessPacket, job.questionnaire),
        ]);
        if (a.status === "fulfilled" && a.value) deliverables.partnershipModel = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.growthLeverAssessment = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gf failed:", e); }
    }

    // ── Step 4gg: Vendor Management + Supply Chain Visibility ──
    if (!deliverables.vendorManagement || !deliverables.supplyChainVisibility) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeVendorManagement(businessPacket, job.questionnaire), synthesizeSupplyChainVisibility(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.vendorManagement = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.supplyChainVisibility = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gg failed:", e); }
    }

    // ── Step 4gh: Sustainable Sourcing + Facility Optimization ──
    if (!deliverables.sustainableSourcing || !deliverables.facilityOptimization) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeSustainableSourcing(businessPacket, job.questionnaire), synthesizeFacilityOptimization(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.sustainableSourcing = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.facilityOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gh failed:", e); }
    }

    // ── Step 4gi: Fleet Management + Customer Success ──
    if (!deliverables.fleetManagement || !deliverables.customerSuccess) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeFleetManagement(businessPacket, job.questionnaire), synthesizeCustomerSuccess(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.fleetManagement = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.customerSuccess = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gi failed:", e); }
    }

    // ── Step 4gj: Crisis Management + Operational Resilience ──
    if (!deliverables.crisisManagement || !deliverables.operationalResilience) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeCrisisManagement(businessPacket, job.questionnaire), synthesizeOperationalResilience(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.crisisManagement = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.operationalResilience = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gj failed:", e); }
    }

    // ── Step 4gk: Stakeholder Mapping + Digital Presence ──
    if (!deliverables.stakeholderMapping || !deliverables.digitalPresence) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeStakeholderMapping(businessPacket, job.questionnaire), synthesizeDigitalPresence(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.stakeholderMapping = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.digitalPresence = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gk failed:", e); }
    }

    // ── Step 4gl: Channel Strategy + Account Management ──
    if (!deliverables.channelStrategy || !deliverables.accountManagement) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeChannelStrategy(businessPacket, job.questionnaire), synthesizeAccountManagement(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.channelStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.accountManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gl failed:", e); }
    }

    // ── Step 4gm: Fundraising Strategy + Cap Table Management ──
    if (!deliverables.fundraisingStrategy || !deliverables.captableManagement) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeFundraisingStrategy(businessPacket, job.questionnaire), synthesizeCaptableManagement(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.fundraisingStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.captableManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gm failed:", e); }
    }

    // ── Step 4gn: Exit Planning + Board Governance ──
    if (!deliverables.exitPlanning || !deliverables.boardGovernance) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeExitPlanning(businessPacket, job.questionnaire), synthesizeBoardGovernance(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.exitPlanning = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.boardGovernance = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gn failed:", e); }
    }

    // ── Step 4go: Recruitment Funnel + Employer Branding ──
    if (!deliverables.recruitmentFunnel || !deliverables.employerBranding) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeRecruitmentFunnel(businessPacket, job.questionnaire), synthesizeEmployerBranding(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.recruitmentFunnel = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.employerBranding = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4go failed:", e); }
    }

    // ── Step 4gp: Team Topology + Onboarding Optimization ──
    if (!deliverables.teamTopology || !deliverables.onboardingOptimization) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeTeamTopology(businessPacket, job.questionnaire), synthesizeOnboardingOptimization(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.teamTopology = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.onboardingOptimization = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gp failed:", e); }
    }

    // ── Step 4gq: Meeting Culture + Document Management ──
    if (!deliverables.meetingCulture || !deliverables.documentManagement) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeMeetingCulture(businessPacket, job.questionnaire), synthesizeDocumentManagement(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.meetingCulture = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.documentManagement = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gq failed:", e); }
    }

    // ── Step 4gr: Workflow Automation + Quality Assurance ──
    if (!deliverables.workflowAutomation || !deliverables.qualityAssurance) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeWorkflowAutomation(businessPacket, job.questionnaire), synthesizeQualityAssurance(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.workflowAutomation = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.qualityAssurance = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gr failed:", e); }
    }

    // ── Step 4gs: Incident Response + Access Control ──
    if (!deliverables.incidentResponse || !deliverables.accessControl) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeIncidentResponse(businessPacket, job.questionnaire), synthesizeAccessControl(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.incidentResponse = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.accessControl = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gs failed:", e); }
    }

    // ── Step 4gt: Audit Trail + Penetration Testing ──
    if (!deliverables.auditTrail || !deliverables.penetrationTesting) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeAuditTrail(businessPacket, job.questionnaire), synthesizePenetrationTesting(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.auditTrail = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.penetrationTesting = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gt failed:", e); }
    }

    // ── Step 4gu: Security Awareness + Data Classification ──
    if (!deliverables.securityAwareness || !deliverables.dataClassification) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeSecurityAwareness(businessPacket, job.questionnaire), synthesizeDataClassification(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.securityAwareness = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.dataClassification = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gu failed:", e); }
    }

    // ── Step 4gv: API Design + Microservices Architecture ──
    if (!deliverables.apiDesign || !deliverables.microservicesArchitecture) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeApiDesign(businessPacket, job.questionnaire), synthesizeMicroservicesArchitecture(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.apiDesign = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.microservicesArchitecture = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gv failed:", e); }
    }

    // ── Step 4gw: Cloud Optimization + DevOps Maturity ──
    if (!deliverables.cloudOptimization || !deliverables.devopsMaturity) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeCloudOptimization(businessPacket, job.questionnaire), synthesizeDevopsMaturity(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.cloudOptimization = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.devopsMaturity = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gw failed:", e); }
    }

    // ── Step 4gx: System Monitoring + Code Quality ──
    if (!deliverables.systemMonitoring || !deliverables.codeQuality) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeSystemMonitoring(businessPacket, job.questionnaire), synthesizeCodeQuality(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.systemMonitoring = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.codeQuality = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gx failed:", e); }
    }

    // ── Step 4gy: Customer Lifetime Value + Sentiment Analysis ──
    if (!deliverables.customerLifetimeValue || !deliverables.sentimentAnalysis) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeCustomerLifetimeValue(businessPacket, job.questionnaire), synthesizeSentimentAnalysis(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.customerLifetimeValue = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.sentimentAnalysis = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gy failed:", e); }
    }

    // ── Step 4gz: Support Ticket Analysis + Segment Profitability ──
    if (!deliverables.supportTicketAnalysis || !deliverables.segmentProfitability) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeSupportTicketAnalysis(businessPacket, job.questionnaire), synthesizeSegmentProfitability(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.supportTicketAnalysis = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.segmentProfitability = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4gz failed:", e); }
    }

    // ── Step 4ha: Referral Analytics + Customer Health Dashboard ──
    if (!deliverables.referralAnalytics || !deliverables.customerHealthDashboard) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeReferralAnalytics(businessPacket, job.questionnaire), synthesizeCustomerHealthDashboard(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.referralAnalytics = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.customerHealthDashboard = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ha failed:", e); }
    }

    // ── Step 4hb: Innovation Portfolio + Contingency Planning ──
    if (!deliverables.innovationPortfolio || !deliverables.contingencyPlanning) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeInnovationPortfolio(businessPacket, job.questionnaire), synthesizeContingencyPlanning(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.innovationPortfolio = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.contingencyPlanning = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hb failed:", e); }
    }

    // ── Step 4hc: Operating Rhythm + Cross-Functional Sync ──
    if (!deliverables.operatingRhythm || !deliverables.crossFunctionalSync) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeOperatingRhythm(businessPacket, job.questionnaire), synthesizeCrossFunctionalSync(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.operatingRhythm = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.crossFunctionalSync = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hc failed:", e); }
    }

    // ── Step 4hd: Ward Room Strategy + Revenue Intelligence ──
    if (!deliverables.wardRoomStrategy || !deliverables.revenueIntelligence) {
      try {
        const [a, b] = await Promise.allSettled([synthesizeWardRoomStrategy(businessPacket, job.questionnaire), synthesizeRevenueIntelligence(businessPacket, job.questionnaire)]);
        if (a.status === "fulfilled" && a.value) deliverables.wardRoomStrategy = a.value;
        if (b.status === "fulfilled" && b.value) deliverables.revenueIntelligence = b.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hd failed:", e); }
    }

    // ── Step 4he+4hf: Market Research + Competitor Tracking (Wave 73) ──
    if (!deliverables.marketResearch || !deliverables.competitorTracking) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('marketResearch', () => synthesizeMarketResearch(businessPacket, job.questionnaire)),
          synthIf('competitorTracking', () => synthesizeCompetitorTracking(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.marketResearch = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.competitorTracking = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4he+4hf failed:", e); }
    }

    // ── Step 4hg+4hh: Industry Trends + Social Listening (Wave 73) ──
    if (!deliverables.industryTrends || !deliverables.socialListening) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('industryTrends', () => synthesizeIndustryTrends(businessPacket, job.questionnaire)),
          synthIf('socialListening', () => synthesizeSocialListening(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.industryTrends = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.socialListening = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hg+4hh failed:", e); }
    }

    // ── Step 4hi+4hj: UX Research + Web Analytics (Wave 73) ──
    if (!deliverables.uxResearch || !deliverables.webAnalytics) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('uxResearch', () => synthesizeUxResearch(businessPacket, job.questionnaire)),
          synthIf('webAnalytics', () => synthesizeWebAnalytics(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.uxResearch = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.webAnalytics = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hi+4hj failed:", e); }
    }

    // ── Step 4hk+4hl: Email Marketing + Conversion Optimization (Wave 74) ──
    if (!deliverables.emailMarketing || !deliverables.conversionOptimization) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('emailMarketing', () => synthesizeEmailMarketing(businessPacket, job.questionnaire)),
          synthIf('conversionOptimization', () => synthesizeConversionOptimization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.emailMarketing = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.conversionOptimization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hk+4hl failed:", e); }
    }

    // ── Step 4hm+4hn: A/B Testing Framework + Marketing Attribution (Wave 74) ──
    if (!deliverables.abTestingFramework || !deliverables.marketingAttribution) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('abTestingFramework', () => synthesizeAbTestingFramework(businessPacket, job.questionnaire)),
          synthIf('marketingAttribution', () => synthesizeMarketingAttribution(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.abTestingFramework = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.marketingAttribution = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hm+4hn failed:", e); }
    }

    // ── Step 4ho+4hp: Content Calendar + Social Media Calendar (Wave 74) ──
    if (!deliverables.contentCalendar || !deliverables.socialMediaCalendar) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('contentCalendar', () => synthesizeContentCalendar(businessPacket, job.questionnaire)),
          synthIf('socialMediaCalendar', () => synthesizeSocialMediaCalendar(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.contentCalendar = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.socialMediaCalendar = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ho+4hp failed:", e); }
    }

    // ── Step 4hq+4hr: Budget Planning + Revenue Forecasting (Wave 75) ──
    if (!deliverables.budgetPlanning || !deliverables.revenueForecasting) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('budgetPlanning', () => synthesizeBudgetPlanning(businessPacket, job.questionnaire)),
          synthIf('revenueForecasting', () => synthesizeRevenueForecasting(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.budgetPlanning = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.revenueForecasting = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hq+4hr failed:", e); }
    }

    // ── Step 4hs+4ht: Cash Management + Credit Management (Wave 75) ──
    if (!deliverables.cashManagement || !deliverables.creditManagement) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('cashManagement', () => synthesizeCashManagement(businessPacket, job.questionnaire)),
          synthIf('creditManagement', () => synthesizeCreditManagement(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.cashManagement = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.creditManagement = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hs+4ht failed:", e); }
    }

    // ── Step 4hu+4hv: Debt Structure + Financial Reporting (Wave 75) ──
    if (!deliverables.debtStructure || !deliverables.financialReporting) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('debtStructure', () => synthesizeDebtStructure(businessPacket, job.questionnaire)),
          synthIf('financialReporting', () => synthesizeFinancialReporting(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.debtStructure = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.financialReporting = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hu+4hv failed:", e); }
    }

    // ── Step 4hw+4hx: Carbon Reduction + Circular Economy (Wave 76) ──
    if (!deliverables.carbonReduction || !deliverables.circularEconomy) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('carbonReduction', () => synthesizeCarbonReduction(businessPacket, job.questionnaire)),
          synthIf('circularEconomy', () => synthesizeCircularEconomy(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.carbonReduction = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.circularEconomy = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hw+4hx failed:", e); }
    }

    // ── Step 4hy+4hz: Community Impact + Water Management (Wave 76) ──
    if (!deliverables.communityImpact || !deliverables.waterManagement) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('communityImpact', () => synthesizeCommunityImpact(businessPacket, job.questionnaire)),
          synthIf('waterManagement', () => synthesizeWaterManagement(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.communityImpact = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.waterManagement = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4hy+4hz failed:", e); }
    }

    // ── Step 4ia+4ib: Waste Reduction + Sustainable Innovation (Wave 76) ──
    if (!deliverables.wasteReduction || !deliverables.sustainableInnovation) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('wasteReduction', () => synthesizeWasteReduction(businessPacket, job.questionnaire)),
          synthIf('sustainableInnovation', () => synthesizeSustainableInnovation(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.wasteReduction = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.sustainableInnovation = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ia+4ib failed:", e); }
    }

    // ── Step 4ic+4id: Talent Pipeline + Leadership Development (Wave 77) ──
    if (!deliverables.talentPipeline || !deliverables.leadershipDevelopment) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('talentPipeline', () => synthesizeTalentPipeline(businessPacket, job.questionnaire)),
          synthIf('leadershipDevelopment', () => synthesizeLeadershipDevelopment(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.talentPipeline = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.leadershipDevelopment = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ic+4id failed:", e); }
    }

    // ── Step 4ie+4if: Succession Readiness + Compensation Strategy (Wave 77) ──
    if (!deliverables.successionReadiness || !deliverables.compensationStrategy) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('successionReadiness', () => synthesizeSuccessionReadiness(businessPacket, job.questionnaire)),
          synthIf('compensationStrategy', () => synthesizeCompensationStrategy(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.successionReadiness = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.compensationStrategy = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ie+4if failed:", e); }
    }

    // ── Step 4ig+4ih: Workforce Analytics + Org Effectiveness (Wave 77) ──
    if (!deliverables.workforceAnalytics || !deliverables.orgEffectiveness) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('workforceAnalytics', () => synthesizeWorkforceAnalytics(businessPacket, job.questionnaire)),
          synthIf('orgEffectiveness', () => synthesizeOrgEffectiveness(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.workforceAnalytics = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.orgEffectiveness = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ig+4ih failed:", e); }
    }

    // ── Step 4ii+4ij: Sales Motion Design + Deal Analytics (Wave 78) ──
    if (!deliverables.salesMotionDesign || !deliverables.dealAnalytics) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('salesMotionDesign', () => synthesizeSalesMotionDesign(businessPacket, job.questionnaire)),
          synthIf('dealAnalytics', () => synthesizeDealAnalytics(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.salesMotionDesign = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.dealAnalytics = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ii+4ij failed:", e); }
    }

    // ── Step 4ik+4il: Territory Optimization + Sales Compensation (Wave 78) ──
    if (!deliverables.territoryOptimization || !deliverables.salesCompensation) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('territoryOptimization', () => synthesizeTerritoryOptimization(businessPacket, job.questionnaire)),
          synthIf('salesCompensation', () => synthesizeSalesCompensation(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.territoryOptimization = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.salesCompensation = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ik+4il failed:", e); }
    }

    // ── Step 4im+4in: Revenue Prediction + Account Penetration (Wave 78) ──
    if (!deliverables.revenuePrediction || !deliverables.accountPenetration) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('revenuePrediction', () => synthesizeRevenuePrediction(businessPacket, job.questionnaire)),
          synthIf('accountPenetration', () => synthesizeAccountPenetration(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.revenuePrediction = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.accountPenetration = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4im+4in failed:", e); }
    }

    // ── Step 4io+4ip: Product Vision + Feature Roadmap (Wave 79) ──
    if (!deliverables.productVision || !deliverables.featureRoadmap) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('productVision', () => synthesizeProductVision(businessPacket, job.questionnaire)),
          synthIf('featureRoadmap', () => synthesizeFeatureRoadmap(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.productVision = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.featureRoadmap = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4io+4ip failed:", e); }
    }

    // ── Step 4iq+4ir: PMF Assessment + User Activation (Wave 79) ──
    if (!deliverables.pmfAssessment || !deliverables.userActivation) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('pmfAssessment', () => synthesizePmfAssessment(businessPacket, job.questionnaire)),
          synthIf('userActivation', () => synthesizeUserActivation(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.pmfAssessment = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.userActivation = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4iq+4ir failed:", e); }
    }

    // ── Step 4is+4it: Product Insights + Release Strategy (Wave 79) ──
    if (!deliverables.productInsights || !deliverables.releaseStrategy) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('productInsights', () => synthesizeProductInsights(businessPacket, job.questionnaire)),
          synthIf('releaseStrategy', () => synthesizeReleaseStrategy(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.productInsights = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.releaseStrategy = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4is+4it failed:", e); }
    }

    // ── Step 4iu+4iv: Brand Position Map + Brand Valuation (Wave 80) ──
    if (!deliverables.brandPositionMap || !deliverables.brandValuation) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('brandPositionMap', () => synthesizeBrandPositionMap(businessPacket, job.questionnaire)),
          synthIf('brandValuation', () => synthesizeBrandValuation(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.brandPositionMap = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.brandValuation = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4iu+4iv failed:", e); }
    }

    // ── Step 4iw+4ix: Brand Hierarchy + Reputation Analysis (Wave 80) ──
    if (!deliverables.brandHierarchy || !deliverables.reputationAnalysis) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('brandHierarchy', () => synthesizeBrandHierarchy(businessPacket, job.questionnaire)),
          synthIf('reputationAnalysis', () => synthesizeReputationAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.brandHierarchy = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.reputationAnalysis = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4iw+4ix failed:", e); }
    }

    // ── Step 4iy+4iz: Messaging Framework + Visual Branding (Wave 80) ──
    if (!deliverables.messagingFramework || !deliverables.visualBranding) {
      try {
        const [r1, r2] = await Promise.allSettled([
          synthIf('messagingFramework', () => synthesizeMessagingFramework(businessPacket, job.questionnaire)),
          synthIf('visualBranding', () => synthesizeVisualBranding(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.messagingFramework = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.visualBranding = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4iy+4iz failed:", e); }
    }

    // ── Step 4ja+4jb: Growth Playbook + Revenue Run Rate (Wave 81) ──
    if (!deliverables.growthPlaybook || !deliverables.revenueRunRate) {
      try {
        console.log("[Pivot] Synthesizing growthPlaybook + revenueRunRate...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('growthPlaybook', () => synthesizeGrowthPlaybook(businessPacket, job.questionnaire)),
          synthIf('revenueRunRate', () => synthesizeRevenueRunRate(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.growthPlaybook = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.revenueRunRate = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ja+4jb failed:", e); }
    }

    // ── Step 4jc+4jd: Break-Even Model + Operating Leverage Index (Wave 81) ──
    if (!deliverables.breakEvenModel || !deliverables.operatingLeverageIndex) {
      try {
        console.log("[Pivot] Synthesizing breakEvenModel + operatingLeverageIndex...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('breakEvenModel', () => synthesizeBreakEvenModel(businessPacket, job.questionnaire)),
          synthIf('operatingLeverageIndex', () => synthesizeOperatingLeverageIndex(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.breakEvenModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.operatingLeverageIndex = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jc+4jd failed:", e); }
    }

    // ── Step 4je+4jf: Gross Margin Analysis + Funding Scenario Model (Wave 81) ──
    if (!deliverables.grossMarginAnalysis || !deliverables.fundingScenarioModel) {
      try {
        console.log("[Pivot] Synthesizing grossMarginAnalysis + fundingScenarioModel...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('grossMarginAnalysis', () => synthesizeGrossMarginAnalysis(businessPacket, job.questionnaire)),
          synthIf('fundingScenarioModel', () => synthesizeFundingScenarioModel(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.grossMarginAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.fundingScenarioModel = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4je+4jf failed:", e); }
    }

    // ── Step 4jg+4jh: Competitive Wargame + Market Disruption Model (Wave 82) ──
    if (!deliverables.competitiveWargame || !deliverables.marketDisruptionModel) {
      try {
        console.log("[Pivot] Synthesizing competitiveWargame + marketDisruptionModel...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('competitiveWargame', () => synthesizeCompetitiveWargame(businessPacket, job.questionnaire)),
          synthIf('marketDisruptionModel', () => synthesizeMarketDisruptionModel(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.competitiveWargame = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.marketDisruptionModel = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jg+4jh failed:", e); }
    }

    // ── Step 4ji+4jj: First Mover Analysis + Defensibility Audit (Wave 82) ──
    if (!deliverables.firstMoverAnalysis || !deliverables.defensibilityAudit) {
      try {
        console.log("[Pivot] Synthesizing firstMoverAnalysis + defensibilityAudit...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('firstMoverAnalysis', () => synthesizeFirstMoverAnalysis(businessPacket, job.questionnaire)),
          synthIf('defensibilityAudit', () => synthesizeDefensibilityAudit(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.firstMoverAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.defensibilityAudit = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ji+4jj failed:", e); }
    }

    // ── Step 4jk+4jl: Pivot Readiness + Competitive Timing Model (Wave 82) ──
    if (!deliverables.pivotReadiness || !deliverables.competitiveTimingModel) {
      try {
        console.log("[Pivot] Synthesizing pivotReadiness + competitiveTimingModel...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('pivotReadiness', () => synthesizePivotReadiness(businessPacket, job.questionnaire)),
          synthIf('competitiveTimingModel', () => synthesizeCompetitiveTimingModel(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.pivotReadiness = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.competitiveTimingModel = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jk+4jl failed:", e); }
    }

    // ── Step 4jm+4jn: Customer Maturity Model + Expansion Signals (Wave 83) ──
    if (!deliverables.customerMaturityModel || !deliverables.expansionSignals) {
      try {
        console.log("[Pivot] Synthesizing customerMaturityModel + expansionSignals...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('customerMaturityModel', () => synthesizeCustomerMaturityModel(businessPacket, job.questionnaire)),
          synthIf('expansionSignals', () => synthesizeExpansionSignals(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.customerMaturityModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.expansionSignals = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jm+4jn failed:", e); }
    }

    // ── Step 4jo+4jp: Adoption Scorecard + Stakeholder Sentiment (Wave 83) ──
    if (!deliverables.adoptionScorecard || !deliverables.stakeholderSentiment) {
      try {
        console.log("[Pivot] Synthesizing adoptionScorecard + stakeholderSentiment...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('adoptionScorecard', () => synthesizeAdoptionScorecard(businessPacket, job.questionnaire)),
          synthIf('stakeholderSentiment', () => synthesizeStakeholderSentiment(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.adoptionScorecard = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.stakeholderSentiment = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jo+4jp failed:", e); }
    }

    // ── Step 4jq+4jr: Value Realization + Renewal Playbook (Wave 83) ──
    if (!deliverables.valueRealization || !deliverables.renewalPlaybook) {
      try {
        console.log("[Pivot] Synthesizing valueRealization + renewalPlaybook...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('valueRealization', () => synthesizeValueRealization(businessPacket, job.questionnaire)),
          synthIf('renewalPlaybook', () => synthesizeRenewalPlaybook(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.valueRealization = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.renewalPlaybook = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jq+4jr failed:", e); }
    }

    // ── Step 4js+4jt: Business Model Innovation + Monetization Experiment (Wave 84) ──
    if (!deliverables.businessModelInnovation || !deliverables.monetizationExperiment) {
      try {
        console.log("[Pivot] Synthesizing businessModelInnovation + monetizationExperiment...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('businessModelInnovation', () => synthesizeBusinessModelInnovation(businessPacket, job.questionnaire)),
          synthIf('monetizationExperiment', () => synthesizeMonetizationExperiment(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.businessModelInnovation = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.monetizationExperiment = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4js+4jt failed:", e); }
    }

    // ── Step 4ju+4jv: Pricing Architecture + Revenue Stream Map (Wave 84) ──
    if (!deliverables.pricingArchitecture || !deliverables.revenueStreamMap) {
      try {
        console.log("[Pivot] Synthesizing pricingArchitecture + revenueStreamMap...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('pricingArchitecture', () => synthesizePricingArchitecture(businessPacket, job.questionnaire)),
          synthIf('revenueStreamMap', () => synthesizeRevenueStreamMap(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.pricingArchitecture = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.revenueStreamMap = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ju+4jv failed:", e); }
    }

    // ── Step 4jw+4jx: Cost Driver Analysis + Value Capture (Wave 84) ──
    if (!deliverables.costDriverAnalysis || !deliverables.valueCapture) {
      try {
        console.log("[Pivot] Synthesizing costDriverAnalysis + valueCapture...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('costDriverAnalysis', () => synthesizeCostDriverAnalysis(businessPacket, job.questionnaire)),
          synthIf('valueCapture', () => synthesizeValueCapture(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.costDriverAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.valueCapture = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jw+4jx failed:", e); }
    }

    // ── Step 4jy+4jz: Revenue Process Map + Billing Health Check (Wave 85) ──
    if (!deliverables.revenueProcessMap || !deliverables.billingHealthCheck) {
      try {
        console.log("[Pivot] Synthesizing revenueProcessMap + billingHealthCheck...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('revenueProcessMap', () => synthesizeRevenueProcessMap(businessPacket, job.questionnaire)),
          synthIf('billingHealthCheck', () => synthesizeBillingHealthCheck(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.revenueProcessMap = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.billingHealthCheck = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4jy+4jz failed:", e); }
    }

    // ── Step 4ka+4kb: Quote-to-Close Analysis + Revenue Leak Detector (Wave 85) ──
    if (!deliverables.quoteToCloseAnalysis || !deliverables.revenueLeakDetector) {
      try {
        console.log("[Pivot] Synthesizing quoteToCloseAnalysis + revenueLeakDetector...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('quoteToCloseAnalysis', () => synthesizeQuoteToCloseAnalysis(businessPacket, job.questionnaire)),
          synthIf('revenueLeakDetector', () => synthesizeRevenueLeakDetector(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.quoteToCloseAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.revenueLeakDetector = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ka+4kb failed:", e); }
    }

    // ── Step 4kc+4kd: Forecast Accuracy Model + Deal Desk Optimization (Wave 85) ──
    if (!deliverables.forecastAccuracyModel || !deliverables.dealDeskOptimization) {
      try {
        console.log("[Pivot] Synthesizing forecastAccuracyModel + dealDeskOptimization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('forecastAccuracyModel', () => synthesizeForecastAccuracyModel(businessPacket, job.questionnaire)),
          synthIf('dealDeskOptimization', () => synthesizeDealDeskOptimization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.forecastAccuracyModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.dealDeskOptimization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4kc+4kd failed:", e); }
    }

    // ── Step 4ke+4kf: Talent Market Intel + Employee Lifecycle Map (Wave 86) ──
    if (!deliverables.talentMarketIntel || !deliverables.employeeLifecycleMap) {
      try {
        console.log("[Pivot] Synthesizing talentMarketIntel + employeeLifecycleMap...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('talentMarketIntel', () => synthesizeTalentMarketIntel(businessPacket, job.questionnaire)),
          synthIf('employeeLifecycleMap', () => synthesizeEmployeeLifecycleMap(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.talentMarketIntel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.employeeLifecycleMap = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ke+4kf failed:", e); }
    }

    // ── Step 4kg+4kh: Skills Inventory + Team Dynamics Analysis (Wave 86) ──
    if (!deliverables.skillsInventory || !deliverables.teamDynamicsAnalysis) {
      try {
        console.log("[Pivot] Synthesizing skillsInventory + teamDynamicsAnalysis...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('skillsInventory', () => synthesizeSkillsInventory(businessPacket, job.questionnaire)),
          synthIf('teamDynamicsAnalysis', () => synthesizeTeamDynamicsAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.skillsInventory = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.teamDynamicsAnalysis = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4kg+4kh failed:", e); }
    }

    // ── Step 4ki+4kj: Hybrid Work Model + Compensation Philosophy (Wave 86) ──
    if (!deliverables.hybridWorkModel || !deliverables.compensationPhilosophy) {
      try {
        console.log("[Pivot] Synthesizing hybridWorkModel + compensationPhilosophy...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('hybridWorkModel', () => synthesizeHybridWorkModel(businessPacket, job.questionnaire)),
          synthIf('compensationPhilosophy', () => synthesizeCompensationPhilosophy(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.hybridWorkModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.compensationPhilosophy = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ki+4kj failed:", e); }
    }

    // ── Step 4kk+4kl: Data Maturity Assessment + Insights Prioritization (Wave 87) ──
    if (!deliverables.dataMaturityAssessment || !deliverables.insightsPrioritization) {
      try {
        console.log("[Pivot] Synthesizing dataMaturityAssessment + insightsPrioritization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('dataMaturityAssessment', () => synthesizeDataMaturityAssessment(businessPacket, job.questionnaire)),
          synthIf('insightsPrioritization', () => synthesizeInsightsPrioritization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.dataMaturityAssessment = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.insightsPrioritization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4kk+4kl failed:", e); }
    }

    // ── Step 4km+4kn: Experiment Velocity + Decision Intelligence (Wave 87) ──
    if (!deliverables.experimentVelocity || !deliverables.decisionIntelligence) {
      try {
        console.log("[Pivot] Synthesizing experimentVelocity + decisionIntelligence...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('experimentVelocity', () => synthesizeExperimentVelocity(businessPacket, job.questionnaire)),
          synthIf('decisionIntelligence', () => synthesizeDecisionIntelligence(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.experimentVelocity = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.decisionIntelligence = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4km+4kn failed:", e); }
    }

    // ── Step 4ko+4kp: Feedback Intelligence + Benchmarking Engine (Wave 87) ──
    if (!deliverables.feedbackIntelligence || !deliverables.benchmarkingEngine) {
      try {
        console.log("[Pivot] Synthesizing feedbackIntelligence + benchmarkingEngine...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('feedbackIntelligence', () => synthesizeFeedbackIntelligence(businessPacket, job.questionnaire)),
          synthIf('benchmarkingEngine', () => synthesizeBenchmarkingEngine(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.feedbackIntelligence = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.benchmarkingEngine = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ko+4kp failed:", e); }
    }

    // ── Step 4kq+4kr: Partner Value Map + Co-Innovation Pipeline (Wave 88) ──
    if (!deliverables.partnerValueMap || !deliverables.coInnovationPipeline) {
      try {
        console.log("[Pivot] Synthesizing partnerValueMap + coInnovationPipeline...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('partnerValueMap', () => synthesizePartnerValueMap(businessPacket, job.questionnaire)),
          synthIf('coInnovationPipeline', () => synthesizeCoInnovationPipeline(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.partnerValueMap = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.coInnovationPipeline = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4kq+4kr failed:", e); }
    }

    // ── Step 4ks+4kt: Ecosystem Revenue + Alliance Scorecard (Wave 88) ──
    if (!deliverables.ecosystemRevenue || !deliverables.allianceScorecard) {
      try {
        console.log("[Pivot] Synthesizing ecosystemRevenue + allianceScorecard...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('ecosystemRevenue', () => synthesizeEcosystemRevenue(businessPacket, job.questionnaire)),
          synthIf('allianceScorecard', () => synthesizeAllianceScorecard(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.ecosystemRevenue = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.allianceScorecard = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ks+4kt failed:", e); }
    }

    // ── Step 4ku+4kv: Partner Enablement Plan + Marketplace Readiness (Wave 88) ──
    if (!deliverables.partnerEnablementPlan || !deliverables.marketplaceReadiness) {
      try {
        console.log("[Pivot] Synthesizing partnerEnablementPlan + marketplaceReadiness...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('partnerEnablementPlan', () => synthesizePartnerEnablementPlan(businessPacket, job.questionnaire)),
          synthIf('marketplaceReadiness', () => synthesizeMarketplaceReadiness(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.partnerEnablementPlan = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.marketplaceReadiness = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ku+4kv failed:", e); }
    }

    // ── Step 4kw+4kx: Strategy Execution + Initiative Tracking (Wave 89) ──
    if (!deliverables.strategyExecution || !deliverables.initiativeTracking) {
      try {
        console.log("[Pivot] Synthesizing strategyExecution + initiativeTracking...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('strategyExecution', () => synthesizeStrategyExecution(businessPacket, job.questionnaire)),
          synthIf('initiativeTracking', () => synthesizeInitiativeTracking(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.strategyExecution = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.initiativeTracking = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4kw+4kx failed:", e); }
    }

    // ── Step 4ky+4kz: Resource Allocation Model + Strategic Betting (Wave 89) ──
    if (!deliverables.resourceAllocationModel || !deliverables.strategicBetting) {
      try {
        console.log("[Pivot] Synthesizing resourceAllocationModel + strategicBetting...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('resourceAllocationModel', () => synthesizeResourceAllocationModel(businessPacket, job.questionnaire)),
          synthIf('strategicBetting', () => synthesizeStrategicBetting(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.resourceAllocationModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.strategicBetting = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ky+4kz failed:", e); }
    }

    // ── Step 4la+4lb: Execution Cadence + Alignment Index (Wave 89) ──
    if (!deliverables.executionCadence || !deliverables.alignmentIndex) {
      try {
        console.log("[Pivot] Synthesizing executionCadence + alignmentIndex...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('executionCadence', () => synthesizeExecutionCadence(businessPacket, job.questionnaire)),
          synthIf('alignmentIndex', () => synthesizeAlignmentIndex(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.executionCadence = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.alignmentIndex = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4la+4lb failed:", e); }
    }

    // ── Step 4lc+4ld: Market Signal Radar + Competitor Move Tracker (Wave 90) ──
    if (!deliverables.marketSignalRadar || !deliverables.competitorMoveTracker) {
      try {
        console.log("[Pivot] Synthesizing marketSignalRadar + competitorMoveTracker...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('marketSignalRadar', () => synthesizeMarketSignalRadar(businessPacket, job.questionnaire)),
          synthIf('competitorMoveTracker', () => synthesizeCompetitorMoveTracker(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.marketSignalRadar = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.competitorMoveTracker = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lc+4ld failed:", e); }
    }

    // ── Step 4le+4lf: Customer Voice Aggregator + Industry Convergence Map (Wave 90) ──
    if (!deliverables.customerVoiceAggregator || !deliverables.industryConvergenceMap) {
      try {
        console.log("[Pivot] Synthesizing customerVoiceAggregator + industryConvergenceMap...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('customerVoiceAggregator', () => synthesizeCustomerVoiceAggregator(businessPacket, job.questionnaire)),
          synthIf('industryConvergenceMap', () => synthesizeIndustryConvergenceMap(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.customerVoiceAggregator = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.industryConvergenceMap = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4le+4lf failed:", e); }
    }

    // ── Step 4lg+4lh: Emerging Tech Radar + Regulatory Horizon (Wave 90) ──
    if (!deliverables.emergingTechRadar || !deliverables.regulatoryHorizon) {
      try {
        console.log("[Pivot] Synthesizing emergingTechRadar + regulatoryHorizon...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('emergingTechRadar', () => synthesizeEmergingTechRadar(businessPacket, job.questionnaire)),
          synthIf('regulatoryHorizon', () => synthesizeRegulatoryHorizon(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.emergingTechRadar = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.regulatoryHorizon = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lg+4lh failed:", e); }
    }

    // ── Step 4li+4lj: Cash Flow Forecaster + Profit Driver Tree (Wave 91) ──
    if (!deliverables.cashFlowForecaster || !deliverables.profitDriverTree) {
      try {
        console.log("[Pivot] Synthesizing cashFlowForecaster + profitDriverTree...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('cashFlowForecaster', () => synthesizeCashFlowForecaster(businessPacket, job.questionnaire)),
          synthIf('profitDriverTree', () => synthesizeProfitDriverTree(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.cashFlowForecaster = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.profitDriverTree = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4li+4lj failed:", e); }
    }

    // ── Step 4lk+4ll: Revenue Quality Index + Financial Resilience Score (Wave 91) ──
    if (!deliverables.revenueQualityIndex || !deliverables.financialResilienceScore) {
      try {
        console.log("[Pivot] Synthesizing revenueQualityIndex + financialResilienceScore...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('revenueQualityIndex', () => synthesizeRevenueQualityIndex(businessPacket, job.questionnaire)),
          synthIf('financialResilienceScore', () => synthesizeFinancialResilienceScore(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.revenueQualityIndex = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.financialResilienceScore = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lk+4ll failed:", e); }
    }

    // ── Step 4lm+4ln: Working Capital Optimizer + Investment Readiness Gate (Wave 91) ──
    if (!deliverables.workingCapitalOptimizer || !deliverables.investmentReadinessGate) {
      try {
        console.log("[Pivot] Synthesizing workingCapitalOptimizer + investmentReadinessGate...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('workingCapitalOptimizer', () => synthesizeWorkingCapitalOptimizer(businessPacket, job.questionnaire)),
          synthIf('investmentReadinessGate', () => synthesizeInvestmentReadinessGate(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.workingCapitalOptimizer = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.investmentReadinessGate = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lm+4ln failed:", e); }
    }

    // ── Step 4lo+4lp: Customer DNA Profile + Propensity Model (Wave 92) ──
    if (!deliverables.customerDnaProfile || !deliverables.propensityModel) {
      try {
        console.log("[Pivot] Synthesizing customerDnaProfile + propensityModel...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('customerDnaProfile', () => synthesizeCustomerDnaProfile(businessPacket, job.questionnaire)),
          synthIf('propensityModel', () => synthesizePropensityModel(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.customerDnaProfile = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.propensityModel = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lo+4lp failed:", e); }
    }

    // ── Step 4lq+4lr: Churn Early Warning + Customer Effort Optimizer (Wave 92) ──
    if (!deliverables.churnEarlyWarning || !deliverables.customerEffortOptimizer) {
      try {
        console.log("[Pivot] Synthesizing churnEarlyWarning + customerEffortOptimizer...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('churnEarlyWarning', () => synthesizeChurnEarlyWarning(businessPacket, job.questionnaire)),
          synthIf('customerEffortOptimizer', () => synthesizeCustomerEffortOptimizer(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.churnEarlyWarning = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.customerEffortOptimizer = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lq+4lr failed:", e); }
    }

    // ── Step 4ls+4lt: Loyalty Driver + Account Intelligence (Wave 92) ──
    if (!deliverables.loyaltyDriver || !deliverables.accountIntelligence) {
      try {
        console.log("[Pivot] Synthesizing loyaltyDriver + accountIntelligence...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('loyaltyDriver', () => synthesizeLoyaltyDriver(businessPacket, job.questionnaire)),
          synthIf('accountIntelligence', () => synthesizeAccountIntelligence(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.loyaltyDriver = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.accountIntelligence = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ls+4lt failed:", e); }
    }

    // ── Step 4lu+4lv: GTM Calendar + Launch Readiness (Wave 93) ──
    if (!deliverables.gtmCalendar || !deliverables.launchReadiness) {
      try {
        console.log("[Pivot] Synthesizing gtmCalendar + launchReadiness...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('gtmCalendar', () => synthGtmCalendar(businessPacket, job.questionnaire)),
          synthIf('launchReadiness', () => synthLaunchReadiness(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.gtmCalendar = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.launchReadiness = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lu+4lv failed:", e); }
    }

    // ── Step 4lw+4lx: Message Testing + Sales Collateral (Wave 93) ──
    if (!deliverables.messageTesting || !deliverables.salesCollateral) {
      try {
        console.log("[Pivot] Synthesizing messageTesting + salesCollateral...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('messageTesting', () => synthMessageTesting(businessPacket, job.questionnaire)),
          synthIf('salesCollateral', () => synthSalesCollateral(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.messageTesting = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.salesCollateral = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4lw+4lx failed:", e); }
    }

    // ── Step 4ly+4lz: Demand Gen Plan + Channel Activation (Wave 93) ──
    if (!deliverables.demandGenPlan || !deliverables.channelActivation) {
      try {
        console.log("[Pivot] Synthesizing demandGenPlan + channelActivation...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('demandGenPlan', () => synthDemandGenPlan(businessPacket, job.questionnaire)),
          synthIf('channelActivation', () => synthChannelActivation(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.demandGenPlan = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.channelActivation = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ly+4lz failed:", e); }
    }

    // ── Step 4ma+4mb: Price Elasticity Model + Dynamic Pricing Engine (Wave 94) ──
    if (!deliverables.priceElasticityModel || !deliverables.dynamicPricingEngine) {
      try {
        console.log("[Pivot] Synthesizing priceElasticityModel + dynamicPricingEngine...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('priceElasticityModel', () => synthPriceElasticityModel(businessPacket, job.questionnaire)),
          synthIf('dynamicPricingEngine', () => synthDynamicPricingEngine(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.priceElasticityModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.dynamicPricingEngine = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ma+4mb failed:", e); }
    }

    // ── Step 4mc+4md: Discount Impact Analysis + Bundle Designer (Wave 94) ──
    if (!deliverables.discountImpactAnalysis || !deliverables.bundleDesigner) {
      try {
        console.log("[Pivot] Synthesizing discountImpactAnalysis + bundleDesigner...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('discountImpactAnalysis', () => synthDiscountImpactAnalysis(businessPacket, job.questionnaire)),
          synthIf('bundleDesigner', () => synthBundleDesigner(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.discountImpactAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.bundleDesigner = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mc+4md failed:", e); }
    }

    // ── Step 4me+4mf: Competitive Price Tracker + Pricing Experiment (Wave 94) ──
    if (!deliverables.competitivePriceTracker || !deliverables.pricingExperiment) {
      try {
        console.log("[Pivot] Synthesizing competitivePriceTracker + pricingExperiment...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('competitivePriceTracker', () => synthCompetitivePriceTracker(businessPacket, job.questionnaire)),
          synthIf('pricingExperiment', () => synthPricingExperiment(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.competitivePriceTracker = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.pricingExperiment = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4me+4mf failed:", e); }
    }

    // ── Step 4mg+4mh: KPI Watchlist + Alert Framework (Wave 95) ──
    if (!deliverables.kpiWatchlist || !deliverables.alertFramework) {
      try {
        console.log("[Pivot] Synthesizing kpiWatchlist + alertFramework...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('kpiWatchlist', () => synthKpiWatchlist(businessPacket, job.questionnaire)),
          synthIf('alertFramework', () => synthAlertFramework(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.kpiWatchlist = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.alertFramework = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mg+4mh failed:", e); }
    }

    // ── Step 4mi+4mj: Anomaly Detection + Trend Forecast (Wave 95) ──
    if (!deliverables.anomalyDetection || !deliverables.trendForecast) {
      try {
        console.log("[Pivot] Synthesizing anomalyDetection + trendForecast...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('anomalyDetection', () => synthAnomalyDetection(businessPacket, job.questionnaire)),
          synthIf('trendForecast', () => synthTrendForecast(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.anomalyDetection = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.trendForecast = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mi+4mj failed:", e); }
    }

    // ── Step 4mk+4ml: Dashboard Design + Insights Catalog (Wave 95) ──
    if (!deliverables.dashboardDesign || !deliverables.insightsCatalog) {
      try {
        console.log("[Pivot] Synthesizing dashboardDesign + insightsCatalog...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('dashboardDesign', () => synthDashboardDesign(businessPacket, job.questionnaire)),
          synthIf('insightsCatalog', () => synthInsightsCatalog(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.dashboardDesign = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.insightsCatalog = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mk+4ml failed:", e); }
    }

    // ── Step 4mm+4mn: Idea Pipeline + Innovation Scoring (Wave 96) ──
    if (!deliverables.ideaPipeline || !deliverables.innovationScoring) {
      try {
        console.log("[Pivot] Synthesizing ideaPipeline + innovationScoring...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('ideaPipeline', () => synthIdeaPipeline(businessPacket, job.questionnaire)),
          synthIf('innovationScoring', () => synthInnovationScoring(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.ideaPipeline = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.innovationScoring = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mm+4mn failed:", e); }
    }

    // ── Step 4mo+4mp: Experiment Board + Patent Analysis (Wave 96) ──
    if (!deliverables.experimentBoard || !deliverables.patentAnalysis) {
      try {
        console.log("[Pivot] Synthesizing experimentBoard + patentAnalysis...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('experimentBoard', () => synthExperimentBoard(businessPacket, job.questionnaire)),
          synthIf('patentAnalysis', () => synthPatentAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.experimentBoard = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.patentAnalysis = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mo+4mp failed:", e); }
    }

    // ── Step 4mq+4mr: Disruption Playbook + Future Proofing (Wave 96) ──
    if (!deliverables.disruptionPlaybook || !deliverables.futureProofing) {
      try {
        console.log("[Pivot] Synthesizing disruptionPlaybook + futureProofing...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('disruptionPlaybook', () => synthDisruptionPlaybook(businessPacket, job.questionnaire)),
          synthIf('futureProofing', () => synthFutureProofing(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.disruptionPlaybook = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.futureProofing = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mq+4mr failed:", e); }
    }

    // ── Step 4ms+4mt: Revenue Mix Analysis + Account Growth Plan (Wave 97) ──
    if (!deliverables.revenueMixAnalysis || !deliverables.accountGrowthPlan) {
      try {
        console.log("[Pivot] Synthesizing revenueMixAnalysis + accountGrowthPlan...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('revenueMixAnalysis', () => synthRevenueMixAnalysis(businessPacket, job.questionnaire)),
          synthIf('accountGrowthPlan', () => synthAccountGrowthPlan(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.revenueMixAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.accountGrowthPlan = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ms+4mt failed:", e); }
    }

    // ── Step 4mu+4mv: Contract Optimizer + Usage Pattern Analysis (Wave 97) ──
    if (!deliverables.contractOptimizer || !deliverables.usagePatternAnalysis) {
      try {
        console.log("[Pivot] Synthesizing contractOptimizer + usagePatternAnalysis...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('contractOptimizer', () => synthContractOptimizer(businessPacket, job.questionnaire)),
          synthIf('usagePatternAnalysis', () => synthUsagePatternAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.contractOptimizer = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.usagePatternAnalysis = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mu+4mv failed:", e); }
    }

    // ── Step 4mw+4mx: Churn Recovery Plan + Winback Program (Wave 97) ──
    if (!deliverables.churnRecoveryPlan || !deliverables.winbackProgram) {
      try {
        console.log("[Pivot] Synthesizing churnRecoveryPlan + winbackProgram...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('churnRecoveryPlan', () => synthChurnRecoveryPlan(businessPacket, job.questionnaire)),
          synthIf('winbackProgram', () => synthWinbackProgram(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.churnRecoveryPlan = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.winbackProgram = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4mw+4mx failed:", e); }
    }

    // ── Step 4my+4mz: Automation Audit + Process Digitization (Wave 98) ──
    if (!deliverables.automationAudit || !deliverables.processDigitization) {
      try {
        console.log("[Pivot] Synthesizing automationAudit + processDigitization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('automationAudit', () => synthAutomationAudit(businessPacket, job.questionnaire)),
          synthIf('processDigitization', () => synthProcessDigitization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.automationAudit = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.processDigitization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4my+4mz failed:", e); }
    }

    // ── Step 4na+4nb: Bot Deployment Plan + Workflow Benchmark (Wave 98) ──
    if (!deliverables.botDeploymentPlan || !deliverables.workflowBenchmark) {
      try {
        console.log("[Pivot] Synthesizing botDeploymentPlan + workflowBenchmark...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('botDeploymentPlan', () => synthBotDeploymentPlan(businessPacket, job.questionnaire)),
          synthIf('workflowBenchmark', () => synthWorkflowBenchmark(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.botDeploymentPlan = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.workflowBenchmark = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4na+4nb failed:", e); }
    }

    // ── Step 4nc+4nd: Handoff Efficiency + Tool Consolidation (Wave 98) ──
    if (!deliverables.handoffEfficiency || !deliverables.toolConsolidation) {
      try {
        console.log("[Pivot] Synthesizing handoffEfficiency + toolConsolidation...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('handoffEfficiency', () => synthHandoffEfficiency(businessPacket, job.questionnaire)),
          synthIf('toolConsolidation', () => synthToolConsolidation(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.handoffEfficiency = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.toolConsolidation = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4nc+4nd failed:", e); }
    }

    // ── Step 4ne+4nf: Crisis Communication + Internal Comms (Wave 99) ──
    if (!deliverables.crisisCommunication || !deliverables.internalComms) {
      try {
        console.log("[Pivot] Synthesizing crisisCommunication + internalComms...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('crisisCommunication', () => synthCrisisCommunication(businessPacket, job.questionnaire)),
          synthIf('internalComms', () => synthInternalComms(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.crisisCommunication = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.internalComms = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ne+4nf failed:", e); }
    }

    // ── Step 4ng+4nh: Investor Narrative + Press Strategy (Wave 99) ──
    if (!deliverables.investorNarrative || !deliverables.pressStrategy) {
      try {
        console.log("[Pivot] Synthesizing investorNarrative + pressStrategy...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('investorNarrative', () => synthInvestorNarrative(businessPacket, job.questionnaire)),
          synthIf('pressStrategy', () => synthPressStrategy(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.investorNarrative = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.pressStrategy = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ng+4nh failed:", e); }
    }

    // ── Step 4ni+4nj: Thought Leadership Plan + Brand Story Arc (Wave 99) ──
    if (!deliverables.thoughtLeadershipPlan || !deliverables.brandStoryArc) {
      try {
        console.log("[Pivot] Synthesizing thoughtLeadershipPlan + brandStoryArc...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('thoughtLeadershipPlan', () => synthThoughtLeadershipPlan(businessPacket, job.questionnaire)),
          synthIf('brandStoryArc', () => synthBrandStoryArc(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.thoughtLeadershipPlan = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.brandStoryArc = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ni+4nj failed:", e); }
    }

    // ── Step 4nk+4nl: Mastery Dashboard + Growth Velocity Score (Wave 100) ──
    if (!deliverables.masteryDashboard || !deliverables.growthVelocityScore) {
      try {
        console.log("[Pivot] Synthesizing masteryDashboard + growthVelocityScore...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('masteryDashboard', () => synthMasteryDashboard(businessPacket, job.questionnaire)),
          synthIf('growthVelocityScore', () => synthGrowthVelocityScore(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.masteryDashboard = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.growthVelocityScore = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4nk+4nl failed:", e); }
    }

    // ── Step 4nm+4nn: Operational Maturity + Leadership Readiness (Wave 100) ──
    if (!deliverables.operationalMaturity || !deliverables.leadershipReadiness) {
      try {
        console.log("[Pivot] Synthesizing operationalMaturity + leadershipReadiness...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('operationalMaturity', () => synthOperationalMaturity(businessPacket, job.questionnaire)),
          synthIf('leadershipReadiness', () => synthLeadershipReadiness(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.operationalMaturity = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.leadershipReadiness = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4nm+4nn failed:", e); }
    }

    // ── Step 4no+4np: Market Dominance Index + Future Readiness (Wave 100) ──
    if (!deliverables.marketDominanceIndex || !deliverables.futureReadiness) {
      try {
        console.log("[Pivot] Synthesizing marketDominanceIndex + futureReadiness...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('marketDominanceIndex', () => synthMarketDominanceIndex(businessPacket, job.questionnaire)),
          synthIf('futureReadiness', () => synthFutureReadiness(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.marketDominanceIndex = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.futureReadiness = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4no+4np failed:", e); }
    }

    // ── Step 4nq+4nr: AI Adoption Potential + ML Use Case Identification (Wave 101) ──
    if (!deliverables.aiAdoptionPotential || !deliverables.mlUseCaseIdentification) {
      try {
        console.log("[Pivot] Synthesizing aiAdoptionPotential + mlUseCaseIdentification...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('aiAdoptionPotential', () => synthAIAdoptionPotential(businessPacket, job.questionnaire)),
          synthIf('mlUseCaseIdentification', () => synthMLUseCaseIdentification(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.aiAdoptionPotential = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.mlUseCaseIdentification = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4nq+4nr failed:", e); }
    }

    // ── Step 4ns+4nt: Data Infrastructure Gap Analysis + Automation ROI Modeling (Wave 101) ──
    if (!deliverables.dataInfrastructureGapAnalysis || !deliverables.automationROIModeling) {
      try {
        console.log("[Pivot] Synthesizing dataInfrastructureGapAnalysis + automationROIModeling...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('dataInfrastructureGapAnalysis', () => synthDataInfrastructureGapAnalysis(businessPacket, job.questionnaire)),
          synthIf('automationROIModeling', () => synthAutomationROIModeling(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.dataInfrastructureGapAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.automationROIModeling = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ns+4nt failed:", e); }
    }

    // ── Step 4nu+4nv: AI Talent Needs Assessment + Ethical AI Framework (Wave 101) ──
    if (!deliverables.aiTalentNeedsAssessment || !deliverables.ethicalAIFramework) {
      try {
        console.log("[Pivot] Synthesizing aiTalentNeedsAssessment + ethicalAIFramework...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('aiTalentNeedsAssessment', () => synthAITalentNeedsAssessment(businessPacket, job.questionnaire)),
          synthIf('ethicalAIFramework', () => synthEthicalAIFramework(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.aiTalentNeedsAssessment = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.ethicalAIFramework = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4nu+4nv failed:", e); }
    }

    // ── Step 4nw+4nx: Market Entry Scoring + Regulatory Landscape Mapping (Wave 102) ──
    if (!deliverables.marketEntryScoring || !deliverables.regulatoryLandscapeMapping) {
      try {
        console.log("[Pivot] Synthesizing marketEntryScoring + regulatoryLandscapeMapping...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('marketEntryScoring', () => synthMarketEntryScoring(businessPacket, job.questionnaire)),
          synthIf('regulatoryLandscapeMapping', () => synthRegulatoryLandscapeMapping(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.marketEntryScoring = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.regulatoryLandscapeMapping = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4nw+4nx failed:", e); }
    }

    // ── Step 4ny+4nz: Cultural Adaptation Strategy + Logistics Expansion Analysis (Wave 102) ──
    if (!deliverables.culturalAdaptationStrategy || !deliverables.logisticsExpansionAnalysis) {
      try {
        console.log("[Pivot] Synthesizing culturalAdaptationStrategy + logisticsExpansionAnalysis...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('culturalAdaptationStrategy', () => synthCulturalAdaptationStrategy(businessPacket, job.questionnaire)),
          synthIf('logisticsExpansionAnalysis', () => synthLogisticsExpansionAnalysis(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.culturalAdaptationStrategy = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.logisticsExpansionAnalysis = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ny+4nz failed:", e); }
    }

    // ── Step 4oa+4ob: Local Partnership Strategy + International Pricing Optimization (Wave 102) ──
    if (!deliverables.localPartnershipStrategy || !deliverables.internationalPricingOptimization) {
      try {
        console.log("[Pivot] Synthesizing localPartnershipStrategy + internationalPricingOptimization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('localPartnershipStrategy', () => synthLocalPartnershipStrategy(businessPacket, job.questionnaire)),
          synthIf('internationalPricingOptimization', () => synthInternationalPricingOptimization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.localPartnershipStrategy = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.internationalPricingOptimization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oa+4ob failed:", e); }
    }

    // ── Step 4oc+4od: Acquisition Funnel Intelligence + Onboarding Effectiveness Score (Wave 103) ──
    if (!deliverables.acquisitionFunnelIntelligence || !deliverables.onboardingEffectivenessScore) {
      try {
        console.log("[Pivot] Synthesizing acquisitionFunnelIntelligence + onboardingEffectivenessScore...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('acquisitionFunnelIntelligence', () => synthAcquisitionFunnelIntelligence(businessPacket, job.questionnaire)),
          synthIf('onboardingEffectivenessScore', () => synthOnboardingEffectivenessScore(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.acquisitionFunnelIntelligence = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.onboardingEffectivenessScore = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oc+4od failed:", e); }
    }

    // ── Step 4oe+4of: Engagement Scoring Model + Expansion Revenue Opportunities (Wave 103) ──
    if (!deliverables.engagementScoringModel || !deliverables.expansionRevenueOpportunities) {
      try {
        console.log("[Pivot] Synthesizing engagementScoringModel + expansionRevenueOpportunities...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('engagementScoringModel', () => synthEngagementScoringModel(businessPacket, job.questionnaire)),
          synthIf('expansionRevenueOpportunities', () => synthExpansionRevenueOpportunities(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.engagementScoringModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.expansionRevenueOpportunities = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oe+4of failed:", e); }
    }

    // ── Step 4og+4oh: Advocacy Program Design + Lifetime Value Modeling (Wave 103) ──
    if (!deliverables.advocacyProgramDesign || !deliverables.lifetimeValueModeling) {
      try {
        console.log("[Pivot] Synthesizing advocacyProgramDesign + lifetimeValueModeling...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('advocacyProgramDesign', () => synthAdvocacyProgramDesign(businessPacket, job.questionnaire)),
          synthIf('lifetimeValueModeling', () => synthLifetimeValueModeling(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.advocacyProgramDesign = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.lifetimeValueModeling = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4og+4oh failed:", e); }
    }

    // ── Step 4oi+4oj: API Monetization Strategy + Platform Ecosystem Health (Wave 104) ──
    if (!deliverables.apiMonetizationStrategy || !deliverables.platformEcosystemHealth) {
      try {
        console.log("[Pivot] Synthesizing apiMonetizationStrategy + platformEcosystemHealth...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('apiMonetizationStrategy', () => synthAPIMonetizationStrategy(businessPacket, job.questionnaire)),
          synthIf('platformEcosystemHealth', () => synthPlatformEcosystemHealth(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.apiMonetizationStrategy = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.platformEcosystemHealth = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oi+4oj failed:", e); }
    }

    // ── Step 4ok+4ol: Developer Experience Optimization + Integration Marketplace Analytics (Wave 104) ──
    if (!deliverables.developerExperienceOptimization || !deliverables.integrationMarketplaceAnalytics) {
      try {
        console.log("[Pivot] Synthesizing developerExperienceOptimization + integrationMarketplaceAnalytics...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('developerExperienceOptimization', () => synthDeveloperExperienceOptimization(businessPacket, job.questionnaire)),
          synthIf('integrationMarketplaceAnalytics', () => synthIntegrationMarketplaceAnalytics(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.developerExperienceOptimization = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.integrationMarketplaceAnalytics = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ok+4ol failed:", e); }
    }

    // ── Step 4om+4on: Partner Enablement Program + Platform Governance Framework (Wave 104) ──
    if (!deliverables.partnerEnablementProgram || !deliverables.platformGovernanceFramework) {
      try {
        console.log("[Pivot] Synthesizing partnerEnablementProgram + platformGovernanceFramework...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('partnerEnablementProgram', () => synthPartnerEnablementProgram(businessPacket, job.questionnaire)),
          synthIf('platformGovernanceFramework', () => synthPlatformGovernanceFramework(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.partnerEnablementProgram = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.platformGovernanceFramework = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4om+4on failed:", e); }
    }

    // ── Step 4oo+4op: Demand Forecasting Engine + Predictive Maintenance Modeling (Wave 105) ──
    if (!deliverables.demandForecastingEngine || !deliverables.predictiveMaintenanceModeling) {
      try {
        console.log("[Pivot] Synthesizing demandForecastingEngine + predictiveMaintenanceModeling...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('demandForecastingEngine', () => synthDemandForecastingEngine(businessPacket, job.questionnaire)),
          synthIf('predictiveMaintenanceModeling', () => synthPredictiveMaintenanceModeling(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.demandForecastingEngine = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.predictiveMaintenanceModeling = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oo+4op failed:", e); }
    }

    // ── Step 4oq+4or: Churn Prediction Model + Lead Scoring AI (Wave 105) ──
    if (!deliverables.churnPredictionModel || !deliverables.leadScoringAI) {
      try {
        console.log("[Pivot] Synthesizing churnPredictionModel + leadScoringAI...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('churnPredictionModel', () => synthChurnPredictionModel(businessPacket, job.questionnaire)),
          synthIf('leadScoringAI', () => synthLeadScoringAI(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.churnPredictionModel = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.leadScoringAI = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oq+4or failed:", e); }
    }

    // ── Step 4os+4ot: Inventory Optimization AI + Revenue Prediction Modeling (Wave 105) ──
    if (!deliverables.inventoryOptimizationAI || !deliverables.revenuePredictionModeling) {
      try {
        console.log("[Pivot] Synthesizing inventoryOptimizationAI + revenuePredictionModeling...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('inventoryOptimizationAI', () => synthInventoryOptimizationAI(businessPacket, job.questionnaire)),
          synthIf('revenuePredictionModeling', () => synthRevenuePredictionModeling(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.inventoryOptimizationAI = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.revenuePredictionModeling = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4os+4ot failed:", e); }
    }

    // ── Step 4ou+4ov: Org Structure Analysis + Span of Control Optimization (Wave 106) ──
    if (!deliverables.orgStructureAnalysis || !deliverables.spanOfControlOptimization) {
      try {
        console.log("[Pivot] Synthesizing orgStructureAnalysis + spanOfControlOptimization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('orgStructureAnalysis', () => synthOrgStructureAnalysis(businessPacket, job.questionnaire)),
          synthIf('spanOfControlOptimization', () => synthSpanOfControlOptimization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.orgStructureAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.spanOfControlOptimization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ou+4ov failed:", e); }
    }

    // ── Step 4ow+4ox: Decision Rights Mapping + Collaboration Network Mapping (Wave 106) ──
    if (!deliverables.decisionRightsMapping || !deliverables.collaborationNetworkMapping) {
      try {
        console.log("[Pivot] Synthesizing decisionRightsMapping + collaborationNetworkMapping...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('decisionRightsMapping', () => synthDecisionRightsMapping(businessPacket, job.questionnaire)),
          synthIf('collaborationNetworkMapping', () => synthCollaborationNetworkMapping(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.decisionRightsMapping = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.collaborationNetworkMapping = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4ow+4ox failed:", e); }
    }

    // ── Step 4oy+4oz: Role Optimization Analysis + Succession Planning Framework (Wave 106) ──
    if (!deliverables.roleOptimizationAnalysis || !deliverables.successionPlanningFramework) {
      try {
        console.log("[Pivot] Synthesizing roleOptimizationAnalysis + successionPlanningFramework...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('roleOptimizationAnalysis', () => synthRoleOptimizationAnalysis(businessPacket, job.questionnaire)),
          synthIf('successionPlanningFramework', () => synthSuccessionPlanningFramework(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.roleOptimizationAnalysis = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.successionPlanningFramework = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4oy+4oz failed:", e); }
    }

    // ── Step 4pa+4pb: Impact Measurement Dashboard + ESG Reporting Compliance (Wave 107) ──
    if (!deliverables.impactMeasurementDashboard || !deliverables.esgReportingCompliance) {
      try {
        console.log("[Pivot] Synthesizing impactMeasurementDashboard + esgReportingCompliance...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('impactMeasurementDashboard', () => synthImpactMeasurementDashboard(businessPacket, job.questionnaire)),
          synthIf('esgReportingCompliance', () => synthESGReportingCompliance(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.impactMeasurementDashboard = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.esgReportingCompliance = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4pa+4pb failed:", e); }
    }

    // ── Step 4pc+4pd: Stakeholder Engagement Analytics + Community Investment Strategy (Wave 107) ──
    if (!deliverables.stakeholderEngagementAnalytics || !deliverables.communityInvestmentStrategy) {
      try {
        console.log("[Pivot] Synthesizing stakeholderEngagementAnalytics + communityInvestmentStrategy...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('stakeholderEngagementAnalytics', () => synthStakeholderEngagementAnalytics(businessPacket, job.questionnaire)),
          synthIf('communityInvestmentStrategy', () => synthCommunityInvestmentStrategy(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.stakeholderEngagementAnalytics = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.communityInvestmentStrategy = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4pc+4pd failed:", e); }
    }

    // ── Step 4pe+4pf: Diversity Metrics Analytics + Green Operations Optimization (Wave 107) ──
    if (!deliverables.diversityMetricsAnalytics || !deliverables.greenOperationsOptimization) {
      try {
        console.log("[Pivot] Synthesizing diversityMetricsAnalytics + greenOperationsOptimization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('diversityMetricsAnalytics', () => synthDiversityMetricsAnalytics(businessPacket, job.questionnaire)),
          synthIf('greenOperationsOptimization', () => synthGreenOperationsOptimization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.diversityMetricsAnalytics = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.greenOperationsOptimization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4pe+4pf failed:", e); }
    }

    // ── Step 4pg+4ph: Knowledge Audit Assessment + Expertise Mapping System (Wave 108) ──
    if (!deliverables.knowledgeAuditAssessment || !deliverables.expertiseMappingSystem) {
      try {
        console.log("[Pivot] Synthesizing knowledgeAuditAssessment + expertiseMappingSystem...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('knowledgeAuditAssessment', () => synthKnowledgeAuditAssessment(businessPacket, job.questionnaire)),
          synthIf('expertiseMappingSystem', () => synthExpertiseMappingSystem(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.knowledgeAuditAssessment = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.expertiseMappingSystem = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4pg+4ph failed:", e); }
    }

    // ── Step 4pi+4pj: Documentation Strategy Framework + Learning Pathways Design (Wave 108) ──
    if (!deliverables.documentationStrategyFramework || !deliverables.learningPathwaysDesign) {
      try {
        console.log("[Pivot] Synthesizing documentationStrategyFramework + learningPathwaysDesign...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('documentationStrategyFramework', () => synthDocumentationStrategyFramework(businessPacket, job.questionnaire)),
          synthIf('learningPathwaysDesign', () => synthLearningPathwaysDesign(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.documentationStrategyFramework = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.learningPathwaysDesign = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4pi+4pj failed:", e); }
    }

    // ── Step 4pk+4pl: Institutional Memory Protection + Knowledge Transfer Optimization (Wave 108) ──
    if (!deliverables.institutionalMemoryProtection || !deliverables.knowledgeTransferOptimization) {
      try {
        console.log("[Pivot] Synthesizing institutionalMemoryProtection + knowledgeTransferOptimization...");
        const [r1, r2] = await Promise.allSettled([
          synthIf('institutionalMemoryProtection', () => synthInstitutionalMemoryProtection(businessPacket, job.questionnaire)),
          synthIf('knowledgeTransferOptimization', () => synthKnowledgeTransferOptimization(businessPacket, job.questionnaire)),
        ]);
        if (r1.status === "fulfilled" && r1.value) deliverables.institutionalMemoryProtection = r1.value;
        if (r2.status === "fulfilled" && r2.value) deliverables.knowledgeTransferOptimization = r2.value;
        updateJob(runId, { deliverables });
      } catch (e) { console.warn("Step 4pk+4pl failed:", e); }
    }

  return deliverables;
}

export async function runPipeline(runId: string): Promise<void> {
  const job = getJob(runId);
  if (!job) return;
  if (!RESUMABLE_ENTRY_STATUSES.has(job.status)) return;

  // Reset failed status so the pipeline can proceed.
  if (job.status === "failed") {
    updateJob(runId, { error: undefined });
  }

  try {
    // ── Step 1: Parse ──────────────────────────────────────────────────────
    // Skip if we already have a businessPacket from a prior run.
    let businessPacket: BusinessPacket | null = null;
    if (job.parsedContext) {
      try {
        businessPacket = JSON.parse(job.parsedContext) as BusinessPacket;
      } catch { /* corrupt — re-parse */ }
    }

    if (!businessPacket) {
      updateJob(runId, { status: "parsing" });
      const parsedFiles = await parseFiles(runId, job.filePaths);

      updateJob(runId, { status: "ingesting" });
      const [bp, knowledgeGraph] = await Promise.all([
        ingestDocuments(parsedFiles, job.questionnaire),
        categorizeAndBuildGraph(parsedFiles, job.questionnaire),
      ]);
      businessPacket = bp;
      updateJob(runId, {
        parsedContext: JSON.stringify(businessPacket),
        knowledgeGraph,
      });
    }

    // ── Activate per-section anti-hallucination guardrails ────────────────
    if (businessPacket.financialFacts && businessPacket.financialFacts.length > 0) {
      setSectionFacts(businessPacket.financialFacts);
      console.log(`[Pivot] Loaded ${businessPacket.financialFacts.length} verified financial facts for synthesis guardrails`);
    }

    // ── Step 2: Synthesize ─────────────────────────────────────────────────
    // Skip if deliverables already exist (e.g. crashed during formatting).
    const fresh = getJob(runId);
    let deliverables: MVPDeliverables;

    if (fresh?.deliverables && Object.keys(fresh.deliverables).length > 3) {
      deliverables = fresh.deliverables;
    } else {
      updateJob(runId, { status: "synthesizing" });
      deliverables = await synthesizeDeliverables(job.questionnaire, businessPacket);
      updateJob(runId, { deliverables });
    }

    // ── Step 3: Website + competitor analysis (best-effort) ────────────────
    const orgId = job.questionnaire.orgId ?? "default-org";
    const websiteUrl = job.questionnaire.website;
    let websiteAnalysis: WebsiteAnalysis | undefined = deliverables.websiteAnalysis;

    if (websiteUrl && !websiteAnalysis) {
      try {
        websiteAnalysis = await analyzeWebsite(websiteUrl, { runId, label: "primary" });
        deliverables = { ...deliverables, websiteAnalysis };
        saveWebsiteAnalysis(orgId, websiteAnalysis);
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Website analysis failed (non-fatal):", e);
      }
    }

    const competitorUrls = job.questionnaire.competitorUrls ?? [];
    let competitorResults: { url: string; analysis: WebsiteAnalysis | null }[] = [];

    if (competitorUrls.length > 0 && !deliverables.competitorAnalysis) {
      try {
        competitorResults = await analyzeCompetitorWebsites(competitorUrls);
      } catch (e) {
        console.warn("[Pivot] Competitor analysis failed (non-fatal):", e);
      }
    }

    let industryLeaderResults: { url: string; analysis: WebsiteAnalysis | null }[] = [];

    if (!deliverables.competitorAnalysis) {
      try {
        const leaderUrls = await findIndustryLeaderUrls(
          businessPacket.industry,
          job.questionnaire.businessModel ?? businessPacket.questionnaire.businessModel
        );
        if (leaderUrls.length > 0) {
          industryLeaderResults = await analyzeCompetitorWebsites(leaderUrls);
        }
      } catch (e) {
        console.warn("[Pivot] Industry leader analysis failed (non-fatal):", e);
      }
    }

    if (!deliverables.competitorAnalysis && (competitorResults.length > 0 || industryLeaderResults.length > 0)) {
      try {
        const competitorAnalysis = await buildCompetitorAnalysis(
          websiteAnalysis ?? null,
          competitorResults,
          industryLeaderResults,
          businessPacket
        );
        deliverables = { ...deliverables, competitorAnalysis };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Competitor report build failed (non-fatal):", e);
      }
    }

    if (!deliverables.techOptimization || !deliverables.pricingIntelligence) {
      try {
        const [techOpt, priceInt] = await Promise.allSettled([
          deliverables.techOptimization ? Promise.resolve(null) : synthesizeTechOptimization(businessPacket, job.questionnaire),
          deliverables.pricingIntelligence ? Promise.resolve(null) : synthesizePricingIntelligence(businessPacket, job.questionnaire, deliverables.competitorAnalysis),
        ]);
        if (techOpt.status === "fulfilled" && techOpt.value) deliverables = { ...deliverables, techOptimization: techOpt.value };
        if (priceInt.status === "fulfilled" && priceInt.value) deliverables = { ...deliverables, pricingIntelligence: priceInt.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Tech/pricing synthesis failed (non-fatal):", e);
      }
    }

    // ── Step 4: Marketing intelligence (social scrape + synthesis) ─────────
    if (!deliverables.marketingStrategy) {
      try {
        console.log("[Pivot] Gathering social profiles + marketing intelligence...");
        const competitorNames = businessPacket.keyMetrics.topCompetitors.slice(0, 3);
        const { userProfiles, competitorProfiles, userRawData, competitorRawData } = await gatherSocialProfiles(
          job.questionnaire,
          competitorNames
        );

        const marketingStrategy = await synthesizeMarketingStrategy(
          job.questionnaire,
          businessPacket,
          websiteAnalysis ?? null,
          deliverables.competitorAnalysis ?? null,
          userProfiles,
          competitorProfiles,
          userRawData,
          competitorRawData
        );
        deliverables = { ...deliverables, marketingStrategy };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Marketing intelligence failed (non-fatal):", e);
      }
    }

    // ── Step 4b: Pitch deck analysis (best-effort) ────────────────────────
    if (!deliverables.pitchDeckAnalysis) {
      // Detect pitch deck files (.pptx, .ppt, or files with "pitch" or "deck" in name)
      const pitchDeckFiles = job.filePaths.filter((fp) => {
        const lower = fp.toLowerCase();
        return lower.endsWith(".pptx") || lower.endsWith(".ppt") ||
          lower.includes("pitch") || lower.includes("deck");
      });

      if (pitchDeckFiles.length > 0) {
        try {
          console.log("[Pivot] Analyzing pitch deck:", pitchDeckFiles[0]);
          const parsedDeck = await parseFiles(runId, [pitchDeckFiles[0]]);
          const deckText = parsedDeck[0]?.text ?? "";
          if (deckText.length > 50) {
            const pitchDeckAnalysis = await analyzePitchDeck(
              deckText,
              parsedDeck[0].filename,
              businessPacket,
              job.questionnaire
            );
            deliverables = { ...deliverables, pitchDeckAnalysis };
            updateJob(runId, { deliverables });
          }
        } catch (e) {
          console.warn("[Pivot] Pitch deck analysis failed (non-fatal):", e);
        }
      }
    }

    // ── Step 4c: Terminology + KPIs + Roadmap + Health Checklist ────────────
    // Detect business model terminology
    if (!deliverables.terminology) {
      try {
        deliverables = { ...deliverables, terminology: detectTerminology(job.questionnaire) };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Terminology detection failed (non-fatal):", e);
      }
    }

    // KPI identification
    if (!deliverables.kpiReport) {
      try {
        console.log("[Pivot] Identifying KPIs...");
        const kpiReport = await synthesizeKPIs(businessPacket, job.questionnaire);
        if (kpiReport) {
          deliverables = { ...deliverables, kpiReport };
          updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] KPI synthesis failed (non-fatal):", e);
      }
    }

    // Health checklist
    if (!deliverables.healthChecklist) {
      try {
        console.log("[Pivot] Generating business health checklist...");
        const healthChecklist = await synthesizeHealthChecklist(businessPacket, job.questionnaire);
        if (healthChecklist) {
          deliverables = { ...deliverables, healthChecklist };
          updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] Health checklist failed (non-fatal):", e);
      }
    }

    // 30-day roadmap (depends on other deliverables for context)
    if (!deliverables.roadmap) {
      try {
        console.log("[Pivot] Building 30-day roadmap...");
        const roadmap = await synthesizeRoadmap(businessPacket, job.questionnaire, deliverables);
        if (roadmap) {
          deliverables = { ...deliverables, roadmap };
          updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] Roadmap synthesis failed (non-fatal):", e);
      }
    }

    // ── Step 4d: Wave 2 intelligence (SWOT, unit economics, etc.) ──────────
    // Run pairs in parallel where possible to save time
    if (!deliverables.swotAnalysis || !deliverables.unitEconomics) {
      try {
        console.log("[Pivot] Synthesizing SWOT + unit economics...");
        const [swot, ue] = await Promise.allSettled([
          deliverables.swotAnalysis ? Promise.resolve(null) : synthesizeSWOT(businessPacket, job.questionnaire),
          deliverables.unitEconomics ? Promise.resolve(null) : synthesizeUnitEconomics(businessPacket, job.questionnaire),
        ]);
        if (swot.status === "fulfilled" && swot.value) deliverables = { ...deliverables, swotAnalysis: swot.value };
        if (ue.status === "fulfilled" && ue.value) deliverables = { ...deliverables, unitEconomics: ue.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] SWOT/UnitEcon failed (non-fatal):", e);
      }
    }

    if (!deliverables.customerSegmentation || !deliverables.competitiveWinLoss) {
      try {
        console.log("[Pivot] Synthesizing customer segmentation + competitive win/loss...");
        const [cs, cwl] = await Promise.allSettled([
          deliverables.customerSegmentation ? Promise.resolve(null) : synthesizeCustomerSegmentation(businessPacket, job.questionnaire),
          deliverables.competitiveWinLoss ? Promise.resolve(null) : synthesizeCompetitiveWinLoss(businessPacket, job.questionnaire, deliverables),
        ]);
        if (cs.status === "fulfilled" && cs.value) deliverables = { ...deliverables, customerSegmentation: cs.value };
        if (cwl.status === "fulfilled" && cwl.value) deliverables = { ...deliverables, competitiveWinLoss: cwl.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Segmentation/WinLoss failed (non-fatal):", e);
      }
    }

    if (!deliverables.revenueForecast || !deliverables.hiringPlan) {
      try {
        console.log("[Pivot] Synthesizing revenue forecast + hiring plan...");
        const [rf, hp] = await Promise.allSettled([
          deliverables.revenueForecast ? Promise.resolve(null) : synthesizeRevenueForecast(businessPacket, job.questionnaire),
          deliverables.hiringPlan ? Promise.resolve(null) : synthesizeHiringPlan(businessPacket, job.questionnaire, deliverables),
        ]);
        if (rf.status === "fulfilled" && rf.value) deliverables = { ...deliverables, revenueForecast: rf.value };
        if (hp.status === "fulfilled" && hp.value) deliverables = { ...deliverables, hiringPlan: hp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Forecast/Hiring failed (non-fatal):", e);
      }
    }

    if (!deliverables.churnPlaybook || !deliverables.salesPlaybook) {
      try {
        console.log("[Pivot] Synthesizing churn playbook + sales playbook...");
        const [cp, sp] = await Promise.allSettled([
          deliverables.churnPlaybook ? Promise.resolve(null) : synthesizeChurnPlaybook(businessPacket, job.questionnaire, deliverables),
          deliverables.salesPlaybook ? Promise.resolve(null) : synthesizeSalesPlaybook(businessPacket, job.questionnaire, deliverables),
        ]);
        if (cp.status === "fulfilled" && cp.value) deliverables = { ...deliverables, churnPlaybook: cp.value };
        if (sp.status === "fulfilled" && sp.value) deliverables = { ...deliverables, salesPlaybook: sp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Churn/Sales playbook failed (non-fatal):", e);
      }
    }

    if (!deliverables.investorOnePager || !deliverables.goalTracker) {
      try {
        console.log("[Pivot] Synthesizing investor one-pager + goal tracker...");
        const [io, gt] = await Promise.allSettled([
          deliverables.investorOnePager ? Promise.resolve(null) : synthesizeInvestorOnePager(businessPacket, job.questionnaire, deliverables),
          deliverables.goalTracker ? Promise.resolve(null) : synthesizeGoalTracker(businessPacket, job.questionnaire, deliverables),
        ]);
        if (io.status === "fulfilled" && io.value) deliverables = { ...deliverables, investorOnePager: io.value };
        if (gt.status === "fulfilled" && gt.value) deliverables = { ...deliverables, goalTracker: gt.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Investor/Goals failed (non-fatal):", e);
      }
    }

    if (!deliverables.benchmarkScore || !deliverables.executiveSummary) {
      try {
        console.log("[Pivot] Synthesizing benchmark score + executive summary...");
        const [bs, es] = await Promise.allSettled([
          deliverables.benchmarkScore ? Promise.resolve(null) : synthesizeBenchmarkScore(businessPacket, job.questionnaire, deliverables),
          deliverables.executiveSummary ? Promise.resolve(null) : synthesizeExecutiveSummary(businessPacket, job.questionnaire, deliverables),
        ]);
        if (bs.status === "fulfilled" && bs.value) deliverables = { ...deliverables, benchmarkScore: bs.value };
        if (es.status === "fulfilled" && es.value) deliverables = { ...deliverables, executiveSummary: es.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Benchmark/ExecSummary failed (non-fatal):", e);
      }
    }

    // ── Step 4e: Wave 4 intelligence (milestones, risk, partnerships, etc.) ──
    if (!deliverables.milestoneTracker || !deliverables.riskRegister) {
      try {
        console.log("[Pivot] Synthesizing milestone tracker + risk register...");
        const [mt, rr] = await Promise.allSettled([
          deliverables.milestoneTracker ? Promise.resolve(null) : synthesizeMilestoneTracker(businessPacket, job.questionnaire),
          deliverables.riskRegister ? Promise.resolve(null) : synthesizeRiskRegister(businessPacket, job.questionnaire),
        ]);
        if (mt.status === "fulfilled" && mt.value) deliverables = { ...deliverables, milestoneTracker: mt.value };
        if (rr.status === "fulfilled" && rr.value) deliverables = { ...deliverables, riskRegister: rr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Milestone/Risk failed (non-fatal):", e);
      }
    }

    if (!deliverables.partnershipOpportunities || !deliverables.fundingReadiness) {
      try {
        console.log("[Pivot] Synthesizing partnership opportunities + funding readiness...");
        const [po, fr] = await Promise.allSettled([
          deliverables.partnershipOpportunities ? Promise.resolve(null) : synthesizePartnershipOpportunities(businessPacket, job.questionnaire),
          deliverables.fundingReadiness ? Promise.resolve(null) : synthesizeFundingReadiness(businessPacket, job.questionnaire, deliverables),
        ]);
        if (po.status === "fulfilled" && po.value) deliverables = { ...deliverables, partnershipOpportunities: po.value };
        if (fr.status === "fulfilled" && fr.value) deliverables = { ...deliverables, fundingReadiness: fr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Partnership/Funding failed (non-fatal):", e);
      }
    }

    if (!deliverables.marketSizing || !deliverables.scenarioPlanner) {
      try {
        console.log("[Pivot] Synthesizing market sizing + scenario planner...");
        const [ms, sp] = await Promise.allSettled([
          deliverables.marketSizing ? Promise.resolve(null) : synthesizeMarketSizing(businessPacket, job.questionnaire),
          deliverables.scenarioPlanner ? Promise.resolve(null) : synthesizeScenarioPlanner(businessPacket, job.questionnaire),
        ]);
        if (ms.status === "fulfilled" && ms.value) deliverables = { ...deliverables, marketSizing: ms.value };
        if (sp.status === "fulfilled" && sp.value) deliverables = { ...deliverables, scenarioPlanner: sp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] MarketSizing/Scenario failed (non-fatal):", e);
      }
    }

    if (!deliverables.operationalEfficiency || !deliverables.clvAnalysis) {
      try {
        console.log("[Pivot] Synthesizing operational efficiency + CLV analysis...");
        const [oe, clv] = await Promise.allSettled([
          deliverables.operationalEfficiency ? Promise.resolve(null) : synthesizeOperationalEfficiency(businessPacket, job.questionnaire),
          deliverables.clvAnalysis ? Promise.resolve(null) : synthesizeCLVAnalysis(businessPacket, job.questionnaire),
        ]);
        if (oe.status === "fulfilled" && oe.value) deliverables = { ...deliverables, operationalEfficiency: oe.value };
        if (clv.status === "fulfilled" && clv.value) deliverables = { ...deliverables, clvAnalysis: clv.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] OpsEfficiency/CLV failed (non-fatal):", e);
      }
    }

    // ── Step 4i: Wave 5 intelligence (retention, attribution) ───────────────
    if (!deliverables.retentionPlaybook || !deliverables.revenueAttribution) {
      try {
        console.log("[Pivot] Synthesizing retention playbook + revenue attribution...");
        const [rp, ra] = await Promise.allSettled([
          deliverables.retentionPlaybook ? Promise.resolve(null) : synthesizeRetentionPlaybook(businessPacket, job.questionnaire),
          deliverables.revenueAttribution ? Promise.resolve(null) : synthesizeRevenueAttribution(businessPacket, job.questionnaire),
        ]);
        if (rp.status === "fulfilled" && rp.value) deliverables = { ...deliverables, retentionPlaybook: rp.value };
        if (ra.status === "fulfilled" && ra.value) deliverables = { ...deliverables, revenueAttribution: ra.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Retention/Attribution failed (non-fatal):", e);
      }
    }

    // ── Step 4j: Wave 5 intelligence (board deck, competitive moat) ─────────
    if (!deliverables.boardDeck || !deliverables.competitiveMoat) {
      try {
        console.log("[Pivot] Synthesizing board deck + competitive moat...");
        const [bd, cm] = await Promise.allSettled([
          deliverables.boardDeck ? Promise.resolve(null) : synthesizeBoardDeck(businessPacket, job.questionnaire),
          deliverables.competitiveMoat ? Promise.resolve(null) : synthesizeCompetitiveMoat(businessPacket, job.questionnaire),
        ]);
        if (bd.status === "fulfilled" && bd.value) deliverables = { ...deliverables, boardDeck: bd.value };
        if (cm.status === "fulfilled" && cm.value) deliverables = { ...deliverables, competitiveMoat: cm.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] BoardDeck/Moat failed (non-fatal):", e);
      }
    }

    // ── Step 4k: Wave 5 intelligence (GTM scorecard, cash optimization) ─────
    if (!deliverables.gtmScorecard || !deliverables.cashOptimization) {
      try {
        console.log("[Pivot] Synthesizing GTM scorecard + cash optimization...");
        const [gs, co] = await Promise.allSettled([
          deliverables.gtmScorecard ? Promise.resolve(null) : synthesizeGTMScorecard(businessPacket, job.questionnaire),
          deliverables.cashOptimization ? Promise.resolve(null) : synthesizeCashOptimization(businessPacket, job.questionnaire),
        ]);
        if (gs.status === "fulfilled" && gs.value) deliverables = { ...deliverables, gtmScorecard: gs.value };
        if (co.status === "fulfilled" && co.value) deliverables = { ...deliverables, cashOptimization: co.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] GTM/CashOptimization failed (non-fatal):", e);
      }
    }

    // ── Step 4l: Wave 6 intelligence (talent gap analysis, revenue diversification) ──
    if (!deliverables.talentGapAnalysis || !deliverables.revenueDiversification) {
      try {
        console.log("[Pivot] Synthesizing talent gap analysis + revenue diversification...");
        const [tga, rd] = await Promise.allSettled([
          deliverables.talentGapAnalysis ? Promise.resolve(null) : synthesizeTalentGapAnalysis(businessPacket, job.questionnaire),
          deliverables.revenueDiversification ? Promise.resolve(null) : synthesizeRevenueDiversification(businessPacket, job.questionnaire),
        ]);
        if (tga.status === "fulfilled" && tga.value) deliverables = { ...deliverables, talentGapAnalysis: tga.value };
        if (rd.status === "fulfilled" && rd.value) deliverables = { ...deliverables, revenueDiversification: rd.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] TalentGap/RevenueDiversification failed (non-fatal):", e);
      }
    }

    // ── Step 4m: Wave 6 intelligence (customer journey map, compliance checklist) ──
    if (!deliverables.customerJourneyMap || !deliverables.complianceChecklist) {
      try {
        console.log("[Pivot] Synthesizing customer journey map + compliance checklist...");
        const [cjm, cc] = await Promise.allSettled([
          deliverables.customerJourneyMap ? Promise.resolve(null) : synthesizeCustomerJourneyMap(businessPacket, job.questionnaire),
          deliverables.complianceChecklist ? Promise.resolve(null) : synthesizeComplianceChecklist(businessPacket, job.questionnaire),
        ]);
        if (cjm.status === "fulfilled" && cjm.value) deliverables = { ...deliverables, customerJourneyMap: cjm.value };
        if (cc.status === "fulfilled" && cc.value) deliverables = { ...deliverables, complianceChecklist: cc.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CustomerJourney/Compliance failed (non-fatal):", e);
      }
    }

    // ── Step 4n: Wave 6 intelligence (expansion playbook, vendor scorecard) ──
    if (!deliverables.expansionPlaybook || !deliverables.vendorScorecard) {
      try {
        console.log("[Pivot] Synthesizing expansion playbook + vendor scorecard...");
        const [ep, vs] = await Promise.allSettled([
          deliverables.expansionPlaybook ? Promise.resolve(null) : synthesizeExpansionPlaybook(businessPacket, job.questionnaire),
          deliverables.vendorScorecard ? Promise.resolve(null) : synthesizeVendorScorecard(businessPacket, job.questionnaire),
        ]);
        if (ep.status === "fulfilled" && ep.value) deliverables = { ...deliverables, expansionPlaybook: ep.value };
        if (vs.status === "fulfilled" && vs.value) deliverables = { ...deliverables, vendorScorecard: vs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Expansion/VendorScorecard failed (non-fatal):", e);
      }
    }

    // ── Step 4o: Wave 7 intelligence (product-market fit, brand health) ──
    if (!deliverables.productMarketFit || !deliverables.brandHealth) {
      try {
        console.log("[Pivot] Synthesizing product-market fit + brand health...");
        const [pmf, bh] = await Promise.allSettled([
          deliverables.productMarketFit ? Promise.resolve(null) : synthesizeProductMarketFit(businessPacket, job.questionnaire),
          deliverables.brandHealth ? Promise.resolve(null) : synthesizeBrandHealth(businessPacket, job.questionnaire),
        ]);
        if (pmf.status === "fulfilled" && pmf.value) deliverables = { ...deliverables, productMarketFit: pmf.value };
        if (bh.status === "fulfilled" && bh.value) deliverables = { ...deliverables, brandHealth: bh.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ProductMarketFit/BrandHealth failed (non-fatal):", e);
      }
    }

    // ── Step 4p: Wave 7 intelligence (pricing elasticity, strategic initiatives) ──
    if (!deliverables.pricingElasticity || !deliverables.strategicInitiatives) {
      try {
        console.log("[Pivot] Synthesizing pricing elasticity + strategic initiatives...");
        const [pe, si] = await Promise.allSettled([
          deliverables.pricingElasticity ? Promise.resolve(null) : synthesizePricingElasticity(businessPacket, job.questionnaire),
          deliverables.strategicInitiatives ? Promise.resolve(null) : synthesizeStrategicInitiatives(businessPacket, job.questionnaire),
        ]);
        if (pe.status === "fulfilled" && pe.value) deliverables = { ...deliverables, pricingElasticity: pe.value };
        if (si.status === "fulfilled" && si.value) deliverables = { ...deliverables, strategicInitiatives: si.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PricingElasticity/StrategicInitiatives failed (non-fatal):", e);
      }
    }

    // ── Step 4q: Wave 7 intelligence (cash conversion cycle, innovation pipeline) ──
    if (!deliverables.cashConversionCycle || !deliverables.innovationPipeline) {
      try {
        console.log("[Pivot] Synthesizing cash conversion cycle + innovation pipeline...");
        const [ccc, ip] = await Promise.allSettled([
          deliverables.cashConversionCycle ? Promise.resolve(null) : synthesizeCashConversionCycle(businessPacket, job.questionnaire),
          deliverables.innovationPipeline ? Promise.resolve(null) : synthesizeInnovationPipeline(businessPacket, job.questionnaire),
        ]);
        if (ccc.status === "fulfilled" && ccc.value) deliverables = { ...deliverables, cashConversionCycle: ccc.value };
        if (ip.status === "fulfilled" && ip.value) deliverables = { ...deliverables, innovationPipeline: ip.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CashConversionCycle/InnovationPipeline failed (non-fatal):", e);
      }
    }

    // ── Step 4r: Wave 8 intelligence (stakeholder map, decision log) ────────
    if (!deliverables.stakeholderMap || !deliverables.decisionLog) {
      try {
        console.log("[Pivot] Synthesizing stakeholder map + decision log...");
        const [sm, dl] = await Promise.allSettled([
          deliverables.stakeholderMap ? Promise.resolve(null) : synthesizeStakeholderMap(businessPacket, job.questionnaire),
          deliverables.decisionLog ? Promise.resolve(null) : synthesizeDecisionLog(businessPacket, job.questionnaire),
        ]);
        if (sm.status === "fulfilled" && sm.value) deliverables = { ...deliverables, stakeholderMap: sm.value };
        if (dl.status === "fulfilled" && dl.value) deliverables = { ...deliverables, decisionLog: dl.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] StakeholderMap/DecisionLog failed (non-fatal):", e);
      }
    }

    // ── Step 4s: Wave 8 intelligence (culture assessment, IP portfolio) ─────
    if (!deliverables.cultureAssessment || !deliverables.ipPortfolio) {
      try {
        console.log("[Pivot] Synthesizing culture assessment + IP portfolio...");
        const [ca, ipp] = await Promise.allSettled([
          deliverables.cultureAssessment ? Promise.resolve(null) : synthesizeCultureAssessment(businessPacket, job.questionnaire),
          deliverables.ipPortfolio ? Promise.resolve(null) : synthesizeIPPortfolio(businessPacket, job.questionnaire),
        ]);
        if (ca.status === "fulfilled" && ca.value) deliverables = { ...deliverables, cultureAssessment: ca.value };
        if (ipp.status === "fulfilled" && ipp.value) deliverables = { ...deliverables, ipPortfolio: ipp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CultureAssessment/IPPortfolio failed (non-fatal):", e);
      }
    }

    // ── Step 4t: Wave 8 intelligence (exit readiness, sustainability score) ──
    if (!deliverables.exitReadiness || !deliverables.sustainabilityScore) {
      try {
        console.log("[Pivot] Synthesizing exit readiness + sustainability score...");
        const [er, ss] = await Promise.allSettled([
          deliverables.exitReadiness ? Promise.resolve(null) : synthesizeExitReadiness(businessPacket, job.questionnaire),
          deliverables.sustainabilityScore ? Promise.resolve(null) : synthesizeSustainabilityScore(businessPacket, job.questionnaire),
        ]);
        if (er.status === "fulfilled" && er.value) deliverables = { ...deliverables, exitReadiness: er.value };
        if (ss.status === "fulfilled" && ss.value) deliverables = { ...deliverables, sustainabilityScore: ss.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ExitReadiness/SustainabilityScore failed (non-fatal):", e);
      }
    }

    // ── Step 4u: Wave 9 intelligence (acquisition targets, financial ratios) ──
    if (!deliverables.acquisitionTargets || !deliverables.financialRatios) {
      try {
        console.log("[Pivot] Synthesizing acquisition targets + financial ratios...");
        const [at, fr] = await Promise.allSettled([
          deliverables.acquisitionTargets ? Promise.resolve(null) : synthesizeAcquisitionTargets(businessPacket, job.questionnaire),
          deliverables.financialRatios ? Promise.resolve(null) : synthesizeFinancialRatios(businessPacket, job.questionnaire),
        ]);
        if (at.status === "fulfilled" && at.value) deliverables = { ...deliverables, acquisitionTargets: at.value };
        if (fr.status === "fulfilled" && fr.value) deliverables = { ...deliverables, financialRatios: fr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] AcquisitionTargets/FinancialRatios failed (non-fatal):", e);
      }
    }

    // ── Step 4v: Wave 9 intelligence (channel mix, supply chain risk) ──
    if (!deliverables.channelMixModel || !deliverables.supplyChainRisk) {
      try {
        console.log("[Pivot] Synthesizing channel mix model + supply chain risk...");
        const [cm, sc] = await Promise.allSettled([
          deliverables.channelMixModel ? Promise.resolve(null) : synthesizeChannelMixModel(businessPacket, job.questionnaire),
          deliverables.supplyChainRisk ? Promise.resolve(null) : synthesizeSupplyChainRisk(businessPacket, job.questionnaire),
        ]);
        if (cm.status === "fulfilled" && cm.value) deliverables = { ...deliverables, channelMixModel: cm.value };
        if (sc.status === "fulfilled" && sc.value) deliverables = { ...deliverables, supplyChainRisk: sc.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ChannelMixModel/SupplyChainRisk failed (non-fatal):", e);
      }
    }

    // ── Step 4w: Wave 9 intelligence (regulatory landscape, crisis playbook) ──
    if (!deliverables.regulatoryLandscape || !deliverables.crisisPlaybook) {
      try {
        console.log("[Pivot] Synthesizing regulatory landscape + crisis playbook...");
        const [rl, cp] = await Promise.allSettled([
          deliverables.regulatoryLandscape ? Promise.resolve(null) : synthesizeRegulatoryLandscape(businessPacket, job.questionnaire),
          deliverables.crisisPlaybook ? Promise.resolve(null) : synthesizeCrisisPlaybook(businessPacket, job.questionnaire),
        ]);
        if (rl.status === "fulfilled" && rl.value) deliverables = { ...deliverables, regulatoryLandscape: rl.value };
        if (cp.status === "fulfilled" && cp.value) deliverables = { ...deliverables, crisisPlaybook: cp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] RegulatoryLandscape/CrisisPlaybook failed (non-fatal):", e);
      }
    }

    // ── Step 4x: Wave 10 intelligence (AI readiness, network effects) ──
    if (!deliverables.aiReadiness || !deliverables.networkEffects) {
      try {
        console.log("[Pivot] Synthesizing AI readiness + network effects...");
        const [ar, ne] = await Promise.allSettled([
          deliverables.aiReadiness ? Promise.resolve(null) : synthesizeAIReadiness(businessPacket, job.questionnaire),
          deliverables.networkEffects ? Promise.resolve(null) : synthesizeNetworkEffects(businessPacket, job.questionnaire),
        ]);
        if (ar.status === "fulfilled" && ar.value) deliverables = { ...deliverables, aiReadiness: ar.value };
        if (ne.status === "fulfilled" && ne.value) deliverables = { ...deliverables, networkEffects: ne.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] AIReadiness/NetworkEffects failed (non-fatal):", e);
      }
    }

    // ── Step 4y: Wave 10 intelligence (data monetization, subscription metrics) ──
    if (!deliverables.dataMonetization || !deliverables.subscriptionMetrics) {
      try {
        console.log("[Pivot] Synthesizing data monetization + subscription metrics...");
        const [dm, sm] = await Promise.allSettled([
          deliverables.dataMonetization ? Promise.resolve(null) : synthesizeDataMonetization(businessPacket, job.questionnaire),
          deliverables.subscriptionMetrics ? Promise.resolve(null) : synthesizeSubscriptionMetrics(businessPacket, job.questionnaire),
        ]);
        if (dm.status === "fulfilled" && dm.value) deliverables = { ...deliverables, dataMonetization: dm.value };
        if (sm.status === "fulfilled" && sm.value) deliverables = { ...deliverables, subscriptionMetrics: sm.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] DataMonetization/SubscriptionMetrics failed (non-fatal):", e);
      }
    }

    // ── Step 4z: Wave 10 intelligence (market timing, scenario stress test) ──
    if (!deliverables.marketTiming || !deliverables.scenarioStressTest) {
      try {
        console.log("[Pivot] Synthesizing market timing + scenario stress test...");
        const [mt, ss] = await Promise.allSettled([
          deliverables.marketTiming ? Promise.resolve(null) : synthesizeMarketTiming(businessPacket, job.questionnaire),
          deliverables.scenarioStressTest ? Promise.resolve(null) : synthesizeScenarioStressTest(businessPacket, job.questionnaire),
        ]);
        if (mt.status === "fulfilled" && mt.value) deliverables = { ...deliverables, marketTiming: mt.value };
        if (ss.status === "fulfilled" && ss.value) deliverables = { ...deliverables, scenarioStressTest: ss.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] MarketTiming/ScenarioStressTest failed (non-fatal):", e);
      }
    }

    // ── Relevance Engine: Determine which sections apply to this business ──
    let relevantSections: Set<string> | undefined;
    try {
      relevantSections = getRelevantSections(job.questionnaire);
      console.log(`[Pivot] Relevance engine: ${relevantSections.size} sections relevant for this business`);
    } catch (e) {
      console.warn("[Pivot] Relevance engine failed, running all sections:", e);
    }

    // ── Extended wave synthesis (extracted to avoid TS2563 control flow limit) ──
    deliverables = await runExtendedWaves(runId, deliverables, businessPacket, job, relevantSections);

    // ── Step 5: Agent memory (best-effort) ─────────────────────────────────
    try {
      await buildAgentMemory(orgId, job.questionnaire.organizationName, runId, deliverables, websiteAnalysis);
    } catch (e) {
      console.warn("[Pivot] Agent memory build failed (non-fatal):", e);
    }

    // ── Post-processing: Compute relevance scores for all sections ──
    try {
      const sectionKeys = Object.keys(deliverables).filter(
        k => typeof (deliverables as any)[k] === "object" && (deliverables as any)[k] !== null
          && !["claimValidations", "relevanceScores", "dataProvenance"].includes(k)
      );
      deliverables.relevanceScores = sectionKeys.map(key => {
        const score = scoreSectionRelevance(job.questionnaire, key);
        return {
          key,
          score,
          depth: getRelevanceDepth(score),
          reason: "",
        };
      });
      console.log(`[Pivot] Computed relevance scores for ${sectionKeys.length} sections`);
      updateJob(runId, { deliverables });
    } catch (e) {
      console.warn("[Pivot] Relevance score computation failed (non-fatal):", e);
    }

    // ── Post-processing: Claim validation ──
    if (businessPacket.financialFacts && businessPacket.financialFacts.length > 0) {
      console.log("[Pivot] Validating financial claims against source documents...");
      const claimValidations = validateFinancialClaims(deliverables, businessPacket.financialFacts);
      deliverables = { ...deliverables, claimValidations };
      const counts = { verified: 0, estimated: 0, conflicting: 0 };
      for (const v of claimValidations) {
        if (v.status === "verified") counts.verified++;
        else if (v.status === "conflicting") counts.conflicting++;
        else counts.estimated++;
      }
      console.log(`[Pivot] Claim validation: ${counts.verified} verified, ${counts.estimated} estimated, ${counts.conflicting} conflicting`);
      updateJob(runId, { deliverables });
    }

    // ── Step 5: Format PDF + DOCX ──────────────────────────────────────────
    updateJob(runId, { status: "formatting" });
    await formatAndSave(runId, deliverables);

    updateJob(runId, { status: "completed", phase: "PLAN" });
    console.log("[Pivot] Pipeline complete for run:", runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Pivot] Pipeline failed:", message);
    updateJob(runId, { status: "failed", error: message });
  }
}
