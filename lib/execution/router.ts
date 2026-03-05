/**
 * Hybrid Classifier + LLM Request Router
 *
 * BetterBot's key innovation: use a local Naive Bayes classifier first (free, instant),
 * then fall back to LLM only when confidence is below threshold.
 *
 * LLM decisions are logged as self-training data for the classifier,
 * so over time the router gets cheaper and faster.
 *
 * Three routing dimensions:
 *  - tools:   which tool outfit to load (none | core | <outfit_name>)
 *  - context: how much context to inject (minimal | full)
 *  - history: how many conversation turns to include (1 | 3 | 5 | 10)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { MultiHeadClassifier } from './classifier';
import { createProvider } from './provider';
import type { RouteResult } from './types';

// ── Constants ────────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.7;
const VALID_TOOLS = ['none', 'core', 'search', 'analysis', 'reporting', 'data'];
const VALID_CONTEXT = ['minimal', 'full'];
const VALID_HISTORY = [1, 3, 5, 10];

// ── Singleton classifier ─────────────────────────────────────────────────────────

let _classifier: MultiHeadClassifier | null = null;
let _classifierLoaded = false;

async function getClassifier(): Promise<MultiHeadClassifier> {
  if (_classifier && _classifierLoaded) return _classifier;

  _classifier = new MultiHeadClassifier(['tools', 'context', 'history']);
  _classifierLoaded = true;

  // Try loading training data from Supabase
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('classifier_training_data')
      .select('text, head, label')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (data && data.length > 0) {
      const byHead: Record<string, Array<{ text: string; label: string }>> = {};

      for (const row of data as Array<{ text: string; head: string; label: string }>) {
        if (!byHead[row.head]) byHead[row.head] = [];
        byHead[row.head].push({ text: row.text, label: row.label });
      }

      for (const [head, examples] of Object.entries(byHead)) {
        _classifier.trainHead(head, examples);
      }

      console.log(
        `[Router] Loaded ${data.length} training examples across ${Object.keys(byHead).length} heads`
      );
    }
  } catch {
    console.warn('[Router] Could not load training data from Supabase, starting fresh');
  }

  return _classifier;
}

// ── LLM Routing Prompt ──────────────────────────────────────────────────────────

function buildRoutingPrompt(message: string, recentMessages: string[], agentType?: string): string {
  const context = recentMessages.length > 0
    ? `\nRecent conversation:\n${recentMessages.map((m, i) => `  [${i + 1}] ${m}`).join('\n')}`
    : '';

  const agentHint = agentType ? `\nAgent type: ${agentType}` : '';

  return `You are a request router. Classify this user message into routing parameters.
${agentHint}${context}

User message: "${message}"

Respond with ONLY a JSON object with these fields:
- tools: one of "none" (greeting/chat), "core" (basic tools), "search" (needs web search), "analysis" (deep analysis), "reporting" (document generation), "data" (database queries)
- context: "minimal" (simple questions) or "full" (needs business data/history)
- history: 1 (standalone question), 3 (recent context needed), 5 (extended context), 10 (full conversation needed)

JSON only, no explanation:`;
}

// ── Main Router Function ─────────────────────────────────────────────────────────

/**
 * Route a user request to determine tools, context depth, and history depth.
 *
 * 1. Try local classifier first (free, instant).
 * 2. If confidence < 0.7, fall back to LLM (Gemini Flash router role).
 * 3. Log LLM decisions as training data for the classifier.
 */
export async function routeRequest(
  message: string,
  recentMessages: string[] = [],
  agentType?: string
): Promise<RouteResult> {
  const classifier = await getClassifier();

  // Step 1: Try local classifier
  if (classifier.isFullyTrained()) {
    const predictions = classifier.classifyAll(message);
    const minConf = classifier.minConfidence(message);

    if (minConf >= CONFIDENCE_THRESHOLD) {
      return {
        tools: validateTools(predictions.tools?.label ?? 'none'),
        context: validateContext(predictions.context?.label ?? 'minimal'),
        history: validateHistory(parseInt(predictions.history?.label ?? '3', 10)),
        source: 'classifier',
        confidence: minConf,
      };
    }
  }

  // Step 2: Fall back to LLM
  try {
    const result = await routeViaLLM(message, recentMessages, agentType);

    // Step 3: Self-train the classifier with LLM's decision
    await selfTrain(message, result);

    return result;
  } catch (err) {
    console.error('[Router] LLM routing failed, using defaults:', err);
    return getDefaultRoute();
  }
}

/**
 * Route via LLM (Gemini Flash in router role).
 */
async function routeViaLLM(
  message: string,
  recentMessages: string[],
  agentType?: string
): Promise<RouteResult> {
  const provider = createProvider('router');
  const prompt = buildRoutingPrompt(message, recentMessages, agentType);

  const response = await provider.chat([
    { role: 'user', content: prompt },
  ]);

  // Parse JSON response
  const text = response.content.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[Router] LLM returned non-JSON:', text);
    return getDefaultRoute();
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      tools?: string;
      context?: string;
      history?: number;
    };

    return {
      tools: validateTools(parsed.tools ?? 'none'),
      context: validateContext(parsed.context ?? 'minimal'),
      history: validateHistory(parsed.history ?? 3),
      source: 'llm',
      confidence: 0.85, // LLM routing gets a default confidence
    };
  } catch {
    console.warn('[Router] Failed to parse LLM routing JSON:', text);
    return getDefaultRoute();
  }
}

// ── Self-Training ────────────────────────────────────────────────────────────────

/**
 * Log LLM routing decisions as training data for the classifier.
 */
async function selfTrain(message: string, result: RouteResult): Promise<void> {
  // Train in-memory classifier immediately
  const classifier = await getClassifier();
  classifier.trainOneOnHead('tools', message, result.tools);
  classifier.trainOneOnHead('context', message, result.context);
  classifier.trainOneOnHead('history', message, String(result.history));

  // Persist to Supabase asynchronously
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const rows = [
      { text: message, head: 'tools', label: result.tools, source: 'llm', created_at: now },
      { text: message, head: 'context', label: result.context, source: 'llm', created_at: now },
      {
        text: message,
        head: 'history',
        label: String(result.history),
        source: 'llm',
        created_at: now,
      },
    ];

    await supabase.from('classifier_training_data').insert(rows);
  } catch (err) {
    console.warn('[Router] Failed to persist training data:', err);
  }
}

// ── Validation Helpers ───────────────────────────────────────────────────────────

function validateTools(value: string): RouteResult['tools'] {
  if (VALID_TOOLS.includes(value)) return value as RouteResult['tools'];
  return 'none';
}

function validateContext(value: string): RouteResult['context'] {
  if (VALID_CONTEXT.includes(value)) return value as RouteResult['context'];
  return 'minimal';
}

function validateHistory(value: number): RouteResult['history'] {
  // Find closest valid history depth
  const valid = VALID_HISTORY as number[];
  let closest = valid[0];
  let minDiff = Math.abs(value - valid[0]);

  for (const v of valid) {
    const diff = Math.abs(value - v);
    if (diff < minDiff) {
      minDiff = diff;
      closest = v;
    }
  }

  return closest as RouteResult['history'];
}

function getDefaultRoute(): RouteResult {
  return {
    tools: 'core',
    context: 'minimal',
    history: 3,
    source: 'llm',
    confidence: 0.5,
  };
}

// ── Bulk Training ────────────────────────────────────────────────────────────────

/**
 * Manually train the classifier with labeled examples.
 * Useful for bootstrapping before the LLM self-training loop kicks in.
 */
export async function trainRouter(
  examples: Array<{
    text: string;
    tools: string;
    context: string;
    history: string;
  }>
): Promise<void> {
  const classifier = await getClassifier();

  for (const ex of examples) {
    classifier.trainOneOnHead('tools', ex.text, ex.tools);
    classifier.trainOneOnHead('context', ex.text, ex.context);
    classifier.trainOneOnHead('history', ex.text, ex.history);
  }

  // Also persist
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const rows = examples.flatMap((ex) => [
      { text: ex.text, head: 'tools', label: ex.tools, source: 'manual', created_at: now },
      { text: ex.text, head: 'context', label: ex.context, source: 'manual', created_at: now },
      { text: ex.text, head: 'history', label: ex.history, source: 'manual', created_at: now },
    ]);

    await supabase.from('classifier_training_data').insert(rows);
  } catch (err) {
    console.warn('[Router] Failed to persist manual training data:', err);
  }
}

/**
 * Reset the classifier (clear all training data).
 */
export function resetClassifier(): void {
  _classifier = null;
  _classifierLoaded = false;
}
