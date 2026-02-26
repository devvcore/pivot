/**
 * Visualization Type Registry
 *
 * Maps every deliverable section to its ideal chart type.
 * Used by SmartSectionRenderer to auto-select the best visualization.
 */

export type VizType =
  | "score_gauge"
  | "ranked_bars"
  | "breakdown_pie"
  | "time_series"
  | "comparison_radar"
  | "matrix_scatter"
  | "funnel"
  | "waterfall"
  | "table_only";

/**
 * Explicit mapping of section keys to their best visualization.
 * Sections not listed here will use detectVizType() auto-detection.
 */
export const SECTION_VIZ: Record<string, VizType> = {
  // ── Score/Gauge sections ──────────────────────────────────────────────────
  healthScore: "score_gauge",
  operationalMaturity: "score_gauge",
  masteryDashboard: "score_gauge",
  growthVelocityScore: "score_gauge",
  leadershipReadiness: "score_gauge",
  marketDominanceIndex: "score_gauge",
  futureReadiness: "score_gauge",
  customerHealthDashboard: "score_gauge",
  brandHealthScore: "score_gauge",
  cultureHealthIndex: "score_gauge",
  innovationReadinessScore: "score_gauge",
  digitalMaturityScore: "score_gauge",
  dataMaturityAssessment: "score_gauge",
  vendorScorecard: "score_gauge",
  sustainabilityScorecard: "score_gauge",
  pivotReadiness: "score_gauge",
  onboardingEffectivenessScore: "score_gauge",
  engagementScoringModel: "score_gauge",
  platformEcosystemHealth: "score_gauge",
  aiAdoptionPotential: "score_gauge",
  esgReportingCompliance: "score_gauge",
  knowledgeAuditAssessment: "score_gauge",
  impactMeasurementDashboard: "score_gauge",
  aiReadinessScore: "score_gauge",
  devopsMaturity: "score_gauge",
  pmfAssessment: "score_gauge",
  productMarketFit: "score_gauge",
  benchmarkScore: "score_gauge",
  financialResilienceScore: "score_gauge",
  revenueQualityIndex: "score_gauge",
  adoptionScorecard: "score_gauge",
  allianceScorecard: "score_gauge",
  alignmentIndex: "score_gauge",
  fundingReadiness: "score_gauge",
  investmentReadinessGate: "score_gauge",
  defensibilityAudit: "score_gauge",
  launchReadiness: "score_gauge",
  marketplaceReadiness: "score_gauge",
  operatingLeverageIndex: "score_gauge",
  communityHealth: "score_gauge",

  // ── Ranked bars sections ──────────────────────────────────────────────────
  revenueLeakAnalysis: "ranked_bars",
  featurePrioritization: "ranked_bars",
  channelMixOptimization: "ranked_bars",
  topCustomerConcentrationRisk: "ranked_bars",
  techDebtQuantification: "ranked_bars",
  marketingChannelROI: "ranked_bars",
  skillGapAnalysis: "ranked_bars",
  costDriverAnalysis: "ranked_bars",
  vendorConsolidationMap: "ranked_bars",
  wasteIdentification: "ranked_bars",
  meetingCostAnalysis: "ranked_bars",
  contentROIAnalysis: "ranked_bars",
  partnerPerformanceMatrix: "ranked_bars",
  roleOptimizationAnalysis: "ranked_bars",
  spanOfControlOptimization: "ranked_bars",
  diversityMetricsAnalytics: "ranked_bars",
  contentMarketingRoi: "ranked_bars",
  eventRoi: "ranked_bars",
  paidMediaOptimization: "ranked_bars",
  revenueAttribution: "ranked_bars",
  marketingAttribution: "ranked_bars",
  revenueLeakageDetection: "ranked_bars",
  revenueLeakDetector: "ranked_bars",
  toolConsolidation: "ranked_bars",
  automationAudit: "ranked_bars",
  wasteReduction: "ranked_bars",
  insightsPrioritization: "ranked_bars",
  featureAdoption: "ranked_bars",
  mlUseCasePriority: "ranked_bars",
  mlUseCaseIdentification: "ranked_bars",
  aiRoiProjection: "ranked_bars",
  automationROIModeling: "ranked_bars",
  discountImpactAnalysis: "ranked_bars",
  workflowBenchmark: "ranked_bars",
  handoffEfficiency: "ranked_bars",
  growthLeverAssessment: "ranked_bars",
  talentGapAnalysis: "ranked_bars",
  skillsInventory: "ranked_bars",
  dataInfrastructureGapAnalysis: "ranked_bars",

  // ── Breakdown/Pie sections ────────────────────────────────────────────────
  revenueMixAnalysis: "breakdown_pie",
  expenseBreakdownAnalysis: "breakdown_pie",
  revenueConcentrationIndex: "breakdown_pie",
  customerSegmentProfitability: "breakdown_pie",
  timeAllocationAudit: "breakdown_pie",
  marketShareEstimation: "breakdown_pie",
  budgetAllocationOptimizer: "breakdown_pie",
  communityInvestmentStrategy: "breakdown_pie",
  costStructureAnalysis: "breakdown_pie",
  expenseManagement: "breakdown_pie",
  revenueStreamMap: "breakdown_pie",
  channelStrategy: "breakdown_pie",
  segmentProfitability: "breakdown_pie",
  resourceAllocationModel: "breakdown_pie",
  budgetPlanning: "breakdown_pie",
  usagePatternAnalysis: "breakdown_pie",

  // ── Time series sections ──────────────────────────────────────────────────
  cashIntelligence: "time_series",
  trendForecast: "time_series",
  scenarioModeling: "time_series",
  cashFlowForecaster: "time_series",
  seasonalityAnalysis: "time_series",
  revenuePredictionModeling: "time_series",
  demandForecastingEngine: "time_series",
  lifetimeValueModeling: "time_series",
  revenueForecast: "time_series",
  revenueForecasting: "time_series",
  salesForecasting: "time_series",
  scenarioPlanner: "time_series",
  fundingTimeline: "time_series",
  cashManagement: "time_series",
  revenueRunRate: "time_series",
  forecastAccuracyModel: "time_series",
  revenuePrediction: "time_series",
  churnPredictionModel: "time_series",
  priceElasticityModel: "time_series",
  dynamicPricingEngine: "time_series",
  profitDriverTree: "time_series",

  // ── Radar/Comparison sections ─────────────────────────────────────────────
  competitorAnalysis: "comparison_radar",
  benchmarkingEngine: "comparison_radar",
  competitorPricingIntel: "comparison_radar",
  competitorFeatureMatrix: "comparison_radar",
  marketEntryScoring: "comparison_radar",
  culturalAdaptationStrategy: "comparison_radar",
  complianceGapAnalysis: "comparison_radar",
  developerExperienceOptimization: "comparison_radar",
  competitiveWinLoss: "comparison_radar",
  competitiveMoat: "comparison_radar",
  competitorTracking: "comparison_radar",
  competitivePriceTracker: "comparison_radar",
  competitiveWargame: "comparison_radar",
  competitiveTimingModel: "comparison_radar",
  competitorMoveTracker: "comparison_radar",
  deiBenchmark: "comparison_radar",
  customerDnaProfile: "comparison_radar",
  swotAnalysis: "comparison_radar",
  businessModelCanvas: "comparison_radar",
  valueChainOptimization: "comparison_radar",

  // ── Matrix/Scatter sections ───────────────────────────────────────────────
  riskRegister: "matrix_scatter",
  issuesRegister: "matrix_scatter",
  opportunityRadar: "matrix_scatter",
  decisionBrief: "matrix_scatter",
  strategicInitiativeScoring: "matrix_scatter",
  innovationPipelineTracker: "matrix_scatter",
  predictiveMaintenanceModeling: "matrix_scatter",
  collaborationNetworkMapping: "matrix_scatter",
  innovationScoring: "matrix_scatter",
  strategicBetting: "matrix_scatter",
  ideaPipeline: "matrix_scatter",
  legalRiskRegister: "matrix_scatter",
  marketDisruptionModel: "matrix_scatter",
  firstMoverAnalysis: "matrix_scatter",
  emergingTechRadar: "matrix_scatter",
  marketSignalRadar: "matrix_scatter",
  industryConvergenceMap: "matrix_scatter",
  regulatoryHorizon: "matrix_scatter",
  stakeholderMapping: "matrix_scatter",
  propensityModel: "matrix_scatter",

  // ── Funnel sections ───────────────────────────────────────────────────────
  acquisitionFunnelIntelligence: "funnel",
  salesPipelineAnalysis: "funnel",
  recruitmentFunnel: "funnel",
  leadScoringAI: "funnel",
  pipelineManagement: "funnel",
  activationFunnel: "funnel",
  conversionOptimization: "funnel",
  userActivation: "funnel",
  freeTrialConversion: "funnel",
  dealVelocity: "funnel",
  quoteToCloseAnalysis: "funnel",

  // ── Waterfall sections ────────────────────────────────────────────────────
  marginAnalysis: "waterfall",
  unitEconomicsBreakdown: "waterfall",
  profitBridgeAnalysis: "waterfall",
  greenOperationsOptimization: "waterfall",
  unitEconomics: "waterfall",
  grossMarginAnalysis: "waterfall",
  breakEvenModel: "waterfall",
  cashOptimization: "waterfall",
  workingCapitalOptimizer: "waterfall",
};

/**
 * Auto-detect the best visualization type by inspecting the data shape.
 * Used as fallback for sections not in SECTION_VIZ.
 */
export function detectVizType(data: Record<string, unknown>): VizType {
  if (!data || typeof data !== "object") return "table_only";

  const keys = Object.keys(data);
  const keyStr = keys.join(" ").toLowerCase();

  // Score-like: has score/grade fields at top level
  if (
    ("score" in data || "overallScore" in data || "grade" in data || "readinessScore" in data) &&
    typeof (data.score ?? data.overallScore ?? data.readinessScore) === "number"
  ) {
    return "score_gauge";
  }

  // Funnel-like: has stages/steps with sequential values
  if ("stages" in data && Array.isArray(data.stages)) return "funnel";
  if ("steps" in data && Array.isArray(data.steps)) return "funnel";

  // Time-series: has forecast/projection arrays with period/month/year fields
  if ("forecast" in data && Array.isArray(data.forecast)) return "time_series";
  if ("projections" in data && Array.isArray(data.projections)) return "time_series";
  if ("timeline" in data && Array.isArray(data.timeline)) return "time_series";
  if ("periods" in data && Array.isArray(data.periods)) return "time_series";
  if ("months" in data && Array.isArray(data.months)) return "time_series";

  // Items with ranked values -> bars, matrix, or pie
  if ("items" in data && Array.isArray(data.items) && data.items.length > 0) {
    const first = data.items[0] as Record<string, unknown>;
    if (first && typeof first === "object") {
      const fKeys = Object.keys(first).join(" ").toLowerCase();
      // Ranked items with severity/impact/priority -> matrix
      if (fKeys.includes("severity") || fKeys.includes("priority") || fKeys.includes("impact")) {
        return "matrix_scatter";
      }
      // Items with amounts/values -> ranked bars
      if (fKeys.includes("amount") || fKeys.includes("value") || fKeys.includes("revenue") || fKeys.includes("cost")) {
        return "ranked_bars";
      }
      // Items with percentages/share -> pie
      if (fKeys.includes("percentage") || fKeys.includes("share") || fKeys.includes("allocation")) {
        return "breakdown_pie";
      }
    }
    return "ranked_bars"; // default for items arrays
  }

  // Dimensions/categories arrays -> radar
  if ("dimensions" in data && Array.isArray(data.dimensions)) return "comparison_radar";
  if ("categories" in data && Array.isArray(data.categories)) return "comparison_radar";

  // Breakdown-like: has top-level objects that look like allocation
  if (keyStr.includes("breakdown") || keyStr.includes("allocation") || keyStr.includes("distribution")) {
    return "breakdown_pie";
  }

  // Default
  return "table_only";
}
