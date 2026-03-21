/**
 * Incremental Processor — Lightweight per-message intelligence for Slack
 *
 * Ported from Ultron's incremental-processor.ts. Instead of running the full
 * agent pipeline on every Slack message, this does three cheap things:
 *
 * 1. Extract facts from the message -> save to agent memory
 * 2. Check if the message changes any PM ticket status
 * 3. Check if the message is about something not yet ticketed
 *
 * Full analysis only runs when explicitly triggered or when enough
 * new context has accumulated (batch threshold).
 *
 * Cost: ~$0.001 per message (single Gemini Flash call, 512 max tokens)
 */

import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveAgentMemory } from '@/lib/execution/agent-memory';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IncrementalResult {
  factsLearned: string[];
  ticketUpdates: { ticketId: string; title: string; newStatus: string; reason: string }[];
  untrackedTopics: string[];
  shouldTriggerFullAnalysis: boolean;
}

// ── Prompt ─────────────────────────────────────────────────────────────────────

const INCREMENTAL_PROMPT = `You are a lightweight message processor. Read this single message in the context of a business and extract THREE things:

1. **facts**: Any new facts worth remembering (client preferences, decisions, deadlines, technical details, business metrics). Only concrete facts, not chit-chat.

2. **ticketUpdates**: If this message indicates any ticket's status changed, identify which one. Look at the ticket list and determine if any should move:
   - To "in_progress" if someone is actively working on it
   - To "done" if work is confirmed complete
   - To "review" if it's ready for review
   Only change status when the message CLEARLY indicates it. Be conservative.

3. **untrackedTopics**: If the message discusses a task, feature, or requirement that doesn't have a ticket yet, flag it.

4. **shouldTriggerFullAnalysis**: true only if this message represents a SIGNIFICANT change (new major requirement, budget change, timeline shift, strategic pivot). false for routine updates.

Output JSON:
{
  "facts": [{"key": "short_key", "value": "the fact", "category": "client|technical|decision|constraint|contact"}],
  "ticketUpdates": [{"ticketTitle": "matching ticket title", "newStatus": "in_progress|done|review", "reason": "why"}],
  "untrackedTopics": ["topic not covered by any existing ticket"],
  "shouldTriggerFullAnalysis": false
}

If nothing noteworthy, output: {"facts":[],"ticketUpdates":[],"untrackedTopics":[],"shouldTriggerFullAnalysis":false}`;

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Process a single Slack message incrementally.
 * Cheap (~$0.001) LLM call to extract facts, detect ticket updates, and flag untracked topics.
 */
export async function processMessageIncrementally(
  orgId: string,
  message: { content: string; author: string; channel: string },
): Promise<IncrementalResult> {
  const empty: IncrementalResult = {
    factsLearned: [],
    ticketUpdates: [],
    untrackedTopics: [],
    shouldTriggerFullAnalysis: false,
  };

  // Skip very short or trivial messages
  if (message.content.length < 15) return empty;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return empty;

  const supabase = createAdminClient();

  // Load current open tickets for context (lightweight query)
  const { data: tickets } = await supabase
    .from('pm_tickets')
    .select('id, title, status, assigned_agent')
    .eq('org_id', orgId)
    .in('status', ['backlog', 'todo', 'in_progress', 'review'])
    .order('updated_at', { ascending: false })
    .limit(30);

  const ticketList = (tickets ?? [])
    .map(t => `[${t.status}] ${t.title}`)
    .join('\n');

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `## Current Tickets\n${ticketList || 'No tickets yet'}\n\n## New Message\n${message.author} in ${message.channel}: ${message.content.slice(0, 1500)}\n\nProcess this message. Output JSON only.`,
      config: {
        temperature: 0,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: INCREMENTAL_PROMPT,
      },
    });

    const raw = response.text ?? '{}';
    const parsed = JSON.parse(raw);
    const output: IncrementalResult = {
      factsLearned: [],
      ticketUpdates: [],
      untrackedTopics: parsed.untrackedTopics ?? [],
      shouldTriggerFullAnalysis: parsed.shouldTriggerFullAnalysis ?? false,
    };

    // Save facts to agent memory
    for (const fact of (parsed.facts ?? [])) {
      if (fact.key && fact.value) {
        await saveAgentMemory(
          orgId,
          'pivvy',
          `[${fact.category ?? 'fact'}] ${fact.key}: ${fact.value}`,
          'context',
        );
        output.factsLearned.push(fact.value);
      }
    }

    // Update ticket statuses via fuzzy title match
    for (const update of (parsed.ticketUpdates ?? [])) {
      if (!update.ticketTitle || !update.newStatus) continue;

      const validStatuses = ['in_progress', 'done', 'review'];
      if (!validStatuses.includes(update.newStatus)) continue;

      // Fuzzy match: find ticket whose title shares 2+ significant words
      const match = (tickets ?? []).find(t => {
        const tWords = (t.title as string).toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const uWords = String(update.ticketTitle).toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        const overlap = tWords.filter(w => uWords.some((uw: string) => w.includes(uw) || uw.includes(w)));
        return overlap.length >= 2;
      });

      if (match && match.status !== update.newStatus) {
        const patch: Record<string, unknown> = {
          status: update.newStatus,
          updated_at: new Date().toISOString(),
        };
        if (update.newStatus === 'done') {
          patch.completed_at = new Date().toISOString();
        }

        await supabase
          .from('pm_tickets')
          .update(patch)
          .eq('id', match.id);

        output.ticketUpdates.push({
          ticketId: match.id as string,
          title: match.title as string,
          newStatus: update.newStatus,
          reason: update.reason ?? '',
        });

        console.log(`[Incremental] Ticket "${match.title}" ${match.status} -> ${update.newStatus}: ${update.reason ?? ''}`);
      }
    }

    // Log untracked topics for later review
    if (output.untrackedTopics.length > 0) {
      console.log(`[Incremental] Untracked topics for org ${orgId}: ${output.untrackedTopics.join(', ')}`);
    }

    return output;
  } catch (err) {
    console.warn('[Incremental] Processing failed:', err instanceof Error ? err.message : err);
    return empty;
  }
}

/**
 * Check if enough new messages have accumulated since last full analysis
 * to warrant running the pipeline again.
 */
export async function shouldRunFullAnalysis(orgId: string): Promise<boolean> {
  const supabase = createAdminClient();

  // Get timestamp of last execution task completion
  const { data: lastTask } = await supabase
    .from('execution_tasks')
    .select('completed_at')
    .eq('org_id', orgId)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastTask?.completed_at) return true; // Never analyzed

  // Count Slack messages since last analysis
  const { data: convos } = await supabase
    .from('slack_bot_conversations')
    .select('messages')
    .eq('org_id', orgId)
    .gt('last_message_at', lastTask.completed_at)
    .limit(10);

  const messageCount = (convos ?? []).reduce((sum, c) => {
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    return sum + msgs.length;
  }, 0);

  return messageCount >= 20;
}
