import { NextRequest, NextResponse } from "next/server";

/**
 * Validate API key from x-api-key header against PIVOT_API_KEY env var.
 * Returns null if valid, or a 401 NextResponse if invalid.
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.PIVOT_API_KEY;

  if (!expectedKey) {
    // If no API key is configured, allow all requests (dev mode)
    return null;
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid x-api-key header." },
      { status: 401 },
    );
  }

  return null;
}
