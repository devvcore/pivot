/**
 * Marketing Intelligence Synthesizer
 *
 * Flow:
 *   1. Scrape real social data (followers, posts, engagement) via social-scraper
 *   2. Analyze profiles via Gemini (grades, themes, strengths/weaknesses)
 *   3. Research marketing channels via Perplexity
 *   4. Feed ALL raw scraped data + analysis + Perplexity research into Gemini Flash
 *      to produce a full MarketingStrategyReport
 *
 * The key insight: Gemini gets the ACTUAL post text, ACTUAL like counts,
 * ACTUAL follower numbers — not just pre-digested summaries.
 */
import { GoogleGenAI } from "@google/genai";
import { perplexitySearch } from "@/lib/agent/perplexity-search";
import {
  scrapeSocialProfile,
  type RawSocialData,
} from "@/lib/agent/social-scraper";
import {
  analyzeSocialProfile,
  findCompetitorSocialUrls,
} from "@/lib/agent/social-analyzer";
import type {
  Questionnaire,
  BusinessPacket,
  WebsiteAnalysis,
  CompetitorAnalysis,
  SocialProfileAnalysis,
  MarketingStrategyReport,
} from "@/lib/types";

const FLASH_MODEL = "gemini-2.5-flash";

// ── 1. Gather social profiles (scrape + analyze) ───────────────────────────

export async function gatherSocialProfiles(
  questionnaire: Questionnaire,
  competitorNames: string[]
): Promise<{
  userProfiles: SocialProfileAnalysis[];
  competitorProfiles: SocialProfileAnalysis[];
  userRawData: RawSocialData[];
  competitorRawData: RawSocialData[];
}> {
  // ── Collect user URLs ──
  const userUrls: { url: string; companyName: string }[] = [];
  if (questionnaire.socialMediaUrls) {
    for (const [, url] of Object.entries(questionnaire.socialMediaUrls)) {
      if (url) userUrls.push({ url, companyName: questionnaire.organizationName });
    }
  }

  // ── Collect competitor URLs via Perplexity discovery ──
  const competitorUrls: { url: string; companyName: string }[] = [];
  const userPlatforms = questionnaire.socialMediaPlatforms ?? ["instagram", "linkedin"];

  for (const name of competitorNames.slice(0, 3)) {
    try {
      const found = await findCompetitorSocialUrls(name, userPlatforms);
      for (const f of found) {
        competitorUrls.push({ url: f.url, companyName: name });
      }
    } catch { /* skip */ }
  }

  // ── Step A: Scrape raw data from all platforms in parallel ──
  console.log(`[Marketing] Scraping ${userUrls.length} user + ${competitorUrls.length} competitor profiles...`);

  const [userRawResults, competitorRawResults] = await Promise.all([
    Promise.allSettled(userUrls.map((u) => scrapeSocialProfile(u.url))),
    Promise.allSettled(competitorUrls.map((u) => scrapeSocialProfile(u.url))),
  ]);

  const userRawData = userRawResults
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is RawSocialData => r !== null);

  const competitorRawData = competitorRawResults
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is RawSocialData => r !== null);

  console.log(`[Marketing] Scraped: ${userRawData.length} user profiles, ${competitorRawData.length} competitor profiles`);
  for (const d of userRawData) {
    console.log(`  ${d.platform} @${d.handle}: ${d.followerCount ?? "?"} followers, ${d.recentPosts.length} posts (source: ${d.source})`);
  }

  // ── Step B: Run Gemini analysis on scraped data (grades, themes) ──
  const [userProfiles, competitorProfiles] = await Promise.all([
    Promise.allSettled(
      userUrls.map((u) => analyzeSocialProfile(u.url, u.companyName, false))
    ).then((r) => r.filter((x): x is PromiseFulfilledResult<SocialProfileAnalysis> => x.status === "fulfilled").map((x) => x.value)),
    Promise.allSettled(
      competitorUrls.map((u) => analyzeSocialProfile(u.url, u.companyName, true))
    ).then((r) => r.filter((x): x is PromiseFulfilledResult<SocialProfileAnalysis> => x.status === "fulfilled").map((x) => x.value)),
  ]);

  return { userProfiles, competitorProfiles, userRawData, competitorRawData };
}

// ── 2. Research marketing channels via Perplexity ──────────────────────────

async function researchMarketingChannels(
  industry: string,
  businessModel: string
): Promise<string> {
  try {
    const { results } = await perplexitySearch(
      `best marketing channels for ${industry} ${businessModel} businesses 2025 2026 growth strategies`,
      6
    );
    if (results.length === 0) return "";
    return results
      .map((r) => `${r.title}: ${r.snippet}`)
      .join("\n")
      .slice(0, 3000);
  } catch {
    return "";
  }
}

// ── 3. Synthesize full marketing report ────────────────────────────────────

export async function synthesizeMarketingStrategy(
  questionnaire: Questionnaire,
  packet: BusinessPacket,
  websiteAnalysis: WebsiteAnalysis | null,
  competitorAnalysis: CompetitorAnalysis | null,
  userProfiles: SocialProfileAnalysis[],
  competitorProfiles: SocialProfileAnalysis[],
  userRawData: RawSocialData[] = [],
  competitorRawData: RawSocialData[] = []
): Promise<MarketingStrategyReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallback(questionnaire, userProfiles, competitorProfiles);
  }

  // Perplexity channel research
  const channelResearch = await researchMarketingChannels(
    packet.industry,
    questionnaire.businessModel
  );

  const genai = new GoogleGenAI({ apiKey });

  // ── Build RAW DATA context (actual posts, actual numbers) ──
  const userRawContext = userRawData.length > 0
    ? userRawData.map((d) => {
        const postList = d.recentPosts.slice(0, 6).map((p, i) =>
          `  Post ${i + 1}: "${p.text.slice(0, 150)}" | ${p.likes} likes | ${p.comments} comments${p.views ? ` | ${p.views} views` : ""}${p.shares ? ` | ${p.shares} shares` : ""}`
        ).join("\n");
        return `${d.platform.toUpperCase()} (@${d.handle}) — REAL SCRAPED DATA:
  Followers: ${d.followerCount ?? "Unknown"} | Following: ${d.followingCount ?? "Unknown"} | Posts: ${d.postCount ?? "Unknown"}
  Bio: "${d.bio ?? "N/A"}"
  Verified: ${d.verified ?? "Unknown"}
  Avg Engagement Rate: ${d.averageEngagement ? (d.averageEngagement * 100).toFixed(2) + "%" : "Unknown"}
  Total Likes: ${d.totalLikes ?? "Unknown"}
  Data Source: ${d.source}
RECENT POSTS:
${postList || "  No posts scraped"}`;
      }).join("\n\n")
    : "No raw social data scraped.";

  const compRawContext = competitorRawData.length > 0
    ? competitorRawData.map((d) => {
        const postList = d.recentPosts.slice(0, 4).map((p, i) =>
          `  Post ${i + 1}: "${p.text.slice(0, 120)}" | ${p.likes} likes | ${p.comments} comments${p.views ? ` | ${p.views} views` : ""}`
        ).join("\n");
        return `COMPETITOR ${d.platform.toUpperCase()} (@${d.handle}):
  Followers: ${d.followerCount ?? "Unknown"} | Verified: ${d.verified ?? "Unknown"}
  Bio: "${d.bio ?? "N/A"}"
  Avg Engagement: ${d.averageEngagement ? (d.averageEngagement * 100).toFixed(2) + "%" : "Unknown"}
THEIR POSTS:
${postList || "  No posts scraped"}`;
      }).join("\n\n")
    : "No competitor raw data scraped.";

  // ── Build ANALYSIS context (grades, themes) ──
  const userAnalysisContext = userProfiles.length > 0
    ? userProfiles.map((p) =>
        `${p.platform.toUpperCase()} (@${p.handle}): Grade ${p.profileGrade} (${p.profileScore}/100) | Followers: ${p.followerCount} | Engagement: ${p.engagementLevel} | Posting: ${p.postFrequency}\nBio: ${p.bioSummary}\nThemes: ${p.contentThemes.join(", ")}\nStrengths: ${p.strengths.join("; ")}\nWeaknesses: ${p.weaknesses.join("; ")}`
      ).join("\n\n")
    : "No social profiles analyzed.";

  const compAnalysisContext = competitorProfiles.length > 0
    ? competitorProfiles.map((p) =>
        `${p.companyName ?? "Competitor"} — ${p.platform.toUpperCase()} (@${p.handle}): Grade ${p.profileGrade} (${p.profileScore}/100) | Followers: ${p.followerCount} | Engagement: ${p.engagementLevel}\nThemes: ${p.contentThemes.join(", ")}\nStrengths: ${p.strengths.join("; ")}`
      ).join("\n\n")
    : "No competitor social profiles analyzed.";

  const websiteContext = websiteAnalysis
    ? `WEBSITE (${websiteAnalysis.url}): Grade ${websiteAnalysis.grade} (${websiteAnalysis.score}/100)\nActual Offer: ${websiteAnalysis.actualOffer}\nPerceived Offer: ${websiteAnalysis.perceivedOffer}\nOffer Gap: ${websiteAnalysis.offerGap}\nSuggested Headline: "${websiteAnalysis.suggestedHeadline}"\nCTA: ${websiteAnalysis.ctaAssessment}\nMarketing Direction: ${websiteAnalysis.marketingDirection}`
    : "No website analysis available.";

  const competitorWebContext = competitorAnalysis
    ? `COMPETITOR POSITIONING:\n${competitorAnalysis.competitors.map((c) => `${c.name}: ${c.offer} | Marketing: ${c.marketingDirection}`).join("\n")}\nINDUSTRY LEADERS:\n${competitorAnalysis.industryLeaders.map((l) => `${l.name}: ${l.offer} | Marketing: ${l.marketingDirection}`).join("\n")}\nSuggested Positioning: ${competitorAnalysis.suggestedPositioning}`
    : "No competitor website analysis available.";

  const currentChannels = questionnaire.marketingChannels ?? [];

  const prompt = `You are a senior marketing strategist. Produce a comprehensive marketing strategy based on REAL SCRAPED social media data, competitor analysis, and industry research.

BUSINESS: ${packet.orgName} | ${packet.industry}
Revenue: ${questionnaire.revenueRange}
Business Model: ${questionnaire.businessModel}
Current Marketing Channels: ${currentChannels.length > 0 ? currentChannels.join(", ") : "None specified"}
Website Visitors/Day: ${questionnaire.websiteVisitorsPerDay ?? "Unknown"}

═══ YOUR SOCIAL MEDIA — RAW SCRAPED DATA ═══
${userRawContext}

═══ YOUR SOCIAL MEDIA — AI ANALYSIS ═══
${userAnalysisContext}

═══ COMPETITOR SOCIAL MEDIA — RAW SCRAPED DATA ═══
${compRawContext}

═══ COMPETITOR SOCIAL MEDIA — AI ANALYSIS ═══
${compAnalysisContext}

═══ YOUR WEBSITE ═══
${websiteContext}

═══ COMPETITOR WEBSITES ═══
${competitorWebContext}

${channelResearch ? `═══ INDUSTRY MARKETING RESEARCH (Perplexity) ═══\n${channelResearch}` : ""}

IMPORTANT: The social media data above was gathered via web research and may be incomplete or inaccurate. If follower counts show "Unknown", do NOT make up or guess numbers. Only reference specific metrics you can see in the data. Mark any uncertain data with "(estimated)" or "(unverified)".

Return valid JSON ONLY with this structure:
{
  "channelRecommendations": [
    {
      "rank": 1,
      "channel": "<specific channel: Instagram Reels, LinkedIn Posts, Cold Email, Google Ads, TikTok, Newsletter, etc.>",
      "why": "<why this channel for THIS business — reference their actual data>",
      "effort": "<Low|Medium|High>",
      "expectedImpact": "<expected results in 3 months>",
      "howToStart": "<specific first 3 steps to get started>"
    }
  ],
  "socialMediaStrategy": [
    {
      "platform": "<platform name>",
      "currentGrade": "<their current grade on this platform, or null if not active>",
      "vsCompetitorGrade": "<best competitor grade on this platform>",
      "improvements": ["<specific improvement referencing their actual content>", "<improvement 2>", "<improvement 3>"],
      "contentSuggestions": ["<specific content idea based on what's working in their posts>", "<content idea 2>", "<content idea 3>"],
      "postingFrequency": "<recommended posting frequency>"
    }
  ],
  "websiteCopyRecommendations": [
    {
      "section": "<Homepage Hero|About Page|CTA|Pricing Page|etc.>",
      "current": "<what it currently says or does>",
      "suggested": "<what it should say — actual copy suggestion>",
      "rationale": "<why this change, referencing competitor positioning>"
    }
  ],
  "offerPositioning": {
    "currentPositioning": "<how they currently position — reference their actual bio/website>",
    "competitorPositioning": ["<how competitor 1 positions — reference their actual posts>", "<how competitor 2 positions>"],
    "suggestedRepositioning": "<how they SHOULD position, informed by what competitor content gets the most engagement>",
    "keyMessages": ["<key message 1>", "<key message 2>", "<key message 3>"]
  },
  "contentStrategy": "<2-3 paragraph strategy: what to create (reference their best-performing post types), where to publish, how often, what topics based on their actual content themes>",
  "adSpendRecommendation": "<if relevant: where to spend ad budget and expected ROI>",
  "summary": "<3-4 sentence executive summary referencing actual metrics>"
}

RULES:
- Give 5-7 channel recommendations, ranked by impact-to-effort ratio
- Reference ACTUAL post content and engagement numbers from the scraped data
- For social strategy, cover EVERY platform they're on plus 1-2 they SHOULD be on
- Website copy recs should reference how competitors/leaders phrase similar things
- Be specific — cite actual post examples, actual follower counts, actual engagement rates
- Channel recs should include platforms they're NOT using but should be`;

  try {
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 4000,
      } as Record<string, unknown>,
    });

    const raw = resp.text ?? "{}";
    const parsed = JSON.parse(raw);

    return {
      currentChannels,
      socialProfiles: userProfiles,
      competitorSocialProfiles: competitorProfiles,
      channelRecommendations: parsed.channelRecommendations ?? [],
      socialMediaStrategy: parsed.socialMediaStrategy ?? [],
      websiteCopyRecommendations: parsed.websiteCopyRecommendations ?? [],
      offerPositioning: parsed.offerPositioning ?? {
        currentPositioning: "",
        competitorPositioning: [],
        suggestedRepositioning: "",
        keyMessages: [],
      },
      contentStrategy: parsed.contentStrategy ?? "",
      adSpendRecommendation: parsed.adSpendRecommendation,
      summary: parsed.summary ?? "",
    };
  } catch (e) {
    console.error("[MarketingSynthesizer] Failed:", e);
    return buildFallback(questionnaire, userProfiles, competitorProfiles);
  }
}

function buildFallback(
  q: Questionnaire,
  userProfiles: SocialProfileAnalysis[],
  competitorProfiles: SocialProfileAnalysis[]
): MarketingStrategyReport {
  return {
    currentChannels: q.marketingChannels ?? [],
    socialProfiles: userProfiles,
    competitorSocialProfiles: competitorProfiles,
    channelRecommendations: [],
    socialMediaStrategy: [],
    websiteCopyRecommendations: [],
    offerPositioning: {
      currentPositioning: "Analysis unavailable",
      competitorPositioning: [],
      suggestedRepositioning: "",
      keyMessages: [],
    },
    contentStrategy: "Marketing strategy synthesis failed. Please try again.",
    summary: "Marketing analysis could not be completed.",
  };
}
