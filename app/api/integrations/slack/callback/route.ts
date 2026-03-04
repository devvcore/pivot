// ================================================================
// Pivot -- Slack OAuth Callback
// Exchanges authorization code for tokens, saves integration.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // orgId encoded in state
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[slack/callback] OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/dashboard?integration_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?integration_error=missing_code", request.url),
    );
  }

  // Decode orgId from state parameter
  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(state ?? "", "base64url").toString("utf-8"));
    orgId = parsed.orgId;
    if (!orgId) throw new Error("No orgId in state");
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard?integration_error=invalid_state", request.url),
    );
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Slack token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      throw new Error(`Slack token error: ${tokenData.error}`);
    }

    const accessToken = tokenData.access_token;
    const teamName = tokenData.team?.name ?? null;
    const teamId = tokenData.team?.id ?? null;
    const scopes = (tokenData.scope ?? "").split(",").filter(Boolean);

    // Save integration to Supabase
    const supabase = createAdminClient();

    // Check if integration already exists for this org + provider
    const { data: existing } = await supabase
      .from("integrations")
      .select("id")
      .eq("org_id", orgId)
      .eq("provider", "slack")
      .maybeSingle();

    if (existing) {
      // Update existing integration
      await supabase
        .from("integrations")
        .update({
          access_token: accessToken,
          refresh_token: tokenData.refresh_token ?? null,
          token_expires_at: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null,
          scopes,
          status: "connected",
          metadata: { teamName, teamId },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new integration
      await supabase.from("integrations").insert({
        id: crypto.randomUUID(),
        org_id: orgId,
        provider: "slack",
        status: "connected",
        access_token: accessToken,
        refresh_token: tokenData.refresh_token ?? null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        scopes,
        metadata: { teamName, teamId },
        sync_frequency_minutes: 360, // every 6 hours
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard?integration_success=slack&team=${encodeURIComponent(teamName ?? "Slack")}`,
        request.url,
      ),
    );
  } catch (err) {
    console.error("[slack/callback] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(
        `/dashboard?integration_error=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
