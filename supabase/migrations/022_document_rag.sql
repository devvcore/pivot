-- 022_document_rag.sql — Document chunks with vector embeddings for RAG

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  job_id TEXT NOT NULL,              -- run_id from jobs table
  filename TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,       -- position within document
  content TEXT NOT NULL,              -- the actual text chunk
  embedding vector(768),              -- Gemini text-embedding-004 = 768 dims
  metadata JSONB DEFAULT '{}'::jsonb, -- {category, page, entities, fileType}
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_chunks_org ON document_chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_job ON document_chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_filename ON document_chunks(org_id, filename);

-- Vector similarity search index (IVFFlat for speed on small datasets)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 20);
