// ═══════════════════════════════════════════════════════════════
// Pivot — Composio Integration Wrapper
// Central module for all Composio SDK interactions.
// Manages OAuth connections, proxy API calls, and account lifecycle.
// ═══════════════════════════════════════════════════════════════

import { Composio } from '@composio/core';
import type { IntegrationProvider } from './types';

// ─── Singleton Instance ──────────────────────────────────────────────────────

let _composio: Composio | null = null;
export function getComposio(): Composio {
  if (!_composio) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) throw new Error('COMPOSIO_API_KEY is not configured');
    _composio = new Composio({ apiKey });
  }
  return _composio;
}

// ─── Auth Config Mapping ─────────────────────────────────────────────────────
// Map providers to Composio auth config env vars.
// Users set these after creating auth configs in the Composio dashboard.

// Build auth config map dynamically — only include providers with actual config IDs
function buildAuthConfigs(): Partial<Record<IntegrationProvider, string>> {
  const map: Partial<Record<IntegrationProvider, string>> = {};
  const entries: [IntegrationProvider, string | undefined][] = [
    ['slack', process.env.COMPOSIO_AUTH_SLACK],
    ['gmail', process.env.COMPOSIO_AUTH_GMAIL],
    ['github', process.env.COMPOSIO_AUTH_GITHUB],
    ['jira', process.env.COMPOSIO_AUTH_JIRA],
    ['hubspot', process.env.COMPOSIO_AUTH_HUBSPOT],
    ['quickbooks', process.env.COMPOSIO_AUTH_QUICKBOOKS],
    ['salesforce', process.env.COMPOSIO_AUTH_SALESFORCE],
    ['stripe', process.env.COMPOSIO_AUTH_STRIPE],
    ['workday', process.env.COMPOSIO_AUTH_WORKDAY],
    ['google_analytics', process.env.COMPOSIO_AUTH_GOOGLE_ANALYTICS],
    ['google_sheets', process.env.COMPOSIO_AUTH_GOOGLE_SHEETS],
    ['notion', process.env.COMPOSIO_AUTH_NOTION],
    ['linear', process.env.COMPOSIO_AUTH_LINEAR],
    ['asana', process.env.COMPOSIO_AUTH_ASANA],
    ['google_calendar', process.env.COMPOSIO_AUTH_GOOGLE_CALENDAR],
    ['microsoft_teams', process.env.COMPOSIO_AUTH_MICROSOFT_TEAMS],
    ['airtable', process.env.COMPOSIO_AUTH_AIRTABLE],
    ['linkedin', process.env.COMPOSIO_AUTH_LINKEDIN],
    ['twitter', process.env.COMPOSIO_AUTH_TWITTER],
    ['instagram', process.env.COMPOSIO_AUTH_INSTAGRAM],
    ['facebook', process.env.COMPOSIO_AUTH_FACEBOOK],
    ['youtube', process.env.COMPOSIO_AUTH_YOUTUBE],
  ];
  for (const [provider, val] of entries) {
    if (val) map[provider] = val; // only include if env var is set
  }
  return map;
}

export const COMPOSIO_AUTH_CONFIGS = buildAuthConfigs();

// ─── Provider Check ──────────────────────────────────────────────────────────

/** Check if a provider can use Composio (all except ADP) */
export function isComposioProvider(provider: IntegrationProvider): boolean {
  return provider !== 'adp';
}

// ─── OAuth Connection Lifecycle ──────────────────────────────────────────────

// Map provider names to Composio toolkit slugs
const TOOLKIT_SLUGS: Partial<Record<IntegrationProvider, string>> = {
  google_analytics: 'googleanalytics',
  google_sheets: 'googlesheets',
  google_calendar: 'googlecalendar',
  microsoft_teams: 'microsoftteams',
};

/** Fetch a Composio-managed default auth config for a toolkit via REST API */
async function findDefaultAuthConfig(provider: IntegrationProvider): Promise<string | null> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return null;
  const slug = TOOLKIT_SLUGS[provider] ?? provider;
  try {
    const res = await fetch(
      `https://backend.composio.dev/api/v3/auth_configs?toolkit_slug=${encodeURIComponent(slug)}&is_composio_managed=true&limit=1`,
      { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.items ?? data?.data ?? [];
    if (items.length > 0 && items[0].id) {
      console.log(`[composio] Found Composio-managed auth config for ${provider}: ${items[0].id}`);
      return items[0].id;
    }
  } catch (e) {
    console.warn(`[composio] Could not find default auth config for ${provider}:`, e);
  }
  return null;
}

/** Initiate OAuth connection via Composio */
export async function initiateConnection(
  provider: IntegrationProvider,
  orgId: string,
  callbackUrl: string,
): Promise<{ redirectUrl: string; connectionRequestId: string }> {
  const composio = getComposio();
  let authConfigId = COMPOSIO_AUTH_CONFIGS[provider];

  // Fallback: find a Composio-managed default auth config
  if (!authConfigId) {
    authConfigId = await findDefaultAuthConfig(provider) ?? undefined;
  }

  if (!authConfigId) {
    throw new Error(`No Composio auth config for ${provider}. Create one in the Composio dashboard or set COMPOSIO_AUTH_${provider.toUpperCase()}.`);
  }

  const result = await composio.connectedAccounts.initiate(
    orgId, // use orgId as the Composio userId
    authConfigId,
    { callbackUrl, allowMultiple: true },
  );
  return {
    redirectUrl: result.redirectUrl ?? '',
    connectionRequestId: (result as any).id ?? '',
  };
}

/** Convert UUID to nanoid if needed (Composio v3 rejects UUIDs) */
async function toNanoId(id: string): Promise<string> {
  // Already a nanoid (ca_ prefix)
  if (id.startsWith('ca_')) return id;
  // UUID format — call migration endpoint
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return id;
  try {
    const res = await fetch(
      `https://backend.composio.dev/api/v3/migration/get-nanoid?uuid=${encodeURIComponent(id)}&type=CONNECTED_ACCOUNT`,
      { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.nanoid) return data.nanoid;
    }
  } catch (e) {
    console.warn('[composio] UUID→nanoid migration failed:', e);
  }
  return id;
}

/** Verify a connection is active — handles UUID→nanoid conversion */
export async function verifyConnection(connectedAccountId: string) {
  const composio = getComposio();
  const nanoId = await toNanoId(connectedAccountId);
  return composio.connectedAccounts.get(nanoId);
}

/** Delete a connected account */
export async function deleteConnection(connectedAccountId: string) {
  const composio = getComposio();
  return composio.connectedAccounts.delete(connectedAccountId);
}

// ─── Proxy Fetch ─────────────────────────────────────────────────────────────
// Replaces all provider-specific fetch helpers.
// Makes API calls using the user's stored Composio credentials.

export async function composioProxyFetch<T = any>(
  connectedAccountId: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  parameters?: Array<{ name: string; value: string | number; in: 'header' | 'query' }>,
  body?: unknown,
): Promise<T | null> {
  try {
    const composio = getComposio();
    const result = await (composio.tools as any).proxyExecute({
      endpoint,
      method,
      connectedAccountId,
      parameters: parameters ?? [],
      body,
    });
    return (result as any)?.data as T ?? null;
  } catch (err) {
    console.error(`[composio] Proxy fetch error for ${endpoint}:`, err);
    return null;
  }
}

// ─── Generic Action Execution ─────────────────────────────────────────────────

/**
 * Execute a generic Composio action for any provider.
 * Used by financial provider pull functions in collect.ts.
 */
export async function executeComposioAction(
  orgId: string,
  _provider: string,
  actionName: string,
  args: Record<string, unknown>,
): Promise<any> {
  try {
    const composio = getComposio();
    const result = await composio.tools.execute(actionName, {
      userId: orgId,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    } as Record<string, unknown>);
    return result;
  } catch (error) {
    console.error(`[composio] ${actionName} failed for org ${orgId}:`, error);
    return null;
  }
}

// ─── Account Listing ─────────────────────────────────────────────────────────

/** List connected accounts for an org */
export async function listConnectedAccounts(orgId: string) {
  const composio = getComposio();
  return composio.connectedAccounts.list({ userIds: [orgId] });
}
