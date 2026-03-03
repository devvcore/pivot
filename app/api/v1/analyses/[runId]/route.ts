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

    return NextResponse.json({
      runId: job.runId,
      status: job.status,
      orgName: job.questionnaire.organizationName,
      industry: job.questionnaire.industry,
      date: new Date(job.createdAt).toISOString(),
      healthScore: d.healthScore ?? null,
      cashIntelligence: d.cashIntelligence ?? null,
      revenueLeakAnalysis: d.revenueLeakAnalysis ?? null,
      issuesRegister: d.issuesRegister ?? null,
      atRiskCustomers: d.atRiskCustomers ?? null,
      decisionBrief: d.decisionBrief ?? null,
      actionPlan: d.actionPlan ?? null,
      competitorAnalysis: d.competitorAnalysis ?? null,
      executiveSummary: d.executiveSummary ?? null,
      swotAnalysis: d.swotAnalysis ?? null,
      dataProvenance: d.dataProvenance ?? null,
    });
  } catch (err) {
    console.error("[api/v1/analyses/runId]", err);
    return NextResponse.json(
      { error: "Failed to retrieve analysis" },
      { status: 500 },
    );
  }
}
