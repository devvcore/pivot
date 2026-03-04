import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  const job = await getJob(runId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const leadReport = job.deliverables?.leadReport;
  if (!leadReport || !leadReport.leads || leadReport.leads.length === 0) {
    return NextResponse.json({ error: "No leads available for this run" }, { status: 404 });
  }

  // CSV header
  const headers = ["name", "title", "company", "email", "linkedin", "industry", "location", "relevanceScore"];
  const csvRows: string[] = [headers.join(",")];

  for (const lead of leadReport.leads) {
    const row = [
      escapeCsv(lead.name ?? ""),
      escapeCsv(lead.title ?? ""),
      escapeCsv(lead.company ?? ""),
      escapeCsv(lead.email ?? ""),
      escapeCsv(lead.linkedinUrl ?? ""),
      escapeCsv(lead.industry ?? ""),
      escapeCsv(lead.location ?? ""),
      lead.relevanceScore != null ? String(lead.relevanceScore) : "",
    ];
    csvRows.push(row.join(","));
  }

  const csv = csvRows.join("\n");
  const orgName = job.questionnaire.organizationName?.replace(/[^a-zA-Z0-9]/g, "_") ?? "leads";
  const filename = `${orgName}_leads_${runId.slice(0, 8)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
