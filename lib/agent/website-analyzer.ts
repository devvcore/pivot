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

const LITE_MODEL = "gemini-2.0-flash-lite";

async function fetchWebsiteText(url: string): Promise<string> {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const resp = await fetch(normalized, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PivotAI/1.0; +https://pivot.ai)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    // Strip HTML tags — keep text content only
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 8000);
    return text;
  } catch (e) {
    throw new Error(`Could not fetch ${url}: ${String(e)}`);
  }
}

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallback(url, "GEMINI_API_KEY not configured");
  }

  let pageText: string;
  try {
    pageText = await fetchWebsiteText(url);
  } catch (e) {
    return buildFallback(url, String(e));
  }

  const genai = new GoogleGenAI({ apiKey });

  const prompt = `You are a marketing and conversion optimization expert analyzing a business website.

Website URL: ${url}
Website Content (extracted text):
---
${pageText}
---

Perform a comprehensive website analysis from a business growth perspective. Return valid JSON ONLY:
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
