-- ─────────────────────────────────────────────────────────────────────────────
-- 011: Eval System — Persistent quality tracking for agents and synthesis
-- ─────────────────────────────────────────────────────────────────────────────

-- Eval runs: one row per eval suite execution
CREATE TABLE IF NOT EXISTS eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id TEXT NOT NULL,              -- e.g. 'agents', 'pivvy', 'synthesis', 'e2e'
    git_sha TEXT,                        -- commit hash for regression tracking
    trigger TEXT DEFAULT 'manual',       -- 'manual' | 'ci' | 'deploy' | 'cron'
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    total_checks INTEGER DEFAULT 0,
    passed_checks INTEGER DEFAULT 0,
    -- Aggregate scores (0-100)
    score_overall REAL,                  -- weighted average of all dimensions
    score_accuracy REAL,                 -- factual correctness
    score_hallucination REAL,            -- inverse hallucination rate (100 = clean)
    score_relevance REAL,                -- task-specific relevance
    score_quality REAL,                  -- output structure, markdown, tone
    score_efficiency REAL,               -- tool usage, token economy, speed
    -- Cost & performance
    total_cost_usd REAL DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_time_ms INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    -- Metadata
    metadata JSONB DEFAULT '{}',         -- extra context (env, flags, notes)
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_eval_runs_suite ON eval_runs(suite_id);
CREATE INDEX idx_eval_runs_created ON eval_runs(created_at DESC);

-- Eval results: one row per test case within a run
CREATE TABLE IF NOT EXISTS eval_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    agent_id TEXT,                        -- which agent was tested
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'error', 'skipped')),
    -- Dimension scores (0-100)
    score_accuracy REAL,
    score_hallucination REAL,
    score_relevance REAL,
    score_quality REAL,
    score_efficiency REAL,
    -- Check-level detail
    checks_passed TEXT[] DEFAULT '{}',    -- names of passed checks
    checks_failed TEXT[] DEFAULT '{}',    -- names of failed checks
    -- Model-graded eval
    grader_verdict TEXT,                  -- 'excellent' | 'good' | 'acceptable' | 'poor' | 'fail'
    grader_reasoning TEXT,                -- LLM explanation
    grader_scores JSONB,                 -- { accuracy: 85, hallucination: 100, ... }
    -- Execution metadata
    output TEXT,                          -- agent output (truncated)
    tools_used TEXT[] DEFAULT '{}',
    tool_calls INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    -- Context
    task_title TEXT,
    task_description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eval_results_run ON eval_results(run_id);
CREATE INDEX idx_eval_results_agent ON eval_results(agent_id);
CREATE INDEX idx_eval_results_status ON eval_results(status);

-- Eval baselines: store "golden" scores to detect regressions
CREATE TABLE IF NOT EXISTS eval_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id TEXT NOT NULL,
    agent_id TEXT,                        -- NULL for suite-level baseline
    metric TEXT NOT NULL,                 -- 'score_overall', 'score_accuracy', etc.
    baseline_value REAL NOT NULL,
    threshold REAL NOT NULL DEFAULT 5.0,  -- acceptable deviation (points)
    run_id UUID REFERENCES eval_runs(id),-- which run established this baseline
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(suite_id, agent_id, metric)
);
