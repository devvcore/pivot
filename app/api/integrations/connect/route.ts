// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/connect
// Initiates an OAuth connection for a given provider.
// Returns the OAuth authorization URL for the frontend to redirect to.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { IntegrationProvider } from '@/lib/integrations/types';

const VALID_PROVIDERS: IntegrationProvider[] = [
  'slack', 'gmail', 'adp', 'workday',
  'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, orgId } = body as {
      provider?: string;
      orgId?: string;
    };

    // ─── Validate inputs ────────────────────────────────────────────────────────
    if (!provider || !orgId) {
      return NextResponse.json(
        { error: 'provider and orgId are required' },
        { status: 400 }
      );
    }

    if (!VALID_PROVIDERS.includes(provider as IntegrationProvider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}. Valid: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 }
      );
    }

    // ─── Generate CSRF state token ──────────────────────────────────────────────
    const stateToken = crypto.randomUUID();
    const statePayload = JSON.stringify({
      provider,
      orgId,
      token: stateToken,
    });
    const stateBase64 = Buffer.from(statePayload).toString('base64url');

    // Store the state token in Supabase for verification on callback
    const supabase = createAdminClient();
    const { error: storeError } = await supabase
      .from('oauth_states')
      .insert({
        state_token: stateToken,
        org_id: orgId,
        provider,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      });

    if (storeError) {
      console.error('[integrations/connect] Failed to store OAuth state:', storeError);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500 }
      );
    }

    // ─── Build OAuth authorization URL ──────────────────────────────────────────
    const { getOAuthConfig } = await import('@/lib/integrations/oauth');
    const config = getOAuthConfig(provider as IntegrationProvider);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: stateBase64,
      scope: config.scopes.join(' '),
    });

    // Provider-specific OAuth parameters
    switch (provider) {
      case 'gmail':
        params.set('access_type', 'offline');
        params.set('prompt', 'consent');
        break;
      case 'salesforce':
        params.set('prompt', 'consent');
        break;
      case 'hubspot':
        // HubSpot uses different scope format
        params.set('scope', config.scopes.join(' '));
        break;
      case 'slack':
        // Slack uses user_scope for user tokens
        params.set('user_scope', config.scopes.join(','));
        break;
      case 'quickbooks':
        // QuickBooks requires realm_id tracking
        break;
      case 'jira':
        params.set('audience', 'api.atlassian.com');
        params.set('prompt', 'consent');
        break;
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    return NextResponse.json({ authUrl, state: stateBase64 });
  } catch (err) {
    console.error('[integrations/connect] Error:', err);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
