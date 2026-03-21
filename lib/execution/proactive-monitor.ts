/**
 * Proactive Monitor — Checks integration data for anomalies and important changes.
 *
 * Scans connected provider data (Stripe, QuickBooks, Jira, Gmail, Instagram, LinkedIn)
 * and returns actionable alerts when thresholds are breached.
 *
 * Ported patterns from BetterBot's heartbeat.js:
 * - Event dedup: hash-based deduplication prevents re-alerting on the same event within a day
 * - 3-tier check: IGNORE → LOG → ACT classification with escalation on repeated failures
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'revenue_drop'
  | 'revenue_spike'
  | 'new_customers'
  | 'lost_customers'
  | 'unusual_expense'
  | 'overdue_tasks'
  | 'unread_important_emails'
  | 'social_engagement_spike'
  | 'social_engagement_drop'
  // Risk alert types (ported from Ultron)
  | 'churn_risk'
  | 'escalation'
  | 'dissatisfaction'
  | 'missed_commitment'
  | 'quality_complaint'
  | 'communication_breakdown'
  // Bottleneck types (ported from Ultron)
  | 'repeated_request'
  | 'slow_response'
  | 'untracked_feature'
  | 'scope_creep'
  | 'overloaded_member'
  | 'circular_discussion'
  | 'stakeholder_misalignment';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  suggestedAction: string;
  sourceProvider: string;
  metadata?: Record<string, unknown>;
}

// ── Event Dedup (ported from BetterBot heartbeat.js) ──────────────────────────
// Hash-based deduplication prevents re-alerting on the same event within a day.
// In-memory cache per org, keyed by alert content hash.

interface HandledEvent {
  date: string; // YYYY-MM-DD
  outcome: 'alerted' | 'ignored';
  attempts: number;
  lastAttempt: string;
}

// orgId -> { eventKey -> HandledEvent }
const handledEventsCache = new Map<string, Map<string, HandledEvent>>();

/**
 * Simple hash for event dedup — normalize the alert title, strip volatile numbers.
 */
function alertEventKey(title: string): string {
  const normalized = title.toLowerCase().replace(/\$[\d,.]+/g, '').replace(/\d+%/g, '').trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Check if an alert was already handled today. Returns the previous handling info or null.
 */
function checkAlreadyHandled(orgId: string, alertTitle: string): HandledEvent | null {
  const orgCache = handledEventsCache.get(orgId);
  if (!orgCache) return null;
  const key = alertEventKey(alertTitle);
  const prev = orgCache.get(key);
  if (!prev) return null;
  if (prev.date !== getToday()) {
    orgCache.delete(key); // Prune stale entries
    return null;
  }
  return prev;
}

/**
 * Mark an alert as handled today.
 */
function markAlertHandled(orgId: string, alertTitle: string, outcome: 'alerted' | 'ignored'): void {
  if (!handledEventsCache.has(orgId)) {
    handledEventsCache.set(orgId, new Map());
  }
  const orgCache = handledEventsCache.get(orgId)!;
  const key = alertEventKey(alertTitle);
  const prev = orgCache.get(key);
  orgCache.set(key, {
    date: getToday(),
    outcome,
    attempts: (prev?.attempts ?? 0) + 1,
    lastAttempt: new Date().toISOString(),
  });

  // Prune old entries (not today)
  const today = getToday();
  for (const [k, v] of orgCache.entries()) {
    if (v.date !== today) orgCache.delete(k);
  }
}

// ── 3-Tier Alert Classification (ported from BetterBot) ───────────────────────
// Tier 1: IGNORE — noise, routine, or already handled today
// Tier 2: LOG — worth noting, but no immediate action needed (severity: 'info')
// Tier 3: ACT — needs user attention or action (severity: 'warning' | 'critical')

export type AlertTier = 'ignore' | 'log' | 'act';

/**
 * Classify an alert into a tier based on severity and dedup status.
 * Critical alerts always ACT. Info alerts that repeat get downgraded to IGNORE.
 * Warning alerts on second occurrence get downgraded to LOG.
 */
export function classifyAlertTier(alert: Alert, orgId: string): AlertTier {
  const prev = checkAlreadyHandled(orgId, alert.title);

  // Critical alerts always escalate (but throttle after 3 per day)
  if (alert.severity === 'critical') {
    if (prev && prev.attempts >= 3) return 'log';
    return 'act';
  }

  // Warning alerts: first time -> ACT, second time -> LOG, third+ -> IGNORE
  if (alert.severity === 'warning') {
    if (!prev) return 'act';
    if (prev.attempts === 1) return 'log';
    return 'ignore';
  }

  // Info alerts: first time -> LOG, repeated -> IGNORE
  if (alert.severity === 'info') {
    if (!prev) return 'log';
    return 'ignore';
  }

  return 'log';
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runProactiveCheck(orgId: string): Promise<Alert[]> {
  const supabase = createAdminClient();
  const rawAlerts: Alert[] = [];

  // Load all integration data for this org
  const { data: rows } = await supabase
    .from('integration_data')
    .select('provider, record_type, data, synced_at')
    .eq('org_id', orgId)
    .order('synced_at', { ascending: false });

  if (!rows || rows.length === 0) return [];

  // Index records by provider + record_type for fast lookup
  const lookup = new Map<string, unknown>();
  for (const row of rows) {
    const key = `${row.provider}:${row.record_type}`;
    if (!lookup.has(key)) {
      lookup.set(key, typeof row.data === 'string' ? safeParseJson(row.data) : row.data);
    }
  }

  // Run all checkers in parallel (includes risk + bottleneck detectors ported from Ultron)
  const checkers = [
    checkStripeRevenue(lookup, rawAlerts),
    checkStripeCustomers(lookup, rawAlerts),
    checkQuickBooksExpenses(lookup, rawAlerts),
    checkJiraOverdue(lookup, rawAlerts),
    checkGmailImportant(lookup, rawAlerts),
    checkSocialEngagement(lookup, rawAlerts),
    checkClientRiskSignals(orgId, rawAlerts),
    checkBottlenecks(orgId, rawAlerts),
  ];
  await Promise.allSettled(checkers);

  // 3-tier classification: dedup and filter alerts (BetterBot pattern)
  const actionableAlerts: Alert[] = [];
  for (const alert of rawAlerts) {
    const tier = classifyAlertTier(alert, orgId);
    if (tier === 'ignore') {
      markAlertHandled(orgId, alert.title, 'ignored');
      continue;
    }
    if (tier === 'log') {
      // Downgrade severity to info for LOG-tier alerts
      markAlertHandled(orgId, alert.title, 'alerted');
      actionableAlerts.push({ ...alert, severity: 'info' });
      continue;
    }
    // ACT tier — keep as-is
    markAlertHandled(orgId, alert.title, 'alerted');
    actionableAlerts.push(alert);
  }

  return actionableAlerts;
}

// ── Stripe: Revenue changes ──────────────────────────────────────────────────

async function checkStripeRevenue(
  lookup: Map<string, unknown>,
  alerts: Alert[]
): Promise<void> {
  const payments = lookup.get('stripe:payments') as Record<string, unknown> | undefined;
  if (!payments) return;

  const items = extractArray(payments);
  if (items.length === 0) return;

  const now = Date.now() / 1000;
  const oneWeekAgo = now - 7 * 86400;
  const twoWeeksAgo = now - 14 * 86400;

  let thisWeekRevenue = 0;
  let lastWeekRevenue = 0;

  for (const p of items) {
    const payment = p as Record<string, unknown>;
    if (payment.status !== 'succeeded') continue;
    const amount = Number(payment.amount ?? 0) / 100;
    const created = Number(payment.created ?? 0);

    if (created >= oneWeekAgo) {
      thisWeekRevenue += amount;
    } else if (created >= twoWeeksAgo) {
      lastWeekRevenue += amount;
    }
  }

  if (lastWeekRevenue <= 0) return;

  const changePercent = ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100;

  if (changePercent <= -20) {
    alerts.push({
      type: 'revenue_drop',
      severity: changePercent <= -40 ? 'critical' : 'warning',
      title: `Revenue dropped ${Math.abs(Math.round(changePercent))}% this week`,
      message: `This week: $${thisWeekRevenue.toLocaleString()} vs last week: $${lastWeekRevenue.toLocaleString()}. That's a ${Math.abs(Math.round(changePercent))}% decline.`,
      suggestedAction: 'Review recent churn, check for payment failures, and consider running a re-engagement campaign.',
      sourceProvider: 'stripe',
      metadata: { thisWeekRevenue, lastWeekRevenue, changePercent: Math.round(changePercent) },
    });
  } else if (changePercent >= 50) {
    alerts.push({
      type: 'revenue_spike',
      severity: 'info',
      title: `Revenue grew ${Math.round(changePercent)}% this week`,
      message: `This week: $${thisWeekRevenue.toLocaleString()} vs last week: $${lastWeekRevenue.toLocaleString()}. Strong growth!`,
      suggestedAction: 'Investigate what drove the spike — new customers, upsells, or seasonal patterns. Consider scaling what works.',
      sourceProvider: 'stripe',
      metadata: { thisWeekRevenue, lastWeekRevenue, changePercent: Math.round(changePercent) },
    });
  }
}

// ── Stripe: New/lost customers ───────────────────────────────────────────────

async function checkStripeCustomers(
  lookup: Map<string, unknown>,
  alerts: Alert[]
): Promise<void> {
  const customers = lookup.get('stripe:customers') as Record<string, unknown> | undefined;
  if (!customers) return;

  const items = extractArray(customers);
  if (items.length === 0) return;

  const now = Date.now() / 1000;
  const oneWeekAgo = now - 7 * 86400;

  const newCustomers: string[] = [];
  for (const c of items) {
    const customer = c as Record<string, unknown>;
    const created = Number(customer.created ?? 0);
    if (created >= oneWeekAgo) {
      newCustomers.push(String(customer.name ?? customer.email ?? customer.id ?? 'Unknown'));
    }
  }

  if (newCustomers.length >= 3) {
    alerts.push({
      type: 'new_customers',
      severity: 'info',
      title: `${newCustomers.length} new customers this week`,
      message: `New customers: ${newCustomers.slice(0, 5).join(', ')}${newCustomers.length > 5 ? ` and ${newCustomers.length - 5} more` : ''}.`,
      suggestedAction: 'Send welcome emails and set up onboarding sequences. Track which acquisition channel is driving growth.',
      sourceProvider: 'stripe',
      metadata: { count: newCustomers.length, names: newCustomers.slice(0, 10) },
    });
  }

  // Check for potential churn signals: customers with failed charges in the overview
  const overview = lookup.get('stripe:charges_overview') as Record<string, unknown> | undefined;
  if (overview) {
    const failedCharges = Number(overview.failedCharges ?? 0);
    if (failedCharges >= 3) {
      alerts.push({
        type: 'lost_customers',
        severity: 'warning',
        title: `${failedCharges} failed charges detected`,
        message: `${failedCharges} payment attempts failed recently. These customers may churn if not addressed.`,
        suggestedAction: 'Check Stripe dashboard for failed payments. Reach out to affected customers and update their payment methods.',
        sourceProvider: 'stripe',
        metadata: { failedCharges },
      });
    }
  }
}

// ── QuickBooks: Unusual expenses ─────────────────────────────────────────────

async function checkQuickBooksExpenses(
  lookup: Map<string, unknown>,
  alerts: Alert[]
): Promise<void> {
  const invoices = lookup.get('quickbooks:invoices') as Record<string, unknown> | undefined;
  const accounts = lookup.get('quickbooks:accounts') as Record<string, unknown> | undefined;

  // Check for large outstanding invoices
  if (invoices) {
    const items = extractArray(invoices);
    let overdueTotal = 0;
    let overdueCount = 0;

    for (const inv of items) {
      const invoice = inv as Record<string, unknown>;
      const balance = Number(invoice.Balance ?? invoice.balance ?? 0);
      const dueDate = String(invoice.DueDate ?? invoice.dueDate ?? '');

      if (balance > 0 && dueDate) {
        const due = new Date(dueDate).getTime();
        if (due < Date.now()) {
          overdueTotal += balance;
          overdueCount++;
        }
      }
    }

    if (overdueCount >= 2 || overdueTotal >= 5000) {
      alerts.push({
        type: 'unusual_expense',
        severity: overdueTotal >= 20000 ? 'critical' : 'warning',
        title: `$${overdueTotal.toLocaleString()} in overdue invoices`,
        message: `${overdueCount} invoices are past due, totaling $${overdueTotal.toLocaleString()}.`,
        suggestedAction: 'Follow up with late-paying clients. Consider sending reminders or adjusting payment terms.',
        sourceProvider: 'quickbooks',
        metadata: { overdueCount, overdueTotal },
      });
    }
  }

  // Check for low bank balances
  if (accounts) {
    const items = extractArray(accounts);
    for (const acc of items) {
      const account = acc as Record<string, unknown>;
      const accountType = String(account.AccountType ?? account.accountType ?? '');
      const balance = Number(account.CurrentBalance ?? account.currentBalance ?? 0);
      const name = String(account.Name ?? account.name ?? 'Account');

      if (accountType === 'Bank' && balance < 5000 && balance >= 0) {
        alerts.push({
          type: 'unusual_expense',
          severity: balance < 1000 ? 'critical' : 'warning',
          title: `Low bank balance: ${name}`,
          message: `${name} balance is $${balance.toLocaleString()}. Consider topping up or reducing expenses.`,
          suggestedAction: 'Review upcoming expenses and ensure sufficient runway. Accelerate accounts receivable collection.',
          sourceProvider: 'quickbooks',
          metadata: { accountName: name, balance },
        });
      }
    }
  }
}

// ── Jira: Overdue tasks ──────────────────────────────────────────────────────

async function checkJiraOverdue(
  lookup: Map<string, unknown>,
  alerts: Alert[]
): Promise<void> {
  const issues = lookup.get('jira:issues') as Record<string, unknown> | undefined;
  if (!issues) return;

  const items = extractArray(issues);
  if (items.length === 0) return;

  const now = Date.now();
  const overdueIssues: string[] = [];

  for (const item of items) {
    const issue = item as Record<string, unknown>;
    const fields = (issue.fields ?? issue) as Record<string, unknown>;
    const dueDate = String(fields.duedate ?? fields.dueDate ?? '');
    const status = String(
      (fields.status as Record<string, unknown>)?.name ??
      fields.status ?? ''
    ).toLowerCase();
    const key = String(issue.key ?? issue.id ?? '');
    const summary = String(fields.summary ?? '');

    if (dueDate && !['done', 'closed', 'resolved'].includes(status)) {
      const due = new Date(dueDate).getTime();
      if (due < now) {
        overdueIssues.push(`${key}: ${summary}`);
      }
    }
  }

  if (overdueIssues.length >= 2) {
    alerts.push({
      type: 'overdue_tasks',
      severity: overdueIssues.length >= 5 ? 'warning' : 'info',
      title: `${overdueIssues.length} overdue Jira issues`,
      message: `Overdue: ${overdueIssues.slice(0, 5).join('; ')}${overdueIssues.length > 5 ? ` (+${overdueIssues.length - 5} more)` : ''}.`,
      suggestedAction: 'Triage overdue issues — close stale ones, re-prioritize blockers, and reassign if needed.',
      sourceProvider: 'jira',
      metadata: { count: overdueIssues.length, issues: overdueIssues.slice(0, 10) },
    });
  }
}

// ── Gmail: Unread important emails ───────────────────────────────────────────

async function checkGmailImportant(
  lookup: Map<string, unknown>,
  alerts: Alert[]
): Promise<void> {
  const emails = lookup.get('gmail:emails') as Record<string, unknown> | undefined;
  if (!emails) return;

  // Gmail data may be nested: { data: { messages: [...] } } or { messages: [...] }
  const rawData = emails.data as Record<string, unknown> | undefined;
  const msgs = (rawData?.messages ?? emails.messages ?? rawData ?? emails) as unknown;
  if (!Array.isArray(msgs)) return;

  const now = Date.now();
  const threeDaysAgo = now - 3 * 86400 * 1000;
  const importantUnread: string[] = [];

  for (const m of msgs) {
    const msg = m as Record<string, unknown>;
    const labels = msg.labelIds as string[] | undefined;
    const isUnread = labels?.includes('UNREAD') ?? (msg.read === false);
    const isImportant = labels?.includes('IMPORTANT') ?? false;
    const subject = String(msg.subject ?? msg.Subject ?? msg.snippet ?? '');
    const dateStr = String(msg.date ?? msg.Date ?? msg.internalDate ?? '');

    let msgDate = 0;
    if (dateStr) {
      const parsed = Number(dateStr);
      msgDate = parsed > 1e12 ? parsed : parsed > 1e9 ? parsed * 1000 : new Date(dateStr).getTime();
    }

    if (isUnread && isImportant && msgDate >= threeDaysAgo) {
      importantUnread.push(subject.slice(0, 80));
    }
  }

  if (importantUnread.length >= 3) {
    alerts.push({
      type: 'unread_important_emails',
      severity: importantUnread.length >= 10 ? 'warning' : 'info',
      title: `${importantUnread.length} unread important emails`,
      message: `You have ${importantUnread.length} unread important emails in the last 3 days. Subjects include: "${importantUnread.slice(0, 3).join('", "')}".`,
      suggestedAction: 'Review and respond to important emails to keep communication flowing.',
      sourceProvider: 'gmail',
      metadata: { count: importantUnread.length, subjects: importantUnread.slice(0, 10) },
    });
  }
}

// ── Social: Engagement spikes/drops ──────────────────────────────────────────

async function checkSocialEngagement(
  lookup: Map<string, unknown>,
  alerts: Alert[]
): Promise<void> {
  // Instagram insights
  const igInsights = lookup.get('instagram:insights') as Record<string, unknown> | undefined;
  if (igInsights) {
    const data = (igInsights.data ?? igInsights) as Record<string, unknown>;
    const reach = Number(data.reach ?? data.impressions ?? 0);
    const prevReach = Number(data.previousReach ?? data.previousImpressions ?? 0);

    if (prevReach > 0 && reach > 0) {
      const change = ((reach - prevReach) / prevReach) * 100;
      if (change >= 100) {
        alerts.push({
          type: 'social_engagement_spike',
          severity: 'info',
          title: `Instagram reach up ${Math.round(change)}%`,
          message: `Your Instagram reach jumped from ${prevReach.toLocaleString()} to ${reach.toLocaleString()}. Something is resonating!`,
          suggestedAction: 'Identify which posts drove the spike and create more similar content. Engage with new followers.',
          sourceProvider: 'instagram',
          metadata: { reach, prevReach, changePercent: Math.round(change) },
        });
      } else if (change <= -50) {
        alerts.push({
          type: 'social_engagement_drop',
          severity: 'warning',
          title: `Instagram reach dropped ${Math.abs(Math.round(change))}%`,
          message: `Your Instagram reach fell from ${prevReach.toLocaleString()} to ${reach.toLocaleString()}.`,
          suggestedAction: 'Check posting frequency, content quality, and algorithm changes. Consider running a campaign to re-engage.',
          sourceProvider: 'instagram',
          metadata: { reach, prevReach, changePercent: Math.round(change) },
        });
      }
    }
  }

  // LinkedIn profile engagement
  const liProfile = lookup.get('linkedin:profile') as Record<string, unknown> | undefined;
  if (liProfile) {
    const followers = Number(liProfile.followersCount ?? liProfile.numFollowers ?? 0);
    const prevFollowers = Number(liProfile.previousFollowersCount ?? 0);

    if (prevFollowers > 0 && followers > 0) {
      const gained = followers - prevFollowers;
      if (gained >= 50) {
        alerts.push({
          type: 'social_engagement_spike',
          severity: 'info',
          title: `Gained ${gained} LinkedIn followers`,
          message: `Your LinkedIn followers grew from ${prevFollowers.toLocaleString()} to ${followers.toLocaleString()}.`,
          suggestedAction: 'Keep posting consistently. Engage with new followers and share valuable content.',
          sourceProvider: 'linkedin',
          metadata: { followers, prevFollowers, gained },
        });
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

// ── Client Risk Signal Detection (ported from Ultron risk-alert.ts) ──────────
// Scans recent Slack conversations and execution task outputs for churn/escalation signals.

const RISK_KEYWORDS: Record<string, { type: AlertType; severity: AlertSeverity; label: string }> = {
  // Churn risk signals
  'looking at alternatives': { type: 'churn_risk', severity: 'critical', label: 'Client evaluating alternatives' },
  'considering other options': { type: 'churn_risk', severity: 'critical', label: 'Client considering other options' },
  'not sure this is working': { type: 'churn_risk', severity: 'warning', label: 'Client losing confidence' },
  'cancel': { type: 'churn_risk', severity: 'warning', label: 'Cancellation signal detected' },
  'consideration going forward': { type: 'churn_risk', severity: 'warning', label: 'Client reconsidering engagement' },
  // Escalation signals
  'not very professional': { type: 'escalation', severity: 'critical', label: 'Professionalism complaint' },
  'asked for this before': { type: 'escalation', severity: 'warning', label: 'Repeated unanswered request' },
  'i asked for this earlier': { type: 'escalation', severity: 'warning', label: 'Repeated unanswered request' },
  'can we get someone else': { type: 'escalation', severity: 'critical', label: 'Trust loss in team member' },
  // Dissatisfaction
  'not what i asked for': { type: 'dissatisfaction', severity: 'warning', label: 'Deliverable misalignment' },
  'this is broken': { type: 'quality_complaint', severity: 'warning', label: 'Quality issue reported' },
  'not working': { type: 'quality_complaint', severity: 'warning', label: 'Feature malfunction reported' },
  'disappointed': { type: 'dissatisfaction', severity: 'warning', label: 'Client expressed disappointment' },
  'frustrated': { type: 'dissatisfaction', severity: 'warning', label: 'Client expressed frustration' },
  // Missed commitments
  'was supposed to be done': { type: 'missed_commitment', severity: 'warning', label: 'Missed deadline referenced' },
  'still waiting': { type: 'missed_commitment', severity: 'warning', label: 'Client still waiting on deliverable' },
  'impacts our revenue': { type: 'churn_risk', severity: 'critical', label: 'Revenue impact flagged by client' },
};

async function checkClientRiskSignals(
  orgId: string,
  alerts: Alert[],
): Promise<void> {
  const supabase = createAdminClient();

  // Scan recent Slack bot conversations (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data: convos } = await supabase
    .from('slack_bot_conversations')
    .select('messages')
    .eq('org_id', orgId)
    .gte('last_message_at', weekAgo)
    .limit(20);

  if (!convos || convos.length === 0) return;

  // Flatten all user messages from conversations
  const userMessages: string[] = [];
  for (const convo of convos) {
    const msgs = Array.isArray(convo.messages) ? convo.messages : [];
    for (const m of msgs) {
      const msg = m as Record<string, string>;
      if (msg.role === 'user' && msg.content) {
        userMessages.push(msg.content);
      }
    }
  }

  if (userMessages.length === 0) return;
  const allText = userMessages.join('\n').toLowerCase();

  // Scan for risk keywords
  const found = new Map<AlertType, { severity: AlertSeverity; label: string; quote: string }>();

  for (const [keyword, meta] of Object.entries(RISK_KEYWORDS)) {
    if (allText.includes(keyword)) {
      // Find the message that contains this keyword for the quote
      const matchMsg = userMessages.find(m => m.toLowerCase().includes(keyword));
      const existing = found.get(meta.type);
      // Keep the higher severity
      if (!existing || severityRank(meta.severity) > severityRank(existing.severity)) {
        found.set(meta.type, {
          severity: meta.severity,
          label: meta.label,
          quote: matchMsg?.slice(0, 200) ?? keyword,
        });
      }
    }
  }

  for (const [type, { severity, label, quote }] of found) {
    alerts.push({
      type,
      severity,
      title: label,
      message: `Detected in recent conversation: "${quote.slice(0, 150)}${quote.length > 150 ? '...' : ''}"`,
      suggestedAction: getRiskAction(type),
      sourceProvider: 'slack',
      metadata: { quote },
    });
  }
}

function severityRank(s: AlertSeverity): number {
  return s === 'critical' ? 3 : s === 'warning' ? 2 : 1;
}

function getRiskAction(type: AlertType): string {
  switch (type) {
    case 'churn_risk':
      return 'Schedule a call with this client immediately. Understand their concerns and present a concrete plan to address them.';
    case 'escalation':
      return 'Have a senior team member reach out. Acknowledge the issue directly and share what is being done to resolve it.';
    case 'dissatisfaction':
      return 'Review recent deliverables against requirements. Schedule a realignment meeting to confirm expectations.';
    case 'missed_commitment':
      return 'Audit outstanding commitments. Provide honest timeline update and offer quick wins to rebuild trust.';
    case 'quality_complaint':
      return 'Prioritize the reported bug/issue. Fix it within 24 hours if possible and confirm the fix with the client.';
    case 'communication_breakdown':
      return 'Re-establish regular check-ins. Send a proactive update covering all active work items.';
    default:
      return 'Review the flagged conversation and take appropriate action.';
  }
}

// ── Bottleneck Detection (ported from Ultron bottleneck-detector.ts) ─────────
// Scans PM tickets and conversation data for project delivery bottlenecks.

async function checkBottlenecks(
  orgId: string,
  alerts: Alert[],
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Repeated requests: tickets with same tags/keywords that keep appearing
  // 2. Overloaded members: agents with too many in-progress tickets
  // 3. Slow response: tickets in "in_progress" for too long
  // 4. Untracked features: conversation mentions with no tickets

  // Check overloaded agents
  const { data: inProgress } = await supabase
    .from('pm_tickets')
    .select('assigned_agent, title')
    .eq('org_id', orgId)
    .eq('status', 'in_progress');

  if (inProgress && inProgress.length > 0) {
    const agentLoad: Record<string, string[]> = {};
    for (const t of inProgress) {
      const agent = (t.assigned_agent as string) ?? 'unassigned';
      if (!agentLoad[agent]) agentLoad[agent] = [];
      agentLoad[agent].push(t.title as string);
    }

    for (const [agent, titles] of Object.entries(agentLoad)) {
      if (titles.length >= 5) {
        alerts.push({
          type: 'overloaded_member' as AlertType,
          severity: titles.length >= 8 ? 'warning' : 'info',
          title: `${agent} has ${titles.length} in-progress tickets`,
          message: `Agent "${agent}" is working on ${titles.length} items simultaneously: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ` (+${titles.length - 3} more)` : ''}. This may slow delivery.`,
          suggestedAction: 'Redistribute work across agents or prioritize the top 2-3 items to complete before taking on more.',
          sourceProvider: 'pm',
          metadata: { agent, count: titles.length, titles: titles.slice(0, 10) },
        });
      }
    }
  }

  // Check stale in-progress tickets (no update in 5+ days)
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400_000).toISOString();
  const { data: staleTickets } = await supabase
    .from('pm_tickets')
    .select('title, updated_at, assigned_agent')
    .eq('org_id', orgId)
    .eq('status', 'in_progress')
    .lt('updated_at', fiveDaysAgo)
    .limit(20);

  if (staleTickets && staleTickets.length >= 2) {
    const staleNames = staleTickets.map(t => t.title as string);
    alerts.push({
      type: 'slow_response' as AlertType,
      severity: staleTickets.length >= 5 ? 'warning' : 'info',
      title: `${staleTickets.length} tickets stale for 5+ days`,
      message: `These in-progress tickets haven't been updated in 5+ days: ${staleNames.slice(0, 4).join(', ')}${staleNames.length > 4 ? ` (+${staleNames.length - 4} more)` : ''}.`,
      suggestedAction: 'Check if these are blocked, forgotten, or should be moved back to backlog. Update status or reassign.',
      sourceProvider: 'pm',
      metadata: { count: staleTickets.length, tickets: staleNames.slice(0, 10) },
    });
  }

  // Check scope creep: rapid ticket creation in the last 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { count: recentTicketCount } = await supabase
    .from('pm_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', threeDaysAgo);

  if ((recentTicketCount ?? 0) >= 10) {
    alerts.push({
      type: 'scope_creep' as AlertType,
      severity: (recentTicketCount ?? 0) >= 20 ? 'warning' : 'info',
      title: `${recentTicketCount} new tickets created in the last 3 days`,
      message: `Rapid ticket creation may indicate scope creep or shifting priorities. Review whether timelines and resources need adjustment.`,
      suggestedAction: 'Hold a scope review meeting. Confirm which items are must-haves vs nice-to-haves and adjust sprint capacity.',
      sourceProvider: 'pm',
      metadata: { recentTicketCount },
    });
  }
}
