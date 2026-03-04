import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/job-store";
import { validateApiKey } from "@/lib/api-auth";
import type { MVPDeliverables } from "@/lib/types";

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const jobs = await listJobs();

    const analyses = jobs
      .filter((j) => j.status === "completed" && j.deliverables)
      .map((j) => {
        const d = j.deliverables as MVPDeliverables;
        return {
          runId: j.runId,
          orgName: j.questionnaire.organizationName,
          industry: j.questionnaire.industry,
          date: new Date(j.createdAt).toISOString(),
          healthScore: d.healthScore?.score ?? null,
          grade: d.healthScore?.grade ?? null,
          status: j.status,
        };
      });

    return NextResponse.json({ analyses, count: analyses.length });
  } catch (err) {
    console.error("[api/v1/analyses]", err);
    return NextResponse.json(
      { error: "Failed to list analyses" },
      { status: 500 },
    );
  }
}
