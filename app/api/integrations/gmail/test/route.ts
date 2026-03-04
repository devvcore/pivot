// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/gmail/test
// Tests Gmail IMAP connection using app password.
// Returns connection status and inbox message count.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  testGmailIMAPConnection,
  isGmailIMAPConfigured,
} from "@/lib/integrations/gmail-imap";

export async function GET() {
  try {
    if (!isGmailIMAPConfigured()) {
      return NextResponse.json(
        {
          connected: false,
          error:
            "Gmail IMAP not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env",
        },
        { status: 400 },
      );
    }

    const result = await testGmailIMAPConnection();

    if (!result.connected) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[gmail/test] Error:", err);
    return NextResponse.json(
      {
        connected: false,
        error: "Failed to test Gmail connection",
      },
      { status: 500 },
    );
  }
}
