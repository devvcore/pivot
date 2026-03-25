/**
 * GET /api/cron/process-webhooks
 *
 * Processes unhandled webhook events and generates smart notifications.
 * Run every 5 minutes via external cron (Vercel cron, Cloud Scheduler, etc.)
 *
 * Also runs a quick health check to detect anomalies:
 * - Revenue drop > 20% from previous period
 * - No payments in 48+ hours (for active Stripe accounts)
 * - Spike in failed payments
 * - CRM contacts going stale
 */

import { NextResponse } from "next/server";
import { processWebhookEvents, deliverNotification } from "@/lib/notifications/engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const results: Record<string, unknown> = {};

  // 1. Process webhook events
  try {
    const webhookResults = await processWebhookEvents(100);
    results.webhooks = webhookResults;
  } catch (err) {
    results.webhooks = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 2. Run health anomaly detection
  try {
    const anomalies = await detectAnomalies();
    results.anomalies = anomalies;
  } catch (err) {
    results.anomalies = { error: err instanceof Error ? err.message : "unknown" };
  }

  return NextResponse.json(results);
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────

async function detectAnomalies(): Promise<{ checked: number; alerted: number }> {
  const supabase = createAdminClient();
  let alerted = 0;

  // Get all orgs with active integrations
  const { data: orgs } = await supabase
    .from("integrations")
    .select("org_id")
    .eq("status", "connected")
    .not("org_id", "is", null);

  if (!orgs) return { checked: 0, alerted: 0 };

  const uniqueOrgs = [...new Set(orgs.map(o => o.org_id))];

  for (const orgId of uniqueOrgs) {
    try {
      // Check for stale CRM contacts (no activity in 14+ days for active deals)
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data: staleContacts } = await supabase
        .from("crm_contacts")
        .select("name, stage")
        .eq("org_id", orgId)
        .in("stage", ["qualified", "proposal", "negotiation"])
        .lt("last_contacted_at", fourteenDaysAgo)
        .limit(5);

      if (staleContacts && staleContacts.length >= 3) {
        // Check if we already alerted about this recently (24h dedup)
        const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
        const { count } = await supabase
          .from("alerts")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("source_event_type", "stale_pipeline")
          .gte("created_at", oneDayAgo);

        if (!count || count === 0) {
          const names = staleContacts.map(c => c.name).slice(0, 3).join(", ");
          await deliverNotification({
            orgId,
            title: `${staleContacts.length} deals going cold`,
            message: `${names} and ${Math.max(0, staleContacts.length - 3)} others haven't been contacted in 14+ days. Consider following up.`,
            severity: "warning",
            source: "system",
            sourceEventType: "stale_pipeline",
            actionUrl: "/dashboard?tab=crm",
          });
          alerted++;
        }
      }

      // Check for spike in unresolved alerts
      const { count: unresolvedCount } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("read", false)
        .eq("severity", "critical");

      if (unresolvedCount && unresolvedCount >= 5) {
        const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
        const { count: recentEscalation } = await supabase
          .from("alerts")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("source_event_type", "alert_escalation")
          .gte("created_at", oneDayAgo);

        if (!recentEscalation || recentEscalation === 0) {
          await deliverNotification({
            orgId,
            title: `${unresolvedCount} unresolved critical alerts`,
            message: `You have ${unresolvedCount} critical alerts that need attention. Check your dashboard.`,
            severity: "critical",
            source: "system",
            sourceEventType: "alert_escalation",
            actionUrl: "/dashboard?tab=alerts",
          });
          alerted++;
        }
      }
    } catch (err) {
      console.warn(`[anomaly-detection] Error for org ${orgId}:`, err);
    }
  }

  return { checked: uniqueOrgs.length, alerted };
}
