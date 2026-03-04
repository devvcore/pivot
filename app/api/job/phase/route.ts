import { NextResponse } from "next/server";
import { updateJob } from "@/lib/job-store";

export async function POST(req: Request) {
    try {
        const { runId, phase } = await req.json();

        const result = await updateJob(runId, { phase });

        if (!result) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
    }
}
