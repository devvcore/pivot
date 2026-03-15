import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OPENBRAND_KEY = process.env.OPENBRAND_API_KEY ?? "";

function pickBestLogo(
  logos: Array<{ url: string; type: string; resolution?: { width?: number; height?: number } }>
): string | null {
  if (!logos || logos.length === 0) return null;
  const httpLogos = logos.filter(l => l.url?.startsWith("http"));
  const priorities = ["favicon", "apple-touch-icon", "logo", "icon", "img"];
  for (const pType of priorities) {
    const matches = httpLogos.filter(l => l.type === pType);
    if (matches.length > 0) {
      const svg = matches.find(l => l.url.endsWith(".svg"));
      if (svg) return svg.url;
      const sorted = matches.sort((a, b) =>
        (b.resolution?.width ?? 0) - (a.resolution?.width ?? 0)
      );
      return sorted[0].url;
    }
  }
  return httpLogos[0]?.url ?? null;
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check if we already have a cached icon_url
  const { data: org } = await supabase
    .from("organizations")
    .select("icon_url, website")
    .eq("id", orgId)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // Return cached logo
  if (org.icon_url) {
    return NextResponse.json({ logoUrl: org.icon_url });
  }

  // No website — can't fetch logo
  if (!org.website) {
    return NextResponse.json({ logoUrl: null });
  }

  if (!OPENBRAND_KEY) {
    return NextResponse.json({ logoUrl: null });
  }

  // Normalize website to domain
  let domain: string;
  try {
    const url = org.website.startsWith("http") ? org.website : `https://${org.website}`;
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ logoUrl: null });
  }

  // Fetch from OpenBrand
  try {
    const res = await fetch(
      `https://openbrand.sh/api/extract?url=https://${domain}`,
      {
        headers: { Authorization: `Bearer ${OPENBRAND_KEY}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return NextResponse.json({ logoUrl: null });

    const data = await res.json();
    const logoUrl = pickBestLogo(data?.data?.logos ?? []);

    // Cache in organizations table
    if (logoUrl) {
      await supabase
        .from("organizations")
        .update({ icon_url: logoUrl })
        .eq("id", orgId);
    }

    return NextResponse.json({ logoUrl });
  } catch {
    return NextResponse.json({ logoUrl: null });
  }
}
