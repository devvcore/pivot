-- ═══════════════════════════════════════════════════════════════
-- Pivot — Integration Tables
-- Supports: Slack, Gmail, ADP, Workday, QuickBooks, Salesforce,
--           HubSpot, Stripe, Jira
-- ═══════════════════════════════════════════════════════════════

-- ─── Integrations (OAuth tokens + provider config) ────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN (
        'slack', 'gmail', 'adp', 'workday',
        'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira'
    )),
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN (
        'connected', 'disconnected', 'error', 'syncing'
    )),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    sync_frequency_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One integration per provider per org
    UNIQUE (org_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- ─── Integration Sync Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
        'running', 'completed', 'failed'
    )),
    records_processed INTEGER NOT NULL DEFAULT 0,
    insights_generated INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_integration_id ON integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_org_id ON integration_sync_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON integration_sync_logs(status);

-- ─── Communication Insights (from Slack / Gmail) ─────────────────────────────
CREATE TABLE IF NOT EXISTS communication_insights (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id TEXT,
    source TEXT NOT NULL CHECK (source IN ('slack', 'gmail')),
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'relationship_score', 'meeting_attendance', 'response_time',
        'bottleneck', 'sentiment', 'engagement', 'risk_flag'
    )),
    subject_name TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_insights_org_id ON communication_insights(org_id);
CREATE INDEX IF NOT EXISTS idx_comm_insights_source ON communication_insights(source);
CREATE INDEX IF NOT EXISTS idx_comm_insights_type ON communication_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_comm_insights_period ON communication_insights(period_start, period_end);

-- ─── HR Employee Data (from ADP / Workday) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_employee_data (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('adp', 'workday', 'manual')),
    external_id TEXT,
    employee_name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    job_title TEXT,
    hire_date TEXT,
    salary REAL,
    pay_frequency TEXT,
    employment_status TEXT,
    manager_name TEXT,
    performance_rating REAL,
    last_review_date TEXT,
    benefits JSONB,
    time_off_balance JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate employees per source per org
    UNIQUE (org_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_org_id ON hr_employee_data(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_source ON hr_employee_data(source);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON hr_employee_data(department);

-- ═══════════════════════════════════════════════════════════════
-- Auto-update triggers (reuses update_updated_at() from 001)
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
    CREATE TRIGGER update_integrations_updated_at
        BEFORE UPDATE ON integrations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_data ENABLE ROW LEVEL SECURITY;

-- Integrations: org members can read/write their own integrations
CREATE POLICY "integrations_select_org" ON integrations
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "integrations_insert_org" ON integrations
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "integrations_update_org" ON integrations
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "integrations_delete_org" ON integrations
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );

-- Sync Logs: org members can read their sync history
CREATE POLICY "sync_logs_select_org" ON integration_sync_logs
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "sync_logs_insert_org" ON integration_sync_logs
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "sync_logs_update_org" ON integration_sync_logs
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );

-- Communication Insights: org members can read
CREATE POLICY "comm_insights_select_org" ON communication_insights
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "comm_insights_insert_org" ON communication_insights
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );

-- HR Employee Data: org members can read/write
CREATE POLICY "hr_data_select_org" ON hr_employee_data
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "hr_data_insert_org" ON hr_employee_data
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "hr_data_update_org" ON hr_employee_data
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
CREATE POLICY "hr_data_delete_org" ON hr_employee_data
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
