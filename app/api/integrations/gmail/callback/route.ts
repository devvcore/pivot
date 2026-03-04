// ================================================================
// Pivot -- Gmail OAuth Callback
// Exchanges authorization code for tokens, saves integration.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // orgId encoded in state
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[gmail/callback] OAuth error:", error);
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
    // Exchange code for access token via Google OAuth2
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${tokenRes.status} ${errBody.slice(0, 200)}`);
    }

    const tokenData = await tokenRes.json();

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresIn = tokenData.expires_in; // seconds
    const scopes = (tokenData.scope ?? "").split(" ").filter(Boolean);

    // Fetch user profile to get email
    let userEmail: string | null = null;
    try {
      const profileRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        userEmail = profile.emailAddress ?? null;
      }
    } catch {
      // Non-critical: proceed without email
    }

    // Save integration to Supabase
    const supabase = createAdminClient();

    // Check if integration already exists for this org + provider
    const { data: existing } = await supabase
      .from("integrations")
      .select("id")
      .eq("org_id", orgId)
      .eq("provider", "gmail")
      .maybeSingle();

    if (existing) {
      // Update existing integration
      await supabase
        .from("integrations")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresIn
            ? new Date(Date.now() + expiresIn * 1000).toISOString()
            : null,
          scopes,
          status: "connected",
          metadata: { userEmail },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new integration
      await supabase.from("integrations").insert({
        id: crypto.randomUUID(),
        org_id: orgId,
        provider: "gmail",
        status: "connected",
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresIn
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null,
        scopes,
        metadata: { userEmail },
        sync_frequency_minutes: 360, // every 6 hours
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard?integration_success=gmail&email=${encodeURIComponent(userEmail ?? "Gmail")}`,
        request.url,
      ),
    );
  } catch (err) {
    console.error("[gmail/callback] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(
        `/dashboard?integration_error=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
