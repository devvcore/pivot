import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const { userId, email, name, organizationName } = await req.json();
    if (!userId || !email || !name || !organizationName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify the user exists in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (existing?.organization_id) {
      return NextResponse.json({ organizationId: existing.organization_id });
    }

    // Create organization
    const orgId = uuidv4();
    await supabase.from("organizations").insert({
      id: orgId,
      name: organizationName,
      owner_user_id: userId,
    });

    // Create profile
    await supabase.from("profiles").upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      name,
      organization_id: orgId,
    });

    // Link user to org
    await supabase.from("user_organizations").upsert({
      user_id: userId,
      org_id: orgId,
      role: "OWNER",
    });

    return NextResponse.json({ organizationId: orgId });
  } catch (error: any) {
    console.error("[auth/setup-profile] Error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
