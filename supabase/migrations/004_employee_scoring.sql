-- ═══════════════════════════════════════════════════════════════
-- Migration 004: Employee Scoring System
-- Adds scoring tables, goal tracking, manager inputs,
-- and extends employees table for the value engine.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Extend employees table ─────────────────────────────────

ALTER TABLE employees ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS slack_user_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'support';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_score REAL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_rank INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS permission_tier TEXT DEFAULT 'employee';

-- Add check constraint for permission_tier
DO $$ BEGIN
    ALTER TABLE employees
        ADD CONSTRAINT chk_permission_tier
        CHECK (permission_tier IN ('owner', 'csuite', 'employee'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add check constraint for role_type
DO $$ BEGIN
    ALTER TABLE employees
        ADD CONSTRAINT chk_role_type
        CHECK (role_type IN ('direct_revenue', 'enabler', 'support'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK to auth.users (optional — employee may not have a login)
DO $$ BEGIN
    ALTER TABLE employees
        ADD CONSTRAINT fk_employees_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_permission ON employees(permission_tier);
CREATE INDEX IF NOT EXISTS idx_employees_role_type ON employees(role_type);


-- ─── 2. Employee scores (rolling history) ──────────────────────

CREATE TABLE IF NOT EXISTS employee_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Hard value
    hard_value REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    net_value REAL DEFAULT 0,

    -- Intangible dimensions (0-100 each, NULL = no data)
    responsiveness REAL,
    output_volume REAL,
    quality_signal REAL,
    collaboration REAL,
    reliability REAL,
    manager_assessment REAL,
    intangible_score REAL,

    -- Classification
    role_type TEXT DEFAULT 'support',
    confidence TEXT DEFAULT 'estimated' CHECK (confidence IN ('measured', 'partial', 'estimated', 'evaluating')),
    data_sources JSONB DEFAULT '[]'::jsonb,

    -- Ranking
    rank INTEGER,
    rank_change INTEGER DEFAULT 0,

    -- Time window
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emp_scores_employee ON employee_scores(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_scores_org ON employee_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_emp_scores_date ON employee_scores(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_scores_rank ON employee_scores(org_id, rank);
ALTER TABLE employee_scores ENABLE ROW LEVEL SECURITY;


-- ─── 3. Employee goals ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    title TEXT NOT NULL,
    metric TEXT NOT NULL,
    target REAL NOT NULL,
    current REAL DEFAULT 0,
    projected_impact REAL,
    deadline TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed', 'stretch')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emp_goals_employee ON employee_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_goals_status ON employee_goals(status);
CREATE INDEX IF NOT EXISTS idx_emp_goals_org ON employee_goals(org_id);
ALTER TABLE employee_goals ENABLE ROW LEVEL SECURITY;


-- ─── 4. Manager inputs (optional per-employee assessments) ─────

CREATE TABLE IF NOT EXISTS manager_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id TEXT NOT NULL,
    score REAL CHECK (score >= 0 AND score <= 100),
    tags JSONB DEFAULT '[]'::jsonb,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mgr_inputs_employee ON manager_inputs(employee_id);
CREATE INDEX IF NOT EXISTS idx_mgr_inputs_date ON manager_inputs(created_at DESC);
ALTER TABLE manager_inputs ENABLE ROW LEVEL SECURITY;


-- ─── 5. Scoring events (trigger recalculations) ───────────────

CREATE TABLE IF NOT EXISTS scoring_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_events_unprocessed ON scoring_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_scoring_events_employee ON scoring_events(employee_id);
ALTER TABLE scoring_events ENABLE ROW LEVEL SECURITY;
