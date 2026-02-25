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

const LITE_MODEL = "gemini-3-flash-preview";

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
      "User-Agent": "Mozilla/5.0 (compatible; PivotAI/1.0; +https://pivot.ai)",
      "Accept": "text/html,application/xhtml+xml",
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
    .slice(0, 12000);
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
    const text = (visibleText || snapshot || "").replace(/\s{2,}/g, " ").trim().slice(0, 12000);
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

export async function analyzeWebsite(
  url: string,
  opts?: { runId?: string; label?: string }
): Promise<WebsiteAnalysis> {
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

  try {
    const resp = await genai.models.generateContent({
      model: LITE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 2000,
      } as Record<string, unknown>,
    });
    const raw = resp.text ?? "{}";
    const result = JSON.parse(raw) as Partial<WebsiteAnalysis>;
    return {
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
  } catch (e) {
    console.warn("[WebsiteAnalyzer] Analysis failed:", e);
    return buildFallback(url, String(e));
  }
}

function buildFallback(url: string, reason: string): WebsiteAnalysis {
  return {
    url,
    grade: "C",
    score: 60,
    synopsis: `Website analysis could not be completed: ${reason}`,
    actualOffer: "Unable to determine",
    perceivedOffer: "Unable to determine",
    offerGap: "Analysis unavailable",
    topIssues: ["Website analysis failed — please check the URL and try again"],
    recommendations: ["Ensure the website URL is accessible and try again"],
    suggestedHeadline: "",
    prominentFeatures: [],
    marketingDirection: "",
    ctaAssessment: "",
    analyzedAt: Date.now(),
  };
}
