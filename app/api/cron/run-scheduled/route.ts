/**
 * GET /api/cron/run-scheduled
 *
 * Cron endpoint that checks for scheduled runs due to execute.
 * Called by external scheduler (e.g., every 15 minutes).
 * Verifies CRON_SECRET for security.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrchestrator } from "@/lib/execution/orchestrator";
import { collectIntegrationContext, formatIntegrationContextAsText } from "@/lib/integrations/collect";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const provided = authHeader?.replace("Bearer ", "") ?? new URL(req.url).searchParams.get("secret");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  // Find all enabled schedules
  const { data: schedules, error } = await supabase
    .from("scheduled_runs")
    .select("*")
    .eq("enabled", true);

  if (error || !schedules) {
    return NextResponse.json({ error: error?.message ?? "No schedules" }, { status: 500 });
  }

  const now = new Date();
  const results: Array<{ id: string; title: string; status: string }> = [];

  for (const schedule of schedules) {
    // Check if this schedule is due (simple: compare last_run_at to cron interval)
    const lastRun = schedule.last_run_at ? new Date(schedule.last_run_at) : null;
    const isDue = !lastRun || isScheduleDue(schedule.cron_expression, lastRun, now);

    if (!isDue) continue;

    try {
      // Load deliverables for this org
      const { data: latestJob } = await supabase
        .from("jobs")
        .select("results_json")
        .eq("organization_id", schedule.org_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let deliverables = latestJob?.results_json as Record<string, unknown> | undefined;

      // Load integration data
      const integrationCtx = await collectIntegrationContext(schedule.org_id);
      if (integrationCtx.providers.length > 0) {
        if (!deliverables) deliverables = {};
        deliverables.__integrationData = formatIntegrationContextAsText(integrationCtx);
        deliverables.__integrationProviders = integrationCtx.providers;
      }

      // Create task
      const taskId = uuidv4();
      const { data: task, error: insertError } = await supabase
        .from("execution_tasks")
        .insert({
          id: taskId,
          org_id: schedule.org_id,
          title: schedule.title,
          description: schedule.description ?? `Scheduled run: ${schedule.title}`,
          agent_id: schedule.agent_id,
          priority: "medium",
          cost_ceiling: 0.50,
          status: "queued",
        })
        .select("id")
        .single();

      if (insertError || !task) {
        results.push({ id: schedule.id, title: schedule.title, status: "insert_failed" });
        continue;
      }

      // Fire pipeline
      const orchestrator = createOrchestrator(deliverables);
      orchestrator.runPipeline(task.id).then(async (completedTask) => {
        // Push result to channel if configured
        if (schedule.push_channel && schedule.push_target && completedTask.result) {
          await pushResult(schedule.org_id, schedule.push_channel, schedule.push_target, schedule.title, completedTask.result);
        }
      }).catch(async (err: Error) => {
        console.error(`[Cron] Scheduled run failed for ${schedule.id}:`, err.message);
        await supabase.from("execution_tasks").update({ status: "failed", review_feedback: err.message }).eq("id", task.id);
      });

      // Update schedule tracking
      await supabase.from("scheduled_runs").update({
        last_run_at: now.toISOString(),
        last_run_status: "running",
        last_run_task_id: task.id,
        run_count: (schedule.run_count ?? 0) + 1,
        updated_at: now.toISOString(),
      }).eq("id", schedule.id);

      results.push({ id: schedule.id, title: schedule.title, status: "launched" });
    } catch (err) {
      results.push({ id: schedule.id, title: schedule.title, status: `error: ${err instanceof Error ? err.message : "unknown"}` });
    }
  }

  return NextResponse.json({
    checked: schedules.length,
    launched: results.filter(r => r.status === "launched").length,
    results,
  });
}

/**
 * Simple cron check: determine if enough time has elapsed since last run.
 * Parses minute and hour fields for basic scheduling.
 */
function isScheduleDue(cron: string, lastRun: Date, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const minutesSinceLast = (now.getTime() - lastRun.getTime()) / 60000;

  // Parse first field (minute) for interval detection
  const minuteField = parts[0];
  const hourField = parts[1];
  const dayOfWeekField = parts[4];

  // Every N minutes: */N
  if (minuteField.startsWith("*/")) {
    const interval = parseInt(minuteField.slice(2));
    return minutesSinceLast >= interval;
  }

  // Specific hour: 0 9 * * * (daily at 9am)
  if (minuteField !== "*" && hourField !== "*") {
    // At least 23 hours since last run (daily)
    return minutesSinceLast >= 23 * 60;
  }

  // Weekly: 0 9 * * 1 (Monday 9am)
  if (dayOfWeekField !== "*") {
    return minutesSinceLast >= 6 * 24 * 60; // At least 6 days
  }

  // Default: at least 1 hour between runs
  return minutesSinceLast >= 60;
}

/**
 * Push agent result to a channel (Slack or email).
 */
async function pushResult(orgId: string, channel: string, target: string, title: string, result: string): Promise<void> {
  try {
    if (channel === "slack") {
      const { globalRegistry } = await import("@/lib/execution/tools/index");
      const { createCostTracker } = await import("@/lib/execution/tools/index");
      await globalRegistry.execute("send_slack_message", {
        channel: target,
        message: `📊 **Scheduled Report: ${title}**\n\n${result.slice(0, 3000)}`,
      }, {
        orgId,
        agentId: "system",
        sessionId: "scheduled",
        costTracker: createCostTracker(0.10),
      });
    } else if (channel === "email") {
      const { globalRegistry } = await import("@/lib/execution/tools/index");
      const { createCostTracker } = await import("@/lib/execution/tools/index");
      await globalRegistry.execute("send_email", {
        to: target,
        subject: `Pivot Report: ${title}`,
        body: result.slice(0, 5000),
      }, {
        orgId,
        agentId: "system",
        sessionId: "scheduled",
        costTracker: createCostTracker(0.10),
      });
    }
  } catch (err) {
    console.error(`[Cron] Push to ${channel} failed:`, err instanceof Error ? err.message : err);
  }
}
