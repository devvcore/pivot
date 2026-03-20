/**
 * Proactive Monitor — Checks integration data for anomalies and important changes.
 *
 * Scans connected provider data (Stripe, QuickBooks, Jira, Gmail, Instagram, LinkedIn)
 * and returns actionable alerts when thresholds are breached.
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
  | 'social_engagement_drop';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  suggestedAction: string;
  sourceProvider: string;
  metadata?: Record<string, unknown>;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runProactiveCheck(orgId: string): Promise<Alert[]> {
  const supabase = createAdminClient();
  const alerts: Alert[] = [];

  // Load all integration data for this org
  const { data: rows } = await supabase
    .from('integration_data')
    .select('provider, record_type, data, synced_at')
    .eq('org_id', orgId)
    .order('synced_at', { ascending: false });

  if (!rows || rows.length === 0) return alerts;

  // Index records by provider + record_type for fast lookup
  const lookup = new Map<string, unknown>();
  for (const row of rows) {
    const key = `${row.provider}:${row.record_type}`;
    if (!lookup.has(key)) {
      lookup.set(key, typeof row.data === 'string' ? safeParseJson(row.data) : row.data);
    }
  }

  // Run all checkers in parallel
  const checkers = [
    checkStripeRevenue(lookup, alerts),
    checkStripeCustomers(lookup, alerts),
    checkQuickBooksExpenses(lookup, alerts),
    checkJiraOverdue(lookup, alerts),
    checkGmailImportant(lookup, alerts),
    checkSocialEngagement(lookup, alerts),
  ];
  await Promise.allSettled(checkers);

  return alerts;
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
