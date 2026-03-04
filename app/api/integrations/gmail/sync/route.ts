// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/gmail/sync
// Triggers Gmail IMAP sync using app password (no OAuth).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  syncGmailIMAP,
  isGmailIMAPConfigured,
} from "@/lib/integrations/gmail-imap";

export async function POST(req: Request) {
  try {
    if (!isGmailIMAPConfigured()) {
      return NextResponse.json(
        {
          error:
            "Gmail IMAP not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env",
        },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { orgId, daysBack } = body as {
      orgId?: string;
      daysBack?: number;
    };

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 },
      );
    }

    const result = await syncGmailIMAP(orgId);

    return NextResponse.json({
      success: result.success,
      messagesFound: result.recordsProcessed,
      insightsGenerated: result.insightsGenerated,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[gmail/sync] Error:", err);
    return NextResponse.json(
      { error: "Gmail sync failed" },
      { status: 500 },
    );
  }
}
