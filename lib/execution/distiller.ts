/**
 * Tool Call Distiller — Self-Optimizing Agent Intelligence
 *
 * After every tool call, a lightweight "distiller" agent observes:
 *   1. What tool was called, with what args?
 *   2. What was the output? Did it succeed?
 *   3. Was this the most efficient way to accomplish the goal?
 *   4. What's the minimum-token path to the same result?
 *
 * Learned patterns are saved as "tool_call_context" records. Before each
 * tool call, the orchestrator loads relevant context to guide the agent
 * toward more efficient execution.
 *
 * Over time, agents self-optimize: fewer tool calls, smaller payloads,
 * better argument selection, and learned shortcuts.
 *
 * Cost: ~$0.0002 per distillation (Gemini Flash Lite, ~100 tokens out)
 */

import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCallObservation {
  orgId: string;
  agentId: string;
  taskId: string;
  taskTitle: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolOutput: string;
  success: boolean;
  round: number;         // which round in the execution loop
  totalRounds: number;   // total rounds so far
  elapsedMs?: number;    // how long the tool call took
}

export interface DistilledContext {
  id: string;
  tool_name: string;
  pattern_key: string;        // normalized key for matching (e.g. "web_search:competitor+pricing")
  efficiency_score: number;   // 0-100, higher = more efficient
  optimal_args: Record<string, unknown> | null;  // best-known args for this pattern
  tips: string;               // concise guidance for the agent
  avoid: string;              // what NOT to do
  expected_output_shape: string;  // what good output looks like
  token_estimate: number;     // estimated tokens for optimal execution
  usage_count: number;        // how many times this pattern has been seen
  last_used_at: string;
}

// ── Distillation Engine ───────────────────────────────────────────────────────

const DISTILL_PROMPT = `You are an efficiency analyst for an AI agent system. After observing a tool call, you extract lessons to make future calls more efficient.

Given a tool call observation, output a JSON object:
{
  "pattern_key": "<tool_name>:<2-3 word normalized intent>",
  "efficiency_score": <0-100>,
  "optimal_args": <simplified args that would produce same result, or null if already optimal>,
  "tips": "<1 sentence: how to use this tool most efficiently for this type of task>",
  "avoid": "<1 sentence: common mistake or waste to avoid>",
  "expected_output_shape": "<1 sentence: what good output looks like>",
  "token_estimate": <estimated input+output tokens for optimal version of this call>,
  "was_wasteful": <true if this call used unnecessary args, got too much data, or could be skipped>
}

Scoring guide:
- 90-100: Perfect — minimal args, got exactly what was needed
- 70-89: Good — minor optimization possible (e.g. could request less data)
- 50-69: Fair — noticeably wasteful (e.g. broad search when specific would work)
- 30-49: Poor — significant waste (e.g. scraped whole page for one fact)
- 0-29: Very wasteful — tool call was unnecessary or completely wrong tool

Be concise. Tips and avoid should be actionable single sentences.`;

export async function distillToolCall(observation: ToolCallObservation): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  // Skip distillation for very cheap/simple tools
  const skipTools = new Set(["query_analysis", "list_documents", "list_tickets"]);
  if (skipTools.has(observation.toolName)) return;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const truncatedOutput = observation.toolOutput.slice(0, 1500);
    const truncatedArgs = JSON.stringify(observation.toolArgs).slice(0, 800);

    const prompt = `Tool: ${observation.toolName}
Task: "${observation.taskTitle}"
Agent: ${observation.agentId}
Args: ${truncatedArgs}
Success: ${observation.success}
Output (truncated): ${truncatedOutput.slice(0, 500)}
Output length: ${observation.toolOutput.length} chars
Round: ${observation.round}/${observation.totalRounds}
${observation.elapsedMs ? `Duration: ${observation.elapsedMs}ms` : ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: DISTILL_PROMPT,
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text?.trim() ?? "";
    if (!text) return;

    const distilled = JSON.parse(text);

    // Save to database
    await saveDistilledContext(observation.orgId, {
      tool_name: observation.toolName,
      pattern_key: distilled.pattern_key ?? `${observation.toolName}:general`,
      efficiency_score: distilled.efficiency_score ?? 50,
      optimal_args: distilled.optimal_args ?? null,
      tips: distilled.tips ?? "",
      avoid: distilled.avoid ?? "",
      expected_output_shape: distilled.expected_output_shape ?? "",
      token_estimate: distilled.token_estimate ?? 0,
      was_wasteful: distilled.was_wasteful ?? false,
    });

  } catch (err) {
    // Distillation is non-blocking — log and move on
    console.warn("[distiller] Failed:", err instanceof Error ? err.message : err);
  }
}

// ── Database Operations ───────────────────────────────────────────────────────

async function saveDistilledContext(
  orgId: string,
  data: {
    tool_name: string;
    pattern_key: string;
    efficiency_score: number;
    optimal_args: Record<string, unknown> | null;
    tips: string;
    avoid: string;
    expected_output_shape: string;
    token_estimate: number;
    was_wasteful: boolean;
  },
): Promise<void> {
  const supabase = createAdminClient();

  // Check if this pattern already exists
  const { data: existing } = await supabase
    .from("tool_call_context")
    .select("id, usage_count, efficiency_score, tips, avoid")
    .eq("org_id", orgId)
    .eq("pattern_key", data.pattern_key)
    .maybeSingle();

  if (existing) {
    // Update with exponential moving average for score
    const alpha = 0.3; // learning rate — newer observations weighted more
    const newScore = Math.round(
      alpha * data.efficiency_score + (1 - alpha) * existing.efficiency_score
    );

    // Keep the better tips (prefer newer if score improved, keep old if regressed)
    const tips = data.efficiency_score >= existing.efficiency_score
      ? data.tips
      : existing.tips;
    const avoid = data.efficiency_score >= existing.efficiency_score
      ? data.avoid
      : existing.avoid;

    await supabase
      .from("tool_call_context")
      .update({
        efficiency_score: newScore,
        optimal_args: data.optimal_args ?? undefined,
        tips,
        avoid,
        expected_output_shape: data.expected_output_shape,
        token_estimate: data.token_estimate,
        usage_count: existing.usage_count + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Insert new pattern
    await supabase
      .from("tool_call_context")
      .insert({
        org_id: orgId,
        tool_name: data.tool_name,
        pattern_key: data.pattern_key,
        efficiency_score: data.efficiency_score,
        optimal_args: data.optimal_args,
        tips: data.tips,
        avoid: data.avoid,
        expected_output_shape: data.expected_output_shape,
        token_estimate: data.token_estimate,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      });
  }
}

// ── Context Loading (called before tool execution) ────────────────────────────

/**
 * Load relevant distilled context for a set of tools an agent might use.
 * Returns a compact string to inject into the agent's system prompt.
 *
 * This is the "learned efficiency" that makes agents faster over time.
 */
export async function loadToolCallContext(
  orgId: string,
  toolNames: string[],
): Promise<string> {
  if (toolNames.length === 0) return "";

  const supabase = createAdminClient();

  const { data: contexts } = await supabase
    .from("tool_call_context")
    .select("tool_name, pattern_key, efficiency_score, tips, avoid, expected_output_shape, token_estimate, usage_count")
    .eq("org_id", orgId)
    .in("tool_name", toolNames)
    .gte("usage_count", 2) // Only include patterns seen 2+ times (filter noise)
    .order("usage_count", { ascending: false })
    .limit(20);

  if (!contexts || contexts.length === 0) return "";

  // Format as compact guidance block
  const lines: string[] = [
    "LEARNED TOOL EFFICIENCY (from past executions — follow these patterns):",
  ];

  for (const ctx of contexts) {
    const score = ctx.efficiency_score >= 80 ? "GOOD" : ctx.efficiency_score >= 50 ? "OK" : "IMPROVE";
    lines.push(`• ${ctx.tool_name} [${ctx.pattern_key}] (${score}, used ${ctx.usage_count}x):`);
    if (ctx.tips) lines.push(`  DO: ${ctx.tips}`);
    if (ctx.avoid) lines.push(`  AVOID: ${ctx.avoid}`);
    if (ctx.expected_output_shape) lines.push(`  EXPECT: ${ctx.expected_output_shape}`);
  }

  return lines.join("\n");
}

// ── Batch Analysis (periodic optimization report) ─────────────────────────────

/**
 * Analyze all distilled patterns for an org and generate an optimization report.
 * Called via cron or on-demand from the dashboard.
 */
export async function generateOptimizationReport(orgId: string): Promise<{
  totalPatterns: number;
  avgEfficiency: number;
  topWastes: Array<{ pattern: string; score: number; avoid: string }>;
  topEfficient: Array<{ pattern: string; score: number; tips: string }>;
  estimatedTokenSavings: number;
}> {
  const supabase = createAdminClient();

  const { data: contexts } = await supabase
    .from("tool_call_context")
    .select("*")
    .eq("org_id", orgId)
    .order("usage_count", { ascending: false });

  if (!contexts || contexts.length === 0) {
    return {
      totalPatterns: 0,
      avgEfficiency: 0,
      topWastes: [],
      topEfficient: [],
      estimatedTokenSavings: 0,
    };
  }

  const totalPatterns = contexts.length;
  const avgEfficiency = Math.round(
    contexts.reduce((sum, c) => sum + c.efficiency_score, 0) / totalPatterns
  );

  // Sort by score to find wastes and wins
  const sorted = [...contexts].sort((a, b) => a.efficiency_score - b.efficiency_score);

  const topWastes = sorted
    .filter(c => c.efficiency_score < 50 && c.usage_count >= 2)
    .slice(0, 5)
    .map(c => ({
      pattern: c.pattern_key,
      score: c.efficiency_score,
      avoid: c.avoid,
    }));

  const topEfficient = [...sorted]
    .reverse()
    .filter(c => c.efficiency_score >= 80)
    .slice(0, 5)
    .map(c => ({
      pattern: c.pattern_key,
      score: c.efficiency_score,
      tips: c.tips,
    }));

  // Estimate token savings: for patterns with score < 70, estimate potential savings
  const estimatedTokenSavings = contexts
    .filter(c => c.efficiency_score < 70 && c.token_estimate > 0)
    .reduce((sum, c) => {
      const wasteRatio = (100 - c.efficiency_score) / 100;
      return sum + Math.round(c.token_estimate * wasteRatio * c.usage_count);
    }, 0);

  return {
    totalPatterns,
    avgEfficiency,
    topWastes,
    topEfficient,
    estimatedTokenSavings,
  };
}
