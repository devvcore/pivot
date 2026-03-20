-- ─────────────────────────────────────────────────────────────────────────────
-- 012: Agent Memory & Scheduled Runs
-- ─────────────────────────────────────────────────────────────────────────────

-- Agent memory: persistent per-agent learning across tasks
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    -- Memory content
    memory_type TEXT NOT NULL CHECK (memory_type IN ('lesson', 'preference', 'context', 'correction')),
    content TEXT NOT NULL,           -- the actual memory: "Stripe amounts are in cents, divide by 100"
    source_task_id UUID,             -- which task produced this memory
    relevance_score REAL DEFAULT 1.0,-- how useful this memory has been (decays over time)
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ DEFAULT now(),
    use_count INTEGER DEFAULT 0,
    expired BOOLEAN DEFAULT false
);

CREATE INDEX idx_agent_memory_org ON agent_memory(org_id, agent_id);
CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);

-- Scheduled agent runs: recurring tasks
CREATE TABLE IF NOT EXISTS scheduled_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    agent_id TEXT NOT NULL,
    -- Schedule
    cron_expression TEXT NOT NULL,    -- e.g. "0 9 * * 1" (Monday 9am)
    timezone TEXT DEFAULT 'UTC',
    -- Config
    enabled BOOLEAN DEFAULT true,
    push_channel TEXT,               -- 'slack' | 'email' | null
    push_target TEXT,                -- channel name or email address
    -- Tracking
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT,
    last_run_task_id UUID,
    run_count INTEGER DEFAULT 0,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scheduled_runs_org ON scheduled_runs(org_id);
CREATE INDEX idx_scheduled_runs_enabled ON scheduled_runs(enabled) WHERE enabled = true;
