// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/sync
// Triggers a manual sync for a specific integration or all
// connected integrations for an org.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getIntegration,
  getIntegrationByProvider,
} from '@/lib/integrations/store';
import { runSync, runOrgSync } from '@/lib/integrations/sync-engine';
import type { IntegrationProvider } from '@/lib/integrations/types';

const VALID_PROVIDERS: IntegrationProvider[] = [
  'slack', 'gmail', 'adp', 'workday',
  'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { integrationId, orgId, provider } = body as {
      integrationId?: string;
      orgId?: string;
      provider?: string;
    };

    // ─── Case 1: Sync a specific integration by ID ──────────────────────────
    if (integrationId) {
      const integration = await getIntegration(integrationId);
      if (!integration) {
        return NextResponse.json(
          { error: `Integration not found: ${integrationId}` },
          { status: 404 }
        );
      }

      if (integration.status === 'syncing') {
        return NextResponse.json(
          { error: 'Sync already in progress for this integration' },
          { status: 409 }
        );
      }

      const result = await runSync(integrationId);

      return NextResponse.json({
        provider: integration.provider,
        result,
      });
    }

    // ─── Case 2: Sync a specific provider for an org ────────────────────────
    if (orgId && provider) {
      if (!VALID_PROVIDERS.includes(provider as IntegrationProvider)) {
        return NextResponse.json(
          { error: `Invalid provider: ${provider}` },
          { status: 400 }
        );
      }

      const integration = await getIntegrationByProvider(
        orgId,
        provider as IntegrationProvider
      );
      if (!integration) {
        return NextResponse.json(
          { error: `No ${provider} integration found for org ${orgId}` },
          { status: 404 }
        );
      }

      if (integration.status === 'syncing') {
        return NextResponse.json(
          { error: `Sync already in progress for ${provider}` },
          { status: 409 }
        );
      }

      const result = await runSync(integration.id);

      return NextResponse.json({
        provider: integration.provider,
        result,
      });
    }

    // ─── Case 3: Sync ALL connected integrations for an org ─────────────────
    if (orgId) {
      const results = await runOrgSync(orgId);

      const totalProviders = Object.keys(results).length;
      const successCount = Object.values(results).filter((r) => r.success).length;
      const errorCount = totalProviders - successCount;

      return NextResponse.json({
        orgId,
        totalProviders,
        successCount,
        errorCount,
        results,
      });
    }

    // ─── No valid params ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        error:
          'Provide integrationId, or orgId with optional provider. If orgId alone, syncs ALL connected integrations.',
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('[integrations/sync] Error:', err);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
