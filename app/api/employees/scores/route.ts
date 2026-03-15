import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { resolvePermissions } from "@/lib/permissions";
import { scoreAllEmployees } from "@/lib/scoring/engine";
import { collectDimensionData } from "@/lib/scoring/collectors";
import type { DimensionData } from "@/lib/scoring/engine";

/**
 * GET /api/employees/scores?orgId=...
 * Fetch the latest score per employee for an organization.
 *
 * Permissions:
 *   owner/csuite: can view all employees in the org
 *   employee: can only view their own score
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const orgId = request.nextUrl.searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Permission check
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || permissions.orgId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Fetch the most recent score for each employee in this org.
    // We order by scored_at DESC and deduplicate in application layer
    // (Supabase doesn't support DISTINCT ON directly).
    const { data, error } = await supabase
      .from("employee_scores")
      .select("*")
      .eq("org_id", orgId)
      .order("scored_at", { ascending: false });

    if (error) {
      console.error("[GET /api/employees/scores]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduplicate: keep only the most recent score per employee
    const seen = new Set<string>();
    const latestScores: Record<string, unknown>[] = [];

    for (const row of data ?? []) {
      if (!seen.has(row.employee_id)) {
        seen.add(row.employee_id);

        // Employee tier: skip scores for other employees
        if (!permissions.canViewAllEmployees && row.employee_id !== permissions.employeeId) {
          continue;
        }

        latestScores.push({
          employeeId: row.employee_id,
          hardValue: row.hard_value ?? 0,
          totalCost: row.total_cost ?? 0,
          netValue: row.net_value ?? 0,
          intangibleScore: row.intangible_score ?? 0,
          dimensions: {
            responsiveness: row.responsiveness ?? null,
            outputVolume: row.output_volume ?? null,
            qualitySignal: row.quality_signal ?? null,
            collaboration: row.collaboration ?? null,
            reliability: row.reliability ?? null,
            managerAssessment: row.manager_assessment ?? null,
          },
          roleType: row.role_type || "support",
          confidence: row.confidence || "estimated",
          dataSources: Array.isArray(row.data_sources) ? row.data_sources : [],
          rank: row.rank ?? 0,
          rankChange: row.rank_change ?? 0,
          scoredAt: row.scored_at,
        });
      }
    }

    return NextResponse.json({ scores: latestScores, total: latestScores.length });
  } catch (err) {
    console.error("[GET /api/employees/scores]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch scores" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/employees/scores
 * Trigger a full scoring cycle for an organization.
 *
 * Body: { orgId: string }
 *
 * Permissions: owner/csuite only (canRunScoringCycle).
 *
 * Collects dimension data for all active employees, runs the scoring
 * engine, and returns the ranked results.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Permission check: only owner/csuite can run scoring cycles
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || permissions.orgId !== orgId || !permissions.canRunScoringCycle) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to run scoring cycle" },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch all active employees for this org
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, org_id, name, role_title, salary, start_date, role_type, status")
      .eq("org_id", orgId)
      .eq("status", "active");

    if (empError) {
      console.error("[POST /api/employees/scores] employee fetch error:", empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ scores: [], total: 0 });
    }

    // 2. Collect dimension data for each employee in parallel
    const collectionResults = await Promise.allSettled(
      employees.map((emp) => collectDimensionData(emp.id, orgId)),
    );

    const dimensionDataByEmployee = new Map<string, DimensionData>();

    for (let i = 0; i < employees.length; i++) {
      const result = collectionResults[i];
      if (result.status === "fulfilled") {
        const merged = result.value;
        // Convert MergedDimensionData to DimensionData format expected by engine
        dimensionDataByEmployee.set(employees[i].id, {
          responsiveness: merged.dimensions.responsiveness !== null
            ? { score: merged.dimensions.responsiveness, sources: merged.dataSources }
            : null,
          outputVolume: merged.dimensions.outputVolume !== null
            ? { score: merged.dimensions.outputVolume, sources: merged.dataSources }
            : null,
          qualitySignal: merged.dimensions.qualitySignal !== null
            ? { score: merged.dimensions.qualitySignal, sources: merged.dataSources }
            : null,
          collaboration: merged.dimensions.collaboration !== null
            ? { score: merged.dimensions.collaboration, sources: merged.dataSources }
            : null,
          reliability: merged.dimensions.reliability !== null
            ? { score: merged.dimensions.reliability, sources: merged.dataSources }
            : null,
          managerAssessment: null, // Populated separately by fetchManagerAssessment
        });
      } else {
        console.error(
          `[POST /api/employees/scores] Collection failed for ${employees[i].id}:`,
          result.reason,
        );
      }
    }

    // 3. Fetch company context for scoring calculations
    const { data: org } = await supabase
      .from("organizations")
      .select("id, total_revenue, industry")
      .eq("id", orgId)
      .single();

    const companyContext = {
      orgId,
      totalRevenue: org?.total_revenue ?? null,
      employeeCount: employees.length,
      industry: org?.industry ?? null,
    };

    // 4. Run the scoring engine
    const results = await scoreAllEmployees(orgId, dimensionDataByEmployee, companyContext);

    return NextResponse.json({ scores: results, total: results.length }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/employees/scores]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run scoring cycle" },
      { status: 500 },
    );
  }
}
