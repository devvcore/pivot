import { NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/job-store";
import { saveUploadedFiles } from "@/lib/upload";
import { runPipeline } from "@/lib/pipeline/run";

/**
 * POST /api/job/reupload
 * Upload additional documents to an existing (completed) analysis and re-run the pipeline.
 * New files are appended to the existing file list. The pipeline re-parses ALL files
 * (old + new) with newer files getting recency preference for conflict resolution.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const runId = formData.get("runId") as string;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const job = await getJob(runId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Don't allow re-upload while pipeline is actively running
    const activeStatuses = ["parsing", "ingesting", "synthesizing", "formatting"];
    if (activeStatuses.includes(job.status)) {
      return NextResponse.json(
        { error: "Analysis is currently running. Please wait for it to complete." },
        { status: 409 },
      );
    }

    // Save new files to the existing upload directory
    const { filePaths: newPaths, error: saveError } = await saveUploadedFiles(runId, formData);
    if (saveError) {
      return NextResponse.json({ error: saveError }, { status: 400 });
    }
    if (!newPaths.length) {
      return NextResponse.json({ error: "No valid files uploaded" }, { status: 400 });
    }

    // Merge: existing files + new files
    const allPaths = [...(job.filePaths || []), ...newPaths];

    // Reset job for re-processing:
    // - Clear parsedContext to force full re-parse of all files (old + new)
    // - Clear deliverables to force full re-synthesis
    // - Clear error state
    // - Set status to pending so pipeline picks it up fresh
    await updateJob(runId, {
      filePaths: allPaths,
      status: "pending",
      phase: "INGEST",
      parsedContext: null as any,
      deliverables: null as any,
      knowledgeGraph: null as any,
      error: null as any,
    });

    // Start pipeline in background
    runPipeline(runId).catch((err: unknown) => {
      console.error("Re-upload pipeline error for", runId, err);
    });

    return NextResponse.json({
      runId,
      status: "reprocessing",
      newFiles: newPaths.length,
      totalFiles: allPaths.length,
    });
  } catch (e) {
    console.error("Reupload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Re-upload failed" },
      { status: 500 },
    );
  }
}
