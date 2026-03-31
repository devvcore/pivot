import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth-api";
import { analyzeWebsite } from "@/lib/agent/website-analyzer";
import { saveWebsiteAnalysis } from "@/lib/agent/memory";

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { url, orgId } = await request.json();
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const analysis = await analyzeWebsite(url);

    // Save to org if orgId provided
    if (orgId) await saveWebsiteAnalysis(orgId, analysis);

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[/api/agent/website]", err);
    return NextResponse.json(
      { error: "Website analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
