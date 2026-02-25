import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { parseFiles } from "@/lib/pipeline/parse";
import { extractQuestionnaireFromDocuments } from "@/lib/agent/extract-questionnaire";

export async function POST(req: NextRequest) {
  try {
    const { runId, website } = (await req.json()) as { runId?: string; website?: string };
    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const job = getJob(runId);
    if (!job || !job.filePaths?.length) {
      return NextResponse.json({ error: "Job not found or no files" }, { status: 404 });
    }

    const parsedFiles = await parseFiles(runId, job.filePaths);
    const extracted = await extractQuestionnaireFromDocuments(parsedFiles, website);

    return NextResponse.json({ extracted });
  } catch (e) {
    console.error("[extract]", e);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
