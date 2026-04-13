/**
 * Website Grading Agent (Gemini Flash Lite)
 *
 * Input: URL of a business website
 * Process: Fetch page content → Gemini Lite analysis
 * Output: WebsiteAnalysis with grade A-F, score 0-100, offer alignment,
 *         recommendations, suggested headline, marketing direction
 *
 * Used at:
 * 1. Pipeline run time (if URL provided in questionnaire)
 * 2. ARIA agent tool call (on demand in chat)
 */
import { GoogleGenAI } from "@google/genai";
import type { WebsiteAnalysis } from "@/lib/types";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

const LITE_MODEL = "gemini-2.5-flash";

interface WebsiteBrowseResult {
  text: string;
  snapshot: string;
  screenshotBase64?: string;
  source: "better-browse" | "http-fetch";
}

function normalizeUrl(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

async function fetchWebsiteTextViaHttp(url: string): Promise<WebsiteBrowseResult> {
  const normalized = normalizeUrl(url);
  const resp = await fetch(normalized, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 24000);
  return { text, snapshot: "", source: "http-fetch" };
}

async function fetchWebsiteWithBrowserAgent(url: string): Promise<WebsiteBrowseResult> {
  const normalized = normalizeUrl(url);
  const mod = await import("better-browse");
  const BrowserCtor = mod.Browser;
  const browser = new BrowserCtor({ headless: true });
  try {
    await browser.launch();
    await browser.navigate(normalized);
    const [snapshot, visibleText, screenshotBase64] = await Promise.all([
      browser.getSnapshot().catch(() => ""),
      browser.extractText().catch(() => ""),
      browser.screenshot().catch(() => ""),
    ]);
    const text = (visibleText || snapshot || "").replace(/\s{2,}/g, " ").trim().slice(0, 24000);
    return {
      text,
      snapshot: (snapshot || "").slice(0, 8000),
      screenshotBase64: screenshotBase64 || undefined,
      source: "better-browse",
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function fetchWebsiteIntelligence(url: string): Promise<WebsiteBrowseResult> {
  try {
    return await fetchWebsiteWithBrowserAgent(url);
  } catch (e) {
    console.warn("[WebsiteAnalyzer] better-browse fallback to HTTP:", e);
    return fetchWebsiteTextViaHttp(url);
  }
}

async function maybePersistScreenshot(
  screenshotBase64: string | undefined,
  opts?: { runId?: string; label?: string }
): Promise<void> {
  if (!screenshotBase64 || !opts?.runId) return;
  try {
    const dir = path.join(process.cwd(), "uploads", opts.runId, "website-agent");
    await mkdir(dir, { recursive: true });
    const label = opts.label ? opts.label.replace(/[^a-zA-Z0-9_-]/g, "_") : "site";
    const filePath = path.join(dir, `${label}-${Date.now()}.png`);
    await writeFile(filePath, Buffer.from(screenshotBase64, "base64"));
  } catch (e) {
    console.warn("[WebsiteAnalyzer] Could not persist screenshot:", e);
  }
}

/**
 * Attempt to repair truncated JSON from Gemini.
 * Extracts whatever complete key-value pairs exist before the truncation point.
 */
function repairTruncatedJson(raw: string): Partial<WebsiteAnalysis> {
  const result: Record<string, any> = {};

  // Extract simple string fields: "key": "value"
  const stringPattern = /"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = stringPattern.exec(raw)) !== null) {
    result[match[1]] = match[2];
  }

  // Extract number fields: "key": 123
  const numPattern = /"(\w+)"\s*:\s*(\d+)/g;
  while ((match = numPattern.exec(raw)) !== null) {
    result[match[1]] = Number(match[2]);
  }

  // Extract complete arrays: "key": ["val1", "val2"]
  const arrayPattern = /"(\w+)"\s*:\s*\[((?:[^\]])*)\]/g;
  while ((match = arrayPattern.exec(raw)) !== null) {
    try {
      result[match[1]] = JSON.parse(`[${match[2]}]`);
    } catch {
      // Extract individual strings from the partial array
      const items: string[] = [];
      const itemPattern = /"((?:[^"\\]|\\.)*)"/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemPattern.exec(match[2])) !== null) {
        items.push(itemMatch[1]);
      }
      if (items.length > 0) result[match[1]] = items;
    }
  }

  return result as Partial<WebsiteAnalysis>;
}

// Cache: URL → { analysis, timestamp }. Avoids re-analyzing the same site within 1 hour.
const analysisCache = new Map<string, { analysis: WebsiteAnalysis; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function analyzeWebsite(
  url: string,
  opts?: { runId?: string; label?: string; skipCache?: boolean }
): Promise<WebsiteAnalysis> {
  const normalized = normalizeUrl(url);

  // Check cache first
  if (!opts?.skipCache) {
    const cached = analysisCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[WebsiteAnalyzer] Cache hit for ${normalized} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
      return cached.analysis;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallback(url, "GEMINI_API_KEY not configured");
  }

  let browseResult: WebsiteBrowseResult;
  try {
    browseResult = await fetchWebsiteIntelligence(url);
    await maybePersistScreenshot(browseResult.screenshotBase64, opts);
  } catch (e) {
    return buildFallback(url, String(e));
  }

  const genai = new GoogleGenAI({ apiKey });

  const prompt = `You are a marketing and conversion optimization expert analyzing a business website.

Website URL: ${url}
Website Agent Source: ${browseResult.source}
ARIA Snapshot (if available):
---
${browseResult.snapshot || "N/A"}
---

Website Content (extracted text):
---
${browseResult.text}
---

Perform a critical website analysis from a business growth perspective. Be direct, specific, and skeptical. Return valid JSON ONLY:
{
  "grade": "<A/B/C/D/F — overall marketing effectiveness grade>",
  "score": <integer 0-100>,
  "synopsis": "<2-3 sentence summary of what this website is and does>",
  "actualOffer": "<what the site is actually promoting/selling based on its content>",
  "perceivedOffer": "<what a first-time visitor likely thinks they do within 5 seconds>",
  "offerGap": "<gap between actual offer and what visitors perceive — or 'Aligned' if clear>",
  "topIssues": [
    "<specific issue #1 — e.g. 'No clear CTA above the fold'>",
    "<specific issue #2>",
    "<specific issue #3>",
    "<specific issue #4>",
    "<specific issue #5>"
  ],
  "recommendations": [
    "<specific actionable recommendation #1>",
    "<recommendation #2>",
    "<recommendation #3>",
    "<recommendation #4>"
  ],
  "suggestedHeadline": "<a better homepage headline for this business>",
  "prominentFeatures": [
    "<what should be most prominent on homepage based on their offer>",
    "<feature 2>",
    "<feature 3>"
  ],
  "marketingDirection": "<2-3 sentences on the overall marketing strategy this business should pursue>",
  "ctaAssessment": "<assessment of their call-to-action: clear/unclear/missing and what it should say>"
}

Grade rubric:
A (90-100): Clear offer, strong CTA, mobile-friendly, fast, trust signals visible
B (75-89): Good clarity but missing key conversion elements
C (60-74): Confusing offer, weak CTAs, outdated design
D (45-59): Major clarity issues, no clear value proposition, poor trust signals
F (0-44): Fundamentally broken, unreadable, or no clear purpose`;

  // Retry up to 3 times — Gemini frequently returns truncated JSON
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await genai.models.generateContent({
        model: LITE_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 3000,  // increased from 2000 to reduce truncation
        } as Record<string, unknown>,
      });
      const raw = resp.text ?? "{}";

      // Try strict parse first
      let result: Partial<WebsiteAnalysis>;
      try {
        result = JSON.parse(raw);
      } catch {
        // Gemini returned truncated JSON — attempt to salvage
        console.warn(`[WebsiteAnalyzer] Truncated JSON (attempt ${attempt + 1}/3, ${raw.length} chars), repairing...`);
        result = repairTruncatedJson(raw);
        if (!result.grade && !result.synopsis) {
          // Repair failed, retry
          if (attempt < 2) continue;
          return buildFallback(url, "AI returned invalid JSON after 3 attempts");
        }
      }

      const analysis: WebsiteAnalysis = {
        url,
        grade: result.grade ?? "C",
        score: result.score ?? 60,
        synopsis: result.synopsis ?? "",
        actualOffer: result.actualOffer ?? "",
        perceivedOffer: result.perceivedOffer ?? "",
        offerGap: result.offerGap ?? "",
        topIssues: result.topIssues ?? [],
        recommendations: result.recommendations ?? [],
        suggestedHeadline: result.suggestedHeadline ?? "",
        prominentFeatures: result.prominentFeatures ?? [],
        marketingDirection: result.marketingDirection ?? "",
        ctaAssessment: result.ctaAssessment ?? "",
        analyzedAt: Date.now(),
      };

      // Cache successful result
      analysisCache.set(normalized, { analysis, timestamp: Date.now() });
      return analysis;
    } catch (e) {
      console.warn(`[WebsiteAnalyzer] Attempt ${attempt + 1}/3 failed:`, e);
      if (attempt < 2) continue;
      return buildFallback(url, String(e));
    }
  }

  return buildFallback(url, "Analysis failed after 3 attempts");
}

function buildFallback(url: string, reason: string): WebsiteAnalysis {
  return {
    url,
    grade: "N/A" as any,
    score: 0,
    synopsis: `Website analysis could not be completed: ${reason}`,
    actualOffer: "",
    perceivedOffer: "",
    offerGap: "",
    topIssues: ["Analysis failed — the website could not be graded. Check the URL and try again."],
    recommendations: ["Retry the analysis or verify the website is publicly accessible"],
    suggestedHeadline: "",
    prominentFeatures: [],
    marketingDirection: "",
    ctaAssessment: "",
    analyzedAt: Date.now(),
    failed: true,
  };
}
