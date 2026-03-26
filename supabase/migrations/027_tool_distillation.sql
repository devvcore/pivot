-- 027_tool_distillation.sql — Self-optimizing agent intelligence
-- Stores learned patterns from tool call observations so agents
-- get progressively more efficient over time.

CREATE TABLE IF NOT EXISTS tool_call_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    pattern_key TEXT NOT NULL,             -- e.g. "web_search:competitor+pricing"
    efficiency_score INTEGER DEFAULT 50,   -- 0-100, EMA-smoothed
    optimal_args JSONB,                    -- best-known args for this pattern
    tips TEXT,                             -- concise "DO this" guidance
    avoid TEXT,                            -- concise "DON'T do this" guidance
    expected_output_shape TEXT,            -- what good output looks like
    token_estimate INTEGER DEFAULT 0,      -- estimated tokens for optimal execution
    usage_count INTEGER DEFAULT 1,         -- times this pattern has been seen
    last_used_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_tcc_org_tool ON tool_call_context(org_id, tool_name);
CREATE INDEX IF NOT EXISTS idx_tcc_pattern ON tool_call_context(org_id, pattern_key);
CREATE INDEX IF NOT EXISTS idx_tcc_usage ON tool_call_context(org_id, usage_count DESC);
