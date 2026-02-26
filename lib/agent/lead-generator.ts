import type { Lead, LeadReport } from "../types";

const NYNE_API_BASE = "https://api.nyne.ai";
const NYNE_API_KEY = process.env.NYNE_API_KEY || "82cae84113b9675fdaa576dec1485f66";
const NYNE_API_SECRET = process.env.NYNE_API_SECRET || "09d68619416437b4";
const MAX_CREDITS = 12; // cap for testing

interface NyneSearchResult {
  displayname?: string;
  headline?: string;
  location?: string;
  is_decision_maker?: number;
  total_experience_years?: number;
  estimated_age?: number;
  organizations?: {
    name: string;
    title?: string;
    company_domain?: string;
    company_website?: string;
    company_linkedin_url?: string;
    industries?: string[];
    num_employees_range?: string;
    num_employees?: number;
  }[];
  social_profiles?: {
    linkedin?: {
      url?: string;
      username?: string;
    };
  };
  interests?: {
    work?: string[];
  };
}

async function nyneHeaders(): Promise<Record<string, string>> {
  return {
    "x-api-key": NYNE_API_KEY,
    "x-api-secret": NYNE_API_SECRET,
    "Content-Type": "application/json",
  };
}

/** Check current credit usage */
export async function checkCredits(): Promise<{ used: number; available: number }> {
  try {
    const res = await fetch(`${NYNE_API_BASE}/usage`, {
      headers: await nyneHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      return {
        used: data.data?.credits_used?.total ?? 0,
        available: data.data?.limits?.available_credits ?? 0,
      };
    }
  } catch (err) {
    console.error("[nyne] Credit check failed:", err);
  }
  return { used: 0, available: 0 };
}

/** Search for leads using Nyne.ai Person Search API */
export async function searchLeads(params: {
  industry?: string;
  location?: string;
  roles?: string[];
  companySize?: string;
  limit?: number;
}): Promise<LeadReport> {
  const credits = await checkCredits();
  const creditsRemaining = credits.available;

  // Safety: don't exceed our test cap
  const limit = Math.min(params.limit ?? 10, MAX_CREDITS, creditsRemaining);

  if (limit <= 0) {
    return {
      leads: [],
      searchCriteria: params,
      creditsUsed: 0,
      totalAvailable: creditsRemaining,
      generatedAt: Date.now(),
    };
  }

  const query = [
    params.roles?.join(" OR ") || "business owner OR CEO OR founder OR director",
    params.industry ? `in ${params.industry}` : "",
  ].filter(Boolean).join(" ");

  try {
    // Step 1: Submit search
    const searchRes = await fetch(`${NYNE_API_BASE}/person/search`, {
      method: "POST",
      headers: await nyneHeaders(),
      body: JSON.stringify({
        query,
        location: params.location || "United States",
        limit,
      }),
    });
    const searchData = await searchRes.json();

    if (!searchData.success) {
      console.error("[nyne] Search failed:", searchData);
      return { leads: [], searchCriteria: params, creditsUsed: 0, totalAvailable: creditsRemaining, generatedAt: Date.now() };
    }

    const requestId = searchData.data?.request_id;
    if (!requestId) {
      return { leads: [], searchCriteria: params, creditsUsed: 0, totalAvailable: creditsRemaining, generatedAt: Date.now() };
    }

    // Step 2: Poll for results (async API)
    let results: NyneSearchResult[] = [];
    let creditsCharged = 0;

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(r => setTimeout(r, 2000)); // wait 2s between polls

      const pollRes = await fetch(
        `${NYNE_API_BASE}/person/search?request_id=${requestId}`,
        { headers: await nyneHeaders() }
      );
      const pollData = await pollRes.json();

      if (pollData.success && pollData.data?.status === "completed") {
        results = pollData.data.results || [];
        creditsCharged = pollData.data.credits_charged || 0;
        break;
      }

      if (!pollData.success || pollData.data?.status === "failed") {
        console.error("[nyne] Poll failed:", pollData);
        break;
      }
    }

    // Step 3: Transform results to Lead format
    const leads: Lead[] = results.map((r) => {
      const org = r.organizations?.[0];
      return {
        name: r.displayname || "Unknown",
        title: org?.title,
        company: org?.name,
        companyDomain: org?.company_domain,
        industry: org?.industries?.[0],
        location: r.location,
        linkedinUrl: r.social_profiles?.linkedin?.url,
        estimatedCompanySize: org?.num_employees_range || (org?.num_employees ? String(org.num_employees) : undefined),
        relevanceScore: r.is_decision_maker ? 80 : 50,
        isDecisionMaker: r.is_decision_maker === 1,
        headline: r.headline,
      };
    });

    return {
      leads,
      searchCriteria: params,
      creditsUsed: creditsCharged,
      totalAvailable: creditsRemaining - creditsCharged,
      generatedAt: Date.now(),
    };
  } catch (err) {
    console.error("[nyne] Lead search error:", err);
    return { leads: [], searchCriteria: params, creditsUsed: 0, totalAvailable: creditsRemaining, generatedAt: Date.now() };
  }
}
