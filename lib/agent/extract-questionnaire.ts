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
  { label: "B2B SaaS", keywords: ["b2b saas", "saas platform", "software as a service", "b2b software", "cloud platform", "api platform", "enterprise software"] },
  { label: "Consumer SaaS", keywords: ["consumer app", "mobile app", "consumer software", "b2c saas", "consumer saas"] },
  { label: "Fintech", keywords: ["fintech", "financial technology", "payment processing", "digital banking", "digital lending", "neobank", "payment gateway"] },
  { label: "Healthcare / MedTech", keywords: ["healthcare", "medtech", "medical device", "health tech", "clinical trial", "patient care", "telemedicine", "healthtech", "digital health"] },
  { label: "E-commerce / Retail", keywords: ["e-commerce", "ecommerce", "online retail", "online store", "retail store", "marketplace platform", "direct to consumer", "d2c brand"] },
  { label: "Services / Agency", keywords: ["creative agency", "design agency", "web agency", "marketing agency", "digital agency", "professional services", "service provider", "builds websites", "build websites", "custom websites"] },
  { label: "Digital Marketing", keywords: ["digital marketing", "seo agency", "social media marketing", "content marketing", "ppc management", "advertising agency", "performance marketing", "growth marketing"] },
  { label: "Consulting", keywords: ["consulting firm", "management consulting", "strategy consulting", "advisory firm", "business consulting", "consulting practice"] },
  { label: "IT Services", keywords: ["it services", "managed services", "it support", "helpdesk services", "it infrastructure", "managed it", "it outsourcing"] },
  { label: "Software Development", keywords: ["software development", "custom software", "app development", "dev shop", "engineering team", "software engineering", "software studio"] },
  { label: "Manufacturing", keywords: ["manufacturing plant", "manufacturing company", "factory production", "industrial manufacturing", "assembly line", "fabrication shop", "contract manufacturing"] },
  { label: "Real Estate", keywords: ["real estate", "property management", "realty company", "real estate brokerage", "commercial real estate", "property development", "real estate investment"] },
  { label: "Logistics / Supply Chain", keywords: ["logistics company", "supply chain", "freight forwarding", "shipping logistics", "warehouse management", "fulfillment center", "third party logistics", "3pl"] },
  { label: "EdTech", keywords: ["edtech", "education technology", "e-learning", "online course", "learning management", "lms platform", "online education"] },
  { label: "LegalTech", keywords: ["legaltech", "legal technology", "law firm", "legal services", "legal software", "legal practice"] },
  { label: "Construction", keywords: ["construction company", "general contractor", "building contractor", "roofing company", "plumbing company", "construction firm"] },
  { label: "Food & Beverage", keywords: ["food and beverage", "restaurant chain", "food delivery", "catering company", "food service", "beverage company", "food production"] },
  { label: "Cybersecurity", keywords: ["cybersecurity", "security software", "information security", "infosec", "threat detection", "cyber defense", "security operations"] },
  { label: "Staffing / Recruitment", keywords: ["staffing agency", "recruitment firm", "talent acquisition", "headhunter", "staffing company", "recruiting agency", "employment agency"] },
  { label: "Hospitality / Tourism", keywords: ["hospitality", "hotel management", "tourism", "travel agency", "resort", "vacation rental", "travel and tourism", "hotel chain", "bed and breakfast"] },
  { label: "Media / Publishing", keywords: ["media company", "publishing house", "digital media", "content publisher", "news media", "media group", "publishing company", "broadcast media"] },
  { label: "Non-profit", keywords: ["non-profit", "nonprofit", "not-for-profit", "charitable organization", "foundation", "ngo", "social enterprise", "philanthropy"] },
  { label: "Insurance", keywords: ["insurance company", "insurance provider", "insurtech", "insurance broker", "insurance agency", "underwriting", "insurance carrier"] },
  { label: "Telecommunications", keywords: ["telecommunications", "telecom", "telecom provider", "wireless carrier", "internet service provider", "isp", "mobile network", "fiber optic"] },
  { label: "Energy / Utilities", keywords: ["energy company", "utility company", "renewable energy", "solar energy", "wind energy", "oil and gas", "power generation", "clean energy", "energy provider"] },
  { label: "Agriculture / AgTech", keywords: ["agriculture", "agtech", "agritech", "precision agriculture", "farm technology", "crop management", "agricultural technology", "smart farming"] },
  { label: "Automotive", keywords: ["automotive", "auto dealer", "car dealership", "automotive manufacturing", "auto parts", "vehicle manufacturing", "electric vehicle", "ev manufacturer"] },
  { label: "Accounting / Finance Services", keywords: ["accounting firm", "accounting services", "bookkeeping", "tax preparation", "financial advisory", "cpa firm", "audit firm", "financial planning"] },
  { label: "Franchise", keywords: ["franchise", "franchise business", "franchise owner", "franchisee", "franchisor", "franchise operation", "franchise system", "franchise model"] },
];

const INDUSTRY_LABELS = INDUSTRIES.map((i) => i.label);

/** Non-company URL domains to exclude from website extraction */
const EXCLUDED_URL_DOMAINS = new Set([
  "google.com",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "calendly.com",
  "typeform.com",
  "airtable.com",
  "github.com",
  "slack.com",
  "zoom.us",
  "medium.com",
  "mailchimp.com",
  "surveymonkey.com",
  "hubspot.com",
  "salesforce.com",
  "dropbox.com",
  "drive.google.com",
  "docs.google.com",
  "youtube.com",
  "vimeo.com",
  "canva.com",
  "figma.com",
  "notion.so",
  "trello.com",
  "asana.com",
  "monday.com",
  "stripe.com",
  "paypal.com",
  "squarespace.com",
  "wix.com",
  "wordpress.com",
  "shopify.com",
  "amazonaws.com",
  "cloudfront.net",
  "herokuapp.com",
  "netlify.app",
  "vercel.app",
  "firebaseapp.com",
  "tiktok.com",
  "pinterest.com",
  "reddit.com",
  "whatsapp.com",
  "t.me",
  "bit.ly",
  "loom.com",
  "miro.com",
  "clickup.com",
  "jira.atlassian.com",
  "confluence.atlassian.com",
  "intercom.io",
  "zendesk.com",
  "freshdesk.com",
]);

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
    // Explicit company/organization name labels
    /(?:company|organization|business)\s*(?:name)?[:\-\u2013]\s*([A-Z][A-Za-z0-9.\-& ]{1,40})/,
    // "Welcome to X" / "About X"
    /(?:^|\n)\s*(?:welcome to|about)\s+([A-Z][A-Za-z0-9.\-& ]{1,30})(?:[!.\n])/i,
    // Document header: "X comprehensive/financial/operational..."
    /(?:^|\n)\s*([A-Z][A-Za-z0-9.]{1,25})\s*(?:comprehensive|financial|operational|annual)\s/i,
    // Domain-style names: "Nouvo.dev"
    /(?:^|\n)\s*([A-Z][A-Za-z0-9.]+(?:\.[a-z]{2,4}))\s/i,
    // "Prepared for X", "Submitted by X", "Submitted to X"
    /(?:prepared\s+for|submitted\s+(?:by|to)|proposal\s+for|report\s+for|presented\s+to|engagement\s+with|on\s+behalf\s+of)\s*[:\-\u2013]?\s*([A-Z][A-Za-z0-9.\-&,' ]{2,40}?)(?:\s*\n|\s*\.|\s*,\s*(?:LLC|Inc|Corp|Ltd|Co))/i,
    // "From: X" (email or header style)
    /(?:^|\n)\s*from\s*:\s*([A-Z][A-Za-z0-9.\-& ]{2,40}?)(?:\s*\n|\s*<|\s*\|)/i,
    // Email signature style: line with just a company name (capitalized), often after a person's name
    /(?:^|\n)\s*(?:regards|sincerely|best|thanks|cheers|warm regards),?\s*\n\s*[A-Z][a-z]+\s+[A-Z][a-z]+\s*\n\s*([A-Z][A-Za-z0-9.\-& ]{2,35})\s*\n/,
    // Company name followed by entity type
    /(?:^|\n)\s*([A-Z][A-Za-z0-9.\-& ]{2,35})\s*(?:LLC|Inc\.?|Corp\.?|Ltd\.?|Co\.?|Group|Holdings|Partners|Enterprises)\b/,
    // Top of document: standalone capitalized name on first few lines
    /^(?:\s*\n){0,3}\s*([A-Z][A-Za-z0-9.\-& ]{2,35})\s*\n/,
    // "Client: X" or "Customer: X"
    /(?:client|customer|account)\s*[:\-\u2013]\s*([A-Z][A-Za-z0-9.\-& ]{2,40})/i,
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
  const stopWords = new Set(["sales", "script", "tactics", "welcome", "pricing", "sheet", "audit", "report", "overview", "summary", "document", "final", "draft", "template", "copy", "new", "old", "version", "data", "info", "analysis", "plan", "review", "notes"]);
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
      const filtered = matches.filter((u) => {
        try {
          const hostname = new URL(u).hostname.replace(/^www\./, "");
          // Check against exact domain matches and suffix matches
          for (const excluded of EXCLUDED_URL_DOMAINS) {
            if (hostname === excluded || hostname.endsWith("." + excluded)) {
              return false;
            }
          }
          return true;
        } catch {
          return false;
        }
      });
      if (filtered.length > 0) return filtered[0];
    }
  }
  return undefined;
}

function extractIndustry(texts: string[]): string | undefined {
  const combined = texts.join(" ").toLowerCase();
  let bestMatch: { label: string; score: number } | null = null;

  for (const ind of INDUSTRIES) {
    let score = 0;
    for (const kw of ind.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = combined.match(regex);
      if (matches) {
        // Weight longer keyword matches higher to reduce collisions.
        // A 3-word keyword match is more specific than a 1-word match.
        const wordCount = kw.split(/\s+/).length;
        score += matches.length * wordCount;
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { label: ind.label, score };
    }
  }

  return bestMatch?.label;
}

function extractRevenue(texts: string[]): string | undefined {
  const combined = texts.join(" ");

  // Look for explicit revenue mentions
  const revenuePatterns = [
    /(?:total\s+)?revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?/i,
    /(?:annual|monthly|total)\s+(?:revenue|income|sales)[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?/i,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?\s*(?:in\s+)?(?:revenue|sales|income)/i,
    /revenue[^.]*?\$\s*([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?/i,
    /gross\s+income[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?/i,
    /ARR[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?/i,
    /MRR[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m|M|million|k|K|thousand|b|B|billion)?/i,
  ];

  for (const pat of revenuePatterns) {
    const m = combined.match(pat);
    if (m?.[1]) {
      const raw = m[1].replace(/,/g, "");
      const num = parseFloat(raw);
      if (isNaN(num)) continue;

      // Determine the multiplier from the full match
      const fullMatch = m[0].toLowerCase();
      let multiplied = num;
      if (/\bbillion\b/.test(fullMatch) || /\bb\b/.test(fullMatch)) {
        multiplied = num * 1_000_000_000;
      } else if (/\bmillion\b/.test(fullMatch) || /(?<![a-z])m(?![a-z])/.test(fullMatch)) {
        multiplied = num * 1_000_000;
      } else if (/\bthousand\b/.test(fullMatch) || /(?<![a-z])k(?![a-z])/.test(fullMatch)) {
        multiplied = num * 1_000;
      }

      // Handle MRR: multiply by 12 to annualize
      if (/\bmrr\b/i.test(fullMatch)) {
        multiplied = multiplied * 12;
      }

      if (multiplied < 10_000_000) return "$0 - $10M";
      if (multiplied < 50_000_000) return "$10M - $50M";
      if (multiplied < 100_000_000) return "$50M - $100M";
      return "$100M+";
    }
  }

  return undefined;
}

/** Common international cities for matching "City, Country" patterns */
const INTERNATIONAL_CITIES = new Set([
  "london", "paris", "berlin", "munich", "amsterdam", "dublin", "zurich", "geneva",
  "stockholm", "copenhagen", "oslo", "helsinki", "vienna", "brussels", "madrid",
  "barcelona", "lisbon", "rome", "milan", "prague", "warsaw", "budapest",
  "toronto", "vancouver", "montreal", "calgary",
  "sydney", "melbourne", "brisbane", "auckland",
  "tokyo", "singapore", "hong kong", "seoul", "bangalore", "mumbai", "delhi",
  "shanghai", "beijing", "shenzhen", "taipei",
  "dubai", "abu dhabi", "riyadh", "tel aviv",
  "sao paulo", "rio de janeiro", "mexico city", "buenos aires", "bogota",
  "cape town", "johannesburg", "nairobi", "lagos",
]);

function extractLocation(texts: string[]): string | undefined {
  const combined = texts.join(" ");
  const patterns = [
    // Explicit location labels
    /(?:headquartered|based|located|location|address|office)[:\s]+(?:in\s+)?([A-Z][a-zA-Z\s,]+(?:,\s*[A-Z]{2})?)(?:\s|\.|\n)/,
    // US City, State format
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*(?:CA|NY|TX|FL|IL|WA|MA|CO|GA|NC|PA|OH|VA|AZ|OR|NV|UT|TN|MN|WI|MD|MO|IN|SC|AL|LA|KY|OK|CT|IA|MS|AR|KS|NE|NM|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC))\b/,
    // City, Country format (international)
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*(?:United Kingdom|UK|United States|USA|US|Canada|Australia|Germany|France|Netherlands|Ireland|Switzerland|Sweden|Denmark|Norway|Finland|Austria|Belgium|Spain|Portugal|Italy|Czech Republic|Poland|Hungary|Japan|Singapore|South Korea|India|China|Taiwan|United Arab Emirates|UAE|Israel|Brazil|Mexico|Argentina|Colombia|South Africa|Kenya|Nigeria|New Zealand))\b/,
    // Known international city names (standalone or with country)
    ...(() => {
      const cityPatterns: RegExp[] = [];
      // Build a pattern that matches known cities with optional country after comma
      const cityList = [...INTERNATIONAL_CITIES].map(c =>
        c.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      );
      for (const city of cityList) {
        cityPatterns.push(
          new RegExp(`(?:headquartered|based|located|location|office|from)\\s+(?:in\\s+)?${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:,\\s*([A-Z][a-zA-Z\\s]+))?`, "i")
        );
      }
      return cityPatterns;
    })(),
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m) {
      // For explicit location patterns, use capture group 1
      const loc = (m[1] || m[0]).trim().replace(/\s+/g, " ");
      // Clean up: remove leading prepositions
      const cleaned = loc.replace(/^(?:in|at|from)\s+/i, "").trim();
      if (cleaned.length >= 3 && cleaned.length <= 60) return cleaned;
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

/** Values considered too generic to keep over AI-extracted values */
const GENERIC_VALUES = new Set([
  "my business",
  "my company",
  "company",
  "business",
  "n/a",
  "unknown",
  "tbd",
  "test",
  "example",
]);

function isGenericValue(val: unknown): boolean {
  if (typeof val !== "string") return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return GENERIC_VALUES.has(trimmed.toLowerCase());
}

async function aiExtractGaps(
  parsedFiles: ParsedFile[],
  existing: ExtractedQuestionnaire,
  websiteHint?: string,
): Promise<ExtractedQuestionnaire> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return existing;

  // Figure out which fields are still missing.
  // Only ask AI for fields that are truly missing or have generic values.
  const missing = FIELDS_FOR_AI.filter((k) => !existing[k] || isGenericValue(existing[k]));
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

    // Merge: AI only fills fields that are missing or have generic values.
    // Never overwrite a real regex-extracted value.
    const merged = { ...existing };
    for (const key of missing) {
      const existingVal = existing[key];
      const aiVal = parsed[key];
      // Only use AI value if the existing value is missing or generic
      if (typeof aiVal === "string" && aiVal.trim()) {
        if (!existingVal || isGenericValue(existingVal)) {
          (merged as Record<string, unknown>)[key] = aiVal.trim();
        }
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
