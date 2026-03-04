// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/list
// Returns all integrations for an org with status info,
// plus available (not yet connected) providers with descriptions.
//
// Also checks for direct (non-OAuth) integrations:
// - Gmail: auto-connected if GMAIL_EMAIL + GMAIL_APP_PASSWORD set
// - Stripe: auto-connected if STRIPE_SECRET_KEY set
// - Slack: notes that xapp- token needs a bot token for full API
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { listIntegrations } from '@/lib/integrations/store';
import {
  PROVIDER_CAPABILITIES,
  type IntegrationProvider,
} from '@/lib/integrations/types';
import { isGmailIMAPConfigured } from '@/lib/integrations/gmail-imap';
import { isStripeConfigured } from '@/lib/integrations/stripe-integration';

// ── Direct Integration Status ───────────────────────────────────

interface DirectIntegration {
  provider: IntegrationProvider;
  method: 'imap' | 'api_key' | 'app_token';
  note?: string;
}

function getDirectIntegrations(): DirectIntegration[] {
  const direct: DirectIntegration[] = [];

  if (isGmailIMAPConfigured()) {
    direct.push({
      provider: 'gmail',
      method: 'imap',
    });
  }

  if (isStripeConfigured()) {
    direct.push({
      provider: 'stripe',
      method: 'api_key',
    });
  }

  // Slack xapp- token check: this is an app-level token, NOT a bot token.
  // It cannot call conversations.list/history directly. A bot token (xoxb-)
  // is still needed for full Slack integration.
  if (process.env.SLACK_APP_TOKEN) {
    direct.push({
      provider: 'slack',
      method: 'app_token',
      note:
        'Slack app-level token (xapp-) detected. A bot token (xoxb-) is still required for channel access. Connect via OAuth to get a bot token.',
    });
  }

  return direct;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId query parameter is required' },
        { status: 400 }
      );
    }

    // ─── Fetch connected integrations from Supabase (OAuth-based) ────────────
    const integrations = await listIntegrations(orgId);

    // Build a set of connected providers (from Supabase)
    const connectedProviders = new Set<IntegrationProvider>(
      integrations.map((i) => i.provider)
    );

    // ─── Check direct (non-OAuth) integrations from env vars ─────────────────
    const directIntegrations = getDirectIntegrations();

    // ─── Build connected list (without exposing tokens) ─────────────────────
    const connected = integrations.map((i) => {
      const capability = PROVIDER_CAPABILITIES.find(
        (c) => c.provider === i.provider
      );
      return {
        id: i.id,
        provider: i.provider,
        name: capability?.name ?? i.provider,
        description: capability?.description ?? '',
        category: capability?.category ?? 'unknown',
        icon: capability?.icon ?? 'Link',
        color: capability?.color ?? 'gray',
        status: i.status,
        lastSyncAt: i.lastSyncAt,
        syncFrequencyMinutes: i.syncFrequencyMinutes,
        scopes: i.scopes,
        features: capability?.features ?? [],
        connectionMethod: 'oauth' as const,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        // Metadata (without tokens)
        metadata: {
          teamName: i.metadata?.teamName,
          realmId: i.metadata?.realmId,
          instanceUrl: i.metadata?.instanceUrl,
          lastSyncRecords: i.metadata?.lastSyncRecords,
          lastSyncInsights: i.metadata?.lastSyncInsights,
          nextSyncAt: i.metadata?.nextSyncAt,
        },
      };
    });

    // Add direct integrations that are NOT already connected via OAuth
    for (const direct of directIntegrations) {
      if (!connectedProviders.has(direct.provider)) {
        const capability = PROVIDER_CAPABILITIES.find(
          (c) => c.provider === direct.provider
        );

        if (capability) {
          connectedProviders.add(direct.provider);

          connected.push({
            id: `direct-${direct.provider}`,
            provider: direct.provider,
            name: capability.name,
            description: capability.description,
            category: capability.category,
            icon: capability.icon,
            color: capability.color,
            status: 'connected',
            lastSyncAt: null,
            syncFrequencyMinutes: 60,
            scopes: [],
            features: capability.features,
            connectionMethod: direct.method as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              teamName: undefined,
              realmId: undefined,
              instanceUrl: undefined,
              lastSyncRecords: undefined,
              lastSyncInsights: undefined,
              nextSyncAt: undefined,
              ...(direct.note ? { note: direct.note } : {}),
            } as any,
          });
        }
      }
    }

    // ─── Build available (not connected) list ───────────────────────────────
    const available = PROVIDER_CAPABILITIES.filter(
      (c) => !connectedProviders.has(c.provider)
    ).map((c) => ({
      provider: c.provider,
      name: c.name,
      description: c.description,
      category: c.category,
      icon: c.icon,
      color: c.color,
      features: c.features,
      docsUrl: c.docsUrl,
    }));

    return NextResponse.json({
      connected,
      available,
      totalConnected: connected.length,
      totalAvailable: available.length,
    });
  } catch (err) {
    console.error('[integrations/list] Error:', err);
    return NextResponse.json(
      { error: 'Failed to list integrations' },
      { status: 500 }
    );
  }
}
