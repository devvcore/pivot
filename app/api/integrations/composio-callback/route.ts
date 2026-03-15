// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/composio-callback
// Handles the OAuth callback redirect from Composio after user consent.
// Verifies the connection, creates an integration record, and redirects
// the user back to the app with a success indicator.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyConnection } from '@/lib/integrations/composio';
import { createIntegration } from '@/lib/integrations/store';
import type { IntegrationProvider } from '@/lib/integrations/types';

// ─── Composio app name → Pivot provider mapping ─────────────────────────────
// Composio returns an `appName` or `appUniqueId` on connected accounts.
// Map those back to our IntegrationProvider type.
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
  googlesheets: 'google_sheets',
  google_sheets: 'google_sheets',
  notion: 'notion',
  linear: 'linear',
  asana: 'asana',
  googlecalendar: 'google_calendar',
  google_calendar: 'google_calendar',
  microsoftteams: 'microsoft_teams',
  microsoft_teams: 'microsoft_teams',
  airtable: 'airtable',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const connectedAccountId = searchParams.get('connected_account_id');
    const status = searchParams.get('status');

    // ─── Validate required params ────────────────────────────────────────────
    if (!connectedAccountId) {
      console.error('[composio-callback] Missing connected_account_id');
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

    // ─── Verify the connection via Composio SDK ──────────────────────────────
    const connection = await verifyConnection(connectedAccountId);

    if (!connection) {
      console.error('[composio-callback] Could not verify connection:', connectedAccountId);
      return NextResponse.redirect(
        new URL('/?integration=error&reason=verification_failed', req.url)
      );
    }

    // ─── Determine provider from Composio connection ─────────────────────────
    const conn = connection as any;
    const appName = (conn.toolkit?.slug ?? conn.appName ?? conn.appUniqueId ?? '').toLowerCase();
    const provider = COMPOSIO_APP_TO_PROVIDER[appName];

    if (!provider) {
      console.error('[composio-callback] Unknown Composio app:', appName);
      return NextResponse.redirect(
        new URL(`/?integration=error&reason=unknown_provider&app=${encodeURIComponent(appName)}`, req.url)
      );
    }

    // ─── Extract orgId from Composio connection metadata ─────────────────────
    // We passed orgId as the Composio userId during initiateConnection
    const orgId = conn.user_id ?? conn.clientUniqueUserId ?? conn.userId ?? '';

    if (!orgId) {
      console.error('[composio-callback] No orgId found in Composio connection');
      return NextResponse.redirect(
        new URL('/?integration=error&reason=missing_org', req.url)
      );
    }

    // ─── Create integration record ───────────────────────────────────────────
    await createIntegration({
      orgId,
      provider,
      status: 'connected',
      composioConnectedAccountId: connectedAccountId,
    });

    // ─── Redirect back to app with success ───────────────────────────────────
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
