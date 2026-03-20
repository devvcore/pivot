/**
 * POST /api/slack/ingest
 *
 * Triggers full Slack history ingestion for an org.
 * Pulls channel history via Composio, extracts contacts and activities,
 * and updates the CRM with Slack interaction data.
 *
 * Body: { orgId: string, channels?: string[] }
 *
 * - If channels is provided, only ingests those channels
 * - Otherwise, ingests all channels the bot has access to
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSlackUsers } from "@/lib/slack/user-mapping";

interface IngestRequest {
  orgId: string;
  channels?: string[];
}

interface IngestResult {
  channelsProcessed: number;
  messagesProcessed: number;
  contactsCreated: number;
  contactsUpdated: number;
  activitiesCreated: number;
  errors: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IngestRequest;
    const { orgId, channels } = body;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Verify Slack is connected
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from("integrations")
      .select("status, metadata")
      .eq("org_id", orgId)
      .eq("provider", "slack")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration) {
      return NextResponse.json(
        { error: "Slack is not connected for this org" },
        { status: 400 },
      );
    }

    const teamId = (integration.metadata as Record<string, string>)?.team_id ?? "";

    // Sync users first
    const usersSynced = await syncSlackUsers(orgId, teamId);
    console.log(`[Slack Ingest] Synced ${usersSynced} users for org ${orgId}`);

    // Run ingestion in background-ish (still awaited for API response)
    const result = await ingestSlackHistory(orgId, teamId, channels);

    return NextResponse.json({
      success: true,
      usersSynced,
      ...result,
    });
  } catch (err) {
    console.error("[Slack Ingest] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ── Ingestion Logic ──────────────────────────────────────────────────────────

async function ingestSlackHistory(
  orgId: string,
  teamId: string,
  targetChannels?: string[],
): Promise<IngestResult> {
  const result: IngestResult = {
    channelsProcessed: 0,
    messagesProcessed: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    activitiesCreated: 0,
    errors: [],
  };

  const supabase = createAdminClient();

  // Get channel list
  let channelIds: string[] = [];
  if (targetChannels && targetChannels.length > 0) {
    channelIds = targetChannels;
  } else {
    try {
      const { getSlackChannels } = await import("@/lib/integrations/composio-tools");
      const channelResult = await getSlackChannels(orgId);
      const channels = channelResult?.data?.channels ?? channelResult?.channels ?? channelResult?.data ?? [];

      if (Array.isArray(channels)) {
        channelIds = channels
          .filter((ch: any) => ch.is_member && !ch.is_archived)
          .map((ch: any) => ch.id)
          .slice(0, 20); // Limit to 20 channels
      }
    } catch (err) {
      result.errors.push(`Failed to list channels: ${err instanceof Error ? err.message : String(err)}`);
      return result;
    }
  }

  if (channelIds.length === 0) {
    result.errors.push("No accessible channels found");
    return result;
  }

  // Process channels in batches of 3
  for (let i = 0; i < channelIds.length; i += 3) {
    const batch = channelIds.slice(i, i + 3);
    const batchResults = await Promise.allSettled(
      batch.map(chId => processChannel(orgId, teamId, chId, supabase)),
    );

    for (const batchResult of batchResults) {
      if (batchResult.status === "fulfilled") {
        const r = batchResult.value;
        result.channelsProcessed++;
        result.messagesProcessed += r.messagesProcessed;
        result.contactsCreated += r.contactsCreated;
        result.contactsUpdated += r.contactsUpdated;
        result.activitiesCreated += r.activitiesCreated;
      } else {
        result.errors.push(String(batchResult.reason));
      }
    }
  }

  return result;
}

async function processChannel(
  orgId: string,
  teamId: string,
  channelId: string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Omit<IngestResult, "channelsProcessed" | "errors">> {
  const counts = {
    messagesProcessed: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    activitiesCreated: 0,
  };

  const { getSlackChannelHistory } = await import("@/lib/integrations/composio-tools");

  // Pull last 200 messages (Composio limit)
  const historyResult = await getSlackChannelHistory(orgId, channelId, 200);
  const messages = historyResult?.data?.messages ?? historyResult?.messages ?? historyResult?.data ?? [];

  if (!Array.isArray(messages)) return counts;

  // Load user mappings for this team
  const { data: userMappings } = await supabase
    .from("slack_user_mappings")
    .select("slack_user_id, slack_display_name, email")
    .eq("slack_team_id", teamId);

  const userMap = new Map<string, { name: string; email: string | null }>();
  if (userMappings) {
    for (const m of userMappings) {
      userMap.set(m.slack_user_id, {
        name: m.slack_display_name ?? m.slack_user_id,
        email: m.email,
      });
    }
  }

  // Process messages for CRM enrichment
  for (const msg of messages) {
    if (!msg.user || msg.subtype === "bot_message") continue;
    counts.messagesProcessed++;

    const sender = userMap.get(msg.user);
    if (!sender?.email) continue;

    const messageText = String(msg.text ?? "").slice(0, 500);
    if (!messageText) continue;

    // Find or create CRM contact
    const { data: existingContact } = await supabase
      .from("crm_contacts")
      .select("id, last_contacted_at")
      .eq("org_id", orgId)
      .eq("email", sender.email)
      .maybeSingle();

    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id;
      // Update last activity
      const msgDate = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : new Date().toISOString();
      const currentLast = existingContact.last_contacted_at;
      if (!currentLast || new Date(msgDate) > new Date(currentLast)) {
        await supabase
          .from("crm_contacts")
          .update({
            last_contacted_at: msgDate,
            last_activity: `Slack: ${messageText.slice(0, 100)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contactId);
        counts.contactsUpdated++;
      }
    } else {
      // Create new contact from Slack user
      const { data: newContact } = await supabase
        .from("crm_contacts")
        .insert({
          org_id: orgId,
          name: sender.name,
          email: sender.email,
          source: "slack",
          source_id: msg.user,
          stage: "active",
          last_contacted_at: msg.ts
            ? new Date(parseFloat(msg.ts) * 1000).toISOString()
            : new Date().toISOString(),
          last_activity: `Slack: ${messageText.slice(0, 100)}`,
        })
        .select("id")
        .single();

      if (!newContact) continue;
      contactId = newContact.id;
      counts.contactsCreated++;
    }

    // Create CRM activity
    const msgTimestamp = msg.ts
      ? new Date(parseFloat(msg.ts) * 1000).toISOString()
      : new Date().toISOString();

    await supabase.from("crm_activities").insert({
      org_id: orgId,
      contact_id: contactId,
      type: "slack_message",
      title: `Slack message in #${channelId}`,
      description: messageText,
      channel: "slack",
      automated: true,
      agent_id: "slack-ingest",
      created_at: msgTimestamp,
    });
    counts.activitiesCreated++;
  }

  return counts;
}
