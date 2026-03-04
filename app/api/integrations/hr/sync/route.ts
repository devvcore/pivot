// ═══════════════════════════════════════════════════════════════
// Pivot — HR Data Sync Endpoint
// POST triggers a full sync from ADP or Workday
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { syncADPToAnalytics } from "@/lib/integrations/adp";
import { syncWorkdayToAnalytics } from "@/lib/integrations/workday";
import { getIntegrationByProvider } from "@/lib/integrations/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, provider } = body as {
      orgId?: string;
      provider?: "adp" | "workday";
    };

    // ── Validate input ─────────────────────────────────────────────
    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 }
      );
    }

    if (!provider || (provider !== "adp" && provider !== "workday")) {
      return NextResponse.json(
        { error: "provider must be 'adp' or 'workday'" },
        { status: 400 }
      );
    }

    // ── Verify integration exists and is connected ─────────────────
    const integration = await getIntegrationByProvider(orgId, provider);

    if (!integration) {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} integration not found. Connect it first.` },
        { status: 404 }
      );
    }

    if (!integration.accessToken) {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} integration has no access token. Please reconnect.` },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (integration.tokenExpiresAt) {
      const expiresAt = new Date(integration.tokenExpiresAt);
      if (expiresAt <= new Date()) {
        return NextResponse.json(
          {
            error: `${provider.toUpperCase()} access token has expired. Please reconnect or refresh the token.`,
            code: "TOKEN_EXPIRED",
          },
          { status: 401 }
        );
      }
    }

    // Check if already syncing
    if (integration.status === "syncing") {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} sync is already in progress.` },
        { status: 409 }
      );
    }

    // ── Run sync based on provider ─────────────────────────────────
    let result;

    if (provider === "adp") {
      result = await syncADPToAnalytics(orgId, integration.accessToken);
    } else {
      // Workday requires tenant from metadata
      const tenant = integration.metadata?.tenant;
      if (!tenant) {
        return NextResponse.json(
          {
            error: "Workday tenant not found in integration metadata. Please reconnect.",
          },
          { status: 400 }
        );
      }
      result = await syncWorkdayToAnalytics(orgId, integration.accessToken, tenant);
    }

    // ── Return results ─────────────────────────────────────────────
    return NextResponse.json({
      success: result.success,
      provider,
      recordsProcessed: result.recordsProcessed,
      insightsGenerated: result.insightsGenerated,
      errors: result.errors,
      nextSyncAt: result.nextSyncAt || null,
    });
  } catch (err: any) {
    console.error("[hr/sync] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to sync HR data" },
      { status: 500 }
    );
  }
}
