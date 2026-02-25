import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId, name, website, industry } = await req.json();

    if (!userId || !name) {
      return NextResponse.json({ error: "userId and name are required" }, { status: 400 });
    }

    const orgId = uuidv4();

    // Create org
    db.prepare(`
      INSERT INTO organizations (id, name, website, industry, owner_user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(orgId, name.trim(), website?.trim() || null, industry?.trim() || null, userId);

    // Link user as owner
    db.prepare(`
      INSERT OR IGNORE INTO user_organizations (user_id, org_id, role)
      VALUES (?, ?, 'OWNER')
    `).run(userId, orgId);

    return NextResponse.json({ id: orgId, name, website, industry });
  } catch (err) {
    console.error("[/api/org/create]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
