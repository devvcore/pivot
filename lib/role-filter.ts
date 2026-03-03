import type { MVPDeliverables } from "./types";

/**
 * Core sections visible to ALL roles (including employees)
 */
const EMPLOYEE_VISIBLE_SECTIONS = new Set([
  "healthScore",
  "actionPlan",
  "goalTracker",
  "kpis",
  "healthChecklist",
  "milestoneTracker",
  "benchmarkScore",
]);

/**
 * Sections visible to coach role (coaching-relevant data)
 */
const COACH_VISIBLE_SECTIONS = new Set([
  ...EMPLOYEE_VISIBLE_SECTIONS,
  "executiveSummary",
  "swotAnalysis",
  "decisionBrief",
  "hiringPlan",
  "teamPerformance",
  "issuesRegister",
  "riskRegister",
  "kpiReport",
  "scenarioPlanner",
  "competitiveMoat",
]);

/**
 * Sections visible to "other" role — minimal, generic data only
 */
const OTHER_VISIBLE_SECTIONS = new Set([
  "healthScore",
  "actionPlan",
  "healthChecklist",
]);

/**
 * Sections that contain sensitive data owners wouldn't want employees to see
 */
const OWNER_ONLY_SECTIONS = new Set([
  "cashIntelligence",
  "revenueLeakAnalysis",
  "atRiskCustomers",
  "unitEconomics",
  "burnRateAnalysis",
  "debtStructure",
  "investorReadiness",
  "revenueForecast",
  "hiringPlan", // has fire/keep recommendations
]);

/**
 * Filter deliverables based on the viewer's role.
 * - Owner: sees everything
 * - Coach: sees coaching-relevant sections + general health
 * - Employee: sees their tasks, KPIs, goals, and general health
 * - Other: sees generic coaching guide, overall health score, general recommendations only
 */
export function filterDeliverablesForRole(
  deliverables: MVPDeliverables,
  role: "owner" | "employee" | "coach" | "other",
  employeeName?: string,
): Partial<MVPDeliverables> {
  if (role === "owner") return deliverables;

  const allowed =
    role === "coach"
      ? COACH_VISIBLE_SECTIONS
      : role === "employee"
        ? EMPLOYEE_VISIBLE_SECTIONS
        : OTHER_VISIBLE_SECTIONS;

  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(deliverables)) {
    // Always include metadata fields
    if (key.startsWith("_") || key === "selectedSections" || key === "dataProvenance" || key === "claimValidations") {
      // For "other" role, strip dataProvenance to avoid leaking source document names
      if (key === "dataProvenance" && role === "other") continue;
      filtered[key] = value;
      continue;
    }

    if (allowed.has(key)) {
      // For employees, filter action plan to only their tasks
      if (key === "actionPlan" && role === "employee" && employeeName && value) {
        filtered[key] = filterActionPlanForEmployee(value as any, employeeName);
      } else if (key === "healthScore" && role === "other" && value) {
        // For "other" role, only show score and grade, not detailed dimensions
        const hs = value as Record<string, unknown>;
        filtered[key] = {
          score: hs.score,
          grade: hs.grade,
          summary: hs.summary,
        };
      } else if (key === "actionPlan" && role === "other" && value) {
        // For "other" role, only show general recommendations (no task owners/names)
        filtered[key] = filterActionPlanForOther(value as any);
      } else {
        filtered[key] = value;
      }
    }
  }

  return filtered as Partial<MVPDeliverables>;
}

/**
 * Filter action plan to only show tasks assigned to a specific employee
 */
function filterActionPlanForEmployee(
  actionPlan: { days?: Array<{ day: number; title: string; tasks: Array<{ description: string; owner: string }> }>; summary?: string },
  employeeName: string,
): typeof actionPlan {
  if (!actionPlan?.days) return actionPlan;

  const nameLower = employeeName.toLowerCase();
  return {
    ...actionPlan,
    days: actionPlan.days
      .map((day) => ({
        ...day,
        tasks: day.tasks.filter(
          (t) =>
            t.owner?.toLowerCase().includes(nameLower) ||
            t.owner?.toLowerCase().includes("all") ||
            t.owner?.toLowerCase().includes("team"),
        ),
      }))
      .filter((day) => day.tasks.length > 0),
  };
}

/**
 * Filter action plan for "other" role — strip owner names and sensitive details
 */
function filterActionPlanForOther(
  actionPlan: { days?: Array<{ day: number; title: string; tasks: Array<{ description: string; owner: string }> }>; summary?: string },
): { summary?: string; days?: Array<{ day: number; title: string; tasks: Array<{ description: string }> }> } {
  if (!actionPlan?.days) return { summary: actionPlan?.summary };

  return {
    summary: actionPlan.summary,
    days: actionPlan.days.map((day) => ({
      day: day.day,
      title: day.title,
      tasks: day.tasks.map((t) => ({ description: t.description })),
    })),
  };
}
