import { NextResponse } from "next/server";
import { analyzeWebsite } from "@/lib/agent/website-analyzer";
import { saveWebsiteAnalysis } from "@/lib/agent/memory";

export async function POST(req: Request) {
  try {
    const { url, orgId } = await req.json();
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const analysis = await analyzeWebsite(url);

    // Save to org if orgId provided
    if (orgId) saveWebsiteAnalysis(orgId, analysis);

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[/api/agent/website]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
