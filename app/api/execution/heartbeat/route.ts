// ═══════════════════════════════════════════════════════════════
// POST /api/execution/heartbeat
// Called by Google Cloud Scheduler on a cron (e.g. every 5 min).
// Implements the 3-tier heartbeat: cheap triage → lightweight →
// full agent wake for any queued tasks.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrchestrator } from "@/lib/execution/orchestrator";

// Simple bearer token guard — Cloud Scheduler sends this header
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(req: Request) {
  // ─── Auth: verify cron secret ──────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // ════════════════════════════════════════════════════════════
    // TIER 1: Cheap triage (no model call)
    // Check for pending work across ALL orgs/agents
    // ════════════════════════════════════════════════════════════

    const { data: pendingTasks } = await supabase
      .from("execution_tasks")
      .select("id, org_id, agent_id, title, priority, cost_ceiling")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .limit(20);

    const { data: pendingApprovals } = await supabase
      .from("execution_approvals")
      .select("id, task_id, org_id, agent_id")
      .in("status", ["approved", "rejected"])
      .limit(20);

    if (!pendingTasks?.length && !pendingApprovals?.length) {
      return NextResponse.json({
        tier: 1,
        action: "idle",
        message: "No pending work",
      });
    }

    // ════════════════════════════════════════════════════════════
    // TIER 2: Lightweight — approval responses only
    // ════════════════════════════════════════════════════════════

    if (pendingApprovals?.length && !pendingTasks?.length) {
      return NextResponse.json({
        tier: 2,
        action: "lightweight",
        processedApprovals: pendingApprovals.length,
      });
    }

    // ════════════════════════════════════════════════════════════
    // TIER 3: Full wake — fire orchestrator for queued tasks
    // ════════════════════════════════════════════════════════════

    const triggered: string[] = [];
    const errors: string[] = [];

    if (pendingTasks?.length) {
      const orchestrator = createOrchestrator();

      for (const t of pendingTasks) {
        try {
          // Fire-and-forget — don't await, let them run in background
          orchestrator.runPipeline(t.id).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[heartbeat] Pipeline failed for ${t.id}:`, msg);
          });
          triggered.push(t.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${t.id}: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      tier: 3,
      action: "full-wake",
      triggeredTasks: triggered.length,
      taskIds: triggered,
      ...(errors.length ? { errors } : {}),
    });
  } catch (err) {
    console.error("[heartbeat] Error:", err);
    return NextResponse.json(
      { error: "Heartbeat failed" },
      { status: 500 }
    );
  }
}
