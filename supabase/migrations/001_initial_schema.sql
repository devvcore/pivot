-- ═══════════════════════════════════════════════════════════════
-- Pivot — Supabase PostgreSQL Schema (migrated from SQLite)
-- Run via: npx tsx scripts/setup-supabase.ts
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Organizations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    revenue_range TEXT,
    business_model TEXT,
    key_concerns TEXT,
    one_decision TEXT,
    primary_objective TEXT,
    owner_user_id TEXT,
    agent_memory_json JSONB,
    website_analysis_json JSONB,
    icon_url TEXT,
    theme_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Profiles (replaces SQLite users table, linked to auth.users) ───────────
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    username TEXT,
    display_name TEXT,
    role TEXT DEFAULT 'MEMBER',
    organization_id TEXT REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on username (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- ─── User <> Organization membership ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_organizations (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'OWNER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, org_id)
);

-- ─── Analysis Jobs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    run_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    phase TEXT DEFAULT 'PLAN',
    organization_id TEXT NOT NULL DEFAULT 'default-org',
    questionnaire_json JSONB,
    file_paths_json JSONB DEFAULT '[]'::jsonb,
    parsed_context TEXT,
    knowledge_graph_json JSONB,
    results_json JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast job lookups by run_id and org
CREATE INDEX IF NOT EXISTS idx_jobs_run_id ON jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ─── Share Links ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    employee_name TEXT,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_job ON share_links(job_id);

-- ─── Employee Roster ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_title TEXT,
    department TEXT,
    salary REAL,
    start_date TEXT,
    net_value_estimate REAL,
    roi_score REAL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(org_id);

-- ─── Agent Conversations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_conversations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL,
    user_id TEXT,
    messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_org ON agent_conversations(org_id);

-- ─── Execution Tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    job_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_agent TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_job ON tasks(job_id);

-- ─── Seed default organization ──────────────────────────────────────────────
INSERT INTO organizations (id, name)
VALUES ('default-org', 'MVP Sandbox')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Service role key bypasses RLS, so these policies only apply to anon/authenticated users.

-- Profiles: authenticated users can read all profiles (for username lookups), update only their own
CREATE POLICY IF NOT EXISTS "profiles_select_all" ON profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY IF NOT EXISTS "profiles_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid());
CREATE POLICY IF NOT EXISTS "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- Organizations: users can access orgs they belong to
CREATE POLICY IF NOT EXISTS "orgs_select_member" ON organizations
    FOR SELECT USING (
        id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "orgs_update_member" ON organizations
    FOR UPDATE USING (
        id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY IF NOT EXISTS "orgs_insert_auth" ON organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- User organizations: users can see their own memberships
CREATE POLICY IF NOT EXISTS "user_orgs_select_own" ON user_organizations
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "user_orgs_insert_own" ON user_organizations
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Jobs: users can access jobs from their orgs
CREATE POLICY IF NOT EXISTS "jobs_select_org" ON jobs
    FOR SELECT USING (
        organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR organization_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "jobs_insert_org" ON jobs
    FOR INSERT WITH CHECK (
        organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR organization_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "jobs_update_org" ON jobs
    FOR UPDATE USING (
        organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR organization_id = 'default-org'
    );

-- Share links: publicly readable by token, writable by org members
CREATE POLICY IF NOT EXISTS "share_links_select_public" ON share_links
    FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "share_links_insert_org" ON share_links
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "share_links_delete_org" ON share_links
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Employees: org members can CRUD
CREATE POLICY IF NOT EXISTS "employees_select_org" ON employees
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "employees_insert_org" ON employees
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "employees_update_org" ON employees
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "employees_delete_org" ON employees
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Agent conversations: org members can access
CREATE POLICY IF NOT EXISTS "agent_convos_select_org" ON agent_conversations
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "agent_convos_insert_org" ON agent_conversations
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY IF NOT EXISTS "agent_convos_update_org" ON agent_conversations
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Tasks: accessible via job's org
CREATE POLICY IF NOT EXISTS "tasks_select_org" ON tasks
    FOR SELECT USING (
        job_id IN (SELECT run_id FROM jobs WHERE organization_id IN
            (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
            OR organization_id = 'default-org')
    );
CREATE POLICY IF NOT EXISTS "tasks_insert_org" ON tasks
    FOR INSERT WITH CHECK (
        job_id IN (SELECT run_id FROM jobs WHERE organization_id IN
            (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
            OR organization_id = 'default-org')
    );

-- ─── Auto-update updated_at trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER update_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_profiles_updated_at
        BEFORE UPDATE ON profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_jobs_updated_at
        BEFORE UPDATE ON jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_employees_updated_at
        BEFORE UPDATE ON employees
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_agent_conversations_updated_at
        BEFORE UPDATE ON agent_conversations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
