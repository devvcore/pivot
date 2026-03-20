/**
 * Weekly Digest Generator — Creates a weekly summary of business activity.
 *
 * Pulls integration data, agent task history, and alerts to produce
 * an HTML email + plain text digest for the org.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { collectIntegrationContext } from '@/lib/integrations/collect';
import type { Alert } from './proactive-monitor';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyDigest {
  orgId: string;
  orgName: string;
  periodStart: string;
  periodEnd: string;
  metrics: DigestMetric[];
  tasksCompleted: DigestTask[];
  alertsSummary: DigestAlertSummary;
  recommendations: string[];
  hoursSaved: number;
  html: string;
  plainText: string;
}

export interface DigestMetric {
  label: string;
  thisWeek: string;
  lastWeek: string;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

export interface DigestTask {
  title: string;
  agent: string;
  completedAt: string;
}

export interface DigestAlertSummary {
  critical: number;
  warning: number;
  info: number;
  topAlerts: Pick<Alert, 'title' | 'severity'>[];
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function generateWeeklyDigest(orgId: string): Promise<WeeklyDigest> {
  const supabase = createAdminClient();

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400 * 1000);
  const periodStart = oneWeekAgo.toISOString().split('T')[0];
  const periodEnd = now.toISOString().split('T')[0];

  // Load org name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();
  const orgName = org?.name ?? 'Your Business';

  // Run data loads in parallel
  const [integrationCtx, tasksResult, alertsResult] = await Promise.all([
    collectIntegrationContext(orgId),
    supabase
      .from('execution_tasks')
      .select('title, agent_id, completed_at')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('completed_at', oneWeekAgo.toISOString())
      .order('completed_at', { ascending: false })
      .limit(50),
    supabase
      .from('alerts')
      .select('title, severity, type')
      .eq('org_id', orgId)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const metrics = extractMetrics(integrationCtx.records, oneWeekAgo, twoWeeksAgo);

  // ── Tasks completed ─────────────────────────────────────────────────────────
  const tasksCompleted: DigestTask[] = (tasksResult.data ?? []).map((t) => ({
    title: t.title,
    agent: t.agent_id,
    completedAt: t.completed_at,
  }));

  // ── Alerts summary ─────────────────────────────────────────────────────────
  const alertRows = alertsResult.data ?? [];
  const alertsSummary: DigestAlertSummary = {
    critical: alertRows.filter((a) => a.severity === 'critical').length,
    warning: alertRows.filter((a) => a.severity === 'warning').length,
    info: alertRows.filter((a) => a.severity === 'info').length,
    topAlerts: alertRows.slice(0, 5).map((a) => ({ title: a.title, severity: a.severity })),
  };

  // ── Recommendations ────────────────────────────────────────────────────────
  const recommendations = generateRecommendations(metrics, alertsSummary, tasksCompleted);

  // ── Hours saved estimate (rough: 15-30 min per completed task) ─────────────
  const hoursSaved = Math.round(tasksCompleted.length * 0.35 * 10) / 10;

  // ── Build output ───────────────────────────────────────────────────────────
  const digest: WeeklyDigest = {
    orgId,
    orgName,
    periodStart,
    periodEnd,
    metrics,
    tasksCompleted,
    alertsSummary,
    recommendations,
    hoursSaved,
    html: '',
    plainText: '',
  };

  digest.html = renderHtml(digest);
  digest.plainText = renderPlainText(digest);

  return digest;
}

// ── Extract metrics from integration data ────────────────────────────────────

function extractMetrics(
  records: Array<{ provider: string; recordType: string; data: unknown; syncedAt: string }>,
  oneWeekAgo: Date,
  twoWeeksAgo: Date
): DigestMetric[] {
  const metrics: DigestMetric[] = [];

  // Stripe revenue
  const stripePayments = records.find((r) => r.provider === 'stripe' && r.recordType === 'payments');
  if (stripePayments) {
    const items = extractArray(stripePayments.data);
    let thisWeek = 0;
    let lastWeek = 0;
    const oneWeekTs = oneWeekAgo.getTime() / 1000;
    const twoWeeksTs = twoWeeksAgo.getTime() / 1000;

    for (const p of items) {
      const payment = p as Record<string, unknown>;
      if (payment.status !== 'succeeded') continue;
      const amount = Number(payment.amount ?? 0) / 100;
      const created = Number(payment.created ?? 0);
      if (created >= oneWeekTs) thisWeek += amount;
      else if (created >= twoWeeksTs) lastWeek += amount;
    }

    const change = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
    metrics.push({
      label: 'Revenue (Stripe)',
      thisWeek: `$${thisWeek.toLocaleString()}`,
      lastWeek: `$${lastWeek.toLocaleString()}`,
      changePercent: change,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    });
  }

  // Stripe customers
  const stripeCust = records.find((r) => r.provider === 'stripe' && r.recordType === 'customers');
  if (stripeCust) {
    const items = extractArray(stripeCust.data);
    const oneWeekTs = oneWeekAgo.getTime() / 1000;
    const newThisWeek = items.filter((c) => Number((c as Record<string, unknown>).created ?? 0) >= oneWeekTs).length;
    metrics.push({
      label: 'New Customers',
      thisWeek: String(newThisWeek),
      lastWeek: '-',
      changePercent: 0,
      direction: 'flat',
    });
  }

  // Jira tasks
  const jiraIssues = records.find((r) => r.provider === 'jira' && r.recordType === 'issues');
  if (jiraIssues) {
    const items = extractArray(jiraIssues.data);
    let openCount = 0;
    let doneCount = 0;
    for (const item of items) {
      const issue = item as Record<string, unknown>;
      const fields = (issue.fields ?? issue) as Record<string, unknown>;
      const status = String(
        (fields.status as Record<string, unknown>)?.name ?? fields.status ?? ''
      ).toLowerCase();
      if (['done', 'closed', 'resolved'].includes(status)) doneCount++;
      else openCount++;
    }
    metrics.push({
      label: 'Jira Issues (Open/Done)',
      thisWeek: `${openCount} open / ${doneCount} done`,
      lastWeek: '-',
      changePercent: 0,
      direction: 'flat',
    });
  }

  return metrics;
}

// ── Generate recommendations ─────────────────────────────────────────────────

function generateRecommendations(
  metrics: DigestMetric[],
  alertsSummary: DigestAlertSummary,
  tasks: DigestTask[]
): string[] {
  const recs: string[] = [];

  const revenueMetric = metrics.find((m) => m.label.includes('Revenue'));
  if (revenueMetric && revenueMetric.changePercent < -10) {
    recs.push('Revenue is declining — consider running a promotion or re-engaging lapsed customers.');
  } else if (revenueMetric && revenueMetric.changePercent > 30) {
    recs.push('Revenue is growing strongly — identify what is driving growth and double down.');
  }

  if (alertsSummary.critical > 0) {
    recs.push(`You have ${alertsSummary.critical} critical alert(s) that need immediate attention.`);
  }

  if (tasks.length === 0) {
    recs.push('No tasks were completed this week. Try delegating work to your Pivot agents to save time.');
  } else if (tasks.length >= 10) {
    recs.push(`Great productivity! ${tasks.length} tasks completed. Consider setting up recurring tasks for common workflows.`);
  }

  if (recs.length === 0) {
    recs.push('Everything looks stable this week. Keep up the momentum!');
  }

  return recs;
}

// ── HTML Renderer ─────────────────────────────────────────────────────────────

function renderHtml(digest: WeeklyDigest): string {
  const severityColor = (s: string) =>
    s === 'critical' ? '#dc2626' : s === 'warning' ? '#f59e0b' : '#3b82f6';
  const directionIcon = (d: string) =>
    d === 'up' ? '&#9650;' : d === 'down' ? '&#9660;' : '&#8212;';
  const directionColor = (d: string) =>
    d === 'up' ? '#16a34a' : d === 'down' ? '#dc2626' : '#6b7280';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937; background: #f9fafb;">
  <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="margin: 0 0 4px 0; font-size: 24px; color: #111827;">Weekly Digest</h1>
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">${digest.orgName} &middot; ${digest.periodStart} to ${digest.periodEnd}</p>

    ${digest.hoursSaved > 0 ? `<div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
      <span style="font-size: 28px; font-weight: 700; color: #059669;">${digest.hoursSaved}h</span>
      <p style="margin: 4px 0 0 0; color: #065f46; font-size: 14px;">estimated time saved by Pivot this week</p>
    </div>` : ''}

    ${digest.metrics.length > 0 ? `<h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Key Metrics</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <th style="text-align: left; padding: 8px 0; font-size: 13px; color: #6b7280;">Metric</th>
        <th style="text-align: right; padding: 8px 0; font-size: 13px; color: #6b7280;">This Week</th>
        <th style="text-align: right; padding: 8px 0; font-size: 13px; color: #6b7280;">Last Week</th>
        <th style="text-align: right; padding: 8px 0; font-size: 13px; color: #6b7280;">Change</th>
      </tr>
      ${digest.metrics.map((m) => `<tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 8px 0; font-size: 14px;">${m.label}</td>
        <td style="padding: 8px 0; font-size: 14px; text-align: right; font-weight: 600;">${m.thisWeek}</td>
        <td style="padding: 8px 0; font-size: 14px; text-align: right; color: #6b7280;">${m.lastWeek}</td>
        <td style="padding: 8px 0; font-size: 14px; text-align: right; color: ${directionColor(m.direction)}; font-weight: 600;">${directionIcon(m.direction)} ${m.changePercent !== 0 ? Math.abs(m.changePercent) + '%' : ''}</td>
      </tr>`).join('\n')}
    </table>` : ''}

    ${digest.tasksCompleted.length > 0 ? `<h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Tasks Completed (${digest.tasksCompleted.length})</h2>
    <ul style="margin: 0 0 24px 0; padding-left: 20px;">
      ${digest.tasksCompleted.slice(0, 10).map((t) => `<li style="font-size: 14px; margin-bottom: 4px;">${escapeHtml(t.title)} <span style="color: #6b7280;">(${t.agent})</span></li>`).join('\n')}
      ${digest.tasksCompleted.length > 10 ? `<li style="font-size: 14px; color: #6b7280;">+${digest.tasksCompleted.length - 10} more</li>` : ''}
    </ul>` : ''}

    ${digest.alertsSummary.topAlerts.length > 0 ? `<h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Alerts This Week</h2>
    <div style="margin-bottom: 24px;">
      ${digest.alertsSummary.topAlerts.map((a) => `<div style="display: flex; align-items: center; margin-bottom: 6px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${severityColor(a.severity)}; margin-right: 8px; flex-shrink: 0;"></span>
        <span style="font-size: 14px;">${escapeHtml(a.title)}</span>
      </div>`).join('\n')}
    </div>` : ''}

    ${digest.recommendations.length > 0 ? `<h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Recommendations</h2>
    <ul style="margin: 0 0 24px 0; padding-left: 20px;">
      ${digest.recommendations.map((r) => `<li style="font-size: 14px; margin-bottom: 4px;">${escapeHtml(r)}</li>`).join('\n')}
    </ul>` : ''}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 0;">Sent by Pivot &middot; Your AI business co-pilot</p>
  </div>
</body>
</html>`;
}

// ── Plain text renderer ──────────────────────────────────────────────────────

function renderPlainText(digest: WeeklyDigest): string {
  const lines: string[] = [
    `WEEKLY DIGEST — ${digest.orgName}`,
    `${digest.periodStart} to ${digest.periodEnd}`,
    '',
  ];

  if (digest.hoursSaved > 0) {
    lines.push(`Pivot saved you ~${digest.hoursSaved} hours this week.`, '');
  }

  if (digest.metrics.length > 0) {
    lines.push('KEY METRICS');
    for (const m of digest.metrics) {
      const arrow = m.direction === 'up' ? '+' : m.direction === 'down' ? '-' : '=';
      lines.push(`  ${m.label}: ${m.thisWeek} (was ${m.lastWeek}) ${arrow}${m.changePercent !== 0 ? Math.abs(m.changePercent) + '%' : ''}`);
    }
    lines.push('');
  }

  if (digest.tasksCompleted.length > 0) {
    lines.push(`TASKS COMPLETED (${digest.tasksCompleted.length})`);
    for (const t of digest.tasksCompleted.slice(0, 10)) {
      lines.push(`  - ${t.title} (${t.agent})`);
    }
    if (digest.tasksCompleted.length > 10) {
      lines.push(`  ... and ${digest.tasksCompleted.length - 10} more`);
    }
    lines.push('');
  }

  if (digest.alertsSummary.topAlerts.length > 0) {
    lines.push('ALERTS THIS WEEK');
    for (const a of digest.alertsSummary.topAlerts) {
      lines.push(`  [${a.severity.toUpperCase()}] ${a.title}`);
    }
    lines.push('');
  }

  if (digest.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    for (const r of digest.recommendations) {
      lines.push(`  - ${r}`);
    }
    lines.push('');
  }

  lines.push('---', 'Sent by Pivot — Your AI business co-pilot');
  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const obj = data as Record<string, unknown>;
  if (obj?.data) {
    const inner = obj.data as Record<string, unknown>;
    if (Array.isArray(inner)) return inner;
    if (inner?.data && Array.isArray(inner.data)) return inner.data as unknown[];
  }
  if (obj?.items && Array.isArray(obj.items)) return obj.items as unknown[];
  if (obj?.issues && Array.isArray(obj.issues)) return obj.issues as unknown[];
  return [];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
