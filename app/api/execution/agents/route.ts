import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/execution/agents?orgId=...
 * List agent statuses for an org: which agents are working, idle,
 * how many tasks each has, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get all tasks grouped by agent to determine status
    const { data: tasks, error: tasksError } = await supabase
      .from("execution_tasks")
      .select("agent_id, status, priority, created_at")
      .eq("org_id", orgId);

    if (tasksError) {
      console.error("[GET /api/execution/agents]", tasksError);
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Get agent sessions for metadata
    const { data: sessions } = await supabase
      .from("agent_sessions")
      .select("agent_id, metadata, updated_at")
      .eq("org_id", orgId);

    // Get total costs per agent
    const { data: costs } = await supabase
      .from("execution_costs")
      .select("agent_id, cost_usd")
      .eq("org_id", orgId);

    // Aggregate per-agent stats
    const agentMap = new Map<
      string,
      {
        agentId: string;
        status: "working" | "idle" | "blocked";
        activeTasks: number;
        queuedTasks: number;
        completedTasks: number;
        failedTasks: number;
        totalTasks: number;
        totalCost: number;
        lastActivity: string | null;
        metadata: Record<string, unknown>;
      }
    >();

    // Process tasks
    for (const task of tasks || []) {
      if (!agentMap.has(task.agent_id)) {
        agentMap.set(task.agent_id, {
          agentId: task.agent_id,
          status: "idle",
          activeTasks: 0,
          queuedTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalTasks: 0,
          totalCost: 0,
          lastActivity: null,
          metadata: {},
        });
      }
      const agent = agentMap.get(task.agent_id)!;
      agent.totalTasks++;

      switch (task.status) {
        case "in_progress":
        case "revision":
          agent.activeTasks++;
          agent.status = "working";
          break;
        case "queued":
          agent.queuedTasks++;
          break;
        case "completed":
          agent.completedTasks++;
          break;
        case "failed":
        case "cancelled":
          agent.failedTasks++;
          break;
        case "review":
          agent.activeTasks++;
          agent.status = "blocked"; // Waiting for human review
          break;
      }

      // Track latest activity
      if (!agent.lastActivity || task.created_at > agent.lastActivity) {
        agent.lastActivity = task.created_at;
      }
    }

    // Merge session metadata
    for (const session of sessions || []) {
      const agent = agentMap.get(session.agent_id);
      if (agent) {
        agent.metadata = session.metadata || {};
        if (!agent.lastActivity || session.updated_at > agent.lastActivity) {
          agent.lastActivity = session.updated_at;
        }
      }
    }

    // Merge cost data
    for (const cost of costs || []) {
      const agent = agentMap.get(cost.agent_id);
      if (agent) {
        agent.totalCost += cost.cost_usd || 0;
      }
    }

    // If an agent has queued tasks but no active ones, it's idle (ready)
    for (const agent of agentMap.values()) {
      if (agent.activeTasks === 0 && agent.queuedTasks > 0) {
        agent.status = "idle";
      }
    }

    const agents = Array.from(agentMap.values()).sort((a, b) => {
      // Sort: working first, then blocked, then idle
      const order = { working: 0, blocked: 1, idle: 2 };
      return order[a.status] - order[b.status];
    });

    return NextResponse.json({ agents });
  } catch (err) {
    console.error("[GET /api/execution/agents]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
