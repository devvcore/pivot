// ═══════════════════════════════════════════════════════════════
// Pivot — HR Workforce Analytics Endpoint
// GET retrieves AI-analyzed workforce data for an organization
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { listHREmployeeData, listCommunicationInsights } from "@/lib/integrations/store";
import { analyzeWorkforce } from "@/lib/integrations/hr-analyzer";

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("orgId");
    const source = request.nextUrl.searchParams.get("source") as
      | "adp"
      | "workday"
      | "manual"
      | null;
    const businessContext = request.nextUrl.searchParams.get("context") || undefined;

    // ── Validate input ─────────────────────────────────────────────
    if (!orgId) {
      return NextResponse.json(
        { error: "orgId query parameter is required" },
        { status: 400 }
      );
    }

    // ── Fetch HR employee data ─────────────────────────────────────
    const hrData = await listHREmployeeData(
      orgId,
      source || undefined
    );

    if (hrData.length === 0) {
      return NextResponse.json({
        employees: [],
        teamHealthScore: 0,
        departmentBreakdown: {},
        totalPayrollCost: 0,
        estimatedROI: 0,
        avgTenure: 0,
        turnoverRisk: 0,
        recommendations: [
          "No employee data found. Sync data from ADP or Workday to begin workforce analysis.",
        ],
        analyzedAt: new Date().toISOString(),
        source: source || "all",
        employeeCount: 0,
      });
    }

    // ── Fetch communication insights for cross-referencing ─────────
    let communicationInsights;
    try {
      communicationInsights = await listCommunicationInsights(orgId);
    } catch {
      // Communication insights are optional; proceed without them
      communicationInsights = [];
    }

    // ── Run workforce analysis ─────────────────────────────────────
    const analytics = await analyzeWorkforce(
      orgId,
      hrData,
      communicationInsights,
      businessContext
    );

    // ── Return results ─────────────────────────────────────────────
    return NextResponse.json({
      ...analytics,
      source: source || "all",
      employeeCount: hrData.length,
    });
  } catch (err: any) {
    console.error("[hr/analytics] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate workforce analytics" },
      { status: 500 }
    );
  }
}
