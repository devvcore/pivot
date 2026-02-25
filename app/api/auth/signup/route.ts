import { NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
    try {
        const { email, password, name, organizationName } = await req.json();

        if (!email || !password || !name || !organizationName) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        // Normalize email: trim and lowercase for storage (but preserve original for display)
        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists (case-insensitive)
        const existingUser = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").get(normalizedEmail);
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

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
            insertUser.run(userId, normalizedEmail, hashedPassword, name, orgId);
        });

        transaction();

        return NextResponse.json({ success: true, userId });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }
        console.error("[SIGNUP] Error:", error);
        return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
    }
}
