// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/disconnect
// Disconnects an integration:
// - Composio providers: deletes the Composio connected account, then DB record
// - ADP: revokes token manually, then deletes DB record
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getIntegration,
  deleteIntegration,
} from '@/lib/integrations/store';
import { isComposioProvider, deleteConnection } from '@/lib/integrations/composio';
import type { IntegrationProvider } from '@/lib/integrations/types';

// ─── ADP token revocation (manual OAuth) ─────────────────────────────────────

async function revokeAdpToken(
  accessToken: string,
): Promise<void> {
  try {
    // ADP doesn't have a standard revocation endpoint — best effort.
    // Their tokens are typically short-lived and managed via certificate-based auth.
    // We simply discard the token from our DB.
    console.log('[integrations/disconnect] ADP token discarded (no revocation endpoint)');
  } catch (err) {
    console.warn('[integrations/disconnect] ADP token revocation error:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { integrationId } = body as { integrationId?: string };

    if (!integrationId) {
      return NextResponse.json(
        { error: 'integrationId is required' },
        { status: 400 }
      );
    }

    // ─── Fetch integration ──────────────────────────────────────────────────
    const integration = await getIntegration(integrationId);
    if (!integration) {
      return NextResponse.json(
        { error: `Integration not found: ${integrationId}` },
        { status: 404 }
      );
    }

    const provider = integration.provider as IntegrationProvider;

    // ─── Composio Providers ─────────────────────────────────────────────────
    if (isComposioProvider(provider)) {
      // Delete the Composio connected account if we have one
      if (integration.composioConnectedAccountId) {
        try {
          await deleteConnection(integration.composioConnectedAccountId);
        } catch (err) {
          // Non-fatal: the Composio account may already be deleted
          console.warn(
            `[integrations/disconnect] Failed to delete Composio account ${integration.composioConnectedAccountId}:`,
            err
          );
        }
      }

      // Delete integration record from our DB
      await deleteIntegration(integrationId);

      return NextResponse.json({
        success: true,
        message: `Disconnected ${provider} integration (Composio)`,
        provider,
      });
    }

    // ─── ADP: Manual revocation ─────────────────────────────────────────────
    if (provider === 'adp') {
      if (integration.accessToken) {
        await revokeAdpToken(integration.accessToken);
      }

      await deleteIntegration(integrationId);

      return NextResponse.json({
        success: true,
        message: 'Disconnected ADP integration',
        provider: 'adp',
      });
    }

    // ─── Fallback: unknown provider — just delete the record ────────────────
    await deleteIntegration(integrationId);

    return NextResponse.json({
      success: true,
      message: `Disconnected ${provider} integration`,
      provider,
    });
  } catch (err) {
    console.error('[integrations/disconnect] Error:', err);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}
