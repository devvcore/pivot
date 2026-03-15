/**
 * ARIA — Adaptive Revenue Intelligence Advisor
 *
 * Pivot's business intelligence AI agent. Powered by Gemini Flash.
 *
 * Architecture (token-efficient):
 * - Loads ~600-word AgentMemory summary (not full report) at conversation start
 * - Has 3 tools: web_search, get_report_section, analyze_website
 * - Client maintains conversation history; server is stateless per request
 * - Trims to last 16 messages to bound token usage
 *
 * Personality:
 * - Strict, matter-of-fact, data-driven
 * - Compassionate about the owner's position
 * - Affirms that joining Pivot was the right move
 * - Never sugarcoats; always gives next steps
 */
import { GoogleGenAI } from "@google/genai";
import { getAgentMemory } from "./memory";
import { analyzeWebsite } from "./website-analyzer";
import { findRoute, findRouteById } from "./page-routes";
import { getJob, listJobs } from "@/lib/job-store";
import { collectIntegrationContext, formatIntegrationContextAsText } from "@/lib/integrations/collect";
import { LoopGuard, closestToolName, smartTruncate } from "./agent-guardrails";
import type { ChatMessage, AgentMemory, MVPDeliverables } from "@/lib/types";

const FLASH_MODEL = "gemini-2.5-flash";
const MAX_HISTORY_MESSAGES = 16;
const AVAILABLE_TOOL_NAMES = ["search_web", "get_report_section", "analyze_website", "generate_projection", "navigate_to_page", "get_integration_data"];

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_web",
    description:
      "Search the web for current market data, competitor information, industry benchmarks, or business intelligence. Use when the user asks about markets, trends, competitors, or when you need current external data.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query — be specific about industry/geography/topic",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_report_section",
    description:
      "Retrieve detailed data from a specific section of the business intelligence report. Use when the user asks for specifics you don't have in your memory summary.",
    parameters: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: [
            "healthScore",
            "cashIntelligence",
            "revenueLeakAnalysis",
            "issuesRegister",
            "atRiskCustomers",
            "decisionBrief",
            "actionPlan",
            "marketIntelligence",
            "websiteAnalysis",
            "competitorAnalysis",
            "techOptimization",
            "pricingIntelligence",
            "marketingStrategy",
            "pitchDeckAnalysis",
            "terminology",
            "kpiReport",
            "roadmap",
            "healthChecklist",
            "leadReport",
            "swotAnalysis",
            "unitEconomics",
            "customerSegmentation",
            "competitiveWinLoss",
            "investorOnePager",
            "hiringPlan",
            "revenueForecast",
            "churnPlaybook",
            "salesPlaybook",
            "goalTracker",
            "benchmarkScore",
            "executiveSummary",
            "milestoneTracker",
            "riskRegister",
            "partnershipOpportunities",
            "fundingReadiness",
            "marketSizing",
            "scenarioPlanner",
            "operationalEfficiency",
            "clvAnalysis",
            "retentionPlaybook",
            "revenueAttribution",
            "boardDeck",
            "competitiveMoat",
            "gtmScorecard",
            "cashOptimization",
            "talentGapAnalysis",
            "revenueDiversification",
            "customerJourneyMap",
            "complianceChecklist",
            "expansionPlaybook",
            "vendorScorecard",
            "productMarketFit",
            "brandHealth",
            "pricingElasticity",
            "strategicInitiatives",
            "cashConversionCycle",
            "innovationPipeline",
            "stakeholderMap",
            "decisionLog",
            "cultureAssessment",
            "ipPortfolio",
            "exitReadiness",
            "sustainabilityScore",
            "acquisitionTargets",
            "financialRatios",
            "channelMixModel",
            "supplyChainRisk",
            "regulatoryLandscape",
            "crisisPlaybook",
            "aiReadiness",
            "networkEffects",
            "dataMonetization",
            "subscriptionMetrics",
            "marketTiming",
            "scenarioStressTest",
            "pricingStrategyMatrix", "customerHealthScore", "revenueWaterfall", "techDebtAssessment", "teamPerformance", "marketEntryStrategy",
            "competitiveIntelFeed", "cashFlowSensitivity", "digitalMaturity", "acquisitionFunnel", "strategicAlignment", "budgetOptimizer",
            "revenueDrivers", "marginOptimization", "demandForecasting", "cohortAnalysis", "winLossAnalysis", "salesForecast",
            "processEfficiency", "vendorRisk", "qualityMetrics", "capacityPlanning", "knowledgeManagement", "complianceScorecard",
            "marketPenetration", "flywheelAnalysis", "partnershipsStrategy", "internationalExpansion", "rdEffectiveness", "brandEquity",
            "workingCapital", "debtStrategy", "taxStrategy", "investorReadiness", "maReadiness", "strategicRoadmap",
            "customerVoice", "referralEngine", "priceSensitivityIndex", "customerEffortScore", "accountExpansionMap", "loyaltyProgramDesign",
            "competitivePricingMatrix", "marketSentimentIndex", "disruptionRadar", "ecosystemMap", "categoryCreation", "marketVelocity",
            "okrCascade", "meetingEffectiveness", "communicationAudit", "decisionVelocity", "resourceOptimizer", "changeManagement",
            "cashReserveStrategy", "revenueQualityScore", "costIntelligence", "financialModeling", "profitabilityMap", "capitalAllocation",
            "salesPipelineHealth", "dealVelocity", "winRateOptimizer", "salesEnablement", "territoryPlanning", "quotaIntelligence",
            "featurePrioritization", "productUsageAnalytics", "techStackAudit", "apiStrategy", "platformScalability", "userOnboarding",
            "employeeEngagement", "talentAcquisitionFunnel", "compensationBenchmark", "successionPlanning", "diversityMetrics", "employerBrand",
            "dataGovernance", "analyticsMaturity", "customerDataPlatform", "predictiveModeling", "reportingFramework", "dataQualityScore",
            "supplyChainRisk", "inventoryOptimization", "vendorScorecard", "operationalEfficiency", "qualityManagement", "capacityPlanning",
            "customerJourneyMap", "npsAnalysis", "supportTicketIntelligence", "customerHealthScore", "voiceOfCustomer", "customerSegmentation",
            "innovationPipeline", "ipPortfolio", "rdEfficiency", "technologyReadiness", "partnershipEcosystem", "mergersAcquisitions",
            "esgScorecard", "carbonFootprint", "regulatoryCompliance", "businessContinuity", "ethicsFramework", "socialImpact",
            "dealPipeline", "salesForecasting", "accountBasedMarketing", "salesEnablement", "revenueAttribution", "commissionOptimization",
            "productMarketFit", "featurePrioritization", "userOnboarding", "productAnalytics", "marketTiming", "competitiveResponse",
            "scenarioPlanning", "capitalStructure", "workingCapital", "taxStrategy", "fundraisingReadiness", "exitStrategy",
            "talentAcquisition", "employeeEngagement", "compensationBenchmark", "successionPlanning", "diversityInclusion", "cultureAssessment",
            "marketEntryPlaybook", "partnerChannelStrategy", "acquisitionIntegration", "internationalReadiness", "revenueModelAnalysis", "growthExperiments",
            "customerAcquisitionCost", "lifetimeValueOptimization", "churnPrediction", "netRevenueRetention", "customerAdvocacy", "feedbackLoop",
            "processAutomation", "costBenchmark", "vendorNegotiation", "scalabilityAssessment", "incidentReadiness", "operationalRisk",
            "dataStrategy", "aiUseCases", "analyticsRoadmap", "dataPrivacy", "mlOpsReadiness", "digitalTransformation",
            "revenueOps", "billingOptimization", "contractIntelligence", "commissionTracking", "revenueRecognition", "subscriptionHealth",
            "productRoadmapHealth", "techDebtPrioritization", "releaseVelocity", "bugTrendAnalysis", "apiPerformance", "userExperienceScore",
            "workforcePlanning", "skillsGapAnalysis", "remoteWorkEffectiveness", "teamVelocity", "burnoutRisk", "learningDevelopment",
            "regulatoryRisk", "contractManagement", "ipStrategy", "legalSpendAnalysis", "policyCompliance", "auditReadiness",
            "salesMethodology", "pipelineVelocity", "dealQualification", "salesCoaching", "accountPlanning", "competitiveBattlecards",
            "cashBurnAnalysis", "revenuePerEmployee", "financialBenchmarking", "investmentPortfolio", "costAllocationModel", "marginWaterfall",
            "customerOnboardingMetrics", "healthScoreModel", "csExpansionPlaybook", "renewalForecasting", "csOperations", "customerMilestones",
            "okrFramework", "strategicPillars", "competitivePositioning", "marketShareAnalysis", "growthCorridors", "valuePropCanvas",
            "competitiveMonitoring", "marketTrendRadar", "industryBenchmarkIndex", "customerIntelPlatform", "priceSensitivityModel", "demandSignalAnalysis",
            "digitalMaturityIndex", "cloudMigrationReadiness", "automationRoi", "digitalWorkplace", "cybersecurityPosture", "techVendorConsolidation",
            "revenueSourceMapping", "channelMixOptimization", "crossSellEngine", "priceOptimizationModel", "promotionEffectiveness", "revenueHealthIndex",
            "organizationalNetwork", "decisionEfficiency", "meetingEfficiency", "knowledgeCapital", "changeManagementScore", "cultureAlignment",
            "partnerPerformance", "ecosystemMapping", "allianceStrategy", "channelPartnerHealth", "coSellingPipeline", "integrationMarketplace",
            "brandEquityIndex", "sentimentDashboard", "mediaShareOfVoice", "crisisCommsReadiness", "thoughtLeadership", "brandConsistency",
            "monetizationModel", "freeTrialConversion", "usageBasedPricing", "bundleOptimization", "discountDiscipline", "revenueLeakageDetection",
            "customerAcademy", "contentEngagement", "communityHealth", "certificationProgram", "selfServiceAdoption", "supportDeflection",
            "investorDeck", "fundingTimeline", "valuationModel", "capTableManagement", "investorCommunication", "boardReporting",
            "geoExpansionStrategy", "localMarketEntry", "marketRegulations", "partnerLocalization", "culturalAdaptation", "expansionRoi",
            "productLedMetrics", "activationFunnel", "featureAdoption", "virality", "productQualifiedLeads", "timeToValue",
            "aiReadinessScore", "mlUseCasePriority", "dataInfrastructure", "aiTalentGap", "ethicalAiFramework", "aiRoiProjection",
            "advocacyProgram", "referralMechanism", "testimonialPipeline", "caseStudyFactory", "customerAdvisoryBoard", "npsActionPlan",
            "procurementEfficiency", "expenseManagement", "invoiceAutomation", "paymentOptimization", "financialControls", "treasuryManagement",
            "demandGenEngine", "contentMarketingRoi", "seoStrategy", "paidMediaOptimization", "eventRoi", "influencerStrategy",
            "platformEconomics", "developerExperience", "apiMonetization", "marketplaceStrategy", "platformGovernance", "platformNetworkDynamics",
            "contractLifecycle", "complianceAutomation", "legalRiskRegister", "intellectualPropertyAudit", "regulatoryCalendar", "privacyCompliance",
            "dataWarehouseStrategy", "biDashboardDesign", "predictiveModelCatalog", "dataLineageMap", "metricsDictionary", "analyticsGovernance",
            "employeeJourney", "workplaceWellness", "learningPathways", "performanceFramework", "payEquityAnalysis", "deiBenchmark",
            "businessModelCanvas", "revenueModelDesign", "valueChainOptimization", "costStructureAnalysis", "partnershipModel", "growthLeverAssessment",
            "vendorManagement", "supplyChainVisibility", "sustainableSourcing", "facilityOptimization", "fleetManagement", "customerSuccess",
            "crisisManagement", "operationalResilience", "stakeholderMapping", "digitalPresence", "channelStrategy", "accountManagement",
            "fundraisingStrategy", "captableManagement", "exitPlanning", "boardGovernance", "recruitmentFunnel", "employerBranding",
            "teamTopology", "onboardingOptimization", "meetingCulture", "documentManagement", "workflowAutomation", "qualityAssurance",
            "incidentResponse", "accessControl", "auditTrail", "penetrationTesting", "securityAwareness", "dataClassification",
            "apiDesign", "microservicesArchitecture", "cloudOptimization", "devopsMaturity", "systemMonitoring", "codeQuality",
            "customerLifetimeValue", "sentimentAnalysis", "supportTicketAnalysis", "segmentProfitability", "referralAnalytics", "customerHealthDashboard",
            "innovationPortfolio", "contingencyPlanning", "operatingRhythm", "crossFunctionalSync", "wardRoomStrategy", "revenueIntelligence",
            "marketResearch", "competitorTracking", "industryTrends", "socialListening", "uxResearch", "webAnalytics",
            "emailMarketing", "conversionOptimization", "abTestingFramework", "marketingAttribution", "contentCalendar", "socialMediaCalendar",
            "budgetPlanning", "revenueForecasting", "cashManagement", "creditManagement", "debtStructure", "financialReporting",
            "carbonReduction", "circularEconomy", "communityImpact", "waterManagement", "wasteReduction", "sustainableInnovation",
            "talentPipeline", "leadershipDevelopment", "successionReadiness", "compensationStrategy", "workforceAnalytics", "orgEffectiveness",
            "salesMotionDesign", "dealAnalytics", "territoryOptimization", "salesCompensation", "revenuePrediction", "accountPenetration",
            "productVision", "featureRoadmap", "pmfAssessment", "userActivation", "productInsights", "releaseStrategy",
            "brandPositionMap", "brandValuation", "brandHierarchy", "reputationAnalysis", "messagingFramework", "visualBranding",
            "growthPlaybook", "revenueRunRate", "breakEvenModel", "operatingLeverageIndex", "grossMarginAnalysis", "fundingScenarioModel",
            "competitiveWargame", "marketDisruptionModel", "firstMoverAnalysis", "defensibilityAudit", "pivotReadiness", "competitiveTimingModel",
            "customerMaturityModel", "expansionSignals", "adoptionScorecard", "stakeholderSentiment", "valueRealization", "renewalPlaybook",
            "businessModelInnovation", "monetizationExperiment", "pricingArchitecture", "revenueStreamMap", "costDriverAnalysis", "valueCapture",
            "revenueProcessMap", "billingHealthCheck", "quoteToCloseAnalysis", "revenueLeakDetector", "forecastAccuracyModel", "dealDeskOptimization",
            "talentMarketIntel", "employeeLifecycleMap", "skillsInventory", "teamDynamicsAnalysis", "hybridWorkModel", "compensationPhilosophy",
            "dataMaturityAssessment", "insightsPrioritization", "experimentVelocity", "decisionIntelligence", "feedbackIntelligence", "benchmarkingEngine",
            "partnerValueMap", "coInnovationPipeline", "ecosystemRevenue", "allianceScorecard", "partnerEnablementPlan", "marketplaceReadiness",
            "strategyExecution", "initiativeTracking", "resourceAllocationModel", "strategicBetting", "executionCadence", "alignmentIndex",
            "marketSignalRadar", "competitorMoveTracker", "customerVoiceAggregator", "industryConvergenceMap", "emergingTechRadar", "regulatoryHorizon",
            "cashFlowForecaster", "profitDriverTree", "revenueQualityIndex", "financialResilienceScore", "workingCapitalOptimizer", "investmentReadinessGate",
            "customerDnaProfile", "propensityModel", "churnEarlyWarning", "customerEffortOptimizer", "loyaltyDriver", "accountIntelligence",
            "gtmCalendar", "launchReadiness", "messageTesting", "salesCollateral", "demandGenPlan", "channelActivation",
            "priceElasticityModel", "dynamicPricingEngine", "discountImpactAnalysis", "bundleDesigner", "competitivePriceTracker", "pricingExperiment",
            "kpiWatchlist", "alertFramework", "anomalyDetection", "trendForecast", "dashboardDesign", "insightsCatalog",
            "ideaPipeline", "innovationScoring", "experimentBoard", "patentAnalysis", "disruptionPlaybook", "futureProofing",
            "revenueMixAnalysis", "accountGrowthPlan", "contractOptimizer", "usagePatternAnalysis", "churnRecoveryPlan", "winbackProgram",
            "automationAudit", "processDigitization", "botDeploymentPlan", "workflowBenchmark", "handoffEfficiency", "toolConsolidation",
            "crisisCommunication", "internalComms", "investorNarrative", "pressStrategy", "thoughtLeadershipPlan", "brandStoryArc",
            "masteryDashboard", "growthVelocityScore", "operationalMaturity", "leadershipReadiness", "marketDominanceIndex", "futureReadiness",
            "aiAdoptionPotential", "mlUseCaseIdentification", "dataInfrastructureGapAnalysis", "automationROIModeling", "aiTalentNeedsAssessment", "ethicalAIFramework",
            "marketEntryScoring", "regulatoryLandscapeMapping", "culturalAdaptationStrategy", "logisticsExpansionAnalysis", "localPartnershipStrategy", "internationalPricingOptimization",
            "acquisitionFunnelIntelligence", "onboardingEffectivenessScore", "engagementScoringModel", "expansionRevenueOpportunities", "advocacyProgramDesign", "lifetimeValueModeling",
            "apiMonetizationStrategy", "platformEcosystemHealth", "developerExperienceOptimization", "integrationMarketplaceAnalytics", "partnerEnablementProgram", "platformGovernanceFramework",
            "demandForecastingEngine", "predictiveMaintenanceModeling", "churnPredictionModel", "leadScoringAI", "inventoryOptimizationAI", "revenuePredictionModeling",
            "orgStructureAnalysis", "spanOfControlOptimization", "decisionRightsMapping", "collaborationNetworkMapping", "roleOptimizationAnalysis", "successionPlanningFramework",
            "impactMeasurementDashboard", "esgReportingCompliance", "stakeholderEngagementAnalytics", "communityInvestmentStrategy", "diversityMetricsAnalytics", "greenOperationsOptimization",
            "knowledgeAuditAssessment", "expertiseMappingSystem", "documentationStrategyFramework", "learningPathwaysDesign", "institutionalMemoryProtection", "knowledgeTransferOptimization",
            "toolsAutomationPlan",
          ],
          description: "Which section of the report to retrieve",
        },
        runId: {
          type: "string",
          description: "The run ID of the report (optional — uses most recent if not specified)",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "analyze_website",
    description:
      "Analyze a business website for marketing effectiveness, offer clarity, and conversion optimization. Returns a grade (A-F), specific issues, and actionable recommendations.",
    parameters: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The full URL of the website to analyze",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_projection",
    description:
      "Generate a what-if financial projection based on the business report data. Returns structured data points that render as an interactive chart. Use when the user asks about future scenarios, impact of fixing issues, or 'what would happen if...' questions.",
    parameters: {
      type: "object" as const,
      properties: {
        projectionType: {
          type: "string",
          enum: ["cash_forecast", "revenue_recovery", "customer_churn", "growth_scenario"],
          description: "Type of projection to generate",
        },
        timeframeMonths: {
          type: "number",
          description: "Number of months to project (1-24)",
        },
        scenario: {
          type: "string",
          description: "Description of the scenario to model (e.g. 'fix top 3 revenue leaks', 'lose highest-risk customer')",
        },
      },
      required: ["projectionType", "timeframeMonths", "scenario"],
    },
  },
  {
    name: "navigate_to_page",
    description:
      "Navigate the user to a specific page or section in the Pivot analysis. Use this when the user asks to see something, go somewhere, view a specific report section, or when showing them relevant data would help. Examples: 'show me revenue leaks', 'take me to issues', 'where is my health score', 'go to marketing'.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What the user wants to see or navigate to",
        },
        routeId: {
          type: "string",
          description: "The specific route ID to navigate to, if known (e.g. 'health-score', 'revenue-leaks', 'financial', 'customers', 'market', 'growth', 'marketing', 'operations', 'risk')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_integration_data",
    description:
      "Retrieve live data from connected business tools (Slack, Gmail, QuickBooks, Stripe, Salesforce, HubSpot, GitHub, Jira, etc.). Use when the user asks about their connected tools, real-time metrics from integrations, or when you need actual data from their business apps.",
    parameters: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          description: "Filter by provider (e.g. 'slack', 'quickbooks', 'stripe'). Leave empty for all providers.",
        },
        recordType: {
          type: "string",
          description: "Filter by record type (e.g. 'channels', 'financial_summary', 'revenue'). Leave empty for all types.",
        },
      },
      required: [],
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string
): Promise<string> {
  if (toolName === "search_web") {
    // Use Gemini's own knowledge for web-like queries (real grounding requires separate model call)
    return `[Web Search] Query: "${args.query}" — Search results would appear here. For now, drawing on training knowledge for this query.`;
  }

  if (toolName === "get_report_section") {
    const section = args.section as string;
    const runId = args.runId as string | undefined;

    // Find the job
    let job;
    if (runId) {
      job = await getJob(runId);
    } else {
      // Get most recent completed job for this org
      const allJobs = await listJobs();
      job = allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed")
        ?? allJobs.find((j) => j.status === "completed");
    }

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    const json = JSON.stringify(sectionData, null, 2);
    return `[Report Section: ${section}]\n${smartTruncate(json, 3000)}`;
  }

  if (toolName === "analyze_website") {
    const url = args.url as string;
    try {
      const analysis = await analyzeWebsite(url);
      return `[Website Analysis: ${url}]
Grade: ${analysis.grade} (${analysis.score}/100)
Synopsis: ${analysis.synopsis}
Actual Offer: ${analysis.actualOffer}
Offer Gap: ${analysis.offerGap}
Top Issues: ${analysis.topIssues.join("; ")}
Recommendations: ${analysis.recommendations.join("; ")}
Suggested Headline: "${analysis.suggestedHeadline}"
Marketing Direction: ${analysis.marketingDirection}
CTA Assessment: ${analysis.ctaAssessment}`;
    } catch (e) {
      return `Website analysis failed: ${String(e)}`;
    }
  }

  if (toolName === "generate_projection") {
    const projectionType = args.projectionType as string;
    const timeframeMonths = Math.min(Math.max(Number(args.timeframeMonths ?? 12), 1), 24);
    const scenario = args.scenario as string;

    // Load report data for context
    const allJobs = await listJobs();
    const job = allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed")
      ?? allJobs.find((j) => j.status === "completed");

    if (!job?.deliverables) return `No completed report found for projection.`;

    const d = job.deliverables as MVPDeliverables;
    const contextParts: string[] = [];

    if (projectionType === "cash_forecast" || projectionType === "growth_scenario") {
      contextParts.push(`Cash Intelligence: ${JSON.stringify({
        currentCash: (d.cashIntelligence as any).currentCashPosition ?? 0,
        runway: (d.cashIntelligence as any).runwayWeeks ?? 0,
        risks: d.cashIntelligence.risks?.slice(0, 3),
      })}`);
    }
    if (projectionType === "revenue_recovery" || projectionType === "growth_scenario") {
      contextParts.push(`Revenue Leaks: ${JSON.stringify({
        total: d.revenueLeakAnalysis.totalIdentified,
        items: d.revenueLeakAnalysis.items?.slice(0, 5).map(i => ({ desc: i.description, amount: i.amount })),
      })}`);
    }
    if (projectionType === "customer_churn") {
      contextParts.push(`At-Risk Customers: ${JSON.stringify({
        customers: d.atRiskCustomers.customers?.slice(0, 5).map(c => ({ name: c.name, revenue: c.revenueAtRisk, risk: c.risk })),
      })}`);
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return "Projection unavailable — API key not configured.";

      const genai = new GoogleGenAI({ apiKey });
      const projResp = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{ text: `Generate a ${timeframeMonths}-month financial projection.
Type: ${projectionType}
Scenario: ${scenario}

Business data:
${contextParts.join("\n")}

Return ONLY valid JSON with this structure:
{
  "title": "Chart title",
  "subtitle": "Brief scenario description",
  "dataPoints": [
    { "month": "Mon YYYY", "baseline": <number>, "projected": <number> }
  ],
  "insight": "One sentence key insight",
  "totalImpact": "Dollar impact summary"
}

Rules:
- Generate one data point per month for ${timeframeMonths} months starting from the current month
- baseline = what happens if nothing changes
- projected = what happens under the scenario
- Use realistic numbers grounded in the business data provided
- All monetary values in raw numbers (not formatted strings)` }],
        }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        } as Record<string, unknown>,
      });

      const text = projResp.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return `Projection generation failed — could not parse response.`;

      const projection = JSON.parse(jsonMatch[0]);

      // Build enhanced projection with chartData and metrics for rich chart rendering
      const chartData = (projection.dataPoints ?? []).map((dp: any) => ({
        period: dp.month,
        baseline: dp.baseline,
        projected: dp.projected,
      }));

      const firstPoint = projection.dataPoints?.[0];
      const lastPoint = projection.dataPoints?.[projection.dataPoints.length - 1];
      const currentValue = firstPoint?.baseline ?? 0;
      const projectedValue = lastPoint?.projected ?? 0;
      const changePercent = currentValue > 0
        ? Math.round(((projectedValue - currentValue) / currentValue) * 100)
        : 0;

      const enhanced = {
        ...projection,
        chartData,
        metrics: {
          currentValue,
          projectedValue,
          changePercent,
          timeframe: `${timeframeMonths} months`,
        },
      };

      return `[Projection Generated]\n${projection.insight}\n${projection.totalImpact}\n\n<!--PROJECTION:${JSON.stringify(enhanced)}-->`;
    } catch (e) {
      return `Projection generation failed: ${String(e)}`;
    }
  }

  if (toolName === "navigate_to_page") {
    const query = args.query as string;
    const routeId = args.routeId as string | undefined;

    const route = routeId ? findRouteById(routeId) : findRoute(query);
    if (!route) {
      return `No matching page found for "${query}". Available sections: Health Score, Cash Intelligence, Revenue Leaks, Issues, At-Risk Clients, Decision Brief, Action Plan, Financial Intelligence, Customers & Revenue, Market & Competition, Growth & Strategy, Marketing & Brand, Operations & Team, Risk & Compliance.`;
    }

    return `<!--NAVIGATE:${JSON.stringify(route)}-->\nNavigating to ${route.label}: ${route.description}`;
  }

  if (toolName === "get_integration_data") {
    const provider = args.provider as string | undefined;
    const recordType = args.recordType as string | undefined;

    try {
      const ctx = await collectIntegrationContext(orgId);
      if (ctx.records.length === 0) {
        return "No integration data available. The business has not connected any tools yet. Suggest connecting Slack, QuickBooks, Stripe, or other tools from the Upload page for richer analysis.";
      }

      let filtered = ctx.records;
      if (provider) filtered = filtered.filter((r) => r.provider === provider);
      if (recordType) filtered = filtered.filter((r) => r.recordType === recordType);

      if (filtered.length === 0) {
        return `No data found for ${provider ? `provider "${provider}"` : ""}${recordType ? ` record type "${recordType}"` : ""}. Connected providers: ${ctx.providers.join(", ")}`;
      }

      const result = filtered.map((r) => ({
        provider: r.provider,
        type: r.recordType,
        syncedAt: r.syncedAt,
        data: typeof r.data === 'string' ? r.data.slice(0, 1500) : JSON.stringify(r.data).slice(0, 1500),
      }));

      return `[Integration Data — ${filtered.length} records from ${ctx.providers.join(", ")}]\n${JSON.stringify(result, null, 2)}`;
    } catch (e) {
      return `Failed to retrieve integration data: ${String(e)}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  // Preserve <!--PROJECTION:...--> and <!--NAVIGATE:...--> markers by temporarily replacing them
  const markers: string[] = [];
  let cleaned = text.replace(/<!--(PROJECTION|NAVIGATE):[\s\S]*?-->/g, (match) => {
    markers.push(match);
    return `__MARKER_${markers.length - 1}__`;
  });

  cleaned = cleaned
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")   // em dash
    .replace(/\u2013/g, " - ")   // en dash
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();

  // Restore markers
  markers.forEach((marker, i) => {
    cleaned = cleaned.replace(`__MARKER_${i}__`, marker);
  });

  return cleaned;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(memory: AgentMemory): string {
  return `You are Pivvy, Pivot's AI business advisor.

You are the thinking partner this business owner never had. You are strict, matter-of-fact, and data-driven. You tell people what they need to hear, not what they want to hear. At the same time, you are deeply understanding of the pressure, stress, and uncertainty that comes with running a business. You are compassionate, but never soft.

When first engaging with this client, acknowledge: joining Pivot was the right move, and with the right data and decisions, things can absolutely get back on track. Then get to work.

STYLE RULES:
- Lead with numbers, not feelings
- Give specific next steps, not vague advice
- Reference the actual business data in your memory
- When you don't know something, use your tools, don't guess
- Keep responses focused and actionable (not long essays)
- Use bullet points and structure when listing actions
- Do NOT use em dashes, en dashes, double dashes, or asterisks. Use plain text only.

YOUR TOOLS:
- search_web(query): Search for current market data, competitors, benchmarks
- get_report_section(section): Get full details from the intelligence report
- analyze_website(url): Grade and analyze any website for marketing effectiveness
- generate_projection(projectionType, timeframeMonths, scenario): Create what-if financial projections that render as interactive charts. Use for cash forecasts, revenue recovery modeling, customer churn impact, or growth scenarios.
- navigate_to_page(query, routeId?): Navigate the user to a specific page or section in the analysis. Use when they say "show me", "take me to", "go to", "where is", or ask to see specific data. Available pages: health-score, cash-intelligence, revenue-leaks, issues, at-risk-clients, decision-brief, action-plan, financial, customers, market, growth, marketing, operations, risk.

AVAILABLE REPORT SECTIONS (for get_report_section):
Core: healthScore, cashIntelligence, revenueLeakAnalysis, issuesRegister, atRiskCustomers, decisionBrief, actionPlan
Market: marketIntelligence, competitorAnalysis, pricingIntelligence, websiteAnalysis, marketingStrategy, marketSizing, partnershipOpportunities
Analysis: pitchDeckAnalysis, techOptimization, terminology, kpiReport, roadmap, healthChecklist, leadReport, clvAnalysis, revenueAttribution
Strategy: swotAnalysis, unitEconomics, customerSegmentation, competitiveWinLoss, investorOnePager, competitiveMoat, scenarioPlanner, fundingReadiness
Operations: hiringPlan, revenueForecast, churnPlaybook, salesPlaybook, goalTracker, benchmarkScore, executiveSummary, milestoneTracker, riskRegister, operationalEfficiency
Growth: retentionPlaybook, boardDeck, gtmScorecard, cashOptimization
Wave 6: talentGapAnalysis, revenueDiversification, customerJourneyMap, complianceChecklist, expansionPlaybook, vendorScorecard
Wave 7: productMarketFit, brandHealth, pricingElasticity, strategicInitiatives, cashConversionCycle, innovationPipeline
Wave 8: stakeholderMap, decisionLog, cultureAssessment, ipPortfolio, exitReadiness, sustainabilityScore
Wave 9: acquisitionTargets, financialRatios, channelMixModel, supplyChainRisk, regulatoryLandscape, crisisPlaybook
Wave 10: aiReadiness, networkEffects, dataMonetization, subscriptionMetrics, marketTiming, scenarioStressTest
Wave 11: pricingStrategyMatrix, customerHealthScore, revenueWaterfall, techDebtAssessment, teamPerformance, marketEntryStrategy
Wave 12: competitiveIntelFeed, cashFlowSensitivity, digitalMaturity, acquisitionFunnel, strategicAlignment, budgetOptimizer
Wave 13: revenueDrivers, marginOptimization, demandForecasting, cohortAnalysis, winLossAnalysis, salesForecast
Wave 14: processEfficiency, vendorRisk, qualityMetrics, capacityPlanning, knowledgeManagement, complianceScorecard
Wave 15: marketPenetration, flywheelAnalysis, partnershipsStrategy, internationalExpansion, rdEffectiveness, brandEquity
Wave 16: workingCapital, debtStrategy, taxStrategy, investorReadiness, maReadiness, strategicRoadmap
Wave 17: customerVoice, referralEngine, priceSensitivityIndex, customerEffortScore, accountExpansionMap, loyaltyProgramDesign
Wave 18: competitivePricingMatrix, marketSentimentIndex, disruptionRadar, ecosystemMap, categoryCreation, marketVelocity
Wave 19: okrCascade, meetingEffectiveness, communicationAudit, decisionVelocity, resourceOptimizer, changeManagement
Wave 20: cashReserveStrategy, revenueQualityScore, costIntelligence, financialModeling, profitabilityMap, capitalAllocation
Wave 21: salesPipelineHealth, dealVelocity, winRateOptimizer, salesEnablement, territoryPlanning, quotaIntelligence
Wave 22: featurePrioritization, productUsageAnalytics, techStackAudit, apiStrategy, platformScalability, userOnboarding
Wave 23: employeeEngagement, talentAcquisitionFunnel, compensationBenchmark, successionPlanning, diversityMetrics, employerBrand
Wave 24: dataGovernance, analyticsMaturity, customerDataPlatform, predictiveModeling, reportingFramework, dataQualityScore
- Wave 25 (Supply Chain & Operations): supplyChainRisk, inventoryOptimization, vendorScorecard, operationalEfficiency, qualityManagement, capacityPlanning
- Wave 26 (Customer Experience & Journey): customerJourneyMap, npsAnalysis, supportTicketIntelligence, customerHealthScore, voiceOfCustomer, customerSegmentation
- Wave 27 (Innovation & IP): innovationPipeline, ipPortfolio, rdEfficiency, technologyReadiness, partnershipEcosystem, mergersAcquisitions
- Wave 28 (Sustainability & Governance): esgScorecard, carbonFootprint, regulatoryCompliance, businessContinuity, ethicsFramework, socialImpact
- Wave 29 (Sales Intelligence): dealPipeline (deal pipeline analytics), salesForecasting (AI sales forecasts), accountBasedMarketing (ABM strategy), salesEnablement (enablement assets), revenueAttribution (channel attribution), commissionOptimization (incentive plans)
- Wave 30 (Product Strategy): productMarketFit (PMF assessment), featurePrioritization (RICE scoring), userOnboarding (funnel analysis), productAnalytics (usage metrics), marketTiming (market windows), competitiveResponse (response playbook)
- Wave 31 (Financial Strategy): scenarioPlanning (financial scenarios), capitalStructure (capital optimization), workingCapital (cash conversion), taxStrategy (tax optimization), fundraisingReadiness (round readiness), exitStrategy (exit planning)
- Wave 32 (People & Culture): talentAcquisition (hiring strategy), employeeEngagement (engagement scores), compensationBenchmark (comp analysis), successionPlanning (succession plans), diversityInclusion (DEI analytics), cultureAssessment (culture health)
- Wave 33 (Market Expansion): marketEntryPlaybook (market entry strategies), partnerChannelStrategy (partner channel optimization), acquisitionIntegration (M&A integration playbook), internationalReadiness (global expansion readiness), revenueModelAnalysis (revenue model evaluation), growthExperiments (growth experiment framework)
- Wave 34 (Customer Economics): customerAcquisitionCost (CAC analysis by channel), lifetimeValueOptimization (LTV optimization strategies), churnPrediction (predictive churn modeling), netRevenueRetention (NRR/GRR analysis), customerAdvocacy (advocacy program design), feedbackLoop (customer feedback systems)
- Wave 35 (Operational Excellence): processAutomation (automation opportunity assessment), costBenchmark (cost benchmarking analysis), vendorNegotiation (vendor negotiation strategies), scalabilityAssessment (scalability readiness), incidentReadiness (incident response preparedness), operationalRisk (operational risk assessment)
- Wave 36 (Data & AI): dataStrategy (enterprise data strategy), aiUseCases (AI use case prioritization), analyticsRoadmap (analytics capability roadmap), dataPrivacy (data privacy compliance), mlOpsReadiness (MLOps maturity assessment), digitalTransformation (digital transformation roadmap)
- Wave 37 (Revenue Operations): revenueOps (RevOps alignment), billingOptimization (billing leak analysis), contractIntelligence (contract analytics), commissionTracking (commission plans), revenueRecognition (rev rec compliance), subscriptionHealth (subscription metrics)
- Wave 38 (Product Intelligence): productRoadmapHealth (roadmap health), techDebtPrioritization (tech debt ranking), releaseVelocity (DORA metrics), bugTrendAnalysis (bug trends), apiPerformance (API health), userExperienceScore (UX scoring)
- Wave 39 (Workforce Planning): workforcePlanning (headcount planning), skillsGapAnalysis (skills assessment), remoteWorkEffectiveness (remote work metrics), teamVelocity (team productivity), burnoutRisk (burnout indicators), learningDevelopment (L&D programs)
- Wave 40 (Compliance & Legal): regulatoryRisk (regulatory exposure), contractManagement (contract lifecycle), ipStrategy (IP portfolio), legalSpendAnalysis (legal spend), policyCompliance (policy gaps), auditReadiness (audit preparedness)
- Wave 41 (Sales Excellence): salesMethodology (sales process framework), pipelineVelocity (pipeline speed metrics), dealQualification (deal scoring criteria), salesCoaching (rep coaching plans), accountPlanning (strategic account plans), competitiveBattlecards (competitor counter-strategies)
- Wave 42 (Financial Intelligence): cashBurnAnalysis (burn rate analysis), revenuePerEmployee (productivity metrics), financialBenchmarking (industry financial comparison), investmentPortfolio (investment allocation), costAllocationModel (cost distribution analysis), marginWaterfall (margin flow analysis)
- Wave 43 (Customer Success): customerOnboardingMetrics (onboarding funnel metrics), healthScoreModel (customer health scoring), csExpansionPlaybook (expansion revenue plays), renewalForecasting (renewal prediction), csOperations (CS process maturity), customerMilestones (customer lifecycle milestones)
- Wave 44 (Strategic Planning): okrFramework (OKR design and tracking), strategicPillars (strategic pillar definition), competitivePositioning (market positioning analysis), marketShareAnalysis (share of market analysis), growthCorridors (growth opportunity mapping), valuePropCanvas (value proposition design)
- Wave 45 (Market Intelligence): competitiveMonitoring (competitive landscape monitoring), marketTrendRadar (market trend detection and tracking), industryBenchmarkIndex (industry benchmark comparisons), customerIntelPlatform (customer intelligence aggregation), priceSensitivityModel (price sensitivity modeling), demandSignalAnalysis (demand signal detection and analysis)
- Wave 46 (Digital Transformation): digitalMaturityIndex (digital maturity scoring), cloudMigrationReadiness (cloud migration readiness assessment), automationRoi (automation ROI analysis), digitalWorkplace (digital workplace effectiveness), cybersecurityPosture (cybersecurity posture assessment), techVendorConsolidation (technology vendor consolidation opportunities)
- Wave 47 (Revenue Acceleration): revenueSourceMapping (revenue source identification and mapping), channelMixOptimization (channel mix optimization analysis), crossSellEngine (cross-sell opportunity engine), priceOptimizationModel (price optimization modeling), promotionEffectiveness (promotion effectiveness analysis), revenueHealthIndex (revenue health index scoring)
- Wave 48 (Organizational Health): organizationalNetwork (organizational network analysis), decisionEfficiency (decision-making efficiency metrics), meetingEfficiency (meeting efficiency and ROI), knowledgeCapital (knowledge capital assessment), changeManagementScore (change management scoring), cultureAlignment (culture alignment measurement)
- Wave 49 (Partnership & Ecosystem): partnerPerformance (partner performance tracking), ecosystemMapping (ecosystem mapping and analysis), allianceStrategy (strategic alliance planning), channelPartnerHealth (channel partner health metrics), coSellingPipeline (co-selling pipeline management), integrationMarketplace (integration marketplace strategy)
- Wave 50 (Brand & Reputation): brandEquityIndex (brand equity scoring and tracking), sentimentDashboard (sentiment analysis dashboard), mediaShareOfVoice (media share of voice analysis), crisisCommsReadiness (crisis communications readiness), thoughtLeadership (thought leadership strategy), brandConsistency (brand consistency audit)
- Wave 51 (Pricing & Monetization): monetizationModel (monetization model analysis), freeTrialConversion (free trial conversion optimization), usageBasedPricing (usage-based pricing strategy), bundleOptimization (product bundle optimization), discountDiscipline (discount discipline assessment), revenueLeakageDetection (revenue leakage detection)
- Wave 52 (Customer Education): customerAcademy (customer academy and training programs), contentEngagement (content engagement analytics), communityHealth (community health metrics), certificationProgram (certification program design), selfServiceAdoption (self-service adoption tracking), supportDeflection (support deflection analysis)
- Wave 53 (Investor Relations): investorDeck (investor deck builder), fundingTimeline (funding timeline planning), valuationModel (valuation modeling), capTableManagement (cap table management), investorCommunication (investor communication strategy), boardReporting (board reporting framework)
- Wave 54 (Market Expansion): geoExpansionStrategy (geographic expansion strategy), localMarketEntry (local market entry planning), marketRegulations (market regulations analysis), partnerLocalization (partner localization strategy), culturalAdaptation (cultural adaptation assessment), expansionRoi (expansion ROI analysis)
- Wave 55 (Product-Led Growth): productLedMetrics (PLG metrics dashboard), activationFunnel (activation funnel analysis), featureAdoption (feature adoption tracking), virality (virality coefficient analysis), productQualifiedLeads (PQL identification and scoring), timeToValue (time-to-value optimization)
- Wave 56 (AI & Automation Readiness): aiReadinessScore (AI readiness scoring), mlUseCasePriority (ML use case prioritization), dataInfrastructure (data infrastructure assessment), aiTalentGap (AI talent gap analysis), ethicalAiFramework (ethical AI framework design), aiRoiProjection (AI ROI projection modeling)
- Wave 57 (Customer Advocacy): advocacyProgram (advocacy program design and management), referralMechanism (referral mechanism optimization), testimonialPipeline (testimonial collection and pipeline), caseStudyFactory (case study creation and publishing), customerAdvisoryBoard (customer advisory board strategy), npsActionPlan (NPS-driven action planning)
- Wave 58 (Operational Finance): procurementEfficiency (procurement process optimization), expenseManagement (expense tracking and policy analysis), invoiceAutomation (invoice processing automation), paymentOptimization (payment terms and flow optimization), financialControls (internal financial controls assessment), treasuryManagement (treasury and cash management strategy)
- Wave 59 (Growth Marketing): demandGenEngine (demand generation engine analysis), contentMarketingRoi (content marketing ROI measurement), seoStrategy (SEO strategy and performance), paidMediaOptimization (paid media spend optimization), eventRoi (event ROI analysis and planning), influencerStrategy (influencer partnership strategy)
- Wave 60 (Platform Strategy): platformEconomics (platform economics modeling), developerExperience (developer experience assessment), apiMonetization (API monetization strategy), marketplaceStrategy (marketplace design and strategy), platformGovernance (platform governance framework), platformNetworkDynamics (platform network dynamics analysis)
- Wave 61 (Legal & Compliance Operations): contractLifecycle (contract lifecycle management), complianceAutomation (compliance automation assessment), legalRiskRegister (legal risk register and tracking), intellectualPropertyAudit (IP audit and protection analysis), regulatoryCalendar (regulatory deadline and filing calendar), privacyCompliance (privacy compliance assessment)
- Wave 62 (Data Analytics): dataWarehouseStrategy (data warehouse architecture strategy), biDashboardDesign (BI dashboard design and adoption), predictiveModelCatalog (predictive model inventory and performance), dataLineageMap (data lineage and flow mapping), metricsDictionary (metrics standardization and dictionary), analyticsGovernance (analytics governance framework)
- Wave 63 (Employee Experience): employeeJourney (employee journey mapping and optimization), workplaceWellness (workplace wellness program assessment), learningPathways (learning pathway design and tracking), performanceFramework (performance management framework), payEquityAnalysis (pay equity and compensation fairness analysis), deiBenchmark (DEI benchmarking and inclusion scoring)
- Wave 64 (Business Model Innovation): businessModelCanvas (business model canvas analysis), revenueModelDesign (revenue model design and optimization), valueChainOptimization (value chain efficiency analysis), costStructureAnalysis (cost structure breakdown and optimization), partnershipModel (partnership model design and evaluation), growthLeverAssessment (growth lever identification and prioritization)
- Wave 65 (Vendor & Procurement): vendorManagement (vendor performance and spend analysis), supplyChainVisibility (supply chain transparency and tracking), sustainableSourcing (sustainable procurement and supplier certification), facilityOptimization (facility utilization and cost optimization), fleetManagement (fleet operations and maintenance analysis), customerSuccess (customer health scoring and retention metrics)
- Wave 66 (Crisis & Resilience): crisisManagement (crisis preparedness and response planning), operationalResilience (business resilience and recovery assessment), stakeholderMapping (stakeholder identification and engagement strategy), digitalPresence (digital channel presence and engagement analysis), channelStrategy (channel mix and performance optimization), accountManagement (strategic account health and expansion planning)
- Wave 67 (Fundraising & Governance): fundraisingStrategy (fundraising readiness and round planning), captableManagement (cap table structure and dilution modeling), exitPlanning (exit readiness and valuation analysis), boardGovernance (board structure and governance assessment), recruitmentFunnel (hiring pipeline and conversion metrics), employerBranding (employer brand strength and talent attraction)
- Wave 68 (Team & Operations): teamTopology (team structure and collaboration analysis), onboardingOptimization (employee onboarding effectiveness), meetingCulture (meeting efficiency and decision output), documentManagement (document organization and knowledge access), workflowAutomation (workflow automation coverage and efficiency), qualityAssurance (QA process maturity and defect analysis)
- Wave 69 (Cybersecurity & Compliance): incidentResponse (incident response readiness and recovery planning), accessControl (access control policy and MFA coverage assessment), auditTrail (audit trail coverage and compliance tracking), penetrationTesting (penetration testing results and vulnerability assessment), securityAwareness (security awareness training effectiveness), dataClassification (data classification and sensitive data management)
- Wave 70 (Technical Infrastructure): apiDesign (API design quality and documentation coverage), microservicesArchitecture (microservices maturity and coupling analysis), cloudOptimization (cloud spend optimization and utilization), devopsMaturity (DevOps maturity with DORA metrics), systemMonitoring (system monitoring coverage and uptime tracking), codeQuality (code quality scoring with tech debt and test coverage)
- Wave 71 (Customer Intelligence): customerLifetimeValue (CLV analysis with segment breakdown and CAC ratios), sentimentAnalysis (customer sentiment scoring and trend tracking), supportTicketAnalysis (support ticket categorization and resolution metrics), segmentProfitability (segment profitability with margin analysis), referralAnalytics (referral program performance and conversion tracking), customerHealthDashboard (customer health dashboard with at-risk identification)
- Wave 72 (Strategic Planning): innovationPortfolio (innovation portfolio scoring and project pipeline), contingencyPlanning (contingency readiness with scenario planning and recovery), operatingRhythm (operating rhythm cadence and alignment scoring), crossFunctionalSync (cross-functional sync with collaboration and blocker tracking), wardRoomStrategy (war room strategy with initiative tracking and execution rates), revenueIntelligence (revenue intelligence with signal detection and forecast accuracy)
- Wave 73 (Market Research & Insights): marketResearch (market research with sizing, growth rates, and key insights), competitorTracking (competitor tracking with threat levels and market positioning), industryTrends (industry trend analysis with disruption risk and opportunity windows), socialListening (social listening with sentiment analysis and share of voice), uxResearch (UX research with usability ratings and pain point identification), webAnalytics (web analytics with traffic, bounce rate, and conversion tracking)
- Wave 74 (Digital Marketing): emailMarketing (email marketing with open rates, click rates, and list management), conversionOptimization (conversion rate optimization with revenue impact and quick wins), abTestingFramework (A/B testing framework with test velocity and win rates), marketingAttribution (marketing attribution with channel ROAS and model analysis), contentCalendar (content calendar with publishing cadence and content type planning), socialMediaCalendar (social media calendar with platform strategy and engagement rates)
- Wave 75 (Financial Planning): budgetPlanning (budget planning with variance analysis and efficiency scoring), revenueForecasting (revenue forecasting with projections and accuracy tracking), cashManagement (cash management with liquidity ratios and days cash on hand), creditManagement (credit management with utilization and collection rates), debtStructure (debt structure analysis with debt-to-equity and interest coverage), financialReporting (financial reporting with accuracy and compliance scoring)
- Wave 76 (Sustainability & ESG): carbonReduction (carbon reduction with footprint tracking and reduction targets), circularEconomy (circular economy with material recovery and waste diversion), communityImpact (community impact with reach, programs, and social ROI), waterManagement (water management with usage tracking and efficiency metrics), wasteReduction (waste reduction with diversion rates and cost savings), sustainableInnovation (sustainable innovation with green projects and sustainability ROI)
- Wave 77 (Talent & People Analytics): talentPipeline (talent pipeline with open roles, time to fill, and quality of hire), leadershipDevelopment (leadership development with pipeline strength and program coverage), successionReadiness (succession readiness with critical roles, bench strength, and risk levels), compensationStrategy (compensation strategy with market positioning and equity mix), workforceAnalytics (workforce analytics with headcount, attrition, and productivity), orgEffectiveness (org effectiveness with alignment, span of control, and decision speed)
- Wave 78 (Sales Operations): salesMotionDesign (sales motion design with model type, cycle length, and conversion rates), dealAnalytics (deal analytics with deal size, win rate, and pipeline value), territoryOptimization (territory optimization with coverage, balance, and untapped potential), salesCompensation (sales compensation with OTE, variable mix, and quota attainment), revenuePrediction (revenue prediction with forecast accuracy, confidence, and growth rate), accountPenetration (account penetration with expansion rate and whitespace value)
- Wave 79 (Product Excellence): productVision (product vision with clarity, alignment, and time horizon), featureRoadmap (feature roadmap with planned features, on-track status, and delivery velocity), pmfAssessment (PMF assessment with retention signals, segment fit, and growth signals), userActivation (user activation with activation rate, time to activate, and drop-off analysis), productInsights (product insights with usage patterns, feature gaps, and satisfaction), releaseStrategy (release strategy with cadence, quality gates, and rollback rates)
- Wave 80 (Brand & Identity): brandPositionMap (brand position mapping with market position and differentiation), brandValuation (brand valuation with brand value, strength, and revenue premium), brandHierarchy (brand hierarchy with architecture type and sub-brand management), reputationAnalysis (reputation analysis with sentiment, trust index, and risk factors), messagingFramework (messaging framework with consistency, clarity, and tone alignment), visualBranding (visual branding with design system, consistency, and asset coverage)
- Wave 81 (Strategic Growth Planning): growthPlaybook (growth playbook with growth levers, rates, and execution plans), revenueRunRate (revenue run rate with MRR, ARR, and growth velocity), breakEvenModel (break-even model with fixed/variable costs and margin of safety), operatingLeverageIndex (operating leverage index with DOL ratio and scalability assessment), grossMarginAnalysis (gross margin analysis with COGS ratios and improvement potential), fundingScenarioModel (funding scenario model with dilution impact and optimal paths)
- Wave 82 (Competitive Wargaming): competitiveWargame (competitive wargame with threat modeling and win probability), marketDisruptionModel (market disruption model with disruption vectors and preparedness), firstMoverAnalysis (first mover analysis with advantage type and sustainability), defensibilityAudit (defensibility audit with moat types and barrier strength), pivotReadiness (pivot readiness with execution speed and risk assessment), competitiveTimingModel (competitive timing model with market windows and response times)
- Wave 83 (Customer Success Advanced): customerMaturityModel (customer maturity model with stages and progression rates), expansionSignals (expansion signals with signal detection and revenue potential), adoptionScorecard (adoption scorecard with adoption rates and feature usage), stakeholderSentiment (stakeholder sentiment with positive rates and trend direction), valueRealization (value realization with ROI tracking and time to value), renewalPlaybook (renewal playbook with renewal rates and at-risk identification)
- Wave 84 (Business Model Design): businessModelInnovation (business model innovation with model types and viability), monetizationExperiment (monetization experiment with test velocity and revenue impact), pricingArchitecture (pricing architecture with tier design and value alignment), revenueStreamMap (revenue stream map with stream diversification and growth potential), costDriverAnalysis (cost driver analysis with savings potential and efficiency index), valueCapture (value capture with capture rates and leakage detection)
- Wave 85 (Revenue Operations): revenueProcessMap (revenue process map with bottlenecks, cycle time, and automation rate), billingHealthCheck (billing health check with error rates, collection rates, and DSO), quoteToCloseAnalysis (quote-to-close analysis with cycle days, win rate, and drop-off stages), revenueLeakDetector (revenue leak detector with leaks detected, revenue at risk, and recovery potential), forecastAccuracyModel (forecast accuracy model with variance, confidence level, and bias direction), dealDeskOptimization (deal desk optimization with approval speed, discount discipline, and deal quality)
- Wave 86 (Workforce Strategy): talentMarketIntel (talent market intel with supply, demand pressure, and salary benchmarks), employeeLifecycleMap (employee lifecycle map with tenure, attrition, and engagement), skillsInventory (skills inventory with skills mapped, gap count, and reskill priority), teamDynamicsAnalysis (team dynamics analysis with collaboration, conflict, and trust scores), hybridWorkModel (hybrid work model with remote ratio, productivity, and satisfaction), compensationPhilosophy (compensation philosophy with market position, equity mix, and pay equity)
- Wave 87 (Data & Intelligence): dataMaturityAssessment (data maturity assessment with maturity stage, data quality, and governance level), insightsPrioritization (insights prioritization with impact potential and actionability), experimentVelocity (experiment velocity with experiments running, win rate, and learning cycle), decisionIntelligence (decision intelligence with decision speed, data coverage, and outcome quality), feedbackIntelligence (feedback intelligence with volume, sentiment, and action rate), benchmarkingEngine (benchmarking engine with percentile rank, metrics tracked, and peer group)
- Wave 88 (Ecosystem & Partnerships): partnerValueMap (partner value map with active partners, value generated, and ROI), coInnovationPipeline (co-innovation pipeline with joint projects, pipeline value, and success rate), ecosystemRevenue (ecosystem revenue with partner revenue, revenue share, and growth rate), allianceScorecard (alliance scorecard with active alliances, performance, and strategic fit), partnerEnablementPlan (partner enablement plan with certification rate and time to productivity), marketplaceReadiness (marketplace readiness with integration count, listing quality, and marketplace revenue)
- Wave 89 (Strategy Execution): strategyExecution (strategy execution with completion rates, velocity, and on-track items), initiativeTracking (initiative tracking with active initiatives, progress rates, and at-risk items), resourceAllocationModel (resource allocation model with utilization, efficiency, and rebalance needs), strategicBetting (strategic betting with active bets, win rates, and expected value), executionCadence (execution cadence with rhythm health, review cycles, and delivery pace), alignmentIndex (alignment index with team alignment, goal coherence, and strategy fit)
- Wave 90 (Market Intelligence): marketSignalRadar (market signal radar with signals detected, urgency levels, and opportunity counts), competitorMoveTracker (competitor move tracker with moves tracked, threat levels, and response needs), customerVoiceAggregator (customer voice aggregator with feedback volume, sentiment, and action items), industryConvergenceMap (industry convergence map with industries mapped, overlap areas, and opportunity value), emergingTechRadar (emerging tech radar with technologies tracked, readiness levels, and impact potential), regulatoryHorizon (regulatory horizon with regulations tracked, compliance risk, and upcoming deadlines)
- Wave 91 (Financial Intelligence): cashFlowForecaster (cash flow forecaster with projected cash, accuracy, and risk levels), profitDriverTree (profit driver tree with top drivers, margin impact, and optimization potential), revenueQualityIndex (revenue quality index with recurring ratio, predictability, and concentration risk), financialResilienceScore (financial resilience score with stress tolerance, recovery speed, and buffer adequacy), workingCapitalOptimizer (working capital optimizer with cash freed, cycle days, and efficiency gains), investmentReadinessGate (investment readiness gate with gates passed, gaps remaining, and timeline)
- Wave 92 (Customer Intelligence): customerDnaProfile (customer DNA profile with segments, behavioral patterns, and data completeness), propensityModel (propensity model with accuracy, top signals, and revenue potential), churnEarlyWarning (churn early warning with at-risk accounts, revenue at risk, and early signals), customerEffortOptimizer (customer effort optimizer with friction points, ease of use, and improvement potential), loyaltyDriver (loyalty driver with top drivers, retention impact, and NPS correlation), accountIntelligence (account intelligence with accounts profiled, growth potential, and risk accounts)
- Wave 93 (GTM & Launch): gtmCalendar (go-to-market launch calendar with milestones, dates, owners), launchReadiness (launch readiness gates and go/no-go assessment), messageTesting (message variant testing plan for audiences and channels), salesCollateral (sales collateral audit and effectiveness analysis), demandGenPlan (demand generation plan with channels and budgets), channelActivation (channel activation plan with readiness scoring)
- Wave 94 (Pricing Intelligence): priceElasticityModel (price elasticity analysis with optimal price points), dynamicPricingEngine (dynamic pricing rules and guardrails), discountImpactAnalysis (discount scenario impact modeling), bundleDesigner (product bundle design with pricing and segments), competitivePriceTracker (competitive price tracking and positioning), pricingExperiment (pricing experiment design and A/B test plan)
- Wave 95 (Monitoring & Insights): kpiWatchlist (KPI watchlist with targets, trends, alerts), alertFramework (business alert rules and threshold monitoring), anomalyDetection (anomaly detection across business metrics), trendForecast (trend forecasting for key metrics 30d/90d), dashboardDesign (dashboard panel design for stakeholders), insightsCatalog (actionable business insights ranked by impact)
- Wave 96 (Innovation & IP): ideaPipeline (innovation idea pipeline with feasibility scoring), innovationScoring (innovation capability scoring), experimentBoard (experiment tracking board with learnings), patentAnalysis (IP and patent portfolio analysis), disruptionPlaybook (disruption scenario playbook), futureProofing (future-proofing assessment across dimensions)
- Wave 97 (Revenue & Accounts): revenueMixAnalysis (revenue mix breakdown with concentration risk), accountGrowthPlan (account-level growth plans and expansion strategies), contractOptimizer (contract portfolio optimization), usagePatternAnalysis (product usage pattern analysis), churnRecoveryPlan (churned customer recovery plan), winbackProgram (win-back program design by segment)
- Wave 98 (Automation & Ops): automationAudit (automation opportunity audit with ROI), processDigitization (process digitization roadmap), botDeploymentPlan (bot/RPA deployment plan), workflowBenchmark (workflow performance benchmarking), handoffEfficiency (cross-team handoff efficiency analysis), toolConsolidation (tool consolidation and savings analysis)
- Wave 99 (Communications): crisisCommunication (crisis communication scenarios and plans), internalComms (internal communications effectiveness audit), investorNarrative (investor narrative with key story components), pressStrategy (press and media strategy), thoughtLeadershipPlan (thought leadership content strategy), brandStoryArc (brand story arc with narrative chapters)
- Wave 100 (Business Mastery): masteryDashboard (overall business mastery scoring), growthVelocityScore (growth velocity and acceleration metrics), operationalMaturity (operational maturity assessment level 1-5), leadershipReadiness (leadership readiness for next growth stage), marketDominanceIndex (market dominance and competitive position), futureReadiness (future readiness covering adaptability and resilience)
- Wave 101 (AI & ML Readiness): aiAdoptionPotential (AI adoption potential and readiness assessment), mlUseCaseIdentification (ML use case identification and prioritization), dataInfrastructureGapAnalysis (data infrastructure gap analysis), automationROIModeling (automation ROI modeling and projections), aiTalentNeedsAssessment (AI talent needs and skills assessment), ethicalAIFramework (ethical AI governance framework)
- Wave 102 (Geographic Expansion): marketEntryScoring (market entry scoring and prioritization), regulatoryLandscapeMapping (regulatory landscape mapping by region), culturalAdaptationStrategy (cultural adaptation strategy for new markets), logisticsExpansionAnalysis (logistics and supply chain expansion analysis), localPartnershipStrategy (local partnership identification and strategy), internationalPricingOptimization (international pricing optimization)
- Wave 103 (Customer Lifecycle): acquisitionFunnelIntelligence (acquisition funnel analysis and optimization), onboardingEffectivenessScore (onboarding effectiveness scoring), engagementScoringModel (customer engagement scoring model), expansionRevenueOpportunities (expansion revenue opportunity identification), advocacyProgramDesign (customer advocacy program design), lifetimeValueModeling (customer lifetime value modeling)
- Wave 104 (Platform & API Economy): apiMonetizationStrategy (API monetization strategy and pricing), platformEcosystemHealth (platform ecosystem health metrics), developerExperienceOptimization (developer experience optimization), integrationMarketplaceAnalytics (integration marketplace analytics), partnerEnablementProgram (partner enablement program design), platformGovernanceFramework (platform governance framework)
- Wave 105 (Predictive Analytics): demandForecastingEngine (demand forecasting engine), predictiveMaintenanceModeling (predictive maintenance modeling), churnPredictionModel (churn prediction model), leadScoringAI (AI-powered lead scoring), inventoryOptimizationAI (AI inventory optimization), revenuePredictionModeling (revenue prediction modeling)
- Wave 106 (Organizational Design): orgStructureAnalysis (organizational structure analysis), spanOfControlOptimization (span of control optimization), decisionRightsMapping (decision rights mapping and clarity), collaborationNetworkMapping (collaboration network analysis), roleOptimizationAnalysis (role optimization and clarity analysis), successionPlanningFramework (succession planning framework)
- Wave 107 (Social Impact & ESG): impactMeasurementDashboard (social impact measurement dashboard), esgReportingCompliance (ESG reporting compliance assessment), stakeholderEngagementAnalytics (stakeholder engagement analytics), communityInvestmentStrategy (community investment strategy), diversityMetricsAnalytics (diversity and inclusion metrics), greenOperationsOptimization (green operations optimization)
- Wave 108 (Knowledge Management): knowledgeAuditAssessment (knowledge audit and assessment), expertiseMappingSystem (expertise mapping across organization), documentationStrategyFramework (documentation strategy framework), learningPathwaysDesign (learning pathways design), institutionalMemoryProtection (institutional memory protection), knowledgeTransferOptimization (knowledge transfer optimization)
- Tools & Automation: toolsAutomationPlan (recommended tools, software, and automations with costs, savings, ROI, and implementation priorities)

BUSINESS INTELLIGENCE MEMORY (${memory.orgName}):
${memory.summary}

KEY NUMBERS:
- Health Score: ${memory.keyNumbers.healthScore ?? "?"}/100 Grade ${memory.keyNumbers.healthGrade ?? "?"}
- Cash Runway: ${memory.keyNumbers.cashRunway ?? "?"} weeks
- Revenue at Risk: $${memory.keyNumbers.revenueAtRisk?.toLocaleString() ?? "?"}
- Total Revenue Leaks: $${memory.keyNumbers.totalLeaks?.toLocaleString() ?? "?"}
- Website Grade: ${memory.websiteGrade ?? "Not analyzed"}

RECENT ANALYSES:
${memory.reportSummaries
  .slice(0, 5)
  .map((r) => `- ${new Date(r.date).toLocaleDateString()}: ${r.headline} (Score: ${r.score ?? "?"}/${r.grade ?? "?"})`)
  .join("\n")}

Remember: You have access to their full report via tools. Use get_report_section when you need specifics.
You also have get_integration_data to access live data from connected business tools (Slack, QuickBooks, Stripe, Salesforce, GitHub, etc.). When integration data is available, use real metrics instead of estimating.`;
}

// ── Main agent function ────────────────────────────────────────────────────────

export interface AgentRequest {
  orgId: string;
  messages: ChatMessage[];     // full conversation history from client
  message: string;             // current user message
}

export interface AgentResponse {
  message: string;
  toolsUsed?: string[];
}

export async function runBusinessAgent(req: AgentRequest): Promise<AgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Pivvy is not available. GEMINI_API_KEY is not configured." };
  }

  const memory = await getAgentMemory(req.orgId);
  if (!memory) {
    return {
      message: `I don't have a memory built for this organization yet. Please complete a full analysis first, then I'll have everything I need to advise you effectively.`,
    };
  }

  const genai = new GoogleGenAI({ apiKey });

  // Trim history to last N messages for token efficiency
  const trimmedHistory = req.messages.slice(-MAX_HISTORY_MESSAGES);

  // Build Gemini contents array
  const contents = [
    ...trimmedHistory.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    {
      role: "user" as const,
      parts: [{ text: req.message }],
    },
  ];

  const toolsUsed: string[] = [];

  try {
    // First call — may request tool use
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(memory),
        temperature: 0.4,
        maxOutputTokens: 2000,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: { functionCallingMode: "AUTO" },
      } as Record<string, unknown>,
    });

    // Check if model requested tool calls
    const candidate = resp.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p: any) => p.functionCall);

    if (fnCalls.length > 0) {
      // Execute all requested tools with guardrails
      const guard = new LoopGuard();
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          let { name, args } = part.functionCall;

          // Fuzzy match tool name if not recognized
          if (!AVAILABLE_TOOL_NAMES.includes(name)) {
            const matched = closestToolName(name, AVAILABLE_TOOL_NAMES);
            if (matched) {
              console.warn(`[Pivvy] Tool name corrected: "${name}" -> "${matched}"`);
              name = matched;
            }
          }

          // Loop guard check
          const guardResult = guard.check(name, args);
          if (!guardResult.allowed) {
            console.warn(`[Pivvy] LoopGuard blocked: ${guardResult.warning}`);
            return { name, result: `Tool call blocked by safety guard: ${guardResult.warning}` };
          }
          if (guardResult.warning) {
            console.warn(`[Pivvy] LoopGuard warning: ${guardResult.warning}`);
          }

          toolsUsed.push(name);
          const result = await executeTool(name, args as Record<string, unknown>, req.orgId);
          return { name, result };
        })
      );

      // Extract <!--PROJECTION:...--> and <!--NAVIGATE:...--> markers from tool results
      // before sending to Gemini (Gemini won't reproduce them), then append to final response
      const embeddedMarkers: string[] = [];
      const cleanedToolResults = toolResults.map((tr) => {
        let cleanResult = tr.result;
        const markerRegex = /<!--(PROJECTION|NAVIGATE):[\s\S]*?-->/g;
        let match: RegExpExecArray | null;
        while ((match = markerRegex.exec(tr.result)) !== null) {
          embeddedMarkers.push(match[0]);
        }
        cleanResult = cleanResult.replace(markerRegex, "").trim();
        return { name: tr.name, result: cleanResult };
      });

      // Second call with tool results (markers stripped so Gemini gets clean text)
      const contentsWithTools = [
        ...contents,
        { role: "model" as const, parts },
        {
          role: "user" as const,
          parts: cleanedToolResults.map((tr) => ({
            functionResponse: { name: tr.name, response: { result: tr.result } },
          })),
        },
      ];

      // Retry up to 2 times if Gemini returns null/empty text
      let resp2Text: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const resp2 = await genai.models.generateContent({
          model: FLASH_MODEL,
          contents: contentsWithTools,
          config: {
            systemInstruction: buildSystemPrompt(memory),
            temperature: 0.4,
            maxOutputTokens: 2000,
          } as Record<string, unknown>,
        });
        resp2Text = resp2.text ?? null;
        if (resp2Text?.trim()) break;
        if (attempt < 2) console.warn(`[Pivvy] Empty response (attempt ${attempt + 1}/3), retrying...`);
      }

      // Append extracted markers to the response so the UI can parse them
      let finalMessage = sanitize(resp2Text || "I encountered an issue generating a response. Please try again.");
      if (embeddedMarkers.length > 0) {
        finalMessage = finalMessage + "\n\n" + embeddedMarkers.join("\n");
      }

      return {
        message: finalMessage,
        toolsUsed,
      };
    }

    // Retry if Gemini returned empty/null on the direct (no-tool) path
    if (!resp.text?.trim()) {
      for (let attempt = 0; attempt < 2; attempt++) {
        console.warn(`[Pivvy] Empty direct response (attempt ${attempt + 2}/3), retrying...`);
        const retry = await genai.models.generateContent({
          model: FLASH_MODEL,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(memory),
            temperature: 0.4,
            maxOutputTokens: 2000,
            tools: [{ functionDeclarations: TOOLS }],
            toolConfig: { functionCallingMode: "AUTO" },
          } as Record<string, unknown>,
        });
        if (retry.text?.trim()) {
          return { message: sanitize(retry.text), toolsUsed };
        }
      }
    }

    return {
      message: sanitize(resp.text ?? "I encountered an issue generating a response. Please try again."),
      toolsUsed,
    };
  } catch (e) {
    console.error("[Pivvy] Agent error:", e);
    return {
      message: "I ran into a technical issue. Please try again in a moment.",
      toolsUsed,
    };
  }
}
