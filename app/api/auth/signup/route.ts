import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const { email, password, name, username, organizationName } = await req.json();
    if (!email || !password || !name || !organizationName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Validate and check username uniqueness if provided
    const sanitizedUsername = username?.trim().toLowerCase();
    if (sanitizedUsername) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(sanitizedUsername)) {
        return NextResponse.json({ error: "Username must be 3-20 characters, alphanumeric and underscores only" }, { status: 400 });
      }

      const { data: existingUsername } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", sanitizedUsername)
        .limit(1);

      if (existingUsername && existingUsername.length > 0) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name, username: sanitizedUsername, organizationName },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Create org in Supabase
    const orgId = uuidv4();
    try {
      await supabase.from("organizations").insert({
        id: orgId,
        name: organizationName,
        owner_user_id: authData.user.id,
      });

      // Create profile linked to auth user (with username)
      await supabase.from("profiles").insert({
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        name,
        username: sanitizedUsername || null,
        display_name: name,
        organization_id: orgId,
      });

      // Link user to org
      await supabase.from("user_organizations").insert({
        user_id: authData.user.id,
        org_id: orgId,
        role: "OWNER",
      });
    } catch { /* org/profile may already exist */ }

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
