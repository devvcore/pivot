import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createOrchestrator } from "@/lib/execution/orchestrator";
import { collectIntegrationContext, formatIntegrationContextAsText } from "@/lib/integrations/collect";
import { getAgentForCategory } from "@/lib/execution/agents";

/* ── Auto-route: pick best agent from user message ── */
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
    if (words.some(w => lower.includes(w))) return agent;
  }
  return "strategist"; // default
}

/**
 * GET /api/execution/tasks?orgId=...&status=...&agentId=...&limit=...&offset=...
 * List execution tasks for an org with optional filtering.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const status = searchParams.get("status");
    const agentId = searchParams.get("agentId");
    const priority = searchParams.get("priority");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = createAdminClient();

    let query = supabase
      .from("execution_tasks")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (agentId) {
      query = query.eq("agent_id", agentId);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/execution/tasks]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tasks: data,
      total: count,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[GET /api/execution/tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execution/tasks
 * Create a new execution task and trigger the orchestrator pipeline.
 *
 * Body: {
 *   orgId: string,
 *   title: string,
 *   description?: string,
 *   agentId: string,
 *   priority?: 'low' | 'medium' | 'high' | 'urgent',
 *   costCeiling?: number,
 *   deliverables?: object,
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    let { orgId, title, agentId, description, priority, costCeiling, deliverables, conversationId, attachments } = body;

    if (!orgId || !title || !agentId) {
      return NextResponse.json(
        { error: "orgId, title, and agentId are required" },
        { status: 400 }
      );
    }

    // Auto-route: resolve "auto" to the best specialist agent
    if (agentId === "auto") {
      agentId = autoRouteAgent(title);
      console.log(`[POST /api/execution/tasks] Auto-routed "${title}" → ${agentId}`);
    }

    const supabase = createAdminClient();

    // Load deliverables from latest completed analysis for THIS org if not provided
    if (!deliverables) {
      const { data: latestJob, error: jobError } = await supabase
        .from("jobs")
        .select("results_json")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (jobError) {
        console.log(`[POST /api/execution/tasks] No completed analysis for org ${orgId}: ${jobError.message}`);
      } else if (latestJob?.results_json) {
        deliverables = latestJob.results_json;
        console.log(`[POST /api/execution/tasks] Loaded deliverables (${Object.keys(deliverables as Record<string, unknown>).length} sections)`);
      }
    }

    // Load integration data (Stripe, Salesforce, GitHub, etc.)
    const integrationCtx = await collectIntegrationContext(orgId);
    const integrationText = formatIntegrationContextAsText(integrationCtx);
    if (integrationCtx.providers.length > 0) {
      console.log(`[POST /api/execution/tasks] Loaded integration data from: ${integrationCtx.providers.join(", ")}`);
      if (!deliverables) deliverables = {};
      (deliverables as Record<string, unknown>).__integrationData = integrationText;
      (deliverables as Record<string, unknown>).__integrationProviders = integrationCtx.providers;
    }

    // Build description with attachment info for agent context
    let taskDescription = description || '';
    if (attachments?.length > 0) {
      const attachmentLines = attachments.map(
        (a: { name: string; url: string; type: string }) =>
          `- [${a.name}](${a.url}) (${a.type})`
      );
      taskDescription += `${taskDescription ? '\n\n' : ''}USER ATTACHMENTS (files uploaded by the user — use these URLs directly):\n${attachmentLines.join('\n')}`;
    }

    // Create the task record
    const { data: task, error: insertError } = await supabase
      .from("execution_tasks")
      .insert({
        org_id: orgId,
        title,
        description: taskDescription || null,
        agent_id: agentId,
        priority: priority || "medium",
        cost_ceiling: costCeiling || 1.0,
        status: "queued",
      })
      .select()
      .single();

    if (insertError || !task) {
      console.error("[POST /api/execution/tasks] insert error", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to create task" },
        { status: 500 }
      );
    }

    // Log session_start with user's original message (for state hydration)
    await supabase.from("execution_events").insert({
      task_id: task.id,
      agent_id: agentId,
      org_id: orgId,
      event_type: "session_start",
      data: {
        userMessage: title,
        source: "chat",
        conversationId: conversationId || undefined,
        ...(attachments?.length > 0 && { attachments }),
      },
    });

    // Log creation event
    await supabase.from("execution_events").insert({
      task_id: task.id,
      agent_id: agentId,
      org_id: orgId,
      event_type: "status_change",
      data: { from: null, to: "queued", title },
    });

    // Run pipeline async (non-blocking) — fire and forget
    const orchestrator = createOrchestrator(deliverables);
    orchestrator.runPipeline(task.id).catch((err: Error) => {
      console.error(`[POST /api/execution/tasks] Pipeline failed for ${task.id}:`, err.message);
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/execution/tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 }
    );
  }
}
