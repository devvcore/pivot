/**
 * User Feedback System — Learning loop that makes agents smarter over time.
 *
 * Flow:
 * 1. User gives feedback (thumbs up/down, rating, corrections)
 * 2. System extracts actionable lessons using Gemini Flash
 * 3. Lessons are saved to agent_memory for future tasks
 * 4. Performance metrics tracked per agent per month
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { saveAgentMemory } from './agent-memory';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface TaskFeedback {
  taskId: string;
  orgId: string;
  userId?: string;
  rating?: number;
  thumbs?: 'up' | 'down';
  feedbackText?: string;
  corrections?: string;
}

export interface FeedbackResult {
  feedbackId: string;
  lessonsExtracted: string[];
}

/**
 * Extract actionable lessons from negative feedback using Gemini Flash.
 */
async function extractLessonsFromFeedback(
  taskTitle: string,
  taskResult: string,
  feedbackText?: string,
  corrections?: string,
  rating?: number,
): Promise<string[]> {
  const prompt = `A user gave negative feedback on an AI agent's work. Extract actionable lessons.

TASK: "${taskTitle}"
AGENT OUTPUT (first 2000 chars): ${taskResult.slice(0, 2000)}
USER FEEDBACK: ${feedbackText ?? 'none'}
USER CORRECTIONS: ${corrections ?? 'none'}
RATING: ${rating ?? 'not provided'}/5

Extract 1-3 specific, actionable lessons. Output ONLY a JSON array of strings.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.0,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = response.text ?? '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
      .slice(0, 3) as string[];
  } catch (err) {
    console.warn('[Feedback] Lesson extraction failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Process user feedback on a task result.
 * - Negative feedback: extract lessons and save as corrections/lessons in agent_memory
 * - Positive feedback: save as preference memory
 * - Always updates rolling performance metrics
 */
export async function processFeedback(
  feedback: TaskFeedback,
  agentId: string,
  taskTitle: string,
  taskResult: string,
): Promise<FeedbackResult> {
  const { taskId, orgId, userId, rating, thumbs, feedbackText, corrections } = feedback;

  const isNegative = thumbs === 'down' || (rating !== undefined && rating <= 2) || !!corrections;
  const isPositive = thumbs === 'up' || (rating !== undefined && rating >= 4);

  let lessons: string[] = [];

  // Extract lessons from negative feedback
  if (isNegative) {
    lessons = await extractLessonsFromFeedback(taskTitle, taskResult, feedbackText, corrections, rating);

    for (const lesson of lessons) {
      await saveAgentMemory(orgId, agentId, lesson, corrections ? 'correction' : 'lesson', taskId);
    }
  }

  // Save positive feedback as preference memory
  if (isPositive && (feedbackText || thumbs === 'up')) {
    const preferenceContent = feedbackText
      ? `PREFERENCE: User liked "${taskTitle.slice(0, 50)}": ${feedbackText.slice(0, 200)}`
      : `PREFERENCE: User gave thumbs up on "${taskTitle.slice(0, 50)}". Replicate this style.`;
    await saveAgentMemory(orgId, agentId, preferenceContent, 'preference', taskId);
  }

  // Save feedback record to database
  const supabase = createAdminClient();
  const { data: feedbackRow, error: insertError } = await supabase
    .from('task_feedback')
    .insert({
      task_id: taskId,
      org_id: orgId,
      user_id: userId ?? null,
      rating: rating ?? null,
      thumbs: thumbs ?? null,
      feedback_text: feedbackText ?? null,
      corrections: corrections ?? null,
      lessons_extracted: lessons,
    })
    .select('id')
    .single();

  if (insertError) {
    console.warn('[Feedback] Failed to save feedback record:', insertError.message);
  }

  // Update rolling performance metrics
  await updatePerformanceMetrics(orgId, agentId, feedback);

  return {
    feedbackId: feedbackRow?.id ?? '',
    lessonsExtracted: lessons,
  };
}

/**
 * Upsert agent_performance record for current month.
 * Uses a rolling monthly window keyed by (org_id, agent_id, period_start).
 */
export async function updatePerformanceMetrics(
  orgId: string,
  agentId: string,
  feedback: TaskFeedback,
): Promise<void> {
  const supabase = createAdminClient();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Fetch existing record for this month
  const { data: existing } = await supabase
    .from('agent_performance')
    .select('*')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('period_start', periodStart)
    .single();

  const { rating, thumbs } = feedback;

  if (!existing) {
    // Create new record
    await supabase.from('agent_performance').insert({
      org_id: orgId,
      agent_id: agentId,
      period_start: periodStart,
      period_end: periodEnd,
      feedback_count: 1,
      avg_rating: rating ?? 0,
      thumbs_up: thumbs === 'up' ? 1 : 0,
      thumbs_down: thumbs === 'down' ? 1 : 0,
    });
    return;
  }

  // Calculate new rolling average rating
  const prevFeedbackCount = existing.feedback_count ?? 0;
  const prevAvgRating = existing.avg_rating ?? 0;

  let newAvgRating = prevAvgRating;
  if (rating !== undefined) {
    const totalRatingCount = prevFeedbackCount + 1;
    newAvgRating = (prevAvgRating * prevFeedbackCount + rating) / totalRatingCount;
  }

  await supabase
    .from('agent_performance')
    .update({
      feedback_count: prevFeedbackCount + 1,
      avg_rating: newAvgRating,
      thumbs_up: (existing.thumbs_up ?? 0) + (thumbs === 'up' ? 1 : 0),
      thumbs_down: (existing.thumbs_down ?? 0) + (thumbs === 'down' ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);
}

/**
 * Get agent performance metrics for the last 12 months.
 * Pass agentId to filter to a single agent, or omit for all agents in the org.
 */
export async function getAgentPerformance(
  orgId: string,
  agentId?: string,
): Promise<Record<string, unknown>[]> {
  const supabase = createAdminClient();

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoff = twelveMonthsAgo.toISOString().split('T')[0];

  let query = supabase
    .from('agent_performance')
    .select('*')
    .eq('org_id', orgId)
    .gte('period_start', cutoff)
    .order('period_start', { ascending: false });

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[Feedback] Failed to fetch agent performance:', error.message);
    return [];
  }

  return data ?? [];
}
