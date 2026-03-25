/**
 * Document Embedding Pipeline — Chunk, embed, and store document text for RAG.
 *
 * Flow:
 * 1. Receive parsed documents (filename + full text)
 * 2. Split into ~400-token chunks with 50-token overlap
 * 3. Embed each chunk using Gemini text-embedding-004 (768 dims, FREE)
 * 4. Store in document_chunks table with pgvector
 *
 * Called from the main pipeline (run.ts) after parsing, in parallel with synthesis.
 */

import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedDocument {
  filename: string;
  text: string;
  metadata?: {
    category?: string;
    fileType?: string;
  };
}

interface DocumentChunk {
  id: string;
  orgId: string;
  jobId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  tokenCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 400;       // tokens (~1600 chars)
const CHUNK_OVERLAP = 50;     // tokens (~200 chars)
const CHARS_PER_TOKEN = 4;    // rough estimate for English
const EMBEDDING_MODEL = 'text-embedding-004';  // Gemini Embedding 2, 768 dims, FREE
const EMBEDDING_BATCH_SIZE = 20;  // Max chunks per embedding call
const MAX_CHUNKS_PER_DOC = 100;   // Safety limit

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks, respecting sentence boundaries.
 */
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!text || text.trim().length < 50) return [];

  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Split into sentences first
  const sentences = text.split(/(?<=[.!?\n])\s+/).filter(s => s.trim().length > 0);

  const chunks: string[] = [];
  let currentChunk = '';
  let overlapBuffer = '';

  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size
    if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Keep overlap from the end of the current chunk
      overlapBuffer = currentChunk.slice(-overlapChars);
      currentChunk = overlapBuffer + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 50) {
    chunks.push(currentChunk.trim());
  }

  return chunks.slice(0, MAX_CHUNKS_PER_DOC);
}

// ── Embedding ─────────────────────────────────────────────────────────────────

/**
 * Embed a batch of texts using Gemini text-embedding-004.
 * Returns array of 768-dimensional vectors.
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  // Gemini embedding API supports batch embedding
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch.map(text => ({
        parts: [{ text: text.slice(0, 8000) }],  // Gemini limit
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
 * Embed a single query for search.
 */
export async function embedQuery(query: string): Promise<number[]> {
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

// ── Main Pipeline ─────────────────────────────────────────────────────────────

/**
 * Process parsed documents: chunk, embed, and store in pgvector.
 * Call this from run.ts after parsing, in parallel with synthesis.
 */
export async function embedDocuments(
  orgId: string,
  jobId: string,
  documents: ParsedDocument[],
): Promise<{ chunksStored: number; errors: string[] }> {
  const supabase = createAdminClient();
  let chunksStored = 0;
  const errors: string[] = [];

  // Delete any existing chunks for this job (in case of re-run)
  await supabase.from('document_chunks').delete().eq('job_id', jobId);

  for (const doc of documents) {
    try {
      if (!doc.text || doc.text.trim().length < 100) continue;

      // 1. Chunk the document
      const chunks = chunkText(doc.text);
      if (chunks.length === 0) continue;

      // 2. Embed all chunks
      let embeddings: number[][];
      try {
        embeddings = await embedBatch(chunks);
      } catch (err) {
        // If embedding fails, store chunks without embeddings (still searchable via text)
        console.warn(`[Embed] Embedding failed for ${doc.filename}:`, err instanceof Error ? err.message : err);
        embeddings = chunks.map(() => []);
      }

      // 3. Store in database
      const rows = chunks.map((content, i) => ({
        id: uuidv4(),
        org_id: orgId,
        job_id: jobId,
        filename: doc.filename,
        chunk_index: i,
        content,
        embedding: embeddings[i]?.length > 0 ? JSON.stringify(embeddings[i]) : null,
        metadata: {
          category: doc.metadata?.category,
          fileType: doc.metadata?.fileType,
          chunkCount: chunks.length,
        },
        token_count: Math.ceil(content.length / CHARS_PER_TOKEN),
      }));

      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('document_chunks').insert(batch);
        if (error) {
          errors.push(`${doc.filename}: ${error.message}`);
        } else {
          chunksStored += batch.length;
        }
      }
    } catch (err) {
      errors.push(`${doc.filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[Embed] Stored ${chunksStored} chunks from ${documents.length} documents for job ${jobId}`);
  return { chunksStored, errors };
}

// ── Semantic Search ───────────────────────────────────────────────────────────

export interface SearchResult {
  content: string;
  filename: string;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Semantic search across document chunks using pgvector cosine similarity.
 * Falls back to text search if embeddings aren't available.
 */
export async function searchDocuments(
  orgId: string,
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    filename?: string;
  },
): Promise<SearchResult[]> {
  const supabase = createAdminClient();
  const limit = options?.limit ?? 8;
  const minSimilarity = options?.minSimilarity ?? 0.3;

  try {
    // Embed the query
    const queryEmbedding = await embedQuery(query);

    if (queryEmbedding.length > 0) {
      // Vector similarity search via Supabase RPC
      const { data, error } = await supabase.rpc('search_document_chunks', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_org_id: orgId,
        match_count: limit,
        min_similarity: minSimilarity,
      });

      if (!error && data?.length > 0) {
        return data.map((row: any) => ({
          content: row.content,
          filename: row.filename,
          chunkIndex: row.chunk_index,
          similarity: row.similarity,
          metadata: row.metadata ?? {},
        }));
      }
    }
  } catch (err) {
    console.warn('[Search] Vector search failed, falling back to text:', err instanceof Error ? err.message : err);
  }

  // Fallback: text search with ILIKE
  const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  if (keywords.length === 0) return [];

  // Build OR condition for keywords
  const conditions = keywords.map(k => `content.ilike.%${k}%`);

  let queryBuilder = supabase
    .from('document_chunks')
    .select('content, filename, chunk_index, metadata')
    .eq('org_id', orgId)
    .limit(limit);

  // Apply filename filter if specified
  if (options?.filename) {
    queryBuilder = queryBuilder.ilike('filename', `%${options.filename}%`);
  }

  // Text search with first keyword (Supabase doesn't support OR in .ilike easily)
  queryBuilder = queryBuilder.ilike('content', `%${keywords[0]}%`);

  const { data } = await queryBuilder;

  return (data ?? []).map((row: any) => ({
    content: row.content,
    filename: row.filename,
    chunkIndex: row.chunk_index,
    similarity: 0.5,  // Unknown similarity for text search
    metadata: row.metadata ?? {},
  }));
}
