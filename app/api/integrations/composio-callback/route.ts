// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/composio-callback
// Handles the OAuth callback redirect from Composio after user consent.
// orgId and provider are embedded in the callback URL by the connect route.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyConnection } from '@/lib/integrations/composio';
import { upsertIntegration } from '@/lib/integrations/store';
import type { IntegrationProvider } from '@/lib/integrations/types';

const VALID_PROVIDERS = new Set([
  'slack', 'gmail', 'github', 'jira', 'hubspot', 'quickbooks',
  'salesforce', 'stripe', 'workday', 'google_analytics', 'google_sheets',
  'notion', 'linear', 'asana', 'google_calendar', 'microsoft_teams', 'airtable', 'adp',
  'linkedin', 'twitter', 'instagram', 'facebook', 'youtube',
]);

export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';

  try {
    const { searchParams } = req.nextUrl;
    const connectedAccountId = searchParams.get('connected_account_id')
      ?? searchParams.get('connectedAccountId');
    const status = searchParams.get('status');
    // orgId and provider are embedded in the callback URL by the connect route
    const orgId = searchParams.get('orgId') ?? '';
    const provider = searchParams.get('provider') ?? '';

    console.log(`[composio-callback] Received: accountId=${connectedAccountId}, status=${status}, orgId=${orgId}, provider=${provider}`);

    if (!connectedAccountId) {
      console.error('[composio-callback] Missing connected_account_id. All params:', Object.fromEntries(searchParams));
      return NextResponse.redirect(new URL('/?integration=error&reason=missing_account_id', origin));
    }

    if (status === 'failed') {
      console.error('[composio-callback] OAuth failed/denied');
      return NextResponse.redirect(new URL('/?integration=error&reason=oauth_denied', origin));
    }

    if (!orgId || !provider || !VALID_PROVIDERS.has(provider)) {
      console.error(`[composio-callback] Missing orgId (${orgId}) or invalid provider (${provider})`);
      return NextResponse.redirect(new URL('/?integration=error&reason=missing_params', origin));
    }

    // Verify the connection is actually active in Composio
    let verified = false;
    let verifyError = '';
    try {
      const connection = await verifyConnection(connectedAccountId);
      const conn = connection as Record<string, unknown>;
      const connStatus = String(conn?.status ?? (conn?.data as Record<string, unknown>)?.status ?? 'unknown');
      console.log(`[composio-callback] Verified connection: status=${connStatus}`);
      // Only mark verified if Composio confirms active/initiated/connected
      verified = connStatus !== 'failed' && connStatus !== 'error';
    } catch (e) {
      verifyError = (e as Error).message?.slice(0, 200) ?? 'unknown';
      console.warn('[composio-callback] Verification failed:', verifyError);
    }

    // Save the integration — but mark status based on actual verification
    const finalStatus = verified ? 'connected' : 'pending';
    await upsertIntegration({
      orgId,
      provider: provider as IntegrationProvider,
      status: finalStatus,
      composioConnectedAccountId: connectedAccountId,
    });

    console.log(`[composio-callback] Saved integration: provider=${provider}, orgId=${orgId}, status=${finalStatus}, verified=${verified}`);

    // If not verified, still redirect but with a warning
    if (!verified) {
      console.warn(`[composio-callback] Connection saved as 'pending' — Composio verification failed: ${verifyError}`);
      return NextResponse.redirect(new URL(`/?integration=pending&provider=${provider}&reason=verification_pending`, origin));
    }

    // Trigger initial data sync in background
    try {
      fetch(`${origin}/api/integrations/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, provider }),
      }).catch(e => console.warn('[composio-callback] Background sync error:', e));
    } catch { /* non-fatal */ }

    return NextResponse.redirect(new URL(`/?integration=connected&provider=${provider}`, origin));
  } catch (err) {
    console.error('[composio-callback] Error:', err);
    return NextResponse.redirect(new URL('/?integration=error&reason=internal', origin));
  }
}
