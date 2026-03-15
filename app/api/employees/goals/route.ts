import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { resolvePermissions, canViewEmployee } from "@/lib/permissions";
import {
  fetchScoreHistory,
  getWeakestDimensions,
  projectedImpact,
} from "@/lib/scoring/engine";
import type { DimensionKey, RoleType } from "@/lib/scoring/engine";

// ── Dimension-to-goal mapping ────────────────────────────────────

const DIMENSION_GOAL_TEMPLATES: Record<
  DimensionKey,
  { title: string; description: string; metric: string; targetDelta: number }
> = {
  responsiveness: {
    title: "Improve Response Time",
    description:
      "Reduce average response time across communication channels (Slack, email) to demonstrate faster follow-through.",
    metric: "avg_response_hours",
    targetDelta: 15,
  },
  outputVolume: {
    title: "Increase Output Throughput",
    description:
      "Increase the volume of completed deliverables, closed tickets, or shipped features within the scoring window.",
    metric: "completed_items",
    targetDelta: 15,
  },
  qualitySignal: {
    title: "Raise Quality Standards",
    description:
      "Reduce rework, bug reports, or revision requests. Improve first-pass acceptance rate.",
    metric: "first_pass_rate",
    targetDelta: 10,
  },
  collaboration: {
    title: "Strengthen Cross-Team Collaboration",
    description:
      "Increase meaningful interactions across teams: code reviews, unblocking others, cross-functional contributions.",
    metric: "cross_team_interactions",
    targetDelta: 10,
  },
  reliability: {
    title: "Boost Reliability & Consistency",
    description:
      "Improve on-time delivery rate and reduce missed deadlines or dropped tasks.",
    metric: "on_time_rate",
    targetDelta: 10,
  },
  managerAssessment: {
    title: "Improve Manager Assessment Score",
    description:
      "Focus on areas highlighted in manager feedback. Schedule regular 1:1s for alignment.",
    metric: "manager_score",
    targetDelta: 10,
  },
};

/**
 * GET /api/employees/goals?employeeId=...
 * Fetch active goals for an employee.
 *
 * Permissions:
 *   owner/csuite: can view any employee's goals
 *   employee: can only view their own goals
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    // Permission check
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || !canViewEmployee(permissions, employeeId)) {
      return NextResponse.json(
        { error: "Forbidden: you do not have access to this employee's goals" },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    const { data: goals, error } = await supabase
      .from("employee_goals")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/employees/goals]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ goals: goals ?? [] });
  } catch (err) {
    console.error("[GET /api/employees/goals]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch goals" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/employees/goals
 * Generate new goals for an employee based on their weakest scoring dimensions.
 *
 * Body: { employeeId: string, orgId: string }
 *
 * Permissions:
 *   owner/csuite: can generate goals for any employee
 *   employee: can generate goals for themselves only (canManageGoals)
 *
 * Analyzes the employee's most recent score, identifies the weakest dimensions
 * (weighted by role type), and creates targeted improvement goals.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { employeeId, orgId } = body;

    if (!employeeId || !orgId) {
      return NextResponse.json(
        { error: "employeeId and orgId are required" },
        { status: 400 },
      );
    }

    // Permission check: must be able to manage goals and view this employee
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || !permissions.canManageGoals || !canViewEmployee(permissions, employeeId)) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to manage this employee's goals" },
        { status: 403 },
      );
    }

    // 1. Fetch the most recent score for this employee
    const history = await fetchScoreHistory(employeeId, 1);

    if (history.length === 0) {
      return NextResponse.json(
        { error: "No score data available. Run a scoring cycle first." },
        { status: 422 },
      );
    }

    const latestScore = history[0];
    const roleType = latestScore.roleType as RoleType;

    // 2. Find the 3 weakest dimensions (highest improvement potential)
    const weakest = getWeakestDimensions(latestScore.dimensions, roleType, 3);

    if (weakest.length === 0) {
      return NextResponse.json(
        { error: "Insufficient dimension data to generate goals." },
        { status: 422 },
      );
    }

    // 3. Build goals from templates
    const supabase = createAdminClient();
    const goalsToInsert = weakest.map((weak) => {
      const template = DIMENSION_GOAL_TEMPLATES[weak.dimension];
      const impact = projectedImpact(
        latestScore.dimensions,
        roleType,
        weak.dimension,
        template.targetDelta,
      );

      return {
        employee_id: employeeId,
        org_id: orgId,
        dimension: weak.dimension,
        title: template.title,
        description: template.description,
        metric: template.metric,
        current: Math.round(weak.score),
        target: Math.min(100, Math.round(weak.score + template.targetDelta)),
        projected_impact: impact,
        status: "active",
      };
    });

    const { data: goals, error: insertError } = await supabase
      .from("employee_goals")
      .insert(goalsToInsert)
      .select();

    if (insertError) {
      console.error("[POST /api/employees/goals] insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ goals: goals ?? [] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/employees/goals]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate goals",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/employees/goals
 * Update a goal's progress or status.
 *
 * Body: { goalId: string, current?: number, status?: string }
 *
 * Permissions:
 *   owner/csuite: can update any goal
 *   employee: can only update their own goals (canManageGoals)
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { goalId, current, status } = body;

    if (!goalId) {
      return NextResponse.json(
        { error: "goalId is required" },
        { status: 400 },
      );
    }

    if (current === undefined && status === undefined) {
      return NextResponse.json(
        { error: "At least one of current or status must be provided" },
        { status: 400 },
      );
    }

    // Permission check: verify user can manage goals
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || !permissions.canManageGoals) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to update goals" },
        { status: 403 },
      );
    }

    // For employee tier, verify the goal belongs to them
    const supabase = createAdminClient();

    if (!permissions.canViewAllEmployees) {
      const { data: goalRecord } = await supabase
        .from("employee_goals")
        .select("employee_id")
        .eq("id", goalId)
        .single();

      if (!goalRecord || goalRecord.employee_id !== permissions.employeeId) {
        return NextResponse.json(
          { error: "Forbidden: you can only update your own goals" },
          { status: 403 },
        );
      }
    }

    // Validate status if provided
    const validStatuses = ["active", "completed", "paused", "cancelled"];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (current !== undefined) {
      if (typeof current !== "number" || current < 0 || current > 100) {
        return NextResponse.json(
          { error: "current must be a number between 0 and 100" },
          { status: 400 },
        );
      }
      updateData.current = current;
    }

    if (status !== undefined) {
      updateData.status = status;
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }
    }

    const { data: goal, error: updateError } = await supabase
      .from("employee_goals")
      .update(updateData)
      .eq("id", goalId)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/employees/goals]", updateError);
      // Distinguish between not found and other errors
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ goal });
  } catch (err) {
    console.error("[PATCH /api/employees/goals]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update goal",
      },
      { status: 500 },
    );
  }
}
