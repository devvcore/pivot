// @ts-nocheck
/**
 * Pivot Pipeline Runner — resumable
 *
 * Each stage persists its output before moving on. If the pipeline crashes,
 * calling runPipeline again on the same runId picks up where it left off.
 */
import { getJob, updateJob } from "@/lib/job-store";
import { parseFiles } from "./parse";
import { ingestDocuments, scrapeWebsiteContent, formatPacketAsContext } from "./ingest";
import { collectIntegrationContext, pullFreshIntegrationData, extractFinancialFactsFromIntegrations, extractOrgIntelligence } from "@/lib/integrations/collect";
import { categorizeAndBuildGraph } from "./categorize";
import { selectSectionsWithAI, getStrictRelevantSections, scoreSectionRelevance, getRelevanceDepth } from "./relevance";
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
  synthesizeToolsAutomation,
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
    // Helper: skip sections not selected by AI relevance engine
    const isSelected = (key: string) => !relevantSections || relevantSections.has(key);
    // Wrapper: only call synthesis if section is AI-selected AND not already done
    // Binary: selected = full synthesis, not selected = skip entirely
    const synthIf = <T>(key: string, fn: () => Promise<T | null>): Promise<T | null> => {
      if (!isSelected(key)) return Promise.resolve(null);
      if ((deliverables as unknown as Record<string, unknown>)[key]) return Promise.resolve(null);
      return fn();
    };

    // Progress tracking for extended waves
    let _extStep = 0;
    const _extStarted = Date.now();

    // All extended wave tasks — run in batches of 10 for ~5x faster synthesis
    const extTasks: { key: string; fn: () => Promise<unknown | null> }[] = [
      { key: 'pricingStrategyMatrix', fn: () => synthIf('pricingStrategyMatrix', () => synthesizePricingStrategyMatrix(businessPacket, job.questionnaire)) },
      { key: 'customerHealthScore', fn: () => synthIf('customerHealthScore', () => synthesizeCustomerHealthScore(businessPacket, job.questionnaire)) },
      { key: 'revenueWaterfall', fn: () => synthIf('revenueWaterfall', () => synthesizeRevenueWaterfall(businessPacket, job.questionnaire)) },
      { key: 'techDebtAssessment', fn: () => synthIf('techDebtAssessment', () => synthesizeTechDebtAssessment(businessPacket, job.questionnaire)) },
      { key: 'teamPerformance', fn: () => synthIf('teamPerformance', () => synthesizeTeamPerformance(businessPacket, job.questionnaire)) },
      { key: 'marketEntryStrategy', fn: () => synthIf('marketEntryStrategy', () => synthesizeMarketEntryStrategy(businessPacket, job.questionnaire)) },
      { key: 'competitiveIntelFeed', fn: () => synthIf('competitiveIntelFeed', () => synthesizeCompetitiveIntelFeed(businessPacket, job.questionnaire)) },
      { key: 'cashFlowSensitivity', fn: () => synthIf('cashFlowSensitivity', () => synthesizeCashFlowSensitivity(businessPacket, job.questionnaire)) },
      { key: 'digitalMaturity', fn: () => synthIf('digitalMaturity', () => synthesizeDigitalMaturity(businessPacket, job.questionnaire)) },
      { key: 'acquisitionFunnel', fn: () => synthIf('acquisitionFunnel', () => synthesizeAcquisitionFunnel(businessPacket, job.questionnaire)) },
      { key: 'strategicAlignment', fn: () => synthIf('strategicAlignment', () => synthesizeStrategicAlignment(businessPacket, job.questionnaire)) },
      { key: 'budgetOptimizer', fn: () => synthIf('budgetOptimizer', () => synthesizeBudgetOptimizer(businessPacket, job.questionnaire)) },
      { key: 'revenueDrivers', fn: () => synthIf('revenueDrivers', () => synthesizeRevenueDrivers(businessPacket, job.questionnaire)) },
      { key: 'marginOptimization', fn: () => synthIf('marginOptimization', () => synthesizeMarginOptimization(businessPacket, job.questionnaire)) },
      { key: 'demandForecasting', fn: () => synthIf('demandForecasting', () => synthesizeDemandForecasting(businessPacket, job.questionnaire)) },
      { key: 'cohortAnalysis', fn: () => synthIf('cohortAnalysis', () => synthesizeCohortAnalysis(businessPacket, job.questionnaire)) },
      { key: 'winLossAnalysis', fn: () => synthIf('winLossAnalysis', () => synthesizeWinLossAnalysis(businessPacket, job.questionnaire)) },
      { key: 'salesForecast', fn: () => synthIf('salesForecast', () => synthesizeSalesForecast(businessPacket, job.questionnaire)) },
      { key: 'processEfficiency', fn: () => synthIf('processEfficiency', () => synthesizeProcessEfficiency(businessPacket, job.questionnaire)) },
      { key: 'vendorRisk', fn: () => synthIf('vendorRisk', () => synthesizeVendorRisk(businessPacket, job.questionnaire)) },
      { key: 'qualityMetrics', fn: () => synthIf('qualityMetrics', () => synthesizeQualityMetrics(businessPacket, job.questionnaire)) },
      { key: 'capacityPlanning', fn: () => synthIf('capacityPlanning', () => synthesizeCapacityPlanning(businessPacket, job.questionnaire)) },
      { key: 'knowledgeManagement', fn: () => synthIf('knowledgeManagement', () => synthesizeKnowledgeManagement(businessPacket, job.questionnaire)) },
      { key: 'complianceScorecard', fn: () => synthIf('complianceScorecard', () => synthesizeComplianceScorecard(businessPacket, job.questionnaire)) },
      { key: 'marketPenetration', fn: () => synthIf('marketPenetration', () => synthesizeMarketPenetration(businessPacket, job.questionnaire)) },
      { key: 'flywheelAnalysis', fn: () => synthIf('flywheelAnalysis', () => synthesizeFlywheelAnalysis(businessPacket, job.questionnaire)) },
      { key: 'partnershipsStrategy', fn: () => synthIf('partnershipsStrategy', () => synthesizePartnershipsStrategy(businessPacket, job.questionnaire)) },
      { key: 'internationalExpansion', fn: () => synthIf('internationalExpansion', () => synthesizeInternationalExpansion(businessPacket, job.questionnaire)) },
      { key: 'rdEffectiveness', fn: () => synthIf('rdEffectiveness', () => synthesizeRDEffectiveness(businessPacket, job.questionnaire)) },
      { key: 'brandEquity', fn: () => synthIf('brandEquity', () => synthesizeBrandEquity(businessPacket, job.questionnaire)) },
      { key: 'workingCapital', fn: () => synthIf('workingCapital', () => synthesizeWorkingCapital(businessPacket, job.questionnaire)) },
      { key: 'debtStrategy', fn: () => synthIf('debtStrategy', () => synthesizeDebtStrategy(businessPacket, job.questionnaire)) },
      { key: 'taxStrategy', fn: () => synthIf('taxStrategy', () => synthesizeTaxStrategy(businessPacket, job.questionnaire)) },
      { key: 'investorReadiness', fn: () => synthIf('investorReadiness', () => synthesizeInvestorReadiness(businessPacket, job.questionnaire)) },
      { key: 'maReadiness', fn: () => synthIf('maReadiness', () => synthesizeMAReadiness(businessPacket, job.questionnaire)) },
      { key: 'strategicRoadmap', fn: () => synthIf('strategicRoadmap', () => synthesizeStrategicRoadmap(businessPacket, job.questionnaire)) },
      { key: 'customerVoice', fn: () => synthIf('customerVoice', () => synthesizeCustomerVoice(businessPacket, job.questionnaire)) },
      { key: 'referralEngine', fn: () => synthIf('referralEngine', () => synthesizeReferralEngine(businessPacket, job.questionnaire)) },
      { key: 'priceSensitivityIndex', fn: () => synthIf('priceSensitivityIndex', () => synthesizePriceSensitivityIndex(businessPacket, job.questionnaire)) },
      { key: 'customerEffortScore', fn: () => synthIf('customerEffortScore', () => synthesizeCustomerEffortScore(businessPacket, job.questionnaire)) },
      { key: 'accountExpansionMap', fn: () => synthIf('accountExpansionMap', () => synthesizeAccountExpansionMap(businessPacket, job.questionnaire)) },
      { key: 'loyaltyProgramDesign', fn: () => synthIf('loyaltyProgramDesign', () => synthesizeLoyaltyProgramDesign(businessPacket, job.questionnaire)) },
      { key: 'competitivePricingMatrix', fn: () => synthIf('competitivePricingMatrix', () => synthesizeCompetitivePricingMatrix(businessPacket, job.questionnaire)) },
      { key: 'marketSentimentIndex', fn: () => synthIf('marketSentimentIndex', () => synthesizeMarketSentimentIndex(businessPacket, job.questionnaire)) },
      { key: 'disruptionRadar', fn: () => synthIf('disruptionRadar', () => synthesizeDisruptionRadar(businessPacket, job.questionnaire)) },
      { key: 'ecosystemMap', fn: () => synthIf('ecosystemMap', () => synthesizeEcosystemMap(businessPacket, job.questionnaire)) },
      { key: 'categoryCreation', fn: () => synthIf('categoryCreation', () => synthesizeCategoryCreation(businessPacket, job.questionnaire)) },
      { key: 'marketVelocity', fn: () => synthIf('marketVelocity', () => synthesizeMarketVelocity(businessPacket, job.questionnaire)) },
      { key: 'okrCascade', fn: () => synthIf('okrCascade', () => synthesizeOKRCascade(businessPacket, job.questionnaire)) },
      { key: 'meetingEffectiveness', fn: () => synthIf('meetingEffectiveness', () => synthesizeMeetingEffectiveness(businessPacket, job.questionnaire)) },
      { key: 'communicationAudit', fn: () => synthIf('communicationAudit', () => synthesizeCommunicationAudit(businessPacket, job.questionnaire)) },
      { key: 'decisionVelocity', fn: () => synthIf('decisionVelocity', () => synthesizeDecisionVelocity(businessPacket, job.questionnaire)) },
      { key: 'resourceOptimizer', fn: () => synthIf('resourceOptimizer', () => synthesizeResourceOptimizer(businessPacket, job.questionnaire)) },
      { key: 'changeManagement', fn: () => synthIf('changeManagement', () => synthesizeChangeManagement(businessPacket, job.questionnaire)) },
      { key: 'cashReserveStrategy', fn: () => synthIf('cashReserveStrategy', () => synthesizeCashReserveStrategy(businessPacket, job.questionnaire)) },
      { key: 'revenueQualityScore', fn: () => synthIf('revenueQualityScore', () => synthesizeRevenueQualityScore(businessPacket, job.questionnaire)) },
      { key: 'costIntelligence', fn: () => synthIf('costIntelligence', () => synthesizeCostIntelligence(businessPacket, job.questionnaire)) },
      { key: 'financialModeling', fn: () => synthIf('financialModeling', () => synthesizeFinancialModeling(businessPacket, job.questionnaire)) },
      { key: 'profitabilityMap', fn: () => synthIf('profitabilityMap', () => synthesizeProfitabilityMap(businessPacket, job.questionnaire)) },
      { key: 'capitalAllocation', fn: () => synthIf('capitalAllocation', () => synthesizeCapitalAllocation(businessPacket, job.questionnaire)) },
      { key: 'salesPipelineHealth', fn: () => synthIf('salesPipelineHealth', () => synthesizeSalesPipelineHealth(businessPacket, job.questionnaire)) },
      { key: 'dealVelocity', fn: () => synthIf('dealVelocity', () => synthesizeDealVelocity(businessPacket, job.questionnaire)) },
      { key: 'winRateOptimizer', fn: () => synthIf('winRateOptimizer', () => synthesizeWinRateOptimizer(businessPacket, job.questionnaire)) },
      { key: 'salesEnablement', fn: () => synthIf('salesEnablement', () => synthesizeSalesEnablement(businessPacket, job.questionnaire)) },
      { key: 'territoryPlanning', fn: () => synthIf('territoryPlanning', () => synthesizeTerritoryPlanning(businessPacket, job.questionnaire)) },
      { key: 'quotaIntelligence', fn: () => synthIf('quotaIntelligence', () => synthesizeQuotaIntelligence(businessPacket, job.questionnaire)) },
      { key: 'featurePrioritization', fn: () => synthIf('featurePrioritization', () => synthesizeFeaturePrioritization(businessPacket, job.questionnaire)) },
      { key: 'productUsageAnalytics', fn: () => synthIf('productUsageAnalytics', () => synthesizeProductUsageAnalytics(businessPacket, job.questionnaire)) },
      { key: 'techStackAudit', fn: () => synthIf('techStackAudit', () => synthesizeTechStackAudit(businessPacket, job.questionnaire)) },
      { key: 'apiStrategy', fn: () => synthIf('apiStrategy', () => synthesizeApiStrategy(businessPacket, job.questionnaire)) },
      { key: 'platformScalability', fn: () => synthIf('platformScalability', () => synthesizePlatformScalability(businessPacket, job.questionnaire)) },
      { key: 'userOnboarding', fn: () => synthIf('userOnboarding', () => synthesizeUserOnboarding(businessPacket, job.questionnaire)) },
      { key: 'employeeEngagement', fn: () => synthIf('employeeEngagement', () => synthesizeEmployeeEngagement(businessPacket, job.questionnaire)) },
      { key: 'talentAcquisitionFunnel', fn: () => synthIf('talentAcquisitionFunnel', () => synthesizeTalentAcquisitionFunnel(businessPacket, job.questionnaire)) },
      { key: 'compensationBenchmark', fn: () => synthIf('compensationBenchmark', () => synthesizeCompensationBenchmark(businessPacket, job.questionnaire)) },
      { key: 'successionPlanning', fn: () => synthIf('successionPlanning', () => synthesizeSuccessionPlanning(businessPacket, job.questionnaire)) },
      { key: 'diversityMetrics', fn: () => synthIf('diversityMetrics', () => synthesizeDiversityMetrics(businessPacket, job.questionnaire)) },
      { key: 'employerBrand', fn: () => synthIf('employerBrand', () => synthesizeEmployerBrand(businessPacket, job.questionnaire)) },
      { key: 'dataGovernance', fn: () => synthIf('dataGovernance', () => synthesizeDataGovernance(businessPacket, job.questionnaire)) },
      { key: 'analyticsMaturity', fn: () => synthIf('analyticsMaturity', () => synthesizeAnalyticsMaturity(businessPacket, job.questionnaire)) },
      { key: 'customerDataPlatform', fn: () => synthIf('customerDataPlatform', () => synthesizeCustomerDataPlatform(businessPacket, job.questionnaire)) },
      { key: 'predictiveModeling', fn: () => synthIf('predictiveModeling', () => synthesizePredictiveModeling(businessPacket, job.questionnaire)) },
      { key: 'reportingFramework', fn: () => synthIf('reportingFramework', () => synthesizeReportingFramework(businessPacket, job.questionnaire)) },
      { key: 'dataQualityScore', fn: () => synthIf('dataQualityScore', () => synthesizeDataQualityScore(businessPacket, job.questionnaire)) },
      { key: 'inventoryOptimization', fn: () => synthIf('inventoryOptimization', () => synthesizeInventoryOptimization(businessPacket, job.questionnaire)) },
      { key: 'qualityManagement', fn: () => synthIf('qualityManagement', () => synthesizeQualityManagement(businessPacket, job.questionnaire)) },
      { key: 'npsAnalysis', fn: () => synthIf('npsAnalysis', () => synthesizeNpsAnalysis(businessPacket, job.questionnaire)) },
      { key: 'supportTicketIntelligence', fn: () => synthIf('supportTicketIntelligence', () => synthesizeSupportTicketIntelligence(businessPacket, job.questionnaire)) },
      { key: 'voiceOfCustomer', fn: () => synthIf('voiceOfCustomer', () => synthesizeVoiceOfCustomer(businessPacket, job.questionnaire)) },
      { key: 'rdEfficiency', fn: () => synthIf('rdEfficiency', () => synthesizeRdEfficiency(businessPacket, job.questionnaire)) },
      { key: 'technologyReadiness', fn: () => synthIf('technologyReadiness', () => synthesizeTechnologyReadiness(businessPacket, job.questionnaire)) },
      { key: 'partnershipEcosystem', fn: () => synthIf('partnershipEcosystem', () => synthesizePartnershipEcosystem(businessPacket, job.questionnaire)) },
      { key: 'mergersAcquisitions', fn: () => synthIf('mergersAcquisitions', () => synthesizeMergersAcquisitions(businessPacket, job.questionnaire)) },
      { key: 'esgScorecard', fn: () => synthIf('esgScorecard', () => synthesizeEsgScorecard(businessPacket, job.questionnaire)) },
      { key: 'carbonFootprint', fn: () => synthIf('carbonFootprint', () => synthesizeCarbonFootprint(businessPacket, job.questionnaire)) },
      { key: 'regulatoryCompliance', fn: () => synthIf('regulatoryCompliance', () => synthesizeRegulatoryCompliance(businessPacket, job.questionnaire)) },
      { key: 'businessContinuity', fn: () => synthIf('businessContinuity', () => synthesizeBusinessContinuity(businessPacket, job.questionnaire)) },
      { key: 'ethicsFramework', fn: () => synthIf('ethicsFramework', () => synthesizeEthicsFramework(businessPacket, job.questionnaire)) },
      { key: 'socialImpact', fn: () => synthIf('socialImpact', () => synthesizeSocialImpact(businessPacket, job.questionnaire)) },
      { key: 'marketResearch', fn: () => synthIf('marketResearch', () => synthesizeMarketResearch(businessPacket, job.questionnaire)) },
      { key: 'competitorTracking', fn: () => synthIf('competitorTracking', () => synthesizeCompetitorTracking(businessPacket, job.questionnaire)) },
      { key: 'industryTrends', fn: () => synthIf('industryTrends', () => synthesizeIndustryTrends(businessPacket, job.questionnaire)) },
      { key: 'socialListening', fn: () => synthIf('socialListening', () => synthesizeSocialListening(businessPacket, job.questionnaire)) },
      { key: 'uxResearch', fn: () => synthIf('uxResearch', () => synthesizeUxResearch(businessPacket, job.questionnaire)) },
      { key: 'webAnalytics', fn: () => synthIf('webAnalytics', () => synthesizeWebAnalytics(businessPacket, job.questionnaire)) },
      { key: 'emailMarketing', fn: () => synthIf('emailMarketing', () => synthesizeEmailMarketing(businessPacket, job.questionnaire)) },
      { key: 'conversionOptimization', fn: () => synthIf('conversionOptimization', () => synthesizeConversionOptimization(businessPacket, job.questionnaire)) },
      { key: 'abTestingFramework', fn: () => synthIf('abTestingFramework', () => synthesizeAbTestingFramework(businessPacket, job.questionnaire)) },
      { key: 'marketingAttribution', fn: () => synthIf('marketingAttribution', () => synthesizeMarketingAttribution(businessPacket, job.questionnaire)) },
      { key: 'contentCalendar', fn: () => synthIf('contentCalendar', () => synthesizeContentCalendar(businessPacket, job.questionnaire)) },
      { key: 'socialMediaCalendar', fn: () => synthIf('socialMediaCalendar', () => synthesizeSocialMediaCalendar(businessPacket, job.questionnaire)) },
      { key: 'budgetPlanning', fn: () => synthIf('budgetPlanning', () => synthesizeBudgetPlanning(businessPacket, job.questionnaire)) },
      { key: 'revenueForecasting', fn: () => synthIf('revenueForecasting', () => synthesizeRevenueForecasting(businessPacket, job.questionnaire)) },
      { key: 'cashManagement', fn: () => synthIf('cashManagement', () => synthesizeCashManagement(businessPacket, job.questionnaire)) },
      { key: 'creditManagement', fn: () => synthIf('creditManagement', () => synthesizeCreditManagement(businessPacket, job.questionnaire)) },
      { key: 'debtStructure', fn: () => synthIf('debtStructure', () => synthesizeDebtStructure(businessPacket, job.questionnaire)) },
      { key: 'financialReporting', fn: () => synthIf('financialReporting', () => synthesizeFinancialReporting(businessPacket, job.questionnaire)) },
      { key: 'carbonReduction', fn: () => synthIf('carbonReduction', () => synthesizeCarbonReduction(businessPacket, job.questionnaire)) },
      { key: 'circularEconomy', fn: () => synthIf('circularEconomy', () => synthesizeCircularEconomy(businessPacket, job.questionnaire)) },
      { key: 'communityImpact', fn: () => synthIf('communityImpact', () => synthesizeCommunityImpact(businessPacket, job.questionnaire)) },
      { key: 'waterManagement', fn: () => synthIf('waterManagement', () => synthesizeWaterManagement(businessPacket, job.questionnaire)) },
      { key: 'wasteReduction', fn: () => synthIf('wasteReduction', () => synthesizeWasteReduction(businessPacket, job.questionnaire)) },
      { key: 'sustainableInnovation', fn: () => synthIf('sustainableInnovation', () => synthesizeSustainableInnovation(businessPacket, job.questionnaire)) },
      { key: 'talentPipeline', fn: () => synthIf('talentPipeline', () => synthesizeTalentPipeline(businessPacket, job.questionnaire)) },
      { key: 'leadershipDevelopment', fn: () => synthIf('leadershipDevelopment', () => synthesizeLeadershipDevelopment(businessPacket, job.questionnaire)) },
      { key: 'successionReadiness', fn: () => synthIf('successionReadiness', () => synthesizeSuccessionReadiness(businessPacket, job.questionnaire)) },
      { key: 'compensationStrategy', fn: () => synthIf('compensationStrategy', () => synthesizeCompensationStrategy(businessPacket, job.questionnaire)) },
      { key: 'workforceAnalytics', fn: () => synthIf('workforceAnalytics', () => synthesizeWorkforceAnalytics(businessPacket, job.questionnaire)) },
      { key: 'orgEffectiveness', fn: () => synthIf('orgEffectiveness', () => synthesizeOrgEffectiveness(businessPacket, job.questionnaire)) },
      { key: 'salesMotionDesign', fn: () => synthIf('salesMotionDesign', () => synthesizeSalesMotionDesign(businessPacket, job.questionnaire)) },
      { key: 'dealAnalytics', fn: () => synthIf('dealAnalytics', () => synthesizeDealAnalytics(businessPacket, job.questionnaire)) },
      { key: 'territoryOptimization', fn: () => synthIf('territoryOptimization', () => synthesizeTerritoryOptimization(businessPacket, job.questionnaire)) },
      { key: 'salesCompensation', fn: () => synthIf('salesCompensation', () => synthesizeSalesCompensation(businessPacket, job.questionnaire)) },
      { key: 'revenuePrediction', fn: () => synthIf('revenuePrediction', () => synthesizeRevenuePrediction(businessPacket, job.questionnaire)) },
      { key: 'accountPenetration', fn: () => synthIf('accountPenetration', () => synthesizeAccountPenetration(businessPacket, job.questionnaire)) },
      { key: 'productVision', fn: () => synthIf('productVision', () => synthesizeProductVision(businessPacket, job.questionnaire)) },
      { key: 'featureRoadmap', fn: () => synthIf('featureRoadmap', () => synthesizeFeatureRoadmap(businessPacket, job.questionnaire)) },
      { key: 'pmfAssessment', fn: () => synthIf('pmfAssessment', () => synthesizePmfAssessment(businessPacket, job.questionnaire)) },
      { key: 'userActivation', fn: () => synthIf('userActivation', () => synthesizeUserActivation(businessPacket, job.questionnaire)) },
      { key: 'productInsights', fn: () => synthIf('productInsights', () => synthesizeProductInsights(businessPacket, job.questionnaire)) },
      { key: 'releaseStrategy', fn: () => synthIf('releaseStrategy', () => synthesizeReleaseStrategy(businessPacket, job.questionnaire)) },
      { key: 'brandPositionMap', fn: () => synthIf('brandPositionMap', () => synthesizeBrandPositionMap(businessPacket, job.questionnaire)) },
      { key: 'brandValuation', fn: () => synthIf('brandValuation', () => synthesizeBrandValuation(businessPacket, job.questionnaire)) },
      { key: 'brandHierarchy', fn: () => synthIf('brandHierarchy', () => synthesizeBrandHierarchy(businessPacket, job.questionnaire)) },
      { key: 'reputationAnalysis', fn: () => synthIf('reputationAnalysis', () => synthesizeReputationAnalysis(businessPacket, job.questionnaire)) },
      { key: 'messagingFramework', fn: () => synthIf('messagingFramework', () => synthesizeMessagingFramework(businessPacket, job.questionnaire)) },
      { key: 'visualBranding', fn: () => synthIf('visualBranding', () => synthesizeVisualBranding(businessPacket, job.questionnaire)) },
      { key: 'growthPlaybook', fn: () => synthIf('growthPlaybook', () => synthesizeGrowthPlaybook(businessPacket, job.questionnaire)) },
      { key: 'revenueRunRate', fn: () => synthIf('revenueRunRate', () => synthesizeRevenueRunRate(businessPacket, job.questionnaire)) },
      { key: 'breakEvenModel', fn: () => synthIf('breakEvenModel', () => synthesizeBreakEvenModel(businessPacket, job.questionnaire)) },
      { key: 'operatingLeverageIndex', fn: () => synthIf('operatingLeverageIndex', () => synthesizeOperatingLeverageIndex(businessPacket, job.questionnaire)) },
      { key: 'grossMarginAnalysis', fn: () => synthIf('grossMarginAnalysis', () => synthesizeGrossMarginAnalysis(businessPacket, job.questionnaire)) },
      { key: 'fundingScenarioModel', fn: () => synthIf('fundingScenarioModel', () => synthesizeFundingScenarioModel(businessPacket, job.questionnaire)) },
      { key: 'competitiveWargame', fn: () => synthIf('competitiveWargame', () => synthesizeCompetitiveWargame(businessPacket, job.questionnaire)) },
      { key: 'marketDisruptionModel', fn: () => synthIf('marketDisruptionModel', () => synthesizeMarketDisruptionModel(businessPacket, job.questionnaire)) },
      { key: 'firstMoverAnalysis', fn: () => synthIf('firstMoverAnalysis', () => synthesizeFirstMoverAnalysis(businessPacket, job.questionnaire)) },
      { key: 'defensibilityAudit', fn: () => synthIf('defensibilityAudit', () => synthesizeDefensibilityAudit(businessPacket, job.questionnaire)) },
      { key: 'pivotReadiness', fn: () => synthIf('pivotReadiness', () => synthesizePivotReadiness(businessPacket, job.questionnaire)) },
      { key: 'competitiveTimingModel', fn: () => synthIf('competitiveTimingModel', () => synthesizeCompetitiveTimingModel(businessPacket, job.questionnaire)) },
      { key: 'customerMaturityModel', fn: () => synthIf('customerMaturityModel', () => synthesizeCustomerMaturityModel(businessPacket, job.questionnaire)) },
      { key: 'expansionSignals', fn: () => synthIf('expansionSignals', () => synthesizeExpansionSignals(businessPacket, job.questionnaire)) },
      { key: 'adoptionScorecard', fn: () => synthIf('adoptionScorecard', () => synthesizeAdoptionScorecard(businessPacket, job.questionnaire)) },
      { key: 'stakeholderSentiment', fn: () => synthIf('stakeholderSentiment', () => synthesizeStakeholderSentiment(businessPacket, job.questionnaire)) },
      { key: 'valueRealization', fn: () => synthIf('valueRealization', () => synthesizeValueRealization(businessPacket, job.questionnaire)) },
      { key: 'renewalPlaybook', fn: () => synthIf('renewalPlaybook', () => synthesizeRenewalPlaybook(businessPacket, job.questionnaire)) },
      { key: 'businessModelInnovation', fn: () => synthIf('businessModelInnovation', () => synthesizeBusinessModelInnovation(businessPacket, job.questionnaire)) },
      { key: 'monetizationExperiment', fn: () => synthIf('monetizationExperiment', () => synthesizeMonetizationExperiment(businessPacket, job.questionnaire)) },
      { key: 'pricingArchitecture', fn: () => synthIf('pricingArchitecture', () => synthesizePricingArchitecture(businessPacket, job.questionnaire)) },
      { key: 'revenueStreamMap', fn: () => synthIf('revenueStreamMap', () => synthesizeRevenueStreamMap(businessPacket, job.questionnaire)) },
      { key: 'costDriverAnalysis', fn: () => synthIf('costDriverAnalysis', () => synthesizeCostDriverAnalysis(businessPacket, job.questionnaire)) },
      { key: 'valueCapture', fn: () => synthIf('valueCapture', () => synthesizeValueCapture(businessPacket, job.questionnaire)) },
      { key: 'revenueProcessMap', fn: () => synthIf('revenueProcessMap', () => synthesizeRevenueProcessMap(businessPacket, job.questionnaire)) },
      { key: 'billingHealthCheck', fn: () => synthIf('billingHealthCheck', () => synthesizeBillingHealthCheck(businessPacket, job.questionnaire)) },
      { key: 'quoteToCloseAnalysis', fn: () => synthIf('quoteToCloseAnalysis', () => synthesizeQuoteToCloseAnalysis(businessPacket, job.questionnaire)) },
      { key: 'revenueLeakDetector', fn: () => synthIf('revenueLeakDetector', () => synthesizeRevenueLeakDetector(businessPacket, job.questionnaire)) },
      { key: 'forecastAccuracyModel', fn: () => synthIf('forecastAccuracyModel', () => synthesizeForecastAccuracyModel(businessPacket, job.questionnaire)) },
      { key: 'dealDeskOptimization', fn: () => synthIf('dealDeskOptimization', () => synthesizeDealDeskOptimization(businessPacket, job.questionnaire)) },
      { key: 'talentMarketIntel', fn: () => synthIf('talentMarketIntel', () => synthesizeTalentMarketIntel(businessPacket, job.questionnaire)) },
      { key: 'employeeLifecycleMap', fn: () => synthIf('employeeLifecycleMap', () => synthesizeEmployeeLifecycleMap(businessPacket, job.questionnaire)) },
      { key: 'skillsInventory', fn: () => synthIf('skillsInventory', () => synthesizeSkillsInventory(businessPacket, job.questionnaire)) },
      { key: 'teamDynamicsAnalysis', fn: () => synthIf('teamDynamicsAnalysis', () => synthesizeTeamDynamicsAnalysis(businessPacket, job.questionnaire)) },
      { key: 'hybridWorkModel', fn: () => synthIf('hybridWorkModel', () => synthesizeHybridWorkModel(businessPacket, job.questionnaire)) },
      { key: 'compensationPhilosophy', fn: () => synthIf('compensationPhilosophy', () => synthesizeCompensationPhilosophy(businessPacket, job.questionnaire)) },
      { key: 'dataMaturityAssessment', fn: () => synthIf('dataMaturityAssessment', () => synthesizeDataMaturityAssessment(businessPacket, job.questionnaire)) },
      { key: 'insightsPrioritization', fn: () => synthIf('insightsPrioritization', () => synthesizeInsightsPrioritization(businessPacket, job.questionnaire)) },
      { key: 'experimentVelocity', fn: () => synthIf('experimentVelocity', () => synthesizeExperimentVelocity(businessPacket, job.questionnaire)) },
      { key: 'decisionIntelligence', fn: () => synthIf('decisionIntelligence', () => synthesizeDecisionIntelligence(businessPacket, job.questionnaire)) },
      { key: 'feedbackIntelligence', fn: () => synthIf('feedbackIntelligence', () => synthesizeFeedbackIntelligence(businessPacket, job.questionnaire)) },
      { key: 'benchmarkingEngine', fn: () => synthIf('benchmarkingEngine', () => synthesizeBenchmarkingEngine(businessPacket, job.questionnaire)) },
      { key: 'partnerValueMap', fn: () => synthIf('partnerValueMap', () => synthesizePartnerValueMap(businessPacket, job.questionnaire)) },
      { key: 'coInnovationPipeline', fn: () => synthIf('coInnovationPipeline', () => synthesizeCoInnovationPipeline(businessPacket, job.questionnaire)) },
      { key: 'ecosystemRevenue', fn: () => synthIf('ecosystemRevenue', () => synthesizeEcosystemRevenue(businessPacket, job.questionnaire)) },
      { key: 'allianceScorecard', fn: () => synthIf('allianceScorecard', () => synthesizeAllianceScorecard(businessPacket, job.questionnaire)) },
      { key: 'partnerEnablementPlan', fn: () => synthIf('partnerEnablementPlan', () => synthesizePartnerEnablementPlan(businessPacket, job.questionnaire)) },
      { key: 'marketplaceReadiness', fn: () => synthIf('marketplaceReadiness', () => synthesizeMarketplaceReadiness(businessPacket, job.questionnaire)) },
      { key: 'strategyExecution', fn: () => synthIf('strategyExecution', () => synthesizeStrategyExecution(businessPacket, job.questionnaire)) },
      { key: 'initiativeTracking', fn: () => synthIf('initiativeTracking', () => synthesizeInitiativeTracking(businessPacket, job.questionnaire)) },
      { key: 'resourceAllocationModel', fn: () => synthIf('resourceAllocationModel', () => synthesizeResourceAllocationModel(businessPacket, job.questionnaire)) },
      { key: 'strategicBetting', fn: () => synthIf('strategicBetting', () => synthesizeStrategicBetting(businessPacket, job.questionnaire)) },
      { key: 'executionCadence', fn: () => synthIf('executionCadence', () => synthesizeExecutionCadence(businessPacket, job.questionnaire)) },
      { key: 'alignmentIndex', fn: () => synthIf('alignmentIndex', () => synthesizeAlignmentIndex(businessPacket, job.questionnaire)) },
      { key: 'marketSignalRadar', fn: () => synthIf('marketSignalRadar', () => synthesizeMarketSignalRadar(businessPacket, job.questionnaire)) },
      { key: 'competitorMoveTracker', fn: () => synthIf('competitorMoveTracker', () => synthesizeCompetitorMoveTracker(businessPacket, job.questionnaire)) },
      { key: 'customerVoiceAggregator', fn: () => synthIf('customerVoiceAggregator', () => synthesizeCustomerVoiceAggregator(businessPacket, job.questionnaire)) },
      { key: 'industryConvergenceMap', fn: () => synthIf('industryConvergenceMap', () => synthesizeIndustryConvergenceMap(businessPacket, job.questionnaire)) },
      { key: 'emergingTechRadar', fn: () => synthIf('emergingTechRadar', () => synthesizeEmergingTechRadar(businessPacket, job.questionnaire)) },
      { key: 'regulatoryHorizon', fn: () => synthIf('regulatoryHorizon', () => synthesizeRegulatoryHorizon(businessPacket, job.questionnaire)) },
      { key: 'cashFlowForecaster', fn: () => synthIf('cashFlowForecaster', () => synthesizeCashFlowForecaster(businessPacket, job.questionnaire)) },
      { key: 'profitDriverTree', fn: () => synthIf('profitDriverTree', () => synthesizeProfitDriverTree(businessPacket, job.questionnaire)) },
      { key: 'revenueQualityIndex', fn: () => synthIf('revenueQualityIndex', () => synthesizeRevenueQualityIndex(businessPacket, job.questionnaire)) },
      { key: 'financialResilienceScore', fn: () => synthIf('financialResilienceScore', () => synthesizeFinancialResilienceScore(businessPacket, job.questionnaire)) },
      { key: 'workingCapitalOptimizer', fn: () => synthIf('workingCapitalOptimizer', () => synthesizeWorkingCapitalOptimizer(businessPacket, job.questionnaire)) },
      { key: 'investmentReadinessGate', fn: () => synthIf('investmentReadinessGate', () => synthesizeInvestmentReadinessGate(businessPacket, job.questionnaire)) },
      { key: 'customerDnaProfile', fn: () => synthIf('customerDnaProfile', () => synthesizeCustomerDnaProfile(businessPacket, job.questionnaire)) },
      { key: 'propensityModel', fn: () => synthIf('propensityModel', () => synthesizePropensityModel(businessPacket, job.questionnaire)) },
      { key: 'churnEarlyWarning', fn: () => synthIf('churnEarlyWarning', () => synthesizeChurnEarlyWarning(businessPacket, job.questionnaire)) },
      { key: 'customerEffortOptimizer', fn: () => synthIf('customerEffortOptimizer', () => synthesizeCustomerEffortOptimizer(businessPacket, job.questionnaire)) },
      { key: 'loyaltyDriver', fn: () => synthIf('loyaltyDriver', () => synthesizeLoyaltyDriver(businessPacket, job.questionnaire)) },
      { key: 'accountIntelligence', fn: () => synthIf('accountIntelligence', () => synthesizeAccountIntelligence(businessPacket, job.questionnaire)) },
      { key: 'gtmCalendar', fn: () => synthIf('gtmCalendar', () => synthGtmCalendar(businessPacket, job.questionnaire)) },
      { key: 'launchReadiness', fn: () => synthIf('launchReadiness', () => synthLaunchReadiness(businessPacket, job.questionnaire)) },
      { key: 'messageTesting', fn: () => synthIf('messageTesting', () => synthMessageTesting(businessPacket, job.questionnaire)) },
      { key: 'salesCollateral', fn: () => synthIf('salesCollateral', () => synthSalesCollateral(businessPacket, job.questionnaire)) },
      { key: 'demandGenPlan', fn: () => synthIf('demandGenPlan', () => synthDemandGenPlan(businessPacket, job.questionnaire)) },
      { key: 'channelActivation', fn: () => synthIf('channelActivation', () => synthChannelActivation(businessPacket, job.questionnaire)) },
      { key: 'priceElasticityModel', fn: () => synthIf('priceElasticityModel', () => synthPriceElasticityModel(businessPacket, job.questionnaire)) },
      { key: 'dynamicPricingEngine', fn: () => synthIf('dynamicPricingEngine', () => synthDynamicPricingEngine(businessPacket, job.questionnaire)) },
      { key: 'discountImpactAnalysis', fn: () => synthIf('discountImpactAnalysis', () => synthDiscountImpactAnalysis(businessPacket, job.questionnaire)) },
      { key: 'bundleDesigner', fn: () => synthIf('bundleDesigner', () => synthBundleDesigner(businessPacket, job.questionnaire)) },
      { key: 'competitivePriceTracker', fn: () => synthIf('competitivePriceTracker', () => synthCompetitivePriceTracker(businessPacket, job.questionnaire)) },
      { key: 'pricingExperiment', fn: () => synthIf('pricingExperiment', () => synthPricingExperiment(businessPacket, job.questionnaire)) },
      { key: 'kpiWatchlist', fn: () => synthIf('kpiWatchlist', () => synthKpiWatchlist(businessPacket, job.questionnaire)) },
      { key: 'alertFramework', fn: () => synthIf('alertFramework', () => synthAlertFramework(businessPacket, job.questionnaire)) },
      { key: 'anomalyDetection', fn: () => synthIf('anomalyDetection', () => synthAnomalyDetection(businessPacket, job.questionnaire)) },
      { key: 'trendForecast', fn: () => synthIf('trendForecast', () => synthTrendForecast(businessPacket, job.questionnaire)) },
      { key: 'dashboardDesign', fn: () => synthIf('dashboardDesign', () => synthDashboardDesign(businessPacket, job.questionnaire)) },
      { key: 'insightsCatalog', fn: () => synthIf('insightsCatalog', () => synthInsightsCatalog(businessPacket, job.questionnaire)) },
      { key: 'ideaPipeline', fn: () => synthIf('ideaPipeline', () => synthIdeaPipeline(businessPacket, job.questionnaire)) },
      { key: 'innovationScoring', fn: () => synthIf('innovationScoring', () => synthInnovationScoring(businessPacket, job.questionnaire)) },
      { key: 'experimentBoard', fn: () => synthIf('experimentBoard', () => synthExperimentBoard(businessPacket, job.questionnaire)) },
      { key: 'patentAnalysis', fn: () => synthIf('patentAnalysis', () => synthPatentAnalysis(businessPacket, job.questionnaire)) },
      { key: 'disruptionPlaybook', fn: () => synthIf('disruptionPlaybook', () => synthDisruptionPlaybook(businessPacket, job.questionnaire)) },
      { key: 'futureProofing', fn: () => synthIf('futureProofing', () => synthFutureProofing(businessPacket, job.questionnaire)) },
      { key: 'revenueMixAnalysis', fn: () => synthIf('revenueMixAnalysis', () => synthRevenueMixAnalysis(businessPacket, job.questionnaire)) },
      { key: 'accountGrowthPlan', fn: () => synthIf('accountGrowthPlan', () => synthAccountGrowthPlan(businessPacket, job.questionnaire)) },
      { key: 'contractOptimizer', fn: () => synthIf('contractOptimizer', () => synthContractOptimizer(businessPacket, job.questionnaire)) },
      { key: 'usagePatternAnalysis', fn: () => synthIf('usagePatternAnalysis', () => synthUsagePatternAnalysis(businessPacket, job.questionnaire)) },
      { key: 'churnRecoveryPlan', fn: () => synthIf('churnRecoveryPlan', () => synthChurnRecoveryPlan(businessPacket, job.questionnaire)) },
      { key: 'winbackProgram', fn: () => synthIf('winbackProgram', () => synthWinbackProgram(businessPacket, job.questionnaire)) },
      { key: 'automationAudit', fn: () => synthIf('automationAudit', () => synthAutomationAudit(businessPacket, job.questionnaire)) },
      { key: 'processDigitization', fn: () => synthIf('processDigitization', () => synthProcessDigitization(businessPacket, job.questionnaire)) },
      { key: 'botDeploymentPlan', fn: () => synthIf('botDeploymentPlan', () => synthBotDeploymentPlan(businessPacket, job.questionnaire)) },
      { key: 'workflowBenchmark', fn: () => synthIf('workflowBenchmark', () => synthWorkflowBenchmark(businessPacket, job.questionnaire)) },
      { key: 'handoffEfficiency', fn: () => synthIf('handoffEfficiency', () => synthHandoffEfficiency(businessPacket, job.questionnaire)) },
      { key: 'toolConsolidation', fn: () => synthIf('toolConsolidation', () => synthToolConsolidation(businessPacket, job.questionnaire)) },
      { key: 'crisisCommunication', fn: () => synthIf('crisisCommunication', () => synthCrisisCommunication(businessPacket, job.questionnaire)) },
      { key: 'internalComms', fn: () => synthIf('internalComms', () => synthInternalComms(businessPacket, job.questionnaire)) },
      { key: 'investorNarrative', fn: () => synthIf('investorNarrative', () => synthInvestorNarrative(businessPacket, job.questionnaire)) },
      { key: 'pressStrategy', fn: () => synthIf('pressStrategy', () => synthPressStrategy(businessPacket, job.questionnaire)) },
      { key: 'thoughtLeadershipPlan', fn: () => synthIf('thoughtLeadershipPlan', () => synthThoughtLeadershipPlan(businessPacket, job.questionnaire)) },
      { key: 'brandStoryArc', fn: () => synthIf('brandStoryArc', () => synthBrandStoryArc(businessPacket, job.questionnaire)) },
      { key: 'masteryDashboard', fn: () => synthIf('masteryDashboard', () => synthMasteryDashboard(businessPacket, job.questionnaire)) },
      { key: 'growthVelocityScore', fn: () => synthIf('growthVelocityScore', () => synthGrowthVelocityScore(businessPacket, job.questionnaire)) },
      { key: 'operationalMaturity', fn: () => synthIf('operationalMaturity', () => synthOperationalMaturity(businessPacket, job.questionnaire)) },
      { key: 'leadershipReadiness', fn: () => synthIf('leadershipReadiness', () => synthLeadershipReadiness(businessPacket, job.questionnaire)) },
      { key: 'marketDominanceIndex', fn: () => synthIf('marketDominanceIndex', () => synthMarketDominanceIndex(businessPacket, job.questionnaire)) },
      { key: 'futureReadiness', fn: () => synthIf('futureReadiness', () => synthFutureReadiness(businessPacket, job.questionnaire)) },
      { key: 'aiAdoptionPotential', fn: () => synthIf('aiAdoptionPotential', () => synthAIAdoptionPotential(businessPacket, job.questionnaire)) },
      { key: 'mlUseCaseIdentification', fn: () => synthIf('mlUseCaseIdentification', () => synthMLUseCaseIdentification(businessPacket, job.questionnaire)) },
      { key: 'dataInfrastructureGapAnalysis', fn: () => synthIf('dataInfrastructureGapAnalysis', () => synthDataInfrastructureGapAnalysis(businessPacket, job.questionnaire)) },
      { key: 'automationROIModeling', fn: () => synthIf('automationROIModeling', () => synthAutomationROIModeling(businessPacket, job.questionnaire)) },
      { key: 'aiTalentNeedsAssessment', fn: () => synthIf('aiTalentNeedsAssessment', () => synthAITalentNeedsAssessment(businessPacket, job.questionnaire)) },
      { key: 'ethicalAIFramework', fn: () => synthIf('ethicalAIFramework', () => synthEthicalAIFramework(businessPacket, job.questionnaire)) },
      { key: 'marketEntryScoring', fn: () => synthIf('marketEntryScoring', () => synthMarketEntryScoring(businessPacket, job.questionnaire)) },
      { key: 'regulatoryLandscapeMapping', fn: () => synthIf('regulatoryLandscapeMapping', () => synthRegulatoryLandscapeMapping(businessPacket, job.questionnaire)) },
      { key: 'culturalAdaptationStrategy', fn: () => synthIf('culturalAdaptationStrategy', () => synthCulturalAdaptationStrategy(businessPacket, job.questionnaire)) },
      { key: 'logisticsExpansionAnalysis', fn: () => synthIf('logisticsExpansionAnalysis', () => synthLogisticsExpansionAnalysis(businessPacket, job.questionnaire)) },
      { key: 'localPartnershipStrategy', fn: () => synthIf('localPartnershipStrategy', () => synthLocalPartnershipStrategy(businessPacket, job.questionnaire)) },
      { key: 'internationalPricingOptimization', fn: () => synthIf('internationalPricingOptimization', () => synthInternationalPricingOptimization(businessPacket, job.questionnaire)) },
      { key: 'acquisitionFunnelIntelligence', fn: () => synthIf('acquisitionFunnelIntelligence', () => synthAcquisitionFunnelIntelligence(businessPacket, job.questionnaire)) },
      { key: 'onboardingEffectivenessScore', fn: () => synthIf('onboardingEffectivenessScore', () => synthOnboardingEffectivenessScore(businessPacket, job.questionnaire)) },
      { key: 'engagementScoringModel', fn: () => synthIf('engagementScoringModel', () => synthEngagementScoringModel(businessPacket, job.questionnaire)) },
      { key: 'expansionRevenueOpportunities', fn: () => synthIf('expansionRevenueOpportunities', () => synthExpansionRevenueOpportunities(businessPacket, job.questionnaire)) },
      { key: 'advocacyProgramDesign', fn: () => synthIf('advocacyProgramDesign', () => synthAdvocacyProgramDesign(businessPacket, job.questionnaire)) },
      { key: 'lifetimeValueModeling', fn: () => synthIf('lifetimeValueModeling', () => synthLifetimeValueModeling(businessPacket, job.questionnaire)) },
      { key: 'apiMonetizationStrategy', fn: () => synthIf('apiMonetizationStrategy', () => synthAPIMonetizationStrategy(businessPacket, job.questionnaire)) },
      { key: 'platformEcosystemHealth', fn: () => synthIf('platformEcosystemHealth', () => synthPlatformEcosystemHealth(businessPacket, job.questionnaire)) },
      { key: 'developerExperienceOptimization', fn: () => synthIf('developerExperienceOptimization', () => synthDeveloperExperienceOptimization(businessPacket, job.questionnaire)) },
      { key: 'integrationMarketplaceAnalytics', fn: () => synthIf('integrationMarketplaceAnalytics', () => synthIntegrationMarketplaceAnalytics(businessPacket, job.questionnaire)) },
      { key: 'partnerEnablementProgram', fn: () => synthIf('partnerEnablementProgram', () => synthPartnerEnablementProgram(businessPacket, job.questionnaire)) },
      { key: 'platformGovernanceFramework', fn: () => synthIf('platformGovernanceFramework', () => synthPlatformGovernanceFramework(businessPacket, job.questionnaire)) },
      { key: 'demandForecastingEngine', fn: () => synthIf('demandForecastingEngine', () => synthDemandForecastingEngine(businessPacket, job.questionnaire)) },
      { key: 'predictiveMaintenanceModeling', fn: () => synthIf('predictiveMaintenanceModeling', () => synthPredictiveMaintenanceModeling(businessPacket, job.questionnaire)) },
      { key: 'churnPredictionModel', fn: () => synthIf('churnPredictionModel', () => synthChurnPredictionModel(businessPacket, job.questionnaire)) },
      { key: 'leadScoringAI', fn: () => synthIf('leadScoringAI', () => synthLeadScoringAI(businessPacket, job.questionnaire)) },
      { key: 'inventoryOptimizationAI', fn: () => synthIf('inventoryOptimizationAI', () => synthInventoryOptimizationAI(businessPacket, job.questionnaire)) },
      { key: 'revenuePredictionModeling', fn: () => synthIf('revenuePredictionModeling', () => synthRevenuePredictionModeling(businessPacket, job.questionnaire)) },
      { key: 'orgStructureAnalysis', fn: () => synthIf('orgStructureAnalysis', () => synthOrgStructureAnalysis(businessPacket, job.questionnaire)) },
      { key: 'spanOfControlOptimization', fn: () => synthIf('spanOfControlOptimization', () => synthSpanOfControlOptimization(businessPacket, job.questionnaire)) },
      { key: 'decisionRightsMapping', fn: () => synthIf('decisionRightsMapping', () => synthDecisionRightsMapping(businessPacket, job.questionnaire)) },
      { key: 'collaborationNetworkMapping', fn: () => synthIf('collaborationNetworkMapping', () => synthCollaborationNetworkMapping(businessPacket, job.questionnaire)) },
      { key: 'roleOptimizationAnalysis', fn: () => synthIf('roleOptimizationAnalysis', () => synthRoleOptimizationAnalysis(businessPacket, job.questionnaire)) },
      { key: 'successionPlanningFramework', fn: () => synthIf('successionPlanningFramework', () => synthSuccessionPlanningFramework(businessPacket, job.questionnaire)) },
      { key: 'impactMeasurementDashboard', fn: () => synthIf('impactMeasurementDashboard', () => synthImpactMeasurementDashboard(businessPacket, job.questionnaire)) },
      { key: 'esgReportingCompliance', fn: () => synthIf('esgReportingCompliance', () => synthESGReportingCompliance(businessPacket, job.questionnaire)) },
      { key: 'stakeholderEngagementAnalytics', fn: () => synthIf('stakeholderEngagementAnalytics', () => synthStakeholderEngagementAnalytics(businessPacket, job.questionnaire)) },
      { key: 'communityInvestmentStrategy', fn: () => synthIf('communityInvestmentStrategy', () => synthCommunityInvestmentStrategy(businessPacket, job.questionnaire)) },
      { key: 'diversityMetricsAnalytics', fn: () => synthIf('diversityMetricsAnalytics', () => synthDiversityMetricsAnalytics(businessPacket, job.questionnaire)) },
      { key: 'greenOperationsOptimization', fn: () => synthIf('greenOperationsOptimization', () => synthGreenOperationsOptimization(businessPacket, job.questionnaire)) },
      { key: 'knowledgeAuditAssessment', fn: () => synthIf('knowledgeAuditAssessment', () => synthKnowledgeAuditAssessment(businessPacket, job.questionnaire)) },
      { key: 'expertiseMappingSystem', fn: () => synthIf('expertiseMappingSystem', () => synthExpertiseMappingSystem(businessPacket, job.questionnaire)) },
      { key: 'documentationStrategyFramework', fn: () => synthIf('documentationStrategyFramework', () => synthDocumentationStrategyFramework(businessPacket, job.questionnaire)) },
      { key: 'learningPathwaysDesign', fn: () => synthIf('learningPathwaysDesign', () => synthLearningPathwaysDesign(businessPacket, job.questionnaire)) },
      { key: 'institutionalMemoryProtection', fn: () => synthIf('institutionalMemoryProtection', () => synthInstitutionalMemoryProtection(businessPacket, job.questionnaire)) },
      { key: 'knowledgeTransferOptimization', fn: () => synthIf('knowledgeTransferOptimization', () => synthKnowledgeTransferOptimization(businessPacket, job.questionnaire)) },
      { key: 'toolsAutomationPlan', fn: () => synthIf('toolsAutomationPlan', () => synthesizeToolsAutomation(businessPacket, job.questionnaire)) },
    ];

    // Batch executor: 15 concurrent Gemini calls per batch
    const EXT_BATCH_SIZE = 15;
    for (let i = 0; i < extTasks.length; i += EXT_BATCH_SIZE) {
      const batch = extTasks.slice(i, i + EXT_BATCH_SIZE);
      console.log(`[Pivot] Extended batch ${Math.floor(i / EXT_BATCH_SIZE) + 1}/${Math.ceil(extTasks.length / EXT_BATCH_SIZE)}: ${batch.map(t => t.key).join(', ')}`);
      const settled = await Promise.allSettled(batch.map(t => t.fn()));
      for (let j = 0; j < batch.length; j++) {
        const s = settled[j];
        if (s.status === "fulfilled" && s.value) {
          deliverables = { ...deliverables, [batch[j].key]: s.value };
        }
      }
      _extStep += batch.length;
      deliverables = { ...deliverables, _progress: { completed: _extStep, total: extTasks.length, currentStep: 'Refining analysis', startedAt: _extStarted } };
      await updateJob(runId, { deliverables });
    }

  return deliverables;
}

export async function runPipeline(runId: string): Promise<void> {
  const job = await getJob(runId);
  if (!job) return;
  if (!RESUMABLE_ENTRY_STATUSES.has(job.status)) return;

  // Reset failed status so the pipeline can proceed.
  if (job.status === "failed") {
    await updateJob(runId, { error: undefined });
  }

  try {
    // ── Step 1: Parse ──────────────────────────────────────────────────────
    // Skip if we already have a businessPacket from a prior run.
    let businessPacket: BusinessPacket | null = null;
    if (job.parsedContext) {
      try {
        const cached = JSON.parse(job.parsedContext) as BusinessPacket;
        // Only reuse if the cached packet has real data (not empty extraction)
        const hasData = (cached.categoryDossiers?.length ?? 0) > 0
          || (cached.financialFacts?.length ?? 0) > 0
          || ((cached.consolidatedRisks?.length ?? 0) > 0
            && !cached.consolidatedRisks?.[0]?.includes("data gap")
            && !cached.consolidatedRisks?.[0]?.includes("data extraction failure"));
        if (hasData) {
          businessPacket = cached;
        } else {
          console.log("[Pivot] Cached parsedContext has no real data, re-parsing from scratch");
        }
      } catch { /* corrupt — re-parse */ }
    }

    if (!businessPacket) {
      await updateJob(runId, { status: "parsing" });
      const parsedFiles = await parseFiles(runId, job.filePaths);

      await updateJob(runId, { status: "ingesting" });

      // Run document ingestion, RAG embedding, AND fresh integration data pull in parallel
      // All three run concurrently — zero added wall-clock time
      const integrationOrgId = job.questionnaire.orgId;
      const [ingestResult, _integrationPull, _ragEmbed] = await Promise.all([
        Promise.all([
          ingestDocuments(parsedFiles, job.questionnaire),
          categorizeAndBuildGraph(parsedFiles, job.questionnaire),
        ]),
        (async () => {
          if (integrationOrgId) {
            try {
              await pullFreshIntegrationData(integrationOrgId);
            } catch (e) {
              console.warn('[Pivot] Fresh integration pull failed (non-fatal):', e);
            }
          }
        })(),
        // RAG: embed document chunks for semantic search (non-blocking)
        (async () => {
          if (integrationOrgId) {
            try {
              const { embedDocuments } = await import('./embed');
              const docs = parsedFiles.map((f: any) => ({
                filename: f.filename,
                text: f.text,
              }));
              await embedDocuments(integrationOrgId, runId, docs);
            } catch (e) {
              console.warn('[Pivot] Document embedding failed (non-fatal):', e);
            }
          }
        })(),
      ]);

      const [bp, knowledgeGraph] = ingestResult;
      businessPacket = bp;
      await updateJob(runId, {
        parsedContext: JSON.stringify(businessPacket),
        knowledgeGraph,
      });
    }

    // ── Collect integration data from connected tools (Composio) ────────
    // Reads from integration_data table — now populated with fresh data from pullFreshIntegrationData()
    {
      const integrationOrgId = job.questionnaire.orgId;
      if (integrationOrgId) {
        try {
          const integrationCtx = await collectIntegrationContext(integrationOrgId);
          if (integrationCtx.records.length > 0) {
            businessPacket.integrationData = integrationCtx;
            console.log(`[Pivot] Loaded integration data from ${integrationCtx.providers.length} providers: ${integrationCtx.providers.join(', ')} (${integrationCtx.records.length} records)`);

            // Extract verified financial facts from integration data (Stripe revenue, customer counts, etc.)
            const integrationFacts = extractFinancialFactsFromIntegrations(integrationCtx);
            if (integrationFacts.length > 0) {
              if (!businessPacket.financialFacts) businessPacket.financialFacts = [];
              businessPacket.financialFacts.push(...integrationFacts);
              console.log(`[Pivot] Extracted ${integrationFacts.length} financial facts from integrations: ${integrationFacts.map(f => f.label).join(', ')}`);

              // Also populate keyMetrics from integration data if not already set
              for (const fact of integrationFacts) {
                if (fact.label.includes('Total Revenue') && !businessPacket.keyMetrics.cashPosition) {
                  businessPacket.keyMetrics.cashPosition = fact.value;
                }
                if (fact.label.includes('Monthly Revenue') && !businessPacket.keyMetrics.estimatedMonthlyRevenue) {
                  businessPacket.keyMetrics.estimatedMonthlyRevenue = fact.value;
                }
                if (fact.label.includes('Cash Collected') && !businessPacket.keyMetrics.cashPosition) {
                  businessPacket.keyMetrics.cashPosition = fact.value;
                }
              }
            }

            // Extract org intelligence: people, roles, org structure from Slack, Gmail, GitHub, etc.
            const orgIntel = extractOrgIntelligence(integrationCtx);
            if (orgIntel.people.length > 0 || orgIntel.insights.length > 0) {
              businessPacket.orgIntelligence = orgIntel;
              console.log(`[Pivot] Org intelligence: ${orgIntel.people.length} people, ${orgIntel.orgStructure?.departments?.length || 0} departments, ${orgIntel.insights.length} insights`);

              // Populate employee count from org intelligence if not set
              if (!businessPacket.keyMetrics.employeeCount && orgIntel.orgStructure?.teamSize) {
                businessPacket.keyMetrics.employeeCount = orgIntel.orgStructure.teamSize;
              }

              // Add org intelligence as a category dossier so synthesis can use it
              const peopleSummary = orgIntel.people.slice(0, 30).map(p => {
                const tags = [p.isEmployee ? 'employee' : '', p.isClient ? 'client' : '', p.isContractor ? 'contractor' : ''].filter(Boolean).join('/');
                return `${p.name}${p.role ? ' (' + p.role + ')' : ''} [${tags}] — found in ${p.sources.join(', ')}${p.email ? ' — ' + p.email : ''}`;
              });
              businessPacket.categoryDossiers.push({
                category: 'Org Intelligence (from Connected Integrations)',
                keyFacts: [
                  `Team size: ${orgIntel.orgStructure?.teamSize || 'unknown'} employees`,
                  `Departments: ${orgIntel.orgStructure?.departments?.join(', ') || 'unknown'}`,
                  `Key roles: ${orgIntel.orgStructure?.keyRoles?.join(', ') || 'unknown'}`,
                  `Communication style: ${orgIntel.communicationPatterns?.collaborationStyle || 'unknown'}`,
                  `Primary channels: ${orgIntel.communicationPatterns?.primaryChannels?.slice(0, 5).join(', ') || 'unknown'}`,
                  ...orgIntel.insights,
                  '--- PEOPLE ---',
                  ...peopleSummary,
                  `--- CLIENTS (${orgIntel.clientRelationships?.length || 0}) ---`,
                  ...(orgIntel.clientRelationships?.slice(0, 15).map(c => `${c.name}${c.contactPerson ? ' (' + c.contactPerson + ')' : ''} — ${c.recentActivity || 'no recent activity'}`) || []),
                ],
                criticalIssues: [],
                financialAmounts: {},
              });

              // Update top customers from real client data
              if (orgIntel.clientRelationships && orgIntel.clientRelationships.length > 0) {
                businessPacket.keyMetrics.topCustomers = orgIntel.clientRelationships.slice(0, 10).map(c => c.name);
              }
            }
          }
        } catch (e) {
          console.warn('[Pivot] Failed to collect integration data:', e);
        }
      }
    }

    // ── Activate per-section anti-hallucination guardrails ────────────────
    if (businessPacket.financialFacts && businessPacket.financialFacts.length > 0) {
      setSectionFacts(businessPacket.financialFacts);
      console.log(`[Pivot] Loaded ${businessPacket.financialFacts.length} verified financial facts for synthesis guardrails`);
    }

    // ── Step 1b: Relevance selection (before synthesis to skip irrelevant sections) ──
    let relevantSections: Set<string> | undefined;
    const pipelineStartedAt = Date.now();
    try {
      const websiteUrl2 = job.questionnaire.website || "";
      let websiteContent = "";
      if (websiteUrl2) {
        console.log(`[Pivot] Scraping website content from ${websiteUrl2} for relevance...`);
        websiteContent = await scrapeWebsiteContent(websiteUrl2);
        console.log(`[Pivot] Scraped ${websiteContent.length} chars of website content`);
      }

      // Inject website content into BusinessPacket so synthesis agents can use it
      if (websiteContent && businessPacket) {
        if (!businessPacket.categoryDossiers) businessPacket.categoryDossiers = [];
        businessPacket.categoryDossiers.push({
          category: "Website Intelligence",
          keyFacts: [`Website content from ${job.questionnaire.website}: ${websiteContent.slice(0, 6000)}`],
          criticalIssues: [],
          financialAmounts: {},
        });
        await updateJob(runId, { parsedContext: JSON.stringify(businessPacket) });
      }

      const businessSummary = formatPacketAsContext(businessPacket).slice(0, 5000);
      console.log("[Pivot] Running AI section selector...");
      const aiSelected = await selectSectionsWithAI(job.questionnaire, businessSummary, websiteContent);
      if (aiSelected) {
        relevantSections = aiSelected;
        console.log(`[Pivot] AI selected ${aiSelected.size} relevant sections`);
      } else {
        relevantSections = getStrictRelevantSections(job.questionnaire);
        console.log(`[Pivot] Rule-based fallback: ${relevantSections.size} sections selected`);
      }
    } catch (e) {
      console.warn("[Pivot] Relevance engine failed, using strict fallback:", e);
      try {
        relevantSections = getStrictRelevantSections(job.questionnaire);
      } catch { /* last resort: run everything */ }
    }

    // Relevance gating helpers — used by all synthesis steps
    const isSelected = (key: string) => !relevantSections || relevantSections.has(key);
    const synthIf = <T>(key: string, fn: () => Promise<T | null>): Promise<T | null> => {
      if (!isSelected(key)) return Promise.resolve(null);
      if ((deliverables as unknown as Record<string, unknown>)[key]) return Promise.resolve(null);
      return fn();
    };
    const totalSteps = relevantSections ? relevantSections.size : 300;
    let completedSteps = 0;
    const trackProgress = (step: string) => {
      completedSteps++;
      deliverables = { ...deliverables, _progress: { completed: completedSteps, total: totalSteps, currentStep: step, startedAt: pipelineStartedAt } };
    };

    // ── Step 2: Synthesize ─────────────────────────────────────────────────
    // Skip if deliverables already exist (e.g. crashed during formatting).
    const fresh = await getJob(runId);
    let deliverables: MVPDeliverables;

    if (fresh?.deliverables && Object.keys(fresh.deliverables).length > 3) {
      deliverables = fresh.deliverables;
    } else {
      await updateJob(runId, { status: "synthesizing" });
      deliverables = await synthesizeDeliverables(job.questionnaire, businessPacket);
      await updateJob(runId, { deliverables });
    }

    // ── Step 3: Website + competitor analysis (best-effort) ────────────────
    const orgId = job.questionnaire.orgId ?? "default-org";
    const websiteUrl = job.questionnaire.website;
    let websiteAnalysis: WebsiteAnalysis | undefined = deliverables.websiteAnalysis;

    // Persist website to org table so org-logo can find it
    if (websiteUrl && orgId !== "default-org") {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const sb = createAdminClient();
        await sb.from("organizations").update({ website: websiteUrl }).eq("id", orgId);
      } catch { /* non-fatal */ }
    }

    if (websiteUrl && !websiteAnalysis) {
      try {
        websiteAnalysis = await analyzeWebsite(websiteUrl, { runId, label: "primary" });
        deliverables = { ...deliverables, websiteAnalysis };
        await saveWebsiteAnalysis(orgId, websiteAnalysis);
        await updateJob(runId, { deliverables });
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
        await updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Competitor report build failed (non-fatal):", e);
      }
    }

    {
      try {
        const [techOpt, priceInt] = await Promise.allSettled([
          synthIf('techOptimization', () => synthesizeTechOptimization(businessPacket, job.questionnaire)),
          synthIf('pricingIntelligence', () => synthesizePricingIntelligence(businessPacket, job.questionnaire, deliverables.competitorAnalysis)),
        ]);
        if (techOpt.status === "fulfilled" && techOpt.value) deliverables = { ...deliverables, techOptimization: techOpt.value };
        if (priceInt.status === "fulfilled" && priceInt.value) deliverables = { ...deliverables, pricingIntelligence: priceInt.value };
        await updateJob(runId, { deliverables });
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
        await updateJob(runId, { deliverables });
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
            await updateJob(runId, { deliverables });
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
        await updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Terminology detection failed (non-fatal):", e);
      }
    }

    // KPIs + Health Checklist in parallel (independent)
    {
      console.log("[Pivot] Running KPIs + Health Checklist in parallel...");
      const [kpiResult, checklistResult] = await Promise.allSettled([
        !deliverables.kpiReport ? synthesizeKPIs(businessPacket, job.questionnaire) : Promise.resolve(null),
        !deliverables.healthChecklist ? synthesizeHealthChecklist(businessPacket, job.questionnaire) : Promise.resolve(null),
      ]);
      if (kpiResult.status === "fulfilled" && kpiResult.value) {
        deliverables = { ...deliverables, kpiReport: kpiResult.value };
      }
      if (checklistResult.status === "fulfilled" && checklistResult.value) {
        deliverables = { ...deliverables, healthChecklist: checklistResult.value };
      }
      await updateJob(runId, { deliverables });
    }

    // 30-day roadmap (depends on other deliverables for context)
    if (!deliverables.roadmap) {
      try {
        console.log("[Pivot] Building 30-day roadmap...");
        const roadmap = await synthesizeRoadmap(businessPacket, job.questionnaire, deliverables);
        if (roadmap) {
          deliverables = { ...deliverables, roadmap };
          await updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] Roadmap synthesis failed (non-fatal):", e);
      }
    }

    // ── Step 4d: Wave 2-10 intelligence (batched, relevance-gated) ──────────
    {
      const bp = businessPacket;
      const q = job.questionnaire;

      // Collect all wave 2-10 synthesis tasks
      const waveTasks: { key: string; fn: () => Promise<unknown | null> }[] = [
        { key: 'swotAnalysis', fn: () => synthIf('swotAnalysis', () => synthesizeSWOT(bp, q)) },
        { key: 'unitEconomics', fn: () => synthIf('unitEconomics', () => synthesizeUnitEconomics(bp, q)) },
        { key: 'customerSegmentation', fn: () => synthIf('customerSegmentation', () => synthesizeCustomerSegmentation(bp, q)) },
        { key: 'competitiveWinLoss', fn: () => synthIf('competitiveWinLoss', () => synthesizeCompetitiveWinLoss(bp, q, deliverables)) },
        { key: 'revenueForecast', fn: () => synthIf('revenueForecast', () => synthesizeRevenueForecast(bp, q)) },
        { key: 'hiringPlan', fn: () => synthIf('hiringPlan', () => synthesizeHiringPlan(bp, q, deliverables)) },
        { key: 'churnPlaybook', fn: () => synthIf('churnPlaybook', () => synthesizeChurnPlaybook(bp, q, deliverables)) },
        { key: 'salesPlaybook', fn: () => synthIf('salesPlaybook', () => synthesizeSalesPlaybook(bp, q, deliverables)) },
        { key: 'investorOnePager', fn: () => synthIf('investorOnePager', () => synthesizeInvestorOnePager(bp, q, deliverables)) },
        { key: 'goalTracker', fn: () => synthIf('goalTracker', () => synthesizeGoalTracker(bp, q, deliverables)) },
        { key: 'benchmarkScore', fn: () => synthIf('benchmarkScore', () => synthesizeBenchmarkScore(bp, q, deliverables)) },
        { key: 'executiveSummary', fn: () => synthIf('executiveSummary', () => synthesizeExecutiveSummary(bp, q, deliverables)) },
        { key: 'milestoneTracker', fn: () => synthIf('milestoneTracker', () => synthesizeMilestoneTracker(bp, q)) },
        { key: 'riskRegister', fn: () => synthIf('riskRegister', () => synthesizeRiskRegister(bp, q)) },
        { key: 'partnershipOpportunities', fn: () => synthIf('partnershipOpportunities', () => synthesizePartnershipOpportunities(bp, q)) },
        { key: 'fundingReadiness', fn: () => synthIf('fundingReadiness', () => synthesizeFundingReadiness(bp, q, deliverables)) },
        { key: 'marketSizing', fn: () => synthIf('marketSizing', () => synthesizeMarketSizing(bp, q)) },
        { key: 'scenarioPlanner', fn: () => synthIf('scenarioPlanner', () => synthesizeScenarioPlanner(bp, q)) },
        { key: 'operationalEfficiency', fn: () => synthIf('operationalEfficiency', () => synthesizeOperationalEfficiency(bp, q)) },
        { key: 'clvAnalysis', fn: () => synthIf('clvAnalysis', () => synthesizeCLVAnalysis(bp, q)) },
        { key: 'retentionPlaybook', fn: () => synthIf('retentionPlaybook', () => synthesizeRetentionPlaybook(bp, q)) },
        { key: 'revenueAttribution', fn: () => synthIf('revenueAttribution', () => synthesizeRevenueAttribution(bp, q)) },
        { key: 'boardDeck', fn: () => synthIf('boardDeck', () => synthesizeBoardDeck(bp, q)) },
        { key: 'competitiveMoat', fn: () => synthIf('competitiveMoat', () => synthesizeCompetitiveMoat(bp, q)) },
        { key: 'gtmScorecard', fn: () => synthIf('gtmScorecard', () => synthesizeGTMScorecard(bp, q)) },
        { key: 'cashOptimization', fn: () => synthIf('cashOptimization', () => synthesizeCashOptimization(bp, q)) },
        { key: 'talentGapAnalysis', fn: () => synthIf('talentGapAnalysis', () => synthesizeTalentGapAnalysis(bp, q)) },
        { key: 'revenueDiversification', fn: () => synthIf('revenueDiversification', () => synthesizeRevenueDiversification(bp, q)) },
        { key: 'customerJourneyMap', fn: () => synthIf('customerJourneyMap', () => synthesizeCustomerJourneyMap(bp, q)) },
        { key: 'complianceChecklist', fn: () => synthIf('complianceChecklist', () => synthesizeComplianceChecklist(bp, q)) },
        { key: 'expansionPlaybook', fn: () => synthIf('expansionPlaybook', () => synthesizeExpansionPlaybook(bp, q)) },
        { key: 'vendorScorecard', fn: () => synthIf('vendorScorecard', () => synthesizeVendorScorecard(bp, q)) },
        { key: 'productMarketFit', fn: () => synthIf('productMarketFit', () => synthesizeProductMarketFit(bp, q)) },
        { key: 'brandHealth', fn: () => synthIf('brandHealth', () => synthesizeBrandHealth(bp, q)) },
        { key: 'pricingElasticity', fn: () => synthIf('pricingElasticity', () => synthesizePricingElasticity(bp, q)) },
        { key: 'strategicInitiatives', fn: () => synthIf('strategicInitiatives', () => synthesizeStrategicInitiatives(bp, q)) },
        { key: 'cashConversionCycle', fn: () => synthIf('cashConversionCycle', () => synthesizeCashConversionCycle(bp, q)) },
        { key: 'innovationPipeline', fn: () => synthIf('innovationPipeline', () => synthesizeInnovationPipeline(bp, q)) },
        { key: 'stakeholderMap', fn: () => synthIf('stakeholderMap', () => synthesizeStakeholderMap(bp, q)) },
        { key: 'decisionLog', fn: () => synthIf('decisionLog', () => synthesizeDecisionLog(bp, q)) },
        { key: 'cultureAssessment', fn: () => synthIf('cultureAssessment', () => synthesizeCultureAssessment(bp, q)) },
        { key: 'ipPortfolio', fn: () => synthIf('ipPortfolio', () => synthesizeIPPortfolio(bp, q)) },
        { key: 'exitReadiness', fn: () => synthIf('exitReadiness', () => synthesizeExitReadiness(bp, q)) },
        { key: 'sustainabilityScore', fn: () => synthIf('sustainabilityScore', () => synthesizeSustainabilityScore(bp, q)) },
        { key: 'acquisitionTargets', fn: () => synthIf('acquisitionTargets', () => synthesizeAcquisitionTargets(bp, q)) },
        { key: 'financialRatios', fn: () => synthIf('financialRatios', () => synthesizeFinancialRatios(bp, q)) },
        { key: 'channelMixModel', fn: () => synthIf('channelMixModel', () => synthesizeChannelMixModel(bp, q)) },
        { key: 'supplyChainRisk', fn: () => synthIf('supplyChainRisk', () => synthesizeSupplyChainRisk(bp, q)) },
        { key: 'regulatoryLandscape', fn: () => synthIf('regulatoryLandscape', () => synthesizeRegulatoryLandscape(bp, q)) },
        { key: 'crisisPlaybook', fn: () => synthIf('crisisPlaybook', () => synthesizeCrisisPlaybook(bp, q)) },
        { key: 'aiReadiness', fn: () => synthIf('aiReadiness', () => synthesizeAIReadiness(bp, q)) },
        { key: 'networkEffects', fn: () => synthIf('networkEffects', () => synthesizeNetworkEffects(bp, q)) },
        { key: 'dataMonetization', fn: () => synthIf('dataMonetization', () => synthesizeDataMonetization(bp, q)) },
        { key: 'subscriptionMetrics', fn: () => synthIf('subscriptionMetrics', () => synthesizeSubscriptionMetrics(bp, q)) },
        { key: 'marketTiming', fn: () => synthIf('marketTiming', () => synthesizeMarketTiming(bp, q)) },
        { key: 'scenarioStressTest', fn: () => synthIf('scenarioStressTest', () => synthesizeScenarioStressTest(bp, q)) },
      ];

      // Run in batches of 18 for faster synthesis throughput
      const BATCH_SIZE = 18;
      for (let i = 0; i < waveTasks.length; i += BATCH_SIZE) {
        const batch = waveTasks.slice(i, i + BATCH_SIZE);
        console.log(`[Pivot] Wave batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(waveTasks.length / BATCH_SIZE)}: ${batch.map(t => t.key).join(', ')}`);
        const settled = await Promise.allSettled(batch.map(t => t.fn()));
        for (let j = 0; j < batch.length; j++) {
          const s = settled[j];
          if (s.status === "fulfilled" && s.value) {
            deliverables = { ...deliverables, [batch[j].key]: s.value };
            trackProgress(batch[j].key);
          }
        }
        await updateJob(runId, { deliverables });
      }
    }

    // Store selected sections in deliverables for UI filtering
    if (relevantSections) {
      deliverables = { ...deliverables, selectedSections: Array.from(relevantSections) };
      await updateJob(runId, { deliverables });
    }

    // ── Extended wave synthesis (extracted to avoid TS2563 control flow limit) ──
    deliverables = await runExtendedWaves(runId, deliverables, businessPacket, job, relevantSections);

    // ── Step 5: Agent memory (best-effort) ─────────────────────────────────
    try {
      await buildAgentMemory(orgId, job.questionnaire.organizationName, runId, deliverables, websiteAnalysis);
    } catch (e) {
      console.warn("[Pivot] Agent memory build failed (non-fatal):", e);
    }

    // ── Post-processing: Compute relevance scores for populated sections ──
    try {
      const metaKeys = new Set(["claimValidations", "relevanceScores", "dataProvenance", "selectedSections"]);
      const sectionKeys = Object.keys(deliverables).filter(
        k => typeof (deliverables as any)[k] === "object" && (deliverables as any)[k] !== null
          && !metaKeys.has(k)
      );
      deliverables.relevanceScores = sectionKeys.map(key => {
        const isAISelected = deliverables.selectedSections?.includes(key) ?? true;
        return {
          key,
          score: isAISelected ? 100 : 0,
          depth: isAISelected ? "full" as const : "skip" as const,
          reason: isAISelected ? "AI-selected" : "Not selected",
        };
      });
      console.log(`[Pivot] Computed relevance scores for ${sectionKeys.length} sections`);
      await updateJob(runId, { deliverables });
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
      await updateJob(runId, { deliverables });
    }

    // ── Step 5: Format PDF + DOCX ──────────────────────────────────────────
    await updateJob(runId, { status: "formatting" });
    await formatAndSave(runId, deliverables);

    await updateJob(runId, { status: "completed", phase: "PLAN" });
    console.log("[Pivot] Pipeline complete for run:", runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Pivot] Pipeline failed:", message);
    await updateJob(runId, { status: "failed", error: message });
  }
}
