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
    const ir = d.issuesRegister;

    if (!ir) {
      return NextResponse.json(
        { error: "Issues register not available for this analysis" },
        { status: 404 },
      );
    }

    // Combine issues and risk register if available
    const issues = (ir as any).issues ?? [];
    const riskRegister = d.riskRegister ?? null;

    // Count by severity
    const severityCounts: Record<string, number> = {};
    for (const issue of issues) {
      const sev = (issue as any).severity ?? "Unknown";
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    }

    return NextResponse.json({
      runId,
      totalIssues: issues.length,
      severityCounts,
      issues,
      riskRegister,
    });
  } catch (err) {
    console.error("[api/v1/analyses/runId/issues]", err);
    return NextResponse.json(
      { error: "Failed to retrieve issues" },
      { status: 500 },
    );
  }
}
