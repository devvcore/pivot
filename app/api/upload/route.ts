import { NextResponse } from "next/server";
import { createJob, updateJob } from "@/lib/job-store";
import { parseQuestionnaire, saveUploadedFiles } from "@/lib/upload";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const questionnaire = parseQuestionnaire(formData);

    if (!questionnaire.organizationName?.trim()) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    const job = createJob(questionnaire, []);
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
