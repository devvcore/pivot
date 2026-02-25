import { NextResponse } from "next/server";
import { createJob, updateJob } from "@/lib/job-store";
import { parseQuestionnaire, saveUploadedFiles } from "@/lib/upload";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const questionnaire = parseQuestionnaire(formData);

    // Allow upload-first flow: org name can be empty (filled later via chat)
    const q = { ...questionnaire };
    if (!q.organizationName?.trim()) {
      q.organizationName = "TBD";
    }

    const job = createJob(q, []);
    const { filePaths, error: saveError } = await saveUploadedFiles(job.runId, formData);
    if (saveError) {
      return NextResponse.json({ error: saveError }, { status: 400 });
    }
    updateJob(job.runId, { filePaths });

    return NextResponse.json({ runId: job.runId });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
