-- ─────────────────────────────────────────────────────────────────────────────
-- 013: Procedures — Learned multi-step task patterns for replay
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    trigger_phrases TEXT[] NOT NULL DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',
    run_count INTEGER NOT NULL DEFAULT 1,
    avg_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_procedures_org_agent ON procedures(org_id, agent_id);
CREATE INDEX idx_procedures_run_count ON procedures(run_count DESC);
