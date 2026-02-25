/**
 * Marketing Intelligence Synthesizer
 *
 * Takes social profile analyses (user + competitors), website analyses,
 * competitor analysis, and questionnaire data to produce a full
 * MarketingStrategyReport via Gemini Flash.
 *
 * Perplexity is used for channel/platform research when available.
 */
import { GoogleGenAI } from "@google/genai";
import { perplexitySearch } from "@/lib/agent/perplexity-search";
import {
  analyzeSocialProfiles,
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

const FLASH_MODEL = "gemini-3-flash-preview";

// ── 1. Gather social profiles ──────────────────────────────────────────────

export async function gatherSocialProfiles(
  questionnaire: Questionnaire,
  competitorNames: string[]
): Promise<{
  userProfiles: SocialProfileAnalysis[];
  competitorProfiles: SocialProfileAnalysis[];
}> {
  // User's own profiles
  const userProfileInputs: { url: string; companyName?: string; isCompetitor?: boolean }[] = [];
  if (questionnaire.socialMediaUrls) {
    for (const [, url] of Object.entries(questionnaire.socialMediaUrls)) {
      if (url) {
        userProfileInputs.push({
          url,
          companyName: questionnaire.organizationName,
          isCompetitor: false,
        });
      }
    }
  }

  // Competitor profiles — find via Perplexity, then analyze
  const competitorProfileInputs: { url: string; companyName?: string; isCompetitor?: boolean }[] = [];
  const userPlatforms = questionnaire.socialMediaPlatforms ?? ["instagram", "linkedin"];

  for (const name of competitorNames.slice(0, 3)) {
    try {
      const found = await findCompetitorSocialUrls(name, userPlatforms);
      for (const f of found) {
        competitorProfileInputs.push({
          url: f.url,
          companyName: name,
          isCompetitor: true,
        });
      }
    } catch {
      // skip
    }
  }

  // Analyze all in parallel
  const [userProfiles, competitorProfiles] = await Promise.all([
    userProfileInputs.length > 0
      ? analyzeSocialProfiles(userProfileInputs)
      : Promise.resolve([]),
    competitorProfileInputs.length > 0
      ? analyzeSocialProfiles(competitorProfileInputs)
      : Promise.resolve([]),
  ]);

  return { userProfiles, competitorProfiles };
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
  competitorProfiles: SocialProfileAnalysis[]
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

  // Build context sections
  const userSocialContext = userProfiles.length > 0
    ? userProfiles.map((p) =>
        `${p.platform.toUpperCase()} (@${p.handle}): Grade ${p.profileGrade} (${p.profileScore}/100) | Followers: ${p.followerCount} | Engagement: ${p.engagementLevel} | Posting: ${p.postFrequency}\nBio: ${p.bioSummary}\nThemes: ${p.contentThemes.join(", ")}\nStrengths: ${p.strengths.join("; ")}\nWeaknesses: ${p.weaknesses.join("; ")}`
      ).join("\n\n")
    : "No social profiles provided.";

  const compSocialContext = competitorProfiles.length > 0
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

  const prompt = `You are a senior marketing strategist. Produce a comprehensive marketing strategy for this business based on their current presence, competitors, and industry research.

BUSINESS: ${packet.orgName} | ${packet.industry}
Revenue: ${questionnaire.revenueRange}
Business Model: ${questionnaire.businessModel}
Current Marketing Channels: ${currentChannels.length > 0 ? currentChannels.join(", ") : "None specified"}
Website Visitors/Day: ${questionnaire.websiteVisitorsPerDay ?? "Unknown"}

YOUR SOCIAL MEDIA PROFILES:
${userSocialContext}

COMPETITOR SOCIAL PROFILES:
${compSocialContext}

YOUR WEBSITE:
${websiteContext}

COMPETITOR WEBSITES:
${competitorWebContext}

${channelResearch ? `INDUSTRY MARKETING RESEARCH:\n${channelResearch}` : ""}

Return valid JSON ONLY with this structure:
{
  "channelRecommendations": [
    {
      "rank": 1,
      "channel": "<specific channel: Instagram Reels, LinkedIn Posts, Cold Email, Google Ads, TikTok, Newsletter, etc.>",
      "why": "<why this channel for THIS business specifically>",
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
      "improvements": ["<specific improvement 1>", "<improvement 2>", "<improvement 3>"],
      "contentSuggestions": ["<specific content idea 1>", "<content idea 2>", "<content idea 3>"],
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
    "currentPositioning": "<how they currently position their offer>",
    "competitorPositioning": ["<how competitor 1 positions>", "<how competitor 2 positions>"],
    "suggestedRepositioning": "<how they SHOULD position, informed by what works for competitors/leaders>",
    "keyMessages": ["<key message 1>", "<key message 2>", "<key message 3>"]
  },
  "contentStrategy": "<2-3 paragraph content strategy: what to create, where to publish, how often, what topics>",
  "adSpendRecommendation": "<if relevant: where to spend ad budget and expected ROI>",
  "summary": "<3-4 sentence executive summary of the marketing strategy>"
}

RULES:
- Give 5-7 channel recommendations, ranked by impact-to-effort ratio
- For social strategy, cover EVERY platform the user is on plus 1-2 they SHOULD be on
- Website copy recs should reference how competitors/leaders phrase similar things
- Be specific — no generic advice. Reference actual competitor data.
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
