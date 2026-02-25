/**
 * Social Media Profile Analyzer
 *
 * Uses real platform scrapers (Instagram, Twitter/X, TikTok, YouTube)
 * to fetch actual profile data, then feeds it into Gemini for
 * structured marketing analysis.
 *
 * Flow:
 *   1. social-scraper.ts fetches real data (followers, posts, engagement)
 *   2. Gemini Lite analyzes the real data → SocialProfileAnalysis
 *   3. Results include actual metrics, not estimates
 *
 * Supported: Instagram, Twitter/X, TikTok, YouTube, LinkedIn*, Facebook*
 * (* = Perplexity enrichment fallback)
 */
import { GoogleGenAI } from "@google/genai";
import {
  scrapeSocialProfile,
  scrapeSocialProfiles as scrapeMultiple,
  detectPlatform,
  extractHandle,
  type RawSocialData,
} from "./social-scraper";
import { perplexitySearch } from "./perplexity-search";
import type { SocialProfileAnalysis } from "@/lib/types";

const LITE_MODEL = "gemini-2.5-flash";

// ── Main analysis function ─────────────────────────────────────────────────

export async function analyzeSocialProfile(
  url: string,
  companyName?: string,
  isCompetitor = false
): Promise<SocialProfileAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  const platform = detectPlatform(url);
  const handle = extractHandle(url);

  // Step 1: Scrape real data from the platform
  let scraped: RawSocialData;
  try {
    scraped = await scrapeSocialProfile(url);
  } catch (e) {
    console.warn(`[SocialAnalyzer] Scrape failed for ${url}:`, e);
    scraped = {
      platform, handle, url,
      followerCount: null, followingCount: null, postCount: null,
      recentPosts: [], scrapedAt: Date.now(), source: "fallback",
      error: String(e),
    };
  }

  if (!apiKey) {
    // No Gemini — build analysis directly from scraped data
    return buildFromScrapedData(scraped, isCompetitor, companyName);
  }

  // Step 2: Feed real data into Gemini for structured analysis
  const genai = new GoogleGenAI({ apiKey });
  const name = companyName ?? handle;

  const postSummary = scraped.recentPosts.length > 0
    ? scraped.recentPosts.slice(0, 8).map((p, i) =>
        `Post ${i + 1}: "${p.text.slice(0, 120)}" | Likes: ${p.likes} | Comments: ${p.comments}${p.views ? ` | Views: ${p.views}` : ""}${p.shares ? ` | Shares: ${p.shares}` : ""}`
      ).join("\n")
    : "No posts could be scraped.";

  const prompt = `You are a social media marketing analyst. Analyze this ${platform} profile based on REAL scraped data and return structured insights.

PROFILE: ${name} (@${scraped.handle})
PLATFORM: ${platform}
URL: ${url}
DATA SOURCE: ${scraped.source} (${scraped.source === "api" ? "directly scraped from platform" : "web research"})

REAL METRICS:
- Followers: ${scraped.followerCount ?? "Unknown"}
- Following: ${scraped.followingCount ?? "Unknown"}
- Total Posts: ${scraped.postCount ?? "Unknown"}
- Verified: ${scraped.verified ?? "Unknown"}
- Bio: ${scraped.bio ?? "Not available"}
- Average Engagement Rate: ${scraped.averageEngagement ? (scraped.averageEngagement * 100).toFixed(2) + "%" : "Unknown"}
- Total Likes: ${scraped.totalLikes ?? "Unknown"}

RECENT POSTS (REAL DATA):
${postSummary}

Based on this REAL data, return valid JSON ONLY:
{
  "followerCount": "<actual follower count from data above, e.g. '12.4K'>",
  "postFrequency": "<estimate posting frequency from timestamps, e.g. '3-4 posts/week'>",
  "bioSummary": "<what their bio communicates in 1-2 sentences>",
  "contentThemes": ["<top theme from their actual posts>", "<theme 2>", "<theme 3>"],
  "engagementLevel": "<High|Medium|Low — calculate from actual likes/comments vs followers>",
  "strengths": ["<based on real post performance>", "<strength 2>"],
  "weaknesses": ["<based on what's missing in their content>", "<weakness 2>"],
  "profileGrade": "<A/B/C/D/F>",
  "profileScore": <integer 0-100>,
  "topPerformingContent": "<describe their best-performing post type based on the data>",
  "postingRecommendation": "<specific recommendation: what to post, how often, based on what works>"
}

Grading rubric:
A (90-100): High engagement rate (>3%), consistent posting, strong brand presence
B (75-89): Good engagement (1-3%), mostly consistent, clear value proposition
C (60-74): Low engagement (<1%), inconsistent posting, generic content
D (45-59): Very low engagement, barely active
F (0-44): Inactive or no real content

IMPORTANT: Use the REAL numbers provided. Do not guess or make up follower counts.`;

  try {
    const resp = await genai.models.generateContent({
      model: LITE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 1500,
      } as Record<string, unknown>,
    });

    const raw = resp.text ?? "{}";
    const result = JSON.parse(raw);

    return {
      platform: scraped.platform,
      handle: scraped.handle,
      url,
      followerCount: result.followerCount ?? formatFollowerCount(scraped.followerCount),
      postFrequency: result.postFrequency ?? "Unknown",
      bioSummary: result.bioSummary ?? scraped.bio ?? "",
      contentThemes: result.contentThemes ?? [],
      engagementLevel: result.engagementLevel ?? "Unknown",
      strengths: result.strengths ?? [],
      weaknesses: result.weaknesses ?? [],
      profileGrade: result.profileGrade ?? "C",
      profileScore: result.profileScore ?? 50,
      isCompetitor,
      companyName: companyName ?? undefined,
    };
  } catch (e) {
    console.warn("[SocialAnalyzer] Gemini analysis failed, using scraped data directly:", e);
    return buildFromScrapedData(scraped, isCompetitor, companyName);
  }
}

// ── Batch analysis (parallel, max 5) ───────────────────────────────────────

export async function analyzeSocialProfiles(
  profiles: { url: string; companyName?: string; isCompetitor?: boolean }[]
): Promise<SocialProfileAnalysis[]> {
  const limited = profiles.slice(0, 5);
  const results = await Promise.allSettled(
    limited.map((p) =>
      analyzeSocialProfile(p.url, p.companyName, p.isCompetitor ?? false)
    )
  );
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is SocialProfileAnalysis => r !== null);
}

// ── Find competitor social profiles via Perplexity ─────────────────────────

export async function findCompetitorSocialUrls(
  competitorName: string,
  platforms: string[] = ["instagram", "linkedin", "tiktok"]
): Promise<{ platform: string; url: string }[]> {
  const results: { platform: string; url: string }[] = [];

  for (const platform of platforms.slice(0, 3)) {
    try {
      const { results: searchResults } = await perplexitySearch(
        `${competitorName} official ${platform} profile page`,
        3
      );
      for (const r of searchResults) {
        if (r.url && detectPlatform(r.url) === platform) {
          results.push({ platform, url: r.url });
          break;
        }
      }
    } catch {
      // skip this platform
    }
  }

  return results;
}

// ── Build analysis directly from scraped data (no Gemini) ──────────────────

function buildFromScrapedData(
  scraped: RawSocialData,
  isCompetitor: boolean,
  companyName?: string
): SocialProfileAnalysis {
  const followers = scraped.followerCount;
  const posts = scraped.recentPosts;
  const avgLikes = posts.length > 0
    ? posts.reduce((s, p) => s + p.likes, 0) / posts.length
    : 0;
  const avgComments = posts.length > 0
    ? posts.reduce((s, p) => s + p.comments, 0) / posts.length
    : 0;

  // Calculate engagement level from real data
  let engagementLevel = "Unknown";
  if (followers && followers > 0 && posts.length > 0) {
    const rate = (avgLikes + avgComments) / followers;
    if (rate > 0.03) engagementLevel = "High";
    else if (rate > 0.01) engagementLevel = "Medium";
    else engagementLevel = "Low";
  }

  // Grade based on what we have
  let profileScore = 50;
  let profileGrade = "C";
  if (scraped.source === "fallback") {
    profileScore = 0;
    profileGrade = "N/A";
  } else if (followers && followers > 0) {
    if (engagementLevel === "High") { profileScore = 85; profileGrade = "B"; }
    else if (engagementLevel === "Medium") { profileScore = 70; profileGrade = "C"; }
    else { profileScore = 55; profileGrade = "D"; }
    if (posts.length >= 8) profileScore += 5; // consistent posting bonus
    profileGrade = profileScore >= 90 ? "A" : profileScore >= 75 ? "B" : profileScore >= 60 ? "C" : profileScore >= 45 ? "D" : "F";
  }

  // Extract content themes from post text
  const allText = posts.map((p) => p.text).join(" ");
  const themes: string[] = [];
  if (allText.length > 50) {
    // Simple keyword extraction from actual posts
    const words = allText.toLowerCase().split(/\s+/);
    const freq: Record<string, number> = {};
    for (const w of words) {
      if (w.length > 4 && !["https", "their", "about", "would", "which", "there", "these"].includes(w)) {
        freq[w] = (freq[w] ?? 0) + 1;
      }
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
    themes.push(...sorted.map(([w]) => w));
  }

  return {
    platform: scraped.platform,
    handle: scraped.handle,
    url: scraped.url,
    followerCount: formatFollowerCount(scraped.followerCount),
    postFrequency: estimatePostFrequency(posts),
    bioSummary: scraped.bio ?? (scraped.error ? `Could not analyze: ${scraped.error}` : "Profile data unavailable"),
    contentThemes: themes.length > 0 ? themes : ["Unable to determine from available data"],
    engagementLevel,
    strengths: buildStrengths(scraped),
    weaknesses: buildWeaknesses(scraped),
    profileGrade,
    profileScore,
    isCompetitor,
    companyName,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFollowerCount(count: number | null): string {
  if (count === null) return "Unknown";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function estimatePostFrequency(posts: { timestamp?: number }[]): string {
  const withTs = posts.filter((p) => p.timestamp).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  if (withTs.length < 2) return "Unknown";
  const newest = withTs[0].timestamp!;
  const oldest = withTs[withTs.length - 1].timestamp!;
  const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
  if (daySpan <= 0) return "Unknown";
  const postsPerDay = withTs.length / daySpan;
  if (postsPerDay >= 2) return `${Math.round(postsPerDay)} posts/day`;
  if (postsPerDay >= 0.7) return "Daily";
  const perWeek = postsPerDay * 7;
  if (perWeek >= 1) return `${Math.round(perWeek)} posts/week`;
  return "Less than weekly";
}

function buildStrengths(scraped: RawSocialData): string[] {
  const strengths: string[] = [];
  if (scraped.verified) strengths.push("Verified account");
  if (scraped.followerCount && scraped.followerCount > 10000) strengths.push(`Strong following (${formatFollowerCount(scraped.followerCount)})`);
  if (scraped.recentPosts.length >= 8) strengths.push("Consistent posting cadence");
  if (scraped.averageEngagement && scraped.averageEngagement > 0.03) strengths.push("High engagement rate");
  const hasVideo = scraped.recentPosts.some((p) => p.mediaType === "video");
  if (hasVideo) strengths.push("Uses video content");
  if (strengths.length === 0) strengths.push("Active on platform");
  return strengths;
}

function buildWeaknesses(scraped: RawSocialData): string[] {
  const weaknesses: string[] = [];
  if (!scraped.bio) weaknesses.push("No bio or unclear value proposition");
  if (scraped.recentPosts.length < 3) weaknesses.push("Infrequent posting");
  if (scraped.averageEngagement !== undefined && scraped.averageEngagement < 0.01) weaknesses.push("Low engagement rate relative to followers");
  if (scraped.followerCount !== null && scraped.followerCount < 500) weaknesses.push("Small audience — needs growth strategy");
  if (!scraped.recentPosts.some((p) => p.mediaType === "video")) weaknesses.push("No video content detected");
  if (weaknesses.length === 0) weaknesses.push("Limited data for analysis");
  return weaknesses;
}
