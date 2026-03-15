// ═══════════════════════════════════════════════════════════════
// GET /api/brand-logos
// Fetches brand logos for all integration providers via OpenBrand API.
// Caches results in memory so subsequent calls are instant.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

const OPENBRAND_KEY = process.env.OPENBRAND_API_KEY ?? "";

// Provider → website domain mapping
const PROVIDER_DOMAINS: Record<string, string> = {
  slack: "slack.com",
  gmail: "gmail.com",
  microsoft_teams: "teams.microsoft.com",
  quickbooks: "quickbooks.intuit.com",
  stripe: "stripe.com",
  salesforce: "salesforce.com",
  hubspot: "hubspot.com",
  jira: "atlassian.com/software/jira",
  github: "github.com",
  linear: "linear.app",
  asana: "asana.com",
  google_analytics: "analytics.google.com",
  google_sheets: "sheets.google.com",
  notion: "notion.so",
  google_calendar: "calendar.google.com",
  airtable: "airtable.com",
  adp: "adp.com",
  workday: "workday.com",
};

// Known-good logos for providers OpenBrand can't extract (Google subdomains, etc.)
const KNOWN_LOGOS: Record<string, string> = {
  gmail: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
  google_analytics: "https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg",
  google_sheets: "https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico",
  google_calendar: "https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png",
  workday: "https://www.workday.com/favicon.ico",
};

// In-memory cache
let logoCache: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function pickBestLogo(
  logos: Array<{ url: string; type: string; resolution?: { width?: number; height?: number } }>
): string | null {
  if (!logos || logos.length === 0) return null;

  // Filter out data URIs and non-http URLs for cleaner results
  const httpLogos = logos.filter(l => l.url?.startsWith("http"));

  // Prefer: favicon SVG > apple-touch-icon > favicon PNG > logo > any
  const priorities = ["favicon", "apple-touch-icon", "logo", "icon", "img"];

  // Prefer square-ish logos (aspect ratio close to 1)
  for (const pType of priorities) {
    const matches = httpLogos.filter(l => l.type === pType);
    if (matches.length > 0) {
      // Prefer SVG
      const svg = matches.find(l => l.url.endsWith(".svg"));
      if (svg) return svg.url;
      // Prefer highest resolution
      const sorted = matches.sort((a, b) =>
        (b.resolution?.width ?? 0) - (a.resolution?.width ?? 0)
      );
      return sorted[0].url;
    }
  }

  // Fallback to first HTTP logo (never return data URIs)
  return httpLogos[0]?.url ?? null;
}

async function fetchLogo(provider: string, domain: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://openbrand.sh/api/extract?url=https://${domain}`,
      {
        headers: { Authorization: `Bearer ${OPENBRAND_KEY}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return pickBestLogo(data?.data?.logos ?? []);
  } catch {
    return null;
  }
}

export async function GET() {
  // Return cache if fresh
  if (logoCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(logoCache);
  }

  if (!OPENBRAND_KEY) {
    return NextResponse.json(
      { error: "OPENBRAND_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Fetch all logos in parallel (batched to avoid rate limits)
  const entries = Object.entries(PROVIDER_DOMAINS);
  const results: Record<string, string> = {};

  // Batch 6 at a time
  for (let i = 0; i < entries.length; i += 6) {
    const batch = entries.slice(i, i + 6);
    const batchResults = await Promise.allSettled(
      batch.map(([provider, domain]) => fetchLogo(provider, domain))
    );

    batch.forEach(([provider], idx) => {
      const result = batchResults[idx];
      if (result.status === "fulfilled" && result.value) {
        results[provider] = result.value;
      }
    });
  }

  // Fill in known logos for providers OpenBrand missed
  for (const [provider, url] of Object.entries(KNOWN_LOGOS)) {
    if (!results[provider]) {
      results[provider] = url;
    }
  }

  // Cache results
  logoCache = results;
  cacheTimestamp = Date.now();

  return NextResponse.json(results);
}
