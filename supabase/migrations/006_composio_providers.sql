-- ═══════════════════════════════════════════════════════════════
-- Migration 006: Widen provider constraints for Composio integrations
-- Adds 9 new providers (github + 8 Composio-only) and adapts
-- integration_data for Composio sync pattern (no integration_id needed).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Widen integrations.provider CHECK constraint ──────────────

-- Drop old constraint (only allowed 9 providers)
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;

-- Add new constraint with all 18 providers
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check CHECK (provider IN (
    'slack', 'gmail', 'adp', 'workday',
    'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira', 'github',
    'google_analytics', 'google_sheets', 'notion', 'linear',
    'asana', 'google_calendar', 'microsoft_teams', 'airtable'
));

-- ─── 2. Make integration_data.integration_id nullable ─────────────
-- Composio sync adapters operate at org+provider level, not per-integration row.
-- They don't always have an integration_id when storing aggregate data.

ALTER TABLE integration_data ALTER COLUMN integration_id DROP NOT NULL;

-- ─── 3. Add unique constraint for Composio sync upserts ──────────
-- Composio sync uses (org_id, provider, record_type) as the upsert key.
-- The existing UNIQUE(integration_id, external_id) stays for per-record syncs.

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_data_composio_upsert
    ON integration_data(org_id, provider, record_type);

-- ─── 4. RLS policies for new integration_data rows ────────────────
-- (The table already has RLS enabled from migration 003, but needs policies)

DO $$ BEGIN
    CREATE POLICY "integration_data_select_org" ON integration_data
        FOR SELECT USING (
            org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "integration_data_insert_service" ON integration_data
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "integration_data_update_service" ON integration_data
        FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
