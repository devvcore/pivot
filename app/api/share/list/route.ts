import { NextRequest, NextResponse } from "next/server";
import { listShareLinksForJob } from "@/lib/share-store";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      { error: "runId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const links = await listShareLinksForJob(runId);
    return NextResponse.json(links);
  } catch (err) {
    console.error("[api/share/list]", err);
    return NextResponse.json(
      { error: "Failed to list share links" },
      { status: 500 },
    );
  }
}
