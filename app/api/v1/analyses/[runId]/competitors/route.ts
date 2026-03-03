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

    return NextResponse.json({
      runId,
      competitorAnalysis: d.competitorAnalysis ?? null,
      competitiveWinLoss: d.competitiveWinLoss ?? null,
      competitiveMoat: d.competitiveMoat ?? null,
      competitiveIntelFeed: d.competitiveIntelFeed ?? null,
      marketIntelligence: d.marketIntelligence ?? null,
      swotAnalysis: d.swotAnalysis ?? null,
    });
  } catch (err) {
    console.error("[api/v1/analyses/runId/competitors]", err);
    return NextResponse.json(
      { error: "Failed to retrieve competitor data" },
      { status: 500 },
    );
  }
}
