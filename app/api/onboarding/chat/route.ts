import { NextRequest, NextResponse } from "next/server";
import { runOnboardingTurn, getOnboardingWelcome } from "@/lib/agent/onboarding-agent";
import type { ChatMessage, Questionnaire } from "@/lib/types";

export async function GET(req: NextRequest) {
  const extractedParam = req.nextUrl.searchParams.get("extracted");
  let extracted: Partial<Questionnaire> | undefined;
  if (extractedParam) {
    try {
      extracted = JSON.parse(decodeURIComponent(extractedParam)) as Partial<Questionnaire>;
    } catch {
      // ignore
    }
  }
  return NextResponse.json({ message: getOnboardingWelcome(extracted) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];
    const message: string = body.message ?? "";
    const extractedFromDocs: Partial<Questionnaire> | undefined = body.extractedFromDocs;

    if (!message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = await runOnboardingTurn(messages, message, extractedFromDocs);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[/api/onboarding/chat]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
