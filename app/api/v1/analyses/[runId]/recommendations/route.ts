import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { validateApiKey } from "@/lib/api-auth";
import type { MVPDeliverables } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { runId } = await params;

  try {
    const job = await getJob(runId);

    if (!job) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    if (job.status !== "completed" || !job.deliverables) {
      return NextResponse.json(
        { error: "Analysis is not yet complete", status: job.status },
        { status: 422 },
      );
    }

    const d = job.deliverables as MVPDeliverables;
    const ap = d.actionPlan;

    if (!ap) {
      return NextResponse.json(
        { error: "Action plan not available for this analysis" },
        { status: 404 },
      );
    }

    // Extract all tasks with their day/phase context
    const days = (ap as any).days ?? [];
    const allTasks: Array<{
      day: number;
      phase: string;
      description: string;
      owner: string;
      priority?: string;
    }> = [];

    for (const day of days) {
      for (const task of day.tasks ?? []) {
        allTasks.push({
          day: day.day,
          phase: day.title,
          description: task.description,
          owner: task.owner,
          priority: task.priority,
        });
      }
    }

    return NextResponse.json({
      runId,
      summary: (ap as any).summary ?? null,
      totalTasks: allTasks.length,
      days,
      tasks: allTasks,
      decisionBrief: d.decisionBrief ?? null,
      strategicInitiatives: d.strategicInitiatives ?? null,
    });
  } catch (err) {
    console.error("[api/v1/analyses/runId/recommendations]", err);
    return NextResponse.json(
      { error: "Failed to retrieve recommendations" },
      { status: 500 },
    );
  }
}
