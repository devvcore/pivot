// ================================================================
// Pivot -- Two-Stage Message Filter Agent
// Stage 1: gemini-2.0-flash-lite classifies messages as
//          business-relevant or irrelevant (cheap, fast).
// Stage 2: gemini-2.5-flash performs deep analysis on the
//          filtered subset only (expensive, thorough).
// ================================================================

import { GoogleGenAI } from "@google/genai";

// ── Model Configuration ─────────────────────────────────────────

const FILTER_MODEL = "gemini-2.0-flash-lite"; // ~$0.02/1M tokens
const ANALYSIS_MODEL = "gemini-2.5-flash"; // deep analysis

const FILTER_BATCH_SIZE = 50;

// Rough estimate: 1 token ~= 4 chars (English average)
const CHARS_PER_TOKEN = 4;

// ── Types ───────────────────────────────────────────────────────

export interface FilterableMessage {
  id: string;
  text: string;
  sender?: string;
  channel?: string;
  timestamp?: string;
}

export interface FilterResult {
  totalMessages: number;
  filteredCount: number; // business-relevant messages kept
  droppedCount: number; // irrelevant messages removed
  tokensUsed: number; // approximate input+output tokens for the filter stage
  filteredMessages: FilterableMessage[];
}

export interface AnalysisResult {
  source: "slack" | "gmail";
  rawAnalysis: Record<string, any>;
  messageCount: number;
  analysisTokensUsed: number;
}

// ── Stage 1: Cheap Filter ───────────────────────────────────────

/**
 * Stage 1: Uses gemini-2.0-flash-lite to classify messages as
 * business-relevant (1) or irrelevant (0). Processes in batches
 * of 50 for efficiency. Returns only the messages that matter.
 *
 * Conservative by design: when in doubt, messages are kept.
 * If the filter model fails, ALL messages pass through (never lose data).
 */
export async function filterMessages(
  messages: FilterableMessage[],
  businessContext: string,
): Promise<FilterResult> {
  if (messages.length === 0) {
    return {
      totalMessages: 0,
      filteredCount: 0,
      droppedCount: 0,
      tokensUsed: 0,
      filteredMessages: [],
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const allRelevanceFlags: boolean[] = [];
  let totalTokensUsed = 0;

  // Process in batches of FILTER_BATCH_SIZE
  for (let i = 0; i < messages.length; i += FILTER_BATCH_SIZE) {
    const batch = messages.slice(i, i + FILTER_BATCH_SIZE);

    // Build numbered list of message texts
    const numberedMessages = batch
      .map((m, idx) => {
        const channel = m.channel ? ` [#${m.channel}]` : "";
        const sender = m.sender ? ` (${m.sender})` : "";
        return `${idx + 1}.${channel}${sender} ${m.text.slice(0, 300)}`;
      })
      .join("\n");

    const prompt = `You are a message relevance filter for a business analytics platform.
Business context: ${businessContext}

Classify each message as business-relevant (1) or irrelevant (0).

Business-relevant includes: project discussions, client mentions, deadlines, budgets, strategy, feedback, performance issues, sales, metrics, complaints, scheduling work meetings, task assignments, technical discussions about products/services.

Irrelevant includes: social chitchat ("how was your weekend"), memes, jokes, food orders, random links, emoji-only messages, "ok"/"thanks"/"lol", off-topic conversations, personal plans, sports talk.

When uncertain, classify as 1 (business-relevant). It is better to keep a borderline message than to drop an important one.

Messages:
${numberedMessages}

Return ONLY a JSON array of 0s and 1s, one per message. Example: [1,0,1,1,0]`;

    // Estimate tokens for this batch
    const inputChars = prompt.length;
    const estimatedInputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);
    // Output is just a small JSON array
    const estimatedOutputTokens = batch.length * 2 + 10;
    totalTokensUsed += estimatedInputTokens + estimatedOutputTokens;

    try {
      const result = await ai.models.generateContent({
        model: FILTER_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = result.text ?? "";
      let flags: number[];

      try {
        flags = JSON.parse(text);
      } catch {
        // If JSON parse fails, keep all messages in this batch (conservative)
        console.warn(
          `[filter-agent] Failed to parse filter response for batch ${Math.floor(i / FILTER_BATCH_SIZE) + 1}, keeping all ${batch.length} messages. Raw: ${text.slice(0, 200)}`,
        );
        flags = batch.map(() => 1);
      }

      // Validate array length matches batch size
      if (!Array.isArray(flags) || flags.length !== batch.length) {
        console.warn(
          `[filter-agent] Filter returned ${Array.isArray(flags) ? flags.length : "non-array"} results for ${batch.length} messages, keeping all.`,
        );
        flags = batch.map(() => 1);
      }

      for (const flag of flags) {
        allRelevanceFlags.push(flag === 1);
      }
    } catch (err) {
      // If the filter model errors entirely, keep all messages in this batch
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[filter-agent] Filter model error for batch ${Math.floor(i / FILTER_BATCH_SIZE) + 1}, keeping all ${batch.length} messages: ${msg}`,
      );
      for (let j = 0; j < batch.length; j++) {
        allRelevanceFlags.push(true);
      }
    }
  }

  // Apply filter: keep only messages flagged as relevant
  const filteredMessages = messages.filter((_, idx) => allRelevanceFlags[idx]);

  return {
    totalMessages: messages.length,
    filteredCount: filteredMessages.length,
    droppedCount: messages.length - filteredMessages.length,
    tokensUsed: totalTokensUsed,
    filteredMessages,
  };
}

// ── Stage 2: Deep Analysis ──────────────────────────────────────

/**
 * Stage 2: Sends pre-filtered messages to gemini-2.5-flash for
 * deep communication analysis. This is the expensive model that
 * should only see business-relevant content.
 *
 * The actual analysis prompt varies by source (slack vs gmail),
 * so this function delegates to the source-specific analyzer.
 * This is a utility wrapper that the source analyzers can call.
 */
export async function analyzeFilteredMessages(
  messages: FilterableMessage[],
  source: "slack" | "gmail",
  analysisPrompt: string,
): Promise<AnalysisResult> {
  if (messages.length === 0) {
    return {
      source,
      rawAnalysis: {},
      messageCount: 0,
      analysisTokensUsed: 0,
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const estimatedInputTokens = Math.ceil(analysisPrompt.length / CHARS_PER_TOKEN);

  const result = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: analysisPrompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = result.text ?? "";
  const estimatedOutputTokens = Math.ceil(text.length / CHARS_PER_TOKEN);

  let rawAnalysis: Record<string, any>;
  try {
    rawAnalysis = JSON.parse(text);
  } catch {
    console.error(`[filter-agent] Failed to parse ${source} analysis response:`, text.slice(0, 500));
    rawAnalysis = {};
  }

  return {
    source,
    rawAnalysis,
    messageCount: messages.length,
    analysisTokensUsed: estimatedInputTokens + estimatedOutputTokens,
  };
}

// ── Full Pipeline: Filter -> Analyze ────────────────────────────

/**
 * Complete two-stage pipeline: Filter with cheap model, then analyze
 * with expensive model. Drop-in enhancement for direct analysis calls.
 *
 * @param messages - Raw messages to process
 * @param source - 'slack' or 'gmail'
 * @param businessContext - Business description for filter context
 * @param analysisPromptBuilder - Function that builds the analysis prompt
 *   from the filtered messages (source-specific)
 * @returns Analysis result + filter statistics
 */
export async function filterAndAnalyze(
  messages: FilterableMessage[],
  source: "slack" | "gmail",
  businessContext: string,
  analysisPromptBuilder: (filtered: FilterableMessage[]) => string,
): Promise<{
  analysis: AnalysisResult;
  filterStats: FilterResult;
}> {
  // Stage 1: Filter with cheap model
  const filterStats = await filterMessages(messages, businessContext);

  // Stage 2: Analyze only the filtered messages
  const analysisPrompt = analysisPromptBuilder(filterStats.filteredMessages);
  const analysis = await analyzeFilteredMessages(
    filterStats.filteredMessages,
    source,
    analysisPrompt,
  );

  // Log combined stats
  const totalTokensSaved = Math.ceil(
    (filterStats.droppedCount / Math.max(filterStats.totalMessages, 1)) *
      analysis.analysisTokensUsed,
  );

  console.log(
    `[filter-agent] ${source}: ${filterStats.totalMessages} messages` +
      ` -> Stage 1 (${FILTER_MODEL}): ${filterStats.filteredCount} business-relevant` +
      ` -> Stage 2 (${ANALYSIS_MODEL}): analyzed.` +
      ` Filter used ~${formatTokens(filterStats.tokensUsed)} tokens.` +
      ` Estimated analysis savings: ~${formatTokens(totalTokensSaved)} tokens` +
      ` (~$${((totalTokensSaved / 1_000_000) * 1.25).toFixed(4)})`,
  );

  return { analysis, filterStats };
}

// ── Helpers ─────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
