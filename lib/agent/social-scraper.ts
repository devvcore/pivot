/**
 * Unified Social Media Scraper
 *
 * Wraps platform-specific npm packages behind a single API.
 * Each platform scraper returns a common `RawSocialData` shape
 * that can be fed directly into Gemini for marketing analysis.
 *
 * Platforms:
 *   - Instagram  → @aduptive/instagram-scraper
 *   - Twitter/X  → @the-convocation/twitter-scraper
 *   - TikTok     → tiktok-scraper-ts
 *   - YouTube    → scrape-youtube (channel search + page scrape)
 *   - LinkedIn   → Perplexity enrichment fallback (no reliable scraper)
 *   - Facebook   → Perplexity enrichment fallback
 */

import { perplexitySearch } from "./perplexity-search";

// ── Shared types ────────────────────────────────────────────────────────────

export interface RawSocialPost {
  text: string;
  likes: number;
  comments: number;
  shares?: number;
  views?: number;
  timestamp?: number;
  url?: string;
  mediaType?: "image" | "video" | "carousel" | "text";
}

export interface RawSocialData {
  platform: string;
  handle: string;
  url: string;
  displayName?: string;
  bio?: string;
  followerCount: number | null;
  followingCount: number | null;
  postCount: number | null;
  verified?: boolean;
  recentPosts: RawSocialPost[];
  averageEngagement?: number; // computed: avg (likes+comments) / followers
  totalLikes?: number;
  scrapedAt: number;
  source: "api" | "perplexity" | "fallback";
  error?: string;
}

// ── Platform detection (shared with social-analyzer) ────────────────────────

export function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "x";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("facebook.com") || lower.includes("fb.com")) return "facebook";
  return "unknown";
}

export function extractHandle(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.hostname.includes("linkedin.com") && parts.length >= 2) return parts[1];
    if (u.hostname.includes("youtube.com") && parts[0] === "@") return parts[0];
    if (u.hostname.includes("youtube.com") && parts.length >= 1) return parts[parts.length - 1];
    return parts[0]?.replace("@", "") ?? url;
  } catch {
    return url;
  }
}

// ── Noise patterns to reject scraper/tool metadata from bios ────────────────
const NOISE_PATTERNS = [
  /apify/i, /scraper/i, /actor/i, /crawl/i, /bot/i,
  /api\s+endpoint/i, /documentation/i, /npm\s+package/i,
];

// ── Main entry point ────────────────────────────────────────────────────────

export async function scrapeSocialProfile(url: string): Promise<RawSocialData> {
  const platform = detectPlatform(url);
  const handle = extractHandle(url);

  try {
    switch (platform) {
      case "instagram":
        return await scrapeInstagram(handle, url);
      case "x":
        return await scrapeTwitter(handle, url);
      case "tiktok":
        return await scrapeTikTok(handle, url);
      case "youtube":
        return await scrapeYouTube(handle, url);
      case "linkedin":
      case "facebook":
        return await scrapeViaPerplexity(platform, handle, url);
      default:
        return buildFallback(platform, handle, url, "Unsupported platform");
    }
  } catch (e) {
    console.warn(`[SocialScraper] ${platform}/${handle} failed:`, e);
    // Fallback to Perplexity enrichment for any platform
    try {
      return await scrapeViaPerplexity(platform, handle, url);
    } catch {
      return buildFallback(platform, handle, url, String(e));
    }
  }
}

/** Scrape multiple profiles in parallel (max 6) */
export async function scrapeSocialProfiles(
  urls: string[]
): Promise<RawSocialData[]> {
  const limited = urls.slice(0, 6);
  const results = await Promise.allSettled(limited.map(scrapeSocialProfile));
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is RawSocialData => r !== null);
}

// ── Instagram ───────────────────────────────────────────────────────────────

async function scrapeInstagram(handle: string, url: string): Promise<RawSocialData> {
  const { InstagramScraper } = await import("@aduptive/instagram-scraper");
  const scraper = new InstagramScraper({
    maxRetries: 2,
    timeout: 15000,
    rateLimitPerMinute: 5,
  });

  const resp = await scraper.getPosts(handle, 12);
  if (!resp.success || !resp.posts) {
    throw new Error(resp.error ?? "Instagram scrape failed");
  }

  const posts: RawSocialPost[] = resp.posts.map((p) => ({
    text: p.caption ?? "",
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    timestamp: p.timestamp ? p.timestamp * 1000 : undefined,
    url: p.url,
    mediaType: p.media_type === "carousel" ? "carousel" : p.is_video ? "video" : "image",
  }));

  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);

  // Instagram scraper doesn't give follower count directly — estimate from engagement
  // or enrich via Perplexity
  let followerCount: number | null = null;
  let bio: string | undefined;
  try {
    const enrichment = await perplexitySearch(`${handle} instagram followers bio`, 3);
    const snippet = enrichment.results.map((r) => r.snippet).join(" ");
    const followerMatch = snippet.match(/([\d,.]+)\s*(?:k|m|K|M)?\s*followers/i);
    if (followerMatch) {
      followerCount = parseFollowerString(followerMatch[0]);
    }
    // Try to extract bio
    const bioMatch = snippet.match(/bio[:\s]*["""]([^"""]+)["""]/i);
    if (bioMatch) bio = bioMatch[1];
  } catch { /* non-fatal */ }

  const avgEngagement =
    followerCount && followerCount > 0 && posts.length > 0
      ? (totalLikes + totalComments) / posts.length / followerCount
      : undefined;

  return {
    platform: "instagram",
    handle,
    url,
    bio,
    followerCount,
    followingCount: null,
    postCount: posts.length,
    recentPosts: posts,
    averageEngagement: avgEngagement,
    totalLikes,
    scrapedAt: Date.now(),
    source: "api",
  };
}

// ── Twitter / X ─────────────────────────────────────────────────────────────

async function scrapeTwitter(handle: string, url: string): Promise<RawSocialData> {
  const { Scraper } = await import("@the-convocation/twitter-scraper");
  const scraper = new Scraper();

  // useGuestAuth exists at runtime but is missing from type defs
  const scraperAny = scraper as unknown as { useGuestAuth?: () => Promise<void> };
  if (typeof scraperAny.useGuestAuth === "function") {
    await scraperAny.useGuestAuth();
  }

  const profile = await scraper.getProfile(handle);
  if (!profile) throw new Error("Twitter profile not found");

  // Fetch recent tweets
  const tweets: RawSocialPost[] = [];
  let count = 0;
  for await (const tweet of scraper.getTweets(handle)) {
    if (count >= 10) break;
    tweets.push({
      text: tweet.text ?? "",
      likes: tweet.likes ?? 0,
      comments: tweet.replies ?? 0,
      shares: tweet.retweets ?? 0,
      views: tweet.views ?? undefined,
      timestamp: tweet.timestamp ? tweet.timestamp * 1000 : undefined,
      url: tweet.permanentUrl ?? undefined,
      mediaType: "text",
    });
    count++;
  }

  const totalLikes = tweets.reduce((s, p) => s + p.likes, 0);
  const followers = profile.followersCount ?? null;
  const avgEngagement =
    followers && followers > 0 && tweets.length > 0
      ? (totalLikes + tweets.reduce((s, p) => s + p.comments, 0)) / tweets.length / followers
      : undefined;

  return {
    platform: "x",
    handle,
    url,
    displayName: profile.name ?? undefined,
    bio: profile.biography ?? undefined,
    followerCount: profile.followersCount ?? null,
    followingCount: profile.followingCount ?? profile.friendsCount ?? null,
    postCount: profile.tweetsCount ?? profile.statusesCount ?? null,
    verified: profile.isVerified ?? profile.isBlueVerified ?? false,
    recentPosts: tweets,
    averageEngagement: avgEngagement,
    totalLikes,
    scrapedAt: Date.now(),
    source: "api",
  };
}

// ── TikTok ──────────────────────────────────────────────────────────────────
// tiktok-scraper-ts requires Puppeteer/browser — too heavy for pipeline.
// Use Perplexity-powered scraping instead for structured TikTok data.

async function scrapeTikTok(handle: string, url: string): Promise<RawSocialData> {
  // Use Perplexity to get real TikTok data (avoids browser dependency)
  const { results } = await perplexitySearch(
    `site:tiktok.com/@${handle} profile bio followers`,
    6
  );

  if (results.length === 0) {
    return buildFallback("tiktok", handle, url, "No TikTok data found via search");
  }

  // Filter results to only those from TikTok or that mention the handle
  const relevantResults = results.filter(r => {
    const resultUrl = (r.url || "").toLowerCase();
    const snippet = (r.snippet || "").toLowerCase();
    // Must be from tiktok.com OR mention the handle
    return resultUrl.includes("tiktok.com") || snippet.includes(handle.toLowerCase());
  });
  // Fall back to all results only if no relevant ones found
  const useResults = relevantResults.length > 0 ? relevantResults : results;

  const allText = useResults.map((r) => r.snippet).join(" ");

  let followerCount: number | null = null;
  let followingCount: number | null = null;
  let totalLikes: number | undefined;
  let postCount: number | null = null;
  let bio: string | undefined;

  // Extract metrics from Perplexity results
  const followerMatch = allText.match(/([\d,.]+)\s*(?:k|m|K|M)?\s*(?:followers)/i);
  if (followerMatch) followerCount = parseFollowerString(followerMatch[0]);

  const followingMatch = allText.match(/([\d,.]+)\s*(?:k|m|K|M)?\s*(?:following)/i);
  if (followingMatch) followingCount = parseFollowerString(followingMatch[0]);

  const likesMatch = allText.match(/([\d,.]+)\s*(?:k|m|K|M|b|B)?\s*(?:likes|hearts)/i);
  if (likesMatch) totalLikes = parseFollowerString(likesMatch[0]) ?? undefined;

  const videoMatch = allText.match(/([\d,.]+)\s*(?:k|K)?\s*(?:videos|posts)/i);
  if (videoMatch) postCount = parseFollowerString(videoMatch[0]);

  // Get bio from first result snippet
  bio = useResults[0]?.snippet?.slice(0, 300);

  // Sanity check: reject bios that are clearly scraper/tool metadata
  if (bio && NOISE_PATTERNS.some(p => p.test(bio!))) {
    console.warn(`[social-scraper] Rejected noisy bio for @${handle}: "${bio.slice(0, 50)}..."`);
    bio = undefined;
  }

  return {
    platform: "tiktok",
    handle,
    url,
    bio,
    followerCount,
    followingCount,
    postCount,
    totalLikes,
    recentPosts: [],
    scrapedAt: Date.now(),
    source: "perplexity",
  };
}

// ── YouTube ─────────────────────────────────────────────────────────────────

async function scrapeYouTube(handle: string, url: string): Promise<RawSocialData> {
  // scrape-youtube is a search library — use it to find the channel, then
  // enrich with Perplexity for subscriber/video data
  const { search } = await import("scrape-youtube");

  let channelName = handle;
  let subscriberCount: number | null = null;
  let bio: string | undefined;
  const posts: RawSocialPost[] = [];

  try {
    // Search for the channel's recent videos
    const results = await search(handle, { type: "video" });
    const videos = Array.isArray(results) ? results : (results as { videos?: unknown[] }).videos ?? [];

    for (const v of (videos as Record<string, unknown>[]).slice(0, 8)) {
      posts.push({
        text: (v.title as string) ?? "",
        likes: 0, // search doesn't return likes
        comments: 0,
        views: (v.views as number) ?? 0,
        url: v.link as string ?? undefined,
        mediaType: "video",
      });
      if (!channelName && v.channel) channelName = (v.channel as Record<string, string>).name ?? handle;
    }
  } catch {
    console.warn("[SocialScraper] YouTube search failed");
  }

  // Enrich with Perplexity for subscriber count
  try {
    const enrichment = await perplexitySearch(`${handle} youtube channel subscribers about`, 3);
    const snippet = enrichment.results.map((r) => r.snippet).join(" ");
    const subMatch = snippet.match(/([\d,.]+)\s*(?:k|m|K|M)?\s*subscribers/i);
    if (subMatch) subscriberCount = parseFollowerString(subMatch[0]);
    const bioMatch = snippet.match(/about[:\s]*["""]([^"""]+)["""]/i);
    if (bioMatch) bio = bioMatch[1];
  } catch { /* non-fatal */ }

  return {
    platform: "youtube",
    handle,
    url,
    displayName: channelName,
    bio,
    followerCount: subscriberCount,
    followingCount: null,
    postCount: posts.length > 0 ? posts.length : null,
    recentPosts: posts,
    totalLikes: undefined,
    scrapedAt: Date.now(),
    source: "api",
  };
}

// ── Perplexity fallback (LinkedIn, Facebook, or any failed platform) ────────

async function scrapeViaPerplexity(
  platform: string,
  handle: string,
  url: string
): Promise<RawSocialData> {
  // Build a targeted site:-based query depending on the platform
  let query: string;
  if (platform === "linkedin") {
    query = `site:linkedin.com/company/${handle} OR site:linkedin.com/in/${handle} followers employees`;
  } else {
    query = `site:${platform}.com/${handle} profile bio followers`;
  }

  const { results } = await perplexitySearch(query, 6);

  if (results.length === 0) {
    return buildFallback(platform, handle, url, "No Perplexity data found");
  }

  // Filter results that actually mention the handle or company name
  const handleLower = handle.toLowerCase();
  const relevantResults = results.filter(r => {
    const text = ((r.snippet || "") + " " + (r.url || "")).toLowerCase();
    return text.includes(handleLower) || text.includes(platform.toLowerCase() + ".com");
  });
  const useResults = relevantResults.length > 0 ? relevantResults : results;

  const allText = useResults.map((r) => r.snippet).join(" ");

  // Try to extract follower count
  let followerCount: number | null = null;
  const followerMatch = allText.match(/([\d,.]+)\s*(?:k|m|K|M)?\s*(?:followers|connections|subscribers)/i);
  if (followerMatch) followerCount = parseFollowerString(followerMatch[0]);

  // Try to extract bio-ish description
  let bio: string | undefined = useResults[0]?.snippet?.slice(0, 300) ?? undefined;

  // Sanity check: reject bios that are clearly scraper/tool metadata
  if (bio && NOISE_PATTERNS.some(p => p.test(bio!))) {
    console.warn(`[social-scraper] Rejected noisy bio for @${handle}: "${bio.slice(0, 50)}..."`);
    bio = undefined;
  }

  return {
    platform,
    handle,
    url,
    bio,
    followerCount,
    followingCount: null,
    postCount: null,
    recentPosts: [],
    scrapedAt: Date.now(),
    source: "perplexity",
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseFollowerString(str: string): number | null {
  const cleaned = str.replace(/,/g, "").replace(/followers|connections|subscribers/gi, "").trim();
  const numMatch = cleaned.match(/([\d.]+)\s*(k|m)?/i);
  if (!numMatch) return null;
  let num = parseFloat(numMatch[1]);
  const suffix = (numMatch[2] ?? "").toLowerCase();
  if (suffix === "k") num *= 1000;
  if (suffix === "m") num *= 1000000;
  return Math.round(num);
}

function buildFallback(
  platform: string,
  handle: string,
  url: string,
  error: string
): RawSocialData {
  return {
    platform,
    handle,
    url,
    followerCount: null,
    followingCount: null,
    postCount: null,
    recentPosts: [],
    scrapedAt: Date.now(),
    source: "fallback",
    error,
  };
}
