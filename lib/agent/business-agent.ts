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
import { getJob, listJobs } from "@/lib/job-store";
import type { ChatMessage, AgentMemory, MVPDeliverables } from "@/lib/types";

const FLASH_MODEL = "gemini-3-flash-preview";
const MAX_HISTORY_MESSAGES = 16;

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
      job = getJob(runId);
    } else {
      // Get most recent completed job for this org
      const allJobs = listJobs();
      job = allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed")
        ?? allJobs.find((j) => j.status === "completed");
    }

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    return `[Report Section: ${section}]\n${JSON.stringify(sectionData, null, 2)}`;
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
    const allJobs = listJobs();
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
        model: "gemini-2.5-flash-preview-05-20",
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
      return `[Projection Generated]\n${projection.insight}\n${projection.totalImpact}\n\n<!--PROJECTION:${JSON.stringify(projection)}-->`;
    } catch (e) {
      return `Projection generation failed: ${String(e)}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")   // em dash
    .replace(/\u2013/g, " - ")   // en dash
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();
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

Remember: You have access to their full report via tools. Use get_report_section when you need specifics.`;
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

  const memory = getAgentMemory(req.orgId);
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
      // Execute all requested tools
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          const { name, args } = part.functionCall;
          toolsUsed.push(name);
          const result = await executeTool(name, args as Record<string, unknown>, req.orgId);
          return { name, result };
        })
      );

      // Second call with tool results
      const contentsWithTools = [
        ...contents,
        { role: "model" as const, parts },
        {
          role: "user" as const,
          parts: toolResults.map((tr) => ({
            functionResponse: { name: tr.name, response: { result: tr.result } },
          })),
        },
      ];

      const resp2 = await genai.models.generateContent({
        model: FLASH_MODEL,
        contents: contentsWithTools,
        config: {
          systemInstruction: buildSystemPrompt(memory),
          temperature: 0.4,
          maxOutputTokens: 2000,
        } as Record<string, unknown>,
      });

      return {
        message: sanitize(resp2.text ?? "I encountered an issue generating a response. Please try again."),
        toolsUsed,
      };
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
