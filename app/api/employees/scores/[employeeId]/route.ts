import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { resolvePermissions, canViewEmployee } from "@/lib/permissions";
import { fetchScoreHistory } from "@/lib/scoring/engine";

type RouteContext = { params: Promise<{ employeeId: string }> };

/**
 * GET /api/employees/scores/[employeeId]?limit=30
 * Fetch score history for a single employee.
 *
 * Permissions:
 *   owner/csuite: can view any employee's history
 *   employee: can only view their own history
 *
 * Query params:
 *   - limit (optional, default 30): Max number of historical scores to return.
 *
 * Returns the score history array ordered by scored_at descending.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { employeeId } = await context.params;

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    // Permission check
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions || !canViewEmployee(permissions, employeeId)) {
      return NextResponse.json(
        { error: "Forbidden: you do not have access to this employee's data" },
        { status: 403 },
      );
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 30;

    const history = await fetchScoreHistory(employeeId, limit);

    return NextResponse.json({ employeeId, history, total: history.length });
  } catch (err) {
    console.error("[GET /api/employees/scores/[employeeId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch score history" },
      { status: 500 },
    );
  }
}
