import { NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
        }

        // Use case-insensitive email comparison
        const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(email.trim()) as any;

        if (!user) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Check if password_hash exists (defensive check)
        if (!user.password_hash) {
            console.error(`[LOGIN] User ${user.email} has no password_hash`);
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // In a real app, you'd set a session cookie/JWT here
        return NextResponse.json({
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organization_id
        });
    } catch (error: any) {
        console.error("[LOGIN] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
