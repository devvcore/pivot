// ═══════════════════════════════════════════════════════════════
// GET /api/cron/proactive-check
// Cron endpoint that runs proactive checks for all orgs.
// Called by Vercel cron or external scheduler.
// Verifies CRON_SECRET header for security.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runProactiveCheck, type Alert } from '@/lib/execution/proactive-monitor';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

export async function GET(req: Request) {
  try {
    // ─── Verify cron secret ─────────────────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      const providedSecret =
        authHeader?.replace('Bearer ', '') ??
        new URL(req.url).searchParams.get('secret');

      if (providedSecret !== cronSecret) {
        console.warn('[cron/proactive-check] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[cron/proactive-check] Starting proactive checks...');
    const startTime = Date.now();
    const supabase = createAdminClient();

    // ─── Find all orgs with connected integrations ──────────────────────────
    const { data: orgs, error: orgsError } = await supabase
      .from('integrations')
      .select('org_id')
      .eq('status', 'connected');

    if (orgsError) {
      console.error('[cron/proactive-check] Failed to load orgs:', orgsError.message);
      return NextResponse.json({ success: false, error: orgsError.message }, { status: 500 });
    }

    // Deduplicate org IDs
    const orgIds = [...new Set((orgs ?? []).map((r) => r.org_id))];
    console.log(`[cron/proactive-check] Checking ${orgIds.length} orgs`);

    let totalAlerts = 0;
    let errors = 0;

    // ─── Run checks for each org ────────────────────────────────────────────
    const results = await Promise.allSettled(
      orgIds.map(async (orgId) => {
        try {
          const alerts = await runProactiveCheck(orgId);
          if (alerts.length === 0) return { orgId, alertCount: 0 };

          // Store alerts in DB
          const rows = alerts.map((alert) => ({
            org_id: orgId,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            suggested_action: alert.suggestedAction,
            source_provider: alert.sourceProvider,
            metadata: alert.metadata ?? {},
            read: false,
          }));

          const { error: insertError } = await supabase.from('alerts').insert(rows);
          if (insertError) {
            console.error(`[cron/proactive-check] Failed to store alerts for org ${orgId}:`, insertError.message);
          }

          // Send notifications for high-severity alerts
          await notifyHighSeverity(orgId, alerts, supabase);

          return { orgId, alertCount: alerts.length };
        } catch (err) {
          console.error(`[cron/proactive-check] Error for org ${orgId}:`, err);
          throw err;
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalAlerts += result.value.alertCount;
      } else {
        errors++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[cron/proactive-check] Completed in ${durationMs}ms: ${orgIds.length} orgs, ${totalAlerts} alerts, ${errors} errors`
    );

    return NextResponse.json({
      success: true,
      orgsChecked: orgIds.length,
      totalAlerts,
      errors,
      durationMs,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/proactive-check] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Proactive check failed' },
      { status: 500 }
    );
  }
}

// ── Notify for high-severity alerts ──────────────────────────────────────────

async function notifyHighSeverity(
  orgId: string,
  alerts: Alert[],
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  const critical = alerts.filter((a) => a.severity === 'critical');
  if (critical.length === 0) return;

  // Look up org owner email for notifications
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .limit(1);

  if (!members || members.length === 0) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', members[0].user_id)
    .single();

  if (!profile?.email) return;

  // Log the notification intent (actual email/Slack sending uses Composio tools
  // which require an agent context — for cron, we store the alert and let the
  // dashboard surface it as a badge/notification)
  console.log(
    `[cron/proactive-check] ${critical.length} critical alert(s) for org ${orgId} — owner: ${profile.email}`
  );
}
