/**
 * GET /api/execution/optimization — Agent efficiency optimization report
 *
 * Shows how agents are improving over time:
 * - Average efficiency score across all tool patterns
 * - Top wasteful patterns (opportunities to save tokens)
 * - Top efficient patterns (learned shortcuts)
 * - Estimated token savings from learned optimizations
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOptimizationReport } from "@/lib/execution/distiller";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  const qsOrgId = request.nextUrl.searchParams.get("orgId");
  let orgId: string;

  if (qsOrgId) {
    orgId = qsOrgId;
  } else {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_user_id", auth.user.id)
      .limit(1)
      .single();

    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }
    orgId = org.id;
  }

  try {
    const report = await generateOptimizationReport(orgId);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[api/optimization] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate report" },
      { status: 500 },
    );
  }
}
