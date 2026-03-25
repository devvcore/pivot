/**
 * Notification Engine — Always-On Agent Intelligence
 *
 * Processes webhook events from Slack, Stripe, Gmail, Jira, and GitHub
 * into smart notifications with AI-powered triage and routing.
 *
 * Flow:
 *   1. Webhook event arrives → stored in integration_webhook_events
 *   2. Engine picks up unprocessed events
 *   3. AI classifies urgency and generates notification
 *   4. Routes to: dashboard alert, Slack channel, email, or all three
 *
 * Runs via:
 *   - POST /api/cron/process-webhooks (periodic)
 *   - Inline after webhook receipt (low-latency path)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI } from "@google/genai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  orgId: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  source: string;        // slack, stripe, gmail, jira, github
  sourceEventType: string;
  actionUrl?: string;    // deep link to relevant dashboard section
  metadata?: Record<string, unknown>;
}

interface WebhookEvent {
  id: string;
  org_id: string;
  provider: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

interface TriageResult {
  shouldNotify: boolean;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  actionUrl?: string;
}

// ── AI Triage ─────────────────────────────────────────────────────────────────

const TRIAGE_PROMPT = `You are a business notification triage system. Given a webhook event, decide:
1. Should this generate a notification? (not all events matter)
2. What severity? (info = FYI, warning = needs attention soon, critical = needs immediate action)
3. What's a clear, concise title? (max 60 chars)
4. What's a helpful 1-2 sentence message? (include key details like amounts, names)

Respond with JSON only:
{"shouldNotify":true/false,"severity":"info|warning|critical","title":"...","message":"..."}

Guidelines:
- Payment succeeded > $100 → info notification
- Payment failed → warning
- Subscription cancelled → critical
- New Slack message mentioning urgency/blockers → warning
- GitHub PR merged → info
- Jira critical/blocker issue created → warning
- New email from important contact → info
- Stripe dispute → critical
- Large payment > $1000 → info with excitement
- Churn signals → critical`;

async function triageEvent(event: WebhookEvent): Promise<TriageResult> {
  // Fast-path: known high-priority events (skip AI for speed)
  const fastTriaged = fastPathTriage(event);
  if (fastTriaged) return fastTriaged;

  // AI triage for complex events
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fallbackTriage(event);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: `Provider: ${event.provider}\nEvent: ${event.event_type}\nPayload: ${JSON.stringify(event.payload).slice(0, 2000)}`,
      config: {
        systemInstruction: TRIAGE_PROMPT,
        temperature: 0,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text?.trim() ?? "";
    const result = JSON.parse(text) as TriageResult;
    return {
      shouldNotify: result.shouldNotify ?? false,
      severity: result.severity ?? "info",
      title: result.title ?? `${event.provider} event`,
      message: result.message ?? "",
    };
  } catch {
    return fallbackTriage(event);
  }
}

// ── Fast-path triage (no AI needed) ───────────────────────────────────────────

function fastPathTriage(event: WebhookEvent): TriageResult | null {
  const { provider, event_type, payload } = event;

  // Stripe events
  if (provider === "stripe") {
    if (event_type === "payment_intent.payment_failed" || event_type === "invoice.payment_failed") {
      const amount = ((payload as any)?.amount ?? 0) / 100;
      const customer = (payload as any)?.customer_email ?? (payload as any)?.customer ?? "a customer";
      return {
        shouldNotify: true,
        severity: "warning",
        title: "Payment Failed",
        message: `Payment of $${amount.toLocaleString()} from ${customer} failed. Check your Stripe dashboard.`,
      };
    }
    if (event_type === "charge.dispute.created") {
      const amount = ((payload as any)?.amount ?? 0) / 100;
      return {
        shouldNotify: true,
        severity: "critical",
        title: "Dispute Filed",
        message: `A $${amount.toLocaleString()} dispute was filed. You have 7 days to respond.`,
        actionUrl: "/dashboard?tab=finance",
      };
    }
    if (event_type === "customer.subscription.deleted") {
      const customer = (payload as any)?.customer_email ?? "a customer";
      return {
        shouldNotify: true,
        severity: "critical",
        title: "Subscription Cancelled",
        message: `${customer} cancelled their subscription. Consider reaching out to understand why.`,
        actionUrl: "/dashboard?tab=crm",
      };
    }
    if (event_type === "payment_intent.succeeded" || event_type === "invoice.paid") {
      const amount = ((payload as any)?.amount ?? (payload as any)?.amount_paid ?? 0) / 100;
      if (amount >= 100) {
        return {
          shouldNotify: true,
          severity: "info",
          title: `Payment Received: $${amount.toLocaleString()}`,
          message: `A payment of $${amount.toLocaleString()} was successfully processed.`,
        };
      }
      return { shouldNotify: false, severity: "info", title: "", message: "" };
    }
  }

  // Jira events
  if (provider === "jira") {
    if (event_type === "jira:issue_created") {
      const priority = (payload as any)?.issue?.fields?.priority?.name ?? "";
      if (priority === "Critical" || priority === "Blocker") {
        const summary = (payload as any)?.issue?.fields?.summary ?? "New issue";
        return {
          shouldNotify: true,
          severity: "warning",
          title: `${priority} Issue Created`,
          message: summary,
          actionUrl: "/dashboard?tab=pm",
        };
      }
    }
  }

  return null; // Fall through to AI triage
}

// ── Fallback triage (no AI available) ─────────────────────────────────────────

function fallbackTriage(event: WebhookEvent): TriageResult {
  const severity = event.event_type.includes("fail") || event.event_type.includes("dispute") || event.event_type.includes("deleted")
    ? "warning" as const
    : "info" as const;

  return {
    shouldNotify: true,
    severity,
    title: `${event.provider}: ${event.event_type.replace(/[._]/g, " ")}`,
    message: `New ${event.provider} event: ${event.event_type}`,
  };
}

// ── Notification Delivery ─────────────────────────────────────────────────────

export async function deliverNotification(notification: NotificationPayload): Promise<void> {
  const supabase = createAdminClient();

  // 1. Always save to alerts table (dashboard notification)
  await supabase.from("alerts").insert({
    org_id: notification.orgId,
    title: notification.title,
    message: notification.message,
    severity: notification.severity,
    source: notification.source,
    source_event_type: notification.sourceEventType,
    action_url: notification.actionUrl ?? null,
    metadata: notification.metadata ?? {},
    read: false,
  });

  // 2. Push to Slack if configured and severity is warning+
  if (notification.severity !== "info") {
    try {
      const { sendProactiveAlertToSlack } = await import("@/lib/slack/proactive-alerts");
      await sendProactiveAlertToSlack(notification.orgId, {
        type: notification.sourceEventType,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
      });
    } catch (err) {
      console.warn("[notifications] Slack push failed:", err instanceof Error ? err.message : err);
    }
  }

  // 3. Push critical alerts via email
  if (notification.severity === "critical") {
    try {
      // Find org owner email
      const { data: org } = await supabase
        .from("organizations")
        .select("owner_user_id")
        .eq("id", notification.orgId)
        .single();

      if (org?.owner_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", org.owner_user_id)
          .single();

        if (profile?.email) {
          const { globalRegistry, createCostTracker } = await import("@/lib/execution/tools/index");
          await globalRegistry.execute("send_email", {
            to: profile.email,
            subject: `🚨 Pivot Alert: ${notification.title}`,
            body: `${notification.message}\n\nSource: ${notification.source}\nSeverity: ${notification.severity}\n\n---\nThis is an automated alert from Pivot. Log in to your dashboard for details.`,
          }, {
            orgId: notification.orgId,
            agentId: "system",
            sessionId: "notification-engine",
            costTracker: createCostTracker(0.05),
          });
        }
      }
    } catch (err) {
      console.warn("[notifications] Email push failed:", err instanceof Error ? err.message : err);
    }
  }
}

// ── Process Unhandled Webhook Events ──────────────────────────────────────────

export async function processWebhookEvents(limit: number = 50): Promise<{
  processed: number;
  notified: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let notified = 0;

  // Fetch unprocessed events
  const { data: events, error } = await supabase
    .from("integration_webhook_events")
    .select("*")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !events || events.length === 0) {
    return { processed: 0, notified: 0, errors: error ? [error.message] : [] };
  }

  // Process in batches of 5
  for (let i = 0; i < events.length; i += 5) {
    const batch = events.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (event) => {
        const triageResult = await triageEvent(event as WebhookEvent);

        if (triageResult.shouldNotify) {
          await deliverNotification({
            orgId: event.org_id,
            title: triageResult.title,
            message: triageResult.message,
            severity: triageResult.severity,
            source: event.provider,
            sourceEventType: event.event_type,
            actionUrl: triageResult.actionUrl,
            metadata: { webhookEventId: event.id },
          });
          notified++;
        }

        // Mark as processed
        await supabase
          .from("integration_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", event.id);
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason));
      }
    }
  }

  return { processed: events.length, notified, errors };
}

// ── Inline Processing (call from webhook handlers for low-latency) ────────────

export async function processEventInline(
  orgId: string,
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const event: WebhookEvent = {
    id: crypto.randomUUID(),
    org_id: orgId,
    provider,
    event_type: eventType,
    payload,
    processed: false,
    created_at: new Date().toISOString(),
  };

  const triageResult = await triageEvent(event);

  if (triageResult.shouldNotify) {
    await deliverNotification({
      orgId,
      title: triageResult.title,
      message: triageResult.message,
      severity: triageResult.severity,
      source: provider,
      sourceEventType: eventType,
      actionUrl: triageResult.actionUrl,
    });
  }
}
