// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/list
// Returns all integrations for an org with status info,
// plus available (not yet connected) providers with descriptions.
// All connections are managed through Composio OAuth.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { listIntegrations } from '@/lib/integrations/store';
import {
  PROVIDER_CAPABILITIES,
  type IntegrationProvider,
} from '@/lib/integrations/types';

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
