import { NextResponse } from "next/server";

/**
 * Provide API key for Gemini Live API client-side connection.
 * In production, replace with proper ephemeral token flow.
 */
export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }
  return NextResponse.json({ apiKey });
}
