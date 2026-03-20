-- ═══════════════════════════════════════════════════════════════
-- Migration 010: User Identity (first/last name) + Relational Integrity
-- Adds first_name/last_name to profiles, backfills from existing name,
-- adds missing FK constraints, and adds user_id tracking to key tables.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Add first_name / last_name to profiles ───────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill from existing 'name' column: split on first space
UPDATE profiles
SET first_name = SPLIT_PART(name, ' ', 1),
    last_name  = NULLIF(TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1)), '')
WHERE name IS NOT NULL AND first_name IS NULL;

-- ─── 2. Add user_id to jobs (who ran each analysis) ──────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);

-- ─── 3. Add user_id to execution_tasks (who created each task) ───────────────
ALTER TABLE execution_tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exec_tasks_user_id ON execution_tasks(user_id);

-- ─── 4. Add missing FK constraints on original tables ────────────────────────
-- These tables were created in 001 with plain TEXT columns and no FKs.
-- We add constraints safely using DO blocks to skip if they already exist.

-- jobs.organization_id → organizations.id
DO $$ BEGIN
    ALTER TABLE jobs ADD CONSTRAINT fk_jobs_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- employees.org_id → organizations.id
DO $$ BEGIN
    ALTER TABLE employees ADD CONSTRAINT fk_employees_org
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- agent_conversations.org_id → organizations.id
DO $$ BEGIN
    ALTER TABLE agent_conversations ADD CONSTRAINT fk_agent_convos_org
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- share_links.org_id → organizations.id
DO $$ BEGIN
    ALTER TABLE share_links ADD CONSTRAINT fk_share_links_org
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- share_links.job_id → jobs.id
DO $$ BEGIN
    ALTER TABLE share_links ADD CONSTRAINT fk_share_links_job
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tasks.job_id references jobs.run_id (UNIQUE column)
DO $$ BEGIN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_job_run
        FOREIGN KEY (job_id) REFERENCES jobs(run_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. Fix agent_conversations.user_id to be proper UUID ────────────────────
-- Original column is TEXT. Add a proper UUID user_id column alongside it.
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agent_convos_auth_user ON agent_conversations(auth_user_id);

-- ─── 6. Indexes on first_name/last_name for search ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_first_name ON profiles(first_name);
CREATE INDEX IF NOT EXISTS idx_profiles_last_name ON profiles(last_name);
