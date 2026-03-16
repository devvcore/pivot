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
  'linkedin', 'twitter',
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

    // Verify the connection is active (handles UUID→nanoid conversion)
    let verified = false;
    try {
      const connection = await verifyConnection(connectedAccountId);
      const conn = connection as any;
      console.log(`[composio-callback] Verified connection: status=${conn?.status ?? conn?.data?.status ?? 'unknown'}`);
      verified = true;
    } catch (e) {
      // Log but don't block — connection might still be valid even if SDK verification fails
      console.warn('[composio-callback] Verification warning (proceeding anyway):', (e as Error).message?.slice(0, 200));
    }

    // Save the integration record (upsert handles reconnection)
    await upsertIntegration({
      orgId,
      provider: provider as IntegrationProvider,
      status: 'connected',
      composioConnectedAccountId: connectedAccountId,
    });

    console.log(`[composio-callback] Saved integration: provider=${provider}, orgId=${orgId}, verified=${verified}`);

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
