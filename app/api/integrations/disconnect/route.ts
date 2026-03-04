// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/disconnect
// Disconnects an integration: revokes token if possible,
// deletes the integration record from the database.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getIntegration,
  deleteIntegration,
} from '@/lib/integrations/store';

// Provider-specific token revocation endpoints
const REVOKE_ENDPOINTS: Partial<Record<string, string>> = {
  gmail: 'https://oauth2.googleapis.com/revoke',
  slack: 'https://slack.com/api/auth.revoke',
  hubspot: 'https://api.hubapi.com/oauth/v1/refresh-tokens/',
  salesforce: '/services/oauth2/revoke', // needs instance_url prefix
};

async function revokeToken(
  provider: string,
  accessToken: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    switch (provider) {
      case 'gmail': {
        await fetch(
          `${REVOKE_ENDPOINTS.gmail}?token=${encodeURIComponent(accessToken)}`,
          { method: 'POST' }
        );
        break;
      }
      case 'slack': {
        await fetch(REVOKE_ENDPOINTS.slack!, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        break;
      }
      case 'salesforce': {
        const instanceUrl = metadata?.instanceUrl;
        if (instanceUrl) {
          await fetch(
            `${instanceUrl}${REVOKE_ENDPOINTS.salesforce}?token=${encodeURIComponent(accessToken)}`,
            { method: 'POST' }
          );
        }
        break;
      }
      case 'hubspot': {
        // HubSpot revokes by refresh token via DELETE
        if (metadata?.refreshToken) {
          await fetch(
            `${REVOKE_ENDPOINTS.hubspot}${encodeURIComponent(metadata.refreshToken)}`,
            { method: 'DELETE' }
          );
        }
        break;
      }
      // ADP, Workday, QuickBooks, Stripe, Jira: no standard revocation or handled differently
      default:
        break;
    }
  } catch (err) {
    // Token revocation is best-effort; log but don't fail
    console.warn(
      `[integrations/disconnect] Token revocation failed for ${provider}:`,
      err
    );
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

    // ─── Revoke token if possible ───────────────────────────────────────────
    if (integration.accessToken) {
      await revokeToken(
        integration.provider,
        integration.accessToken,
        {
          ...integration.metadata,
          refreshToken: integration.refreshToken,
        }
      );
    }

    // ─── Delete integration record ──────────────────────────────────────────
    await deleteIntegration(integrationId);

    return NextResponse.json({
      success: true,
      message: `Disconnected ${integration.provider} integration`,
      provider: integration.provider,
    });
  } catch (err) {
    console.error('[integrations/disconnect] Error:', err);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}
