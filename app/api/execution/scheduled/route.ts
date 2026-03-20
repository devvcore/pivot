/**
 * Scheduled Agent Runs API
 *
 * GET  /api/execution/scheduled — List scheduled runs for an org
 * POST /api/execution/scheduled — Create a scheduled run
 * DELETE /api/execution/scheduled — Delete a scheduled run
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("scheduled_runs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { orgId, title, description, agentId, cronExpression, timezone, pushChannel, pushTarget } = body;

  if (!orgId || !title || !agentId || !cronExpression) {
    return NextResponse.json(
      { error: "orgId, title, agentId, and cronExpression are required" },
      { status: 400 },
    );
  }

  // Validate cron expression (basic check)
  const cronParts = cronExpression.trim().split(/\s+/);
  if (cronParts.length < 5 || cronParts.length > 6) {
    return NextResponse.json({ error: "Invalid cron expression. Expected 5-6 parts." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("scheduled_runs")
    .insert({
      org_id: orgId,
      title,
      description: description ?? "",
      agent_id: agentId,
      cron_expression: cronExpression,
      timezone: timezone ?? "UTC",
      push_channel: pushChannel ?? null,
      push_target: pushTarget ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("scheduled_runs")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
