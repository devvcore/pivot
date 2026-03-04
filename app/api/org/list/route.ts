import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get orgs where this user is a member (via user_organizations)
    const { data: memberships, error: memErr } = await supabase
      .from("user_organizations")
      .select("org_id, role")
      .eq("user_id", userId);

    if (memErr) {
      console.error("[/api/org/list] membership query error:", memErr);
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    const orgIds = (memberships ?? []).map((m: any) => m.org_id);

    // Also get orgs owned by this user
    const { data: ownedOrgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_user_id", userId);

    const ownedIds = (ownedOrgs ?? []).map((o: any) => o.id);
    const allOrgIds = [...new Set([...orgIds, ...ownedIds])];

    if (allOrgIds.length === 0) {
      // Check if user has a profile with default org
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single();

      if (profile?.organization_id) {
        allOrgIds.push(profile.organization_id);
      }
    }

    if (allOrgIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch organizations
    const { data: orgs, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name, website, industry, created_at")
      .in("id", allOrgIds)
      .order("created_at", { ascending: false });

    if (orgErr) {
      return NextResponse.json({ error: orgErr.message }, { status: 500 });
    }

    // Get report counts
    const { data: jobCounts } = await supabase
      .from("jobs")
      .select("organization_id")
      .eq("status", "completed")
      .in("organization_id", allOrgIds);

    const countMap: Record<string, number> = {};
    for (const j of jobCounts ?? []) {
      countMap[j.organization_id] = (countMap[j.organization_id] || 0) + 1;
    }

    // Build role map from memberships
    const roleMap: Record<string, string> = {};
    for (const m of memberships ?? []) {
      roleMap[m.org_id] = m.role;
    }

    const result = (orgs ?? []).map((o: any) => ({
      ...o,
      role: roleMap[o.id] || "OWNER",
      report_count: countMap[o.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/org/list]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
