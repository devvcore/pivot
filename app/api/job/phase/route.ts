import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
    try {
        const { runId, phase } = await req.json();

        const stmt = db.prepare("UPDATE jobs SET phase = ?, updated_at = CURRENT_TIMESTAMP WHERE run_id = ?");
        const info = stmt.run(phase, runId);

        if (info.changes === 0) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
    }
}
