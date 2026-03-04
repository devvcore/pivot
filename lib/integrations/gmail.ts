// ================================================================
// Pivot -- Gmail Integration
// Fetches email messages from Gmail API and analyzes communication
// patterns using Gemini AI.
// ================================================================

import { GoogleGenAI } from "@google/genai";
import type { CommunicationInsight, Integration, SyncResult } from "@/lib/integrations/types";
import { saveCommunicationInsight } from "@/lib/integrations/store";

// ── Gmail-specific Types ────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string; // truncated for token efficiency
  date: string; // ISO timestamp
  labels: string[];
  isReply: boolean;
  isUnread: boolean;
}

interface GmailHeader {
  name: string;
  value: string;
}

// ── Constants ───────────────────────────────────────────────────

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

const SKIP_SENDERS_PATTERNS = [
  "noreply@",
  "no-reply@",
  "notifications@",
  "mailer-daemon@",
  "newsletter@",
  "marketing@",
  "updates@",
  "info@",
  "support@",
  "donotreply@",
  "do-not-reply@",
  "news@",
  "digest@",
  "alerts@",
  "notify@",
];

const SKIP_SUBJECT_PATTERNS = [
  /unsubscribe/i,
  /newsletter/i,
  /weekly digest/i,
  /daily digest/i,
  /your .* receipt/i,
  /order confirmation/i,
  /shipping notification/i,
  /password reset/i,
  /verify your email/i,
  /welcome to/i,
  /\[jira\]/i, // automated JIRA notifications
  /\[github\]/i, // automated GitHub notifications
  /build (passed|failed|succeeded)/i,
  /\[ci\]/i,
];

// ── Helpers ─────────────────────────────────────────────────────

async function gmailFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GMAIL_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gmail API ${path} returned ${res.status}: ${errBody.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

function extractHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, "").trim(), email: match[2].trim() };
  }
  return { name: raw.trim(), email: raw.trim() };
}

function parseRecipients(raw: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((r) => r.trim()).filter(Boolean);
}

function isAutomatedSender(email: string): boolean {
  const lower = email.toLowerCase();
  return SKIP_SENDERS_PATTERNS.some((p) => lower.includes(p));
}

function isAutomatedSubject(subject: string): boolean {
  return SKIP_SUBJECT_PATTERNS.some((p) => p.test(subject));
}

function decodeBase64Url(encoded: string): string {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractTextFromParts(parts: any[]): string {
  let text = "";

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += decodeBase64Url(part.body.data);
    } else if (part.parts) {
      text += extractTextFromParts(part.parts);
    }
  }

  return text;
}

// ── Fetch Gmail Messages ────────────────────────────────────────

export async function fetchGmailMessages(
  accessToken: string,
  options?: {
    daysBack?: number;
    maxResults?: number;
    query?: string;
  },
): Promise<GmailMessage[]> {
  const daysBack = options?.daysBack ?? 30;
  const maxResults = options?.maxResults ?? 500;

  // Build Gmail search query
  const defaultQuery = [
    `newer_than:${daysBack}d`,
    "-category:promotions",
    "-category:social",
    "-category:forums",
    "-in:spam",
    "-in:trash",
  ].join(" ");
  const searchQuery = options?.query
    ? `${options.query} ${defaultQuery}`
    : defaultQuery;

  // 1. List message IDs (paginated)
  const messageIds: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      q: searchQuery,
      maxResults: String(Math.min(maxResults - messageIds.length, 100)),
    };
    if (pageToken) params.pageToken = pageToken;

    const listResp = await gmailFetch<any>("/messages", accessToken, params);

    if (listResp.messages) {
      for (const m of listResp.messages) {
        messageIds.push({ id: m.id, threadId: m.threadId });
      }
    }

    pageToken = listResp.nextPageToken;
  } while (pageToken && messageIds.length < maxResults);

  // 2. Fetch each message's metadata (batch with concurrency control)
  const messages: GmailMessage[] = [];
  const CONCURRENCY = 10;

  for (let i = 0; i < messageIds.length; i += CONCURRENCY) {
    const batch = messageIds.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async ({ id, threadId }) => {
        // First fetch metadata to decide if we need the full body
        const metaResp = await gmailFetch<any>(
          `/messages/${id}`,
          accessToken,
          { format: "metadata", metadataHeaders: "From,To,Cc,Subject,Date" },
        );

        const headers: GmailHeader[] = metaResp.payload?.headers ?? [];
        const fromRaw = extractHeader(headers, "From");
        const subject = extractHeader(headers, "Subject");
        const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);

        // Skip automated/marketing emails
        if (isAutomatedSender(fromEmail) || isAutomatedSubject(subject)) {
          return null;
        }

        // For business-relevant emails, fetch full body
        let body = "";
        const isBizRelevant = !isAutomatedSender(fromEmail) && !isAutomatedSubject(subject);

        if (isBizRelevant) {
          try {
            const fullResp = await gmailFetch<any>(
              `/messages/${id}`,
              accessToken,
              { format: "full" },
            );

            if (fullResp.payload?.body?.data) {
              body = decodeBase64Url(fullResp.payload.body.data);
            } else if (fullResp.payload?.parts) {
              body = extractTextFromParts(fullResp.payload.parts);
            }

            // Truncate body to keep token budget manageable
            if (body.length > 1000) {
              body = body.slice(0, 1000) + "... [truncated]";
            }
          } catch {
            // Fall back to metadata-only if full fetch fails
          }
        }

        const dateStr = extractHeader(headers, "Date");
        const labels: string[] = metaResp.labelIds ?? [];
        const toRaw = extractHeader(headers, "To");
        const ccRaw = extractHeader(headers, "Cc");

        // Detect if this is a reply
        const isReply =
          subject.toLowerCase().startsWith("re:") ||
          subject.toLowerCase().startsWith("fwd:");

        return {
          id,
          threadId,
          from: fromName,
          fromEmail,
          to: parseRecipients(toRaw),
          cc: parseRecipients(ccRaw),
          subject,
          body,
          date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          labels,
          isReply,
          isUnread: labels.includes("UNREAD"),
        } satisfies GmailMessage;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        messages.push(r.value);
      }
    }
  }

  return messages;
}

// ── AI-Powered Gmail Communication Analysis ─────────────────────

export async function analyzeGmailCommunication(
  messages: GmailMessage[],
  orgContext: string,
): Promise<CommunicationInsight[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  if (messages.length === 0) {
    return [];
  }

  // Smart filtering: limit to ~50K chars for token budget
  const MAX_CHARS = 50_000;
  let totalChars = 0;
  const filtered: GmailMessage[] = [];

  // Sort by date descending (most recent first)
  const sorted = [...messages].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  for (const msg of sorted) {
    const line = `[${msg.date}] ${msg.from} -> ${msg.to.join(",")} | ${msg.subject} | ${msg.body.slice(0, 300)}`;
    if (totalChars + line.length > MAX_CHARS) break;
    totalChars += line.length;
    filtered.push(msg);
  }

  // Build email thread summaries for the AI
  const threadMap = new Map<string, GmailMessage[]>();
  for (const msg of filtered) {
    if (!threadMap.has(msg.threadId)) threadMap.set(msg.threadId, []);
    threadMap.get(msg.threadId)!.push(msg);
  }

  const emailLines = filtered.map((m) => {
    const recipients = m.to.join(", ");
    const cc = m.cc.length > 0 ? ` (cc: ${m.cc.join(", ")})` : "";
    const bodyPreview = m.body ? `\n  Body: ${m.body.slice(0, 300)}` : "";
    return `[${m.date}] FROM: ${m.from} <${m.fromEmail}> TO: ${recipients}${cc}\n  Subject: ${m.subject}${bodyPreview}\n  Labels: ${m.labels.join(",")} | Reply: ${m.isReply} | Thread: ${m.threadId}`;
  });

  const prompt = `You are an expert organizational psychologist analyzing email communication patterns.

ORGANIZATION: ${orgContext}

EMAIL MESSAGES (${filtered.length} of ${messages.length} total, last 30 days):
${emailLines.join("\n---\n")}

THREAD STATISTICS:
- Total threads: ${threadMap.size}
- Average emails per thread: ${(filtered.length / Math.max(threadMap.size, 1)).toFixed(1)}
- Longest thread: ${Math.max(...Array.from(threadMap.values()).map((t) => t.length))} emails

Analyze email communication patterns and return a JSON object:

{
  "client_communication": [
    {
      "personName": "Name",
      "clientResponseTimeHours": number,
      "internalResponseTimeHours": number,
      "responseRate": 0-100,
      "topClients": ["client1@...", "client2@..."],
      "quality": "excellent|good|average|poor"
    }
  ],
  "follow_up_rates": [
    {
      "personName": "Name",
      "sentWithNoResponse": number,
      "receivedWithNoResponse": number,
      "followUpRate": 0-100,
      "droppedThreads": ["subject1", "subject2"]
    }
  ],
  "thread_depth": [
    {
      "subject": "email subject",
      "depth": number,
      "participants": ["Name1", "Name2"],
      "isBottleneck": true/false,
      "bottleneckReason": "why this thread is concerning"
    }
  ],
  "out_of_hours": [
    {
      "personName": "Name",
      "percentOutOfHours": 0-100,
      "commonLateTimes": ["22:00-23:00", "06:00-07:00"],
      "weekendEmailPercent": 0-100,
      "burnoutRisk": "high|medium|low"
    }
  ],
  "key_relationships": [
    {
      "person1": "Name1",
      "person2": "Name2/Email2",
      "emailCount": number,
      "avgResponseHours": number,
      "isExternal": true/false,
      "relationshipType": "client|vendor|partner|internal|unknown",
      "healthScore": 0-100
    }
  ],
  "response_times": [
    {
      "personName": "Name",
      "avgResponseMinutes": number,
      "toClientsMinutes": number,
      "toInternalMinutes": number,
      "rating": "excellent|good|average|slow|unresponsive"
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
        "tone": "professional|casual|stressed|curt|warm"
      }
    ]
  },
  "risk_flags": [
    {
      "type": "burnout|client_neglect|dropped_ball|conflict|over_communication|under_communication",
      "severity": "critical|high|medium|low",
      "involvedPeople": ["Name1"],
      "evidence": "specific pattern observed",
      "recommendation": "actionable suggestion"
    }
  ]
}

Base analysis ONLY on actual patterns in the emails. If insufficient data for a category, return an empty array. Focus on actionable insights.`;

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
    console.error("[gmail] Failed to parse Gemini response:", text.slice(0, 500));
    return [];
  }

  // Convert AI output to CommunicationInsight records
  const now = new Date().toISOString();
  const periodStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const insights: CommunicationInsight[] = [];

  // Response times
  if (Array.isArray(analysis.response_times)) {
    for (const rt of analysis.response_times) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "gmail",
        insightType: "response_time",
        subjectName: rt.personName,
        data: {
          avgResponseMinutes: rt.avgResponseMinutes,
          toClientsMinutes: rt.toClientsMinutes,
          toInternalMinutes: rt.toInternalMinutes,
          rating: rt.rating,
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Key relationships -> relationship_score
  if (Array.isArray(analysis.key_relationships)) {
    for (const kr of analysis.key_relationships) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "gmail",
        insightType: "relationship_score",
        subjectName: `${kr.person1} <-> ${kr.person2}`,
        data: {
          person1: kr.person1,
          person2: kr.person2,
          emailCount: kr.emailCount,
          avgResponseHours: kr.avgResponseHours,
          isExternal: kr.isExternal,
          relationshipType: kr.relationshipType,
          healthScore: kr.healthScore,
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
      source: "gmail",
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

  // Engagement from client communication + follow-up rates
  if (Array.isArray(analysis.client_communication)) {
    for (const cc of analysis.client_communication) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "gmail",
        insightType: "engagement",
        subjectName: cc.personName,
        data: {
          clientResponseTimeHours: cc.clientResponseTimeHours,
          internalResponseTimeHours: cc.internalResponseTimeHours,
          responseRate: cc.responseRate,
          topClients: cc.topClients,
          quality: cc.quality,
          source: "client_communication",
        },
        periodStart,
        periodEnd: now,
        createdAt: now,
      });
    }
  }

  // Bottlenecks from thread depth
  if (Array.isArray(analysis.thread_depth)) {
    for (const td of analysis.thread_depth) {
      if (td.isBottleneck) {
        insights.push({
          id: crypto.randomUUID(),
          orgId: "",
          jobId: null,
          source: "gmail",
          insightType: "bottleneck",
          subjectName: td.participants?.join(", ") ?? null,
          data: {
            type: "long_thread",
            subject: td.subject,
            depth: td.depth,
            participants: td.participants,
            reason: td.bottleneckReason,
          },
          periodStart,
          periodEnd: now,
          createdAt: now,
        });
      }
    }
  }

  // Risk flags (burnout from out_of_hours + explicit risk_flags)
  if (Array.isArray(analysis.out_of_hours)) {
    for (const ooh of analysis.out_of_hours) {
      if (ooh.burnoutRisk === "high" || ooh.burnoutRisk === "medium") {
        insights.push({
          id: crypto.randomUUID(),
          orgId: "",
          jobId: null,
          source: "gmail",
          insightType: "risk_flag",
          subjectName: ooh.personName,
          data: {
            type: "burnout",
            severity: ooh.burnoutRisk,
            percentOutOfHours: ooh.percentOutOfHours,
            commonLateTimes: ooh.commonLateTimes,
            weekendEmailPercent: ooh.weekendEmailPercent,
            evidence: `${ooh.percentOutOfHours}% emails sent out of hours, ${ooh.weekendEmailPercent}% on weekends`,
            recommendation: "Review workload distribution and set communication boundaries",
          },
          periodStart,
          periodEnd: now,
          createdAt: now,
        });
      }
    }
  }

  if (Array.isArray(analysis.risk_flags)) {
    for (const rf of analysis.risk_flags) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "gmail",
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

  // Follow-up rates -> meeting_attendance (closest analogue for email)
  if (Array.isArray(analysis.follow_up_rates)) {
    for (const fu of analysis.follow_up_rates) {
      insights.push({
        id: crypto.randomUUID(),
        orgId: "",
        jobId: null,
        source: "gmail",
        insightType: "meeting_attendance",
        subjectName: fu.personName,
        data: {
          followUpRate: fu.followUpRate,
          sentWithNoResponse: fu.sentWithNoResponse,
          receivedWithNoResponse: fu.receivedWithNoResponse,
          droppedThreads: fu.droppedThreads,
          source: "email_follow_up",
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
      errors: ["No access token available for Gmail integration"],
    };
  }

  try {
    // 1. Fetch Gmail messages
    const messages = await fetchGmailMessages(integration.accessToken, {
      daysBack: 30,
    });

    // 2. Build org context from integration metadata
    const userEmail = integration.metadata?.userEmail ?? "User";
    const orgContext = `Organization (${userEmail})`;

    // 3. Run AI analysis
    const insights = await analyzeGmailCommunication(messages, orgContext);

    // 4. Save each insight to Supabase
    let saved = 0;
    for (const insight of insights) {
      try {
        await saveCommunicationInsight({
          orgId: integration.orgId,
          jobId: insight.jobId,
          source: "gmail",
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
