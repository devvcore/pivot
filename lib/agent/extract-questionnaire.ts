/**
 * Extract questionnaire fields from uploaded documents.
 * Used when user uploads files first — we infer what we can, then chat fills gaps.
 */
import { GoogleGenAI } from "@google/genai";
import type { Questionnaire } from "@/lib/types";
import type { ParsedFile } from "@/lib/pipeline/parse";

const MODEL = "gemini-3-flash-preview";

const INDUSTRIES = [
  "B2B SaaS", "Consumer SaaS", "Fintech", "Healthcare / MedTech",
  "E-commerce / Retail", "Services / Agency", "Digital Marketing",
  "Consulting", "IT Services", "Software Development", "Manufacturing",
  "Real Estate", "Logistics / Supply Chain", "EdTech", "LegalTech",
  "Other",
];

export interface ExtractedQuestionnaire extends Partial<Questionnaire> {
  organizationName?: string;
  industry?: string;
  website?: string;
  revenueRange?: string;
  businessModel?: string;
  keyCompetitors?: string;
  keyConcerns?: string;
  oneDecisionKeepingOwnerUpAtNight?: string;
  location?: string;
}

export async function extractQuestionnaireFromDocuments(
  parsedFiles: ParsedFile[],
  websiteHint?: string
): Promise<ExtractedQuestionnaire> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};

  const genai = new GoogleGenAI({ apiKey });

  const combined = parsedFiles
    .filter((f) => f.text.trim().length > 100)
    .map((f) => `--- ${f.filename} ---\n${f.text.slice(0, 8000)}`)
    .join("\n\n");

  if (!combined.trim()) return {};

  const prompt = `You are a business intelligence extraction agent. Analyze these business documents and extract ONLY the fields you can confidently identify. Return valid JSON only — no other text.

DOCUMENTS:
${combined}
${websiteHint ? `\nUSER-PROVIDED WEBSITE: ${websiteHint}` : ""}

Extract into this JSON structure (omit any field you cannot confidently determine):
{
  "organizationName": "<company/business name>",
  "industry": "<one of: ${INDUSTRIES.join(", ")}>",
  "website": "<company website URL if mentioned>",
  "revenueRange": "<e.g. $0 - $10M, $10M - $50M, $50M - $100M>",
  "businessModel": "<one sentence: what they sell>",
  "keyCompetitors": "<comma-separated competitor names if mentioned>",
  "keyConcerns": "<main business concern if stated>",
  "oneDecisionKeepingOwnerUpAtNight": "<critical decision if stated>",
  "location": "<city/region if mentioned>"
}

Rules:
- Only include fields with clear evidence in the documents
- organizationName: look for letterhead, company name, "About" sections
- industry: infer from products, services, or explicit mentions
- revenueRange: infer from revenue figures, P&L, or funding amounts
- Leave fields empty if uncertain`;

  try {
    const resp = await genai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 800,
      } as Record<string, unknown>,
    });

    const raw = resp.text ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const result: ExtractedQuestionnaire = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== "" && v !== null && v !== undefined && typeof v === "string") {
        (result as Record<string, unknown>)[k] = v;
      }
    }
    return result;
  } catch (e) {
    console.warn("[extractQuestionnaire] Extraction failed:", e);
    return {};
  }
}
