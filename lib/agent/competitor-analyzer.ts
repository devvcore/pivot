/**
 * Competitor & Industry Leader Analyzer
 *
 * Three-stage analysis:
 *   1. analyzeCompetitorWebsites — runs analyzeWebsite() (Flash Lite) on each
 *      competitor URL provided during onboarding (max 3, parallel)
 *   2. findIndustryLeaderUrls — uses Gemini Flash to identify 2-3 top-performing
 *      companies in the industry and returns their website URLs
 *   3. buildCompetitorAnalysis — Gemini Flash synthesizes user site vs competitors
 *      vs leaders into ranked repositioning recommendations
 *
 * The user's own website analysis is included in the comparison ("your site" column).
 */
import { GoogleGenAI } from "@google/genai";
import { analyzeWebsite } from "./website-analyzer";
import { perplexitySearch } from "./perplexity-search";
import type {
  WebsiteAnalysis,
  CompetitorAnalysis,
  CompetitorSiteAnalysis,
  BusinessPacket,
} from "@/lib/types";

const FLASH_MODEL = "gemini-2.5-flash";

// ── URL verification (anti-hallucination) ───────────────────────────────────

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── 1. Analyze competitor websites ───────────────────────────────────────────

export async function analyzeCompetitorWebsites(
  urls: string[]
): Promise<{ url: string; analysis: WebsiteAnalysis | null }[]> {
  const limited = urls.slice(0, 3); // max 3 to keep pipeline fast
  const results = await Promise.allSettled(
    limited.map(async (url) => {
      try {
        const analysis = await analyzeWebsite(url);
        return { url, analysis };
      } catch {
        return { url, analysis: null };
      }
    })
  );
  return results.map((r) => (r.status === "fulfilled" ? r.value : { url: "", analysis: null })).filter(
    (r) => r.url
  );
}

// ── 2. Find industry leader URLs ─────────────────────────────────────────────

export async function findIndustryLeaderUrls(
  industry: string,
  businessDesc: string
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  // Try Perplexity first for real, current data
  let perplexityContext = "";
  try {
    const { results } = await perplexitySearch(
      `top performing fastest growing ${industry} companies websites 2024 2025`,
      6
    );
    if (results.length > 0) {
      perplexityContext = results
        .map((r) => `${r.title}: ${r.url} — ${r.snippet}`)
        .join("\n");
    }
  } catch {
    // Perplexity not available, continue with Gemini only
  }

  const genai = new GoogleGenAI({ apiKey });
  const prompt = `You are a business intelligence researcher. Identify 2-3 of the top-performing or fastest-growing companies in the "${industry}" industry that would serve as meaningful benchmarks for a business that: ${businessDesc}

${perplexityContext ? `RECENT RESEARCH:\n${perplexityContext}\n\nUse the research above to identify REAL companies with their ACTUAL website URLs.` : ""}

Return ONLY a JSON array of their website URLs. Choose companies known for strong marketing, clear positioning, and high growth.
Example: ["https://example1.com", "https://example2.com"]

Return only the JSON array, no other text.`;

  try {
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 200,
      } as Record<string, unknown>,
    });
    const raw = resp.text ?? "[]";
    const urls = JSON.parse(raw);
    if (!Array.isArray(urls)) return [];

    // Verify URLs actually resolve (catches hallucinated URLs)
    const candidates = urls.slice(0, 4); // check up to 4, keep 3
    const verified: string[] = [];
    for (const u of candidates) {
      if (typeof u === "string" && u.startsWith("http") && await verifyUrl(u)) {
        verified.push(u);
        if (verified.length >= 3) break;
      }
    }
    if (verified.length < urls.length) {
      console.log(`[Pivot] URL verification: ${verified.length}/${urls.length} URLs verified`);
    }
    return verified;
  } catch {
    return [];
  }
}

// ── 3. Build full competitor analysis ────────────────────────────────────────

function websiteToCompetitorSite(
  analysis: WebsiteAnalysis,
  name: string,
  isIndustryLeader: boolean
): CompetitorSiteAnalysis {
  return {
    name,
    url: analysis.url,
    isIndustryLeader,
    websiteGrade: analysis.grade,
    websiteScore: analysis.score,
    offer: analysis.actualOffer,
    strengths: analysis.prominentFeatures ?? [],
    weaknesses: analysis.topIssues ?? [],
    marketingDirection: analysis.marketingDirection,
  };
}

export async function buildCompetitorAnalysis(
  userWebsite: WebsiteAnalysis | null,
  competitorResults: { url: string; analysis: WebsiteAnalysis | null }[],
  industryLeaderResults: { url: string; analysis: WebsiteAnalysis | null }[],
  packet: BusinessPacket
): Promise<CompetitorAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Build competitor site summaries
  const competitors: CompetitorSiteAnalysis[] = competitorResults
    .filter((r) => r.analysis)
    .map((r, i) => websiteToCompetitorSite(r.analysis!, `Competitor ${i + 1}`, false));

  const industryLeaders: CompetitorSiteAnalysis[] = industryLeaderResults
    .filter((r) => r.analysis)
    .map((r, i) => websiteToCompetitorSite(r.analysis!, `Industry Leader ${i + 1}`, true));

  // If no API key or no comparison data, return a minimal result
  if (!apiKey || (competitors.length === 0 && industryLeaders.length === 0)) {
    return {
      userWebsiteGrade: userWebsite?.grade,
      competitors,
      industryLeaders,
      repositioningRecommendations: [],
      suggestedPositioning: userWebsite?.marketingDirection ?? "No data available",
      differentiationOpportunity: "Add competitor data during onboarding for detailed analysis.",
      headlineComparison: {
        current: userWebsite?.suggestedHeadline,
        suggested: userWebsite?.suggestedHeadline ?? "",
        theirs: industryLeaders[0]?.marketingDirection ?? "",
      },
    };
  }

  const genai = new GoogleGenAI({ apiKey });

  // Perplexity enrichment for competitive intelligence
  let perplexityContext = "";
  try {
    const { results } = await perplexitySearch(
      `${packet.orgName} vs competitors ${packet.industry} market positioning strategy`,
      5
    );
    if (results.length > 0) {
      perplexityContext = results.map((r) => `${r.title}: ${r.snippet}`).join("\n").slice(0, 2000);
    }
  } catch {
    // continue without Perplexity
  }

  const userSiteContext = userWebsite
    ? `YOUR WEBSITE (${userWebsite.url}):
Grade: ${userWebsite.grade} (${userWebsite.score}/100)
Actual Offer: ${userWebsite.actualOffer}
Offer Gap: ${userWebsite.offerGap}
Top Issues: ${userWebsite.topIssues.join("; ")}
Current Suggested Headline: "${userWebsite.suggestedHeadline}"`
    : "No website provided.";

  const compContext = [...competitors, ...industryLeaders]
    .map(
      (c) =>
        `${c.isIndustryLeader ? "INDUSTRY LEADER" : "COMPETITOR"}: ${c.name} (${c.url})
Grade: ${c.websiteGrade ?? "N/A"} | Score: ${c.websiteScore ?? "N/A"}/100
Offer: ${c.offer}
Marketing Direction: ${c.marketingDirection}
Strengths: ${c.strengths.slice(0, 3).join("; ")}
Weaknesses: ${c.weaknesses.slice(0, 2).join("; ")}`
    )
    .join("\n\n");

  const prompt = `You are a strategic marketing advisor. Analyze this business against its competitors and industry leaders, then provide specific repositioning recommendations.

BUSINESS: ${packet.orgName} | ${packet.industry}
Revenue Range: ${packet.questionnaire.revenueRange}
Business Model: ${packet.questionnaire.businessModel}

${userSiteContext}

COMPETITIVE LANDSCAPE:
${compContext}

${perplexityContext ? `LIVE MARKET RESEARCH:\n${perplexityContext}` : ""}

Produce a CompetitorAnalysis. Return valid JSON ONLY:
{
  "userWebsiteGrade": "${userWebsite?.grade ?? "N/A"}",
  "competitors": [],
  "industryLeaders": [],
  "repositioningRecommendations": [
    { "rank": 1, "recommendation": "...", "rationale": "...", "implementation": "..." },
    { "rank": 2, "recommendation": "...", "rationale": "...", "implementation": "..." },
    { "rank": 3, "recommendation": "...", "rationale": "...", "implementation": "..." }
  ],
  "suggestedPositioning": "One sentence: who you serve, what you do, why you win",
  "differentiationOpportunity": "What gap exists that this business can uniquely fill",
  "headlineComparison": {
    "current": "${userWebsite?.suggestedHeadline ?? ""}",
    "suggested": "New headline based on top performers pattern",
    "theirs": "How top leaders tend to headline (pattern)"
  }
}

Focus on SPECIFIC, actionable repositioning moves. Reference actual numbers and competitor positioning.`;

  try {
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2000,
      } as Record<string, unknown>,
    });
    const raw = resp.text ?? "{}";
    const parsed = JSON.parse(raw);
    // Merge competitor/leader arrays from our analysis (richer data)
    return {
      ...parsed,
      competitors,
      industryLeaders,
      userWebsiteGrade: userWebsite?.grade,
    } as CompetitorAnalysis;
  } catch (e) {
    console.error("[CompetitorAnalyzer] Synthesis error:", e);
    return {
      userWebsiteGrade: userWebsite?.grade,
      competitors,
      industryLeaders,
      repositioningRecommendations: [],
      suggestedPositioning: "Analysis unavailable — try again.",
      differentiationOpportunity: "",
      headlineComparison: {
        current: userWebsite?.suggestedHeadline,
        suggested: "",
        theirs: "",
      },
    };
  }
}
