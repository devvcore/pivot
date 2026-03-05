-- ═══════════════════════════════════════════════════════════════
-- Migration 003: Relational Constraints & Missing Tables
-- Adds proper foreign keys, creates missing tables, cleans up schema
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Missing Tables ──────────────────────────────────────────

-- OAuth CSRF state tokens (used during integration connect flow)
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_token TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Integration data (normalized records from QuickBooks, Stripe, etc.)
CREATE TABLE IF NOT EXISTS integration_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    record_type TEXT NOT NULL,
    external_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(integration_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_integration_data_org ON integration_data(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_data_integration ON integration_data(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_data_type ON integration_data(record_type);
CREATE INDEX IF NOT EXISTS idx_integration_data_provider ON integration_data(provider);
ALTER TABLE integration_data ENABLE ROW LEVEL SECURITY;

-- Integration insights (derived analysis from integration data)
CREATE TABLE IF NOT EXISTS integration_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integration_insights_org ON integration_insights(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_insights_integration ON integration_insights(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_insights_type ON integration_insights(insight_type);
ALTER TABLE integration_insights ENABLE ROW LEVEL SECURITY;

-- Webhook event queue (staging table for incoming webhooks)
CREATE TABLE IF NOT EXISTS integration_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON integration_webhook_events(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON integration_webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON integration_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON integration_webhook_events(created_at DESC);
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;


-- ─── 2. Fix Column Types for FK Compatibility ──────────────────

-- organizations.owner_user_id: TEXT → UUID (to reference auth.users)
ALTER TABLE organizations
    ALTER COLUMN owner_user_id TYPE UUID USING owner_user_id::uuid;

-- share_links.created_by: TEXT → UUID (to reference auth.users)
ALTER TABLE share_links
    ALTER COLUMN created_by TYPE UUID USING created_by::uuid;


-- ─── 3. Add Missing Foreign Keys ────────────────────────────────

-- organizations.owner_user_id → auth.users(id)
DO $$ BEGIN
    ALTER TABLE organizations
        ADD CONSTRAINT fk_organizations_owner
        FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- share_links.org_id → organizations(id)
DO $$ BEGIN
    ALTER TABLE share_links
        ADD CONSTRAINT fk_share_links_org
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- share_links.job_id → jobs(id)
DO $$ BEGIN
    ALTER TABLE share_links
        ADD CONSTRAINT fk_share_links_job
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- share_links.created_by → auth.users(id)
DO $$ BEGIN
    ALTER TABLE share_links
        ADD CONSTRAINT fk_share_links_created_by
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- employees.org_id → organizations(id)
DO $$ BEGIN
    ALTER TABLE employees
        ADD CONSTRAINT fk_employees_org
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- agent_conversations.org_id → organizations(id)
DO $$ BEGIN
    ALTER TABLE agent_conversations
        ADD CONSTRAINT fk_agent_conversations_org
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tasks.job_id → jobs(id)
DO $$ BEGIN
    ALTER TABLE tasks
        ADD CONSTRAINT fk_tasks_job
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- jobs.organization_id → organizations(id)
DO $$ BEGIN
    ALTER TABLE jobs
        ADD CONSTRAINT fk_jobs_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- communication_insights.job_id → jobs(id)
DO $$ BEGIN
    ALTER TABLE communication_insights
        ADD CONSTRAINT fk_comm_insights_job
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 4. Add Missing Indexes on FK Columns ───────────────────────

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_org ON share_links(org_id);
CREATE INDEX IF NOT EXISTS idx_share_links_created_by ON share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);


-- ─── 5. Auto-cleanup: Expired OAuth States ──────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
