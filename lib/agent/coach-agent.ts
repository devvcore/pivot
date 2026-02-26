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
import type { MVPDeliverables } from "@/lib/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const COACH_SYSTEM_PROMPT = `You are Coach, a direct and data-driven business performance advisor for Pivot.

CRITICAL ANTI-HALLUCINATION RULES:
- ONLY reference data that exists in the business report or uploaded team records
- If asked about employee performance and no performance data exists, say: "I don't have performance data for your team yet. Upload payroll, performance reviews, or CRM activity data so I can give you real numbers instead of guesses."
- NEVER invent employee names, salaries, performance metrics, or team statistics
- If data is insufficient, say so clearly — do NOT fill gaps with plausible-sounding numbers
- Be brutally honest but constructive — frame everything in terms of business impact and ROI

FOR OWNERS:
- Analyze team cost vs output (only with real data)
- Recommend who to invest in or let go (only with evidence)
- Identify performance gaps and hiring needs
- Create prioritized daily/weekly action items
- Answer "who should I fire?" honestly — but only if you have the data

FOR EMPLOYEES:
- Show their assigned KPIs and progress
- Suggest specific daily actions to improve their metrics
- Coach on skills relevant to their role
- Explain how their work impacts business outcomes

STYLE RULES:
- Lead with numbers, not feelings
- Give specific next steps, not vague advice
- Reference actual business data from the report
- When you don't know something, say so — don't guess
- Keep responses focused and actionable (not long essays)
- Use bullet points and structure when listing actions
- Do NOT use em dashes, en dashes, double dashes, or asterisks. Use plain text only.

You have access to the business report via the get_report_section tool. Use it to ground your advice in real data.

KEY SECTIONS FOR COACHING:
- hiringPlan: team gaps, recommended hires, role priorities, and timeline
- kpiReport: KPIs by role and department, current vs target values, status tracking
- goalTracker: OKR objectives, key results, quarterly themes, suggested objectives
- healthChecklist: operational health items, completion status, grades
- actionPlan: prioritized daily tasks with owners
- issuesRegister: critical issues that need team attention
- swotAnalysis: strengths/weaknesses relevant to team development
- salesPlaybook: sales process, objection handling, talk tracks for sales team coaching
- churnPlaybook: retention plays and escalation triggers for customer-facing teams
- benchmarkScore: how the team and business compare to industry peers
- executiveSummary: high-level view of wins, risks, and priorities
- milestoneTracker: key business milestones, progress, and upcoming deadlines
- riskRegister: identified risks, severity, likelihood, mitigation strategies
- gtmScorecard: go-to-market performance metrics, channel effectiveness, conversion rates
- fundingReadiness: investor readiness assessment, gaps to close, fundraising preparation
- retentionPlaybook: customer retention strategies, engagement tactics, loyalty programs
- cashOptimization: cash flow optimization levers, cost reduction opportunities, working capital improvements
- operationalEfficiency: process bottlenecks, automation opportunities, resource utilization
- talentGapAnalysis: team strengths, skill gaps, hiring priorities, upskilling recommendations
- revenueDiversification: revenue stream analysis, diversification opportunities, concentration risk
- customerJourneyMap: customer touchpoints, friction points, conversion optimization, experience scoring
- complianceChecklist: regulatory readiness, compliance gaps, immediate actions, risk areas
- expansionPlaybook: market expansion opportunities, go-to-market strategies, resource requirements
- vendorScorecard: vendor performance, total spend, potential savings, contract optimization
- productMarketFit: PMF score, indicators, target segment fit, improvement actions
- brandHealth: brand score, dimensions, positioning, messaging guidelines
- pricingElasticity: price sensitivity, tier analysis, bundling opportunities
- strategicInitiatives: strategic bets, ROI projections, resource constraints
- cashConversionCycle: DSO/DPO/DIO metrics, working capital efficiency
- innovationPipeline: innovation score, project portfolio, stage pipeline
- stakeholderMap: key stakeholders, influence levels, communication strategies
- decisionLog: pending decisions, critical decisions, decision framework
- cultureAssessment: culture score, dimensions, core values, alignment gaps
- ipPortfolio: IP assets, protection status, filing recommendations
- exitReadiness: exit score, valuation range, preparation steps
- sustainabilityScore: ESG scores, material issues, regulatory requirements
- acquisitionTargets: M&A strategy, target companies, synergies, fit scores
- financialRatios: liquidity, profitability, leverage, efficiency ratios vs industry
- channelMixModel: marketing channel performance, budget allocation optimization
- supplyChainRisk: vendor dependencies, single points of failure, contingency plans
- regulatoryLandscape: compliance scoring, current and upcoming regulations
- crisisPlaybook: crisis scenarios, response plans, communication templates
- aiReadiness: AI adoption readiness scores, capabilities, quick wins
- networkEffects: network effect types, viral coefficient, moat strength
- dataMonetization: data assets, monetization methods, opportunity value
- subscriptionMetrics: SaaS metrics (MRR, ARR, CAC, LTV, churn, NRR)
- marketTiming: timing factors, window of opportunity, market cycle
- scenarioStressTest: stress scenarios, survival probability, capital buffer
- pricingStrategyMatrix: pricing tiers, anchor pricing, bundling, psychological pricing
- customerHealthScore: customer portfolio health, engagement levels, churn predictors
- revenueWaterfall: MRR waterfall, NRR, GRR, expansion/contraction rates
- techDebtAssessment: technical debt items, severity, business impact, remediation
- teamPerformance: team metrics, strengths, gaps, training needs
- marketEntryStrategy: new market options, readiness, barriers, entry modes
- competitiveIntelFeed: competitor signals, market shifts, opportunity windows
- cashFlowSensitivity: cash flow sensitivity variables, safety margin, scenarios
- digitalMaturity: digital transformation dimensions, maturity levels, priorities
- acquisitionFunnel: funnel stages, conversion rates, bottlenecks, CPA
- strategicAlignment: vision/goals/resources/execution alignment scores
- budgetOptimizer: budget categories, ROI, efficiency, reallocation suggestions
- revenueDrivers: Revenue growth drivers, concentration risk, seasonality patterns
- marginOptimization: Gross/net margins, cost structure, per-product profitability
- demandForecasting: Demand signals, seasonality, trend direction
- cohortAnalysis: Retention cohorts, expansion revenue, churn trends
- winLossAnalysis: Deal win rates, competitive losses, sales objections
- salesForecast: Pipeline forecasting, quota attainment, deal conversion
- processEfficiency: Process bottlenecks, automation savings, lean metrics
- vendorRisk: Vendor dependencies, concentration risk, SLA compliance
- qualityMetrics: Quality scores, CSAT/NPS, defect rates
- capacityPlanning: Resource utilization, scaling triggers, headcount planning
- knowledgeManagement: Documentation gaps, tribal knowledge risks
- complianceScorecard: Regulatory compliance, audit readiness, policy gaps
- marketPenetration: Market share, penetration rates, untapped segments
- flywheelAnalysis: Growth loops, momentum, friction points
- partnershipsStrategy: Partner candidates, ecosystem strategy, integration planning
- internationalExpansion: International market opportunities, regulatory barriers
- rdEffectiveness: R&D ROI, project success rates, innovation velocity
- brandEquity: Brand awareness, perception, loyalty, competitive positioning
- workingCapital: Cash conversion cycle, DSO/DPO/DIO, working capital optimization
- debtStrategy: Debt structure, capacity, refinancing opportunities
- taxStrategy: Tax efficiency, R&D credits, entity structure
- investorReadiness: Pitch readiness, metrics completeness, due diligence prep
- maReadiness: M&A valuation, synergy potential, integration planning
- strategicRoadmap: Strategic pillars, milestones, 1/3/5 year goals, OKRs`;

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
];

// ── Tool execution ────────────────────────────────────────────────────────────

function findJobForOrg(orgId: string, runId?: string): ReturnType<typeof getJob> {
  if (runId) {
    return getJob(runId);
  }
  const allJobs = listJobs();
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
    const job = findJobForOrg(orgId, runId);

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    // Truncate to avoid token overflow
    const json = JSON.stringify(sectionData, null, 2);
    return `[Report Section: ${section}]\n${json.slice(0, 3000)}`;
  }

  if (toolName === "get_team_data") {
    // Team data would come from uploaded HR/payroll documents
    // For now, check if the report has any employee-related data
    const job = findJobForOrg(orgId, runId);

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
    const job = findJobForOrg(orgId, runId);

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

export async function chatWithCoach(params: CoachRequest): Promise<CoachResponse> {
  const { orgId, runId, messages, message, memberRole, memberName } = params;
  const toolsUsed: string[] = [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Coach is not available. GEMINI_API_KEY is not configured.", toolsUsed };
  }

  // Build business context from report
  let reportContext = "";
  const job = findJobForOrg(orgId, runId);
  if (job?.deliverables) {
    const d = job.deliverables as MVPDeliverables;
    const parts: string[] = [];
    if (d.healthScore) parts.push(`Health Score: ${d.healthScore.score}/100 (${d.healthScore.grade || "N/A"})`);
    if (d.cashIntelligence) parts.push(`Cash Runway: ${d.cashIntelligence.runwayWeeks ?? "?"} weeks`);
    if (d.revenueLeakAnalysis) parts.push(`Revenue at Risk: $${d.revenueLeakAnalysis.totalIdentified?.toLocaleString() || "?"}`);
    if (d.kpiReport) parts.push(`KPIs defined: ${d.kpiReport.kpis?.length || 0}`);
    if (d.healthChecklist) parts.push(`Health Checklist: ${d.healthChecklist.score}/100 (${d.healthChecklist.grade})`);
    if (d.hiringPlan) parts.push(`Hiring Plan: ${d.hiringPlan.recommendations?.length || 0} hiring recommendations, ${d.hiringPlan.currentTeamGaps?.length || 0} team gaps identified`);
    if (d.goalTracker) parts.push(`Goal Tracker: ${d.goalTracker.objectives?.length || 0} objectives, theme: ${d.goalTracker.quarterlyTheme || "N/A"}`);
    if (d.benchmarkScore) parts.push(`Benchmark Score: ${d.benchmarkScore.overallScore}/100 (${d.benchmarkScore.overallPercentile || "N/A"})`);
    if ((d as any).milestoneTracker) parts.push(`Milestone Tracker: ${(d as any).milestoneTracker.milestones?.length || 0} milestones tracked`);
    if ((d as any).riskRegister) parts.push(`Risk Register: ${(d as any).riskRegister.risks?.length || 0} risks identified`);
    if ((d as any).gtmScorecard) parts.push(`GTM Scorecard: ${(d as any).gtmScorecard.overallScore ?? "N/A"}/100`);
    if ((d as any).fundingReadiness) parts.push(`Funding Readiness: ${(d as any).fundingReadiness.readinessScore ?? "N/A"}/100 (${(d as any).fundingReadiness.stage || "N/A"})`);
    if ((d as any).cashOptimization) parts.push(`Cash Optimization: ${(d as any).cashOptimization.opportunities?.length || 0} optimization opportunities identified`);
    if ((d as any).talentGapAnalysis) parts.push(`Talent Gap Analysis: Team strengths: ${(d as any).talentGapAnalysis.currentTeamStrengths?.length || 0} identified, Roles to hire: ${(d as any).talentGapAnalysis.roleRecommendations?.length || 0}`);
    if ((d as any).complianceChecklist) parts.push(`Compliance Checklist: Overall readiness: ${(d as any).complianceChecklist.overallReadiness ?? "N/A"}, Immediate actions: ${(d as any).complianceChecklist.immediateActions?.length || 0}`);
    if ((d as any).vendorScorecard) parts.push(`Vendor Scorecard: Total spend: ${(d as any).vendorScorecard.totalVendorSpend || "?"}, Potential savings: ${(d as any).vendorScorecard.totalPotentialSavings || "?"}`);
    if ((d as any).productMarketFit) parts.push(`Product-Market Fit: Overall score: ${(d as any).productMarketFit.overallScore ?? "N/A"}, Grade: ${(d as any).productMarketFit.grade || "N/A"}`);
    if ((d as any).brandHealth) parts.push(`Brand Health: Overall score: ${(d as any).brandHealth.overallScore ?? "N/A"}, Brand strength: ${(d as any).brandHealth.brandStrength || "N/A"}`);
    if ((d as any).innovationPipeline) parts.push(`Innovation Pipeline: Innovation score: ${(d as any).innovationPipeline.innovationScore ?? "N/A"}, Projects: ${(d as any).innovationPipeline.projects?.length || 0}`);
    if ((d as any).exitReadiness) parts.push(`Exit Readiness: Score: ${(d as any).exitReadiness.overallScore ?? "N/A"}/100, Valuation range: ${(d as any).exitReadiness.valuationRange || "N/A"}`);
    if ((d as any).cultureAssessment) parts.push(`Culture Assessment: Score: ${(d as any).cultureAssessment.overallScore ?? "N/A"}/100, Culture type: ${(d as any).cultureAssessment.cultureType || "N/A"}`);
    if ((d as any).sustainabilityScore) parts.push(`Sustainability Score: Score: ${(d as any).sustainabilityScore.overallScore ?? "N/A"}/100, Grade: ${(d as any).sustainabilityScore.grade || "N/A"}`);
    if ((d as any).acquisitionTargets) parts.push(`M&A Strategy: ${(d as any).acquisitionTargets.strategy || "N/A"}, Targets identified: ${(d as any).acquisitionTargets.targets?.length ?? 0}`);
    if ((d as any).financialRatios) parts.push(`Financial Health: ${(d as any).financialRatios.overallHealth || "N/A"}`);
    if ((d as any).channelMixModel) parts.push(`Top Channel: ${(d as any).channelMixModel.topPerformingChannel || "N/A"}`);
    if ((d as any).supplyChainRisk) parts.push(`Supply Chain Risk: ${(d as any).supplyChainRisk.overallRiskScore ?? "N/A"}/100`);
    if ((d as any).regulatoryLandscape) parts.push(`Compliance Score: ${(d as any).regulatoryLandscape.overallComplianceScore ?? "N/A"}/100`);
    if ((d as any).crisisPlaybook) parts.push(`Crisis Scenarios: ${(d as any).crisisPlaybook.scenarios?.length ?? 0} prepared`);
    if ((d as any).aiReadiness) parts.push(`AI Readiness: ${(d as any).aiReadiness.overallScore ?? "N/A"}/100`);
    if ((d as any).networkEffects) parts.push(`Network Effects: ${(d as any).networkEffects.moatStrength || "N/A"} moat, Score: ${(d as any).networkEffects.overallScore ?? "N/A"}/100`);
    if ((d as any).dataMonetization) parts.push(`Data Monetization: ${(d as any).dataMonetization.totalOpportunityValue || "N/A"} opportunity`);
    if ((d as any).subscriptionMetrics) parts.push(`SaaS Health: ${(d as any).subscriptionMetrics.overallHealth || "N/A"}`);
    if ((d as any).marketTiming) parts.push(`Market Timing: ${(d as any).marketTiming.overallTiming || "N/A"}`);
    if ((d as any).scenarioStressTest) parts.push(`Stress Resilience: ${(d as any).scenarioStressTest.resilience || "N/A"}, Baseline Runway: ${(d as any).scenarioStressTest.baselineCashRunway || "N/A"}`);
    if ((d as any).pricingStrategyMatrix) parts.push(`Pricing Strategy: ${(d as any).pricingStrategyMatrix.recommendedStrategy || "N/A"}`);
    if ((d as any).customerHealthScore) parts.push(`Customer Portfolio Health: ${(d as any).customerHealthScore.overallPortfolioHealth ?? "N/A"}/100, At-risk: ${(d as any).customerHealthScore.atRiskCount ?? 0}`);
    if ((d as any).revenueWaterfall) parts.push(`Net Revenue Retention: ${(d as any).revenueWaterfall.netRevenueRetention || "N/A"}`);
    if ((d as any).techDebtAssessment) parts.push(`Tech Debt Score: ${(d as any).techDebtAssessment.overallScore ?? "N/A"}/100, Cost: ${(d as any).techDebtAssessment.totalEstimatedCost || "N/A"}`);
    if ((d as any).teamPerformance) parts.push(`Team Performance: ${(d as any).teamPerformance.overallScore ?? "N/A"}/100`);
    if ((d as any).marketEntryStrategy) parts.push(`Market Entry Readiness: ${(d as any).marketEntryStrategy.readinessScore ?? "N/A"}/100, Priority: ${(d as any).marketEntryStrategy.priorityMarket || "N/A"}`);
    if ((d as any).competitiveIntelFeed) parts.push(`Competitive Threat Level: ${(d as any).competitiveIntelFeed.threatLevel || "N/A"}, Signals: ${(d as any).competitiveIntelFeed.signals?.length ?? 0}`);
    if ((d as any).cashFlowSensitivity) parts.push(`Cash Sensitivity: Most sensitive to ${(d as any).cashFlowSensitivity.mostSensitiveVariable || "N/A"}`);
    if ((d as any).digitalMaturity) parts.push(`Digital Maturity: ${(d as any).digitalMaturity.overallScore ?? "N/A"}/100`);
    if ((d as any).acquisitionFunnel) parts.push(`Acquisition Funnel: ${(d as any).acquisitionFunnel.overallConversionRate || "N/A"} conversion, CPA: ${(d as any).acquisitionFunnel.costPerAcquisition || "N/A"}`);
    if ((d as any).strategicAlignment) parts.push(`Strategic Alignment: ${(d as any).strategicAlignment.overallScore ?? "N/A"}/100`);
    if ((d as any).budgetOptimizer) parts.push(`Budget: ${(d as any).budgetOptimizer.totalBudget || "N/A"}, Savings: ${(d as any).budgetOptimizer.savingsOpportunity || "N/A"}`);
    if ((d as any).revenueDrivers) parts.push(`Revenue Drivers: Top driver: ${(d as any).revenueDrivers.topDriver || "N/A"}, Concentration risk: ${(d as any).revenueDrivers.concentrationRisk || "N/A"}`);
    if ((d as any).marginOptimization) parts.push(`Margin Optimization: Gross margin: ${(d as any).marginOptimization.grossMargin || "N/A"}, Net margin: ${(d as any).marginOptimization.netMargin || "N/A"}`);
    if ((d as any).demandForecasting) parts.push(`Demand Forecast: Trend: ${(d as any).demandForecasting.trendDirection || "N/A"}, Confidence: ${(d as any).demandForecasting.confidence || "N/A"}`);
    if ((d as any).cohortAnalysis) parts.push(`Cohort Analysis: Retention rate: ${(d as any).cohortAnalysis.overallRetention || "N/A"}, Best cohort: ${(d as any).cohortAnalysis.bestCohort || "N/A"}`);
    if ((d as any).winLossAnalysis) parts.push(`Win/Loss: Win rate: ${(d as any).winLossAnalysis.winRate || "N/A"}, Top loss reason: ${(d as any).winLossAnalysis.topLossReason || "N/A"}`);
    if ((d as any).salesForecast) parts.push(`Sales Forecast: Pipeline value: ${(d as any).salesForecast.pipelineValue || "N/A"}, Forecast accuracy: ${(d as any).salesForecast.forecastAccuracy || "N/A"}`);
    if ((d as any).processEfficiency) parts.push(`Process Efficiency: Score: ${(d as any).processEfficiency.overallScore ?? "N/A"}/100, Bottlenecks: ${(d as any).processEfficiency.bottlenecks?.length ?? 0}`);
    if ((d as any).vendorRisk) parts.push(`Vendor Risk: Overall risk: ${(d as any).vendorRisk.overallRisk || "N/A"}, Critical vendors: ${(d as any).vendorRisk.criticalVendors?.length ?? 0}`);
    if ((d as any).qualityMetrics) parts.push(`Quality Metrics: CSAT: ${(d as any).qualityMetrics.csat || "N/A"}, NPS: ${(d as any).qualityMetrics.nps ?? "N/A"}`);
    if ((d as any).capacityPlanning) parts.push(`Capacity Planning: Utilization: ${(d as any).capacityPlanning.currentUtilization || "N/A"}, Scaling trigger: ${(d as any).capacityPlanning.scalingTrigger || "N/A"}`);
    if ((d as any).knowledgeManagement) parts.push(`Knowledge Management: Documentation coverage: ${(d as any).knowledgeManagement.coverageScore ?? "N/A"}%, Tribal knowledge risks: ${(d as any).knowledgeManagement.tribalKnowledgeRisks?.length ?? 0}`);
    if ((d as any).complianceScorecard) parts.push(`Compliance Scorecard: Score: ${(d as any).complianceScorecard.overallScore ?? "N/A"}/100, Gaps: ${(d as any).complianceScorecard.gaps?.length ?? 0}`);
    if ((d as any).marketPenetration) parts.push(`Market Penetration: Current share: ${(d as any).marketPenetration.currentShare || "N/A"}, Penetration rate: ${(d as any).marketPenetration.penetrationRate || "N/A"}`);
    if ((d as any).flywheelAnalysis) parts.push(`Flywheel Analysis: Momentum: ${(d as any).flywheelAnalysis.momentum || "N/A"}, Friction points: ${(d as any).flywheelAnalysis.frictionPoints?.length ?? 0}`);
    if ((d as any).partnershipsStrategy) parts.push(`Partnerships Strategy: Partners identified: ${(d as any).partnershipsStrategy.partnerCandidates?.length ?? 0}, Ecosystem: ${(d as any).partnershipsStrategy.ecosystemStrategy || "N/A"}`);
    if ((d as any).internationalExpansion) parts.push(`International Expansion: Priority market: ${(d as any).internationalExpansion.priorityMarket || "N/A"}, Readiness: ${(d as any).internationalExpansion.readinessScore ?? "N/A"}/100`);
    if ((d as any).rdEffectiveness) parts.push(`R&D Effectiveness: ROI: ${(d as any).rdEffectiveness.rdRoi || "N/A"}, Success rate: ${(d as any).rdEffectiveness.projectSuccessRate || "N/A"}`);
    if ((d as any).brandEquity) parts.push(`Brand Equity: Score: ${(d as any).brandEquity.overallScore ?? "N/A"}/100, Awareness: ${(d as any).brandEquity.awareness || "N/A"}`);
    if ((d as any).workingCapital) parts.push(`Working Capital: Cash conversion cycle: ${(d as any).workingCapital.cashConversionCycle || "N/A"} days, DSO: ${(d as any).workingCapital.dso || "N/A"}`);
    if ((d as any).debtStrategy) parts.push(`Debt Strategy: Total debt: ${(d as any).debtStrategy.totalDebt || "N/A"}, Capacity: ${(d as any).debtStrategy.debtCapacity || "N/A"}`);
    if ((d as any).taxStrategy) parts.push(`Tax Strategy: Effective rate: ${(d as any).taxStrategy.effectiveRate || "N/A"}, Savings opportunities: ${(d as any).taxStrategy.savingsOpportunities?.length ?? 0}`);
    if ((d as any).investorReadiness) parts.push(`Investor Readiness: Score: ${(d as any).investorReadiness.overallScore ?? "N/A"}/100, Gaps: ${(d as any).investorReadiness.gaps?.length ?? 0}`);
    if ((d as any).maReadiness) parts.push(`M&A Readiness: Score: ${(d as any).maReadiness.overallScore ?? "N/A"}/100, Valuation: ${(d as any).maReadiness.estimatedValuation || "N/A"}`);
    if ((d as any).strategicRoadmap) parts.push(`Strategic Roadmap: Pillars: ${(d as any).strategicRoadmap.strategicPillars?.length ?? 0}, Next milestone: ${(d as any).strategicRoadmap.nextMilestone || "N/A"}`);
    reportContext = `\n\nBUSINESS CONTEXT:\n${parts.join("\n")}`;
  }

  const roleContext =
    memberRole === "owner"
      ? "\nThe user is the BUSINESS OWNER. They can ask about team performance, hiring/firing, and strategic decisions."
      : memberName
        ? `\nThe user is ${memberName}, an EMPLOYEE. Coach them on their personal performance and daily priorities.`
        : "";

  const systemPrompt = COACH_SYSTEM_PROMPT + reportContext + roleContext;

  // Build conversation history for Gemini
  const trimmedHistory = messages.slice(-16);
  const chatMessages = trimmedHistory.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
    parts: [{ text: m.content }],
  }));
  chatMessages.push({ role: "user", parts: [{ text: message }] });

  try {
    // First call — may request tool use
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: chatMessages,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 1500,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: { functionCallingMode: "AUTO" },
      } as Record<string, unknown>,
    });

    // Check for tool calls
    const candidate = resp.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p: any) => p.functionCall);

    if (fnCalls.length > 0) {
      // Execute all requested tools
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          const { name, args: toolArgs } = part.functionCall;
          toolsUsed.push(name);
          const result = await executeTool(name, toolArgs as Record<string, unknown>, orgId, runId);
          return { name, result };
        })
      );

      // Second call with tool results
      const contentsWithTools = [
        ...chatMessages,
        { role: "model" as const, parts },
        {
          role: "user" as const,
          parts: toolResults.map((tr) => ({
            functionResponse: { name: tr.name, response: { result: tr.result } },
          })),
        },
      ];

      const resp2 = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-05-20",
        contents: contentsWithTools,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
          maxOutputTokens: 1500,
        } as Record<string, unknown>,
      });

      return {
        message: sanitize(resp2.text ?? "I couldn't generate a response. Please try again."),
        toolsUsed,
      };
    }

    return {
      message: sanitize(resp.text ?? "I couldn't generate a response. Please try again."),
      toolsUsed,
    };
  } catch (err) {
    console.error("[Coach] Agent error:", err);
    return {
      message: "Coach is temporarily unavailable. Please try again.",
      toolsUsed,
    };
  }
}
