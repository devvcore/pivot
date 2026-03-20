// ═══════════════════════════════════════════════════════════════
// Pivot — Connector Registry
// Maps providers to sync functions, handles orchestration,
// and provides integration discovery/recommendations
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Integration,
  IntegrationProvider,
  ProviderCapability,
  SyncResult,
  IntegrationSyncLog,
} from './types';
import { PROVIDER_CAPABILITIES } from './types';

import { syncQuickBooksToAnalytics } from './quickbooks';
import { syncSalesforceToAnalytics } from './salesforce';
import { syncHubSpotToAnalytics } from './hubspot';
import { syncStripeToAnalytics } from './stripe-integration';
import { syncJiraToAnalytics } from './jira';
import { syncGitHubToAnalytics } from './github';
import {
  syncGoogleAnalytics,
  syncGoogleSheets,
  syncNotion,
  syncLinear,
  syncAsana,
  syncGoogleCalendar,
  syncMicrosoftTeams,
  syncAirtable,
} from './composio-sync';

// ─── Provider Environment Variables ──────────────────────────────────────────

const PROVIDER_ENV_KEYS: Record<IntegrationProvider, string[]> = {
  quickbooks: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
  salesforce: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
  hubspot: ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET'],
  stripe: ['STRIPE_SECRET_KEY'],
  jira: ['JIRA_CLIENT_ID', 'JIRA_CLIENT_SECRET'],
  slack: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
  gmail: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  adp: ['ADP_CLIENT_ID', 'ADP_CLIENT_SECRET'],
  workday: ['WORKDAY_CLIENT_ID', 'WORKDAY_CLIENT_SECRET'],
  github: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  google_analytics: ['COMPOSIO_AUTH_GOOGLE_ANALYTICS'],
  google_sheets: ['COMPOSIO_AUTH_GOOGLE_SHEETS'],
  notion: ['COMPOSIO_AUTH_NOTION'],
  linear: ['COMPOSIO_AUTH_LINEAR'],
  asana: ['COMPOSIO_AUTH_ASANA'],
  google_calendar: ['COMPOSIO_AUTH_GOOGLE_CALENDAR'],
  microsoft_teams: ['COMPOSIO_AUTH_MICROSOFT_TEAMS'],
  airtable: ['COMPOSIO_AUTH_AIRTABLE'],
  linkedin: ['COMPOSIO_AUTH_LINKEDIN'],
  twitter: ['COMPOSIO_AUTH_TWITTER'],
  instagram: ['COMPOSIO_AUTH_INSTAGRAM'],
  facebook: ['COMPOSIO_AUTH_FACEBOOK'],
  youtube: ['COMPOSIO_AUTH_YOUTUBE'],
  paypal: ['COMPOSIO_AUTH_PAYPAL'],
  square: ['COMPOSIO_AUTH_SQUARE'],
  xero: ['COMPOSIO_AUTH_XERO'],
  freshbooks: ['COMPOSIO_AUTH_FRESHBOOKS'],
  plaid: ['PLAID_CLIENT_ID', 'PLAID_SECRET'],
  mercury: ['COMPOSIO_AUTH_MERCURY'],
  wave: ['COMPOSIO_AUTH_WAVE'],
  brex: ['COMPOSIO_AUTH_BREX'],
  gusto: ['COMPOSIO_AUTH_GUSTO'],
};

// ─── Token Refresh ───────────────────────────────────────────────────────────

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

const TOKEN_ENDPOINTS: Partial<Record<IntegrationProvider, string>> = {
  quickbooks: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  salesforce: 'https://login.salesforce.com/services/oauth2/token',
  hubspot: 'https://api.hubapi.com/oauth/v1/token',
  jira: 'https://auth.atlassian.com/oauth/token',
  github: 'https://github.com/login/oauth/access_token',
};

const CLIENT_ENV: Partial<Record<IntegrationProvider, { id: string; secret: string }>> = {
  quickbooks: { id: 'QUICKBOOKS_CLIENT_ID', secret: 'QUICKBOOKS_CLIENT_SECRET' },
  salesforce: { id: 'SALESFORCE_CLIENT_ID', secret: 'SALESFORCE_CLIENT_SECRET' },
  hubspot: { id: 'HUBSPOT_CLIENT_ID', secret: 'HUBSPOT_CLIENT_SECRET' },
  jira: { id: 'JIRA_CLIENT_ID', secret: 'JIRA_CLIENT_SECRET' },
  github: { id: 'GITHUB_CLIENT_ID', secret: 'GITHUB_CLIENT_SECRET' },
};

async function refreshAccessToken(
  integration: Integration,
): Promise<{ accessToken: string; expiresAt: string } | null> {
  if (!integration.refreshToken) return null;

  const tokenUrl = TOKEN_ENDPOINTS[integration.provider];
  const clientEnv = CLIENT_ENV[integration.provider];
  if (!tokenUrl || !clientEnv) return null;

  const clientId = process.env[clientEnv.id];
  const clientSecret = process.env[clientEnv.secret];
  if (!clientId || !clientSecret) return null;

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error(`Token refresh failed for ${integration.provider}: ${res.status}`);
      return null;
    }

    let data: OAuthTokenResponse;
    try {
      data = await res.json();
    } catch {
      console.error(`Token refresh: invalid JSON response for ${integration.provider}`);
      return null;
    }
    const expiresAt = new Date(
      Date.now() + data.expires_in * 1000,
    ).toISOString();

    // Update stored tokens
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || integration.refreshToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);
    if (updateError) {
      console.error(`Token refresh: DB update failed for ${integration.provider}:`, updateError.message);
    }

    return { accessToken: data.access_token, expiresAt };
  } catch (err) {
    console.error(`Token refresh error for ${integration.provider}:`, err);
    return null;
  }
}

async function getValidAccessToken(integration: Integration): Promise<string> {
  // Stripe uses API keys, no refresh needed
  if (integration.provider === 'stripe') {
    if (!integration.accessToken) throw new Error('No Stripe API key configured');
    return integration.accessToken;
  }

  if (!integration.accessToken) {
    throw new Error(`No access token for ${integration.provider}`);
  }

  // Check if token is expired or expiring within 5 minutes
  if (integration.tokenExpiresAt) {
    const expiresAt = new Date(integration.tokenExpiresAt).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() + fiveMinutes >= expiresAt) {
      const refreshed = await refreshAccessToken(integration);
      if (refreshed) return refreshed.accessToken;
      // If refresh fails, try existing token anyway
    }
  }

  return integration.accessToken;
}

// ─── Sync Orchestration ─────────────────────────────────────────────────────

/**
 * Sync a single integration by dispatching to the appropriate connector.
 * Handles token refresh, logging, and error recovery.
 */
export async function syncIntegration(
  integration: Integration,
  orgId: string,
): Promise<SyncResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from('integration_sync_logs')
    .insert({
      integration_id: integration.id,
      org_id: orgId,
      status: 'running',
      records_processed: 0,
      insights_generated: 0,
      started_at: startedAt,
    })
    .select('id')
    .single();

  const syncLogId = syncLog?.id;

  // Update integration status to syncing
  await supabase
    .from('integrations')
    .update({ status: 'syncing', updated_at: startedAt })
    .eq('id', integration.id);

  try {
    const accessToken = await getValidAccessToken(integration);
    let result: SyncResult;

    switch (integration.provider) {
      case 'quickbooks': {
        const realmId = integration.metadata?.realmId;
        if (!realmId) throw new Error('QuickBooks realmId not found in integration metadata');
        result = await syncQuickBooksToAnalytics(orgId, accessToken, realmId);
        break;
      }

      case 'salesforce': {
        const instanceUrl = integration.metadata?.instanceUrl;
        if (!instanceUrl) throw new Error('Salesforce instanceUrl not found in integration metadata');
        result = await syncSalesforceToAnalytics(orgId, accessToken, instanceUrl);
        break;
      }

      case 'hubspot': {
        result = await syncHubSpotToAnalytics(orgId, accessToken);
        break;
      }

      case 'stripe': {
        result = await syncStripeToAnalytics(orgId, accessToken);
        break;
      }

      case 'jira': {
        const cloudId = integration.metadata?.cloudId;
        if (!cloudId) throw new Error('Jira cloudId not found in integration metadata');
        result = await syncJiraToAnalytics(orgId, accessToken, cloudId);
        break;
      }

      case 'github': {
        const githubOrg = integration.metadata?.githubOrg;
        result = await syncGitHubToAnalytics(orgId, accessToken, githubOrg);
        break;
      }

      // ── Composio-powered providers ──────────────────────────────────
      case 'google_analytics': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Google Analytics not connected via Composio');
        result = await syncGoogleAnalytics(orgId, connId);
        break;
      }

      case 'google_sheets': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Google Sheets not connected via Composio');
        result = await syncGoogleSheets(orgId, connId);
        break;
      }

      case 'notion': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Notion not connected via Composio');
        result = await syncNotion(orgId, connId);
        break;
      }

      case 'linear': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Linear not connected via Composio');
        result = await syncLinear(orgId, connId);
        break;
      }

      case 'asana': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Asana not connected via Composio');
        result = await syncAsana(orgId, connId);
        break;
      }

      case 'google_calendar': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Google Calendar not connected via Composio');
        result = await syncGoogleCalendar(orgId, connId);
        break;
      }

      case 'microsoft_teams': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Microsoft Teams not connected via Composio');
        result = await syncMicrosoftTeams(orgId, connId);
        break;
      }

      case 'airtable': {
        const connId = integration.composioConnectedAccountId;
        if (!connId) throw new Error('Airtable not connected via Composio');
        result = await syncAirtable(orgId, connId);
        break;
      }

      default:
        // For providers handled by other modules (slack, gmail, adp, workday),
        // return a pass-through result
        result = {
          success: false,
          recordsProcessed: 0,
          insightsGenerated: 0,
          errors: [`Connector for ${integration.provider} is handled by a different module`],
        };
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('integration_sync_logs')
        .update({
          status: result.success ? 'completed' : 'failed',
          records_processed: result.recordsProcessed,
          insights_generated: result.insightsGenerated,
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    // Update integration status and last sync
    await supabase
      .from('integrations')
      .update({
        status: result.success ? 'connected' : 'error',
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Update sync log with error
    if (syncLogId) {
      await supabase
        .from('integration_sync_logs')
        .update({
          status: 'failed',
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    // Update integration status to error
    await supabase
      .from('integrations')
      .update({
        status: 'error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: [errorMsg],
    };
  }
}

// ─── Available Connectors ────────────────────────────────────────────────────

export interface ConnectorStatus extends ProviderCapability {
  configured: boolean;
  missingEnvVars: string[];
}

/**
 * Return all PROVIDER_CAPABILITIES with their configuration status.
 * Checks whether the required environment variables are set.
 */
export function getAvailableConnectors(): ConnectorStatus[] {
  return PROVIDER_CAPABILITIES.map((cap) => {
    const envKeys = PROVIDER_ENV_KEYS[cap.provider] || [];
    const missingEnvVars = envKeys.filter((key) => !process.env[key]);

    return {
      ...cap,
      configured: missingEnvVars.length === 0,
      missingEnvVars,
    };
  });
}

// ─── Integration Recommendations ────────────────────────────────────────────

interface IntegrationRecommendation {
  provider: IntegrationProvider;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

// Industry to provider relevance mapping
const INDUSTRY_RELEVANCE: Record<string, Partial<Record<IntegrationProvider, { priority: 'high' | 'medium' | 'low'; reason: string }>>> = {
  technology: {
    jira: { priority: 'high', reason: 'Track engineering velocity and sprint health' },
    stripe: { priority: 'high', reason: 'Monitor SaaS revenue, MRR, and churn metrics' },
    github: { priority: 'high', reason: 'Code quality, PR reviews, and CI health' },
    linear: { priority: 'high', reason: 'Modern issue tracking with cycle time analytics' },
    google_analytics: { priority: 'high', reason: 'Track product usage and conversion funnels' },
    salesforce: { priority: 'medium', reason: 'Manage enterprise sales pipeline' },
    slack: { priority: 'medium', reason: 'Analyze team communication patterns' },
    hubspot: { priority: 'medium', reason: 'Track marketing and inbound lead generation' },
    notion: { priority: 'medium', reason: 'OKR tracking and knowledge base analytics' },
  },
  saas: {
    stripe: { priority: 'high', reason: 'Critical for MRR tracking, churn analysis, and revenue forecasting' },
    hubspot: { priority: 'high', reason: 'Track customer lifecycle from lead to expansion' },
    jira: { priority: 'high', reason: 'Monitor product development velocity' },
    google_analytics: { priority: 'high', reason: 'User behavior, funnels, and traffic attribution' },
    salesforce: { priority: 'medium', reason: 'Manage sales pipeline for enterprise deals' },
    slack: { priority: 'medium', reason: 'Measure team collaboration efficiency' },
    linear: { priority: 'medium', reason: 'Engineering velocity and issue cycle times' },
    google_sheets: { priority: 'medium', reason: 'Import/export data for custom reporting' },
  },
  ecommerce: {
    stripe: { priority: 'high', reason: 'Track transaction volume and payment health' },
    quickbooks: { priority: 'high', reason: 'Monitor P&L, inventory costs, and cash flow' },
    google_analytics: { priority: 'high', reason: 'Conversion funnels, traffic sources, and user behavior' },
    hubspot: { priority: 'medium', reason: 'Manage customer relationships and marketing campaigns' },
    airtable: { priority: 'medium', reason: 'Inventory tracking and order management' },
    salesforce: { priority: 'low', reason: 'Track B2B wholesale pipeline if applicable' },
  },
  finance: {
    quickbooks: { priority: 'high', reason: 'Real-time financial reporting and compliance tracking' },
    salesforce: { priority: 'high', reason: 'Track client relationships and AUM pipeline' },
    hubspot: { priority: 'medium', reason: 'Manage prospect nurturing and compliance communications' },
    slack: { priority: 'low', reason: 'Monitor internal communications for compliance' },
  },
  healthcare: {
    salesforce: { priority: 'high', reason: 'Track patient/provider relationships and referral pipeline' },
    quickbooks: { priority: 'high', reason: 'Monitor practice financials and billing cycles' },
    jira: { priority: 'medium', reason: 'Track IT projects and compliance implementations' },
    slack: { priority: 'low', reason: 'Team collaboration analysis' },
  },
  consulting: {
    quickbooks: { priority: 'high', reason: 'Track project billing, utilization, and profitability' },
    salesforce: { priority: 'high', reason: 'Manage engagement pipeline and client relationships' },
    hubspot: { priority: 'medium', reason: 'Track business development and marketing efforts' },
    jira: { priority: 'medium', reason: 'Monitor project delivery and team capacity' },
    slack: { priority: 'medium', reason: 'Analyze cross-team collaboration on engagements' },
  },
  retail: {
    quickbooks: { priority: 'high', reason: 'Track inventory, P&L, and cash flow' },
    stripe: { priority: 'high', reason: 'Monitor online payment volume and trends' },
    hubspot: { priority: 'medium', reason: 'Customer loyalty and marketing analytics' },
    salesforce: { priority: 'low', reason: 'Enterprise account management if applicable' },
  },
  manufacturing: {
    quickbooks: { priority: 'high', reason: 'Track cost of goods, margins, and supply chain expenses' },
    salesforce: { priority: 'high', reason: 'Manage distributor and B2B customer pipeline' },
    jira: { priority: 'medium', reason: 'Track engineering and product development' },
    hubspot: { priority: 'low', reason: 'Marketing to distributors and channel partners' },
  },
};

const TEAM_SIZE_PROVIDERS: Record<string, Partial<Record<IntegrationProvider, { priority: 'high' | 'medium' | 'low'; reason: string }>>> = {
  small: { // 1-10
    quickbooks: { priority: 'high', reason: 'Essential for small business financial visibility' },
    stripe: { priority: 'medium', reason: 'Track online payments and subscription revenue' },
    hubspot: { priority: 'medium', reason: 'Free CRM to manage contacts and deals' },
  },
  medium: { // 11-50
    slack: { priority: 'high', reason: 'Analyze communication patterns across growing teams' },
    jira: { priority: 'high', reason: 'Track development velocity as teams scale' },
    google_analytics: { priority: 'high', reason: 'Understand user behavior and growth metrics' },
    salesforce: { priority: 'medium', reason: 'Professionalize sales pipeline management' },
    quickbooks: { priority: 'medium', reason: 'Financial reporting for management' },
    asana: { priority: 'medium', reason: 'Track project delivery across multiple teams' },
    notion: { priority: 'medium', reason: 'Centralize team knowledge and OKRs' },
    google_calendar: { priority: 'low', reason: 'Meeting load analysis for growing teams' },
  },
  large: { // 50+
    salesforce: { priority: 'high', reason: 'Enterprise CRM for multi-team sales operations' },
    jira: { priority: 'high', reason: 'Monitor productivity across engineering teams' },
    slack: { priority: 'high', reason: 'Communication analytics across departments' },
    google_analytics: { priority: 'high', reason: 'Product analytics and marketing attribution' },
    workday: { priority: 'medium', reason: 'HR analytics and workforce planning' },
    adp: { priority: 'medium', reason: 'Payroll and workforce data integration' },
    microsoft_teams: { priority: 'medium', reason: 'Enterprise communication analytics' },
    google_calendar: { priority: 'medium', reason: 'Meeting culture and time allocation insights' },
    linear: { priority: 'medium', reason: 'Engineering team velocity tracking' },
  },
};

const BUSINESS_TYPE_PROVIDERS: Record<string, Partial<Record<IntegrationProvider, { priority: 'high' | 'medium' | 'low'; reason: string }>>> = {
  b2b: {
    salesforce: { priority: 'high', reason: 'Track enterprise deal pipeline and account health' },
    hubspot: { priority: 'medium', reason: 'Manage inbound marketing and lead nurturing' },
    quickbooks: { priority: 'medium', reason: 'Track invoicing and accounts receivable' },
  },
  b2c: {
    stripe: { priority: 'high', reason: 'Monitor consumer payment patterns and subscription health' },
    hubspot: { priority: 'high', reason: 'Track customer lifecycle and marketing performance' },
    quickbooks: { priority: 'medium', reason: 'Financial reporting and tax preparation' },
  },
  marketplace: {
    stripe: { priority: 'high', reason: 'Track marketplace transaction volume and take rates' },
    hubspot: { priority: 'medium', reason: 'Manage both supply and demand side relationships' },
    jira: { priority: 'medium', reason: 'Monitor platform development' },
  },
};

/**
 * Recommend integrations based on business context.
 * Uses rules-based logic to prioritize connectors by business type, industry, and team size.
 */
export async function discoverRecommendedIntegrations(
  businessType: string,
  industry: string,
  teamSize: number,
): Promise<IntegrationRecommendation[]> {
  const scores: Record<IntegrationProvider, { reasons: string[]; maxPriority: 'high' | 'medium' | 'low' }> = {} as any;

  const priorityOrder = { high: 3, medium: 2, low: 1 };

  function addRecommendation(
    provider: IntegrationProvider,
    priority: 'high' | 'medium' | 'low',
    reason: string,
  ) {
    if (!scores[provider]) {
      scores[provider] = { reasons: [], maxPriority: priority };
    }
    scores[provider].reasons.push(reason);
    if (priorityOrder[priority] > priorityOrder[scores[provider].maxPriority]) {
      scores[provider].maxPriority = priority;
    }
  }

  // Industry-based recommendations
  const normalizedIndustry = industry.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, providers] of Object.entries(INDUSTRY_RELEVANCE)) {
    if (normalizedIndustry.includes(key) || key.includes(normalizedIndustry)) {
      for (const [provider, config] of Object.entries(providers)) {
        if (config) addRecommendation(provider as IntegrationProvider, config.priority, config.reason);
      }
    }
  }

  // Team-size-based recommendations
  const sizeCategory = teamSize <= 10 ? 'small' : teamSize <= 50 ? 'medium' : 'large';
  const sizeProviders = TEAM_SIZE_PROVIDERS[sizeCategory] || {};
  for (const [provider, config] of Object.entries(sizeProviders)) {
    if (config) addRecommendation(provider as IntegrationProvider, config.priority, config.reason);
  }

  // Business-type-based recommendations
  const normalizedType = businessType.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, providers] of Object.entries(BUSINESS_TYPE_PROVIDERS)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      for (const [provider, config] of Object.entries(providers)) {
        if (config) addRecommendation(provider as IntegrationProvider, config.priority, config.reason);
      }
    }
  }

  // If no matches, provide universal defaults
  if (Object.keys(scores).length === 0) {
    addRecommendation('quickbooks', 'high', 'Financial visibility is foundational for any business');
    addRecommendation('hubspot', 'medium', 'CRM data helps track customer relationships and growth');
    addRecommendation('slack', 'medium', 'Communication analytics reveal team health and bottlenecks');
    if (teamSize > 5) {
      addRecommendation('jira', 'medium', 'Project management data improves delivery predictability');
    }
  }

  // Convert to sorted array
  const recommendations: IntegrationRecommendation[] = Object.entries(scores)
    .map(([provider, data]) => ({
      provider: provider as IntegrationProvider,
      reason: data.reasons[0], // Use the most relevant reason
      priority: data.maxPriority,
    }))
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

  return recommendations;
}

// ─── Bulk Sync ───────────────────────────────────────────────────────────────

/**
 * Sync all connected integrations for an organization.
 * Runs syncs in parallel where possible.
 */
export async function syncAllIntegrations(
  orgId: string,
): Promise<Record<IntegrationProvider, SyncResult>> {
  const supabase = createAdminClient();

  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'connected');

  if (error || !integrations) {
    console.error('Failed to fetch integrations:', error);
    return {} as Record<IntegrationProvider, SyncResult>;
  }

  const results: Record<string, SyncResult> = {};

  // Run all syncs in parallel
  const syncPromises = integrations.map(async (integration) => {
    const result = await syncIntegration(integration as Integration, orgId);
    results[integration.provider] = result;
  });

  await Promise.allSettled(syncPromises);

  return results as Record<IntegrationProvider, SyncResult>;
}

/**
 * Check which integrations need syncing based on their sync frequency.
 * Returns integrations that are overdue for a sync.
 */
export async function getIntegrationsDueForSync(
  orgId?: string,
): Promise<Integration[]> {
  const supabase = createAdminClient();
  const now = new Date();

  let query = supabase
    .from('integrations')
    .select('*')
    .eq('status', 'connected');

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data: integrations, error } = await query;

  if (error || !integrations) return [];

  return (integrations as Integration[]).filter((integration) => {
    if (!integration.lastSyncAt) return true; // Never synced

    const lastSync = new Date(integration.lastSyncAt).getTime();
    const intervalMs = integration.syncFrequencyMinutes * 60 * 1000;
    return now.getTime() >= lastSync + intervalMs;
  });
}
