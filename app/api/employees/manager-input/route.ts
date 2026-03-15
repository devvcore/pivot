import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { resolvePermissions } from "@/lib/permissions";

/**
 * POST /api/employees/manager-input
 * Submit a manager assessment for an employee.
 *
 * Permissions: owner/csuite only (canSubmitManagerInput).
 *
 * Body: {
 *   employeeId: string,
 *   managerId: string,
 *   score: number,        // 0-100 manager assessment score
 *   tags?: string[],      // optional tags like ["leadership", "initiative"]
 *   note?: string,        // optional free-text note
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { employeeId, managerId, score, tags, note } = body;

    if (!employeeId || !managerId) {
      return NextResponse.json(
        { error: "employeeId and managerId are required" },
        { status: 400 },
      );
    }

    // Permission check: only owner/csuite can submit manager inputs
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || !permissions.canSubmitManagerInput) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to submit manager assessments" },
        { status: 403 },
      );
    }

    if (score === undefined || score === null) {
      return NextResponse.json(
        { error: "score is required" },
        { status: 400 },
      );
    }

    if (typeof score !== "number" || score < 0 || score > 100) {
      return NextResponse.json(
        { error: "score must be a number between 0 and 100" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: input, error: insertError } = await supabase
      .from("manager_inputs")
      .insert({
        employee_id: employeeId,
        manager_id: managerId,
        score,
        tags: tags ?? [],
        note: note ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/employees/manager-input] insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    // Also insert a scoring event so the next scoring cycle picks up the
    // manager assessment dimension automatically.
    await supabase.from("scoring_events").insert({
      employee_id: employeeId,
      org_id: input.org_id ?? null,
      source: "manager_input",
      event_type: "manager_assessment",
      data: {
        value: score,
        manager_id: managerId,
        tags: tags ?? [],
        note: note ?? null,
      },
    }).then(({ error: eventError }) => {
      if (eventError) {
        // Non-fatal: log but don't fail the request
        console.error("[POST /api/employees/manager-input] scoring event insert error:", eventError);
      }
    });

    return NextResponse.json({ input }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/employees/manager-input]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit manager input" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/employees/manager-input?employeeId=...
 * Fetch all manager inputs for an employee, ordered by most recent first.
 *
 * Permissions:
 *   owner/csuite: can view any employee's manager inputs
 *   employee: can only view their own manager inputs
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    // Permission check
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Employee tier can view their own manager inputs but not others'
    if (!permissions.canViewAllEmployees && permissions.employeeId !== employeeId) {
      return NextResponse.json(
        { error: "Forbidden: you can only view your own manager inputs" },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    const { data: inputs, error } = await supabase
      .from("manager_inputs")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/employees/manager-input]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inputs: inputs ?? [] });
  } catch (err) {
    console.error("[GET /api/employees/manager-input]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch manager inputs" },
      { status: 500 },
    );
  }
}
