/**
 * Pivvy Onboarding Agent
 * Gemini Flash-powered conversational agent with web research. Two modes:
 * - Full collection: asks for all 8 topics (legacy chat-first flow)
 * - Fill gaps: user uploaded files first; we only ask for missing fields
 * Model: Gemini Flash (NOT Lite - needs full conversation reasoning)
 * Tools: Perplexity web search for industry context, current events, company info
 */
import { GoogleGenAI } from "@google/genai";
import type { ChatMessage, Questionnaire } from "@/lib/types";

const FLASH_MODEL = "gemini-3-flash-preview";

export interface OnboardingTurn {
  message: string;
  extracted: Partial<Questionnaire>;
  complete: boolean;
}

function buildSystemPrompt(extractedFromDocs?: Partial<Questionnaire>): string {
  const hasExtracted = extractedFromDocs && Object.keys(extractedFromDocs).length > 0;
  const known = hasExtracted
    ? Object.entries(extractedFromDocs)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "";

  const fillGapsBlock = hasExtracted
    ? ("FILL-GAPS MODE: The user already uploaded documents. We extracted: " + known + "\n- ONLY ask about fields that are still missing or unclear.\n- Acknowledge what we found.\n- Skip any topic we already have.\n- When all missing fields are covered, say they can launch the analysis.")
    : ("COLLECTION ORDER - one topic per turn:\n1. Business name and industry\n2. Website URL\n3. What they sell\n4. Key competitors\n5. Tech tools (optional)\n6. Biggest business concern\n7. Critical decision\n8. Revenue range and location\n\nWhen all 8 topics are covered, tell the user they can launch the analysis.");

  const extractExample = '{"organizationName":"","industry":"","website":"","websiteVisitorsPerDay":0,"businessModel":"","keyCompetitors":"","competitorUrls":[],"techStack":"","keyConcerns":"","oneDecisionKeepingOwnerUpAtNight":"","revenueRange":"","location":"","complete":false}';

  const researchBlock =
    "RESEARCH: You have a web_research tool. Use it when you need:\n" +
    "- Industry trends, market context, or recent news about an industry\n" +
    "- Current events that might affect the business\n" +
    "- Company info (note: small companies may have little web presence)\n" +
    "Do NOT research for every question. Only when it would genuinely help your response.\n";

  return (
    "You are Pivvy, an AI business advisor for Pivot. You conduct a short onboarding conversation to gather business information before running a deep intelligence analysis.\n\n" +
    "RULES:\n- Ask ONE question at a time.\n- Keep responses to 2-3 short sentences max.\n- Do NOT use dashes, asterisks, or markdown.\n- Use plain conversational text only.\n\n" +
    researchBlock + "\n" +
    fillGapsBlock + "\n\n" +
    "EXTRACTION FORMAT: After EVERY response, append a JSON block:\n[EXTRACTED]\n" + extractExample + "\n[/EXTRACTED]\n\n" +
    'Fill in only the fields you have confirmed. Set "complete": true when all required topics are covered.'
  );
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")   // em dash
    .replace(/\u2013/g, " - ")   // en dash
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();
}

// ── Extraction parser ─────────────────────────────────────────────────────────

function parseExtracted(raw: string): { message: string; extracted: Partial<Questionnaire>; complete: boolean } {
  const match = raw.match(/\[EXTRACTED\]([\s\S]*?)\[\/EXTRACTED\]/);
  let extracted: Partial<Questionnaire> = {};
  let complete = false;

  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      complete = parsed.complete === true;
      delete parsed.complete;
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && (v as unknown[]).length === 0) && v !== 0) {
          (extracted as Record<string, unknown>)[k] = v;
        }
      }
    } catch {
      // JSON parse error — continue without extracted data
    }
  }

  const message = sanitize(raw.replace(/\[EXTRACTED\][\s\S]*?\[\/EXTRACTED\]/g, "").trim());
  return { message, extracted, complete };
}

// ── Main agent function ───────────────────────────────────────────────────────

export async function runOnboardingTurn(
  messages: ChatMessage[],
  userMessage: string,
  extractedFromDocs?: Partial<Questionnaire>
): Promise<OnboardingTurn> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      message: "Pivvy is not available. GEMINI_API_KEY is not configured.",
      extracted: {},
      complete: false,
    };
  }

  const genai = new GoogleGenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(extractedFromDocs);

  // Gemini requires conversations to start with a user turn.
  let trimmedMessages = [...messages];
  while (trimmedMessages.length > 0 && trimmedMessages[0].role === "assistant") {
    trimmedMessages = trimmedMessages.slice(1);
  }

  const contents = [
    ...trimmedMessages.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  try {
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    });

    const rawText = resp.text ?? "";
    if (!rawText) {
      return { message: "I did not receive a response. Please try again.", extracted: {}, complete: false };
    }
    return parseExtracted(rawText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Pivvy Onboarding] Agent error:", msg);
    const isQuota = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
    return {
      message: isQuota
        ? "The AI service is temporarily over its usage limit. Please try again in a few minutes, or check your Gemini API billing at aistudio.google.com."
        : "I hit a technical issue. Please try again in a moment.",
      extracted: {},
      complete: false,
    };
  }
}

const FILL_GAP_ORDER: (keyof Questionnaire)[] = [
  "organizationName", "industry", "website", "businessModel",
  "keyCompetitors", "keyConcerns", "oneDecisionKeepingOwnerUpAtNight", "revenueRange",
];

export function getOnboardingWelcome(extractedFromDocs?: Partial<Questionnaire>): string {
  const hasExtracted = extractedFromDocs && Object.keys(extractedFromDocs).length > 0;
  if (!hasExtracted) {
    return "Welcome to Pivot. I'm Pivvy, your business intelligence advisor.\n\nBefore we run your analysis, I have a few quick questions to understand your business. This takes about 2 minutes.\n\nWhat is the name of your business, and what industry are you in?";
  }
  const firstMissing = FILL_GAP_ORDER.find(
    (k) => !extractedFromDocs![k] || (k === "organizationName" && extractedFromDocs![k] === "TBD")
  );
  const found: string[] = [];
  if (extractedFromDocs!.organizationName && extractedFromDocs!.organizationName !== "TBD")
    found.push(extractedFromDocs!.organizationName);
  if (extractedFromDocs!.industry) found.push(extractedFromDocs!.industry);
  if (extractedFromDocs!.revenueRange) found.push(extractedFromDocs!.revenueRange);
  const foundStr = found.length > 0 ? "I found " + found.join(", ") + " in your documents." : "I reviewed your documents.";
  const firstQuestion =
    firstMissing === "organizationName" ? "What is your business name?"
    : firstMissing === "industry" ? "What industry are you in?"
    : firstMissing === "website" ? "What is your website URL? I will grade it as part of the analysis."
    : firstMissing === "businessModel" ? "What do you sell? One clear sentence."
    : firstMissing === "keyCompetitors" ? "Who are your key competitors?"
    : firstMissing === "keyConcerns" ? "What is your biggest business concern right now?"
    : firstMissing === "oneDecisionKeepingOwnerUpAtNight" ? "What is the single most critical decision you face?"
    : firstMissing === "revenueRange" ? "What is your annual revenue range?"
    : "Ready to launch your analysis.";
  return foundStr + "\n\nI have a few quick questions to fill in the gaps. " + firstQuestion;
}

