import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const { userId, email, name, username, organizationName } = await req.json();
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

    // Validate username if provided
    const sanitizedUsername = username?.trim().toLowerCase();
    if (sanitizedUsername) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(sanitizedUsername)) {
        return NextResponse.json({ error: "Username must be 3-20 characters, alphanumeric and underscores only" }, { status: 400 });
      }

      // Check uniqueness
      const { data: existingUsername } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", sanitizedUsername)
        .limit(1);

      if (existingUsername && existingUsername.length > 0) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
    }

    // Create organization
    const orgId = uuidv4();
    await supabase.from("organizations").insert({
      id: orgId,
      name: organizationName,
      owner_user_id: userId,
    });

    // Create profile (with username)
    await supabase.from("profiles").upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      name,
      username: sanitizedUsername || null,
      display_name: name,
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
