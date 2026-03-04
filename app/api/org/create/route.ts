import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { userId, name, website, industry } = await req.json();

    if (!userId || !name) {
      return NextResponse.json({ error: "userId and name are required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const orgId = uuidv4();

    // Create org
    const { error: orgErr } = await supabase.from("organizations").insert({
      id: orgId,
      name: name.trim(),
      website: website?.trim() || null,
      industry: industry?.trim() || null,
      owner_user_id: userId,
    });

    if (orgErr) {
      console.error("[/api/org/create] org insert error:", orgErr);
      return NextResponse.json({ error: orgErr.message }, { status: 500 });
    }

    // Link user as owner
    await supabase.from("user_organizations").upsert({
      user_id: userId,
      org_id: orgId,
      role: "OWNER",
    }, { onConflict: "user_id,org_id" });

    return NextResponse.json({ id: orgId, name, website, industry });
  } catch (err) {
    console.error("[/api/org/create]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
