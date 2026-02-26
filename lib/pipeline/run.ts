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
} from "./synthesize";
import { detectTerminology } from "./terminology";
import { formatAndSave } from "./format";
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
): Promise<MVPDeliverables> {
    if (!deliverables.pricingStrategyMatrix || !deliverables.customerHealthScore) {
      try {
        console.log("[Pivot] Synthesizing pricing strategy matrix + customer health score...");
        const [psm, chs] = await Promise.allSettled([
          deliverables.pricingStrategyMatrix ? Promise.resolve(null) : synthesizePricingStrategyMatrix(businessPacket, job.questionnaire),
          deliverables.customerHealthScore ? Promise.resolve(null) : synthesizeCustomerHealthScore(businessPacket, job.questionnaire),
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
          deliverables.revenueWaterfall ? Promise.resolve(null) : synthesizeRevenueWaterfall(businessPacket, job.questionnaire),
          deliverables.techDebtAssessment ? Promise.resolve(null) : synthesizeTechDebtAssessment(businessPacket, job.questionnaire),
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
          deliverables.teamPerformance ? Promise.resolve(null) : synthesizeTeamPerformance(businessPacket, job.questionnaire),
          deliverables.marketEntryStrategy ? Promise.resolve(null) : synthesizeMarketEntryStrategy(businessPacket, job.questionnaire),
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
          deliverables.competitiveIntelFeed ? Promise.resolve(null) : synthesizeCompetitiveIntelFeed(businessPacket, job.questionnaire),
          deliverables.cashFlowSensitivity ? Promise.resolve(null) : synthesizeCashFlowSensitivity(businessPacket, job.questionnaire),
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
          deliverables.digitalMaturity ? Promise.resolve(null) : synthesizeDigitalMaturity(businessPacket, job.questionnaire),
          deliverables.acquisitionFunnel ? Promise.resolve(null) : synthesizeAcquisitionFunnel(businessPacket, job.questionnaire),
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
          deliverables.strategicAlignment ? Promise.resolve(null) : synthesizeStrategicAlignment(businessPacket, job.questionnaire),
          deliverables.budgetOptimizer ? Promise.resolve(null) : synthesizeBudgetOptimizer(businessPacket, job.questionnaire),
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
          deliverables.revenueDrivers ? Promise.resolve(null) : synthesizeRevenueDrivers(businessPacket, job.questionnaire),
          deliverables.marginOptimization ? Promise.resolve(null) : synthesizeMarginOptimization(businessPacket, job.questionnaire),
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
          deliverables.demandForecasting ? Promise.resolve(null) : synthesizeDemandForecasting(businessPacket, job.questionnaire),
          deliverables.cohortAnalysis ? Promise.resolve(null) : synthesizeCohortAnalysis(businessPacket, job.questionnaire),
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
          deliverables.winLossAnalysis ? Promise.resolve(null) : synthesizeWinLossAnalysis(businessPacket, job.questionnaire),
          deliverables.salesForecast ? Promise.resolve(null) : synthesizeSalesForecast(businessPacket, job.questionnaire),
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
          deliverables.processEfficiency ? Promise.resolve(null) : synthesizeProcessEfficiency(businessPacket, job.questionnaire),
          deliverables.vendorRisk ? Promise.resolve(null) : synthesizeVendorRisk(businessPacket, job.questionnaire),
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
          deliverables.qualityMetrics ? Promise.resolve(null) : synthesizeQualityMetrics(businessPacket, job.questionnaire),
          deliverables.capacityPlanning ? Promise.resolve(null) : synthesizeCapacityPlanning(businessPacket, job.questionnaire),
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
          deliverables.knowledgeManagement ? Promise.resolve(null) : synthesizeKnowledgeManagement(businessPacket, job.questionnaire),
          deliverables.complianceScorecard ? Promise.resolve(null) : synthesizeComplianceScorecard(businessPacket, job.questionnaire),
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
          deliverables.marketPenetration ? Promise.resolve(null) : synthesizeMarketPenetration(businessPacket, job.questionnaire),
          deliverables.flywheelAnalysis ? Promise.resolve(null) : synthesizeFlywheelAnalysis(businessPacket, job.questionnaire),
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
          deliverables.partnershipsStrategy ? Promise.resolve(null) : synthesizePartnershipsStrategy(businessPacket, job.questionnaire),
          deliverables.internationalExpansion ? Promise.resolve(null) : synthesizeInternationalExpansion(businessPacket, job.questionnaire),
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
          deliverables.rdEffectiveness ? Promise.resolve(null) : synthesizeRDEffectiveness(businessPacket, job.questionnaire),
          deliverables.brandEquity ? Promise.resolve(null) : synthesizeBrandEquity(businessPacket, job.questionnaire),
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
          deliverables.workingCapital ? Promise.resolve(null) : synthesizeWorkingCapital(businessPacket, job.questionnaire),
          deliverables.debtStrategy ? Promise.resolve(null) : synthesizeDebtStrategy(businessPacket, job.questionnaire),
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
          deliverables.taxStrategy ? Promise.resolve(null) : synthesizeTaxStrategy(businessPacket, job.questionnaire),
          deliverables.investorReadiness ? Promise.resolve(null) : synthesizeInvestorReadiness(businessPacket, job.questionnaire),
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
          deliverables.maReadiness ? Promise.resolve(null) : synthesizeMAReadiness(businessPacket, job.questionnaire),
          deliverables.strategicRoadmap ? Promise.resolve(null) : synthesizeStrategicRoadmap(businessPacket, job.questionnaire),
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
          deliverables.customerVoice ? Promise.resolve(null) : synthesizeCustomerVoice(businessPacket, job.questionnaire),
          deliverables.referralEngine ? Promise.resolve(null) : synthesizeReferralEngine(businessPacket, job.questionnaire),
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
          deliverables.priceSensitivityIndex ? Promise.resolve(null) : synthesizePriceSensitivityIndex(businessPacket, job.questionnaire),
          deliverables.customerEffortScore ? Promise.resolve(null) : synthesizeCustomerEffortScore(businessPacket, job.questionnaire),
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
          deliverables.accountExpansionMap ? Promise.resolve(null) : synthesizeAccountExpansionMap(businessPacket, job.questionnaire),
          deliverables.loyaltyProgramDesign ? Promise.resolve(null) : synthesizeLoyaltyProgramDesign(businessPacket, job.questionnaire),
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
          deliverables.competitivePricingMatrix ? Promise.resolve(null) : synthesizeCompetitivePricingMatrix(businessPacket, job.questionnaire),
          deliverables.marketSentimentIndex ? Promise.resolve(null) : synthesizeMarketSentimentIndex(businessPacket, job.questionnaire),
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
          deliverables.disruptionRadar ? Promise.resolve(null) : synthesizeDisruptionRadar(businessPacket, job.questionnaire),
          deliverables.ecosystemMap ? Promise.resolve(null) : synthesizeEcosystemMap(businessPacket, job.questionnaire),
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
          deliverables.categoryCreation ? Promise.resolve(null) : synthesizeCategoryCreation(businessPacket, job.questionnaire),
          deliverables.marketVelocity ? Promise.resolve(null) : synthesizeMarketVelocity(businessPacket, job.questionnaire),
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
          deliverables.okrCascade ? Promise.resolve(null) : synthesizeOKRCascade(businessPacket, job.questionnaire),
          deliverables.meetingEffectiveness ? Promise.resolve(null) : synthesizeMeetingEffectiveness(businessPacket, job.questionnaire),
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
          deliverables.communicationAudit ? Promise.resolve(null) : synthesizeCommunicationAudit(businessPacket, job.questionnaire),
          deliverables.decisionVelocity ? Promise.resolve(null) : synthesizeDecisionVelocity(businessPacket, job.questionnaire),
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
          deliverables.resourceOptimizer ? Promise.resolve(null) : synthesizeResourceOptimizer(businessPacket, job.questionnaire),
          deliverables.changeManagement ? Promise.resolve(null) : synthesizeChangeManagement(businessPacket, job.questionnaire),
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
          deliverables.cashReserveStrategy ? Promise.resolve(null) : synthesizeCashReserveStrategy(businessPacket, job.questionnaire),
          deliverables.revenueQualityScore ? Promise.resolve(null) : synthesizeRevenueQualityScore(businessPacket, job.questionnaire),
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
          deliverables.costIntelligence ? Promise.resolve(null) : synthesizeCostIntelligence(businessPacket, job.questionnaire),
          deliverables.financialModeling ? Promise.resolve(null) : synthesizeFinancialModeling(businessPacket, job.questionnaire),
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
          deliverables.profitabilityMap ? Promise.resolve(null) : synthesizeProfitabilityMap(businessPacket, job.questionnaire),
          deliverables.capitalAllocation ? Promise.resolve(null) : synthesizeCapitalAllocation(businessPacket, job.questionnaire),
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
          deliverables.salesPipelineHealth ? Promise.resolve(null) : synthesizeSalesPipelineHealth(businessPacket, job.questionnaire),
          deliverables.dealVelocity ? Promise.resolve(null) : synthesizeDealVelocity(businessPacket, job.questionnaire),
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
          deliverables.winRateOptimizer ? Promise.resolve(null) : synthesizeWinRateOptimizer(businessPacket, job.questionnaire),
          deliverables.salesEnablement ? Promise.resolve(null) : synthesizeSalesEnablement(businessPacket, job.questionnaire),
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
          deliverables.territoryPlanning ? Promise.resolve(null) : synthesizeTerritoryPlanning(businessPacket, job.questionnaire),
          deliverables.quotaIntelligence ? Promise.resolve(null) : synthesizeQuotaIntelligence(businessPacket, job.questionnaire),
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
          deliverables.featurePrioritization ? Promise.resolve(null) : synthesizeFeaturePrioritization(businessPacket, job.questionnaire),
          deliverables.productUsageAnalytics ? Promise.resolve(null) : synthesizeProductUsageAnalytics(businessPacket, job.questionnaire),
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
          deliverables.techStackAudit ? Promise.resolve(null) : synthesizeTechStackAudit(businessPacket, job.questionnaire),
          deliverables.apiStrategy ? Promise.resolve(null) : synthesizeApiStrategy(businessPacket, job.questionnaire),
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
          deliverables.platformScalability ? Promise.resolve(null) : synthesizePlatformScalability(businessPacket, job.questionnaire),
          deliverables.userOnboarding ? Promise.resolve(null) : synthesizeUserOnboarding(businessPacket, job.questionnaire),
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
          deliverables.employeeEngagement ? Promise.resolve(null) : synthesizeEmployeeEngagement(businessPacket, job.questionnaire),
          deliverables.talentAcquisitionFunnel ? Promise.resolve(null) : synthesizeTalentAcquisitionFunnel(businessPacket, job.questionnaire),
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
          deliverables.compensationBenchmark ? Promise.resolve(null) : synthesizeCompensationBenchmark(businessPacket, job.questionnaire),
          deliverables.successionPlanning ? Promise.resolve(null) : synthesizeSuccessionPlanning(businessPacket, job.questionnaire),
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
          deliverables.diversityMetrics ? Promise.resolve(null) : synthesizeDiversityMetrics(businessPacket, job.questionnaire),
          deliverables.employerBrand ? Promise.resolve(null) : synthesizeEmployerBrand(businessPacket, job.questionnaire),
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
          deliverables.dataGovernance ? Promise.resolve(null) : synthesizeDataGovernance(businessPacket, job.questionnaire),
          deliverables.analyticsMaturity ? Promise.resolve(null) : synthesizeAnalyticsMaturity(businessPacket, job.questionnaire),
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
          deliverables.customerDataPlatform ? Promise.resolve(null) : synthesizeCustomerDataPlatform(businessPacket, job.questionnaire),
          deliverables.predictiveModeling ? Promise.resolve(null) : synthesizePredictiveModeling(businessPacket, job.questionnaire),
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
          deliverables.reportingFramework ? Promise.resolve(null) : synthesizeReportingFramework(businessPacket, job.questionnaire),
          deliverables.dataQualityScore ? Promise.resolve(null) : synthesizeDataQualityScore(businessPacket, job.questionnaire),
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
          deliverables.supplyChainRisk ? Promise.resolve(null) : synthesizeSupplyChainRisk(businessPacket, job.questionnaire),
          deliverables.inventoryOptimization ? Promise.resolve(null) : synthesizeInventoryOptimization(businessPacket, job.questionnaire),
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
          deliverables.vendorScorecard ? Promise.resolve(null) : synthesizeVendorScorecard(businessPacket, job.questionnaire),
          deliverables.operationalEfficiency ? Promise.resolve(null) : synthesizeOperationalEfficiency(businessPacket, job.questionnaire),
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
          deliverables.qualityManagement ? Promise.resolve(null) : synthesizeQualityManagement(businessPacket, job.questionnaire),
          deliverables.capacityPlanning ? Promise.resolve(null) : synthesizeCapacityPlanning(businessPacket, job.questionnaire),
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
          deliverables.customerJourneyMap ? Promise.resolve(null) : synthesizeCustomerJourneyMap(businessPacket, job.questionnaire),
          deliverables.npsAnalysis ? Promise.resolve(null) : synthesizeNpsAnalysis(businessPacket, job.questionnaire),
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
          deliverables.supportTicketIntelligence ? Promise.resolve(null) : synthesizeSupportTicketIntelligence(businessPacket, job.questionnaire),
          deliverables.customerHealthScore ? Promise.resolve(null) : synthesizeCustomerHealthScore(businessPacket, job.questionnaire),
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
          deliverables.voiceOfCustomer ? Promise.resolve(null) : synthesizeVoiceOfCustomer(businessPacket, job.questionnaire),
          deliverables.customerSegmentation ? Promise.resolve(null) : synthesizeCustomerSegmentation(businessPacket, job.questionnaire),
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
          deliverables.innovationPipeline ? Promise.resolve(null) : synthesizeInnovationPipeline(businessPacket, job.questionnaire),
          deliverables.ipPortfolio ? Promise.resolve(null) : synthesizeIpPortfolio(businessPacket, job.questionnaire),
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
          deliverables.rdEfficiency ? Promise.resolve(null) : synthesizeRdEfficiency(businessPacket, job.questionnaire),
          deliverables.technologyReadiness ? Promise.resolve(null) : synthesizeTechnologyReadiness(businessPacket, job.questionnaire),
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
          deliverables.partnershipEcosystem ? Promise.resolve(null) : synthesizePartnershipEcosystem(businessPacket, job.questionnaire),
          deliverables.mergersAcquisitions ? Promise.resolve(null) : synthesizeMergersAcquisitions(businessPacket, job.questionnaire),
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
          deliverables.esgScorecard ? Promise.resolve(null) : synthesizeEsgScorecard(businessPacket, job.questionnaire),
          deliverables.carbonFootprint ? Promise.resolve(null) : synthesizeCarbonFootprint(businessPacket, job.questionnaire),
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
          deliverables.regulatoryCompliance ? Promise.resolve(null) : synthesizeRegulatoryCompliance(businessPacket, job.questionnaire),
          deliverables.businessContinuity ? Promise.resolve(null) : synthesizeBusinessContinuity(businessPacket, job.questionnaire),
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
          deliverables.ethicsFramework ? Promise.resolve(null) : synthesizeEthicsFramework(businessPacket, job.questionnaire),
          deliverables.socialImpact ? Promise.resolve(null) : synthesizeSocialImpact(businessPacket, job.questionnaire),
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

    // ── Extended wave synthesis (extracted to avoid TS2563 control flow limit) ──
    deliverables = await runExtendedWaves(runId, deliverables, businessPacket, job);

    // ── Step 5: Agent memory (best-effort) ─────────────────────────────────
    try {
      await buildAgentMemory(orgId, job.questionnaire.organizationName, runId, deliverables, websiteAnalysis);
    } catch (e) {
      console.warn("[Pivot] Agent memory build failed (non-fatal):", e);
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
