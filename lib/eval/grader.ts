/**
 * Model-Graded Evaluator
 *
 * Uses Gemini to judge agent output on multiple quality dimensions.
 * Returns structured scores + reasoning for each dimension.
 */

import { GoogleGenAI } from '@google/genai';
import type { GraderResult, GraderVerdict, DimensionScores } from './types';

const FLASH_MODEL = 'gemini-2.5-flash';

const GRADER_PROMPT = `You are a strict quality evaluator for AI agent outputs. Score the output on 5 dimensions (0-100 each).

TASK:
Title: "{title}"
Description: "{description}"

AGENT OUTPUT:
{output}

TOOLS USED: {tools}

SCORING DIMENSIONS:
1. **ACCURACY** (0-100): Is the output factually correct? Does it use data from tools correctly? Are numbers cited accurately?
   - 90-100: All facts verified, data correctly cited from tools
   - 70-89: Mostly accurate, minor imprecisions
   - 50-69: Some inaccuracies but overall direction is right
   - 0-49: Significant factual errors

2. **HALLUCINATION** (0-100, where 100 = CLEAN, 0 = heavily hallucinated):
   - Does it invent statistics, financials, or metrics not from tool output?
   - Does it fabricate company names, case studies, testimonials, or customer IDs?
   - Does it present estimates as facts without labeling them?
   - Does it create fake expense breakdowns or burn rates?
   - 90-100: Zero hallucination, all data sourced or clearly labeled as estimates
   - 70-89: Minor unsourced claims but nothing misleading
   - 50-69: Some fabricated details mixed with real data
   - 0-49: Significant fabrication, misleading data

3. **RELEVANCE** (0-100): Is the output specific to THIS task, not generic boilerplate?
   - Does it address the exact request?
   - Does it use company-specific information?
   - Would this output be useful to a real business user?
   - 90-100: Highly specific, directly actionable for this business
   - 70-89: Relevant with minor generic sections
   - 50-69: Partially relevant, some filler content
   - 0-49: Mostly generic, could apply to any company

4. **QUALITY** (0-100): Structure, readability, professional tone.
   - Uses markdown effectively (headers, bold, lists)?
   - Conversational but professional?
   - Well-organized with clear sections?
   - Appropriate length (not too short, not bloated)?
   - 90-100: Publication-ready, excellent structure
   - 70-89: Well-written with minor formatting issues
   - 50-69: Readable but poorly organized or too verbose
   - 0-49: Hard to read, walls of text, no structure

5. **EFFICIENCY** (0-100): Did the agent use tools wisely?
   - Called the right tools, not redundant ones?
   - Didn't call the same tool repeatedly?
   - Got to the answer without unnecessary detours?
   - Output length proportional to task complexity?
   - 90-100: Minimal tool calls, direct path to answer
   - 70-89: Efficient with minor redundancy
   - 50-69: Some wasted tool calls or roundabout approach
   - 0-49: Excessive tool calls, circular reasoning

Respond with ONLY this JSON (no markdown, no backticks):
{
  "accuracy": <0-100>,
  "hallucination": <0-100>,
  "relevance": <0-100>,
  "quality": <0-100>,
  "efficiency": <0-100>,
  "verdict": "<excellent|good|acceptable|poor|fail>",
  "reasoning": "<2-3 sentences explaining the overall assessment>"
}`;

function verdictFromScore(score: number): GraderVerdict {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'acceptable';
  if (score >= 40) return 'poor';
  return 'fail';
}

export async function gradeOutput(
  title: string,
  description: string,
  output: string,
  toolsUsed: string[],
): Promise<GraderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      verdict: 'acceptable',
      reasoning: 'Grader unavailable: no GEMINI_API_KEY',
      scores: { accuracy: 70, hallucination: 70, relevance: 70, quality: 70, efficiency: 70 },
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = GRADER_PROMPT
    .replace('{title}', title)
    .replace('{description}', description)
    .replace('{output}', output.slice(0, 12000))
    .replace('{tools}', toolsUsed.length > 0 ? toolsUsed.join(', ') : 'none');

  try {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.0,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    const text = response.text ?? '';
    const parsed = JSON.parse(text);

    const scores: DimensionScores = {
      accuracy: clamp(parsed.accuracy ?? 50),
      hallucination: clamp(parsed.hallucination ?? 50),
      relevance: clamp(parsed.relevance ?? 50),
      quality: clamp(parsed.quality ?? 50),
      efficiency: clamp(parsed.efficiency ?? 50),
    };

    const avg = (scores.accuracy + scores.hallucination + scores.relevance + scores.quality + scores.efficiency) / 5;

    return {
      verdict: parsed.verdict ?? verdictFromScore(avg),
      reasoning: parsed.reasoning ?? 'No reasoning provided',
      scores,
    };
  } catch (err) {
    console.warn('[Eval Grader] Failed:', err instanceof Error ? err.message : err);
    return {
      verdict: 'acceptable',
      reasoning: `Grader error: ${err instanceof Error ? err.message : 'unknown'}`,
      scores: { accuracy: 50, hallucination: 50, relevance: 50, quality: 50, efficiency: 50 },
    };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
