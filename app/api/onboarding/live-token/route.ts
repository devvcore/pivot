import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

/**
 * Create ephemeral token for Gemini Live API.
 * Client uses this token to connect directly to Live API (keeps API key server-side).
 * Note: Ephemeral tokens require v1alpha API; if this fails, use GEMINI_API_KEY in client for dev.
 */
export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: "gemini-2.0-flash-live-001",
        },
      },
    });

    const t = token as { accessToken?: string; token?: string; name?: string };
    const tokenValue = t.accessToken ?? t.token ?? t.name;
    if (!tokenValue) {
      console.warn("[live-token] Token structure:", Object.keys(token));
      return NextResponse.json({ error: "Token created but no value returned" }, { status: 500 });
    }
    return NextResponse.json({ token: tokenValue });
  } catch (e) {
    console.error("[live-token]", e);
    return NextResponse.json({ error: "Failed to create Live API token" }, { status: 500 });
  }
}
