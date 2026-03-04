import { NextRequest, NextResponse } from "next/server";
import { revokeShareLink } from "@/lib/share-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 },
      );
    }

    const deleted = await revokeShareLink(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Share link not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/share/revoke]", err);
    return NextResponse.json(
      { error: "Failed to revoke share link" },
      { status: 500 },
    );
  }
}
