import { NextRequest, NextResponse } from "next/server";
import { getShareLinkByToken } from "@/lib/share-store";
import { getJob } from "@/lib/job-store";
import { filterDeliverablesForRole } from "@/lib/role-filter";
import type { MVPDeliverables } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const shareLink = await getShareLinkByToken(token);

    if (!shareLink) {
      return NextResponse.json(
        { error: "Invalid or expired share link" },
        { status: 404 },
      );
    }

    const job = await getJob(shareLink.jobId);

    if (!job || !job.deliverables) {
      return NextResponse.json(
        { error: "Analysis not found or not yet complete" },
        { status: 404 },
      );
    }

    const d = job.deliverables as MVPDeliverables;
    const filtered = filterDeliverablesForRole(d, shareLink.role, shareLink.employeeName);

    return NextResponse.json({
      role: shareLink.role,
      employeeName: shareLink.employeeName ?? null,
      orgName: job.questionnaire.organizationName,
      runId: shareLink.jobId,
      deliverables: filtered,
    });
  } catch (err) {
    console.error("[api/share/token]", err);
    return NextResponse.json(
      { error: "Failed to validate share link" },
      { status: 500 },
    );
  }
}
