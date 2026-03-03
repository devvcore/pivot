/**
 * Pitch Deck Analyzer — reviews uploaded pitch decks and provides
 * structured feedback, scoring, and improvement recommendations.
 *
 * Also integrates with 2slides.com API for generating new decks.
 */
import { GoogleGenAI } from "@google/genai";
import type { PitchDeckAnalysis, BusinessPacket, Questionnaire } from "@/lib/types";

const FLASH_MODEL = "gemini-2.5-flash-preview-05-20";

const TWOSLIDES_API = "https://2slides.com/api/v1";
const TWOSLIDES_KEY = process.env.TWOSLIDES_API_KEY ?? "";

// ── Pitch Deck Analysis ─────────────────────────────────────────────────────

export async function analyzePitchDeck(
  deckText: string,
  fileName: string,
  packet: BusinessPacket,
  questionnaire: Questionnaire,
): Promise<PitchDeckAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genai = new GoogleGenAI({ apiKey });

  const prompt = `You are a pitch deck expert who has reviewed thousands of investor decks. Analyze this pitch deck and provide detailed, actionable feedback.

COMPANY CONTEXT:
- Name: ${packet.orgName}
- Industry: ${packet.industry}
- Revenue: ${questionnaire.revenueRange}
- Business Model: ${questionnaire.businessModel}

PITCH DECK CONTENT (extracted from ${fileName}):
${deckText.slice(0, 15000)}

Analyze the deck and return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "overallGrade": "<A/B/C/D/F>",
  "headline": "<one-line verdict>",
  "extractedContent": {
    "problemStatement": "<what problem they claim to solve, or null>",
    "solution": "<their solution, or null>",
    "marketOpportunity": "<TAM/SAM/SOM or market size claims, or null>",
    "businessModel": "<how they make money, or null>",
    "traction": "<metrics/achievements mentioned, or null>",
    "teamSummary": "<team info if present, or null>",
    "fundingAsk": "<amount requested if present, or null>",
    "useOfFunds": "<how funds will be used if present, or null>"
  },
  "strengths": ["<what the deck does well>", ...],
  "weaknesses": ["<specific problems>", ...],
  "missingSlides": ["<essential slides that are absent>", ...],
  "recommendations": [
    {
      "rank": 1,
      "area": "<which slide/section>",
      "current": "<what it says now>",
      "suggested": "<what it should say>",
      "rationale": "<why this change matters>"
    }
  ],
  "suggestedInfographics": [
    {
      "slide": "<which slide>",
      "type": "<chart type: bar chart, timeline, process flow, funnel, comparison table, etc.>",
      "description": "<what data to visualize and how>"
    }
  ],
  "positioningAdvice": "<overall strategic positioning guidance for this deck>"
}

SCORING RUBRIC:
- 90-100 (A): Investor-ready, compelling narrative, strong data
- 75-89 (B): Good foundation, needs minor refinements
- 60-74 (C): Decent content but significant gaps in story or data
- 40-59 (D): Major restructuring needed
- 0-39 (F): Needs complete overhaul

ESSENTIAL SLIDES (flag if missing): Problem, Solution, Market Size, Business Model, Traction, Team, Financial Projections, Ask/Use of Funds, Competition

Be specific and actionable. Reference exact slide content when giving recommendations.`;

  const resp = await genai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.3,
      maxOutputTokens: 3000,
    } as Record<string, unknown>,
  });

  const text = resp.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse pitch deck analysis response");

  const result = JSON.parse(jsonMatch[0]);

  return {
    fileName,
    slideCount: (deckText.match(/\[Slide \d+\]/g) ?? []).length || undefined,
    overallScore: result.overallScore ?? 0,
    overallGrade: result.overallGrade ?? "F",
    headline: result.headline ?? "Analysis unavailable",
    extractedContent: result.extractedContent ?? {},
    strengths: result.strengths ?? [],
    weaknesses: result.weaknesses ?? [],
    missingSlides: result.missingSlides ?? [],
    recommendations: (result.recommendations ?? []).map((r: any, i: number) => ({
      rank: r.rank ?? i + 1,
      area: r.area ?? "",
      current: r.current ?? "",
      suggested: r.suggested ?? "",
      rationale: r.rationale ?? "",
    })),
    suggestedInfographics: (result.suggestedInfographics ?? []).map((s: any) => ({
      slide: s.slide ?? "",
      type: s.type ?? "",
      description: s.description ?? "",
    })),
    positioningAdvice: result.positioningAdvice ?? "",
  };
}

// ── 2slides Integration ─────────────────────────────────────────────────────

export interface SlideGenerationRequest {
  companyName: string;
  industry: string;
  businessModel: string;
  problemStatement?: string;
  solution?: string;
  traction?: string;
  fundingAsk?: string;
  additionalContext?: string;
}

export async function generatePitchDeck(req: SlideGenerationRequest): Promise<{
  jobId: string;
  status: string;
}> {
  const userInput = buildSlidePrompt(req);

  const response = await fetch(`${TWOSLIDES_API}/slides/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TWOSLIDES_KEY}`,
    },
    body: JSON.stringify({
      userInput,
      themeId: "default",
      responseLanguage: "en",
      mode: "AUTO",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`2slides API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    jobId: data.jobId ?? data.id ?? "",
    status: data.status ?? "pending",
  };
}

export async function checkSlideJob(jobId: string): Promise<{
  status: string;
  downloadUrl?: string;
  previewUrl?: string;
}> {
  const response = await fetch(`${TWOSLIDES_API}/jobs/${jobId}`, {
    headers: {
      "Authorization": `Bearer ${TWOSLIDES_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`2slides job check failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    status: data.status ?? "unknown",
    downloadUrl: data.downloadUrl ?? data.result?.downloadUrl,
    previewUrl: data.previewUrl ?? data.result?.previewUrl,
  };
}

function buildSlidePrompt(req: SlideGenerationRequest): string {
  const parts = [
    `Create a professional investor pitch deck for ${req.companyName}.`,
    `Industry: ${req.industry}`,
    `Business Model: ${req.businessModel}`,
  ];

  if (req.problemStatement) parts.push(`Problem: ${req.problemStatement}`);
  if (req.solution) parts.push(`Solution: ${req.solution}`);
  if (req.traction) parts.push(`Traction: ${req.traction}`);
  if (req.fundingAsk) parts.push(`Funding Ask: ${req.fundingAsk}`);
  if (req.additionalContext) parts.push(`Additional Context: ${req.additionalContext}`);

  parts.push(`
Include slides for:
1. Title/Cover slide
2. Problem statement
3. Solution overview
4. Market opportunity (TAM/SAM/SOM)
5. Business model / how we make money
6. Traction and milestones
7. Competitive landscape
8. Team
9. Financial projections (3-year)
10. The ask / use of funds
11. Contact / next steps

Style: Clean, professional, data-driven. Use charts and visuals where possible.`);

  return parts.join("\n");
}
