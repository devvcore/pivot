import { NextResponse } from "next/server";
import { listJobs } from "@/lib/job-store";

export async function GET() {
    const jobs = listJobs().map(j => {
        const d = j.deliverables as any;
        const hs = d?.healthScore ?? d?.health_score;
        return {
            runId: j.runId,
            status: j.status,
            phase: j.phase ?? "INGEST",
            orgName: j.questionnaire.organizationName,
            industry: j.questionnaire.industry,
            createdAt: j.createdAt,
            updatedAt: j.updatedAt,
            docCount: j.filePaths?.length ?? 0,
            healthScore: hs?.score ?? null,
            healthGrade: hs?.grade ?? null,
            healthHeadline: hs?.headline ?? hs?.summary?.slice(0, 120) ?? null,
        };
    });
    return NextResponse.json(jobs);
}
