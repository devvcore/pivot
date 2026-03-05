import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createOrchestrator } from "@/lib/execution/orchestrator";

type RouteContext = { params: Promise<{ taskId: string }> };

/**
 * GET /api/execution/tasks/[taskId]
 * Get task details including output, artifacts, review status, and events.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { taskId } = await context.params;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch task
    const { data: task, error: taskError } = await supabase
      .from("execution_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: taskError?.message || "Task not found" },
        { status: 404 }
      );
    }

    // Fetch recent events for this task
    const { data: events } = await supabase
      .from("execution_events")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch approval requests for this task
    const { data: approvals } = await supabase
      .from("execution_approvals")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    // Fetch cost breakdown for this task
    const { data: costs } = await supabase
      .from("execution_costs")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      task,
      events: events || [],
      approvals: approvals || [],
      costs: costs || [],
    });
  } catch (err) {
    console.error("[GET /api/execution/tasks/[taskId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch task" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/execution/tasks/[taskId]
 * Update task: approve result, reject, provide feedback, or cancel.
 *
 * Body: {
 *   action: 'approve' | 'reject' | 'revise' | 'cancel',
 *   feedback?: string,
 * }
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { taskId } = await context.params;
    const body = await request.json();
    const { action, feedback } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    if (!action || !["approve", "reject", "revise", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "action must be one of: approve, reject, revise, cancel" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch current task
    const { data: task, error: fetchError } = await supabase
      .from("execution_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json(
        { error: fetchError?.message || "Task not found" },
        { status: 404 }
      );
    }

    // Determine new status based on action
    let newStatus: string;
    switch (action) {
      case "approve":
        newStatus = "completed";
        break;
      case "reject":
        newStatus = "failed";
        break;
      case "revise":
        if (task.attempts >= task.max_attempts) {
          newStatus = "failed";
        } else {
          newStatus = "revision";
        }
        break;
      case "cancel":
        newStatus = "cancelled";
        break;
      default:
        newStatus = task.status;
    }

    // Update task
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (feedback) {
      updateData.review_feedback = feedback;
    }

    if (newStatus === "completed" || newStatus === "failed" || newStatus === "cancelled") {
      updateData.completed_at = new Date().toISOString();
    }

    if (action === "revise") {
      updateData.attempts = (task.attempts || 0) + 1;
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from("execution_tasks")
      .update(updateData)
      .eq("id", taskId)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/execution/tasks/[taskId]]", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log status change event
    await supabase.from("execution_events").insert({
      task_id: taskId,
      agent_id: task.agent_id,
      org_id: task.org_id,
      event_type: "status_change",
      data: {
        from: task.status,
        to: newStatus,
        action,
        feedback: feedback || null,
      },
    });

    // If revision requested, re-trigger the execution pipeline
    if (action === "revise" && newStatus === "revision") {
      const orchestrator = createOrchestrator();
      orchestrator.runPipeline(taskId).catch((err: Error) => {
        console.error(`[PATCH /api/execution/tasks/${taskId}] Revision pipeline failed:`, err.message);
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    console.error("[PATCH /api/execution/tasks/[taskId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/execution/tasks/[taskId]
 * Cancel and delete a task.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { taskId } = await context.params;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch task to verify it exists and get org_id
    const { data: task, error: fetchError } = await supabase
      .from("execution_tasks")
      .select("id, status, org_id, agent_id")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json(
        { error: fetchError?.message || "Task not found" },
        { status: 404 }
      );
    }

    // Update status to cancelled (soft delete)
    const { error: updateError } = await supabase
      .from("execution_tasks")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      console.error("[DELETE /api/execution/tasks/[taskId]]", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log cancellation event
    await supabase.from("execution_events").insert({
      task_id: taskId,
      agent_id: task.agent_id,
      org_id: task.org_id,
      event_type: "status_change",
      data: { from: task.status, to: "cancelled", action: "delete" },
    });

    return NextResponse.json({ success: true, taskId });
  } catch (err) {
    console.error("[DELETE /api/execution/tasks/[taskId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task" },
      { status: 500 }
    );
  }
}
