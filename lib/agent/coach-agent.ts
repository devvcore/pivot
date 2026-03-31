/**
 * Coach — Business Performance & Team Coaching Agent
 *
 * A separate agent from Pivvy, focused on people, team performance,
 * and personal coaching. Powered by Gemini Flash.
 *
 * Architecture:
 * - Loads business report context from job-store
 * - Has coaching-focused system prompt with anti-hallucination rules
 * - Tools: get_report_section, get_team_data, generate_action_items
 * - Client maintains conversation history; server is stateless per request
 *
 * Personality:
 * - Direct, data-driven, brutally honest but constructive
 * - Frames everything in business impact and ROI
 * - Never invents employee data or performance metrics
 */
import { GoogleGenAI } from "@google/genai";
import { getJob, listJobs } from "@/lib/job-store";
import { findRoute, findRouteById } from "./page-routes";
import { collectIntegrationContext, pullFreshIntegrationData } from "@/lib/integrations/collect";
import { LoopGuard, closestToolName, smartTruncate, validateToolResult, detectVagueResponse, SPECIFICITY_NUDGE } from "./agent-guardrails";
import type { MVPDeliverables } from "@/lib/types";

const COACH_TOOL_NAMES = ["get_report_section", "get_team_data", "generate_action_items", "navigate_to_page", "get_integration_data", "check_inbox", "check_calendar", "draft_and_send_email", "create_event"];
const MAX_TOOL_ROUNDS = 5;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const COACH_SYSTEM_PROMPT_HEADER = `Your name is Pivvy. You are a direct and data-driven business performance advisor built into Pivot.

--- IDENTITY ---
Your name is Pivvy. NEVER say "I am Coach." You are Pivvy — a business performance advisor who leads with data, follows with insight, and closes with action.
You have deep expertise in business strategy, operations, finance, and team management.
You are brutally honest but constructive. You frame everything in terms of business impact and ROI.
You celebrate wins by connecting them to what the business DID differently.

--- BEHAVIORAL RULES ---
- JUST DO IT. When the user asks a question, answer it directly. Don't hedge with "would you like me to..." or "shall I elaborate?"
- Lead with the data point, then the insight, then the action. Example: "Your health score is 42/100. The biggest drag is cash runway at 6 weeks. Here are 3 things to do this week: [specific actions]"
- Be proactive: if you see a concerning pattern in the data, flag it before being asked
- Reference data from the business report, uploaded team records, and questionnaire answers
- If asked about employee performance and no specific performance data exists, provide general coaching based on the business type, industry benchmarks, and available report data. Frame it as "Based on your industry and business profile..." and give actionable advice. Suggest uploading payroll or performance reviews for more personalized analysis.
- NEVER invent specific employee names or fabricate exact salary figures not in the data
- When specific data points are unavailable, use industry benchmarks and the business profile to provide useful guidance. NEVER say "I don't know", "insufficient data", or refuse to help

--- COACHING STYLE ---
- One key insight per response is better than dumping everything at once
- Be specific: reference actual numbers from the report, not vague descriptions
- Give specific next steps, not vague advice like "consider improving your marketing"
- When asked "what should I focus on?", identify the highest-impact area based on actual scores and gaps
- Track conversation: don't repeat the same advice if they already acknowledged it

FOR OWNERS:
- Analyze team cost vs output (only with real data)
- Recommend who to invest in or let go (only with evidence)
- Identify performance gaps and hiring needs
- Create prioritized daily/weekly action items
- Answer "who should I fire?" honestly, but only if you have the data

FOR EMPLOYEES:
- Show their assigned KPIs and progress
- Suggest specific daily actions to improve their metrics
- Coach on skills relevant to their role
- Explain how their work impacts business outcomes

--- ESCALATION AWARENESS ---
- Cash runway < 8 weeks: URGENT, address cash burn immediately
- Health score < 50: business needs immediate attention across multiple areas
- Revenue leaks > $50,000: significant money being left on the table
- Risk register has critical/high severity items: flag and prioritize mitigation
- Any dimension scoring below 30/100: call it out as a critical gap
- NPS < 0 or churn rate spiking: customer satisfaction crisis
- Burn rate exceeding revenue by > 2x: existential financial risk

--- PROACTIVE INBOX & CALENDAR AWARENESS ---
- When the user starts a conversation or says "what's going on", use check_inbox and check_calendar to surface what needs attention
- Surface urgent items: "You have an unread email from [sender] about [subject] - want me to draft a reply?"
- Connect the dots: if an email asks for a document the user hasn't sent, offer to create and send it. Example: "Sarah emailed you about Q4 docs 2 days ago - want me to put them together and send them over?"
- If there's a meeting coming up, suggest prep: "You have a meeting with [person] in 2 hours about [topic] - want me to pull together talking points?"
- After creating content (budgets, reports, posts), proactively offer: "Want me to email this to someone? Or put a review meeting on your calendar?"
- When the user mentions following up, offer to draft the email or schedule a call
- ALWAYS ask before sending - never send emails or create events without explicit user approval
- Use draft_and_send_email when the user says "yes, send it" or "go ahead"
- Use create_event when the user wants to schedule something

--- FORMAT RULES ---
- No em dashes, en dashes, or double dashes. Use ":" or plain hyphens
- No markdown bold (**) or italic (*). Plain text only
- Use bullet points with "-" for lists
- Keep responses under 300 words unless specifically asked for detail
- End actionable responses with a clear "This week:" section of 1-3 specific things to do

--- FOLLOW-UP SUGGESTIONS (MANDATORY) ---
At the very end of EVERY response, append exactly this format on its own line:
<!--FOLLOWUPS:["question 1", "question 2", "question 3"]-->
- Generate 2-3 SHORT follow-up questions (max 10 words each) the user might want to ask next
- Make them specific to what you just discussed, not generic
- Make them progressively deeper: dig in, explore a related angle, suggest an action
- NEVER skip this. EVERY response must end with this marker.

You have access to the business report via the get_report_section tool. Use it to ground your advice in real data.
You also have a navigate_to_page tool. Use it when the user asks to see, view, or go to a specific section of their analysis (e.g. "show me the action plan", "take me to issues", "where is my health score").
You have a get_integration_data tool to pull LIVE data from connected business tools (Stripe, Gmail, Slack, QuickBooks, Salesforce, HubSpot, GitHub, etc.). ALWAYS use this tool when the user asks about cash flow, revenue, payments, customers, emails, messages, or any data that could come from a connected integration. This tool pulls fresh data directly from the APIs — never tell the user data is unavailable without calling this tool first. Prefer real integration data over report estimates.

REPORT SECTIONS — USE get_report_section TOOL:
The report has 360+ sections organized by category. Use camelCase names with the get_report_section tool.

Core Health: healthScore, cashIntelligence, revenueLeakAnalysis, issuesRegister, atRiskCustomers, executiveSummary, actionPlan, decisionBrief
Team & People: hiringPlan, kpiReport, goalTracker, teamPerformance, talentGapAnalysis, employeeEngagement, compensationBenchmark, successionPlanning, burnoutRisk, cultureAssessment
Sales & Revenue: salesPlaybook, salesForecast, dealPipeline, pipelineVelocity, winLossAnalysis, churnPlaybook, retentionPlaybook, revenueAttribution, subscriptionMetrics
Finance: cashOptimization, financialRatios, budgetPlanning, costIntelligence, cashBurnAnalysis, unitEconomics, profitabilityMap, workingCapital
Strategy: swotAnalysis, competitivePositioning, productMarketFit, scenarioPlanning, strategicRoadmap, fundingReadiness, exitReadiness, marketEntryStrategy
Operations: operationalEfficiency, riskRegister, healthChecklist, benchmarkScore, milestoneTracker, processAutomation, vendorScorecard, capacityPlanning
Marketing & Brand: brandHealth, marketingStrategy, channelMixModel, contentEngagement, seoStrategy, competitorAnalysis, websiteAnalysis
Product & Tech: featurePrioritization, techStackAudit, productUsageAnalytics, releaseVelocity, techDebtAssessment, apiStrategy
Customer: customerJourneyMap, customerHealthScore, npsAnalysis, customerSegmentation, cohortAnalysis, supportTicketAnalysis
Data & AI: aiReadiness, dataGovernance, analyticsMaturity, predictiveModeling, digitalMaturity

Any camelCase topic name works — the tool will find the closest match. Use it to get details beyond what is in your business context.`;

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_report_section",
    description:
      "Retrieve a specific section of the business intelligence report. Use when you need data to back up coaching advice.",
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
          description: "Which report section to retrieve",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "get_team_data",
    description:
      "Retrieve team member records if any have been uploaded (payroll, org chart, performance reviews). Returns team data or a message indicating no data is available.",
    parameters: {
      type: "object" as const,
      properties: {
        orgId: {
          type: "string",
          description: "The organization ID to look up team data for",
        },
      },
      required: ["orgId"],
    },
  },
  {
    name: "generate_action_items",
    description:
      "Generate a prioritized daily to-do list based on the user's role and current business data. Pulls from the action plan, KPIs, and issues register to create specific tasks.",
    parameters: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: ["owner", "employee"],
          description: "Whether to generate action items for an owner or employee",
        },
        focusArea: {
          type: "string",
          description: "Optional focus area like 'revenue', 'team', 'operations', 'marketing'",
        },
      },
      required: ["role"],
    },
  },
  {
    name: "navigate_to_page",
    description:
      "Navigate the user to a specific page or section in the Pivot analysis. Use this when the user asks to see something, go somewhere, view a specific report section, or when showing them relevant data would help. Examples: 'show me the action plan', 'take me to team performance', 'where is the hiring plan'.",
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
      "Retrieve live data from connected business tools (Slack, Gmail, QuickBooks, Stripe, Salesforce, HubSpot, GitHub, Jira, etc.). Use when you need real metrics from their connected apps to ground coaching advice.",
    parameters: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          description: "Filter by provider (e.g. 'slack', 'quickbooks', 'stripe'). Leave empty for all providers.",
        },
        recordType: {
          type: "string",
          description: "Filter by record type. Known types — stripe: payments, customers, charges_overview, customers_overview; slack: channel_list, team_overview; gmail: emails, recent_activity, profile. Leave empty to get all records for a provider (RECOMMENDED when unsure).",
        },
      },
      required: [],
    },
  },
  {
    name: "check_inbox",
    description:
      "Check the user's recent emails from Gmail. Use proactively to surface actionable items, pending requests, unanswered emails, or things that need the user's attention. Call this when starting a conversation to see what's going on.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Optional Gmail search query (e.g., 'is:unread', 'from:john', 'subject:Q4'). Defaults to recent unread emails.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of emails to return (default 5).",
        },
      },
      required: [],
    },
  },
  {
    name: "check_calendar",
    description:
      "Check the user's upcoming Google Calendar events. Use proactively to surface meetings, deadlines, and help the user prepare. Call this to see what's coming up today or this week.",
    parameters: {
      type: "object" as const,
      properties: {
        time_range: {
          type: "string",
          enum: ["today", "tomorrow", "this_week"],
          description: "Time range to check (default: today).",
        },
      },
      required: [],
    },
  },
  {
    name: "draft_and_send_email",
    description:
      "Draft and send an email on behalf of the user via Gmail. Use when the user agrees to send something - a reply, a document, a follow-up, or any email. ALWAYS confirm with the user before calling this.",
    parameters: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          description: "Recipient email address.",
        },
        subject: {
          type: "string",
          description: "Email subject line.",
        },
        body: {
          type: "string",
          description: "Email body content (plain text).",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "create_event",
    description:
      "Create a Google Calendar event for the user. Use when scheduling follow-ups, meetings, reminders, or deadlines. ALWAYS confirm with the user before calling this.",
    parameters: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Event title/summary.",
        },
        start_time: {
          type: "string",
          description: "Start time in ISO 8601 format (e.g., '2026-03-20T10:00:00').",
        },
        end_time: {
          type: "string",
          description: "End time in ISO 8601 format (e.g., '2026-03-20T11:00:00').",
        },
        description: {
          type: "string",
          description: "Optional event description or agenda.",
        },
      },
      required: ["title", "start_time", "end_time"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function findJobForOrg(orgId: string, runId?: string): Promise<ReturnType<typeof getJob>> {
  if (runId) {
    return getJob(runId);
  }
  const allJobs = await listJobs();
  return (
    allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed") ??
    allJobs.find((j) => j.status === "completed")
  );
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string,
  runId?: string
): Promise<string> {
  if (toolName === "get_report_section") {
    const section = args.section as string;
    const job = await findJobForOrg(orgId, runId);

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    // Truncate to avoid token overflow (smart: keeps head + tail context)
    const json = JSON.stringify(sectionData, null, 2);
    return `[Report Section: ${section}]\n${smartTruncate(json, 3000)}`;
  }

  if (toolName === "get_team_data") {
    // Team data would come from uploaded HR/payroll documents
    // For now, check if the report has any employee-related data
    const job = await findJobForOrg(orgId, runId);

    if (!job?.deliverables) {
      return "No team data available. The business owner needs to upload payroll records, org charts, or performance reviews for team analysis.";
    }

    const d = job.deliverables as MVPDeliverables;
    const parts: string[] = [];

    // Check for employee count in health score dimensions
    if (d.healthScore?.dimensions) {
      const teamDim = d.healthScore.dimensions.find(
        (dim) => dim.name.toLowerCase().includes("team") || dim.name.toLowerCase().includes("people")
      );
      if (teamDim) parts.push(`Team Health: ${teamDim.score}/100 - ${teamDim.keyFinding || teamDim.summary || "N/A"}`);
    }

    // Check KPIs for team-related metrics
    if (d.kpiReport?.kpis) {
      const teamKpis = d.kpiReport.kpis.filter(
        (k) => k.category === "Operations" || k.name.toLowerCase().includes("team") || k.name.toLowerCase().includes("employee")
      );
      if (teamKpis.length > 0) {
        parts.push(`Team KPIs: ${teamKpis.map((k) => `${k.name}: ${k.currentValue || "Unknown"} (${k.status})`).join("; ")}`);
      }
    }

    // Check action plan for team-related tasks
    if (d.actionPlan?.days) {
      const teamTasks = d.actionPlan.days.flatMap((day) =>
        day.tasks.filter((t) => t.owner !== "Owner" || t.description.toLowerCase().includes("team") || t.description.toLowerCase().includes("hire"))
      );
      if (teamTasks.length > 0) {
        parts.push(`Team-related actions: ${teamTasks.slice(0, 5).map((t) => t.description).join("; ")}`);
      }
    }

    if (parts.length === 0) {
      return "No specific team member data found in the current report. Upload payroll, performance reviews, or org chart data for detailed team analysis.";
    }

    return `[Team Data from Report]\n${parts.join("\n")}`;
  }

  if (toolName === "generate_action_items") {
    const role = args.role as string;
    const focusArea = args.focusArea as string | undefined;
    const job = await findJobForOrg(orgId, runId);

    if (!job?.deliverables) {
      return "No report data available to generate action items. Complete a business analysis first.";
    }

    const d = job.deliverables as MVPDeliverables;
    const items: string[] = [];

    // Pull from action plan
    if (d.actionPlan?.days) {
      const todayTasks = d.actionPlan.days.slice(0, 3).flatMap((day) =>
        day.tasks.map((t) => `[Day ${day.day}] ${t.description} (${t.owner})`)
      );
      items.push(...todayTasks.slice(0, 5));
    }

    // Pull critical issues
    if (d.issuesRegister?.issues) {
      const critical = d.issuesRegister.issues
        .filter((i) => i.severity === "Critical" || i.severity === "HIGH")
        .slice(0, 3);
      critical.forEach((i) => {
        items.push(`[URGENT] ${i.title || i.description} - ${i.recommendedAction || i.recommendation || "Address immediately"}`);
      });
    }

    // Pull KPI focus
    if (d.kpiReport?.kpis) {
      const atRisk = d.kpiReport.kpis.filter((k) => k.status === "at_risk" || k.status === "behind").slice(0, 2);
      atRisk.forEach((k) => {
        items.push(`[KPI] ${k.name}: Currently ${k.currentValue || "unknown"}, target ${k.targetValue || "TBD"} - ${k.status}`);
      });
    }

    // Filter by focus area if specified
    let filtered = items;
    if (focusArea) {
      filtered = items.filter((i) => i.toLowerCase().includes(focusArea.toLowerCase()));
      if (filtered.length === 0) filtered = items; // fall back to all
    }

    if (filtered.length === 0) {
      return "No specific action items could be generated from the current report data. Try running a full business analysis first.";
    }

    return `[Action Items for ${role}${focusArea ? ` - Focus: ${focusArea}` : ""}]\n${filtered.join("\n")}`;
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
      // Pull fresh data from Composio before reading from DB
      await pullFreshIntegrationData(orgId).catch((e: unknown) =>
        console.warn("[Coach] Fresh integration pull failed (non-fatal):", e)
      );

      const ctx = await collectIntegrationContext(orgId);
      if (ctx.records.length === 0) {
        return "No integration data available. Suggest connecting business tools (Slack, QuickBooks, Stripe, etc.) from the Integrations page for data-driven coaching.";
      }

      let filtered = ctx.records;
      if (provider) filtered = filtered.filter((r) => r.provider === provider);
      if (recordType) {
        const exact = filtered.filter((r) => r.recordType === recordType);
        if (exact.length > 0) {
          filtered = exact;
        }
        // If no exact match, keep all records for the provider so the LLM still gets data
      }

      if (filtered.length === 0) {
        return `No data found for ${provider ? `provider "${provider}"` : ""}${recordType ? ` record type "${recordType}"` : ""}. Connected providers: ${ctx.providers.join(", ")}`;
      }

      const result = filtered.map((r) => ({
        provider: r.provider,
        type: r.recordType,
        syncedAt: r.syncedAt,
        data: typeof r.data === 'string' ? r.data.slice(0, 2000) : JSON.stringify(r.data).slice(0, 2000),
      }));

      return `[Integration Data — ${filtered.length} records, freshly pulled]\n${JSON.stringify(result, null, 2)}`;
    } catch (e) {
      return `Failed to retrieve integration data: ${String(e)}`;
    }
  }

  if (toolName === "check_inbox") {
    const query = (args.query as string) ?? "is:unread";
    const maxResults = Number(args.max_results) || 5;

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from("integrations")
        .select("status")
        .eq("org_id", orgId)
        .eq("provider", "gmail")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration) {
        return "Gmail is not connected. Suggest the user connect Gmail via Settings - Integrations for inbox awareness.";
      }

      const { getEmails } = await import("@/lib/integrations/composio-tools");
      const result = await getEmails(orgId, query, maxResults);

      if (!result || (Array.isArray(result) && result.length === 0)) {
        return query === "is:unread" ? "No unread emails - inbox is clear!" : `No emails matching "${query}".`;
      }

      const emails = Array.isArray(result) ? result : (result?.messages ?? result?.data ?? [result]);
      const formatted = emails.slice(0, maxResults).map((e: any, i: number) => {
        const from = e.sender || e.from || e.headers?.from || "Unknown";
        const subject = e.subject || e.headers?.subject || "(no subject)";
        const snippet = e.snippet || e.preview || e.body?.slice(0, 100) || "";
        const date = e.date || e.internalDate || e.receivedAt || "";
        return `${i + 1}. From: ${from}\n   Subject: ${subject}\n   Preview: ${snippet}\n   Date: ${date}`;
      }).join("\n\n");

      return `[Inbox - ${emails.length} email(s)${query !== "is:unread" ? ` matching "${query}"` : " unread"}]\n\n${formatted}`;
    } catch (e) {
      return `Could not check inbox: ${String(e)}`;
    }
  }

  if (toolName === "check_calendar") {
    const timeRange = (args.time_range as string) ?? "today";

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from("integrations")
        .select("status")
        .eq("org_id", orgId)
        .eq("provider", "google_calendar")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration) {
        return "Google Calendar is not connected. Suggest the user connect it via Settings - Integrations for calendar awareness.";
      }

      const { getCalendarEvents } = await import("@/lib/integrations/composio-tools");
      const now = new Date();
      let timeMin = now.toISOString();
      let timeMax: string;

      if (timeRange === "tomorrow") {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        timeMin = tomorrow.toISOString();
        const endOfTomorrow = new Date(tomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);
        timeMax = endOfTomorrow.toISOString();
      } else if (timeRange === "this_week") {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        timeMax = endOfWeek.toISOString();
      } else {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        timeMax = endOfDay.toISOString();
      }

      const result = await getCalendarEvents(orgId, "primary", timeMin, timeMax);
      const events = Array.isArray(result) ? result : (result?.items ?? result?.data ?? []);

      if (events.length === 0) {
        return `No events ${timeRange === "today" ? "for the rest of today" : timeRange === "tomorrow" ? "tomorrow" : "this week"}.`;
      }

      const formatted = (events as any[]).slice(0, 15).map((e: any, i: number) => {
        const start = e.start?.dateTime ?? e.start?.date ?? "TBD";
        const attendees = e.attendees?.map((a: any) => a.email || a.displayName).join(", ") ?? "";
        return `${i + 1}. ${e.summary ?? "Untitled"}\n   Time: ${start}\n   ${attendees ? `Attendees: ${attendees}` : ""}`;
      }).join("\n\n");

      return `[Calendar - ${timeRange}]\n\n${formatted}`;
    } catch (e) {
      return `Could not check calendar: ${String(e)}`;
    }
  }

  if (toolName === "draft_and_send_email") {
    const to = args.to as string;
    const subject = args.subject as string;
    const body = args.body as string;

    if (!to || !subject || !body) {
      return "Missing required fields: to, subject, body.";
    }

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from("integrations")
        .select("status")
        .eq("org_id", orgId)
        .eq("provider", "gmail")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration) {
        return `Email drafted but Gmail is not connected:\n\nTo: ${to}\nSubject: ${subject}\n\n${body}\n\nConnect Gmail via Settings - Integrations to send emails.`;
      }

      const { sendEmail } = await import("@/lib/integrations/composio-tools");
      const result = await sendEmail(orgId, to, subject, body);
      if (result) {
        return `Email sent successfully!\n\nTo: ${to}\nSubject: ${subject}`;
      }
      return "Failed to send email via Gmail.";
    } catch (e) {
      return `Could not send email: ${String(e)}`;
    }
  }

  if (toolName === "create_event") {
    const title = args.title as string;
    const startTime = args.start_time as string;
    const endTime = args.end_time as string;
    const description = args.description as string | undefined;

    if (!title || !startTime || !endTime) {
      return "Missing required fields: title, start_time, end_time.";
    }

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from("integrations")
        .select("status")
        .eq("org_id", orgId)
        .eq("provider", "google_calendar")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration) {
        return `Event drafted but Google Calendar is not connected:\n\nTitle: ${title}\nStart: ${startTime}\nEnd: ${endTime}${description ? `\nDescription: ${description}` : ""}\n\nConnect Google Calendar via Settings - Integrations to create events.`;
      }

      const { createCalendarEvent } = await import("@/lib/integrations/composio-tools");
      const result = await createCalendarEvent(orgId, title, startTime, endTime, description);
      if (result) {
        return `Calendar event created!\n\nTitle: ${title}\nStart: ${startTime}\nEnd: ${endTime}`;
      }
      return "Failed to create calendar event.";
    } catch (e) {
      return `Could not create event: ${String(e)}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  // Preserve <!--PROJECTION:...--> , <!--NAVIGATE:...--> , and <!--FOLLOWUPS:...--> markers
  const markers: string[] = [];
  let cleaned = text.replace(/<!--(PROJECTION|NAVIGATE|FOLLOWUPS):[\s\S]*?-->/g, (match) => {
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

// ── Public interface ──────────────────────────────────────────────────────────

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequest {
  orgId: string;
  runId?: string;
  messages: CoachMessage[];
  message: string;
  memberRole?: "owner" | "employee";
  memberName?: string;
}

export interface CoachResponse {
  message: string;
  toolsUsed: string[];
}

// ── Smart context builder (replaces ~500 lines of manual field checks) ───────

/** Extract a concise summary from a priority section based on known field patterns */
function extractSectionSummary(key: string, val: any): string | null {
  if (!val || typeof val !== "object") return null;
  try {
    switch (key) {
      case "healthScore":
        return `Health Score: ${val.score ?? "?"}/100 (${val.grade || "N/A"})`;
      case "cashIntelligence":
        return `Cash Runway: ${val.runwayWeeks ?? "?"} weeks, Monthly burn: ${val.monthlyBurn || "N/A"}`;
      case "revenueLeakAnalysis":
        return `Revenue at Risk: $${val.totalIdentified?.toLocaleString() || "?"}, Leaks: ${val.leaks?.length ?? 0}`;
      case "actionPlan":
        return `Action Plan: ${val.days?.reduce((n: number, day: any) => n + (day.tasks?.length ?? 0), 0) ?? 0} tasks across ${val.days?.length ?? 0} days`;
      case "issuesRegister": {
        const critical = val.issues?.filter((i: any) => i.severity === "Critical" || i.severity === "HIGH")?.length ?? 0;
        return `Issues: ${val.issues?.length ?? 0} total, ${critical} critical`;
      }
      case "kpiReport":
        return `KPIs: ${val.kpis?.length ?? 0} defined, ${val.kpis?.filter((k: any) => k.status === "at_risk" || k.status === "behind")?.length ?? 0} at risk`;
      case "executiveSummary":
        return `Executive Summary: ${val.summary ? String(val.summary).slice(0, 200) : "Available"}`;
      case "hiringPlan":
        return `Hiring Plan: ${val.recommendations?.length ?? 0} roles recommended, ${val.currentTeamGaps?.length ?? 0} gaps`;
      case "healthChecklist":
        return `Health Checklist: ${val.score ?? "?"}/100 (${val.grade || "N/A"})`;
      case "goalTracker":
        return `Goals: ${val.objectives?.length ?? 0} objectives, Theme: ${val.quarterlyTheme || "N/A"}`;
      case "benchmarkScore":
        return `Benchmark: ${val.overallScore ?? "?"}/100 (${val.overallPercentile || "N/A"})`;
      case "riskRegister": {
        const highRisks = val.risks?.filter((r: any) => r.severity === "Critical" || r.severity === "High")?.length ?? 0;
        return `Risks: ${val.risks?.length ?? 0} total, ${highRisks} high/critical`;
      }
      case "swotAnalysis":
        return `SWOT: ${val.strengths?.length ?? 0} strengths, ${val.weaknesses?.length ?? 0} weaknesses, ${val.opportunities?.length ?? 0} opportunities, ${val.threats?.length ?? 0} threats`;
      case "salesPlaybook":
        return `Sales Playbook: Available${val.stages?.length ? `, ${val.stages.length} stages` : ""}`;
      case "churnPlaybook":
        return `Churn Playbook: Available${val.plays?.length ? `, ${val.plays.length} plays` : ""}`;
      case "fundingReadiness":
        return `Funding Readiness: ${val.readinessScore ?? "N/A"}/100 (${val.stage || "N/A"})`;
      case "gtmScorecard":
        return `GTM Score: ${val.overallScore ?? "N/A"}/100`;
      case "cashOptimization":
        return `Cash Optimization: ${val.opportunities?.length ?? 0} opportunities`;
      case "toolsAutomationPlan":
        return `Tools & Automation: ${val.tools?.length ?? 0} tools, Cost: $${val.totalMonthlyCost ?? "N/A"}/mo, Savings: $${val.totalMonthlySavings ?? "N/A"}/mo, ROI: ${val.roiMonths ?? "N/A"} months`;
      default:
        return null;
    }
  } catch {
    return `${key}: Available`;
  }
}

/** Build business context from deliverables using smart auto-detection */
function buildBusinessContext(d: MVPDeliverables): string {
  const parts: string[] = [];

  // Priority sections - always include detailed summary
  const prioritySections = [
    "healthScore", "cashIntelligence", "revenueLeakAnalysis", "actionPlan",
    "issuesRegister", "kpiReport", "executiveSummary", "hiringPlan",
    "healthChecklist", "goalTracker", "benchmarkScore", "riskRegister",
    "swotAnalysis", "salesPlaybook", "churnPlaybook", "fundingReadiness",
    "gtmScorecard", "cashOptimization", "toolsAutomationPlan",
  ];

  for (const key of prioritySections) {
    const val = (d as any)[key];
    if (!val) continue;
    const summary = extractSectionSummary(key, val);
    if (summary) parts.push(summary);
  }

  // Other sections: only include those with concerning scores (< 50) or actionable data
  const otherKeys = Object.keys(d).filter(
    (k) => !prioritySections.includes(k) && (d as any)[k] != null
  );

  const flaggedLines: string[] = [];
  for (const key of otherKeys) {
    const val = (d as any)[key];
    if (!val || typeof val !== "object") continue;
    const score = val.overallScore ?? val.score ?? val.readinessScore ?? null;
    if (score !== null && score < 50) {
      flaggedLines.push(`  ${key}: Score ${score}/100 — NEEDS ATTENTION`);
    } else if (val.overallRiskScore !== undefined && val.overallRiskScore > 60) {
      flaggedLines.push(`  ${key}: Risk ${val.overallRiskScore}/100 — HIGH RISK`);
    }
  }

  if (flaggedLines.length > 0) {
    parts.push(`\nFLAGGED SECTIONS (low scores or high risk):\n${flaggedLines.join("\n")}`);
  }

  parts.push(`\n${otherKeys.length} additional report sections available via get_report_section tool.`);

  return parts.join("\n");
}

/** Detect critical business patterns that need proactive coaching */
function getBusinessTriggers(d: MVPDeliverables): string | null {
  const triggers: string[] = [];

  if (d.healthScore?.score != null && d.healthScore.score < 50)
    triggers.push(`CRITICAL: Business health score is ${d.healthScore.score}/100 - needs immediate attention across multiple areas`);

  if (d.cashIntelligence?.runwayWeeks != null && d.cashIntelligence.runwayWeeks < 8)
    triggers.push(`URGENT: Cash runway is only ${d.cashIntelligence.runwayWeeks} weeks - address cash burn immediately`);

  if (d.revenueLeakAnalysis?.totalIdentified != null && d.revenueLeakAnalysis.totalIdentified > 50000)
    triggers.push(`ALERT: $${d.revenueLeakAnalysis.totalIdentified.toLocaleString()} in revenue leaks identified - prioritize recovery`);

  const issues = (d as any).issuesRegister?.issues;
  if (Array.isArray(issues)) {
    const critCount = issues.filter((i: any) => i.severity === "Critical" || i.severity === "HIGH").length;
    if (critCount >= 3) triggers.push(`WARNING: ${critCount} critical issues in the issues register need urgent attention`);
  }

  const risks = (d as any).riskRegister?.risks;
  if (Array.isArray(risks)) {
    const highRisks = risks.filter((r: any) => r.severity === "Critical" || r.severity === "High").length;
    if (highRisks >= 3) triggers.push(`RISK ALERT: ${highRisks} high/critical risks identified in risk register`);
  }

  const kpis = d.kpiReport?.kpis;
  if (Array.isArray(kpis)) {
    const atRisk = kpis.filter((k) => k.status === "at_risk" || k.status === "behind").length;
    if (atRisk >= 3) triggers.push(`KPI ALERT: ${atRisk} KPIs are behind or at risk - review priorities`);
  }

  if ((d as any).benchmarkScore?.overallScore != null && (d as any).benchmarkScore.overallScore < 40)
    triggers.push(`BENCHMARK: Business scores ${(d as any).benchmarkScore.overallScore}/100 vs industry peers - significant gaps to close`);

  if ((d as any).exitReadiness?.overallScore != null && (d as any).exitReadiness.overallScore < 30)
    triggers.push(`EXIT READINESS: Score is ${(d as any).exitReadiness.overallScore}/100 - major preparation needed before any exit event`);

  if (triggers.length === 0) return null;
  return `--- Proactive Coaching Triggers ---\n${triggers.join("\n")}`;
}

export async function chatWithCoach(params: CoachRequest): Promise<CoachResponse> {
  const { orgId, runId, messages, message, memberRole, memberName } = params;
  const toolsUsed: string[] = [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Coach is not available. GEMINI_API_KEY is not configured.", toolsUsed };
  }

  // Build business context using smart auto-detection
  let reportContext = "";
  let triggerContext = "";
  const job = await findJobForOrg(orgId, runId);
  if (job?.deliverables) {
    const d = job.deliverables as MVPDeliverables;
    reportContext = `\n\nBUSINESS CONTEXT:\n${buildBusinessContext(d)}`;
    const triggers = getBusinessTriggers(d);
    if (triggers) triggerContext = `\n\n${triggers}`;
  }

  // Situational awareness (BetterBot-style)
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dayStr = now.toLocaleDateString("en-US", { weekday: "long" });
  const situationalAwareness = `\n\n--- Situational Awareness ---\n${timeStr}, ${dayStr}, ${dateStr}\nConversation: ${messages.length} messages so far`;

  const roleContext =
    memberRole === "owner"
      ? "\nThe user is the BUSINESS OWNER. They can ask about team performance, hiring/firing, and strategic decisions."
      : memberName
        ? `\nThe user is ${memberName}, an EMPLOYEE. Coach them on their personal performance and daily priorities.`
        : "";

  const systemPrompt = COACH_SYSTEM_PROMPT_HEADER + reportContext + triggerContext + situationalAwareness + roleContext;

  // Build conversation history for Gemini
  const trimmedHistory = messages.slice(-16);
  const chatMessages = trimmedHistory.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
    parts: [{ text: m.content }],
  }));
  chatMessages.push({ role: "user", parts: [{ text: message }] });

  try {
    // Multi-turn tool loop: keep calling Gemini until it responds with text (no tool calls)
    // or we hit the max rounds limit. This lets the coach chain tools like:
    // check_inbox → get_report_section → generate_action_items in one user turn.
    const contents: Array<{ role: string; parts: any[] }> = [...chatMessages];
    const guard = new LoopGuard();
    const embeddedMarkers: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS - 1;

      const resp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
          ...(isLastRound ? {} : {
            tools: [{ functionDeclarations: TOOLS }],
            toolConfig: { functionCallingMode: "AUTO" },
          }),
        } as Record<string, unknown>,
      });

      const candidate = resp.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const fnCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");

      // No tool calls — we have our final text response
      if (fnCalls.length === 0) {
        if (!textParts.trim() && round === 0) {
          console.warn(`[Coach] Empty response on round 0, retrying...`);
          continue;
        }

        // Quality check: if vague and we have rounds left, push back for specificity
        const quality = detectVagueResponse(textParts);
        if (quality.isVague && round < MAX_TOOL_ROUNDS - 1) {
          console.warn(`[Coach] Vague response detected (${quality.reason}), nudging for specificity...`);
          contents.push({ role: "model", parts: [{ text: textParts }] });
          contents.push({ role: "user", parts: [{ text: SPECIFICITY_NUDGE }] });
          continue;
        }

        let finalMessage = sanitize(textParts || "I couldn't generate a response. Please try again.");
        if (embeddedMarkers.length > 0) {
          finalMessage = finalMessage + "\n\n" + embeddedMarkers.join("\n");
        }
        return { message: finalMessage, toolsUsed };
      }

      // Execute all tool calls for this round
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          let { name, args: toolArgs } = part.functionCall;

          if (!COACH_TOOL_NAMES.includes(name)) {
            const matched = closestToolName(name, COACH_TOOL_NAMES);
            if (matched) {
              console.warn(`[Coach] Tool name corrected: "${name}" -> "${matched}"`);
              name = matched;
            }
          }

          const guardResult = guard.check(name, toolArgs);
          if (!guardResult.allowed) {
            console.warn(`[Coach] LoopGuard blocked: ${guardResult.warning}`);
            return { name, result: `Tool call blocked by safety guard: ${guardResult.warning}` };
          }
          if (guardResult.warning) {
            console.warn(`[Coach] LoopGuard warning: ${guardResult.warning}`);
          }

          toolsUsed.push(name);
          const rawResult = await executeTool(name, toolArgs as Record<string, unknown>, orgId, runId);
          const validated = validateToolResult(name, String(toolArgs.query ?? toolArgs.section ?? toolArgs.provider ?? ""), rawResult);
          if (validated.warning) {
            console.warn(`[Coach] Tool validation (${name}): ${validated.warning}`);
          }
          return { name, result: validated.content };
        })
      );

      // Extract markers from tool results
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

      // Append model's tool-call turn + tool results to contents for next round
      contents.push({ role: "model", parts });
      contents.push({
        role: "user",
        parts: cleanedToolResults.map((tr) => ({
          functionResponse: { name: tr.name, response: { result: tr.result } },
        })),
      });

      console.log(`[Coach] Tool round ${round + 1}/${MAX_TOOL_ROUNDS}: used ${toolResults.map(t => t.name).join(", ")}`);
    }

    // Exhausted all rounds — force a final text-only call
    const finalResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 1500,
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    let finalMessage = sanitize(finalResp.text || "I couldn't generate a response. Please try again.");
    if (embeddedMarkers.length > 0) {
      finalMessage = finalMessage + "\n\n" + embeddedMarkers.join("\n");
    }
    return { message: finalMessage, toolsUsed };

  } catch (err) {
    console.error("[Coach] Agent error:", err);
    return {
      message: "Coach is temporarily unavailable. Please try again.",
      toolsUsed,
    };
  }
}
