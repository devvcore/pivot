import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { createShareLink } from "@/lib/share-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, role, employeeName, expiresInDays } = body;

    if (!runId || !role) {
      return NextResponse.json(
        { error: "runId and role are required" },
        { status: 400 },
      );
    }

    if (!["owner", "employee", "coach", "other"].includes(role)) {
      return NextResponse.json(
        { error: "role must be owner, employee, coach, or other" },
        { status: 400 },
      );
    }

    if (role === "employee" && !employeeName) {
      return NextResponse.json(
        { error: "employeeName is required for employee role" },
        { status: 400 },
      );
    }

    const job = await getJob(runId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const orgId = job.questionnaire.orgId || "default-org";

    const link = await createShareLink({
      orgId,
      jobId: runId,
      createdBy: "owner", // MVP: no auth, assume owner
      role,
      employeeName: employeeName || undefined,
      expiresInDays: expiresInDays || undefined,
    });

    return NextResponse.json({
      token: link.token,
      url: `/shared/${link.token}`,
      role: link.role,
      employeeName: link.employeeName,
      id: link.id,
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    console.error("[api/share/create]", err);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 },
    );
  }
}
