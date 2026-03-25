-- 024_slack_rag.sql — Slack message embeddings for RAG semantic search

-- Slack message embeddings table
CREATE TABLE IF NOT EXISTS slack_message_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    author_name TEXT,
    author_id TEXT,
    message_text TEXT NOT NULL,
    thread_ts TEXT,
    message_ts TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, channel_id, message_ts)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_embed_org ON slack_message_embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_slack_embed_channel ON slack_message_embeddings(org_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_embed_thread ON slack_message_embeddings(org_id, thread_ts) WHERE thread_ts IS NOT NULL;

-- Vector similarity search index (IVFFlat for speed)
CREATE INDEX IF NOT EXISTS idx_slack_embed_search ON slack_message_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RPC function for semantic search over Slack messages
CREATE OR REPLACE FUNCTION search_slack_messages(
  query_embedding vector(768),
  match_org_id TEXT,
  match_channel_name TEXT DEFAULT NULL,
  match_count INTEGER DEFAULT 10,
  min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  channel_id TEXT,
  channel_name TEXT,
  author_name TEXT,
  author_id TEXT,
  message_text TEXT,
  thread_ts TEXT,
  message_ts TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sme.id,
    sme.channel_id,
    sme.channel_name,
    sme.author_name,
    sme.author_id,
    sme.message_text,
    sme.thread_ts,
    sme.message_ts,
    1 - (sme.embedding <=> query_embedding) AS similarity,
    sme.created_at
  FROM slack_message_embeddings sme
  WHERE sme.org_id = match_org_id
    AND sme.embedding IS NOT NULL
    AND 1 - (sme.embedding <=> query_embedding) >= min_similarity
    AND (match_channel_name IS NULL OR sme.channel_name = match_channel_name)
  ORDER BY sme.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
