// ================================================================
// Pivot -- Gmail IMAP Integration
// Fetches emails via IMAP using Gmail App Password (no OAuth).
// Connects to imap.gmail.com:993 with TLS using ImapFlow.
// ================================================================

import { ImapFlow } from "imapflow";
import type { SyncResult, CommunicationInsight } from "./types";
import { saveCommunicationInsight } from "./store";
import {
  filterMessages,
  type FilterableMessage,
} from "./message-filter";
import { analyzeGmailCommunication, type GmailMessage } from "./gmail";

// ── Environment ─────────────────────────────────────────────────

const GMAIL_EMAIL = process.env.GMAIL_EMAIL ?? "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? "";

// ── Types ───────────────────────────────────────────────────────

export interface GmailIMAPMessage {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string; // truncated to 1000 chars
  date: string;
  isReply: boolean;
  threadId: string;
  labels: string[];
}

// ── Skip Patterns ───────────────────────────────────────────────

const SKIP_SENDER_PATTERNS = [
  "noreply",
  "no-reply",
  "notifications@",
  "marketing@",
  "newsletter@",
  "mailer-daemon@",
  "updates@",
  "info@",
  "donotreply@",
  "do-not-reply@",
  "digest@",
  "alerts@",
  "notify@",
  "github.com",
  "circleci.com",
  "travis-ci.org",
  "jenkins",
  "buildkite",
];

// ── Helpers ─────────────────────────────────────────────────────

function isSkippableSender(from: string): boolean {
  const lower = from.toLowerCase();
  return SKIP_SENDER_PATTERNS.some((p) => lower.includes(p));
}

function parseAddressList(
  addresses: Array<{ name?: string; address?: string }> | undefined,
): string[] {
  if (!addresses) return [];
  return addresses
    .map((a) => {
      if (a.name && a.address) return `${a.name} <${a.address}>`;
      return a.address ?? a.name ?? "";
    })
    .filter(Boolean);
}

function parseFromField(
  addresses: Array<{ name?: string; address?: string }> | undefined,
): string {
  if (!addresses || addresses.length === 0) return "Unknown";
  const first = addresses[0];
  if (first.name && first.address) return `${first.name} <${first.address}>`;
  return first.address ?? first.name ?? "Unknown";
}

function extractTextFromSource(source: Buffer): string {
  // The source is the raw RFC822 message. Extract text content.
  const raw = source.toString("utf-8");

  // Try to find the plain text body after headers
  // Look for double CRLF or double LF that separates headers from body
  const headerBodySep = raw.indexOf("\r\n\r\n");
  const body =
    headerBodySep > -1 ? raw.slice(headerBodySep + 4) : raw;

  // For multipart messages, try to extract plain text part
  const contentTypeMatch = raw.match(
    /Content-Type:\s*multipart\/[^;]+;\s*boundary="?([^\s";]+)"?/i,
  );

  if (contentTypeMatch) {
    const boundary = contentTypeMatch[1];
    const parts = body.split(`--${boundary}`);

    for (const part of parts) {
      if (
        part.toLowerCase().includes("content-type: text/plain") ||
        part.toLowerCase().includes("content-type:text/plain")
      ) {
        // Find the body of this part (after its own headers)
        const partBodySep = part.indexOf("\r\n\r\n");
        if (partBodySep > -1) {
          return cleanBody(part.slice(partBodySep + 4));
        }
      }
    }
  }

  // Fallback: just use the body as-is, strip HTML tags if present
  return cleanBody(body);
}

function cleanBody(text: string): string {
  // Strip HTML tags
  let clean = text.replace(/<[^>]+>/g, " ");
  // Normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  // Strip common email footer patterns
  clean = clean
    .replace(/--\s*Sent from .+$/i, "")
    .replace(/_{10,}/g, "")
    .trim();
  return clean;
}

// ── Fetch Emails via IMAP ───────────────────────────────────────

/**
 * Fetch emails via IMAP using Gmail App Password.
 * No OAuth needed -- works immediately with an app password.
 */
export async function fetchGmailViaIMAP(options?: {
  daysBack?: number;
  maxResults?: number;
  folder?: string;
  excludePromotions?: boolean;
}): Promise<GmailIMAPMessage[]> {
  const daysBack = options?.daysBack ?? 30;
  const maxResults = options?.maxResults ?? 500;
  const folder = options?.folder ?? "INBOX";

  if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "Gmail IMAP credentials not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env",
    );
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: GMAIL_EMAIL,
      pass: GMAIL_APP_PASSWORD,
    },
    logger: false,
  });

  const messages: GmailIMAPMessage[] = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock(folder);

    try {
      // Calculate the date for SINCE search
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - daysBack);

      // Search for messages since the target date
      const searchResults = await client.search(
        { since: sinceDate },
        { uid: true },
      );

      if (!searchResults || searchResults.length === 0) {
        return [];
      }

      // Limit results
      const uidsToFetch = searchResults.slice(-maxResults);

      // Build a UID range string for fetch
      const uidRange = uidsToFetch.join(",");

      // Fetch messages with envelope and source
      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        source: { maxLength: 50000 }, // limit source to 50KB per message
        flags: true,
        labels: true,
        threadId: true,
        uid: true,
      }, { uid: true })) {
        if (!msg.envelope) continue;

        const fromStr = parseFromField(msg.envelope.from);

        // Skip automated/marketing senders
        if (isSkippableSender(fromStr)) continue;

        const subject = msg.envelope.subject ?? "(no subject)";
        const isReply =
          subject.toLowerCase().startsWith("re:") ||
          subject.toLowerCase().startsWith("fwd:");

        // Extract body text from source
        let body = "";
        if (msg.source) {
          body = extractTextFromSource(msg.source);
        }

        // Truncate body to 1000 chars
        if (body.length > 1000) {
          body = body.slice(0, 1000) + "... [truncated]";
        }

        // Build labels array from Gmail labels set
        const labelsList: string[] = [];
        if (msg.labels) {
          for (const label of msg.labels) {
            labelsList.push(label);
          }
        }

        // Skip promotions/social if requested
        if (options?.excludePromotions !== false) {
          if (
            labelsList.some(
              (l) =>
                l.toLowerCase().includes("promotions") ||
                l.toLowerCase().includes("social") ||
                l.toLowerCase().includes("forums") ||
                l.toLowerCase().includes("spam"),
            )
          ) {
            continue;
          }
        }

        const date = msg.envelope.date
          ? new Date(msg.envelope.date).toISOString()
          : new Date().toISOString();

        messages.push({
          id: String(msg.uid),
          from: fromStr,
          to: parseAddressList(msg.envelope.to),
          cc: parseAddressList(msg.envelope.cc),
          subject,
          body,
          date,
          isReply,
          threadId: msg.threadId ?? String(msg.uid),
          labels: labelsList,
        });

        // Stop if we hit the max
        if (messages.length >= maxResults) break;
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore logout errors
    }
  }

  return messages;
}

// ── Convert IMAP messages to Gmail API format ───────────────────

function imapToGmailMessage(msg: GmailIMAPMessage): GmailMessage {
  // Parse the from field to extract name and email
  const fromMatch = msg.from.match(/^(.+?)\s*<(.+?)>$/);
  const fromName = fromMatch ? fromMatch[1].trim() : msg.from;
  const fromEmail = fromMatch ? fromMatch[2].trim() : msg.from;

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: fromName,
    fromEmail,
    to: msg.to,
    cc: msg.cc,
    subject: msg.subject,
    body: msg.body,
    date: msg.date,
    labels: msg.labels,
    isReply: msg.isReply,
    isUnread: false,
  };
}

// ── Full Sync: Fetch via IMAP, Filter, Analyze, Save ────────────

/**
 * Full sync: Fetch via IMAP -> Filter with AI -> Analyze with Gemini -> Save insights.
 * Drop-in replacement for OAuth-based Gmail sync.
 */
export async function syncGmailIMAP(orgId: string): Promise<SyncResult> {
  const errors: string[] = [];

  try {
    // 1. Fetch messages via IMAP
    console.log("[gmail-imap] Fetching messages via IMAP...");
    const imapMessages = await fetchGmailViaIMAP({
      daysBack: 30,
      maxResults: 500,
      excludePromotions: true,
    });

    console.log(`[gmail-imap] Fetched ${imapMessages.length} messages via IMAP`);

    if (imapMessages.length === 0) {
      return {
        success: true,
        recordsProcessed: 0,
        insightsGenerated: 0,
        errors: [],
      };
    }

    // 2. Convert to FilterableMessage format for the AI filter
    const filterableMessages: FilterableMessage[] = imapMessages.map((m) => ({
      id: m.id,
      text: `Subject: ${m.subject}\n${m.body.slice(0, 300)}`,
      sender: m.from,
      channel: m.labels.join(","),
      timestamp: m.date,
    }));

    // 3. Run through AI filter
    const filterResult = await filterMessages(
      filterableMessages,
      `Organization email analysis for ${GMAIL_EMAIL}`,
    );

    console.log(
      `[gmail-imap] Filter: ${filterResult.totalMessages} total -> ${filterResult.filteredCount} business-relevant (dropped ${filterResult.droppedCount})`,
    );

    // 4. Map filtered message IDs back to IMAP messages, then convert to GmailMessage format
    const filteredIds = new Set(
      filterResult.filteredMessages.map((m) => m.id),
    );
    const filteredImapMessages = imapMessages.filter((m) =>
      filteredIds.has(m.id),
    );
    const gmailMessages = filteredImapMessages.map(imapToGmailMessage);

    // 5. Run through Gemini analysis (reuse existing Gmail analyzer)
    const orgContext = `Organization (${GMAIL_EMAIL})`;
    const insights = await analyzeGmailCommunication(gmailMessages, orgContext);

    console.log(
      `[gmail-imap] Analysis generated ${insights.length} insights`,
    );

    // 6. Save insights to store
    let saved = 0;
    for (const insight of insights) {
      try {
        await saveCommunicationInsight({
          orgId,
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
      recordsProcessed: imapMessages.length,
      insightsGenerated: saved,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gmail-imap] Sync error:", msg);
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: [msg],
    };
  }
}

// ── Connection Test ─────────────────────────────────────────────

/**
 * Test IMAP connection with app password.
 * Returns connection status and recent message count.
 */
export async function testGmailIMAPConnection(): Promise<{
  connected: boolean;
  email: string;
  recentMessageCount: number;
  error?: string;
}> {
  if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD) {
    return {
      connected: false,
      email: "",
      recentMessageCount: 0,
      error:
        "Gmail IMAP credentials not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env",
    };
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: GMAIL_EMAIL,
      pass: GMAIL_APP_PASSWORD,
    },
    logger: false,
  });

  try {
    await client.connect();
    const status = await client.status("INBOX", { messages: true });
    const messageCount = status.messages ?? 0;
    await client.logout();

    return {
      connected: true,
      email: GMAIL_EMAIL,
      recentMessageCount: messageCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await client.logout();
    } catch {
      // Ignore cleanup errors
    }
    return {
      connected: false,
      email: GMAIL_EMAIL,
      recentMessageCount: 0,
      error: msg,
    };
  }
}

// ── Configuration Check ─────────────────────────────────────────

/**
 * Returns true if Gmail IMAP credentials are configured in environment.
 */
export function isGmailIMAPConfigured(): boolean {
  return !!(process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD);
}
