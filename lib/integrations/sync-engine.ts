// ═══════════════════════════════════════════════════════════════
// Pivot — Sync Engine
// Central orchestrator for integration data synchronization.
// Handles: token refresh, data fetch, analysis, save, and logging.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '../supabase/admin';
import type {
  Integration,
  IntegrationProvider,
  SyncResult,
} from './types';
import {
  getIntegration,
  listIntegrations,
  updateIntegration,
  createSyncLog,
  updateSyncLog,
} from './store';

// ─── Connector Registry ──────────────────────────────────────────────────────
// Each connector has its own sync function with a different signature.
// This registry adapts them all to a uniform (integration: Integration) => SyncResult interface.
// We lazy-import to avoid pulling unused provider SDKs into every bundle.

type ConnectorSync = (integration: Integration) => Promise<SyncResult>;

async function getConnectorSync(provider: IntegrationProvider): Promise<ConnectorSync> {
  switch (provider) {
    // ─── Slack & Gmail export syncData(integration) directly ───────────────
    case 'slack': {
      const mod = await import('./slack');
      return mod.syncData;
    }
    case 'gmail': {
      const mod = await import('./gmail');
      return mod.syncData;
    }

    // ─── ADP: syncADPToAnalytics(orgId, accessToken) ──────────────────────
    case 'adp': {
      const mod = await import('./adp');
      return (integration: Integration) =>
        mod.syncADPToAnalytics(integration.orgId, integration.accessToken!);
    }

    // ─── Workday: syncWorkdayToAnalytics(orgId, accessToken, tenant) ──────
    case 'workday': {
      const mod = await import('./workday');
      return (integration: Integration) =>
        mod.syncWorkdayToAnalytics(
          integration.orgId,
          integration.accessToken!,
          integration.metadata?.tenant ?? 'default'
        );
    }

    // ─── QuickBooks: syncQuickBooksToAnalytics(orgId, accessToken, realmId)
    case 'quickbooks': {
      const mod = await import('./quickbooks');
      return (integration: Integration) =>
        mod.syncQuickBooksToAnalytics(
          integration.orgId,
          integration.accessToken!,
          integration.metadata?.realmId ?? ''
        );
    }

    // ─── Salesforce: syncSalesforceToAnalytics(orgId, accessToken, instanceUrl)
    case 'salesforce': {
      const mod = await import('./salesforce');
      return (integration: Integration) =>
        mod.syncSalesforceToAnalytics(
          integration.orgId,
          integration.accessToken!,
          integration.metadata?.instanceUrl ?? ''
        );
    }

    // ─── HubSpot: syncHubSpotToAnalytics(orgId, accessToken) ─────────────
    case 'hubspot': {
      const mod = await import('./hubspot');
      return (integration: Integration) =>
        mod.syncHubSpotToAnalytics(integration.orgId, integration.accessToken!);
    }

    // ─── Stripe: syncStripeToAnalytics(orgId, apiKey) ────────────────────
    case 'stripe': {
      const mod = await import('./stripe-integration');
      return (integration: Integration) =>
        mod.syncStripeToAnalytics(integration.orgId, integration.accessToken!);
    }

    // ─── Jira: may export syncData or syncJiraToAnalytics ────────────────
    case 'jira': {
      try {
        const mod = await import('./jira');
        // Prefer syncData(integration) if available, else adapt
        if (typeof (mod as any).syncData === 'function') {
          return (mod as any).syncData;
        }
        if (typeof mod.syncJiraToAnalytics === 'function') {
          return (integration: Integration) =>
            mod.syncJiraToAnalytics(
              integration.orgId,
              integration.accessToken!,
              integration.metadata?.cloudId ?? ''
            );
        }
        throw new Error('Jira connector does not export a sync function');
      } catch (err) {
        // Jira connector may not be built yet
        return async () => ({
          success: false,
          recordsProcessed: 0,
          insightsGenerated: 0,
          errors: ['Jira connector not yet available'],
        });
      }
    }

    default:
      throw new Error(`No connector found for provider: ${provider}`);
  }
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

async function refreshTokenIfNeeded(integration: Integration): Promise<Integration> {
  if (!integration.tokenExpiresAt) return integration;

  const expiresAt = new Date(integration.tokenExpiresAt).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry

  if (expiresAt - now > bufferMs) {
    return integration; // token is still valid
  }

  if (!integration.refreshToken) {
    console.warn(
      `[sync-engine] Token expired for ${integration.provider} (${integration.id}) but no refresh token available`
    );
    return integration;
  }

  try {
    const { refreshAccessToken } = await import('./oauth');
    const refreshed = await refreshAccessToken(
      integration.provider,
      integration.refreshToken
    );

    // Calculate new expiry and update in DB
    const tokenExpiresAt = refreshed.expiresIn
      ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
      : null;

    const updated = await updateIntegration(integration.id, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? integration.refreshToken,
      tokenExpiresAt,
    });

    return updated;
  } catch (err) {
    console.error(
      `[sync-engine] Failed to refresh token for ${integration.provider} (${integration.id}):`,
      err
    );
    await updateIntegration(integration.id, { status: 'error' });
    throw new Error(
      `Token refresh failed for ${integration.provider}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const RATE_LIMIT_DELAY_MS: Partial<Record<IntegrationProvider, number>> = {
  slack: 1200,      // Slack Tier 3: ~50 req/min
  gmail: 500,       // Google: 250 quota units / sec
  salesforce: 200,  // Salesforce: generous limits
  hubspot: 150,     // HubSpot: 100 req / 10 sec
  quickbooks: 500,  // QuickBooks: 500 req / min
  jira: 200,        // Jira: 100 req / min (generous)
  stripe: 100,      // Stripe: 100 req / sec
  adp: 1000,        // ADP: conservative
  workday: 1000,    // Workday: conservative
};

async function rateLimitDelay(provider: IntegrationProvider): Promise<void> {
  const delay = RATE_LIMIT_DELAY_MS[provider] ?? 500;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Run a sync for a specific integration.
 * Handles: token refresh -> data fetch -> analysis -> save -> log
 */
export async function runSync(integrationId: string): Promise<SyncResult> {
  let integration = await getIntegration(integrationId);
  if (!integration) {
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: [`Integration not found: ${integrationId}`],
    };
  }

  // Create sync log entry
  const syncLog = await createSyncLog({
    integrationId: integration.id,
    orgId: integration.orgId,
    status: 'running',
  });

  // Mark integration as syncing
  await updateIntegration(integration.id, { status: 'syncing' });

  try {
    // 1. Refresh token if needed
    integration = await refreshTokenIfNeeded(integration);

    // 2. Rate limit delay before hitting external API
    await rateLimitDelay(integration.provider);

    // 3. Get the connector and run sync
    const connectorSync = await getConnectorSync(integration.provider);
    const result = await connectorSync(integration);

    // 4. Update integration status
    const nextSyncAt = result.nextSyncAt
      ? result.nextSyncAt
      : new Date(
          Date.now() + integration.syncFrequencyMinutes * 60 * 1000
        ).toISOString();

    await updateIntegration(integration.id, {
      status: result.success ? 'connected' : 'error',
      lastSyncAt: new Date().toISOString(),
      metadata: {
        ...integration.metadata,
        nextSyncAt,
        lastSyncRecords: result.recordsProcessed,
        lastSyncInsights: result.insightsGenerated,
      },
    });

    // 5. Update sync log
    await updateSyncLog(syncLog.id, {
      status: result.success ? 'completed' : 'failed',
      recordsProcessed: result.recordsProcessed,
      insightsGenerated: result.insightsGenerated,
      errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      completedAt: new Date().toISOString(),
    });

    return { ...result, nextSyncAt };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    // Update integration status to error
    await updateIntegration(integration.id, { status: 'error' });

    // Update sync log with failure
    await updateSyncLog(syncLog.id, {
      status: 'failed',
      recordsProcessed: 0,
      insightsGenerated: 0,
      errorMessage,
      completedAt: new Date().toISOString(),
    });

    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: [errorMessage],
    };
  }
}

/**
 * Run syncs for ALL connected integrations for an org.
 * Uses Promise.allSettled to run in parallel without one failure killing others.
 */
export async function runOrgSync(
  orgId: string
): Promise<Record<string, SyncResult>> {
  const integrations = await listIntegrations(orgId);
  const connected = integrations.filter(
    (i) => i.status === 'connected' || i.status === 'error'
  );

  if (connected.length === 0) {
    return {};
  }

  const results = await Promise.allSettled(
    connected.map((integration) => runSync(integration.id))
  );

  const resultMap: Record<string, SyncResult> = {};

  connected.forEach((integration, index) => {
    const outcome = results[index];
    if (outcome.status === 'fulfilled') {
      resultMap[integration.provider] = outcome.value;
    } else {
      resultMap[integration.provider] = {
        success: false,
        recordsProcessed: 0,
        insightsGenerated: 0,
        errors: [
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
        ],
      };
    }
  });

  return resultMap;
}

/**
 * Check which integrations need syncing based on syncFrequencyMinutes + lastSyncAt.
 * Called by cron/scheduled function to find stale integrations.
 */
export async function getStaleIntegrations(): Promise<Integration[]> {
  const supabase = createAdminClient();

  // Get all connected integrations
  const { data: rows, error } = await supabase
    .from('integrations')
    .select()
    .in('status', ['connected', 'error']);

  if (error) {
    console.error('[sync-engine] Failed to query stale integrations:', error);
    return [];
  }

  if (!rows || rows.length === 0) return [];

  const now = Date.now();

  return rows
    .map((row: any) => ({
      id: row.id,
      orgId: row.org_id,
      provider: row.provider as IntegrationProvider,
      status: row.status,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
      scopes: row.scopes ?? [],
      metadata: row.metadata ?? {},
      lastSyncAt: row.last_sync_at,
      syncFrequencyMinutes: row.sync_frequency_minutes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    .filter((integration: Integration) => {
      if (!integration.lastSyncAt) return true; // never synced

      const lastSync = new Date(integration.lastSyncAt).getTime();
      const intervalMs = integration.syncFrequencyMinutes * 60 * 1000;
      return now - lastSync >= intervalMs;
    });
}

/**
 * Run syncs for all stale integrations across all orgs.
 * This is the main entry point for background/cron sync.
 */
export async function runScheduledSync(): Promise<{
  synced: number;
  errors: number;
}> {
  const stale = await getStaleIntegrations();

  if (stale.length === 0) {
    console.log('[sync-engine] No stale integrations to sync');
    return { synced: 0, errors: 0 };
  }

  console.log(
    `[sync-engine] Found ${stale.length} stale integration(s) to sync`
  );

  // Run all stale syncs in parallel (with allSettled for resilience)
  const results = await Promise.allSettled(
    stale.map((integration) => runSync(integration.id))
  );

  let synced = 0;
  let errors = 0;

  results.forEach((outcome, index) => {
    const integration = stale[index];
    if (outcome.status === 'fulfilled' && outcome.value.success) {
      synced++;
      console.log(
        `[sync-engine] Synced ${integration.provider} for org ${integration.orgId}: ${outcome.value.recordsProcessed} records`
      );
    } else {
      errors++;
      const errorMsg =
        outcome.status === 'rejected'
          ? outcome.reason?.message ?? String(outcome.reason)
          : outcome.value.errors.join('; ');
      console.error(
        `[sync-engine] Failed to sync ${integration.provider} for org ${integration.orgId}: ${errorMsg}`
      );
    }
  });

  console.log(
    `[sync-engine] Scheduled sync complete: ${synced} synced, ${errors} errors`
  );

  return { synced, errors };
}

/**
 * After syncing integration data, feed it into the analytics pipeline.
 * Updates the job's deliverables with fresh integration data.
 */
export async function feedIntoAnalytics(
  orgId: string,
  jobId: string,
  syncResults: Record<string, SyncResult>
): Promise<void> {
  const supabase = createAdminClient();

  try {
    // 1. Get the latest job deliverables
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('deliverables, questionnaire')
      .eq('run_id', jobId)
      .eq('org_id', orgId)
      .single();

    if (jobError || !job) {
      console.error(
        `[sync-engine] Could not find job ${jobId} for org ${orgId}:`,
        jobError
      );
      return;
    }

    const deliverables = job.deliverables ?? {};
    const integrationSummary: Record<string, any> = {};

    // 2. Merge new integration data into relevant sections
    for (const [provider, result] of Object.entries(syncResults)) {
      if (!result.success) continue;

      integrationSummary[provider] = {
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: result.recordsProcessed,
        insightsGenerated: result.insightsGenerated,
      };
    }

    // 3. Enrich deliverables with integration data summaries
    const enrichedDeliverables = {
      ...deliverables,
      integrationData: {
        ...(deliverables.integrationData ?? {}),
        lastUpdated: new Date().toISOString(),
        providers: integrationSummary,
      },
    };

    // 4. Fetch communication insights for this org to include
    if (syncResults.slack || syncResults.gmail) {
      const { data: insights } = await supabase
        .from('communication_insights')
        .select()
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (insights && insights.length > 0) {
        enrichedDeliverables.integrationData.communicationInsights = {
          count: insights.length,
          types: [...new Set(insights.map((i: any) => i.insight_type))],
          latestAt: insights[0].created_at,
        };
      }
    }

    // 5. Fetch HR data summaries for this org
    if (syncResults.adp || syncResults.workday) {
      const { data: employees } = await supabase
        .from('hr_employee_data')
        .select('department, employment_status, job_title')
        .eq('org_id', orgId);

      if (employees && employees.length > 0) {
        const departments = [
          ...new Set(employees.map((e: any) => e.department).filter(Boolean)),
        ];
        const statuses = employees.reduce(
          (acc: Record<string, number>, e: any) => {
            const status = e.employment_status ?? 'unknown';
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
          },
          {}
        );

        enrichedDeliverables.integrationData.hrSummary = {
          totalEmployees: employees.length,
          departments,
          statusBreakdown: statuses,
        };
      }
    }

    // 6. Update job deliverables
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        deliverables: enrichedDeliverables,
        updated_at: new Date().toISOString(),
      })
      .eq('run_id', jobId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error(
        `[sync-engine] Failed to update job deliverables for ${jobId}:`,
        updateError
      );
    } else {
      console.log(
        `[sync-engine] Fed integration data into job ${jobId} analytics`
      );
    }
  } catch (err) {
    console.error(
      `[sync-engine] feedIntoAnalytics error for job ${jobId}:`,
      err
    );
  }
}
