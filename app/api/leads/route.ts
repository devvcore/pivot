import { NextRequest, NextResponse } from "next/server";
import { searchLeads, checkCredits } from "@/lib/agent/lead-generator";
import { getJob } from "@/lib/job-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runId, industry, location, roles, limit } = body;

    // If runId provided, pull industry/location from the job
    let searchIndustry = industry;
    let searchLocation = location;

    if (runId) {
      const job = await getJob(runId);
      if (job?.questionnaire) {
        searchIndustry = searchIndustry || job.questionnaire.industry;
        searchLocation = searchLocation || job.questionnaire.location;
      }
    }

    const report = await searchLeads({
      industry: searchIndustry,
      location: searchLocation,
      roles,
      limit: limit || 10,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    console.error("[api/leads] Error:", err);
    return NextResponse.json(
      { success: false, error: "Lead generation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const credits = await checkCredits();
    return NextResponse.json({ success: true, data: credits });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Credit check failed" },
      { status: 500 }
    );
  }
}
