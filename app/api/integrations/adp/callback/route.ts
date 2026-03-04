// ═══════════════════════════════════════════════════════════════
// Pivot — ADP OAuth Callback
// Handles the OAuth2 authorization code redirect from ADP
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { exchangeADPCode } from "@/lib/integrations/adp";
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

    // Handle OAuth errors from ADP
    if (error) {
      console.error("[adp/callback] OAuth error:", error, errorDescription);
      const redirectUrl = new URL("/integrations", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
      redirectUrl.searchParams.set("error", errorDescription || error);
      redirectUrl.searchParams.set("provider", "adp");
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Decode state to get orgId
    // State format: base64({ orgId: string, nonce: string })
    let orgId: string;
    try {
      const stateData = JSON.parse(
        Buffer.from(state || "", "base64").toString("utf-8")
      );
      orgId = stateData.orgId;
      if (!orgId) throw new Error("Missing orgId in state");
    } catch {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    // Exchange authorization code for tokens
    const redirectUri =
      process.env.ADP_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/adp/callback`;

    const tokens = await exchangeADPCode(code, redirectUri);

    // Calculate token expiration
    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();

    // Upsert integration record
    const existing = await getIntegrationByProvider(orgId, "adp");

    if (existing) {
      await updateIntegration(existing.id, {
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: ["worker-demographics", "payroll", "time-management"],
      });
    } else {
      await createIntegration({
        orgId,
        provider: "adp",
        status: "connected",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: ["worker-demographics", "payroll", "time-management"],
        metadata: { connectedAt: new Date().toISOString() },
      });
    }

    // Redirect back to integrations page with success
    const redirectUrl = new URL(
      "/integrations",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    );
    redirectUrl.searchParams.set("connected", "adp");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error("[adp/callback] Error:", err);
    const redirectUrl = new URL(
      "/integrations",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    );
    redirectUrl.searchParams.set("error", err.message || "Failed to connect ADP");
    redirectUrl.searchParams.set("provider", "adp");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
