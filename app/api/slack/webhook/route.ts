/**
 * POST /api/slack/webhook
 *
 * Slack Events API webhook handler.
 * Receives messages from Slack and routes them to Pivvy or execution agents.
 * Users can DM the Pivot bot to interact with their business data from Slack.
 *
 * Supports:
 * - URL verification (Slack challenge)
 * - Message events (DMs to the bot)
 * - App mention events (@Pivot in channels)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Slack URL verification challenge
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Verify the request is from Slack (basic check)
  if (body.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = body.event;
  if (!event) return NextResponse.json({ ok: true });

  // Ignore bot messages (prevent infinite loops)
  if (event.bot_id || event.subtype === "bot_message") {
    return NextResponse.json({ ok: true });
  }

  // Handle message events (DM or mention)
  if (event.type === "message" || event.type === "app_mention") {
    const text = event.text?.replace(/<@[^>]+>/g, "").trim(); // Remove @mentions
    const userId = event.user;
    const channel = event.channel;

    if (!text || !userId) return NextResponse.json({ ok: true });

    // Fire async — respond to Slack within 3s, process in background
    processSlackMessage(text, userId, channel, body.team_id).catch(err =>
      console.error("[Slack Webhook] Processing error:", err)
    );

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function processSlackMessage(
  text: string,
  slackUserId: string,
  channel: string,
  teamId: string,
): Promise<void> {
  const supabase = createAdminClient();

  // Find the org associated with this Slack workspace
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id")
    .eq("provider", "slack")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  if (!integration?.org_id) {
    console.warn("[Slack Webhook] No org found for Slack team:", teamId);
    return;
  }

  const orgId = integration.org_id;

  // Route to Pivvy for a response
  try {
    const { runBusinessAgent } = await import("@/lib/agent/business-agent");
    const result = await runBusinessAgent({
      orgId,
      messages: [],
      message: text,
    });

    const reply = result.message ?? "I couldn't process that. Try asking about your business data, revenue, or health score.";

    // Send reply back to Slack
    await sendSlackMessage(orgId, channel, reply);
  } catch (err) {
    console.error("[Slack Webhook] Pivvy error:", err);
    await sendSlackMessage(orgId, channel, "Sorry, I ran into an issue processing your request. Please try again.");
  }
}

async function sendSlackMessage(orgId: string, channel: string, text: string): Promise<void> {
  try {
    const { globalRegistry, createCostTracker } = await import("@/lib/execution/tools/index");
    await globalRegistry.execute("send_slack_message", {
      channel,
      message: text.slice(0, 3000), // Slack message limit
    }, {
      orgId,
      agentId: "pivvy",
      sessionId: "slack-bot",
      costTracker: createCostTracker(0.10),
    });
  } catch (err) {
    console.error("[Slack Webhook] Failed to send reply:", err);
  }
}
