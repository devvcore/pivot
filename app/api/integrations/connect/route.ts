// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/connect
// Initiates an OAuth connection for a given provider.
// Strategy:
//   1. If COMPOSIO_API_KEY is set → use Composio hosted OAuth
//   2. If manual OAuth credentials exist → use manual OAuth flow
//   3. If Stripe → use API key (no OAuth needed)
//   4. Otherwise → return "not configured" error
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { IntegrationProvider } from '@/lib/integrations/types';

const ALL_PROVIDERS: IntegrationProvider[] = [
  'slack', 'gmail', 'adp', 'workday',
  'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira', 'github',
  'google_analytics', 'google_sheets', 'notion', 'linear',
  'asana', 'google_calendar', 'microsoft_teams', 'airtable',
  'linkedin', 'twitter', 'instagram', 'facebook', 'youtube',
];

// Providers that can use manual OAuth (have configs in oauth.ts)
const MANUAL_OAUTH_PROVIDERS = new Set<string>([
  'slack', 'gmail', 'quickbooks', 'salesforce', 'hubspot', 'jira', 'github', 'adp', 'workday',
]);

// Stripe uses API key directly — no OAuth redirect needed
const API_KEY_PROVIDERS = new Set<string>(['stripe']);

function isComposioAvailable(): boolean {
  return !!process.env.COMPOSIO_API_KEY;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, orgId } = body as {
      provider?: string;
      orgId?: string;
    };

    // ─── Validate inputs ─────────────────────────────────────────────────────
    if (!provider || !orgId) {
      return NextResponse.json(
        { error: 'provider and orgId are required' },
        { status: 400 }
      );
    }

    if (!ALL_PROVIDERS.includes(provider as IntegrationProvider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}. Valid: ${ALL_PROVIDERS.join(', ')}` },
        { status: 400 }
      );
    }

    const typedProvider = provider as IntegrationProvider;

    // ─── Strategy 1: Composio (if API key is configured) ─────────────────────
    if (isComposioAvailable() && typedProvider !== 'adp') {
      try {
        const { isComposioProvider, initiateConnection } = await import('@/lib/integrations/composio');
        if (isComposioProvider(typedProvider)) {
          const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
          // Embed orgId and provider in callback URL so we don't rely on SDK response fields
          const callbackUrl = `${origin}/api/integrations/composio-callback?orgId=${encodeURIComponent(orgId)}&provider=${encodeURIComponent(typedProvider)}`;
          const { redirectUrl } = await initiateConnection(typedProvider, orgId, callbackUrl);

          if (redirectUrl) {
            return NextResponse.json({ redirectUrl });
          }
          // If Composio returned no URL, fall through to manual OAuth
          console.warn(`[connect] Composio returned no redirect URL for ${provider}, trying manual OAuth`);
        }
      } catch (composioErr) {
        console.warn(`[connect] Composio failed for ${provider}, trying manual OAuth:`, composioErr);
        // Fall through to manual OAuth
      }
    }

    // ─── Strategy 2: API Key providers (Stripe) ──────────────────────────────
    if (API_KEY_PROVIDERS.has(typedProvider)) {
      // Stripe connects via API key, not OAuth redirect
      const apiKey = process.env.STRIPE_SECRET_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Stripe is not configured. Missing STRIPE_SECRET_KEY.' },
          { status: 422 }
        );
      }

      // Create/update integration record directly
      const supabase = createAdminClient();
      await supabase.from('integrations').upsert(
        {
          org_id: orgId,
          provider: 'stripe',
          status: 'connected',
          access_token: apiKey,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,provider' }
      );

      return NextResponse.json({ connected: true, provider: 'stripe' });
    }

    // ─── Strategy 3: Manual OAuth (DISABLED — using Composio for all providers) ──
    // Old manual OAuth code preserved below but bypassed. All providers now connect via Composio.
    /*
    if (MANUAL_OAUTH_PROVIDERS.has(typedProvider)) {
      const { getOAuthConfig, buildAuthUrl } = await import('@/lib/integrations/oauth');

      let config;
      try {
        config = getOAuthConfig(typedProvider);
      } catch {
        return NextResponse.json(
          { error: `${provider} is not configured yet. Missing OAuth credentials in environment.` },
          { status: 422 }
        );
      }

      if (!config.authUrl) {
        return NextResponse.json(
          { error: `${provider} does not have an OAuth URL configured.` },
          { status: 422 }
        );
      }

      // Generate CSRF state token
      const stateToken = crypto.randomUUID();
      const statePayload = JSON.stringify({
        provider: typedProvider,
        orgId,
        token: stateToken,
      });
      const stateBase64 = Buffer.from(statePayload).toString('base64url');

      // Store state in Supabase
      const supabase = createAdminClient();
      const { error: storeError } = await supabase
        .from('oauth_states')
        .insert({
          state_token: stateToken,
          org_id: orgId,
          provider: typedProvider,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (storeError) {
        console.error('[connect] Failed to store OAuth state:', storeError);
        return NextResponse.json(
          { error: 'Failed to initiate OAuth flow' },
          { status: 500 }
        );
      }

      // Build the auth URL
      let authUrl: string;
      try {
        authUrl = buildAuthUrl(typedProvider, orgId, stateBase64);
      } catch {
        // Fallback: build URL manually from config
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: 'code',
          state: stateBase64,
          scope: config.scopes.join(typedProvider === 'slack' ? ',' : ' '),
        });
        authUrl = `${config.authUrl}?${params.toString()}`;
      }

      return NextResponse.json({ redirectUrl: authUrl, state: stateBase64 });
    }
    */

    // ─── No connection method available ──────────────────────────────────────
    return NextResponse.json(
      { error: `${provider} is not configured yet. Set up Composio or add OAuth credentials to connect.` },
      { status: 422 }
    );
  } catch (err) {
    console.error('[integrations/connect] Error:', err);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
