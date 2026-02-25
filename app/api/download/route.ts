import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { getReportPath } from "@/lib/pipeline/format";
import { readFile } from "fs/promises";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");
  const format = request.nextUrl.searchParams.get("format") as string | null;

  if (!runId || !format) {
    return NextResponse.json(
      { error: "runId and format (pdf|docx) required" },
      { status: 400 }
    );
  }
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "format must be pdf or docx" }, { status: 400 });
  }

  const job = getJob(runId);
  if (!job || job.status !== "completed") {
    return NextResponse.json(
      { error: "Job not found or not completed" },
      { status: 404 }
    );
  }

  try {
    const filePath = getReportPath(runId, format);
    const buffer = await readFile(filePath);
    const contentType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const filename = `pivot-report.${format}`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Report file not found" }, { status: 404 });
  }
}
