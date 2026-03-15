// ═══════════════════════════════════════════════════════════════
// Pivot — AI-Powered Goal Generator
//
// Generates personalized, measurable goals for employees based on
// their weakest scoring dimensions. Uses Gemini Flash for smart
// goal creation with template-based fallback when no API key is set.
//
// Max 3 active goals at a time. Focus over volume.
// ═══════════════════════════════════════════════════════════════

import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getWeakestDimensions,
  projectedImpact,
  type DimensionKey,
  type DimensionScores,
  type RoleType,
} from "@/lib/scoring/engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedGoal {
  employee_id: string;
  org_id: string;
  dimension: string;
  title: string;
  metric: string;
  target: number;
  current: number;
  projected_impact: number;
  deadline: string;
  status: "active" | "completed" | "missed" | "stretch";
}

/** Employee record shape returned from the employees table */
interface EmployeeRecord {
  id: string;
  org_id: string;
  name: string;
  role_title: string | null;
  role_type: string | null;
}

/** Score record shape returned from the employee_scores table */
interface ScoreRecord {
  responsiveness: number | null;
  output_volume: number | null;
  quality_signal: number | null;
  collaboration: number | null;
  reliability: number | null;
  manager_assessment: number | null;
  role_type: string | null;
  intangible_score: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";

const DEFAULT_GOAL_HORIZON_DAYS = 30;

/** Human-readable labels for each dimension key */
const DIMENSION_LABELS: Record<DimensionKey, string> = {
  responsiveness: "Responsiveness",
  outputVolume: "Output Volume",
  qualitySignal: "Quality Signal",
  collaboration: "Collaboration",
  reliability: "Reliability",
  managerAssessment: "Manager Assessment",
};

/** Dimension-to-metric mapping used in template fallback */
const DIMENSION_METRICS: Record<DimensionKey, string> = {
  responsiveness: "avg_response_time_hours",
  outputVolume: "tasks_completed",
  qualitySignal: "approval_rate_pct",
  collaboration: "peer_interactions",
  reliability: "on_time_completion_pct",
  managerAssessment: "manager_score",
};

/**
 * Template goals per dimension. Used when Gemini API key is not available.
 * Each template has a title pattern, metric, and a reasonable default target.
 */
const TEMPLATE_GOALS: Record<
  DimensionKey,
  { title: string; metric: string; target: number }[]
> = {
  responsiveness: [
    {
      title: "Respond to all direct messages within 2 hours during business hours",
      metric: "avg_response_time_hours",
      target: 2,
    },
    {
      title: "Close the loop on all open threads within 24 hours",
      metric: "open_thread_resolution_hours",
      target: 24,
    },
  ],
  outputVolume: [
    {
      title: "Complete at least 15 tasks or tickets this month",
      metric: "tasks_completed",
      target: 15,
    },
    {
      title: "Ship 3 meaningful deliverables this month",
      metric: "deliverables_shipped",
      target: 3,
    },
  ],
  qualitySignal: [
    {
      title: "Achieve 90% first-pass approval rate on submitted work",
      metric: "approval_rate_pct",
      target: 90,
    },
    {
      title: "Reduce revision requests to fewer than 2 per deliverable",
      metric: "revisions_per_deliverable",
      target: 2,
    },
  ],
  collaboration: [
    {
      title: "Provide meaningful feedback on 5 teammate submissions this month",
      metric: "peer_reviews_given",
      target: 5,
    },
    {
      title: "Initiate 3 cross-team discussions or knowledge-sharing sessions",
      metric: "cross_team_interactions",
      target: 3,
    },
  ],
  reliability: [
    {
      title: "Hit 95% on-time completion rate for assigned tasks",
      metric: "on_time_completion_pct",
      target: 95,
    },
    {
      title: "Attend all scheduled meetings with zero no-shows this month",
      metric: "meeting_attendance_pct",
      target: 100,
    },
  ],
  managerAssessment: [
    {
      title: "Schedule a 1-on-1 with your manager to align on expectations",
      metric: "manager_checkins",
      target: 1,
    },
    {
      title: "Request structured feedback from your manager on 2 recent deliverables",
      metric: "feedback_requests",
      target: 2,
    },
  ],
};

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Generate AI-powered goals for an employee based on their weakest scoring
 * dimensions. Saves up to 3 goals to the `employee_goals` table.
 *
 * Flow:
 * 1. Fetch employee record and latest scores from Supabase
 * 2. Identify the 3 weakest dimensions via `getWeakestDimensions`
 * 3. Generate personalized goals (AI or template fallback)
 * 4. Calculate projected score impact for each goal
 * 5. Deactivate any existing active goals for this employee
 * 6. Save new goals to Supabase
 *
 * @returns The generated goals array
 */
export async function generateGoalsForEmployee(
  employeeId: string,
  orgId: string
): Promise<GeneratedGoal[]> {
  const supabase = createAdminClient();

  // 1. Fetch the employee record
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, org_id, name, role_title, role_type")
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .single();

  if (empError || !employee) {
    console.error("[scoring/goals] Failed to fetch employee:", empError);
    throw new Error(
      `Employee ${employeeId} not found in org ${orgId}: ${empError?.message ?? "not found"}`
    );
  }

  // 2. Fetch the most recent score for this employee
  const { data: latestScore, error: scoreError } = await supabase
    .from("employee_scores")
    .select(
      "responsiveness, output_volume, quality_signal, collaboration, reliability, manager_assessment, role_type, intangible_score"
    )
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .order("scored_at", { ascending: false })
    .limit(1)
    .single();

  if (scoreError || !latestScore) {
    console.error("[scoring/goals] No scores found for employee:", scoreError);
    throw new Error(
      `No scores found for employee ${employeeId}. Score the employee first.`
    );
  }

  // 3. Build DimensionScores from the DB row
  const dimensions: DimensionScores = {
    responsiveness: latestScore.responsiveness,
    outputVolume: latestScore.output_volume,
    qualitySignal: latestScore.quality_signal,
    collaboration: latestScore.collaboration,
    reliability: latestScore.reliability,
    managerAssessment: latestScore.manager_assessment,
  };

  const roleType: RoleType =
    (latestScore.role_type as RoleType) ??
    (employee.role_type as RoleType) ??
    "support";

  // 4. Get the 3 weakest dimensions
  const weakest = getWeakestDimensions(dimensions, roleType, 3);

  if (weakest.length === 0) {
    console.warn("[scoring/goals] No measured dimensions to generate goals for.");
    return [];
  }

  // 5. Generate goals (AI or template)
  const deadline = buildDeadline(DEFAULT_GOAL_HORIZON_DAYS);
  let goals: GeneratedGoal[];

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    goals = await generateAIGoals(
      apiKey,
      employee as EmployeeRecord,
      dimensions,
      roleType,
      weakest,
      deadline
    );
  } else {
    console.warn(
      "[scoring/goals] No GEMINI_API_KEY set. Falling back to template-based goals."
    );
    goals = generateTemplateGoals(
      employeeId,
      orgId,
      dimensions,
      roleType,
      weakest,
      deadline
    );
  }

  // 6. Deactivate existing active goals for this employee (max 3 rule)
  const { error: deactivateError } = await supabase
    .from("employee_goals")
    .update({ status: "missed" })
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("status", "active");

  if (deactivateError) {
    console.warn(
      "[scoring/goals] Failed to deactivate old goals:",
      deactivateError
    );
    // Non-fatal: continue with saving new goals
  }

  // 7. Save new goals to Supabase
  if (goals.length > 0) {
    const { error: insertError } = await supabase
      .from("employee_goals")
      .insert(goals);

    if (insertError) {
      console.error("[scoring/goals] Failed to save goals:", insertError);
      throw new Error(`Failed to save goals: ${insertError.message}`);
    }
  }

  console.log(
    `[scoring/goals] Generated ${goals.length} goals for employee ${employeeId}`
  );

  return goals;
}

// ─── AI Goal Generation (Gemini Flash) ───────────────────────────────────────

/**
 * Use Gemini Flash to generate personalized, specific goals for the employee's
 * weakest dimensions. The AI considers the employee's role, current scores,
 * and dimension context to produce actionable goals.
 */
async function generateAIGoals(
  apiKey: string,
  employee: EmployeeRecord,
  dimensions: DimensionScores,
  roleType: RoleType,
  weakest: { dimension: DimensionKey; score: number; weight: number }[],
  deadline: string
): Promise<GeneratedGoal[]> {
  const genai = new GoogleGenAI({ apiKey });

  const dimensionSummary = weakest
    .map(
      (w) =>
        `- ${DIMENSION_LABELS[w.dimension]}: ${w.score}/100 (weight: ${Math.round(w.weight * 100)}%)`
    )
    .join("\n");

  const roleLabel = formatRoleType(roleType);

  const prompt = `You are an employee performance coach generating specific, measurable goals.

Employee: ${employee.name}
Role: ${employee.role_title ?? "Not specified"}
Role classification: ${roleLabel}

Their weakest scoring dimensions (out of 100) are:
${dimensionSummary}

For each dimension listed above, generate exactly ONE goal. Each goal must be:
- Specific and actionable (not vague like "improve communication")
- Measurable with a clear numeric target
- Achievable within 30 days
- Relevant to their role as a ${roleLabel}

Respond with a JSON array. Each element must have exactly these fields:
- "dimension": the dimension key exactly as given (e.g. "responsiveness", "outputVolume", etc.)
- "title": a specific, actionable goal statement (max 100 chars)
- "metric": a snake_case metric identifier for tracking (e.g. "avg_response_time_hours", "pr_reviews_given")
- "target": a numeric target value

Example:
[
  {
    "dimension": "collaboration",
    "title": "Review 4 teammate pull requests this month",
    "metric": "pr_reviews_given",
    "target": 4
  }
]

Return ONLY the JSON array, no other text.`;

  try {
    const resp = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 2048,
      } as Record<string, unknown>,
    });

    const raw = resp.text ?? "[]";
    const parsed = JSON.parse(raw) as Array<{
      dimension: string;
      title: string;
      metric: string;
      target: number;
    }>;

    // Validate and transform AI output into GeneratedGoal objects
    const goals: GeneratedGoal[] = [];
    const validDimensions = new Set(weakest.map((w) => w.dimension));

    for (const item of parsed) {
      const dimKey = item.dimension as DimensionKey;

      // Only accept goals for the dimensions we asked about
      if (!validDimensions.has(dimKey)) continue;

      // Calculate projected impact using the scoring engine
      const improvement = estimateImprovement(dimKey, item.target);
      const impact = projectedImpact(dimensions, roleType, dimKey, improvement);

      goals.push({
        employee_id: employee.id,
        org_id: employee.org_id,
        dimension: dimKey,
        title: item.title.slice(0, 200), // safety cap
        metric: item.metric,
        target: item.target,
        current: 0,
        projected_impact: impact,
        deadline,
        status: "active",
      });
    }

    // If AI returned fewer goals than expected, fill with templates
    if (goals.length < weakest.length) {
      const covered = new Set(goals.map((g) => g.dimension));
      const missing = weakest.filter((w) => !covered.has(w.dimension));

      const fillers = generateTemplateGoals(
        employee.id,
        employee.org_id,
        dimensions,
        roleType,
        missing,
        deadline
      );

      goals.push(...fillers);
    }

    return goals.slice(0, 3); // enforce max 3
  } catch (err) {
    console.error("[scoring/goals] Gemini goal generation failed:", err);
    // Fall back to templates on any AI error
    return generateTemplateGoals(
      employee.id,
      employee.org_id,
      dimensions,
      roleType,
      weakest,
      deadline
    );
  }
}

// ─── Template-Based Fallback ─────────────────────────────────────────────────

/**
 * Generate goals from predefined templates when Gemini is unavailable.
 * Picks the first template for each weak dimension and calculates
 * projected impact using the scoring engine.
 */
function generateTemplateGoals(
  employeeId: string,
  orgId: string,
  dimensions: DimensionScores,
  roleType: RoleType,
  weakest: { dimension: DimensionKey; score: number; weight: number }[],
  deadline: string
): GeneratedGoal[] {
  const goals: GeneratedGoal[] = [];

  for (const weak of weakest) {
    const templates = TEMPLATE_GOALS[weak.dimension];
    if (!templates || templates.length === 0) continue;

    // Pick the first template for this dimension
    const template = templates[0];

    // Calculate projected impact
    const improvement = estimateImprovement(weak.dimension, template.target);
    const impact = projectedImpact(dimensions, roleType, weak.dimension, improvement);

    goals.push({
      employee_id: employeeId,
      org_id: orgId,
      dimension: weak.dimension,
      title: template.title,
      metric: template.metric,
      target: template.target,
      current: 0,
      projected_impact: impact,
      deadline,
      status: "active",
    });
  }

  return goals.slice(0, 3);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a deadline ISO string N days from now.
 */
function buildDeadline(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Estimate how many intangible score points a completed goal would improve
 * the dimension score by. This is a heuristic mapping from goal targets to
 * score-point improvements.
 *
 * The projected_impact function in engine.ts tells us the overall intangible
 * score change given a dimension improvement in points. This function estimates
 * how many dimension-score-points completing a goal would yield.
 */
function estimateImprovement(dimension: DimensionKey, _target: number): number {
  // Conservative estimates: completing a goal typically moves a dimension
  // by 5-15 points depending on the dimension.
  const DIMENSION_IMPROVEMENT_ESTIMATES: Record<DimensionKey, number> = {
    responsiveness: 10,
    outputVolume: 8,
    qualitySignal: 10,
    collaboration: 12,
    reliability: 8,
    managerAssessment: 5,
  };

  return DIMENSION_IMPROVEMENT_ESTIMATES[dimension] ?? 8;
}

/**
 * Format a RoleType into a human-readable string for use in prompts.
 */
function formatRoleType(roleType: RoleType): string {
  switch (roleType) {
    case "direct_revenue":
      return "Direct Revenue Generator";
    case "enabler":
      return "Revenue Enabler";
    case "support":
      return "Support/Operations";
    default:
      return "Team Member";
  }
}
