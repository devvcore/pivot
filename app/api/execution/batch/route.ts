import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createOrchestrator } from "@/lib/execution/orchestrator";
import { collectIntegrationContext, formatIntegrationContextAsText } from "@/lib/integrations/collect";
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from "uuid";

const VALID_AGENTS = [
  "strategist", "marketer", "analyst", "recruiter",
  "operator", "researcher", "codebot",
];

/* ── Keyword fallback router (same as tasks/route.ts) ── */
function autoRouteAgent(message: string): string {
  const lower = message.toLowerCase();
  const keywords: [string[], string][] = [
    [["linkedin", "instagram", "social", "post", "content", "ad ", "campaign", "seo", "landing page", "email campaign", "marketing", "brand"], "marketer"],
    [["budget", "invoice", "financial", "forecast", "pricing", "expense", "revenue", "cash", "profit", "burn rate", "unit economics"], "analyst"],
    [["hire", "job posting", "interview", "salary", "onboard", "recruit", "talent", "performance review", "hr "], "recruiter"],
    [["process", "sop", "risk", "vendor", "project plan", "operations", "workflow", "compliance"], "operator"],
    [["research", "competitor", "market", "benchmark", "trend", "industry", "analyze"], "researcher"],
    [["code", "github", "repo", "pull request", "ci/cd", "engineer", "deploy", "bug"], "codebot"],
    [["strategy", "plan", "goal", "okr", "prioritize", "roadmap", "coordinate"], "strategist"],
  ];
  for (const [words, agent] of keywords) {
    if (words.some((w) => lower.includes(w))) return agent;
  }
  return "strategist";
}

/**
 * POST /api/execution/batch
 * Split a user message into multiple tasks using Gemini, create them, and run in parallel.
 *
 * Body: { orgId: string, message: string, costCeiling?: number }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orgId, message, costCeiling, conversationId } = body;

    if (!orgId || !message) {
      return NextResponse.json({ error: "orgId and message are required" }, { status: 400 });
    }

    // ── 1. Use Gemini Flash to split the message into tasks ──
    let parsedTasks: { title: string; agentId: string }[] = [];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const splitPrompt = `You are a task router for a business AI platform. Given a user message that may contain multiple tasks, split it into individual tasks and assign each to the best agent.

Available agents:
- strategist: Strategy, planning, OKRs, roadmaps, growth plans
- marketer: Marketing, content, social media, ads, SEO, email campaigns
- analyst: Finance, budgets, projections, invoicing, pricing, unit economics
- recruiter: HR, hiring, job postings, interviews, salary, onboarding
- operator: Operations, SOPs, risk, vendor management, project plans, compliance
- researcher: Market research, competitors, benchmarks, industry trends
- codebot: GitHub, code, PRs, engineering, CI/CD, repos

User message:
"""
${message}
"""

Output ONLY a JSON array. Each item must have:
- "title": a clear, actionable task title (one sentence)
- "agentId": one of the agent IDs listed above

If the message is a single task, return an array with one item.
Example: [{"title": "Create LinkedIn posts about our AI product", "agentId": "marketer"}]`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: splitPrompt,
        config: { temperature: 0.1, maxOutputTokens: 1000 },
      });

      const text = result.text ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        let raw: Array<{ title?: string; agentId?: string }>;
        try { raw = JSON.parse(jsonMatch[0]); } catch { raw = []; }
        if (Array.isArray(raw) && raw.length > 0) {
          parsedTasks = raw.map((item: { title?: string; agentId?: string }) => ({
            title: (item.title ?? "").trim(),
            agentId: VALID_AGENTS.includes(item.agentId ?? "")
              ? item.agentId!
              : autoRouteAgent(item.title ?? message),
          })).filter((t: { title: string }) => t.title.length > 0);
        }
      }
    } catch (err) {
      console.error("[POST /api/execution/batch] Gemini split failed:", err);
    }

    // Fallback: if Gemini parsing failed, create a single task
    if (parsedTasks.length === 0) {
      parsedTasks = [{ title: message, agentId: autoRouteAgent(message) }];
    }

    console.log(`[POST /api/execution/batch] Split "${message.slice(0, 60)}..." → ${parsedTasks.length} tasks`);

    // ── 2. Load deliverables from latest completed analysis for THIS org ──
    const supabase = createAdminClient();
    let deliverables: Record<string, unknown> | undefined;

    const { data: latestJob, error: jobError } = await supabase
      .from("jobs")
      .select("results_json")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (jobError) {
      console.log(`[POST /api/execution/batch] No completed analysis for org ${orgId}: ${jobError.message}`);
    } else if (latestJob?.results_json) {
      deliverables = latestJob.results_json as Record<string, unknown>;
      console.log(`[POST /api/execution/batch] Loaded deliverables (${Object.keys(deliverables).length} sections)`);
    }

    // ── 2b. Load integration data (Stripe, Salesforce, GitHub, etc.) ──
    const integrationCtx = await collectIntegrationContext(orgId);
    const integrationText = formatIntegrationContextAsText(integrationCtx);
    if (integrationCtx.providers.length > 0) {
      console.log(`[POST /api/execution/batch] Loaded integration data from: ${integrationCtx.providers.join(", ")}`);
      // Inject integration data into deliverables so agents see it
      if (!deliverables) deliverables = {};
      deliverables.__integrationData = integrationText;
      deliverables.__integrationProviders = integrationCtx.providers;
    }

    // ── 3. Create tasks and fire pipelines ──
    const batchId = uuidv4();
    const taskCeiling = costCeiling ?? 0.50;
    const createdTasks: { id: string; title: string; agentId: string; status: string }[] = [];

    for (const parsed of parsedTasks) {
      const { data: task, error: insertError } = await supabase
        .from("execution_tasks")
        .insert({
          org_id: orgId,
          title: parsed.title,
          agent_id: parsed.agentId,
          priority: "medium",
          cost_ceiling: taskCeiling,
          status: "queued",
        })
        .select("id, title, agent_id, status")
        .single();

      if (insertError || !task) {
        console.error("[POST /api/execution/batch] Insert error:", insertError?.message);
        continue;
      }

      // Log session_start with batch context
      await supabase.from("execution_events").insert({
        task_id: task.id,
        agent_id: parsed.agentId,
        org_id: orgId,
        event_type: "session_start",
        data: { userMessage: message, source: "batch", batchId, conversationId: conversationId || undefined },
      });

      // Log status_change
      await supabase.from("execution_events").insert({
        task_id: task.id,
        agent_id: parsed.agentId,
        org_id: orgId,
        event_type: "status_change",
        data: { from: null, to: "queued", title: parsed.title, batchId },
      });

      createdTasks.push({
        id: task.id,
        title: task.title,
        agentId: task.agent_id,
        status: task.status,
      });

      // Fire pipeline async (non-blocking)
      const orchestrator = createOrchestrator(deliverables);
      orchestrator.runPipeline(task.id).catch(async (err: Error) => {
        console.error(`[POST /api/execution/batch] Pipeline failed for ${task.id}:`, err.message);
        // Update task status so UI doesn't show "queued" forever
        try {
          await supabase.from("execution_tasks").update({ status: "failed", review_feedback: err.message }).eq("id", task.id);
          await supabase.from("execution_events").insert({
            task_id: task.id, agent_id: parsed.agentId, org_id: orgId,
            event_type: "error", data: { error: err.message, phase: "pipeline" },
          });
        } catch { /* best-effort status update */ }
      });
    }

    return NextResponse.json(
      { tasks: createdTasks, splitCount: createdTasks.length, batchId },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/execution/batch]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process batch" },
      { status: 500 }
    );
  }
}
