import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/execution/tasks?orgId=...&status=...&agentId=...&limit=...&offset=...
 * List execution tasks for an org with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const status = searchParams.get("status");
    const agentId = searchParams.get("agentId");
    const priority = searchParams.get("priority");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = createAdminClient();

    let query = supabase
      .from("execution_tasks")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (agentId) {
      query = query.eq("agent_id", agentId);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/execution/tasks]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tasks: data,
      total: count,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[GET /api/execution/tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execution/tasks
 * Create a new execution task and trigger the orchestrator pipeline.
 *
 * Body: {
 *   orgId: string,
 *   title: string,
 *   description?: string,
 *   agentId: string,
 *   priority?: 'low' | 'medium' | 'high' | 'urgent',
 *   costCeiling?: number,
 *   deliverables?: object,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, title, agentId, description, priority, costCeiling, deliverables } = body;

    if (!orgId || !title || !agentId) {
      return NextResponse.json(
        { error: "orgId, title, and agentId are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create the task record
    const { data: task, error: insertError } = await supabase
      .from("execution_tasks")
      .insert({
        org_id: orgId,
        title,
        description: description || null,
        agent_id: agentId,
        priority: priority || "medium",
        cost_ceiling: costCeiling || 1.0,
        status: "queued",
      })
      .select()
      .single();

    if (insertError || !task) {
      console.error("[POST /api/execution/tasks] insert error", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to create task" },
        { status: 500 }
      );
    }

    // Log creation event
    await supabase.from("execution_events").insert({
      task_id: task.id,
      agent_id: agentId,
      org_id: orgId,
      event_type: "status_change",
      data: { from: null, to: "queued", title },
    });

    // Generate acceptance criteria (async, non-blocking)
    // TODO: Trigger generateCriteriaJob
    // import { generateCriteriaJob } from "@/trigger/generate-criteria";
    // await generateCriteriaJob.trigger({ taskId: task.id, title, description: description || "" });

    // Trigger the execution pipeline (async, non-blocking)
    // TODO: Trigger executeTaskJob
    // import { executeTaskJob } from "@/trigger/execute-task";
    // const handle = await executeTaskJob.trigger({
    //   taskId: task.id,
    //   orgId,
    //   agentId,
    //   title,
    //   description: description || "",
    //   deliverables,
    //   costCeiling: costCeiling || 1.0,
    // });
    // Update task with trigger_run_id
    // await supabase.from("execution_tasks").update({ trigger_run_id: handle.id }).eq("id", task.id);

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/execution/tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 }
    );
  }
}
