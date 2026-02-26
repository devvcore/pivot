import { NextRequest, NextResponse } from "next/server";
import { generatePitchDeck, checkSlideJob } from "@/lib/agent/pitch-deck-analyzer";
import { getJob } from "@/lib/job-store";
import type { MVPDeliverables } from "@/lib/types";

/**
 * POST /api/pitch-deck/generate
 * Generates a pitch deck via 2slides API using report data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const job = getJob(runId);
    if (!job?.deliverables) {
      return NextResponse.json({ error: "No completed report found" }, { status: 404 });
    }

    const d = job.deliverables as MVPDeliverables;
    const q = job.questionnaire;

    // Build generation request from report data
    const pitchDeck = d.pitchDeckAnalysis;
    const result = await generatePitchDeck({
      companyName: q.organizationName,
      industry: q.industry,
      businessModel: q.businessModel,
      problemStatement: pitchDeck?.extractedContent?.problemStatement ?? undefined,
      solution: pitchDeck?.extractedContent?.solution ?? undefined,
      traction: pitchDeck?.extractedContent?.traction ?? undefined,
      fundingAsk: pitchDeck?.extractedContent?.fundingAsk ?? undefined,
      additionalContext: d.healthScore?.summary ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PitchDeck] Generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pitch-deck/generate?jobId=...
 * Checks the status of a 2slides generation job.
 */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const status = await checkSlideJob(jobId);
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
