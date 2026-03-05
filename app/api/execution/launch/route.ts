import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createOrchestrator } from "@/lib/execution/orchestrator";

/**
 * POST /api/execution/launch
 * Launch execution from analysis recommendations.
 * Creates tasks, assigns agents, and triggers the orchestrator pipeline.
 *
 * Body: {
 *   orgId: string,
 *   recommendations: Array<{
 *     id: string,
 *     title: string,
 *     description: string,
 *     agentId: string,
 *     priority?: 'low' | 'medium' | 'high' | 'urgent',
 *     costCeiling?: number,
 *     deliverables?: object,
 *   }>,
 *   budget?: number,         // Total budget cap across all tasks
 *   defaultPriority?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orgId, recommendations, budget, defaultPriority } = body;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      return NextResponse.json(
        { error: "recommendations array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate each recommendation has required fields
    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      if (!rec.title || !rec.agentId) {
        return NextResponse.json(
          { error: `Recommendation at index ${i} must have title and agentId` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // Calculate per-task cost ceiling if a total budget is specified
    const totalBudget = budget || null;
    let remainingBudget = totalBudget;

    const createdTasks: Array<{
      id: string;
      title: string;
      agentId: string;
      status: string;
      recommendationId: string | null;
    }> = [];

    const errors: Array<{ index: number; title: string; error: string }> = [];

    // Create tasks for each recommendation
    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];

      // Determine cost ceiling for this task
      let taskCostCeiling = rec.costCeiling || 1.0;
      if (remainingBudget !== null) {
        taskCostCeiling = Math.min(taskCostCeiling, remainingBudget);
        if (taskCostCeiling <= 0) {
          errors.push({
            index: i,
            title: rec.title,
            error: "Budget exhausted, task not created",
          });
          continue;
        }
        remainingBudget -= taskCostCeiling;
      }

      const priority = rec.priority || defaultPriority || "medium";

      // Insert the task
      const { data: task, error: insertError } = await supabase
        .from("execution_tasks")
        .insert({
          org_id: orgId,
          title: rec.title,
          description: rec.description || null,
          agent_id: rec.agentId,
          priority,
          cost_ceiling: taskCostCeiling,
          status: "queued",
          source_recommendation_id: rec.id || null,
        })
        .select("id, title, agent_id, status")
        .single();

      if (insertError || !task) {
        errors.push({
          index: i,
          title: rec.title,
          error: insertError?.message || "Failed to create task",
        });
        continue;
      }

      createdTasks.push({
        id: task.id,
        title: task.title,
        agentId: task.agent_id,
        status: task.status,
        recommendationId: rec.id || null,
      });

      // Log creation event
      await supabase.from("execution_events").insert({
        task_id: task.id,
        agent_id: rec.agentId,
        org_id: orgId,
        event_type: "status_change",
        data: {
          from: null,
          to: "queued",
          title: rec.title,
          launchedFrom: "recommendations",
          recommendationId: rec.id || null,
        },
      });

      // Fire pipeline async (non-blocking) for each task
      const orchestrator = createOrchestrator(rec.deliverables);
      orchestrator.runPipeline(task.id).catch((err: Error) => {
        console.error(`[POST /api/execution/launch] Pipeline failed for ${task.id}:`, err.message);
      });
    }

    return NextResponse.json(
      {
        launched: createdTasks.length,
        failed: errors.length,
        tasks: createdTasks,
        errors: errors.length > 0 ? errors : undefined,
        budgetRemaining: remainingBudget,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/execution/launch]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to launch execution" },
      { status: 500 }
    );
  }
}
