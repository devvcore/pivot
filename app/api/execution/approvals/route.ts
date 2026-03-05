import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createOrchestrator } from "@/lib/execution/orchestrator";

/**
 * GET /api/execution/approvals?orgId=...&status=...
 * List approval requests for an org, optionally filtered by status.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const status = searchParams.get("status") || "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = createAdminClient();

    let query = supabase
      .from("execution_approvals")
      .select("*, execution_tasks(title, description, agent_id, priority)", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/execution/approvals]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      approvals: data || [],
      total: count,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[GET /api/execution/approvals]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch approvals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execution/approvals
 * Submit an approval decision: approve, reject, or request revision.
 *
 * Body: {
 *   approvalId: string,
 *   decision: 'approved' | 'rejected' | 'revision_requested',
 *   feedback?: string,
 *   decidedBy?: string,  // user ID or name
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { approvalId, decision, feedback, decidedBy } = body;

    if (!approvalId || !decision) {
      return NextResponse.json(
        { error: "approvalId and decision are required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "revision_requested"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be one of: approved, rejected, revision_requested" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch the approval to verify it exists and is pending
    const { data: approval, error: fetchError } = await supabase
      .from("execution_approvals")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { error: fetchError?.message || "Approval not found" },
        { status: 404 }
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        { error: `Approval already resolved with status: ${approval.status}` },
        { status: 409 }
      );
    }

    // Update the approval
    const { data: updatedApproval, error: updateError } = await supabase
      .from("execution_approvals")
      .update({
        status: decision,
        feedback: feedback || null,
        decided_by: decidedBy || auth.user.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approvalId)
      .select()
      .single();

    if (updateError) {
      console.error("[POST /api/execution/approvals]", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log approval response event
    await supabase.from("execution_events").insert({
      task_id: approval.task_id,
      agent_id: approval.agent_id,
      org_id: approval.org_id,
      event_type: "approval_response",
      data: {
        approvalId,
        decision,
        feedback: feedback || null,
        decidedBy: decidedBy || auth.user.id,
      },
    });

    // Handle the decision's effect on the task
    if (approval.task_id) {
      if (decision === "approved") {
        // Resume the task -- trigger the orchestrator to continue execution
        const orchestrator = createOrchestrator();
        orchestrator.runPipeline(approval.task_id).catch((err: Error) => {
          console.error(`[POST /api/execution/approvals] Pipeline resume failed for ${approval.task_id}:`, err.message);
        });
      } else if (decision === "rejected") {
        // Update the task to reflect rejection
        await supabase
          .from("execution_tasks")
          .update({
            review_feedback: `Action rejected: ${feedback || "No feedback provided"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", approval.task_id);
      } else if (decision === "revision_requested") {
        // Update task status and trigger revision pipeline
        await supabase
          .from("execution_tasks")
          .update({
            review_feedback: `Revision requested: ${feedback || "No feedback provided"}`,
            status: "revision",
            updated_at: new Date().toISOString(),
          })
          .eq("id", approval.task_id);

        const orchestrator = createOrchestrator();
        orchestrator.runPipeline(approval.task_id).catch((err: Error) => {
          console.error(`[POST /api/execution/approvals] Revision pipeline failed for ${approval.task_id}:`, err.message);
        });
      }
    }

    return NextResponse.json({ approval: updatedApproval });
  } catch (err) {
    console.error("[POST /api/execution/approvals]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit approval" },
      { status: 500 }
    );
  }
}
