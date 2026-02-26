import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { runPipeline } from "@/lib/pipeline/run";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  const job = getJob(runId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}

/** Start the pipeline for a run (called after upload). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const runId = (body.runId ?? request.nextUrl.searchParams.get("runId")) as string | null;
    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }
    const job = getJob(runId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.status === "completed") {
      return NextResponse.json({ runId, status: job.status, message: "Pipeline already completed" });
    }
    const alreadyRunning = ["parsing", "ingesting", "synthesizing", "formatting"].includes(job.status);
    if (alreadyRunning) {
      return NextResponse.json({ runId, status: job.status, message: "Pipeline is running" });
    }
    runPipeline(runId).catch((err: unknown) => {
      console.error("Pipeline error for", runId, err);
    });
    return NextResponse.json({ runId, status: "started" });
  } catch (e) {
    console.error("Job run error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start pipeline" },
      { status: 500 }
    );
  }
}
