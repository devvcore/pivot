/**
 * Daily AI Briefing Engine
 *
 * Generates a personalized daily business briefing that covers:
 * - Key metrics changes (revenue, pipeline, tasks)
 * - Important alerts from overnight
 * - CRM follow-up reminders
 * - Agent activity summary
 * - Upcoming calendar events
 * - Actionable recommendations
 *
 * Output: structured briefing text + optional TTS audio URL
 *
 * Can be triggered:
 * - Via cron at user's preferred time
 * - On-demand via dashboard "Morning Briefing" button
 * - Via Slack: /pivot briefing
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI } from "@google/genai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BriefingSection {
  title: string;
  icon: string; // emoji
  content: string;
  priority: "high" | "medium" | "low";
}

export interface DailyBriefing {
  orgId: string;
  greeting: string;
  summary: string; // 1-2 sentence overview
  sections: BriefingSection[];
  actionItems: string[];
  generatedAt: string;
  audioUrl?: string; // TTS audio if generated
}

// ── Data Collection ───────────────────────────────────────────────────────────

async function collectBriefingData(orgId: string): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);

  const [
    unreadAlerts,
    recentTasks,
    pipelineContacts,
    staleContacts,
    recentStripeData,
    openTickets,
    orgData,
  ] = await Promise.all([
    // Unread alerts from last 24h
    supabase
      .from("alerts")
      .select("title, severity, message, source, created_at")
      .eq("org_id", orgId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(10),

    // Agent tasks from last 24h
    supabase
      .from("execution_tasks")
      .select("title, agent_id, status, completed_at, result")
      .eq("org_id", orgId)
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false })
      .limit(10),

    // Pipeline contacts needing follow-up
    supabase
      .from("crm_contacts")
      .select("name, stage, deal_value, last_contacted_at")
      .eq("org_id", orgId)
      .in("stage", ["qualified", "proposal", "negotiation"])
      .order("deal_value", { ascending: false })
      .limit(10),

    // Stale contacts (no activity in 7+ days)
    supabase
      .from("crm_contacts")
      .select("name, stage, deal_value, last_contacted_at")
      .eq("org_id", orgId)
      .in("stage", ["lead", "prospect", "qualified", "proposal", "negotiation"])
      .lt("last_contacted_at", threeDaysAgo.toISOString())
      .order("deal_value", { ascending: false })
      .limit(5),

    // Stripe revenue last 24h
    supabase
      .from("integration_data")
      .select("data")
      .eq("org_id", orgId)
      .eq("provider", "stripe")
      .eq("record_type", "charge")
      .gte("synced_at", yesterday.toISOString()),

    // Open tickets
    supabase
      .from("pm_tickets")
      .select("title, status, priority, assignee")
      .eq("org_id", orgId)
      .not("status", "in", '("done","cancelled")')
      .order("priority", { ascending: true })
      .limit(10),

    // Org info
    supabase
      .from("organizations")
      .select("name, owner_user_id")
      .eq("id", orgId)
      .single(),
  ]);

  // Get owner's name
  let ownerName = "there";
  if (orgData.data?.owner_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", orgData.data.owner_user_id)
      .single();
    if (profile?.first_name) ownerName = profile.first_name;
  }

  // Calculate revenue
  let recentRevenue = 0;
  for (const row of recentStripeData.data ?? []) {
    let amt = (row.data as any)?.amount ?? 0;
    if (typeof amt !== "number") amt = parseFloat(amt) || 0;
    if (amt > 10000) amt = amt / 100;
    recentRevenue += amt;
  }

  // Count alerts by severity
  const alertsBySeverity: Record<string, number> = {};
  for (const a of unreadAlerts.data ?? []) {
    alertsBySeverity[a.severity] = (alertsBySeverity[a.severity] ?? 0) + 1;
  }

  // Agent task stats
  const completedTasks = (recentTasks.data ?? []).filter(t => t.status === "completed");
  const activeTasks = (recentTasks.data ?? []).filter(t => t.status === "in_progress");

  return {
    ownerName,
    orgName: orgData.data?.name ?? "your business",
    unreadAlerts: unreadAlerts.data ?? [],
    alertsBySeverity,
    completedTasks,
    activeTasks,
    pipelineContacts: pipelineContacts.data ?? [],
    staleContacts: staleContacts.data ?? [],
    recentRevenue,
    paymentCount: recentStripeData.data?.length ?? 0,
    openTickets: openTickets.data ?? [],
    highPriorityTickets: (openTickets.data ?? []).filter(t => t.priority === "high" || t.priority === "urgent"),
  };
}

// ── Briefing Generation ───────────────────────────────────────────────────────

export async function generateDailyBriefing(orgId: string): Promise<DailyBriefing> {
  const data = await collectBriefingData(orgId);
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallbackBriefing(orgId, data, timeOfDay);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are Pivvy, a friendly AI business advisor. Generate a personalized daily briefing for ${data.ownerName} about ${data.orgName}.

Time: ${timeOfDay} briefing for ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}

DATA:
- Revenue last 24h: $${(data.recentRevenue as number).toLocaleString()} from ${data.paymentCount} payments
- Unread alerts: ${JSON.stringify(data.alertsBySeverity)} (${(data.unreadAlerts as any[]).length} total)
${(data.unreadAlerts as any[]).length > 0 ? `  Top alerts: ${(data.unreadAlerts as any[]).slice(0, 3).map((a: any) => `[${a.severity}] ${a.title}`).join(", ")}` : ""}
- Agent activity: ${(data.completedTasks as any[]).length} tasks completed, ${(data.activeTasks as any[]).length} active
${(data.completedTasks as any[]).length > 0 ? `  Recent: ${(data.completedTasks as any[]).slice(0, 3).map((t: any) => t.title).join(", ")}` : ""}
- Pipeline: ${(data.pipelineContacts as any[]).length} active deals
${(data.staleContacts as any[]).length > 0 ? `- Stale contacts needing follow-up: ${(data.staleContacts as any[]).map((c: any) => `${c.name} ($${(c.deal_value ?? 0).toLocaleString()})`).join(", ")}` : ""}
- Open tickets: ${(data.openTickets as any[]).length} (${(data.highPriorityTickets as any[]).length} high priority)

Generate a JSON response with:
{
  "greeting": "Good ${timeOfDay}, ${data.ownerName}! <brief warm opener>",
  "summary": "<1-2 sentence overview of most important thing>",
  "sections": [
    {"title": "section name", "icon": "emoji", "content": "2-3 sentences", "priority": "high|medium|low"}
  ],
  "actionItems": ["specific action 1", "specific action 2", ...]
}

Rules:
- Keep it conversational and concise (like a trusted advisor giving a morning update)
- Lead with the most impactful information
- Include specific numbers and names
- Action items should be specific and actionable (not vague)
- Max 5 sections, max 5 action items
- If revenue is $0, don't lead with it
- If no alerts, mention that positively ("clean slate today")`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text?.trim() ?? "";
    const parsed = JSON.parse(text);

    return {
      orgId,
      greeting: parsed.greeting ?? `Good ${timeOfDay}, ${data.ownerName}!`,
      summary: parsed.summary ?? "",
      sections: (parsed.sections ?? []).map((s: any) => ({
        title: s.title ?? "",
        icon: s.icon ?? "📊",
        content: s.content ?? "",
        priority: s.priority ?? "medium",
      })),
      actionItems: parsed.actionItems ?? [],
      generatedAt: now.toISOString(),
    };
  } catch (err) {
    console.error("[briefing] AI generation failed:", err);
    return buildFallbackBriefing(orgId, data, timeOfDay);
  }
}

// ── Fallback (no AI) ──────────────────────────────────────────────────────────

function buildFallbackBriefing(
  orgId: string,
  data: Record<string, unknown>,
  timeOfDay: string,
): DailyBriefing {
  const sections: BriefingSection[] = [];
  const actionItems: string[] = [];

  // Revenue
  const revenue = data.recentRevenue as number;
  if (revenue > 0) {
    sections.push({
      title: "Revenue",
      icon: "💰",
      content: `$${revenue.toLocaleString()} from ${data.paymentCount} payments in the last 24 hours.`,
      priority: "high",
    });
  }

  // Alerts
  const alerts = data.unreadAlerts as any[];
  if (alerts.length > 0) {
    const criticalCount = (data.alertsBySeverity as any)?.critical ?? 0;
    sections.push({
      title: "Alerts",
      icon: criticalCount > 0 ? "🚨" : "⚠️",
      content: `${alerts.length} unread alert${alerts.length !== 1 ? "s" : ""}${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}. Top: ${alerts.slice(0, 2).map((a: any) => a.title).join(", ")}.`,
      priority: criticalCount > 0 ? "high" : "medium",
    });
    if (criticalCount > 0) actionItems.push("Review critical alerts in your dashboard");
  }

  // Stale contacts
  const stale = data.staleContacts as any[];
  if (stale.length > 0) {
    sections.push({
      title: "Follow-ups Needed",
      icon: "📞",
      content: `${stale.length} contact${stale.length !== 1 ? "s" : ""} haven't been reached in 3+ days: ${stale.slice(0, 3).map((c: any) => c.name).join(", ")}.`,
      priority: "high",
    });
    actionItems.push(`Follow up with ${stale[0]?.name ?? "stale leads"}`);
  }

  // Tickets
  const highPriority = data.highPriorityTickets as any[];
  if (highPriority.length > 0) {
    sections.push({
      title: "High Priority Tickets",
      icon: "🎯",
      content: `${highPriority.length} high-priority ticket${highPriority.length !== 1 ? "s" : ""} open: ${highPriority.slice(0, 2).map((t: any) => t.title).join(", ")}.`,
      priority: "medium",
    });
  }

  return {
    orgId,
    greeting: `Good ${timeOfDay}, ${data.ownerName}!`,
    summary: sections.length > 0
      ? `Here's what needs your attention today.`
      : `Looking good — nothing urgent today.`,
    sections,
    actionItems,
    generatedAt: new Date().toISOString(),
  };
}

// ── Save Briefing ─────────────────────────────────────────────────────────────

export async function saveBriefing(briefing: DailyBriefing): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("daily_briefings").insert({
    org_id: briefing.orgId,
    greeting: briefing.greeting,
    summary: briefing.summary,
    sections: briefing.sections,
    action_items: briefing.actionItems,
    audio_url: briefing.audioUrl ?? null,
    generated_at: briefing.generatedAt,
  });
}
