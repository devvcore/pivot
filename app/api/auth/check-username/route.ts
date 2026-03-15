import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/auth/check-username?username=foo
 * Check if a username is available (case-insensitive).
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  // Validate format: 3-20 chars, alphanumeric + underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return NextResponse.json({
      available: false,
      error: "Username must be 3-20 characters, alphanumeric and underscores only",
    });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .limit(1);

  if (error) {
    console.error("[auth/check-username] Error:", error);
    return NextResponse.json({ error: "Failed to check username" }, { status: 500 });
  }

  return NextResponse.json({ available: !data || data.length === 0 });
}
