// ═══════════════════════════════════════════════════════════════
// Pivot — Salesforce Integration
// Fetches opportunities, accounts, contacts, and pipeline metrics
// Base: https://{instance}.salesforce.com/services/data/v59.0/
// Auth: OAuth2
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ─── Salesforce Types ────────────────────────────────────────────────────────

export interface SFOpportunity {
  id: string;
  name: string;
  amount: number;
  stage: string;
  closeDate: string;
  probability: number;
  accountName: string;
  accountId: string;
  ownerName: string;
  type: string | null;
  leadSource: string | null;
  createdDate: string;
  lastModifiedDate: string;
  isClosed: boolean;
  isWon: boolean;
}

export interface SFAccount {
  id: string;
  name: string;
  industry: string | null;
  annualRevenue: number | null;
  numberOfEmployees: number | null;
  type: string | null;
  rating: string | null;
  website: string | null;
  phone: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string | null;
  ownerName: string;
  createdDate: string;
}

export interface SFContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  accountName: string | null;
  accountId: string | null;
  leadSource: string | null;
  createdDate: string;
}

export interface SFPipelineMetrics {
  totalPipeline: number;
  weightedPipeline: number;
  winRate: number;
  avgDealSize: number;
  avgDealCycle: number; // days
  dealsByStage: Record<string, { count: number; value: number }>;
  forecastByMonth: Array<{ month: string; amount: number; weightedAmount: number }>;
  topDeals: Array<{ name: string; amount: number; stage: string; closeDate: string; probability: number }>;
  conversionRates: Record<string, number>; // stage -> % that move forward
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function sfFetch<T>(
  accessToken: string,
  instanceUrl: string,
  path: string,
): Promise<T> {
  const baseUrl = instanceUrl.replace(/\/$/, '');
  const url = `${baseUrl}/services/data/v59.0/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Salesforce API error ${res.status}: ${res.statusText} — ${body}`);
  }

  return res.json();
}

async function sfQuery<T>(
  accessToken: string,
  instanceUrl: string,
  soql: string,
): Promise<T[]> {
  const encoded = encodeURIComponent(soql);
  const result = await sfFetch<{
    totalSize: number;
    done: boolean;
    records: T[];
    nextRecordsUrl?: string;
  }>(accessToken, instanceUrl, `query?q=${encoded}`);

  let records = result.records;

  // Handle pagination for large result sets
  let nextUrl = result.nextRecordsUrl;
  while (nextUrl) {
    const baseUrl = instanceUrl.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}${nextUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) break;
    const page = await res.json();
    records = records.concat(page.records);
    nextUrl = page.nextRecordsUrl;
  }

  return records;
}

// ─── Fetch Functions ─────────────────────────────────────────────────────────

/**
 * Fetch open opportunities with account details.
 */
export async function fetchSFOpportunities(
  accessToken: string,
  instanceUrl: string,
): Promise<SFOpportunity[]> {
  const records = await sfQuery<any>(
    accessToken,
    instanceUrl,
    `SELECT Id, Name, Amount, StageName, CloseDate, Probability,
     Account.Name, Account.Id, Owner.Name, Type, LeadSource,
     CreatedDate, LastModifiedDate, IsClosed, IsWon
     FROM Opportunity
     WHERE IsClosed = false
     ORDER BY Amount DESC NULLS LAST
     LIMIT 500`,
  );

  return records.map((r) => ({
    id: r.Id,
    name: r.Name,
    amount: r.Amount || 0,
    stage: r.StageName,
    closeDate: r.CloseDate,
    probability: r.Probability || 0,
    accountName: r.Account?.Name || 'Unknown',
    accountId: r.Account?.Id || '',
    ownerName: r.Owner?.Name || 'Unknown',
    type: r.Type || null,
    leadSource: r.LeadSource || null,
    createdDate: r.CreatedDate,
    lastModifiedDate: r.LastModifiedDate,
    isClosed: r.IsClosed,
    isWon: r.IsWon,
  }));
}

/**
 * Fetch accounts with key business fields.
 */
export async function fetchSFAccounts(
  accessToken: string,
  instanceUrl: string,
): Promise<SFAccount[]> {
  const records = await sfQuery<any>(
    accessToken,
    instanceUrl,
    `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees,
     Type, Rating, Website, Phone,
     BillingCity, BillingState, BillingCountry,
     Owner.Name, CreatedDate
     FROM Account
     ORDER BY AnnualRevenue DESC NULLS LAST
     LIMIT 500`,
  );

  return records.map((r) => ({
    id: r.Id,
    name: r.Name,
    industry: r.Industry || null,
    annualRevenue: r.AnnualRevenue || null,
    numberOfEmployees: r.NumberOfEmployees || null,
    type: r.Type || null,
    rating: r.Rating || null,
    website: r.Website || null,
    phone: r.Phone || null,
    billingCity: r.BillingCity || null,
    billingState: r.BillingState || null,
    billingCountry: r.BillingCountry || null,
    ownerName: r.Owner?.Name || 'Unknown',
    createdDate: r.CreatedDate,
  }));
}

/**
 * Fetch contacts with account association.
 */
export async function fetchSFContacts(
  accessToken: string,
  instanceUrl: string,
): Promise<SFContact[]> {
  const records = await sfQuery<any>(
    accessToken,
    instanceUrl,
    `SELECT Id, Name, Email, Phone, Title, Department,
     Account.Name, Account.Id, LeadSource, CreatedDate
     FROM Contact
     ORDER BY CreatedDate DESC
     LIMIT 500`,
  );

  return records.map((r) => ({
    id: r.Id,
    name: r.Name,
    email: r.Email || null,
    phone: r.Phone || null,
    title: r.Title || null,
    department: r.Department || null,
    accountName: r.Account?.Name || null,
    accountId: r.Account?.Id || null,
    leadSource: r.LeadSource || null,
    createdDate: r.CreatedDate,
  }));
}

/**
 * Compute pipeline metrics from aggregate queries.
 * Uses both open and recently closed opportunities for win rate, cycle time, etc.
 */
export async function fetchSFPipelineMetrics(
  accessToken: string,
  instanceUrl: string,
): Promise<SFPipelineMetrics> {
  // Fetch open opps for pipeline
  const openOpps = await sfQuery<any>(
    accessToken,
    instanceUrl,
    `SELECT Id, Name, Amount, StageName, CloseDate, Probability, CreatedDate
     FROM Opportunity
     WHERE IsClosed = false
     ORDER BY Amount DESC NULLS LAST
     LIMIT 500`,
  );

  // Fetch recently closed opps for win rate / cycle time (last 12 months)
  const closedOpps = await sfQuery<any>(
    accessToken,
    instanceUrl,
    `SELECT Id, Amount, StageName, CloseDate, IsWon, CreatedDate
     FROM Opportunity
     WHERE IsClosed = true AND CloseDate >= LAST_N_DAYS:365
     LIMIT 500`,
  );

  // Total pipeline
  const totalPipeline = openOpps.reduce((sum: number, o: any) => sum + (o.Amount || 0), 0);
  const weightedPipeline = openOpps.reduce(
    (sum: number, o: any) => sum + (o.Amount || 0) * ((o.Probability || 0) / 100),
    0,
  );

  // Win rate
  const wonCount = closedOpps.filter((o: any) => o.IsWon).length;
  const winRate = closedOpps.length > 0 ? (wonCount / closedOpps.length) * 100 : 0;

  // Average deal size (from won deals)
  const wonDeals = closedOpps.filter((o: any) => o.IsWon && o.Amount > 0);
  const avgDealSize =
    wonDeals.length > 0
      ? wonDeals.reduce((sum: number, o: any) => sum + o.Amount, 0) / wonDeals.length
      : 0;

  // Average deal cycle (days from created to closed, won deals only)
  const cycleDays = wonDeals.map((o: any) => {
    const created = new Date(o.CreatedDate).getTime();
    const closed = new Date(o.CloseDate).getTime();
    return Math.max(0, (closed - created) / (1000 * 60 * 60 * 24));
  });
  const avgDealCycle =
    cycleDays.length > 0
      ? cycleDays.reduce((sum, d) => sum + d, 0) / cycleDays.length
      : 0;

  // Deals by stage
  const dealsByStage: Record<string, { count: number; value: number }> = {};
  for (const o of openOpps) {
    const stage = o.StageName || 'Unknown';
    if (!dealsByStage[stage]) dealsByStage[stage] = { count: 0, value: 0 };
    dealsByStage[stage].count++;
    dealsByStage[stage].value += o.Amount || 0;
  }

  // Forecast by month (next 6 months based on close dates)
  const forecastByMonth: Array<{ month: string; amount: number; weightedAmount: number }> = [];
  const monthBuckets: Record<string, { amount: number; weightedAmount: number }> = {};
  for (const o of openOpps) {
    if (!o.CloseDate) continue;
    const month = o.CloseDate.substring(0, 7); // YYYY-MM
    if (!monthBuckets[month]) monthBuckets[month] = { amount: 0, weightedAmount: 0 };
    monthBuckets[month].amount += o.Amount || 0;
    monthBuckets[month].weightedAmount += (o.Amount || 0) * ((o.Probability || 0) / 100);
  }
  for (const [month, data] of Object.entries(monthBuckets).sort()) {
    forecastByMonth.push({ month, ...data });
  }

  // Top deals
  const topDeals = openOpps
    .filter((o: any) => o.Amount > 0)
    .slice(0, 10)
    .map((o: any) => ({
      name: o.Name,
      amount: o.Amount,
      stage: o.StageName,
      closeDate: o.CloseDate,
      probability: o.Probability || 0,
    }));

  // Conversion rates by stage (from closed deals)
  const conversionRates: Record<string, number> = {};
  const stageOrder = Object.keys(dealsByStage);
  // Simple approximation: use win rate per stage based on current probability
  for (const stage of stageOrder) {
    const stageOpps = openOpps.filter((o: any) => o.StageName === stage);
    if (stageOpps.length > 0) {
      conversionRates[stage] =
        stageOpps.reduce((sum: number, o: any) => sum + (o.Probability || 0), 0) / stageOpps.length;
    }
  }

  return {
    totalPipeline,
    weightedPipeline,
    winRate,
    avgDealSize,
    avgDealCycle,
    dealsByStage,
    forecastByMonth,
    topDeals,
    conversionRates,
  };
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Orchestrates all Salesforce fetches, computes metrics, and saves to Supabase.
 */
export async function syncSalesforceToAnalytics(
  orgId: string,
  accessToken: string,
  instanceUrl: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;
  let insightsGenerated = 0;
  const supabase = createAdminClient();

  const [oppsResult, accountsResult, contactsResult, metricsResult] =
    await Promise.allSettled([
      fetchSFOpportunities(accessToken, instanceUrl),
      fetchSFAccounts(accessToken, instanceUrl),
      fetchSFContacts(accessToken, instanceUrl),
      fetchSFPipelineMetrics(accessToken, instanceUrl),
    ]);

  // Save opportunities
  if (oppsResult.status === 'fulfilled') {
    const opps = oppsResult.value;
    recordsProcessed += opps.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'salesforce',
      data_type: 'opportunities',
      data: { opportunities: opps, count: opps.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Opportunities save error: ${error.message}`);

    // Deal risk insights: deals closing soon with low probability
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const atRisk = opps.filter(
      (o) => new Date(o.closeDate) <= twoWeeks && o.probability < 50 && o.amount > 0,
    );
    if (atRisk.length > 0) {
      const totalAtRisk = atRisk.reduce((sum, o) => sum + o.amount, 0);
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'salesforce',
        insight_type: 'pipeline_risk',
        subject_name: 'At-Risk Deals',
        data: {
          atRiskCount: atRisk.length,
          atRiskValue: totalAtRisk,
          deals: atRisk.slice(0, 5).map((o) => ({
            name: o.name,
            amount: o.amount,
            probability: o.probability,
            closeDate: o.closeDate,
          })),
          message: `${atRisk.length} deals worth $${totalAtRisk.toLocaleString()} closing within 2 weeks with <50% probability`,
          severity: totalAtRisk > 100000 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Pipeline insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Opportunities fetch error: ${oppsResult.reason}`);
  }

  // Save accounts
  if (accountsResult.status === 'fulfilled') {
    const accounts = accountsResult.value;
    recordsProcessed += accounts.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'salesforce',
      data_type: 'accounts',
      data: { accounts, count: accounts.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Accounts save error: ${error.message}`);

    // Industry distribution insight
    const byIndustry: Record<string, number> = {};
    for (const a of accounts) {
      const ind = a.industry || 'Unknown';
      byIndustry[ind] = (byIndustry[ind] || 0) + 1;
    }
    const { error: insightError } = await supabase.from('integration_insights').insert({
      org_id: orgId,
      source: 'salesforce',
      insight_type: 'market_analysis',
      subject_name: 'Account Industry Distribution',
      data: {
        distribution: Object.entries(byIndustry)
          .sort((a, b) => b[1] - a[1])
          .map(([industry, count]) => ({ industry, count })),
        totalAccounts: accounts.length,
      },
      created_at: new Date().toISOString(),
    });
    if (insightError) errors.push(`Account insight error: ${insightError.message}`);
    insightsGenerated++;
  } else {
    errors.push(`Accounts fetch error: ${accountsResult.reason}`);
  }

  // Save contacts
  if (contactsResult.status === 'fulfilled') {
    const contacts = contactsResult.value;
    recordsProcessed += contacts.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'salesforce',
      data_type: 'contacts',
      data: { contacts, count: contacts.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Contacts save error: ${error.message}`);
  } else {
    errors.push(`Contacts fetch error: ${contactsResult.reason}`);
  }

  // Save pipeline metrics
  if (metricsResult.status === 'fulfilled') {
    const metrics = metricsResult.value;
    recordsProcessed += 1; // aggregate metric

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'salesforce',
      data_type: 'pipeline_metrics',
      data: metrics,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Metrics save error: ${error.message}`);

    // Pipeline health insight
    const insights: Record<string, unknown>[] = [];
    if (metrics.winRate < 20) {
      insights.push({
        org_id: orgId,
        source: 'salesforce',
        insight_type: 'pipeline_health',
        subject_name: 'Low Win Rate',
        data: {
          metric: 'winRate',
          value: metrics.winRate,
          message: `Win rate is ${metrics.winRate.toFixed(1)}%, significantly below typical benchmarks`,
          severity: 'critical',
        },
        created_at: new Date().toISOString(),
      });
    }
    if (metrics.avgDealCycle > 90) {
      insights.push({
        org_id: orgId,
        source: 'salesforce',
        insight_type: 'pipeline_health',
        subject_name: 'Long Sales Cycle',
        data: {
          metric: 'avgDealCycle',
          value: metrics.avgDealCycle,
          message: `Average deal cycle is ${Math.round(metrics.avgDealCycle)} days`,
          severity: 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }

    if (insights.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert(insights);
      if (insightError) errors.push(`Pipeline insight error: ${insightError.message}`);
      insightsGenerated += insights.length;
    }
  } else {
    errors.push(`Pipeline metrics error: ${metricsResult.reason}`);
  }

  const nextSync = new Date();
  nextSync.setMinutes(nextSync.getMinutes() + 30); // CRM data: sync every 30 min

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated,
    errors,
    nextSyncAt: nextSync.toISOString(),
  };
}
