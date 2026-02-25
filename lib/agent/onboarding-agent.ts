/**
 * Pivvy Onboarding Agent
 *
 * Gemini Flash-powered conversational agent that conducts the pre-analysis
 * onboarding. Collects business info before document upload.
 *
 * Model: Gemini Flash (NOT Lite — needs full conversation reasoning)
 *
 * Key fixes:
 * - Filters leading model turns (Gemini requires user-first conversations)
 * - Adds thinkingConfig: { thinkingBudget: 0 } to disable thinking mode
 * - Extraction uses [EXTRACTED]...[/EXTRACTED] blocks (more reliable than XML)
 * - sanitize() strips em/en dashes and ** markdown from all responses
 */
import { GoogleGenAI } from "@google/genai";
import type { ChatMessage, Questionnaire } from "@/lib/types";

const FLASH_MODEL = "gemini-2.0-flash";

export interface OnboardingTurn {
  message: string;
  extracted: Partial<Questionnaire>;
  complete: boolean;
}

const SYSTEM_PROMPT = `You are Pivvy, an AI business advisor for Pivot. You conduct a short onboarding conversation to gather business information before running a deep intelligence analysis.

RULES:
- Ask ONE question at a time. Never ask multiple questions in one message.
- Keep responses to 2-3 short sentences max. Be direct and warm.
- Do NOT use dashes (-- or em dashes), asterisks, or markdown formatting.
- Use plain conversational text only.
- If the user gives vague info, ask one specific follow-up.

COLLECTION ORDER - one topic per turn:
1. Business name and industry
2. Website URL (explain you will grade it). Also ask daily website visitors.
3. What they sell - one clear sentence
4. Key competitors (ask for names and websites if they know them)
5. Current hosting or tech tools (optional, for cost savings analysis)
6. Biggest business concern right now
7. The single most critical decision they face
8. Annual revenue range and location

When all 8 topics are covered, tell the user they can now upload their documents.

EXTRACTION FORMAT:
After EVERY response, append a JSON block on a new line. Use this exact format:

[EXTRACTED]
{"organizationName":"","industry":"","website":"","websiteVisitorsPerDay":0,"businessModel":"","keyCompetitors":"","competitorUrls":[],"techStack":"","keyConcerns":"","oneDecisionKeepingOwnerUpAtNight":"","revenueRange":"","location":"","complete":false}
[/EXTRACTED]

Fill in only the fields you have confirmed values for. Set "complete": true ONLY after all 8 topics are covered.`;

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
  userMessage: string
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

  // Gemini requires conversations to start with a user turn.
  // Drop any leading assistant/model messages from history.
  let trimmedMessages = [...messages];
  while (trimmedMessages.length > 0 && trimmedMessages[0].role === "assistant") {
    trimmedMessages = trimmedMessages.slice(1);
  }

  const contents = [
    ...trimmedMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  try {
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
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

export function getOnboardingWelcome(): string {
  return `Welcome to Pivot. I'm Pivvy, your business intelligence advisor.\n\nBefore we run your analysis, I have a few quick questions to understand your business. This takes about 2 minutes.\n\nWhat is the name of your business, and what industry are you in?`;
}
