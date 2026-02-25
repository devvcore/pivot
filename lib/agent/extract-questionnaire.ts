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

function safeParseJsonObject(raw: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text) return {};

  // Handle fenced JSON blocks.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || text;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Fallback: try extracting first JSON object.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function inferFromFilenames(parsedFiles: ParsedFile[], websiteHint?: string): ExtractedQuestionnaire {
  const result: ExtractedQuestionnaire = {};
  const stems = parsedFiles.map((f) =>
    f.filename
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, " ")
      .trim()
  );

  const stop = new Set([
    "overview",
    "summary",
    "report",
    "casestudies",
    "case",
    "studies",
    "study",
    "document",
    "deck",
    "slides",
    "final",
    "v1",
    "v2",
    "v3",
  ]);

  const tokenCounts = new Map<string, number>();
  for (const stem of stems) {
    for (const token of stem.split(/[_\-\s]+/).map((t) => t.toLowerCase()).filter(Boolean)) {
      if (token.length < 3 || stop.has(token)) continue;
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }

  const topToken = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topToken) {
    result.organizationName = topToken.charAt(0).toUpperCase() + topToken.slice(1);
  }

  if (websiteHint?.trim()) {
    result.website = websiteHint.trim();
    if (!result.organizationName) {
      try {
        const host = new URL(websiteHint.trim()).hostname.replace(/^www\./, "");
        const org = host.split(".")[0];
        if (org && org.length > 2) {
          result.organizationName = org.charAt(0).toUpperCase() + org.slice(1);
        }
      } catch {
        // ignore invalid website hints
      }
    }
  }

  const combinedNames = stems.join(" ").toLowerCase();
  if (combinedNames.includes("ai") || combinedNames.includes("automation")) result.industry = "B2B SaaS";
  if (combinedNames.includes("fintech")) result.industry = "Fintech";
  if (combinedNames.includes("health") || combinedNames.includes("med")) result.industry = "Healthcare / MedTech";

  return result;
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

  if (!combined.trim()) {
    return inferFromFilenames(parsedFiles, websiteHint);
  }

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
    const parsed = safeParseJsonObject(raw);

    const result: ExtractedQuestionnaire = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== "" && v !== null && v !== undefined && typeof v === "string") {
        (result as Record<string, unknown>)[k] = v;
      }
    }
    const inferred = inferFromFilenames(parsedFiles, websiteHint);
    return { ...inferred, ...result };
  } catch (e) {
    console.warn("[extractQuestionnaire] Extraction failed:", e);
    return inferFromFilenames(parsedFiles, websiteHint);
  }
}
