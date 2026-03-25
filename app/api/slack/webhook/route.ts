/**
 * POST /api/slack/webhook
 *
 * Slack Events API + Slash Command handler.
 * Routes incoming Slack events to Pivvy with full conversation context.
 *
 * Supports:
 * - URL verification (Slack challenge)
 * - DM messages (multi-turn conversations tracked by thread_ts)
 * - App mention events (@Pivot in channels)
 * - Channel interaction mode (Pivvy responds as a team member)
 * - Slash commands: /pivot status, /pivot pipeline, /pivot tasks
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSlackUser, resolveOrgFromSlackTeam } from "@/lib/slack/user-mapping";
import {
  formatPivvyResponse,
  formatHealthSummary,
  formatPipelineSummary,
  formatTasksSummary,
  blocksToFallbackText,
  type SlackBlock,
} from "@/lib/slack/block-kit";

// Incremental processing — cheap per-message intelligence (ported from Ultron)
import { processMessageIncrementally } from "@/lib/slack/incremental-processor";

// Deduplicate events (Slack retries within 3s)
const recentEventIds = new Map<string, number>();
const EVENT_DEDUP_TTL_MS = 30_000;

function isDuplicate(eventId: string | undefined): boolean {
  if (!eventId) return false;
  const now = Date.now();
  // Clean old entries
  for (const [k, v] of recentEventIds) {
    if (now - v > EVENT_DEDUP_TTL_MS) recentEventIds.delete(k);
  }
  if (recentEventIds.has(eventId)) return true;
  recentEventIds.set(eventId, now);
  return false;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // Slash commands come as application/x-www-form-urlencoded
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return handleSlashCommand(req);
  }

  const body = await req.json();

  // Slack URL verification challenge
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  // Deduplicate
  if (isDuplicate(body.event_id)) {
    return NextResponse.json({ ok: true });
  }

  const event = body.event;
  if (!event) return NextResponse.json({ ok: true });

  // Ignore bot messages to prevent loops
  if (event.bot_id || event.subtype === "bot_message") {
    return NextResponse.json({ ok: true });
  }

  const teamId: string = body.team_id ?? "";

  // Route by event type
  if (event.type === "app_mention") {
    handleAppMention(event, teamId).catch(err =>
      console.error("[Slack Webhook] app_mention error:", err)
    );
    return NextResponse.json({ ok: true });
  }

  if (event.type === "message") {
    // DMs have channel_type "im"
    const isDM = event.channel_type === "im";
    if (isDM) {
      handleDirectMessage(event, teamId).catch(err =>
        console.error("[Slack Webhook] DM error:", err)
      );
    } else {
      // Channel message without @mention — check client interaction mode
      handleChannelMessage(event, teamId).catch(err =>
        console.error("[Slack Webhook] Channel message error:", err)
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// ── DM Handling ──────────────────────────────────────────────────────────────

async function handleDirectMessage(
  event: Record<string, any>,
  teamId: string,
): Promise<void> {
  const text = event.text?.trim();
  const slackUserId: string = event.user;
  const channel: string = event.channel;
  const threadTs: string | undefined = event.thread_ts ?? event.ts;

  if (!text || !slackUserId) return;

  // Resolve user to org
  const mapping = await resolveSlackUser(slackUserId, teamId);
  if (!mapping) {
    console.warn(`[Slack DM] No org mapping for user ${slackUserId} in team ${teamId}`);
    return;
  }

  const orgId = mapping.orgId;

  // Load conversation history from DB (last 5 messages in this thread)
  const history = await getConversationHistory(orgId, channel, threadTs);

  // Append current message to history
  const updatedHistory = [
    ...history,
    { role: "user" as const, content: text, ts: event.ts },
  ].slice(-10); // Keep last 10

  // Classify intent and route accordingly
  try {
    const { classifyIntent } = await import("@/lib/slack/intent-router");
    const intent = await classifyIntent(text);

    let reply: string = "";
    let blocks: SlackBlock[] | null = null;

    switch (intent.type) {
      case "bi_query": {
        const { answerBiQuery } = await import("@/lib/slack/bi-responder");
        blocks = await answerBiQuery(orgId, intent.section, intent.question);
        break;
      }
      case "agent_task": {
        await sendSlackText(orgId, channel, `:hourglass_flowing_sand: Running ${intent.agentId} agent: "${intent.taskTitle}"...`, threadTs);
        const { dispatchAgentTask } = await import("@/lib/slack/agent-dispatcher");
        blocks = await dispatchAgentTask(orgId, intent.agentId, intent.taskTitle, intent.taskDescription);
        break;
      }
      case "campaign": {
        const { handleCampaignCommand } = await import("@/lib/slack/agent-dispatcher");
        blocks = await handleCampaignCommand(orgId, intent.action, intent.templateId, intent.campaignId);
        break;
      }
      case "report": {
        const { answerBiQuery } = await import("@/lib/slack/bi-responder");
        blocks = await answerBiQuery(orgId, intent.section, "Show full report");
        break;
      }
      case "general":
      default: {
        const { runBusinessAgent } = await import("@/lib/agent/business-agent");
        const chatMessages = updatedHistory.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: parseFloat(m.ts) * 1000 || Date.now(),
        }));
        const result = await runBusinessAgent({
          orgId,
          messages: chatMessages.slice(0, -1),
          message: text,
        });
        reply = result.message ?? "I couldn't process that. Try asking about your business data.";
        blocks = formatPivvyResponse(reply);
      }
    }

    if (blocks && blocks.length > 0) {
      const fallback = blocksToFallbackText(blocks);
      await sendSlackBlocks(orgId, channel, blocks, fallback, threadTs);
    } else if (reply) {
      await sendSlackText(orgId, channel, reply, threadTs);
    }

    const replyText = blocks ? blocksToFallbackText(blocks) : reply;
    await saveConversation(orgId, channel, threadTs, slackUserId, [
      ...updatedHistory,
      { role: "assistant" as const, content: replyText, ts: String(Date.now() / 1000) },
    ]);

    runIncrementalProcessing(orgId, text, slackUserId, channel, event.ts, event.thread_ts).catch(() => {});
  } catch (err) {
    console.error("[Slack DM] Error:", err);
    await sendSlackText(orgId, channel, "Sorry, I ran into an issue. Please try again.", threadTs);
  }
}

// ── App Mention Handling ─────────────────────────────────────────────────────

async function handleAppMention(
  event: Record<string, any>,
  teamId: string,
): Promise<void> {
  const text = event.text?.replace(/<@[^>]+>/g, "").trim();
  const slackUserId: string = event.user;
  const channel: string = event.channel;
  const threadTs: string = event.thread_ts ?? event.ts;

  if (!text || !slackUserId) return;

  const orgId = await resolveOrgFromSlackTeam(teamId);
  if (!orgId) {
    console.warn(`[Slack Mention] No org for team ${teamId}`);
    return;
  }

  // Check if client interaction mode is enabled
  const settings = await getSlackBotSettings(orgId);

  // Load thread context if this is a thread reply
  const history = await getConversationHistory(orgId, channel, threadTs);
  const updatedHistory = [
    ...history,
    { role: "user" as const, content: text, ts: event.ts },
  ].slice(-10);

  try {
    const { classifyIntent } = await import("@/lib/slack/intent-router");
    const intent = await classifyIntent(text);

    let reply: string = "";
    let blocks: SlackBlock[] | null = null;

    switch (intent.type) {
      case "bi_query": {
        const { answerBiQuery } = await import("@/lib/slack/bi-responder");
        blocks = await answerBiQuery(orgId, intent.section, intent.question);
        break;
      }
      case "agent_task": {
        await sendSlackText(orgId, channel, `:hourglass_flowing_sand: Running ${intent.agentId} agent: "${intent.taskTitle}"...`, threadTs);
        const { dispatchAgentTask } = await import("@/lib/slack/agent-dispatcher");
        blocks = await dispatchAgentTask(orgId, intent.agentId, intent.taskTitle, intent.taskDescription);
        break;
      }
      case "campaign": {
        const { handleCampaignCommand } = await import("@/lib/slack/agent-dispatcher");
        blocks = await handleCampaignCommand(orgId, intent.action, intent.templateId, intent.campaignId);
        break;
      }
      case "report": {
        const { answerBiQuery } = await import("@/lib/slack/bi-responder");
        blocks = await answerBiQuery(orgId, intent.section, "Show full report");
        break;
      }
      case "general":
      default: {
        const { runBusinessAgent } = await import("@/lib/agent/business-agent");
        const chatMessages = updatedHistory.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: parseFloat(m.ts) * 1000 || Date.now(),
        }));
        const result = await runBusinessAgent({
          orgId,
          messages: chatMessages.slice(0, -1),
          message: text,
        });
        reply = result.message ?? "I couldn't process that. Try asking me about your business.";
        blocks = formatPivvyResponse(reply);
      }
    }

    if (blocks && blocks.length > 0) {
      const fallback = blocksToFallbackText(blocks);
      // Always reply in thread to avoid channel noise
      await sendSlackBlocks(orgId, channel, blocks, fallback, threadTs);
    } else if (reply) {
      await sendSlackText(orgId, channel, reply, threadTs);
    }

    const replyText = blocks ? blocksToFallbackText(blocks) : reply;
    // Save conversation context
    await saveConversation(orgId, channel, threadTs, slackUserId, [
      ...updatedHistory,
      { role: "assistant" as const, content: replyText, ts: String(Date.now() / 1000) },
    ]);
  } catch (err) {
    console.error("[Slack Mention] Error:", err);
    await sendSlackText(orgId, channel, "Sorry, I ran into an issue. Please try again.", threadTs);
  }
}

// ── Channel Message Handling (Client Interaction Mode) ───────────────────────
// Ported from Ultron's client-facing agent: uses a 2-step approach:
// 1. Cheap LLM call to decide "respond" or "silent" (avoids noisy false positives from regex)
// 2. If respond: run full Pivvy with context

async function handleChannelMessage(
  event: Record<string, any>,
  teamId: string,
): Promise<void> {
  // Only respond if client interaction mode is enabled
  const orgId = await resolveOrgFromSlackTeam(teamId);
  if (!orgId) return;

  const settings = await getSlackBotSettings(orgId);
  if (!settings?.client_interaction_enabled) return;

  // Check if this channel is in the monitored list
  const channel: string = event.channel;
  if (settings.monitored_channels.length > 0 && !settings.monitored_channels.includes(channel)) {
    return;
  }

  const text = event.text?.trim();
  const slackUserId: string = event.user;
  if (!text || !slackUserId) return;

  // Skip very short messages
  if (text.length < 10) return;

  const threadTs = event.thread_ts ?? event.ts;

  // Step 1: LLM-based respond/silent decision (ported from Ultron client-facing.ts)
  // This replaces the simple regex check with a smarter classifier.
  const shouldRespond = await shouldRespondToMessage(text);
  if (!shouldRespond) {
    // Still run incremental processing for learning, even when not responding
    runIncrementalProcessing(orgId, text, slackUserId, channel, event.ts, event.thread_ts).catch(() => {});
    return;
  }

  // Step 2: Load thread context and respond
  const history = await getConversationHistory(orgId, channel, threadTs);
  const updatedHistory = [
    ...history,
    { role: "user" as const, content: text, ts: event.ts },
  ].slice(-10);

  try {
    const { runBusinessAgent } = await import("@/lib/agent/business-agent");
    const chatMessages = updatedHistory.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: parseFloat(m.ts) * 1000 || Date.now(),
    }));

    const result = await runBusinessAgent({
      orgId,
      messages: chatMessages.slice(0, -1),
      message: `[A team member or client asked in Slack channel]: ${text}\n\nRespond helpfully as a knowledgeable team member. Be concise (2-4 sentences max). Do not reveal you are AI unless directly asked.`,
    });

    const reply = result.message;
    if (!reply) return;

    const blocks = formatPivvyResponse(reply);
    const fallback = blocksToFallbackText(blocks);

    // Always reply in thread
    await sendSlackBlocks(orgId, channel, blocks, fallback, threadTs);

    // Save conversation context
    await saveConversation(orgId, channel, threadTs, slackUserId, [
      ...updatedHistory,
      { role: "assistant" as const, content: reply, ts: String(Date.now() / 1000) },
    ]);

    // Run incremental processing in the background
    runIncrementalProcessing(orgId, text, slackUserId, channel, event.ts, event.thread_ts).catch(() => {});
  } catch (err) {
    console.error("[Slack Channel] Client interaction error:", err);
    // Silently fail in client interaction mode — don't spam the channel
  }
}

/**
 * LLM-based respond/silent decision (ported from Ultron's client-facing agent).
 * Cheap call (~50 tokens) to decide if this message warrants a response.
 * Much better than regex — handles context like "ok", "sounds good", sarcasm, etc.
 */
async function shouldRespondToMessage(text: string): Promise<boolean> {
  // Fast path: obvious non-responses
  const trivial = /^(ok|okay|k|sure|thanks|thx|ty|lol|haha|👍|🙏|✅|💯|yep|yup|yes|no|np|sounds good|got it|cool|nice)$/i;
  if (trivial.test(text.trim())) return false;

  // Fast path: obvious questions or requests
  if (text.includes('?')) return true;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback to regex if no API key
      return /how|what|when|where|why|can you|could you|help|issue|problem|update|status/i.test(text);
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Message: "${text.slice(0, 300)}"\n\nShould a project manager respond to this? Output ONLY "respond" or "silent".`,
      config: {
        temperature: 0,
        maxOutputTokens: 10,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: 'You decide if a message needs a response. Output ONLY "respond" or "silent". Respond if: they ask a question, describe a feature, express a concern, request an update, report a problem, or say something needing acknowledgment. Silent if: it is just "ok", "sounds good", "thanks", a thumbs up, internal chatter, or clearly does not need a response.',
      },
    });

    return (response.text ?? '').trim().toLowerCase().includes('respond');
  } catch {
    // Fallback to regex on LLM failure
    return /\?|how|what|when|where|why|can you|could you|help|issue|problem|update|status/i.test(text);
  }
}

// ── Slash Command Handler ────────────────────────────────────────────────────

async function handleSlashCommand(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const command = formData.get("command") as string;
  const text = (formData.get("text") as string ?? "").trim().toLowerCase();
  const teamId = formData.get("team_id") as string;
  const userId = formData.get("user_id") as string;
  const responseUrl = formData.get("response_url") as string;

  if (command !== "/pivot") {
    return NextResponse.json({ response_type: "ephemeral", text: "Unknown command." });
  }

  // Resolve org
  const orgId = await resolveOrgFromSlackTeam(teamId);
  if (!orgId) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Pivot is not connected to this Slack workspace. Connect Slack in your Pivot dashboard first.",
    });
  }

  // Process asynchronously for commands that take time, respond immediately
  if (text === "status" || text === "health") {
    processSlashStatus(orgId, responseUrl).catch(err =>
      console.error("[Slash] status error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: ":hourglass_flowing_sand: Pulling your business health summary...",
    });
  }

  if (text === "pipeline" || text === "deals" || text === "crm") {
    processSlashPipeline(orgId, responseUrl).catch(err =>
      console.error("[Slash] pipeline error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: ":hourglass_flowing_sand: Loading pipeline data...",
    });
  }

  if (text === "tasks" || text === "tickets") {
    processSlashTasks(orgId, responseUrl).catch(err =>
      console.error("[Slash] tasks error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: ":hourglass_flowing_sand: Counting open tickets...",
    });
  }

  if (text === "report") {
    processSlashReport(orgId, responseUrl).catch(err =>
      console.error("[Slash] report error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: ":hourglass_flowing_sand: Loading your executive report...",
    });
  }

  if (text.startsWith("ask ") && text.length > 4) {
    const question = text.slice(4).trim();
    processSlashAsk(orgId, question, responseUrl).catch(err =>
      console.error("[Slash] ask error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: `:hourglass_flowing_sand: Looking into "${question}"...`,
    });
  }

  if (text === "briefing" || text === "digest" || text === "morning") {
    processSlashBriefing(orgId, responseUrl).catch(err =>
      console.error("[Slash] briefing error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: ":sparkles: Generating your daily briefing...",
    });
  }

  if (text === "campaigns") {
    processSlashCampaigns(orgId, responseUrl).catch(err =>
      console.error("[Slash] campaigns error:", err)
    );
    return NextResponse.json({
      response_type: "ephemeral",
      text: ":hourglass_flowing_sand: Loading campaigns...",
    });
  }

  if (text === "agents") {
    return NextResponse.json({
      response_type: "ephemeral",
      blocks: [
        { type: "header", text: { type: "plain_text", text: "Pivot Agents", emoji: true } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*Available agents — ask me to run any of these:*",
              "",
              ":bar_chart: *strategist* — Business strategy, competitive analysis, OKRs",
              ":loudspeaker: *marketer* — Content creation, campaigns, social posts",
              ":mag: *analyst* — Data analysis, financial modeling, reports",
              ":busts_in_silhouette: *recruiter* — Job descriptions, candidate outreach, HR tasks",
              ":gear: *operator* — Process optimization, documentation, SOPs",
              ":earth_americas: *researcher* — Market research, industry trends, deep dives",
              ":computer: *codebot* — Code reviews, GitHub issues, technical tasks",
            ].join("\n"),
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: '_Example: "Run the marketer agent to write a LinkedIn post about our new feature"_',
          },
        },
      ],
    });
  }

  // Default: show help
  return NextResponse.json({
    response_type: "ephemeral",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Pivot Commands", emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: "*Available commands:*" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "`/pivot status` - Business health summary (score, runway, risks)",
            "`/pivot pipeline` - CRM pipeline overview (stages, values, win rate)",
            "`/pivot tasks` - Open tickets count by status",
            "`/pivot report` - Full executive summary report",
            "`/pivot ask [question]` - Ask anything about your business data",
            "`/pivot campaigns` - List active marketing campaigns",
            "`/pivot briefing` - Get your personalized daily AI briefing",
            "`/pivot agents` - Show all 8 available AI agents",
            "",
            "You can also DM me directly or @mention me in any channel!",
          ].join("\n"),
        },
      },
    ],
  });
}

// ── Slash Command Processors ─────────────────────────────────────────────────

async function processSlashStatus(orgId: string, responseUrl: string): Promise<void> {
  try {
    const { getAgentMemory } = await import("@/lib/agent/memory");
    const memory = await getAgentMemory(orgId);

    if (!memory) {
      await sendSlashResponse(responseUrl, {
        response_type: "ephemeral",
        text: "No analysis completed yet. Run a full business analysis in Pivot first.",
      });
      return;
    }

    const blocks = formatHealthSummary({
      orgName: memory.orgName,
      healthScore: memory.keyNumbers.healthScore ?? 0,
      healthGrade: memory.keyNumbers.healthGrade ?? "?",
      cashRunway: memory.keyNumbers.cashRunway ?? 0,
      revenueAtRisk: memory.keyNumbers.revenueAtRisk ?? 0,
      totalLeaks: memory.keyNumbers.totalLeaks ?? 0,
    });

    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Status] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to load business status. Please try again.",
    });
  }
}

async function processSlashPipeline(orgId: string, responseUrl: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: contacts } = await supabase
      .from("crm_contacts")
      .select("stage, deal_value, name")
      .eq("org_id", orgId);

    if (!contacts || contacts.length === 0) {
      await sendSlashResponse(responseUrl, {
        response_type: "ephemeral",
        text: "Pipeline is empty. No CRM contacts found.",
      });
      return;
    }

    const stageMap: Record<string, { count: number; value: number }> = {};
    let totalValue = 0;

    for (const c of contacts) {
      const s = c.stage ?? "lead";
      if (!stageMap[s]) stageMap[s] = { count: 0, value: 0 };
      stageMap[s].count++;
      const val = Number(c.deal_value ?? 0);
      stageMap[s].value += val;
      totalValue += val;
    }

    const order = ["lead", "prospect", "qualified", "proposal", "negotiation", "won", "lost", "churned", "active"];
    const stages = order
      .filter(s => stageMap[s])
      .map(s => ({
        name: s.charAt(0).toUpperCase() + s.slice(1),
        count: stageMap[s].count,
        value: stageMap[s].value,
      }));

    const wonCount = stageMap["won"]?.count ?? 0;
    const lostCount = stageMap["lost"]?.count ?? 0;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    const blocks = formatPipelineSummary(stages, totalValue, winRate);

    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Pipeline] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to load pipeline data. Please try again.",
    });
  }
}

async function processSlashTasks(orgId: string, responseUrl: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: tickets } = await supabase
      .from("pm_tickets")
      .select("status")
      .eq("org_id", orgId)
      .in("status", ["backlog", "todo", "in_progress", "review"]);

    const statusCounts: Record<string, number> = {};
    let totalOpen = 0;

    if (tickets) {
      for (const t of tickets) {
        const s = t.status ?? "backlog";
        statusCounts[s] = (statusCounts[s] ?? 0) + 1;
        totalOpen++;
      }
    }

    const order = ["in_progress", "review", "todo", "backlog"];
    const tasks = order.map(s => ({
      status: s,
      count: statusCounts[s] ?? 0,
    }));

    const blocks = formatTasksSummary(tasks, totalOpen);

    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Tasks] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to load task data. Please try again.",
    });
  }
}

async function processSlashReport(orgId: string, responseUrl: string): Promise<void> {
  try {
    const { answerBiQuery } = await import("@/lib/slack/bi-responder");
    const blocks = await answerBiQuery(orgId, "executiveSummary", "Show full report");
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Report] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to load report. Please try again.",
    });
  }
}

async function processSlashAsk(orgId: string, question: string, responseUrl: string): Promise<void> {
  try {
    const { classifyIntent } = await import("@/lib/slack/intent-router");
    const intent = await classifyIntent(question);

    let blocks: SlackBlock[];

    if (intent.type === "bi_query" || intent.type === "report") {
      const { answerBiQuery } = await import("@/lib/slack/bi-responder");
      const section = intent.type === "report" ? intent.section : intent.section;
      const q = intent.type === "report" ? "Show full report" : intent.question;
      blocks = await answerBiQuery(orgId, section, q);
    } else {
      // Fall back to Pivvy for general questions
      const { runBusinessAgent } = await import("@/lib/agent/business-agent");
      const result = await runBusinessAgent({ orgId, messages: [], message: question });
      const reply = result.message ?? "I couldn't find an answer. Try asking in more detail.";
      blocks = formatPivvyResponse(reply);
    }

    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Ask] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to answer your question. Please try again.",
    });
  }
}

async function processSlashCampaigns(orgId: string, responseUrl: string): Promise<void> {
  try {
    const { handleCampaignCommand } = await import("@/lib/slack/agent-dispatcher");
    const blocks = await handleCampaignCommand(orgId, "list");
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Campaigns] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to load campaigns. Please try again.",
    });
  }
}

async function processSlashBriefing(orgId: string, responseUrl: string): Promise<void> {
  try {
    const { generateDailyBriefing } = await import("@/lib/briefing/daily-digest");
    const briefing = await generateDailyBriefing(orgId);

    const blocks: SlackBlock[] = [
      { type: "header", text: { type: "plain_text", text: ":sparkles: Daily Briefing", emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: `*${briefing.greeting}*\n${briefing.summary}` } },
    ];

    for (const section of briefing.sections) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${section.icon} *${section.title}*\n${section.content}`,
        },
      });
    }

    if (briefing.actionItems.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Action Items:*\n${briefing.actionItems.map(a => `- [ ] ${a}`).join("\n")}`,
        },
      });
    }

    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error("[Slash Briefing] Error:", err);
    await sendSlashResponse(responseUrl, {
      response_type: "ephemeral",
      text: "Failed to generate briefing. Please try again.",
    });
  }
}

// ── Incremental Processing (ported from Ultron incremental-processor.ts) ─────
// Runs on every message, even when Pivvy doesn't respond. Cheap ~$0.001 per msg.

async function runIncrementalProcessing(
  orgId: string,
  text: string,
  slackUserId: string,
  channel: string,
  messageTs?: string,
  threadTs?: string,
  channelName?: string,
): Promise<void> {
  try {
    const result = await processMessageIncrementally(orgId, {
      content: text,
      author: slackUserId,
      channel,
    });

    if (result.factsLearned.length > 0) {
      console.log(`[Slack Incremental] Learned ${result.factsLearned.length} facts from ${slackUserId}`);
    }
    if (result.ticketUpdates.length > 0) {
      console.log(`[Slack Incremental] Updated ${result.ticketUpdates.length} tickets`);
    }
    if (result.shouldTriggerFullAnalysis) {
      console.log(`[Slack Incremental] Full analysis recommended for org ${orgId}`);
    }
  } catch (err) {
    console.warn("[Slack Incremental] Background processing failed:", err instanceof Error ? err.message : err);
  }

  // Embed message for Slack RAG (async, non-blocking)
  if (messageTs && text && text.length >= 10) {
    try {
      const { embedNewWebhookMessage } = await import("@/lib/slack/slack-rag");
      await embedNewWebhookMessage(orgId, {
        text,
        user: slackUserId,
        channel,
        ts: messageTs,
        thread_ts: threadTs,
        channelName,
      });
    } catch (err) {
      console.warn("[Slack RAG] Embed failed:", err instanceof Error ? err.message : err);
    }
  }
}

// ── Conversation History ─────────────────────────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

async function getConversationHistory(
  orgId: string,
  channel: string,
  threadTs: string | undefined,
): Promise<ConversationMessage[]> {
  const supabase = createAdminClient();

  const query = supabase
    .from("slack_bot_conversations")
    .select("messages")
    .eq("org_id", orgId)
    .eq("slack_channel_id", channel);

  if (threadTs) {
    query.eq("slack_thread_ts", threadTs);
  }

  const { data } = await query.order("last_message_at", { ascending: false }).limit(1).maybeSingle();

  if (!data?.messages) return [];

  const messages = Array.isArray(data.messages) ? data.messages : [];
  // Return last 5 for context
  return messages.slice(-5) as ConversationMessage[];
}

async function saveConversation(
  orgId: string,
  channel: string,
  threadTs: string | undefined,
  slackUserId: string,
  messages: ConversationMessage[],
): Promise<void> {
  const supabase = createAdminClient();

  // Keep last 20 messages per thread
  const trimmed = messages.slice(-20);

  // Upsert by channel + thread
  const { data: existing } = await supabase
    .from("slack_bot_conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("slack_channel_id", channel)
    .eq("slack_thread_ts", threadTs ?? "")
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("slack_bot_conversations")
      .update({
        messages: trimmed,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("slack_bot_conversations")
      .insert({
        org_id: orgId,
        slack_channel_id: channel,
        slack_thread_ts: threadTs ?? null,
        slack_user_id: slackUserId,
        messages: trimmed,
        last_message_at: new Date().toISOString(),
      });
  }
}

// ── Slack Bot Settings ───────────────────────────────────────────────────────

interface SlackBotSettings {
  client_interaction_enabled: boolean;
  monitored_channels: string[];
  auto_ingest_enabled: boolean;
  response_style: string;
}

async function getSlackBotSettings(orgId: string): Promise<SlackBotSettings | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("slack_bot_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data) return null;

  return {
    client_interaction_enabled: data.client_interaction_enabled ?? false,
    monitored_channels: data.monitored_channels ?? [],
    auto_ingest_enabled: data.auto_ingest_enabled ?? false,
    response_style: data.response_style ?? "professional",
  };
}

// ── Slack Messaging ──────────────────────────────────────────────────────────

async function sendSlackBlocks(
  orgId: string,
  channel: string,
  blocks: SlackBlock[],
  fallbackText: string,
  threadTs?: string,
): Promise<void> {
  // Try direct Slack API first (faster, no Composio overhead)
  const token = process.env.SLACK_APP_TOKEN;
  if (token) {
    try {
      const resp = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          blocks,
          text: fallbackText.slice(0, 3000),
          ...(threadTs ? { thread_ts: threadTs } : {}),
        }),
      });
      const data = await resp.json();
      if (data.ok) return;
      console.warn("[Slack] Direct API failed:", data.error);
    } catch (err) {
      console.warn("[Slack] Direct API error:", err);
    }
  }

  // Fallback to Composio (sends plain text only)
  await sendSlackText(orgId, channel, fallbackText, threadTs);
}

async function sendSlackText(
  orgId: string,
  channel: string,
  text: string,
  threadTs?: string,
): Promise<void> {
  // Try direct token first
  const token = process.env.SLACK_APP_TOKEN;
  if (token) {
    try {
      const resp = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          text: text.slice(0, 3000),
          ...(threadTs ? { thread_ts: threadTs } : {}),
        }),
      });
      const data = await resp.json();
      if (data.ok) return;
    } catch { /* fall through */ }
  }

  // Composio fallback
  try {
    const { globalRegistry, createCostTracker } = await import("@/lib/execution/tools/index");
    await globalRegistry.execute("send_slack_message", {
      channel,
      message: text.slice(0, 3000),
      ...(threadTs ? { thread_ts: threadTs } : {}),
    }, {
      orgId,
      agentId: "pivvy",
      sessionId: "slack-bot",
      costTracker: createCostTracker(0.10),
    });
  } catch (err) {
    console.error("[Slack] Failed to send message:", err);
  }
}

async function sendSlashResponse(
  responseUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[Slack] Failed to send slash response:", err);
  }
}
