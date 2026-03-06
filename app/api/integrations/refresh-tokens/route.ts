// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/refresh-tokens
// Cron-triggered endpoint that refreshes OAuth tokens expiring
// within the next 30 minutes. Called by Cloud Scheduler.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

// Refresh tokens that expire within this window (30 minutes)
const REFRESH_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: Request) {
  // ─── Auth: verify cron secret ──────────────────────────────────────────────
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    '';
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // ─── Find integrations with tokens expiring soon ──────────────────────────
    const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS).toISOString();

    const { data: expiring, error: queryError } = await supabase
      .from('integrations')
      .select('id, org_id, provider, refresh_token, token_expires_at, metadata')
      .eq('status', 'connected')
      .not('refresh_token', 'is', null)
      .not('token_expires_at', 'is', null)
      .lt('token_expires_at', cutoff);

    if (queryError) {
      console.error('[refresh-tokens] Query error:', queryError);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    if (!expiring?.length) {
      return NextResponse.json({ refreshed: 0, message: 'No tokens need refresh' });
    }

    console.log(`[refresh-tokens] Found ${expiring.length} tokens to refresh`);

    const { refreshAccessToken } = await import('@/lib/integrations/oauth');
    const { updateIntegration } = await import('@/lib/integrations/store');

    const results: { provider: string; success: boolean; error?: string }[] = [];

    for (const integration of expiring) {
      try {
        // Skip API-key providers (Stripe) — they don't expire
        if (integration.metadata?.type === 'api_key' || integration.metadata?.type === 'imap') {
          continue;
        }

        if (!integration.refresh_token) {
          results.push({
            provider: integration.provider,
            success: false,
            error: 'No refresh token',
          });
          continue;
        }

        const tokenResult = await refreshAccessToken(
          integration.provider,
          integration.refresh_token
        );

        const newExpiresAt = tokenResult.expiresIn
          ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
          : null;

        await updateIntegration(integration.id, {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken ?? integration.refresh_token,
          tokenExpiresAt: newExpiresAt,
        });

        results.push({ provider: integration.provider, success: true });
        console.log(`[refresh-tokens] Refreshed ${integration.provider} for org ${integration.org_id}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[refresh-tokens] Failed to refresh ${integration.provider}:`, errorMsg);
        results.push({
          provider: integration.provider,
          success: false,
          error: errorMsg,
        });

        // Mark as error if refresh fails (token may be revoked)
        try {
          await updateIntegration(integration.id, { status: 'error' });
        } catch {
          // ignore update failure
        }
      }
    }

    const refreshed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      refreshed,
      failed,
      total: expiring.length,
      results,
    });
  } catch (err) {
    console.error('[refresh-tokens] Error:', err);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
