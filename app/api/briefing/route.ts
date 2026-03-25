/**
 * GET /api/briefing — Generate or retrieve daily briefing
 * POST /api/briefing — Force generate a new briefing
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDailyBriefing, saveBriefing } from "@/lib/briefing/daily-digest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  // Resolve org
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

  // Check for today's briefing
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from("daily_briefings")
    .select("*")
    .eq("org_id", orgId)
    .gte("generated_at", startOfToday.toISOString())
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      briefing: {
        orgId: existing.org_id,
        greeting: existing.greeting,
        summary: existing.summary,
        sections: existing.sections,
        actionItems: existing.action_items,
        generatedAt: existing.generated_at,
        audioUrl: existing.audio_url,
      },
      cached: true,
    });
  }

  // Generate new briefing
  try {
    const briefing = await generateDailyBriefing(orgId);
    await saveBriefing(briefing);

    return NextResponse.json({ briefing, cached: false });
  } catch (err) {
    console.error("[api/briefing] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate briefing" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

  // Force generate new briefing
  try {
    const briefing = await generateDailyBriefing(orgId);
    await saveBriefing(briefing);

    return NextResponse.json({ briefing, cached: false });
  } catch (err) {
    console.error("[api/briefing] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate briefing" },
      { status: 500 },
    );
  }
}
