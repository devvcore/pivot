import { NextRequest, NextResponse } from "next/server";
import { chatWithCoach } from "@/lib/agent/coach-agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, runId, messages, message, memberRole, memberName } = body;

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const result = await chatWithCoach({
      orgId: orgId || "default-org",
      runId,
      messages: messages || [],
      message,
      memberRole: memberRole || "owner",
      memberName,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/coach/chat]", err);
    return NextResponse.json(
      { error: "Coach unavailable", message: "Coach ran into a technical issue. Please try again." },
      { status: 500 }
    );
  }
}
