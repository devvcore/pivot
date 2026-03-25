/**
 * Slack Message Embedding Pipeline — Embed, store, and search Slack messages for RAG.
 *
 * Flow:
 * 1. Take Slack messages and embed them using Gemini text-embedding-004 (768 dims, FREE)
 * 2. Store in slack_message_embeddings table with pgvector
 * 3. Semantic search via cosine similarity RPC
 * 4. Groups messages by thread for better conversation context
 *
 * Called from:
 * - Webhook handlers (real-time, per-message)
 * - Bulk embed endpoint (backfill entire history)
 */

import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlackMessageForEmbedding {
  channelId: string;
  channelName: string;
  authorName: string;
  authorId: string;
  messageText: string;
  threadTs: string | null;
  messageTs: string;
}

export interface SlackSearchResult {
  id: string;
  channelId: string;
  channelName: string;
  authorName: string;
  authorId: string;
  messageText: string;
  threadTs: string | null;
  messageTs: string;
  similarity: number;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-004'; // Gemini Embedding, 768 dims, FREE
const EMBEDDING_BATCH_SIZE = 100; // Max messages per embedding call
const MIN_MESSAGE_LENGTH = 10;    // Skip very short messages (reactions, "ok", etc.)

// ── Embedding Helpers ─────────────────────────────────────────────────────────

/**
 * Embed a batch of texts using Gemini text-embedding-004.
 * Returns array of 768-dimensional vectors.
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });
  const results: number[][] = [];

  // Process in batches of 20 (Gemini batch limit)
  const batchSize = 20;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch.map(text => ({
        parts: [{ text: text.slice(0, 8000) }],
      })),
      config: {
        taskType: 'RETRIEVAL_DOCUMENT',
      },
    } as any);

    // Handle both single and batch response formats
    const embeddings = (response as any).embeddings ?? [(response as any).embedding];
    for (const emb of embeddings) {
      results.push(emb.values ?? emb);
    }
  }

  return results;
}

/**
 * Embed a single query for search (uses RETRIEVAL_QUERY task type).
 */
async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [{
      parts: [{ text: query.slice(0, 8000) }],
    }],
    config: {
      taskType: 'RETRIEVAL_QUERY',
    },
  } as any);

  const embedding = (response as any).embedding ?? (response as any).embeddings?.[0];
  return embedding?.values ?? embedding ?? [];
}

// ── Context Builder ───────────────────────────────────────────────────────────

/**
 * Build a richer text representation for embedding that includes channel context.
 * This helps the embedding model understand the context of the message.
 */
function buildEmbeddingText(msg: SlackMessageForEmbedding): string {
  const parts: string[] = [];

  if (msg.channelName) {
    parts.push(`[#${msg.channelName}]`);
  }
  if (msg.authorName) {
    parts.push(`${msg.authorName}:`);
  }
  parts.push(msg.messageText);

  return parts.join(' ');
}

// ── Main Pipeline: Batch Embed ────────────────────────────────────────────────

/**
 * Embed and store a batch of Slack messages.
 * Skips messages that are too short or already embedded.
 * Uses upsert to handle duplicates gracefully.
 */
export async function embedSlackMessages(
  orgId: string,
  messages: SlackMessageForEmbedding[],
): Promise<{ embedded: number; skipped: number; errors: string[] }> {
  const supabase = createAdminClient();
  let embedded = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Filter out very short messages
  const validMessages = messages.filter(msg => {
    if (!msg.messageText || msg.messageText.trim().length < MIN_MESSAGE_LENGTH) {
      skipped++;
      return false;
    }
    return true;
  });

  if (validMessages.length === 0) {
    return { embedded, skipped, errors };
  }

  // Check which messages are already embedded (avoid re-embedding)
  const messageTsPairs = validMessages.map(m => `(${JSON.stringify(m.channelId)},${JSON.stringify(m.messageTs)})`);
  const { data: existing } = await supabase
    .from('slack_message_embeddings')
    .select('channel_id, message_ts')
    .eq('org_id', orgId)
    .in('message_ts', validMessages.map(m => m.messageTs));

  const existingSet = new Set(
    (existing ?? []).map(e => `${e.channel_id}:${e.message_ts}`)
  );

  const newMessages = validMessages.filter(m => {
    if (existingSet.has(`${m.channelId}:${m.messageTs}`)) {
      skipped++;
      return false;
    }
    return true;
  });

  if (newMessages.length === 0) {
    return { embedded, skipped, errors };
  }

  // Process in batches
  for (let i = 0; i < newMessages.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = newMessages.slice(i, i + EMBEDDING_BATCH_SIZE);

    try {
      // Build embedding texts
      const texts = batch.map(buildEmbeddingText);

      // Embed
      const embeddings = await embedBatch(texts);

      // Prepare rows for upsert
      const rows = batch.map((msg, idx) => ({
        org_id: orgId,
        channel_id: msg.channelId,
        channel_name: msg.channelName || null,
        author_name: msg.authorName || null,
        author_id: msg.authorId || null,
        message_text: msg.messageText,
        thread_ts: msg.threadTs || null,
        message_ts: msg.messageTs,
        embedding: embeddings[idx]?.length > 0 ? JSON.stringify(embeddings[idx]) : null,
      }));

      // Upsert in sub-batches of 50 (Supabase row limit)
      for (let j = 0; j < rows.length; j += 50) {
        const subBatch = rows.slice(j, j + 50);
        const { error } = await supabase
          .from('slack_message_embeddings')
          .upsert(subBatch, {
            onConflict: 'org_id,channel_id,message_ts',
            ignoreDuplicates: false,
          });

        if (error) {
          errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
        } else {
          embedded += subBatch.length;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Embedding batch ${i}: ${msg}`);
    }
  }

  console.log(`[SlackRAG] Embedded ${embedded} messages, skipped ${skipped} for org ${orgId}`);
  return { embedded, skipped, errors };
}

// ── Single Message Embed (for webhooks) ───────────────────────────────────────

/**
 * Embed a single new message from a Slack webhook event.
 * Designed to be called asynchronously from the webhook handler.
 */
export async function embedNewWebhookMessage(
  orgId: string,
  event: {
    text?: string;
    user?: string;
    channel?: string;
    channel_type?: string;
    ts?: string;
    thread_ts?: string;
    // Resolved fields (may be provided by webhook handler)
    channelName?: string;
    authorName?: string;
  },
): Promise<void> {
  const text = event.text?.trim();
  if (!text || text.length < MIN_MESSAGE_LENGTH) return;

  // Skip bot/system messages
  if (!event.user || !event.channel || !event.ts) return;

  try {
    const message: SlackMessageForEmbedding = {
      channelId: event.channel,
      channelName: event.channelName ?? event.channel,
      authorName: event.authorName ?? event.user,
      authorId: event.user,
      messageText: text,
      threadTs: event.thread_ts ?? null,
      messageTs: event.ts,
    };

    await embedSlackMessages(orgId, [message]);
  } catch (err) {
    console.warn(
      '[SlackRAG] Failed to embed webhook message:',
      err instanceof Error ? err.message : err,
    );
  }
}

// ── Semantic Search ───────────────────────────────────────────────────────────

/**
 * Search Slack message history using semantic similarity.
 * Uses pgvector cosine similarity via Supabase RPC.
 * Falls back to text search if vector search fails.
 */
export async function searchSlackMessages(
  orgId: string,
  query: string,
  options?: {
    channel?: string;
    limit?: number;
    minSimilarity?: number;
  },
): Promise<SlackSearchResult[]> {
  const supabase = createAdminClient();
  const limit = options?.limit ?? 10;
  const minSimilarity = options?.minSimilarity ?? 0.3;
  const channel = options?.channel ?? null;

  try {
    // Embed the query
    const queryEmbedding = await embedQuery(query);

    if (queryEmbedding.length > 0) {
      // Vector similarity search via Supabase RPC
      const { data, error } = await supabase.rpc('search_slack_messages', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_org_id: orgId,
        match_channel_name: channel,
        match_count: limit,
        min_similarity: minSimilarity,
      });

      if (!error && data?.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          channelId: row.channel_id,
          channelName: row.channel_name ?? '',
          authorName: row.author_name ?? '',
          authorId: row.author_id ?? '',
          messageText: row.message_text,
          threadTs: row.thread_ts,
          messageTs: row.message_ts,
          similarity: row.similarity,
          createdAt: row.created_at,
        }));
      }

      if (error) {
        console.warn('[SlackRAG] Vector search RPC error:', error.message);
      }
    }
  } catch (err) {
    console.warn(
      '[SlackRAG] Vector search failed, falling back to text:',
      err instanceof Error ? err.message : err,
    );
  }

  // Fallback: text search with ILIKE
  const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  if (keywords.length === 0) return [];

  let queryBuilder = supabase
    .from('slack_message_embeddings')
    .select('id, channel_id, channel_name, author_name, author_id, message_text, thread_ts, message_ts, created_at')
    .eq('org_id', orgId)
    .ilike('message_text', `%${keywords[0]}%`)
    .order('message_ts', { ascending: false })
    .limit(limit);

  if (channel) {
    queryBuilder = queryBuilder.eq('channel_name', channel);
  }

  const { data } = await queryBuilder;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name ?? '',
    authorName: row.author_name ?? '',
    authorId: row.author_id ?? '',
    messageText: row.message_text,
    threadTs: row.thread_ts,
    messageTs: row.message_ts,
    similarity: 0.5, // Unknown similarity for text fallback
    createdAt: row.created_at,
  }));
}

// ── Thread Context Retrieval ──────────────────────────────────────────────────

/**
 * Get all messages in a thread for richer context.
 * Useful when a search result is part of a thread — fetch the full conversation.
 */
export async function getThreadMessages(
  orgId: string,
  threadTs: string,
): Promise<SlackSearchResult[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('slack_message_embeddings')
    .select('id, channel_id, channel_name, author_name, author_id, message_text, thread_ts, message_ts, created_at')
    .eq('org_id', orgId)
    .or(`thread_ts.eq.${threadTs},message_ts.eq.${threadTs}`)
    .order('message_ts', { ascending: true })
    .limit(50);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name ?? '',
    authorName: row.author_name ?? '',
    authorId: row.author_id ?? '',
    messageText: row.message_text,
    threadTs: row.thread_ts,
    messageTs: row.message_ts,
    similarity: 1.0, // Exact thread match
    createdAt: row.created_at,
  }));
}
