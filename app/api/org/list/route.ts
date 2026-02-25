import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get orgs where this user is a member or owner
    const orgs = db.prepare(`
      SELECT o.id, o.name, o.website, o.industry, o.created_at,
             uo.role,
             (SELECT COUNT(*) FROM jobs j WHERE j.organization_id = o.id AND j.status = 'completed') as report_count
      FROM organizations o
      LEFT JOIN user_organizations uo ON uo.org_id = o.id AND uo.user_id = ?
      WHERE uo.user_id = ? OR o.owner_user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(userId, userId, userId) as any[];

    // Also include the default org linked to the user's account
    const user = db.prepare("SELECT organization_id FROM users WHERE id = ?").get(userId) as any;
    if (user?.organization_id) {
      const hasDefaultOrg = orgs.some((o) => o.id === user.organization_id);
      if (!hasDefaultOrg) {
        const defaultOrg = db.prepare("SELECT id, name, website, industry, created_at FROM organizations WHERE id = ?").get(user.organization_id) as any;
        if (defaultOrg) orgs.push({ ...defaultOrg, role: "OWNER", report_count: 0 });
      }
    }

    return NextResponse.json(orgs);
  } catch (err) {
    console.error("[/api/org/list]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
