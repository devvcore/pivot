/**
 * Proactive Slack Alerts — sends business intelligence alerts to monitored
 * Slack channels when the proactive monitoring system detects something important.
 *
 * Looks up the org's slack_bot_settings to find the first monitored channel,
 * then formats a Block Kit message with severity context and sends it via the
 * Slack Web API.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProactiveAlert {
  type: string;     // e.g. 'revenue_drop', 'churn_risk', 'overdue_tasks'
  title: string;    // e.g. 'Revenue Drop Detected'
  message: string;  // detailed message
  severity: 'info' | 'warning' | 'critical';
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<ProactiveAlert['severity'], string> = {
  critical: ':rotating_light:',
  warning: ':warning:',
  info: ':information_source:',
};

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendProactiveAlertToSlack(
  orgId: string,
  alert: ProactiveAlert
): Promise<void> {
  const token = process.env.SLACK_APP_TOKEN;
  if (!token) {
    console.warn('[proactive-alerts] SLACK_APP_TOKEN not set — skipping');
    return;
  }

  // ─── Look up Slack settings for this org ──────────────────────────────────
  const supabase = createAdminClient();
  const { data: settings, error } = await supabase
    .from('slack_bot_settings')
    .select('monitored_channels, client_interaction_enabled')
    .eq('org_id', orgId)
    .single();

  if (error || !settings) {
    // No Slack configured for this org — silently skip
    return;
  }

  const channels: string[] = settings.monitored_channels ?? [];
  if (channels.length === 0) {
    return;
  }

  const channel = channels[0];

  // ─── Build Block Kit payload ───────────────────────────────────────────────
  const emoji = SEVERITY_EMOJI[alert.severity] ?? ':information_source:';
  const truncatedMessage =
    alert.message.length > 2500
      ? alert.message.slice(0, 2497) + '...'
      : alert.message;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${alert.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: truncatedMessage,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Alert type:* \`${alert.type}\` · *Severity:* \`${alert.severity}\` · ${new Date().toISOString()}`,
        },
      ],
    },
  ];

  // ─── Send via Slack Web API ────────────────────────────────────────────────
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, blocks }),
  });

  if (!res.ok) {
    console.error(
      `[proactive-alerts] HTTP error posting to Slack: ${res.status} ${res.statusText}`
    );
    return;
  }

  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok) {
    console.error(`[proactive-alerts] Slack API error: ${json.error}`);
  } else {
    console.log(
      `[proactive-alerts] Sent "${alert.title}" (${alert.severity}) to channel ${channel} for org ${orgId}`
    );
  }
}
