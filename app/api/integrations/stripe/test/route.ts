// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/stripe/test
// Tests Stripe API connection by fetching account balance.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  testStripeConnection,
  isStripeConfigured,
} from "@/lib/integrations/stripe-integration";

export async function GET() {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          connected: false,
          error:
            "Stripe not configured. Set STRIPE_SECRET_KEY in .env",
        },
        { status: 400 },
      );
    }

    const result = await testStripeConnection();

    if (!result.connected) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[stripe/test] Error:", err);
    return NextResponse.json(
      {
        connected: false,
        error: "Failed to test Stripe connection",
      },
      { status: 500 },
    );
  }
}
