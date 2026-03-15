// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/composio-callback
// Handles the OAuth callback redirect from Composio after user consent.
// Verifies the connection, saves/updates integration record,
// triggers an initial data sync, and redirects back to the app.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyConnection } from '@/lib/integrations/composio';
import { upsertIntegration } from '@/lib/integrations/store';
import type { IntegrationProvider } from '@/lib/integrations/types';

// ─── Composio app name → Pivot provider mapping ─────────────────────────────
const COMPOSIO_APP_TO_PROVIDER: Record<string, IntegrationProvider> = {
  slack: 'slack',
  gmail: 'gmail',
  github: 'github',
  jira: 'jira',
  hubspot: 'hubspot',
  quickbooks: 'quickbooks',
  salesforce: 'salesforce',
  stripe: 'stripe',
  workday: 'workday',
  googleanalytics: 'google_analytics',
  google_analytics: 'google_analytics',
  'google analytics': 'google_analytics',
  googlesheets: 'google_sheets',
  google_sheets: 'google_sheets',
  'google sheets': 'google_sheets',
  notion: 'notion',
  linear: 'linear',
  asana: 'asana',
  googlecalendar: 'google_calendar',
  google_calendar: 'google_calendar',
  'google calendar': 'google_calendar',
  microsoftteams: 'microsoft_teams',
  microsoft_teams: 'microsoft_teams',
  'microsoft teams': 'microsoft_teams',
  teams: 'microsoft_teams',
  airtable: 'airtable',
  adp: 'adp',
};

/** Extract provider from any Composio connection object shape */
function extractProvider(conn: any): IntegrationProvider | null {
  // Try every possible field the SDK might use
  const candidates = [
    conn.toolkit?.slug,
    conn.toolkit?.name,
    conn.appName,
    conn.appUniqueId,
    conn.app?.name,
    conn.app?.key,
    conn.appId,
    conn.integration?.app?.name,
    conn.integration?.appName,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const key = String(raw).toLowerCase().replace(/[^a-z_]/g, '');
    if (COMPOSIO_APP_TO_PROVIDER[key]) return COMPOSIO_APP_TO_PROVIDER[key];
    // Also try with spaces/underscores normalized
    const normalized = String(raw).toLowerCase().trim();
    if (COMPOSIO_APP_TO_PROVIDER[normalized]) return COMPOSIO_APP_TO_PROVIDER[normalized];
  }
  return null;
}

/** Extract orgId from any Composio connection object shape */
function extractOrgId(conn: any): string {
  return conn.clientUniqueUserId
    ?? conn.user_id
    ?? conn.userId
    ?? conn.entityId
    ?? conn.entity_id
    ?? conn.member?.id
    ?? '';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const connectedAccountId = searchParams.get('connected_account_id');
    const status = searchParams.get('status');

    if (!connectedAccountId) {
      console.error('[composio-callback] Missing connected_account_id. Params:', Object.fromEntries(searchParams));
      return NextResponse.redirect(
        new URL('/?integration=error&reason=missing_account_id', req.url)
      );
    }

    if (status === 'failed') {
      console.error('[composio-callback] Composio reported failed status');
      return NextResponse.redirect(
        new URL('/?integration=error&reason=oauth_denied', req.url)
      );
    }

    // ─── Verify the connection via Composio SDK ──────────────────────────
    const connection = await verifyConnection(connectedAccountId);

    if (!connection) {
      console.error('[composio-callback] Could not verify connection:', connectedAccountId);
      return NextResponse.redirect(
        new URL('/?integration=error&reason=verification_failed', req.url)
      );
    }

    const conn = connection as any;

    // Log the full connection object so we can debug field names
    console.log('[composio-callback] Connection object keys:', Object.keys(conn));
    console.log('[composio-callback] Raw connection:', JSON.stringify(conn, null, 2).slice(0, 2000));

    // ─── Determine provider ─────────────────────────────────────────────
    const provider = extractProvider(conn);

    if (!provider) {
      console.error('[composio-callback] Could not determine provider from connection:', JSON.stringify(conn, null, 2).slice(0, 1000));
      return NextResponse.redirect(
        new URL(`/?integration=error&reason=unknown_provider`, req.url)
      );
    }

    // ─── Extract orgId ──────────────────────────────────────────────────
    const orgId = extractOrgId(conn);

    if (!orgId) {
      console.error('[composio-callback] Could not determine orgId from connection:', JSON.stringify(conn, null, 2).slice(0, 1000));
      return NextResponse.redirect(
        new URL('/?integration=error&reason=missing_org', req.url)
      );
    }

    console.log(`[composio-callback] Success: provider=${provider}, orgId=${orgId}, accountId=${connectedAccountId}`);

    // ─── Upsert integration record (handles reconnection) ───────────────
    await upsertIntegration({
      orgId,
      provider,
      status: 'connected',
      composioConnectedAccountId: connectedAccountId,
    });

    // ─── Trigger initial sync in background ─────────────────────────────
    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
      fetch(`${origin}/api/integrations/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, provider }),
      }).catch(e => console.warn('[composio-callback] Background sync failed:', e));
    } catch {
      // Non-fatal — sync can be triggered later
    }

    // ─── Redirect back to app ───────────────────────────────────────────
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(
      new URL(`/?integration=connected&provider=${provider}`, origin)
    );
  } catch (err) {
    console.error('[composio-callback] Error:', err);
    return NextResponse.redirect(
      new URL('/?integration=error&reason=internal', req.url)
    );
  }
}
