import { NextRequest, NextResponse } from "next/server";
import { runOnboardingTurn, getOnboardingWelcome } from "@/lib/agent/onboarding-agent";
import type { ChatMessage } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ message: getOnboardingWelcome() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];
    const message: string = body.message ?? "";

    if (!message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = await runOnboardingTurn(messages, message);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[/api/onboarding/chat]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
