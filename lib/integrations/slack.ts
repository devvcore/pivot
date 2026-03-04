// ================================================================
// Pivot -- Slack Integration
// Fetches messages/users from Slack API and analyzes communication
// patterns using Gemini AI.
// ================================================================

import { GoogleGenAI } from "@google/genai";
import type { CommunicationInsight, Integration, SyncResult } from "@/lib/integrations/types";
import { saveCommunicationInsight } from "@/lib/integrations/store";

// ── Slack-specific Types ────────────────────────────────────────

export interface SlackMessage {
  channelName: string;
  channelId: string;
  channelType: "public_channel" | "private_channel" | "im" | "mpim";
  senderName: string;
  senderEmail: string | null;
  senderId: string;
  text: string;
  timestamp: string; // Slack ts format
  reactions: { name: string; count: number }[];
  threadReplyCount: number;
  isThreadReply: boolean;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email: string | null;
  title: string | null;
  isAdmin: boolean;
  isBot: boolean;
  timezone: string | null;
}

interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  num_members: number;
}

// ── Constants ───────────────────────────────────────────────────

const SLACK_API_BASE = "https://slack.com/api";

const BUSINESS_KEYWORDS = [
  "project", "client", "sprint", "deadline", "revenue", "budget",
  "deploy", "release", "incident", "bug", "feature", "roadmap",
  "meeting", "standup", "review", "planning", "retro", "demo",
  "onboard", "hire", "goal", "okr", "kpi", "metric", "sales",
  "pipeline", "customer", "support", "escalation", "priority",
  "blocker", "critical", "urgent", "status", "update", "report",
];

const CHITCHAT_CHANNELS = ["general", "random", "watercooler", "social", "fun", "off-topic"];

// ── Helpers ─────────────────────────────────────────────────────

async function slackFetch<T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${SLACK_API_BASE}/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Slack API ${endpoint} returned ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as any;
  if (!json.ok) {
    throw new Error(`Slack API ${endpoint} error: ${json.error ?? "unknown"}`);
  }
  return json as T;
}

function channelType(ch: any): SlackMessage["channelType"] {
  if (ch.is_im) return "im";
  if (ch.is_mpim) return "mpim";
  if (ch.is_group || ch.is_private) return "private_channel";
  return "public_channel";
}

// ── Fetch Slack Users ───────────────────────────────────────────

export async function fetchSlackUsers(accessToken: string): Promise<SlackUser[]> {
  const users: SlackUser[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = { limit: "200" };
    if (cursor) params.cursor = cursor;

    const resp = await slackFetch<any>("users.list", accessToken, params);

    for (const m of resp.members ?? []) {
      if (m.deleted) continue;
      users.push({
        id: m.id,
        name: m.name,
        realName: m.real_name ?? m.name,
        email: m.profile?.email ?? null,
        title: m.profile?.title ?? null,
        isAdmin: m.is_admin ?? false,
        isBot: m.is_bot ?? false,
        timezone: m.tz ?? null,
      });
    }

    cursor = resp.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return users;
}

// ── Fetch Slack Messages ────────────────────────────────────────

export async function fetchSlackMessages(
  accessToken: string,
  options?: {
    channelTypes?: string;
    daysBack?: number;
    limit?: number;
  },
): Promise<SlackMessage[]> {
  const channelTypes = options?.channelTypes ?? "public_channel,private_channel,im,mpim";
  const daysBack = options?.daysBack ?? 30;
  const perChannelLimit = options?.limit ?? 200;

  const oldest = String(Math.floor((Date.now() - daysBack * 86_400_000) / 1000));

  // 1. Fetch user map for ID -> name/email resolution
  const userList = await fetchSlackUsers(accessToken);
  const userMap = new Map(userList.map((u) => [u.id, u]));

  // 2. Get all channels (paginated)
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      types: channelTypes,
      limit: "200",
      exclude_archived: "true",
    };
    if (cursor) params.cursor = cursor;

    const resp = await slackFetch<any>("conversations.list", accessToken, params);

    for (const ch of resp.channels ?? []) {
      channels.push({
        id: ch.id,
        name: ch.name ?? `dm-${ch.id}`,
        is_channel: ch.is_channel ?? false,
        is_group: ch.is_group ?? false,
        is_im: ch.is_im ?? false,
        is_mpim: ch.is_mpim ?? false,
        num_members: ch.num_members ?? 0,
      });
    }

    cursor = resp.response_metadata?.next_cursor || undefined;
  } while (cursor);

  // 3. For each channel, fetch message history
  const messages: SlackMessage[] = [];

  for (const ch of channels) {
    try {
      let msgCursor: string | undefined;
      let fetched = 0;

      do {
        const params: Record<string, string> = {
          channel: ch.id,
          oldest,
          limit: String(Math.min(perChannelLimit - fetched, 200)),
        };
        if (msgCursor) params.cursor = msgCursor;

        const resp = await slackFetch<any>(
          "conversations.history",
          accessToken,
          params,
        );

        for (const msg of resp.messages ?? []) {
          // Skip bot and system messages
          if (msg.subtype && msg.subtype !== "thread_broadcast") continue;
          if (msg.bot_id) continue;

          const sender = userMap.get(msg.user);
          if (sender?.isBot) continue;

          messages.push({
            channelName: ch.name,
            channelId: ch.id,
            channelType: channelType(ch),
            senderName: sender?.realName ?? sender?.name ?? msg.user ?? "Unknown",
            senderEmail: sender?.email ?? null,
            senderId: msg.user ?? "",
            text: msg.text ?? "",
            timestamp: msg.ts,
            reactions: (msg.reactions ?? []).map((r: any) => ({
              name: r.name,
              count: r.count,
            })),
            threadReplyCount: msg.reply_count ?? 0,
            isThreadReply: !!msg.thread_ts && msg.thread_ts !== msg.ts,
          });

          fetched++;
        }

        msgCursor = resp.response_metadata?.next_cursor || undefined;
      } while (msgCursor && fetched < perChannelLimit);
    } catch (err) {
      // Skip channels we can't access (e.g., not a member)
      console.warn(`[slack] Could not fetch history for #${ch.name}: ${err}`);
    }
  }

  return messages;
}

// ── Smart Token Filtering ───────────────────────────────────────

function filterMessagesForAI(messages: SlackMessage[]): SlackMessage[] {
  const MAX_CHARS = 50_000;

  // Step 1: Drop very short messages (reactions-only, "ok", "thanks", etc.)
  let filtered = messages.filter((m) => {
    const words = m.text.trim().split(/\s+/);
    return words.length >= 5;
  });

  // Step 2: Skip chitchat channels entirely
  filtered = filtered.filter(
    (m) => !CHITCHAT_CHANNELS.some((cc) => m.channelName.toLowerCase().includes(cc)),
  );

  // Step 3: Prioritize business-relevant channels
  const isBusinessChannel = (name: string) =>
    BUSINESS_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));

  const businessMsgs = filtered.filter((m) => isBusinessChannel(m.channelName));
  const otherMsgs = filtered.filter((m) => !isBusinessChannel(m.channelName));

  // Step 4: Group by sender, keep representative samples
  function sampleBySender(msgs: SlackMessage[], maxPerSender: number): SlackMessage[] {
    const bySender = new Map<string, SlackMessage[]>();
    for (const m of msgs) {
      const key = m.senderName;
      if (!bySender.has(key)) bySender.set(key, []);
      bySender.get(key)!.push(m);
    }

    const sampled: SlackMessage[] = [];
    for (const [, senderMsgs] of bySender) {
      // Sort by thread replies + reactions to keep most "interesting" messages
      senderMsgs.sort(
        (a, b) =>
          b.threadReplyCount + b.reactions.length -
          (a.threadReplyCount + a.reactions.length),
      );
      sampled.push(...senderMsgs.slice(0, maxPerSender));
    }
    return sampled;
  }

  const sampledBusiness = sampleBySender(businessMsgs, 15);
  const sampledOther = sampleBySender(otherMsgs, 8);

  // Step 5: Combine and cap total characters
  const combined = [...sampledBusiness, ...sampledOther];
  combined.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));

  const result: SlackMessage[] = [];
  let totalChars = 0;

  for (const msg of combined) {
    const msgStr = `[${msg.channelName}] ${msg.senderName}: ${msg.text}`;
    if (totalChars + msgStr.length > MAX_CHARS) break;
    totalChars += msgStr.length;
    result.push(msg);
  }

  return result;
}

// ── AI-Powered Communication Analysis ───────────────────────────

export async function analyzeSlackCommunication(
  messages: SlackMessage[],
  users: SlackUser[],
  orgContext: string,
): Promise<CommunicationInsight[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Smart filter messages before sending to AI
  const filtered = filterMessagesForAI(messages);

  if (filtered.length === 0) {
    return [];
  }

  // Build a compact representation for the AI
  const messageLines = filtered.map((m) => {
    const ts = new Date(parseFloat(m.timestamp) * 1000).toISOString();
    const reactions = m.reactions.length > 0
      ? ` [reactions: ${m.reactions.map((r) => `${r.name}(${r.count})`).join(",")}]`
      : "";
    const thread = m.threadReplyCount > 0 ? ` [${m.threadReplyCount} replies]` : "";
    return `[${ts}] #${m.channelName} | ${m.senderName}: ${m.text}${reactions}${thread}`;
  });

  const userSummary = users
    .filter((u) => !u.isBot)
    .map((u) => `${u.realName} (${u.email ?? "no email"}) - ${u.title ?? "no title"}`)
    .join("\n");

  const prompt = `You are an expert organizational psychologist and communication analyst.

ORGANIZATION: ${orgContext}

TEAM MEMBERS:
${userSummary}

SLACK MESSAGES (${filtered.length} messages from ${messages.length} total):
${messageLines.join("\n")}

Analyze these Slack messages and produce insights. Return a JSON object with these keys:

{
  "relationship_scores": [
    {
      "person1": "Name1",
      "person2": "Name2",
      "score": 0-100,
      "frequency": "high|medium|low",
      "sentiment": "positive|neutral|negative",
      "context": "brief description of relationship dynamic"
    }
  ],
  "response_times": [
    {
      "personName": "Name",
      "avgResponseMinutes": number,
      "fastestMinutes": number,
      "slowestMinutes": number,
      "rating": "excellent|good|average|slow|unresponsive"
    }
  ],
  "meeting_attendance": [
    {
      "personName": "Name",
      "standupPresenceRate": 0-100,
      "threadParticipationRate": 0-100,
      "observation": "text"
    }
  ],
  "bottlenecks": [
    {
      "personName": "Name",
      "type": "slow_response|single_point_of_failure|overloaded|blocking",
      "severity": "high|medium|low",
      "evidence": "specific example from messages",
      "recommendation": "actionable suggestion"
    }
  ],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "overallScore": 0-100,
    "perPerson": [
      {
        "personName": "Name",
        "sentiment": "positive|neutral|negative",
        "score": 0-100,
        "topEmotions": ["frustrated", "motivated", etc]
      }
    ]
  },
  "engagement": [
    {
      "personName": "Name",
      "messageFrequency": "high|medium|low",
      "reactionFrequency": "high|medium|low",
      "threadParticipation": "high|medium|low",
      "overallEngagement": "highly_engaged|engaged|moderate|disengaged|silent",
      "engagementScore": 0-100
    }
  ],
  "risk_flags": [
    {
      "type": "favoritism|clique|exclusion|toxicity|burnout|flight_risk|conflict",
      "severity": "critical|high|medium|low",
      "involvedPeople": ["Name1", "Name2"],
      "evidence": "specific pattern observed",
      "recommendation": "actionable suggestion"
    }
  ]
}

Be thorough but realistic. Only flag risks you have genuine evidence for. Base all analysis on actual message content, timing, and patterns. If there is not enough data for a category, return an empty array.`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = result.text ?? "";
  let analysis: any;
  try {
    analysis = JSON.parse(text);
  } catch {
    console.error("[slack] Failed to parse Gemini response:", text.slice(0, 500));
    return [];
  }

  // Convert AI output into CommunicationInsight records
  const now = new Date().toISOString();
  const periodStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const insights: CommunicationInsight[] = [];

  // Relationship scores
  if (Array.isArray(analysis.relationship_scores)) {
    for (const rs of analysis.relationship_scores) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "slack",
        insightType: "relationship_score",
        subjectName: `${rs.person1} <-> ${rs.person2}`,
        data: {
          person1: rs.person1,
          person2: rs.person2,
          score: rs.score,
          frequency: rs.frequency,
          sentiment: rs.sentiment,
          context: rs.context,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Response times
  if (Array.isArray(analysis.response_times)) {
    for (const rt of analysis.response_times) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "slack",
        insightType: "response_time",
        subjectName: rt.personName,
        data: {
          avgResponseMinutes: rt.avgResponseMinutes,
          fastestMinutes: rt.fastestMinutes,
          slowestMinutes: rt.slowestMinutes,
          rating: rt.rating,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Meeting attendance
  if (Array.isArray(analysis.meeting_attendance)) {
    for (const ma of analysis.meeting_attendance) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "slack",
        insightType: "meeting_attendance",
        subjectName: ma.personName,
        data: {
          standupPresenceRate: ma.standupPresenceRate,
          threadParticipationRate: ma.threadParticipationRate,
          observation: ma.observation,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Bottlenecks
  if (Array.isArray(analysis.bottlenecks)) {
    for (const bn of analysis.bottlenecks) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "slack",
        insightType: "bottleneck",
        subjectName: bn.personName,
        data: {
          type: bn.type,
          severity: bn.severity,
          evidence: bn.evidence,
          recommendation: bn.recommendation,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Sentiment
  if (analysis.sentiment) {
    insights.push({
      id: crypto.randomUUID(),
      orgId: "",
      jobId: null,
      source: "slack",
      insightType: "sentiment",
      subjectName: null,
      data: {
        overall: analysis.sentiment.overall,
        overallScore: analysis.sentiment.overallScore,
        perPerson: analysis.sentiment.perPerson ?? [],
      },
      periodStart,
      periodEnd: now,
      createdAt: now,
    });
  }

  // Engagement
  if (Array.isArray(analysis.engagement)) {
    for (const eng of analysis.engagement) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "slack",
        insightType: "engagement",
        subjectName: eng.personName,
        data: {
          messageFrequency: eng.messageFrequency,
          reactionFrequency: eng.reactionFrequency,
          threadParticipation: eng.threadParticipation,
          overallEngagement: eng.overallEngagement,
          engagementScore: eng.engagementScore,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Risk flags
  if (Array.isArray(analysis.risk_flags)) {
    for (const rf of analysis.risk_flags) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "slack",
        insightType: "risk_flag",
        subjectName: rf.involvedPeople?.join(", ") ?? null,
        data: {
          type: rf.type,
          severity: rf.severity,
          involvedPeople: rf.involvedPeople,
          evidence: rf.evidence,
          recommendation: rf.recommendation,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  return insights;
}

// ── Sync Engine Entry Point ─────────────────────────────────────
// Called by sync-engine.ts via dynamic import.

export async function syncData(integration: Integration): Promise<SyncResult> {
  const errors: string[] = [];

  if (!integration.accessToken) {
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: ["No access token available for Slack integration"],
    };
  }

  try {
    // 1. Fetch messages and users in parallel
    const [messages, users] = await Promise.all([
      fetchSlackMessages(integration.accessToken, { daysBack: 30 }),
      fetchSlackUsers(integration.accessToken),
    ]);

    // 2. Build org context from integration metadata
    const teamName = integration.metadata?.teamName ?? "Organization";
    const orgContext = teamName;

    // 3. Run AI analysis
    const insights = await analyzeSlackCommunication(messages, users, orgContext);

    // 4. Save each insight to Supabase
    let saved = 0;
    for (const insight of insights) {
      try {
        await saveCommunicationInsight({
          orgId: integration.orgId,
          jobId: insight.jobId,
          source: "slack",
          insightType: insight.insightType,
          subjectName: insight.subjectName,
          data: insight.data,
          periodStart: insight.periodStart,
          periodEnd: insight.periodEnd,
        });
        saved++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to save insight: ${msg}`);
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed: messages.length,
      insightsGenerated: saved,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: [msg],
    };
  }
}
