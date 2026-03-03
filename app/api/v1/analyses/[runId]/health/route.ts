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
    const job = getJob(runId);

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
    const hs = d.healthScore;

    if (!hs) {
      return NextResponse.json(
        { error: "Health score data not available for this analysis" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      runId,
      score: hs.score,
      grade: hs.grade,
      summary: hs.summary ?? null,
      dimensions: hs.dimensions ?? [],
      benchmarkScore: d.benchmarkScore ?? null,
      healthChecklist: d.healthChecklist ?? null,
    });
  } catch (err) {
    console.error("[api/v1/analyses/runId/health]", err);
    return NextResponse.json(
      { error: "Failed to retrieve health score" },
      { status: 500 },
    );
  }
}
