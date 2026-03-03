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
 */
export function filterDeliverablesForRole(
  deliverables: MVPDeliverables,
  role: "owner" | "employee" | "coach",
  employeeName?: string,
): Partial<MVPDeliverables> {
  if (role === "owner") return deliverables;

  const allowed = role === "coach" ? COACH_VISIBLE_SECTIONS : EMPLOYEE_VISIBLE_SECTIONS;
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(deliverables)) {
    // Always include metadata fields
    if (key.startsWith("_") || key === "selectedSections" || key === "dataProvenance" || key === "claimValidations") {
      filtered[key] = value;
      continue;
    }

    if (allowed.has(key)) {
      // For employees, filter action plan to only their tasks
      if (key === "actionPlan" && role === "employee" && employeeName && value) {
        filtered[key] = filterActionPlanForEmployee(value as any, employeeName);
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
