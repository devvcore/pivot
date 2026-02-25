import { NextResponse } from "next/server";
import { runBusinessAgent } from "@/lib/agent/business-agent";
import type { ChatMessage } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { orgId, messages, message } = await req.json();

    if (!orgId || !message) {
      return NextResponse.json({ error: "orgId and message are required" }, { status: 400 });
    }

    const result = await runBusinessAgent({
      orgId,
      messages: (messages as ChatMessage[]) ?? [],
      message: message as string,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/agent/chat]", err);
    return NextResponse.json(
      { error: "Agent error", message: "I ran into a technical issue. Please try again." },
      { status: 500 }
    );
  }
}
