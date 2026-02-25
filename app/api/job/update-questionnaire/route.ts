import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/job-store";
import type { Questionnaire } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runId, questionnaire } = body as { runId?: string; questionnaire?: Questionnaire };
    if (!runId || !questionnaire) {
      return NextResponse.json({ error: "runId and questionnaire required" }, { status: 400 });
    }

    const job = getJob(runId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    updateJob(runId, { questionnaire });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[update-questionnaire]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
