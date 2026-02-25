import { NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
    try {
        const { email, password, name, organizationName } = await req.json();

        const hashedPassword = await bcrypt.hash(password, 10);
        const orgId = uuidv4();
        const userId = uuidv4();

        const insertOrg = db.prepare(`
      INSERT INTO organizations (id, name) 
      VALUES (?, ?)
    `);

        const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `);

        // Wrap in transaction
        const transaction = db.transaction(() => {
            insertOrg.run(orgId, organizationName);
            insertUser.run(userId, email, hashedPassword, name, orgId);
        });

        transaction();

        return NextResponse.json({ success: true, userId });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }
        return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
    }
}
