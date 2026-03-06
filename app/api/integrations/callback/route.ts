// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/callback
// Universal OAuth callback handler for all providers.
// Validates state, exchanges code for tokens, saves integration.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { IntegrationProvider } from '@/lib/integrations/types';
import {
  createIntegration,
  getIntegrationByProvider,
  updateIntegration,
} from '@/lib/integrations/store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // Base redirect URL for error/success
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // ─── Handle OAuth errors from provider ────────────────────────────────────
  if (errorParam) {
    const errorDesc = searchParams.get('error_description') ?? errorParam;
    console.error('[integrations/callback] OAuth error:', errorDesc);
    return NextResponse.redirect(
      `${baseUrl}/?integration=error&message=${encodeURIComponent(errorDesc)}`
    );
  }

  // ─── Validate required params ─────────────────────────────────────────────
  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${baseUrl}/?integration=error&message=${encodeURIComponent('Missing code or state parameter')}`
    );
  }

  try {
    // ─── Decode and verify state ──────────────────────────────────────────────
    let statePayload: { provider: string; orgId: string; token: string };
    try {
      const decoded = Buffer.from(stateParam, 'base64url').toString('utf-8');
      statePayload = JSON.parse(decoded);
    } catch {
      return NextResponse.redirect(
        `${baseUrl}/?integration=error&message=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    const { provider, orgId, token: stateToken } = statePayload;

    // Verify state token exists in Supabase and hasn't expired
    const supabase = createAdminClient();
    const { data: storedState, error: stateError } = await supabase
      .from('oauth_states')
      .select()
      .eq('state_token', stateToken)
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    if (stateError || !storedState) {
      console.error('[integrations/callback] Invalid or expired state token');
      return NextResponse.redirect(
        `${baseUrl}/?integration=error&message=${encodeURIComponent('Invalid or expired OAuth state')}`
      );
    }

    // Check expiry
    if (new Date(storedState.expires_at) < new Date()) {
      // Clean up expired state
      await supabase.from('oauth_states').delete().eq('state_token', stateToken);
      return NextResponse.redirect(
        `${baseUrl}/?integration=error&message=${encodeURIComponent('OAuth state expired. Please try again.')}`
      );
    }

    // Delete the state token (one-time use)
    await supabase.from('oauth_states').delete().eq('state_token', stateToken);

    // ─── Exchange code for tokens ─────────────────────────────────────────────
    const { exchangeCodeForTokens, getOAuthConfig } = await import(
      '@/lib/integrations/oauth'
    );
    const config = getOAuthConfig(provider as IntegrationProvider);

    const tokenResult = await exchangeCodeForTokens(
      provider as IntegrationProvider,
      code
    );

    // ─── Calculate token expiry ─────────────────────────────────────────────
    const tokenExpiresAt = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
      : null;

    // ─── Provider-specific metadata ─────────────────────────────────────────
    const metadata: Record<string, any> = {};

    // QuickBooks returns realmId
    const realmId = searchParams.get('realmId');
    if (realmId) metadata.realmId = realmId;

    // Pull extra info from the raw token response
    const raw = tokenResult.raw ?? {};
    if (tokenResult.scopes?.length) metadata.grantedScopes = tokenResult.scopes;
    if (raw.instance_url) metadata.instanceUrl = raw.instance_url; // Salesforce
    if (raw.team?.id) metadata.teamId = raw.team.id; // Slack
    if (raw.team?.name) metadata.teamName = raw.team.name; // Slack

    // ─── Save or update integration ─────────────────────────────────────────
    const existing = await getIntegrationByProvider(
      orgId,
      provider as IntegrationProvider
    );

    if (existing) {
      // Re-connecting an existing integration
      await updateIntegration(existing.id, {
        status: 'connected',
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken ?? existing.refreshToken,
        tokenExpiresAt,
        scopes: config.scopes,
        metadata: { ...existing.metadata, ...metadata },
      });
    } else {
      // New integration
      await createIntegration({
        orgId,
        provider: provider as IntegrationProvider,
        status: 'connected',
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken ?? null,
        tokenExpiresAt,
        scopes: config.scopes,
        metadata,
        syncFrequencyMinutes: 60,
      });
    }

    // ─── Redirect to dashboard with success ─────────────────────────────────
    return NextResponse.redirect(
      `${baseUrl}/?integration=connected&provider=${provider}`
    );
  } catch (err) {
    console.error('[integrations/callback] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Unknown error during OAuth callback';
    return NextResponse.redirect(
      `${baseUrl}/?integration=error&message=${encodeURIComponent(message)}`
    );
  }
}
