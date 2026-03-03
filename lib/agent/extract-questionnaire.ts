/**
 * Extract questionnaire fields from uploaded documents.
 * Phase 1: Programmatic text extraction (regex, keyword matching) — free, instant.
 * Phase 2: AI fills remaining semantic gaps (business model summary, concerns) — only if needed.
 */
import { GoogleGenAI } from "@google/genai";
import type { Questionnaire } from "@/lib/types";
import type { ParsedFile } from "@/lib/pipeline/parse";

const AI_MODEL = "gemini-2.5-flash";

const INDUSTRIES: { label: string; keywords: string[] }[] = [
  { label: "B2B SaaS", keywords: ["saas", "software as a service", "b2b software", "cloud platform", "api platform"] },
  { label: "Consumer SaaS", keywords: ["consumer app", "mobile app", "consumer software", "b2c saas"] },
  { label: "Fintech", keywords: ["fintech", "financial technology", "payments", "banking", "lending", "neobank"] },
  { label: "Healthcare / MedTech", keywords: ["healthcare", "medtech", "medical", "health tech", "clinical", "patient", "telemedicine"] },
  { label: "E-commerce / Retail", keywords: ["e-commerce", "ecommerce", "retail", "online store", "shopify", "marketplace"] },
  { label: "Services / Agency", keywords: ["agency", "consulting", "freelance", "services", "web design", "web development", "creative agency", "design agency", "builds websites", "build websites", "custom websites"] },
  { label: "Digital Marketing", keywords: ["digital marketing", "seo", "social media marketing", "content marketing", "ppc", "advertising agency"] },
  { label: "Consulting", keywords: ["consulting firm", "management consulting", "strategy consulting", "advisory"] },
  { label: "IT Services", keywords: ["it services", "managed services", "it support", "helpdesk", "infrastructure"] },
  { label: "Software Development", keywords: ["software development", "custom software", "app development", "dev shop", "engineering team"] },
  { label: "Manufacturing", keywords: ["manufacturing", "factory", "production", "assembly", "fabrication"] },
  { label: "Real Estate", keywords: ["real estate", "property", "realty", "brokerage", "commercial real estate"] },
  { label: "Logistics / Supply Chain", keywords: ["logistics", "supply chain", "shipping", "freight", "warehouse", "fulfillment"] },
  { label: "EdTech", keywords: ["edtech", "education technology", "e-learning", "online course", "lms"] },
  { label: "LegalTech", keywords: ["legaltech", "legal technology", "law firm", "legal services"] },
  { label: "Construction", keywords: ["construction", "general contractor", "builder", "roofing", "plumbing"] },
  { label: "Food & Beverage", keywords: ["food", "beverage", "restaurant", "catering", "food delivery"] },
  { label: "Cybersecurity", keywords: ["cybersecurity", "security software", "infosec", "threat detection"] },
  { label: "Staffing / Recruitment", keywords: ["staffing", "recruitment", "hiring", "talent acquisition", "headhunter"] },
];

const INDUSTRY_LABELS = INDUSTRIES.map((i) => i.label);

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

// ── Phase 1: Programmatic extraction ────────────────────────────────────────

function extractOrgName(texts: string[], filenames: string[], websiteHint?: string): string | undefined {
  // Strategy 1: Look for common patterns in document text
  const patterns = [
    /(?:company|organization|business)\s*(?:name)?[:\-–]\s*([A-Z][A-Za-z0-9.\-& ]{1,40})/,
    /(?:^|\n)\s*(?:welcome to|about)\s+([A-Z][A-Za-z0-9.\-& ]{1,30})(?:[!.\n])/i,
    /(?:^|\n)\s*([A-Z][A-Za-z0-9.]{1,25})\s*(?:comprehensive|financial|operational|annual)\s/i,
    /(?:^|\n)\s*([A-Z][A-Za-z0-9.]+(?:\.[a-z]{2,4}))\s/i, // Matches "Nouvo.dev" style
  ];

  for (const text of texts) {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m?.[1]) {
        const name = m[1].trim().replace(/\s+/g, " ");
        if (name.length >= 2 && name.length <= 40) return name;
      }
    }
  }

  // Strategy 2: Most frequent capitalized proper noun across filenames
  const stopWords = new Set(["sales", "script", "tactics", "welcome", "pricing", "sheet", "audit", "report", "overview", "summary", "document", "final"]);
  const counts = new Map<string, number>();
  for (const fn of filenames) {
    const stem = fn.replace(/^\d+_/, "").replace(/\.[^.]+$/, "").replace(/[_\-]/g, " ");
    for (const token of stem.split(/\s+/)) {
      const lower = token.toLowerCase();
      if (lower.length < 2 || stopWords.has(lower)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const topToken = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topToken && topToken[1] >= 2) return topToken[0];

  // Strategy 3: Derive from website URL
  if (websiteHint) {
    try {
      const host = new URL(websiteHint).hostname.replace(/^www\./, "");
      const name = host.split(".")[0];
      if (name && name.length > 2) return name.charAt(0).toUpperCase() + name.slice(1);
    } catch { /* ignore */ }
  }

  return undefined;
}

function extractWebsite(texts: string[], websiteHint?: string): string | undefined {
  if (websiteHint?.trim()) return websiteHint.trim();
  const urlPattern = /https?:\/\/[a-zA-Z0-9.\-]+\.[a-z]{2,}(?:\/[^\s)"\]<>]*)*/gi;
  for (const text of texts) {
    const matches = text.match(urlPattern);
    if (matches) {
      // Filter out common non-company URLs
      const filtered = matches.filter((u) => !u.includes("google.com") && !u.includes("facebook.com") && !u.includes("linkedin.com") && !u.includes("instagram.com") && !u.includes("twitter.com"));
      if (filtered.length > 0) return filtered[0];
      return matches[0]; // fallback to first URL
    }
  }
  return undefined;
}

function extractIndustry(texts: string[]): string | undefined {
  const combined = texts.join(" ").toLowerCase();
  let bestMatch: { label: string; count: number } | null = null;

  for (const ind of INDUSTRIES) {
    let count = 0;
    for (const kw of ind.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = combined.match(regex);
      if (matches) count += matches.length;
    }
    if (count > 0 && (!bestMatch || count > bestMatch.count)) {
      bestMatch = { label: ind.label, count };
    }
  }

  return bestMatch?.label;
}

function extractRevenue(texts: string[]): string | undefined {
  const combined = texts.join(" ");

  // Look for explicit revenue mentions
  const revenuePatterns = [
    /(?:total\s+)?revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:k|K|thousand)?/i,
    /(?:annual|monthly|total)\s+(?:revenue|income|sales)[:\s]*\$?([\d,]+(?:\.\d+)?)/i,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:in\s+)?(?:revenue|sales|income)/i,
    /revenue[^.]*?\$\s*([\d,]+(?:\.\d+)?)/i,
    /gross\s+income[:\s]*\$?([\d,]+(?:\.\d+)?)/i,
  ];

  for (const pat of revenuePatterns) {
    const m = combined.match(pat);
    if (m?.[1]) {
      const raw = m[1].replace(/,/g, "");
      const num = parseFloat(raw);
      if (isNaN(num)) continue;

      // Check if "k" or "K" modifier
      const fullMatch = m[0].toLowerCase();
      const multiplied = fullMatch.includes("k") || fullMatch.includes("thousand") ? num * 1000 : num;

      if (multiplied < 10_000_000) return "$0 - $10M";
      if (multiplied < 50_000_000) return "$10M - $50M";
      if (multiplied < 100_000_000) return "$50M - $100M";
      return "$100M+";
    }
  }

  return undefined;
}

function extractLocation(texts: string[]): string | undefined {
  const combined = texts.join(" ");
  const patterns = [
    /(?:headquartered|based|located|location|address|office)[:\s]+(?:in\s+)?([A-Z][a-zA-Z\s,]+(?:,\s*[A-Z]{2})?)(?:\s|\.|\n)/,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*(?:CA|NY|TX|FL|IL|WA|MA|CO|GA|NC|PA|OH|VA|AZ|OR|NV|UT|TN|MN|WI|MD|MO|IN|SC|AL|LA|KY|OK|CT|IA|MS|AR|KS|NE|NM|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC))\b/,
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m?.[1]) {
      const loc = m[1].trim().replace(/\s+/g, " ");
      if (loc.length >= 3 && loc.length <= 60) return loc;
    }
  }
  return undefined;
}

function extractCompetitors(texts: string[]): string | undefined {
  const combined = texts.join(" ");
  const patterns = [
    /(?:competitors?|competing\s+with|compete\s+(?:with|against)|competitive\s+landscape|vs\.?)[:\s]+([^.;\n]{5,120})/i,
    /(?:compared\s+to|alternative\s+to|similar\s+to)[:\s]+([^.;\n]{5,80})/i,
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m?.[1]) {
      return m[1].trim().replace(/\s+/g, " ");
    }
  }
  return undefined;
}

function extractConcerns(texts: string[]): string | undefined {
  const combined = texts.join(" ");

  // High-confidence patterns — structured risk/concern statements from reports
  const patterns = [
    /(?:concentration\s+risk|revenue\s+concentration|client\s+concentration)[^.]*?([^.]{15,200}\.)/i,
    /(?:key\s+(?:man|person)\s+(?:risk|dependency)|single\s+point\s+of\s+failure|operational\s+risk)[^.]*?([^.]{15,200}\.)/i,
    /(?:key\s+risk|primary\s+risk|major\s+risk|critical\s+risk|top\s+risk)[s]?[:\s]+([^.]{15,200}\.)/i,
    /(?:key\s+concern|primary\s+concern|major\s+concern)[s]?[:\s]+([^.]{15,200}\.)/i,
    /(?:risk\s+assessment|risk\s+factors?|risk\s+summary)[:\s]+([^.]{15,200}\.)/i,
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m?.[1]) {
      const text = m[1].trim().replace(/\s+/g, " ");
      // Sanity check: must not look like a sales script or conversation
      if (!/\b(?:you|your|they|them|ask|question|nod|affirm)\b/i.test(text)) {
        return text;
      }
    }
  }

  // Look for risk-related sentences in report-style documents only
  const sentences = combined.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const isRiskSentence = /\b(?:risk|vulnerable|dependency|reliance|concentration|exposure|threat)\b/i.test(s);
    const isBusinessContext = /\b(?:revenue|client|employee|team|operational|financial|market)\b/i.test(s);
    const isNotConversational = !/\b(?:you|your|ask|question|hey|how's|tell me)\b/i.test(s);
    if (isRiskSentence && isBusinessContext && isNotConversational && s.length > 25 && s.length < 250) {
      return s.trim();
    }
  }
  return undefined;
}

function extractBusinessModel(texts: string[]): string | undefined {
  const combined = texts.join(" ");
  const patterns = [
    // Formal business descriptions
    /(?:our\s+(?:company|business|firm|agency)\s+(?:offers|provides|delivers|builds|creates|specializes))[^.]{5,200}\./i,
    /(?:services?\s+(?:include|offered|provided)|products?\s+(?:include|offered))[:\s]+([^.]{10,200}\.)/i,
    /(?:pricing\s+(?:sheet|tiers?|plans?|model))[:\s].*?(?:starting\s+(?:at|from)|from\s+\$|per\s+(?:month|year|project))[^.]{5,120}/i,
    /(?:core\s+(?:services?|offerings?|products?))[:\s]+([^.]{10,200}\.)/i,
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m) {
      const text = (m[1] || m[0]).trim().replace(/\s+/g, " ");
      // Filter out sales script / conversational text
      if (text.length > 10 && !/\b(?:hey|how's|tell me|you know|what's your)\b/i.test(text)) {
        return text.slice(0, 200);
      }
    }
  }
  return undefined;
}

function extractCriticalDecision(texts: string[]): string | undefined {
  const combined = texts.join(" ");
  const patterns = [
    /(?:recommend(?:ation)?|decision|should\s+(?:consider|prioritize|hire|invest)|plan\s+to\s+(?:hire|expand|invest))[^.]{5,200}\./i,
    /(?:Q[1-4]|next\s+quarter|immediate\s+(?:action|priority))[^.]*?(?:hire|invest|expand|launch|pivot)[^.]{5,150}\./i,
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m) {
      return m[0].trim().replace(/\s+/g, " ").slice(0, 200);
    }
  }
  return undefined;
}

/**
 * Phase 1: Programmatic extraction — regex + keyword matching on raw text.
 * Free, instant, no API tokens.
 */
function programmaticExtract(parsedFiles: ParsedFile[], websiteHint?: string): ExtractedQuestionnaire {
  const texts = parsedFiles.filter((f) => f.text.trim().length > 50).map((f) => f.text);
  const filenames = parsedFiles.map((f) => f.filename);
  const result: ExtractedQuestionnaire = {};

  const orgName = extractOrgName(texts, filenames, websiteHint);
  if (orgName) result.organizationName = orgName;

  const website = extractWebsite(texts, websiteHint);
  if (website) result.website = website;

  const industry = extractIndustry(texts);
  if (industry) result.industry = industry;

  const revenue = extractRevenue(texts);
  if (revenue) result.revenueRange = revenue;

  const location = extractLocation(texts);
  if (location) result.location = location;

  const competitors = extractCompetitors(texts);
  if (competitors) result.keyCompetitors = competitors;

  const concerns = extractConcerns(texts);
  if (concerns) result.keyConcerns = concerns;

  const bizModel = extractBusinessModel(texts);
  if (bizModel) result.businessModel = bizModel;

  const decision = extractCriticalDecision(texts);
  if (decision) result.oneDecisionKeepingOwnerUpAtNight = decision;

  return result;
}

// ── Phase 2: AI fills semantic gaps ─────────────────────────────────────────

const FIELDS_FOR_AI = [
  "industry", "revenueRange", "businessModel",
  "keyConcerns", "oneDecisionKeepingOwnerUpAtNight", "location",
] as const;

async function aiExtractGaps(
  parsedFiles: ParsedFile[],
  existing: ExtractedQuestionnaire,
  websiteHint?: string,
): Promise<ExtractedQuestionnaire> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return existing;

  // Figure out which fields are still missing.
  // Always re-evaluate industry with AI — programmatic keyword matching is imprecise.
  const missing = FIELDS_FOR_AI.filter((k) => !existing[k] || k === "industry");
  if (missing.length === 0) {
    console.log("[extractQuestionnaire] All fields covered by programmatic extraction, skipping AI");
    return existing;
  }

  const combined = parsedFiles
    .filter((f) => f.text.trim().length > 50)
    .map((f) => `--- ${f.filename} ---\n${f.text.slice(0, 6000)}`)
    .join("\n\n");

  if (!combined.trim()) return existing;

  // Build a focused prompt for only missing fields
  const fieldDescriptions: Record<string, string> = {
    industry: `"industry": "<one of: ${INDUSTRY_LABELS.join(", ")}>"`,
    revenueRange: `"revenueRange": "<$0 - $10M, $10M - $50M, $50M - $100M, or $100M+>"`,
    businessModel: `"businessModel": "<one sentence: what they sell and how>"`,
    keyConcerns: `"keyConcerns": "<main business risk or concern>"`,
    oneDecisionKeepingOwnerUpAtNight: `"oneDecisionKeepingOwnerUpAtNight": "<most critical pending decision>"`,
    location: `"location": "<city, state or region>"`,
  };

  const schema = missing.map((k) => fieldDescriptions[k]).join(",\n  ");

  const prompt = `Extract ONLY these missing fields from the business documents. Return valid JSON with only the fields listed — nothing else.

DOCUMENTS:
${combined}
${websiteHint ? `\nWEBSITE: ${websiteHint}` : ""}

Return JSON:
{
  ${schema}
}

Rules: Only include fields with clear evidence. Omit any you cannot determine.`;

  console.log(`[extractQuestionnaire] AI filling ${missing.length} gaps: ${missing.join(", ")} (${prompt.length} chars)`);

  try {
    const genai = new GoogleGenAI({ apiKey });
    const resp = await genai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    const raw = resp.text ?? "{}";
    console.log(`[extractQuestionnaire] AI response (${raw.length} chars):`, raw.slice(0, 300));

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to salvage partial JSON
      const kvPattern = /"(\w+)"\s*:\s*"([^"]*)"/g;
      let match;
      while ((match = kvPattern.exec(raw)) !== null) {
        parsed[match[1]] = match[2];
      }
    }

    // Merge only the missing fields from AI
    const merged = { ...existing };
    for (const key of missing) {
      const val = parsed[key];
      if (typeof val === "string" && val.trim()) {
        (merged as Record<string, unknown>)[key] = val.trim();
      }
    }

    console.log("[extractQuestionnaire] Final fields:", Object.keys(merged).filter((k) => merged[k as keyof ExtractedQuestionnaire]));
    return merged;
  } catch (e) {
    console.warn("[extractQuestionnaire] AI gap-fill failed (non-fatal):", e);
    return existing;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function extractQuestionnaireFromDocuments(
  parsedFiles: ParsedFile[],
  websiteHint?: string
): Promise<ExtractedQuestionnaire> {
  // Phase 1: Instant programmatic extraction
  const extracted = programmaticExtract(parsedFiles, websiteHint);
  const coveredCount = Object.values(extracted).filter(Boolean).length;
  console.log(`[extractQuestionnaire] Phase 1 (programmatic): ${coveredCount} fields extracted:`, Object.keys(extracted).filter((k) => extracted[k as keyof ExtractedQuestionnaire]));

  // Phase 2: AI fills semantic gaps (only for fields that need interpretation)
  const final = await aiExtractGaps(parsedFiles, extracted, websiteHint);
  return final;
}
