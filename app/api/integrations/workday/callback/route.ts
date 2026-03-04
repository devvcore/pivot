// ═══════════════════════════════════════════════════════════════
// Pivot — Workday OAuth Callback
// Handles the OAuth2 authorization code redirect from Workday
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { exchangeWorkdayCode } from "@/lib/integrations/workday";
import {
  createIntegration,
  getIntegrationByProvider,
  updateIntegration,
} from "@/lib/integrations/store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors from Workday
    if (error) {
      console.error("[workday/callback] OAuth error:", error, errorDescription);
      const redirectUrl = new URL("/integrations", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
      redirectUrl.searchParams.set("error", errorDescription || error);
      redirectUrl.searchParams.set("provider", "workday");
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Decode state to get orgId and tenant
    // State format: base64({ orgId: string, tenant: string, nonce: string })
    let orgId: string;
    let tenant: string;
    try {
      const stateData = JSON.parse(
        Buffer.from(state || "", "base64").toString("utf-8")
      );
      orgId = stateData.orgId;
      tenant = stateData.tenant;
      if (!orgId) throw new Error("Missing orgId in state");
      if (!tenant) throw new Error("Missing tenant in state");
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: `Invalid state parameter: ${parseErr.message}` },
        { status: 400 }
      );
    }

    // Exchange authorization code for tokens
    const redirectUri =
      process.env.WORKDAY_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/workday/callback`;

    const tokens = await exchangeWorkdayCode(code, tenant, redirectUri);

    // Calculate token expiration
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();

    // Upsert integration record
    const existing = await getIntegrationByProvider(orgId, "workday");

    if (existing) {
      await updateIntegration(existing.id, {
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: ["wd:workers", "wd:compensation", "wd:organizations"],
        metadata: {
          ...(typeof existing.metadata === "object" ? existing.metadata : {}),
          tenant,
          connectedAt: new Date().toISOString(),
        },
      });
    } else {
      await createIntegration({
        orgId,
        provider: "workday",
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: ["wd:workers", "wd:compensation", "wd:organizations"],
        metadata: {
          tenant,
          connectedAt: new Date().toISOString(),
        },
      });
    }

    // Redirect back to integrations page with success
    const redirectUrl = new URL(
      "/integrations",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    );
    redirectUrl.searchParams.set("connected", "workday");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error("[workday/callback] Error:", err);
    const redirectUrl = new URL(
      "/integrations",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    );
    redirectUrl.searchParams.set("error", err.message || "Failed to connect Workday");
    redirectUrl.searchParams.set("provider", "workday");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
