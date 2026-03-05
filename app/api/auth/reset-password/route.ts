import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const supabase = createAdminClient();

    // Use admin to send the recovery email
    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
    });

    // Log but don't expose errors (prevent email enumeration)
    if (error) {
      console.error("[auth/reset-password] Error:", error.message);
    }

    // Always return success
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
