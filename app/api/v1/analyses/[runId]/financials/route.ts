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
    const job = await getJob(runId);

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
      runId,
      cashIntelligence: d.cashIntelligence ?? null,
      revenueLeakAnalysis: d.revenueLeakAnalysis ?? null,
      unitEconomics: d.unitEconomics ?? null,
      revenueForecast: d.revenueForecast ?? null,
      financialRatios: d.financialRatios ?? null,
      cashOptimization: d.cashOptimization ?? null,
      cashFlowSensitivity: d.cashFlowSensitivity ?? null,
      cashConversionCycle: d.cashConversionCycle ?? null,
      revenueAttribution: d.revenueAttribution ?? null,
      dataProvenance: d.dataProvenance ?? null,
    });
  } catch (err) {
    console.error("[api/v1/analyses/runId/financials]", err);
    return NextResponse.json(
      { error: "Failed to retrieve financial data" },
      { status: 500 },
    );
  }
}
