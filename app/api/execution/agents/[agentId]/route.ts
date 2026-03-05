import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createOrchestrator } from "@/lib/execution/orchestrator";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * GET /api/execution/agents/[agentId]?orgId=...
 * Get agent details: current session, activity feed, task history.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { agentId } = await context.params;
    const orgId = request.nextUrl.searchParams.get("orgId");

    if (!agentId || !orgId) {
      return NextResponse.json(
        { error: "agentId and orgId are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch agent session
    const { data: session } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("agent_id", agentId)
      .eq("org_id", orgId)
      .single();

    // Fetch agent's tasks
    const { data: tasks } = await supabase
      .from("execution_tasks")
      .select("*")
      .eq("agent_id", agentId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch recent events (activity feed)
    const { data: events } = await supabase
      .from("execution_events")
      .select("*")
      .eq("agent_id", agentId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch pending approvals
    const { data: pendingApprovals } = await supabase
      .from("execution_approvals")
      .select("*")
      .eq("agent_id", agentId)
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // Calculate cost totals
    const { data: costs } = await supabase
      .from("execution_costs")
      .select("cost_usd, input_tokens, output_tokens, model")
      .eq("agent_id", agentId)
      .eq("org_id", orgId);

    const costSummary = {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byModel: {} as Record<string, { cost: number; calls: number }>,
    };

    for (const cost of costs || []) {
      costSummary.totalCostUsd += cost.cost_usd || 0;
      costSummary.totalInputTokens += cost.input_tokens || 0;
      costSummary.totalOutputTokens += cost.output_tokens || 0;
      if (!costSummary.byModel[cost.model]) {
        costSummary.byModel[cost.model] = { cost: 0, calls: 0 };
      }
      costSummary.byModel[cost.model].cost += cost.cost_usd || 0;
      costSummary.byModel[cost.model].calls++;
    }

    // Determine current status
    const activeTasks = (tasks || []).filter(
      (t: { status: string }) => t.status === "in_progress" || t.status === "revision"
    );
    const status = activeTasks.length > 0 ? "working" : "idle";

    return NextResponse.json({
      agentId,
      orgId,
      status,
      session: session || null,
      tasks: tasks || [],
      events: events || [],
      pendingApprovals: pendingApprovals || [],
      costSummary,
    });
  } catch (err) {
    console.error("[GET /api/execution/agents/[agentId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execution/agents/[agentId]
 * Send a message to an agent (interact with its session).
 *
 * Body: {
 *   orgId: string,
 *   message: string,
 *   taskId?: string,  // optional: associate with a specific task
 * }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { agentId } = await context.params;
    const body = await request.json();
    const { orgId, message, taskId } = body;

    if (!agentId || !orgId || !message) {
      return NextResponse.json(
        { error: "agentId, orgId, and message are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get or create session
    const { data: existingSession } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("agent_id", agentId)
      .eq("org_id", orgId)
      .single();

    const currentMessages = existingSession?.messages || [];
    const updatedMessages = [
      ...currentMessages,
      {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      },
    ];

    if (existingSession) {
      await supabase
        .from("agent_sessions")
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSession.id);
    } else {
      await supabase.from("agent_sessions").insert({
        agent_id: agentId,
        org_id: orgId,
        messages: updatedMessages,
      });
    }

    // Log the interaction event
    await supabase.from("execution_events").insert({
      task_id: taskId || null,
      agent_id: agentId,
      org_id: orgId,
      event_type: "output",
      data: { direction: "user_to_agent", message },
    });

    // If there's an associated task, trigger the orchestrator to process it
    if (taskId) {
      const orchestrator = createOrchestrator();
      orchestrator.runPipeline(taskId).catch((err: Error) => {
        console.error(`[POST /api/execution/agents/${agentId}] Pipeline failed for task ${taskId}:`, err.message);
      });
    }

    return NextResponse.json({
      success: true,
      agentId,
      messageCount: updatedMessages.length,
    });
  } catch (err) {
    console.error("[POST /api/execution/agents/[agentId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
