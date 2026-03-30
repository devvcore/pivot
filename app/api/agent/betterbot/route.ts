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

    const supabase = createAdminClient();

    // 1. Resolve permissions for this user — auto-create employee if missing
    let permissions = await resolvePermissions(auth.user.id);
    if (!permissions) {
      // User exists but has no employee record — auto-provision one
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, first_name, last_name, organization_id")
        .eq("id", auth.user.id)
        .single();

      if (!profile?.organization_id) {
        return NextResponse.json(
          { error: "You need to join or create an organization first." },
          { status: 403 },
        );
      }

      const fullName = profile.name
        || [profile.first_name, profile.last_name].filter(Boolean).join(" ")
        || auth.user.email?.split("@")[0]
        || "Team Member";

      // Check if this user already has an employee record via a different lookup
      const { data: existingEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("org_id", profile.organization_id)
        .eq("user_id", auth.user.id)
        .limit(1)
        .single();

      if (!existingEmployee) {
        // Create the employee record — org creator gets "owner" tier
        const { data: orgMembers } = await supabase
          .from("employees")
          .select("id")
          .eq("org_id", profile.organization_id)
          .limit(1);

        const isFirstEmployee = !orgMembers || orgMembers.length === 0;

        await supabase.from("employees").insert({
          org_id: profile.organization_id,
          user_id: auth.user.id,
          name: fullName,
          role_title: isFirstEmployee ? "Owner" : "Team Member",
          permission_tier: isFirstEmployee ? "owner" : "employee",
          status: "active",
        });
      }

      // Re-resolve permissions now that the employee exists
      permissions = await resolvePermissions(auth.user.id);
      if (!permissions) {
        return NextResponse.json(
          { error: "Failed to set up your profile. Please try again." },
          { status: 500 },
        );
      }
    }

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

      // Get latest scores for the org (last 30 days only to avoid loading all history)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: allScores } = await supabase
        .from("employee_scores")
        .select("*")
        .eq("org_id", permissions.orgId)
        .gte("scored_at", thirtyDaysAgo)
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
      { error: "BetterBot encountered an error. Please try again." },
      { status: 500 },
    );
  }
}
