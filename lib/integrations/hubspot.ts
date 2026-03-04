// ═══════════════════════════════════════════════════════════════
// Pivot — HubSpot Integration
// Fetches contacts, deals, companies, and engagement metrics
// Base: https://api.hubapi.com/crm/v3/
// Auth: OAuth2 or API key
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ─── HubSpot Types ───────────────────────────────────────────────────────────

export interface HSContact {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  lifecycleStage: string | null;
  leadStatus: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  createDate: string;
  lastModifiedDate: string;
}

export interface HSDeal {
  id: string;
  dealName: string;
  amount: number;
  dealStage: string;
  closeDate: string | null;
  pipeline: string;
  ownerName: string | null;
  associatedCompany: string | null;
  createDate: string;
  lastModifiedDate: string;
}

export interface HSCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  annualRevenue: number | null;
  numberOfEmployees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lifecycleStage: string | null;
  createDate: string;
}

export interface HSEngagementMetrics {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  meetingsBooked: number;
  callsMade: number;
  tasksCompleted: number;
  periodStart: string;
  periodEnd: string;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

const HS_CRM_BASE = 'https://api.hubapi.com/crm/v3';
const HS_ANALYTICS_BASE = 'https://api.hubapi.com';

async function hsFetch<T>(
  accessToken: string,
  url: string,
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HubSpot API error ${res.status}: ${res.statusText} — ${body}`);
  }

  return res.json();
}

interface HSPaginatedResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

async function hsFetchAll<T>(
  accessToken: string,
  baseUrl: string,
  limit = 100,
  maxPages = 5,
): Promise<T[]> {
  let allResults: T[] = [];
  let after: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = after
      ? `${baseUrl}${separator}limit=${limit}&after=${after}`
      : `${baseUrl}${separator}limit=${limit}`;

    const data = await hsFetch<HSPaginatedResponse<T>>(accessToken, url);
    allResults = allResults.concat(data.results);

    if (data.paging?.next?.after) {
      after = data.paging.next.after;
      page++;
    } else {
      break;
    }
  }

  return allResults;
}

// ─── Fetch Functions ─────────────────────────────────────────────────────────

/**
 * Fetch contacts with lifecycle and lead status properties.
 */
export async function fetchHSContacts(
  accessToken: string,
): Promise<HSContact[]> {
  const properties = [
    'email', 'firstname', 'lastname', 'company', 'lifecyclestage',
    'hs_lead_status', 'phone', 'city', 'state', 'createdate', 'lastmodifieddate',
  ].join(',');

  const records = await hsFetchAll<any>(
    accessToken,
    `${HS_CRM_BASE}/objects/contacts?properties=${properties}`,
  );

  return records.map((r) => ({
    id: r.id,
    email: r.properties?.email || null,
    firstName: r.properties?.firstname || null,
    lastName: r.properties?.lastname || null,
    company: r.properties?.company || null,
    lifecycleStage: r.properties?.lifecyclestage || null,
    leadStatus: r.properties?.hs_lead_status || null,
    phone: r.properties?.phone || null,
    city: r.properties?.city || null,
    state: r.properties?.state || null,
    createDate: r.properties?.createdate || r.createdAt,
    lastModifiedDate: r.properties?.lastmodifieddate || r.updatedAt,
  }));
}

/**
 * Fetch deals with pipeline and stage data.
 */
export async function fetchHSDeals(
  accessToken: string,
): Promise<HSDeal[]> {
  const properties = [
    'dealname', 'amount', 'dealstage', 'closedate', 'pipeline',
    'hubspot_owner_id', 'createdate', 'hs_lastmodifieddate',
  ].join(',');

  const records = await hsFetchAll<any>(
    accessToken,
    `${HS_CRM_BASE}/objects/deals?properties=${properties}`,
  );

  return records.map((r) => ({
    id: r.id,
    dealName: r.properties?.dealname || 'Untitled Deal',
    amount: parseFloat(r.properties?.amount) || 0,
    dealStage: r.properties?.dealstage || 'Unknown',
    closeDate: r.properties?.closedate || null,
    pipeline: r.properties?.pipeline || 'default',
    ownerName: null, // Owner ID needs separate lookup, set in sync if needed
    associatedCompany: null, // Set via associations API if needed
    createDate: r.properties?.createdate || r.createdAt,
    lastModifiedDate: r.properties?.hs_lastmodifieddate || r.updatedAt,
  }));
}

/**
 * Fetch companies with industry and revenue data.
 */
export async function fetchHSCompanies(
  accessToken: string,
): Promise<HSCompany[]> {
  const properties = [
    'name', 'domain', 'industry', 'annualrevenue', 'numberofemployees',
    'city', 'state', 'country', 'lifecyclestage', 'createdate',
  ].join(',');

  const records = await hsFetchAll<any>(
    accessToken,
    `${HS_CRM_BASE}/objects/companies?properties=${properties}`,
  );

  return records.map((r) => ({
    id: r.id,
    name: r.properties?.name || 'Unknown',
    domain: r.properties?.domain || null,
    industry: r.properties?.industry || null,
    annualRevenue: r.properties?.annualrevenue
      ? parseFloat(r.properties.annualrevenue)
      : null,
    numberOfEmployees: r.properties?.numberofemployees
      ? parseInt(r.properties.numberofemployees, 10)
      : null,
    city: r.properties?.city || null,
    state: r.properties?.state || null,
    country: r.properties?.country || null,
    lifecycleStage: r.properties?.lifecyclestage || null,
    createDate: r.properties?.createdate || r.createdAt,
  }));
}

/**
 * Fetch engagement metrics from HubSpot analytics.
 * Uses the email analytics and engagement event APIs.
 */
export async function fetchHSEngagement(
  accessToken: string,
): Promise<HSEngagementMetrics> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Fetch email campaign analytics
  let emailsSent = 0;
  let emailsOpened = 0;
  let emailsClicked = 0;
  let bounced = 0;
  let unsubscribed = 0;

  try {
    const emailStats = await hsFetch<any>(
      accessToken,
      `${HS_ANALYTICS_BASE}/marketing/v1/emails/with-statistics?limit=100`,
    );

    const emails = emailStats?.objects ?? [];
    for (const email of emails) {
      const stats = email.stats?.counters || {};
      emailsSent += stats.sent || 0;
      emailsOpened += stats.open || 0;
      emailsClicked += stats.click || 0;
      bounced += stats.bounce || 0;
      unsubscribed += stats.unsubscribed || 0;
    }
  } catch {
    // Marketing email API may not be available on all plans
  }

  // Fetch engagement events (meetings, calls, tasks)
  let meetingsBooked = 0;
  let callsMade = 0;
  let tasksCompleted = 0;

  try {
    // Meetings
    const meetings = await hsFetch<{ total: number }>(
      accessToken,
      `${HS_CRM_BASE}/objects/meetings?limit=1&properties=hs_createdate&filterGroups=[{"filters":[{"propertyName":"hs_createdate","operator":"GTE","value":"${startMs}"}]}]`,
    );
    meetingsBooked = meetings.total || 0;
  } catch {
    // Meetings object may not be accessible
  }

  try {
    // Calls
    const calls = await hsFetch<{ total: number }>(
      accessToken,
      `${HS_CRM_BASE}/objects/calls?limit=1&properties=hs_createdate&filterGroups=[{"filters":[{"propertyName":"hs_createdate","operator":"GTE","value":"${startMs}"}]}]`,
    );
    callsMade = calls.total || 0;
  } catch {
    // Calls object may not be accessible
  }

  try {
    // Tasks
    const tasks = await hsFetch<{ total: number }>(
      accessToken,
      `${HS_CRM_BASE}/objects/tasks?limit=1&properties=hs_task_status&filterGroups=[{"filters":[{"propertyName":"hs_task_status","operator":"EQ","value":"COMPLETED"},{"propertyName":"hs_createdate","operator":"GTE","value":"${startMs}"}]}]`,
    );
    tasksCompleted = tasks.total || 0;
  } catch {
    // Tasks object may not be accessible
  }

  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
  const clickRate = emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0;
  const bounceRate = emailsSent > 0 ? (bounced / emailsSent) * 100 : 0;
  const unsubscribeRate = emailsSent > 0 ? (unsubscribed / emailsSent) * 100 : 0;

  return {
    emailsSent,
    emailsOpened,
    emailsClicked,
    openRate,
    clickRate,
    bounceRate,
    unsubscribeRate,
    meetingsBooked,
    callsMade,
    tasksCompleted,
    periodStart: startDate.toISOString().split('T')[0],
    periodEnd: endDate.toISOString().split('T')[0],
  };
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Orchestrates all HubSpot fetches, computes metrics, and saves to Supabase.
 */
export async function syncHubSpotToAnalytics(
  orgId: string,
  accessToken: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;
  let insightsGenerated = 0;
  const supabase = createAdminClient();

  const [contactsResult, dealsResult, companiesResult, engagementResult] =
    await Promise.allSettled([
      fetchHSContacts(accessToken),
      fetchHSDeals(accessToken),
      fetchHSCompanies(accessToken),
      fetchHSEngagement(accessToken),
    ]);

  // Save contacts
  if (contactsResult.status === 'fulfilled') {
    const contacts = contactsResult.value;
    recordsProcessed += contacts.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'hubspot',
      data_type: 'contacts',
      data: { contacts, count: contacts.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Contacts save error: ${error.message}`);

    // Lifecycle stage distribution insight
    const byStage: Record<string, number> = {};
    for (const c of contacts) {
      const stage = c.lifecycleStage || 'unknown';
      byStage[stage] = (byStage[stage] || 0) + 1;
    }

    const { error: insightError } = await supabase.from('integration_insights').insert({
      org_id: orgId,
      source: 'hubspot',
      insight_type: 'contact_funnel',
      subject_name: 'Contact Lifecycle Distribution',
      data: {
        distribution: Object.entries(byStage)
          .sort((a, b) => b[1] - a[1])
          .map(([stage, count]) => ({ stage, count })),
        totalContacts: contacts.length,
      },
      created_at: new Date().toISOString(),
    });
    if (insightError) errors.push(`Contact insight error: ${insightError.message}`);
    insightsGenerated++;
  } else {
    errors.push(`Contacts fetch error: ${contactsResult.reason}`);
  }

  // Save deals
  if (dealsResult.status === 'fulfilled') {
    const deals = dealsResult.value;
    recordsProcessed += deals.length;

    // Compute deal metrics
    const totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
    const byStage: Record<string, { count: number; value: number }> = {};
    for (const d of deals) {
      if (!byStage[d.dealStage]) byStage[d.dealStage] = { count: 0, value: 0 };
      byStage[d.dealStage].count++;
      byStage[d.dealStage].value += d.amount;
    }

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'hubspot',
      data_type: 'deals',
      data: {
        deals,
        count: deals.length,
        totalValue,
        byStage,
      },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Deals save error: ${error.message}`);

    // Stale deals insight
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const staleDeals = deals.filter(
      (d) => new Date(d.lastModifiedDate) < thirtyDaysAgo && d.amount > 0,
    );
    if (staleDeals.length > 0) {
      const staleValue = staleDeals.reduce((sum, d) => sum + d.amount, 0);
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'hubspot',
        insight_type: 'deal_health',
        subject_name: 'Stale Deals Alert',
        data: {
          staleCount: staleDeals.length,
          staleValue,
          totalDeals: deals.length,
          deals: staleDeals.slice(0, 5).map((d) => ({
            name: d.dealName,
            amount: d.amount,
            stage: d.dealStage,
            lastModified: d.lastModifiedDate,
          })),
          message: `${staleDeals.length} deals worth $${staleValue.toLocaleString()} have not been updated in 30+ days`,
          severity: staleValue > 50000 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Deal insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Deals fetch error: ${dealsResult.reason}`);
  }

  // Save companies
  if (companiesResult.status === 'fulfilled') {
    const companies = companiesResult.value;
    recordsProcessed += companies.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'hubspot',
      data_type: 'companies',
      data: { companies, count: companies.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Companies save error: ${error.message}`);
  } else {
    errors.push(`Companies fetch error: ${companiesResult.reason}`);
  }

  // Save engagement metrics
  if (engagementResult.status === 'fulfilled') {
    const engagement = engagementResult.value;
    recordsProcessed += 1;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'hubspot',
      data_type: 'engagement',
      data: engagement,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Engagement save error: ${error.message}`);

    // Engagement health insights
    const insights: Record<string, unknown>[] = [];
    if (engagement.openRate < 15 && engagement.emailsSent > 100) {
      insights.push({
        org_id: orgId,
        source: 'hubspot',
        insight_type: 'engagement_health',
        subject_name: 'Low Email Open Rate',
        data: {
          metric: 'openRate',
          value: engagement.openRate,
          emailsSent: engagement.emailsSent,
          message: `Email open rate is ${engagement.openRate.toFixed(1)}%, below the 15% benchmark`,
          severity: engagement.openRate < 10 ? 'critical' : 'warning',
        },
        period_start: engagement.periodStart,
        period_end: engagement.periodEnd,
        created_at: new Date().toISOString(),
      });
    }
    if (engagement.bounceRate > 5 && engagement.emailsSent > 100) {
      insights.push({
        org_id: orgId,
        source: 'hubspot',
        insight_type: 'engagement_health',
        subject_name: 'High Email Bounce Rate',
        data: {
          metric: 'bounceRate',
          value: engagement.bounceRate,
          message: `Email bounce rate is ${engagement.bounceRate.toFixed(1)}%, indicating list quality issues`,
          severity: engagement.bounceRate > 10 ? 'critical' : 'warning',
        },
        period_start: engagement.periodStart,
        period_end: engagement.periodEnd,
        created_at: new Date().toISOString(),
      });
    }

    if (insights.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert(insights);
      if (insightError) errors.push(`Engagement insight error: ${insightError.message}`);
      insightsGenerated += insights.length;
    }
  } else {
    errors.push(`Engagement fetch error: ${engagementResult.reason}`);
  }

  const nextSync = new Date();
  nextSync.setMinutes(nextSync.getMinutes() + 30);

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated,
    errors,
    nextSyncAt: nextSync.toISOString(),
  };
}
