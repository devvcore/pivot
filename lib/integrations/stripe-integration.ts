// ═══════════════════════════════════════════════════════════════
// Pivot — Stripe Integration
// Fetches revenue, subscriptions, customers, and churn metrics
// Base: https://api.stripe.com/v1/
// Auth: Bearer token (API key, no OAuth needed)
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ─── Direct Environment Configuration ───────────────────────────────────────

const STRIPE_API_KEY = process.env.STRIPE_SECRET_KEY || "";

/**
 * Returns true if Stripe API key is configured in environment.
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ─── Stripe Types ────────────────────────────────────────────────────────────

export interface StripeRevenue {
  mrr: number;
  arr: number;
  totalRevenue: number;
  revenueGrowth: number; // percent month-over-month
  currentBalance: number;
  pendingBalance: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'paused';
  amount: number; // in dollars
  currency: string;
  interval: 'month' | 'year' | 'week' | 'day';
  intervalCount: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
  createdAt: string;
  productName: string | null;
}

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  currency: string | null;
  balance: number; // in dollars (negative = credit)
  totalSpent: number;
  subscriptionCount: number;
  activeSubscriptions: number;
  created: string;
  delinquent: boolean;
  metadata: Record<string, string>;
}

export interface StripeChurnMetrics {
  churnRate: number; // percent monthly
  mrrChurn: number; // dollar amount of MRR lost
  avgLifetime: number; // months
  retentionRate: number; // percent
  voluntaryChurn: number;
  involuntaryChurn: number; // payment failures
  atRiskSubscriptions: number;
  netRevenueRetention: number; // percent (includes expansion)
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

const STRIPE_BASE = 'https://api.stripe.com/v1';

async function stripeFetch<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${STRIPE_BASE}/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stripe API error ${res.status}: ${res.statusText} — ${body}`);
  }

  return res.json();
}

interface StripeList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  url: string;
}

async function stripeFetchAll<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string>,
  maxPages = 5,
): Promise<T[]> {
  let allItems: T[] = [];
  let startingAfter: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const queryParams: Record<string, string> = {
      limit: '100',
      ...params,
    };
    if (startingAfter) queryParams.starting_after = startingAfter;

    const result = await stripeFetch<StripeList<T>>(apiKey, path, queryParams);
    allItems = allItems.concat(result.data);

    if (result.has_more && result.data.length > 0) {
      startingAfter = (result.data[result.data.length - 1] as any).id;
      page++;
    } else {
      break;
    }
  }

  return allItems;
}

function centsToAmount(cents: number): number {
  return cents / 100;
}

function timestampToISO(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

// ─── Fetch Functions ─────────────────────────────────────────────────────────

/**
 * Fetch revenue metrics: MRR, ARR, total revenue, and growth.
 */
export async function fetchStripeRevenue(
  apiKey: string,
  options?: { daysBack?: number },
): Promise<StripeRevenue> {
  const daysBack = options?.daysBack ?? 30;
  const now = Math.floor(Date.now() / 1000);
  const periodStart = now - daysBack * 24 * 60 * 60;
  const prevPeriodStart = periodStart - daysBack * 24 * 60 * 60;

  // Fetch current balance
  const balance = await stripeFetch<{
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
  }>(apiKey, 'balance');

  const currentBalance = balance.available.reduce((sum, b) => sum + centsToAmount(b.amount), 0);
  const pendingBalance = balance.pending.reduce((sum, b) => sum + centsToAmount(b.amount), 0);
  const currency = balance.available[0]?.currency?.toUpperCase() || 'USD';

  // Fetch charges for current period
  const currentCharges = await stripeFetchAll<any>(apiKey, 'charges', {
    'created[gte]': periodStart.toString(),
    'created[lte]': now.toString(),
    status: 'succeeded',
  });

  // Fetch charges for previous period (for growth calc)
  const prevCharges = await stripeFetchAll<any>(apiKey, 'charges', {
    'created[gte]': prevPeriodStart.toString(),
    'created[lt]': periodStart.toString(),
    status: 'succeeded',
  });

  const currentRevenue = currentCharges.reduce(
    (sum: number, c: any) => sum + centsToAmount(c.amount - (c.amount_refunded || 0)),
    0,
  );
  const prevRevenue = prevCharges.reduce(
    (sum: number, c: any) => sum + centsToAmount(c.amount - (c.amount_refunded || 0)),
    0,
  );

  // Calculate MRR from active subscriptions
  const activeSubs = await stripeFetchAll<any>(apiKey, 'subscriptions', {
    status: 'active',
  });

  let mrr = 0;
  for (const sub of activeSubs) {
    for (const item of sub.items?.data ?? []) {
      const price = item.price;
      if (!price) continue;
      const amount = centsToAmount(price.unit_amount || 0) * (item.quantity || 1);

      if (price.recurring?.interval === 'month') {
        mrr += amount / (price.recurring.interval_count || 1);
      } else if (price.recurring?.interval === 'year') {
        mrr += amount / ((price.recurring.interval_count || 1) * 12);
      } else if (price.recurring?.interval === 'week') {
        mrr += (amount * 52) / ((price.recurring.interval_count || 1) * 12);
      } else if (price.recurring?.interval === 'day') {
        mrr += (amount * 365) / ((price.recurring.interval_count || 1) * 12);
      }
    }
  }

  const arr = mrr * 12;
  const revenueGrowth =
    prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  return {
    mrr,
    arr,
    totalRevenue: currentRevenue,
    revenueGrowth,
    currentBalance,
    pendingBalance,
    currency,
    periodStart: new Date(periodStart * 1000).toISOString().split('T')[0],
    periodEnd: new Date(now * 1000).toISOString().split('T')[0],
  };
}

/**
 * Fetch all subscriptions with customer details.
 */
export async function fetchStripeSubscriptions(
  apiKey: string,
): Promise<StripeSubscription[]> {
  const subs = await stripeFetchAll<any>(apiKey, 'subscriptions', {
    status: 'all',
    'expand[]': 'data.customer',
  });

  return subs.map((s: any) => {
    // Calculate total subscription amount from items
    let amount = 0;
    let interval: StripeSubscription['interval'] = 'month';
    let intervalCount = 1;
    let productName: string | null = null;

    for (const item of s.items?.data ?? []) {
      amount += centsToAmount((item.price?.unit_amount || 0) * (item.quantity || 1));
      interval = item.price?.recurring?.interval || 'month';
      intervalCount = item.price?.recurring?.interval_count || 1;
      productName = productName || item.price?.product?.name || null;
    }

    const customer = typeof s.customer === 'object' ? s.customer : null;

    return {
      id: s.id,
      customerId: customer?.id || s.customer,
      customerEmail: customer?.email || null,
      customerName: customer?.name || null,
      status: s.status,
      amount,
      currency: s.currency?.toUpperCase() || 'USD',
      interval,
      intervalCount,
      currentPeriodStart: timestampToISO(s.current_period_start),
      currentPeriodEnd: timestampToISO(s.current_period_end),
      cancelAtPeriodEnd: s.cancel_at_period_end || false,
      canceledAt: s.canceled_at ? timestampToISO(s.canceled_at) : null,
      trialEnd: s.trial_end ? timestampToISO(s.trial_end) : null,
      createdAt: timestampToISO(s.created),
      productName,
    };
  });
}

/**
 * Fetch customers with spending data.
 */
export async function fetchStripeCustomers(
  apiKey: string,
): Promise<StripeCustomer[]> {
  const customers = await stripeFetchAll<any>(apiKey, 'customers', {
    'expand[]': 'data.subscriptions',
  });

  return customers.map((c: any) => {
    const subs = c.subscriptions?.data ?? [];
    const activeSubs = subs.filter((s: any) => s.status === 'active');

    return {
      id: c.id,
      email: c.email || null,
      name: c.name || null,
      phone: c.phone || null,
      currency: c.currency?.toUpperCase() || null,
      balance: centsToAmount(c.balance || 0),
      totalSpent: 0, // Would need invoice API to compute accurately
      subscriptionCount: subs.length,
      activeSubscriptions: activeSubs.length,
      created: timestampToISO(c.created),
      delinquent: c.delinquent || false,
      metadata: c.metadata || {},
    };
  });
}

/**
 * Calculate churn metrics from subscription data.
 * Analyzes cancellations, payment failures, and retention patterns.
 */
export async function fetchStripeChurnMetrics(
  apiKey: string,
): Promise<StripeChurnMetrics> {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60;

  // Fetch all subs (active + recently canceled)
  const allSubs = await stripeFetchAll<any>(apiKey, 'subscriptions', {
    status: 'all',
    'created[gte]': (now - 365 * 24 * 60 * 60).toString(), // last year
  });

  const activeSubs = allSubs.filter((s: any) => s.status === 'active');
  const canceledRecently = allSubs.filter(
    (s: any) =>
      s.status === 'canceled' &&
      s.canceled_at &&
      s.canceled_at >= thirtyDaysAgo,
  );

  // MRR of canceled subscriptions
  let mrrChurn = 0;
  let voluntaryChurn = 0;
  let involuntaryChurn = 0;

  for (const sub of canceledRecently) {
    let subMrr = 0;
    for (const item of sub.items?.data ?? []) {
      const amount = centsToAmount((item.price?.unit_amount || 0) * (item.quantity || 1));
      const interval = item.price?.recurring?.interval;
      if (interval === 'month') subMrr += amount;
      else if (interval === 'year') subMrr += amount / 12;
    }
    mrrChurn += subMrr;

    // Determine if voluntary or involuntary
    if (sub.cancellation_details?.reason === 'payment_failed' ||
        sub.cancellation_details?.reason === 'payment_disputed') {
      involuntaryChurn++;
    } else {
      voluntaryChurn++;
    }
  }

  // Active sub count at start of period (active now + canceled recently)
  const startCount = activeSubs.length + canceledRecently.length;
  const churnRate = startCount > 0
    ? (canceledRecently.length / startCount) * 100
    : 0;
  const retentionRate = 100 - churnRate;

  // Average lifetime (from all canceled subs)
  const canceledWithDates = allSubs.filter(
    (s: any) => s.status === 'canceled' && s.created && s.canceled_at,
  );
  let avgLifetime = 0;
  if (canceledWithDates.length > 0) {
    const lifetimes = canceledWithDates.map((s: any) => {
      const months = (s.canceled_at - s.created) / (30 * 24 * 60 * 60);
      return Math.max(0, months);
    });
    avgLifetime = lifetimes.reduce((sum: number, m: number) => sum + m, 0) / lifetimes.length;
  }

  // At-risk subscriptions (past_due or cancel_at_period_end)
  const atRisk = allSubs.filter(
    (s: any) => s.status === 'past_due' || s.cancel_at_period_end,
  ).length;

  // Net revenue retention (MRR now vs MRR 30 days ago)
  // Approximate using active sub growth
  let currentMrr = 0;
  for (const sub of activeSubs) {
    for (const item of sub.items?.data ?? []) {
      const amount = centsToAmount((item.price?.unit_amount || 0) * (item.quantity || 1));
      const interval = item.price?.recurring?.interval;
      if (interval === 'month') currentMrr += amount;
      else if (interval === 'year') currentMrr += amount / 12;
    }
  }
  const baseMrr = currentMrr + mrrChurn; // what we had before churn
  const netRevenueRetention = baseMrr > 0 ? (currentMrr / baseMrr) * 100 : 100;

  return {
    churnRate,
    mrrChurn,
    avgLifetime,
    retentionRate,
    voluntaryChurn,
    involuntaryChurn,
    atRiskSubscriptions: atRisk,
    netRevenueRetention,
  };
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Orchestrates all Stripe fetches, computes metrics, and saves to Supabase.
 */
export async function syncStripeToAnalytics(
  orgId: string,
  apiKey: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;
  let insightsGenerated = 0;
  const supabase = createAdminClient();

  const [revenueResult, subsResult, customersResult, churnResult] =
    await Promise.allSettled([
      fetchStripeRevenue(apiKey, { daysBack: 30 }),
      fetchStripeSubscriptions(apiKey),
      fetchStripeCustomers(apiKey),
      fetchStripeChurnMetrics(apiKey),
    ]);

  // Save revenue metrics
  if (revenueResult.status === 'fulfilled') {
    const revenue = revenueResult.value;
    recordsProcessed += 1;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'stripe',
      data_type: 'revenue',
      data: revenue,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Revenue save error: ${error.message}`);

    // Revenue insights
    const insights: Record<string, unknown>[] = [];
    if (revenue.revenueGrowth < -10) {
      insights.push({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'revenue_health',
        subject_name: 'Revenue Decline',
        data: {
          metric: 'revenueGrowth',
          value: revenue.revenueGrowth,
          message: `Revenue declined ${Math.abs(revenue.revenueGrowth).toFixed(1)}% month-over-month`,
          severity: revenue.revenueGrowth < -20 ? 'critical' : 'warning',
        },
        period_start: revenue.periodStart,
        period_end: revenue.periodEnd,
        created_at: new Date().toISOString(),
      });
    }
    if (revenue.mrr > 0) {
      insights.push({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'revenue_metrics',
        subject_name: 'Recurring Revenue Summary',
        data: {
          mrr: revenue.mrr,
          arr: revenue.arr,
          totalRevenue: revenue.totalRevenue,
          growth: revenue.revenueGrowth,
          message: `MRR: $${revenue.mrr.toLocaleString()}, ARR: $${revenue.arr.toLocaleString()}`,
          severity: 'info',
        },
        period_start: revenue.periodStart,
        period_end: revenue.periodEnd,
        created_at: new Date().toISOString(),
      });
    }

    if (insights.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert(insights);
      if (insightError) errors.push(`Revenue insight error: ${insightError.message}`);
      insightsGenerated += insights.length;
    }
  } else {
    errors.push(`Revenue fetch error: ${revenueResult.reason}`);
  }

  // Save subscriptions
  if (subsResult.status === 'fulfilled') {
    const subs = subsResult.value;
    recordsProcessed += subs.length;

    // Aggregate subscription stats
    const byStatus: Record<string, number> = {};
    const byInterval: Record<string, number> = {};
    for (const s of subs) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byInterval[s.interval] = (byInterval[s.interval] || 0) + 1;
    }

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'stripe',
      data_type: 'subscriptions',
      data: {
        subscriptions: subs,
        count: subs.length,
        byStatus,
        byInterval,
      },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Subscriptions save error: ${error.message}`);

    // Trial expiration insight
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringTrials = subs.filter(
      (s) =>
        s.status === 'trialing' &&
        s.trialEnd &&
        new Date(s.trialEnd) <= sevenDaysOut,
    );
    if (expiringTrials.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'subscription_health',
        subject_name: 'Trials Expiring Soon',
        data: {
          count: expiringTrials.length,
          trials: expiringTrials.map((t) => ({
            customer: t.customerName || t.customerEmail,
            amount: t.amount,
            trialEnd: t.trialEnd,
          })),
          message: `${expiringTrials.length} trial subscriptions expiring within 7 days`,
          severity: 'info',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Trial insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Subscriptions fetch error: ${subsResult.reason}`);
  }

  // Save customers
  if (customersResult.status === 'fulfilled') {
    const customers = customersResult.value;
    recordsProcessed += customers.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'stripe',
      data_type: 'customers',
      data: { customers, count: customers.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Customers save error: ${error.message}`);

    // Delinquent customers insight
    const delinquent = customers.filter((c) => c.delinquent);
    if (delinquent.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'payment_health',
        subject_name: 'Delinquent Customers',
        data: {
          count: delinquent.length,
          totalCustomers: customers.length,
          delinquentRate: ((delinquent.length / customers.length) * 100).toFixed(1),
          customers: delinquent.slice(0, 10).map((c) => ({
            name: c.name || c.email,
            subscriptions: c.activeSubscriptions,
          })),
          message: `${delinquent.length} customers with failed payments`,
          severity: delinquent.length > 10 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Customer insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Customers fetch error: ${customersResult.reason}`);
  }

  // Save churn metrics
  if (churnResult.status === 'fulfilled') {
    const churn = churnResult.value;
    recordsProcessed += 1;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'stripe',
      data_type: 'churn_metrics',
      data: churn,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Churn save error: ${error.message}`);

    // Churn alerts
    const insights: Record<string, unknown>[] = [];
    if (churn.churnRate > 5) {
      insights.push({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'churn_alert',
        subject_name: 'Elevated Churn Rate',
        data: {
          churnRate: churn.churnRate,
          mrrChurn: churn.mrrChurn,
          retentionRate: churn.retentionRate,
          message: `Monthly churn rate is ${churn.churnRate.toFixed(1)}%, losing $${churn.mrrChurn.toLocaleString()} MRR`,
          severity: churn.churnRate > 10 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }
    if (churn.involuntaryChurn > churn.voluntaryChurn && churn.involuntaryChurn > 0) {
      insights.push({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'churn_alert',
        subject_name: 'Payment Failure Churn',
        data: {
          involuntary: churn.involuntaryChurn,
          voluntary: churn.voluntaryChurn,
          message: `Involuntary churn (${churn.involuntaryChurn}) exceeds voluntary (${churn.voluntaryChurn}) — consider payment retry strategies`,
          severity: 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }
    if (churn.atRiskSubscriptions > 0) {
      insights.push({
        org_id: orgId,
        source: 'stripe',
        insight_type: 'churn_risk',
        subject_name: 'At-Risk Subscriptions',
        data: {
          atRisk: churn.atRiskSubscriptions,
          message: `${churn.atRiskSubscriptions} subscriptions at risk (past due or scheduled to cancel)`,
          severity: churn.atRiskSubscriptions > 10 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }

    if (insights.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert(insights);
      if (insightError) errors.push(`Churn insight error: ${insightError.message}`);
      insightsGenerated += insights.length;
    }
  } else {
    errors.push(`Churn metrics error: ${churnResult.reason}`);
  }

  const nextSync = new Date();
  nextSync.setMinutes(nextSync.getMinutes() + 60); // Payment data: sync hourly

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated,
    errors,
    nextSyncAt: nextSync.toISOString(),
  };
}

// ─── Direct Sync (no OAuth, uses env var) ───────────────────────────────────

/**
 * Sync Stripe data using the API key from environment variables.
 * No OAuth required -- works immediately with STRIPE_SECRET_KEY in .env.
 */
export async function syncStripeDirectly(orgId: string): Promise<SyncResult> {
  if (!STRIPE_API_KEY) {
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: [
        "Stripe API key not configured. Set STRIPE_SECRET_KEY in .env",
      ],
    };
  }

  return syncStripeToAnalytics(orgId, STRIPE_API_KEY);
}

/**
 * Test Stripe connection by fetching the account balance.
 * Returns balance info if the key is valid.
 */
export async function testStripeConnection(): Promise<{
  connected: boolean;
  balance?: {
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
  };
  error?: string;
}> {
  if (!STRIPE_API_KEY) {
    return {
      connected: false,
      error: "Stripe API key not configured. Set STRIPE_SECRET_KEY in .env",
    };
  }

  try {
    const balance = await stripeFetch<{
      available: Array<{ amount: number; currency: string }>;
      pending: Array<{ amount: number; currency: string }>;
    }>(STRIPE_API_KEY, "balance");

    return {
      connected: true,
      balance: {
        available: balance.available.map((b) => ({
          amount: centsToAmount(b.amount),
          currency: b.currency.toUpperCase(),
        })),
        pending: balance.pending.map((b) => ({
          amount: centsToAmount(b.amount),
          currency: b.currency.toUpperCase(),
        })),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      error: msg,
    };
  }
}
