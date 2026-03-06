// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/connect
// Initiates an OAuth connection or direct connection for a given provider.
// Returns the OAuth authorization URL for redirect, or { connected: true }
// for API-key / IMAP-based providers (Stripe, Gmail).
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

    const { createIntegration, getIntegrationByProvider } = await import(
      '@/lib/integrations/store'
    );

    // ─── Handle Gmail (IMAP with App Password) ──────────────────────────────────
    if (provider === 'gmail') {
      const { isGmailIMAPConfigured } = await import('@/lib/integrations/gmail-imap');
      if (isGmailIMAPConfigured()) {
        const existing = await getIntegrationByProvider(orgId, 'gmail');
        if (existing) {
          return NextResponse.json({ connected: true, provider: 'gmail' });
        }
        await createIntegration({
          orgId,
          provider: 'gmail',
          status: 'connected',
          accessToken: process.env.GMAIL_APP_PASSWORD ?? null,
          refreshToken: null,
          tokenExpiresAt: null,
          scopes: ['imap.readonly'],
          metadata: { type: 'imap', email: process.env.GMAIL_EMAIL },
          syncFrequencyMinutes: 60,
        });
        return NextResponse.json({ connected: true, provider: 'gmail' });
      }
      // Fall through to OAuth if IMAP not configured
    }

    // ─── Handle Stripe (API Key) ────────────────────────────────────────────────
    if (provider === 'stripe') {
      const { isStripeConfigured } = await import('@/lib/integrations/stripe-integration');
      if (isStripeConfigured()) {
        const existing = await getIntegrationByProvider(orgId, 'stripe');
        if (existing) {
          return NextResponse.json({ connected: true, provider: 'stripe' });
        }
        await createIntegration({
          orgId,
          provider: 'stripe',
          status: 'connected',
          accessToken: process.env.STRIPE_SECRET_KEY ?? null,
          refreshToken: null,
          tokenExpiresAt: null,
          scopes: ['read_only'],
          metadata: { type: 'api_key' },
          syncFrequencyMinutes: 60,
        });
        return NextResponse.json({ connected: true, provider: 'stripe' });
      }
      return NextResponse.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment variables.' },
        { status: 422 }
      );
    }

    // ─── OAuth Providers ─────────────────────────────────────────────────────────
    // Check if credentials exist before attempting OAuth
    const { getOAuthConfig } = await import('@/lib/integrations/oauth');
    let config;
    try {
      config = getOAuthConfig(provider as IntegrationProvider);
    } catch (err: any) {
      // Missing environment variables — provider not configured
      return NextResponse.json(
        { error: `${provider} is not configured yet. Missing OAuth credentials.` },
        { status: 422 }
      );
    }

    if (!config.authUrl) {
      return NextResponse.json(
        { error: `${provider} does not support OAuth and has no API key configured.` },
        { status: 422 }
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
        params.set('scope', config.scopes.join(' '));
        break;
      case 'slack':
        // Slack OAuth v2 uses comma-delimited `scope` for bot token scopes
        params.set('scope', config.scopes.join(','));
        break;
      case 'quickbooks':
        break;
      case 'jira':
        params.set('audience', 'api.atlassian.com');
        params.set('prompt', 'consent');
        break;
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    return NextResponse.json({ redirectUrl: authUrl, state: stateBase64 });
  } catch (err) {
    console.error('[integrations/connect] Error:', err);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
