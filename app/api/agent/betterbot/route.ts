import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { resolvePermissions } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatWithBetterBot } from "@/lib/agent/betterbot-agent";
import type { BetterBotContext, EmployeeScoreSnapshot } from "@/lib/agent/betterbot-agent";

/**
 * POST /api/agent/betterbot
 *
 * Per-user AI coaching agent. Authenticates the user, resolves their
 * permission tier, loads their scoring data, and returns a personalized
 * AI response.
 *
 * Body: {
 *   message: string;
 *   conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>
 * }
 *
 * Response: {
 *   response: string;
 *   context: { employeeName: string; tier: string }
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { message, conversationHistory } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required and must be a string" },
        { status: 400 },
      );
    }

    // 1. Resolve permissions for this user
    const permissions = await resolvePermissions(auth.user.id);
    if (!permissions) {
      return NextResponse.json(
        { error: "No employee profile found. You must be part of an organization to use BetterBot." },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    // 2. Fetch the employee's name
    const { data: employee } = await supabase
      .from("employees")
      .select("id, name, org_id")
      .eq("id", permissions.employeeId)
      .single();

    const employeeName = employee?.name ?? "Team Member";

    // 3. Fetch current score for this employee
    let currentScore: EmployeeScoreSnapshot | null = null;
    if (permissions.employeeId) {
      const { data: scoreRows } = await supabase
        .from("employee_scores")
        .select("*")
        .eq("employee_id", permissions.employeeId)
        .order("scored_at", { ascending: false })
        .limit(1);

      if (scoreRows && scoreRows.length > 0) {
        const row = scoreRows[0];
        currentScore = {
          employeeId: row.employee_id,
          employeeName,
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
          rank: row.rank ?? 0,
          rankChange: row.rank_change ?? 0,
          scoredAt: row.scored_at,
        };
      }
    }

    // 4. Fetch goals for this employee
    const { data: goals } = await supabase
      .from("employee_goals")
      .select("*")
      .eq("employee_id", permissions.employeeId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // 5. Fetch score history (last 10 entries)
    const { data: historyRows } = await supabase
      .from("employee_scores")
      .select("*")
      .eq("employee_id", permissions.employeeId)
      .order("scored_at", { ascending: false })
      .limit(10);

    const scoreHistory: EmployeeScoreSnapshot[] = (historyRows ?? []).map((row: any) => ({
      employeeId: row.employee_id,
      employeeName,
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
      rank: row.rank ?? 0,
      rankChange: row.rank_change ?? 0,
      scoredAt: row.scored_at,
    }));

    // 6. For owner/csuite, also fetch team scores
    let teamScores: EmployeeScoreSnapshot[] | undefined;
    if (permissions.canViewAllEmployees) {
      // Get all employees with their names
      const { data: allEmployees } = await supabase
        .from("employees")
        .select("id, name")
        .eq("org_id", permissions.orgId)
        .eq("status", "active");

      const employeeNameMap = new Map<string, string>();
      for (const emp of allEmployees ?? []) {
        employeeNameMap.set(emp.id, emp.name);
      }

      // Get latest scores for the org
      const { data: allScores } = await supabase
        .from("employee_scores")
        .select("*")
        .eq("org_id", permissions.orgId)
        .order("scored_at", { ascending: false });

      if (allScores && allScores.length > 0) {
        // Deduplicate: keep only the most recent score per employee
        const seen = new Set<string>();
        teamScores = [];

        for (const row of allScores) {
          if (!seen.has(row.employee_id)) {
            seen.add(row.employee_id);
            teamScores.push({
              employeeId: row.employee_id,
              employeeName: employeeNameMap.get(row.employee_id) ?? row.employee_id,
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
              rank: row.rank ?? 0,
              rankChange: row.rank_change ?? 0,
              scoredAt: row.scored_at,
            });
          }
        }
      }
    }

    // 7. Build the BetterBot context
    const context: BetterBotContext = {
      employeeId: permissions.employeeId ?? "",
      employeeName,
      orgId: permissions.orgId,
      tier: permissions.tier,
      currentScore,
      goals: goals ?? [],
      scoreHistory,
      teamScores,
    };

    // 8. Chat with BetterBot
    const response = await chatWithBetterBot(
      context,
      message,
      conversationHistory ?? [],
    );

    return NextResponse.json({
      response,
      context: {
        employeeName,
        tier: permissions.tier,
      },
    });
  } catch (err) {
    console.error("[POST /api/agent/betterbot]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BetterBot encountered an error" },
      { status: 500 },
    );
  }
}
