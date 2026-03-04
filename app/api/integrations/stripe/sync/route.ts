// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/stripe/sync
// Triggers Stripe sync using API key from environment (no OAuth).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  syncStripeDirectly,
  isStripeConfigured,
} from "@/lib/integrations/stripe-integration";

export async function POST(req: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          error:
            "Stripe not configured. Set STRIPE_SECRET_KEY in .env",
        },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { orgId } = body as { orgId?: string };

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 },
      );
    }

    const result = await syncStripeDirectly(orgId);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[stripe/sync] Error:", err);
    return NextResponse.json(
      { error: "Stripe sync failed" },
      { status: 500 },
    );
  }
}
