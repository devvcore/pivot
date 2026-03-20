-- ─────────────────────────────────────────────────────────────────────────────
-- 015: Alerts — Proactive monitoring alerts for orgs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    type TEXT NOT NULL,                        -- e.g. 'revenue_drop', 'new_customers', 'overdue_tasks'
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    suggested_action TEXT,
    source_provider TEXT,                      -- which integration triggered it (stripe, jira, etc.)
    metadata JSONB DEFAULT '{}',               -- extra data (metrics, thresholds, etc.)
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_org ON alerts(org_id);
CREATE INDEX idx_alerts_org_unread ON alerts(org_id, read) WHERE read = false;
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(org_id, severity);
