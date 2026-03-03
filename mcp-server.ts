#!/usr/bin/env node
/**
 * Pivot BI — MCP (Model Context Protocol) Server
 *
 * Exposes Pivot analysis data so external AI agents (Claude Desktop, ChatGPT, etc.)
 * can query business intelligence results via the MCP standard.
 *
 * Transport: stdio
 * Database:  SQLite (better-sqlite3) at ./pivot.db
 *
 * Usage:
 *   npx tsx mcp-server.ts
 *
 * Claude Desktop config (add to claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "pivot": {
 *         "command": "npx",
 *         "args": ["tsx", "/Users/manny2fly/pivot/mcp-server.ts"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import path from "path";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Database setup
// ─────────────────────────────────────────────────────────────────────────────

const DB_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "pivot.db");

let db: Database.Database;
try {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma("journal_mode = WAL");
} catch (err) {
  // If the database doesn't exist yet, we'll handle it gracefully in each tool
  db = null as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  run_id: string;
  status: string;
  phase: string;
  organization_id: string;
  questionnaire_json: string | null;
  file_paths_json: string | null;
  parsed_context: string | null;
  results_json: string | null;
  knowledge_graph_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function safeJsonParse(raw: string | null | undefined, fallback: any = null): any {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getJobRow(runId: string): JobRow | null {
  if (!db) return null;
  try {
    const row = db.prepare("SELECT * FROM jobs WHERE run_id = ?").get(runId) as JobRow | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

function getDeliverables(runId: string): any | null {
  const row = getJobRow(runId);
  if (!row) return null;
  return safeJsonParse(row.results_json);
}

function textResult(data: any): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): { content: { type: "text"; text: string }[]; isError: true } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "pivot",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      "Pivot BI Server — query business analysis results. Use list_analyses to see available runs, then use a runId with any other tool to retrieve specific data.",
  }
);

// ─── Tool 1: list_analyses ──────────────────────────────────────────────────

server.tool(
  "list_analyses",
  "List all completed analyses with runId, organization name, date, and health score",
  {},
  async () => {
    if (!db) return errorResult("Database not available. Run an analysis first.");

    try {
      const rows = db
        .prepare("SELECT * FROM jobs WHERE status = 'completed' ORDER BY created_at DESC")
        .all() as JobRow[];

      const analyses = rows.map((row) => {
        const questionnaire = safeJsonParse(row.questionnaire_json, {});
        const deliverables = safeJsonParse(row.results_json, {});
        const healthScore = deliverables?.healthScore;

        return {
          runId: row.run_id,
          orgName: questionnaire?.organizationName ?? "Unknown",
          industry: questionnaire?.industry ?? "Unknown",
          status: row.status,
          date: row.created_at,
          healthScore: healthScore?.score ?? null,
          healthGrade: healthScore?.grade ?? null,
          healthHeadline: healthScore?.headline ?? null,
        };
      });

      return textResult({ count: analyses.length, analyses });
    } catch (err: any) {
      return errorResult(`Failed to list analyses: ${err.message}`);
    }
  }
);

// ─── Tool 2: get_health_score ───────────────────────────────────────────────

server.tool(
  "get_health_score",
  "Get health score, grade, headline, interpretation, and dimension breakdown for a specific analysis",
  { runId: z.string().describe("The run ID of the analysis (e.g. run_1234567890)") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const hs = deliverables.healthScore;
    if (!hs) return errorResult(`Health score not available for runId: ${runId}`);

    return textResult({
      score: hs.score,
      grade: hs.grade ?? null,
      headline: hs.headline ?? null,
      interpretation: hs.interpretation ?? null,
      summary: hs.summary ?? null,
      dimensions: hs.dimensions ?? [],
    });
  }
);

// ─── Tool 3: get_issues ─────────────────────────────────────────────────────

server.tool(
  "get_issues",
  "Get all issues from the issues register — includes severity, category, financial impact, and recommended action",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const ir = deliverables.issuesRegister;
    if (!ir) return errorResult(`Issues register not available for runId: ${runId}`);

    return textResult({
      totalIssues: ir.totalIssues ?? ir.issues?.length ?? 0,
      criticalCount: ir.criticalCount ?? null,
      highCount: ir.highCount ?? null,
      totalFinancialExposure: ir.totalFinancialExposure ?? null,
      issues: (ir.issues ?? []).map((issue: any) => ({
        id: issue.id,
        title: issue.title ?? null,
        description: issue.description,
        severity: issue.severity,
        category: issue.category ?? null,
        financialImpact: issue.financialImpact ?? null,
        timeToImpact: issue.timeToImpact ?? null,
        recommendedAction: issue.recommendedAction ?? issue.recommendation ?? null,
        owner: issue.owner ?? null,
      })),
    });
  }
);

// ─── Tool 4: get_recommendations ────────────────────────────────────────────

server.tool(
  "get_recommendations",
  "Get the action plan and recommendations — includes daily tasks, owners, and decision brief",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const result: any = {};

    // Action Plan
    if (deliverables.actionPlan) {
      const ap = deliverables.actionPlan;
      result.actionPlan = {
        summary: ap.summary ?? null,
        days: (ap.days ?? []).map((d: any) => ({
          day: d.day,
          title: d.title,
          tasks: d.tasks ?? [],
        })),
      };
    }

    // Decision Brief
    if (deliverables.decisionBrief) {
      const db = deliverables.decisionBrief;
      result.decisionBrief = {
        decision: db.decision,
        context: db.context,
        recommendation: db.recommendation,
        rationale: db.rationale ?? null,
        nextStep: db.nextStep ?? null,
        deadlineSuggestion: db.deadlineSuggestion ?? null,
        options: db.options ?? [],
      };
    }

    // At-risk customers
    if (deliverables.atRiskCustomers) {
      const arc = deliverables.atRiskCustomers;
      result.atRiskCustomers = {
        totalRevenueAtRisk: arc.totalRevenueAtRisk ?? null,
        immediateAction: arc.immediateAction ?? null,
        summary: arc.summary ?? null,
        customerCount: arc.customers?.length ?? 0,
      };
    }

    if (Object.keys(result).length === 0) {
      return errorResult(`No recommendations data available for runId: ${runId}`);
    }

    return textResult(result);
  }
);

// ─── Tool 5: get_financials ─────────────────────────────────────────────────

server.tool(
  "get_financials",
  "Get financial data — cash intelligence, revenue leak analysis, burn rate, and runway",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const result: any = {};

    // Cash Intelligence
    if (deliverables.cashIntelligence) {
      const ci = deliverables.cashIntelligence;
      result.cashIntelligence = {
        currentCashPosition: ci.currentCashPosition ?? null,
        runwayWeeks: ci.runwayWeeks ?? null,
        summary: ci.summary,
        topRisks: ci.topRisks ?? [],
        risks: ci.risks ?? [],
        recommendations: ci.recommendations ?? [],
        criticalWeeks: ci.criticalWeeks ?? [],
        weeklyProjections: ci.weeklyProjections ?? [],
      };
    }

    // Revenue Leak Analysis
    if (deliverables.revenueLeakAnalysis) {
      const rla = deliverables.revenueLeakAnalysis;
      result.revenueLeakAnalysis = {
        totalIdentified: rla.totalIdentified,
        totalRecoverable: rla.totalRecoverable ?? null,
        day90RecoveryProjection: rla.day90RecoveryProjection ?? null,
        priorityAction: rla.priorityAction ?? null,
        summary: rla.summary,
        items: (rla.items ?? []).map((item: any) => ({
          description: item.description,
          amount: item.amount,
          category: item.category ?? null,
          clientOrArea: item.clientOrArea ?? null,
          annualImpact: item.annualImpact ?? null,
          rootCause: item.rootCause ?? null,
          recoveryAction: item.recoveryAction ?? item.recoveryPlan ?? null,
          timeline: item.timeline ?? null,
        })),
      };
    }

    // Unit Economics (if available)
    if (deliverables.unitEconomics) {
      result.unitEconomics = deliverables.unitEconomics;
    }

    // Cash Optimization (if available)
    if (deliverables.cashOptimization) {
      result.cashOptimization = deliverables.cashOptimization;
    }

    if (Object.keys(result).length === 0) {
      return errorResult(`No financial data available for runId: ${runId}`);
    }

    return textResult(result);
  }
);

// ─── Tool 6: get_executive_summary ──────────────────────────────────────────

server.tool(
  "get_executive_summary",
  "Get the full executive summary — subject, key findings, critical actions, financial summary, and outlook",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const es = deliverables.executiveSummary;
    if (!es) return errorResult(`Executive summary not available for runId: ${runId}`);

    return textResult({
      subject: es.subject,
      greeting: es.greeting,
      keyFindings: es.keyFindings ?? [],
      criticalActions: es.criticalActions ?? [],
      financialSummary: es.financialSummary ?? null,
      outlook: es.outlook ?? null,
      fullSummary: es.fullSummary ?? null,
    });
  }
);

// ─── Tool 7: get_competitors ────────────────────────────────────────────────

server.tool(
  "get_competitors",
  "Get competitor analysis — competitor sites, industry leaders, positioning, and differentiation opportunities",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const result: any = {};

    // Competitor Analysis (website-based)
    if (deliverables.competitorAnalysis) {
      const ca = deliverables.competitorAnalysis;
      result.competitorAnalysis = {
        userWebsiteGrade: ca.userWebsiteGrade ?? null,
        suggestedPositioning: ca.suggestedPositioning ?? null,
        differentiationOpportunity: ca.differentiationOpportunity ?? null,
        headlineComparison: ca.headlineComparison ?? null,
        competitors: (ca.competitors ?? []).map((c: any) => ({
          url: c.url,
          grade: c.grade ?? c.profileGrade ?? null,
          score: c.score ?? c.profileScore ?? null,
          synopsis: c.synopsis ?? null,
          strengths: c.strengths ?? [],
          weaknesses: c.weaknesses ?? [],
        })),
        industryLeaders: (ca.industryLeaders ?? []).map((l: any) => ({
          url: l.url,
          grade: l.grade ?? l.profileGrade ?? null,
          score: l.score ?? l.profileScore ?? null,
          synopsis: l.synopsis ?? null,
          strengths: l.strengths ?? [],
          weaknesses: l.weaknesses ?? [],
        })),
        repositioningRecommendations: ca.repositioningRecommendations ?? [],
      };
    }

    // Competitive Intelligence Feed (if available)
    if (deliverables.competitiveIntelFeed) {
      result.competitiveIntelFeed = deliverables.competitiveIntelFeed;
    }

    // Competitive Moat (if available)
    if (deliverables.competitiveMoat) {
      result.competitiveMoat = deliverables.competitiveMoat;
    }

    // Competitive Win/Loss (if available)
    if (deliverables.competitiveWinLoss) {
      result.competitiveWinLoss = deliverables.competitiveWinLoss;
    }

    if (Object.keys(result).length === 0) {
      return errorResult(`No competitor data available for runId: ${runId}`);
    }

    return textResult(result);
  }
);

// ─── Tool 8: get_team_analysis ──────────────────────────────────────────────

server.tool(
  "get_team_analysis",
  "Get team and workforce analysis — hiring plan, team performance, talent gaps, culture assessment",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const deliverables = getDeliverables(runId);
    if (!deliverables) return errorResult(`No completed analysis found for runId: ${runId}`);

    const result: any = {};

    if (deliverables.hiringPlan) result.hiringPlan = deliverables.hiringPlan;
    if (deliverables.teamPerformance) result.teamPerformance = deliverables.teamPerformance;
    if (deliverables.talentGapAnalysis) result.talentGapAnalysis = deliverables.talentGapAnalysis;
    if (deliverables.cultureAssessment) result.cultureAssessment = deliverables.cultureAssessment;
    if (deliverables.workforcePlanning) result.workforcePlanning = deliverables.workforcePlanning;
    if (deliverables.skillsGapAnalysis) result.skillsGapAnalysis = deliverables.skillsGapAnalysis;
    if (deliverables.burnoutRisk) result.burnoutRisk = deliverables.burnoutRisk;
    if (deliverables.employeeEngagement) result.employeeEngagement = deliverables.employeeEngagement;
    if (deliverables.compensationBenchmark) result.compensationBenchmark = deliverables.compensationBenchmark;
    if (deliverables.successionPlanning) result.successionPlanning = deliverables.successionPlanning;

    if (Object.keys(result).length === 0) {
      return errorResult(`No team/workforce data available for runId: ${runId}`);
    }

    return textResult(result);
  }
);

// ─── Tool 9: get_full_report ────────────────────────────────────────────────

server.tool(
  "get_full_report",
  "Get all deliverables for a specific analysis — full data dump of every section. Warning: response can be very large.",
  { runId: z.string().describe("The run ID of the analysis") },
  async ({ runId }) => {
    const row = getJobRow(runId);
    if (!row) return errorResult(`No analysis found for runId: ${runId}`);

    const deliverables = safeJsonParse(row.results_json);
    if (!deliverables) return errorResult(`No results available for runId: ${runId}`);

    const questionnaire = safeJsonParse(row.questionnaire_json, {});

    // List which sections are available
    const availableSections = Object.keys(deliverables).filter(
      (key) => deliverables[key] != null
    );

    return textResult({
      runId: row.run_id,
      orgName: questionnaire?.organizationName ?? "Unknown",
      industry: questionnaire?.industry ?? "Unknown",
      status: row.status,
      date: row.created_at,
      availableSections,
      sectionCount: availableSections.length,
      deliverables,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Start the server
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running and listening on stdio
  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error("[Pivot MCP] Server started on stdio transport");
}

main().catch((err) => {
  console.error("[Pivot MCP] Fatal error:", err);
  process.exit(1);
});
