/**
 * Agent Memory Builder
 *
 * After a report is generated, compress the full MVPDeliverables into a
 * lean ~600-word "business intelligence summary" (AgentMemory.summary).
 *
 * This summary is loaded at the start of EVERY ARIA chat session instead
 * of the full report, saving thousands of tokens per conversation while
 * keeping the agent fully context-aware.
 *
 * The agent uses a get_report_section tool when it needs deeper data.
 */
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MVPDeliverables, AgentMemory, WebsiteAnalysis, ConversationInsight, ChatMessage } from "@/lib/types";

const LITE_MODEL = "gemini-2.5-flash";
const supabase = createAdminClient();

export async function buildAgentMemory(
  orgId: string,
  orgName: string,
  runId: string,
  deliverables: MVPDeliverables,
  websiteAnalysis?: WebsiteAnalysis
): Promise<AgentMemory> {
  const apiKey = process.env.GEMINI_API_KEY;
  const hs = deliverables.healthScore;
  const ci = deliverables.cashIntelligence;
  const rl = deliverables.revenueLeakAnalysis;
  const arc = deliverables.atRiskCustomers;
  const db2 = deliverables.decisionBrief;
  const mi = deliverables.marketIntelligence;

  const keyNumbers = {
    healthScore: hs?.score,
    healthGrade: hs?.grade,
    cashRunway: (ci as any)?.runwayWeeks,
    revenueAtRisk: arc?.customers?.reduce((s, c) => s + (c.revenueAtRisk ?? 0), 0),
    totalLeaks: rl?.totalIdentified,
    lastAnalysisDate: Date.now(),
  };

  let summary = buildFallbackSummary(orgName, deliverables, websiteAnalysis);

  // Try to compress with AI for better quality
  if (apiKey) {
    try {
      const genai = new GoogleGenAI({ apiKey });
      const rawData = `
HEALTH: ${hs?.score}/100 Grade ${hs?.grade} — ${hs?.headline ?? hs?.summary}
CASH: ${ci?.summary}
RUNWAY: ${(ci as any)?.runwayWeeks ?? "?"} weeks | Cash Position: $${(ci as any)?.currentCashPosition ?? "unknown"}
CASH RISKS: ${ci?.risks?.slice(0, 3).map(r => r.description).join("; ")}
REVENUE LEAKS: $${rl?.totalIdentified?.toLocaleString()} total | Priority: ${rl?.priorityAction}
TOP LEAK: ${rl?.items?.[0]?.description} — $${rl?.items?.[0]?.amount?.toLocaleString()}
ISSUES: ${deliverables.issuesRegister?.issues?.slice(0, 3).map(i => `[${i.severity}] ${i.description}`).join("; ")}
AT-RISK CUSTOMERS: ${arc?.customers?.map(c => `${c.name} ($${c.revenueAtRisk?.toLocaleString() ?? "?"}) - ${c.risk}`).join("; ")}
DECISION: ${db2?.decision} → Recommendation: ${db2?.recommendation}
NEXT STEP: ${db2?.nextStep}
URGENT OPPORTUNITY: ${mi?.urgentOpportunity ?? "See Growth Intelligence section"}
TOP PERFORMERS DO: ${mi?.whatTopPerformersDo?.slice(0, 2).join("; ")}
WEBSITE: ${websiteAnalysis ? `Grade ${websiteAnalysis.grade} (${websiteAnalysis.score}/100) — ${websiteAnalysis.synopsis}` : "Not analyzed"}
      `.trim();

      const prompt = `Compress this business intelligence data into a PRECISE 500-600 word summary for an AI advisor.

BUSINESS: ${orgName}

DATA:
${rawData}

Write a compact intelligence briefing that an AI advisor can use to answer any question about this business
without re-reading the full report. Include:
- Business health snapshot (score, grade, key concerns)
- Cash situation and biggest financial risks
- Revenue leak summary (total + top 2 leaks)
- Top 3 critical issues (with severity)
- At-risk customer names and amounts
- The key decision and recommendation
- Top growth opportunity
- Website status if available
- Anything that would help advise this owner

Style: Dense, factual, no fluff. Use specific numbers. Written as a briefing document.
Target: 500-600 words exactly.`;

      const resp = await genai.models.generateContent({
        model: LITE_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 900,
        } as Record<string, unknown>,
      });
      if (resp.text) summary = resp.text;
    } catch (e) {
      console.warn("[Memory] AI compression failed, using fallback:", e);
    }
  }

  // Get existing memory for this org to append report summaries
  const existing = await getAgentMemory(orgId);
  const existingSummaries = existing?.reportSummaries ?? [];

  const newSummary: AgentMemory["reportSummaries"][number] = {
    runId,
    date: Date.now(),
    headline: hs?.headline ?? hs?.summary?.slice(0, 100) ?? "Analysis complete",
    score: hs?.score,
    grade: hs?.grade,
  };

  const reportSummaries = [
    newSummary,
    ...existingSummaries.filter((r) => r.runId !== runId),
  ].slice(0, 10); // keep last 10

  const memory: AgentMemory = {
    orgId,
    orgName,
    summary,
    keyNumbers,
    reportSummaries,
    websiteGrade: websiteAnalysis?.grade,
    lastUpdated: Date.now(),
  };

  // Persist to DB
  await saveAgentMemory(orgId, memory);

  return memory;
}

function buildFallbackSummary(
  orgName: string,
  d: MVPDeliverables,
  wa?: WebsiteAnalysis
): string {
  const hs = d.healthScore;
  const ci = d.cashIntelligence;
  const rl = d.revenueLeakAnalysis;
  const arc = d.atRiskCustomers;
  const db2 = d.decisionBrief;

  return `BUSINESS: ${orgName}
HEALTH: ${hs?.score ?? "?"}/100 Grade ${hs?.grade ?? "?"} — ${hs?.headline ?? hs?.summary ?? ""}
CASH: ${ci?.summary ?? ""}
REVENUE LEAKS: $${rl?.totalIdentified?.toLocaleString() ?? 0} identified
AT-RISK: ${arc?.customers?.map(c => c.name).join(", ") ?? "None identified"}
KEY DECISION: ${db2?.decision ?? ""}
RECOMMENDATION: ${db2?.recommendation ?? ""}
WEBSITE: ${wa ? `Grade ${wa.grade} — ${wa.synopsis}` : "Not analyzed"}`;
}

// ── DB helpers (Supabase) ────────────────────────────────────────────────────

export async function getAgentMemory(orgId: string): Promise<AgentMemory | null> {
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("agent_memory_json")
      .eq("id", orgId)
      .single();

    if (error || !data?.agent_memory_json) return null;

    // Supabase returns JSONB as already-parsed objects
    const raw = data.agent_memory_json;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as AgentMemory;
  } catch {
    return null;
  }
}

export async function saveAgentMemory(orgId: string, memory: AgentMemory): Promise<void> {
  try {
    await supabase
      .from("organizations")
      .update({ agent_memory_json: memory })
      .eq("id", orgId);
  } catch (e) {
    console.warn("[Memory] Failed to save agent memory:", e);
  }
}

export async function getOrgWebsiteAnalysis(orgId: string): Promise<WebsiteAnalysis | null> {
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("website_analysis_json")
      .eq("id", orgId)
      .single();

    if (error || !data?.website_analysis_json) return null;

    const raw = data.website_analysis_json;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as WebsiteAnalysis;
  } catch {
    return null;
  }
}

export async function saveWebsiteAnalysis(orgId: string, analysis: WebsiteAnalysis): Promise<void> {
  try {
    await supabase
      .from("organizations")
      .update({ website_analysis_json: analysis, website: analysis.url })
      .eq("id", orgId);
  } catch (e) {
    console.warn("[Memory] Failed to save website analysis:", e);
  }
}

// ── Conversation Memory ─────────────────────────────────────────────────────

const MAX_INSIGHTS = 20;

/**
 * Extract key facts from a conversation turn and save them to memory.
 * Runs async after the response is sent — does not block the user.
 */
export async function extractAndSaveConversationInsights(
  orgId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const genai = new GoogleGenAI({ apiKey });
    const resp = await genai.models.generateContent({
      model: LITE_MODEL,
      contents: `Extract key business facts from this conversation exchange that would be useful to remember in FUTURE conversations. Only extract facts that reveal the user's priorities, decisions, concerns, or preferences — NOT facts already in the business report.

USER: ${userMessage.slice(0, 500)}
ASSISTANT: ${assistantMessage.slice(0, 1000)}

Return ONLY a JSON array of objects, or an empty array [] if nothing worth remembering:
[{"fact": "short factual statement", "category": "priority|decision|concern|preference|context"}]

Rules:
- Max 2 insights per exchange
- Skip generic questions ("what's my health score") — only save things that reveal intent
- "User wants to fix revenue leaks before Q2" = GOOD (reveals priority + timeline)
- "User asked about health score" = BAD (too generic)
- "User decided to raise prices by 15%" = GOOD (decision)
- Keep facts under 80 characters`,
      config: {
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    const text = resp.text?.trim();
    if (!text) return;

    let insights: ConversationInsight[];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      insights = parsed.slice(0, 2).map((item: any) => ({
        fact: String(item.fact).slice(0, 120),
        category: ["priority", "decision", "concern", "preference", "context"].includes(item.category)
          ? item.category
          : "context",
        createdAt: Date.now(),
      }));
    } catch {
      return;
    }

    // Load existing memory and append
    const memory = await getAgentMemory(orgId);
    if (!memory) return;

    const existing = memory.conversationInsights ?? [];

    // Deduplicate: skip if a very similar fact already exists
    const newInsights = insights.filter((newI) =>
      !existing.some((old) =>
        old.fact.toLowerCase().includes(newI.fact.toLowerCase().slice(0, 30)) ||
        newI.fact.toLowerCase().includes(old.fact.toLowerCase().slice(0, 30))
      )
    );

    if (newInsights.length === 0) return;

    // Keep most recent MAX_INSIGHTS
    memory.conversationInsights = [...newInsights, ...existing].slice(0, MAX_INSIGHTS);
    await saveAgentMemory(orgId, memory);

    console.log(`[Memory] Saved ${newInsights.length} conversation insight(s) for org ${orgId}`);
  } catch (e) {
    // Non-critical — don't let memory extraction break the flow
    console.warn("[Memory] Conversation insight extraction failed:", e);
  }
}

/**
 * Format conversation insights for injection into system prompt.
 */
export function formatConversationInsights(memory: AgentMemory): string {
  const insights = memory.conversationInsights;
  if (!insights || insights.length === 0) return "";

  const lines = insights.slice(0, 10).map((i) => {
    const age = Date.now() - i.createdAt;
    const daysAgo = Math.floor(age / (1000 * 60 * 60 * 24));
    const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
    return `- [${i.category}] ${i.fact} (${timeLabel})`;
  });

  return `\nCONVERSATION MEMORY (from past sessions):\n${lines.join("\n")}`;
}
