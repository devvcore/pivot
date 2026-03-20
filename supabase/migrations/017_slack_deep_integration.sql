-- ─────────────────────────────────────────────────────────────────────────────
-- 017: Slack Deep Integration
-- Maps Slack users to Pivot orgs, tracks bot conversation threads,
-- and stores the client-interaction toggle per org.
-- ─────────────────────────────────────────────────────────────────────────────

-- Slack user -> org member mapping
CREATE TABLE IF NOT EXISTS slack_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    slack_team_id TEXT NOT NULL,
    slack_user_id TEXT NOT NULL,
    slack_username TEXT,
    slack_display_name TEXT,
    pivot_user_id TEXT,            -- nullable until linked
    email TEXT,
    is_bot BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (slack_team_id, slack_user_id)
);

CREATE INDEX idx_slack_user_map_org ON slack_user_mappings(org_id);
CREATE INDEX idx_slack_user_map_slack ON slack_user_mappings(slack_team_id, slack_user_id);

-- Bot conversation threads (for multi-turn DM and channel threads)
CREATE TABLE IF NOT EXISTS slack_bot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    slack_channel_id TEXT NOT NULL,
    slack_thread_ts TEXT,          -- null for top-level DMs, set for threaded convos
    slack_user_id TEXT NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,  -- [{role, content, ts}]
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_slack_bot_convos_channel ON slack_bot_conversations(slack_channel_id, slack_thread_ts);
CREATE INDEX idx_slack_bot_convos_org ON slack_bot_conversations(org_id);

-- Org-level Slack bot settings
CREATE TABLE IF NOT EXISTS slack_bot_settings (
    org_id TEXT PRIMARY KEY,
    client_interaction_enabled BOOLEAN DEFAULT false,  -- Pivvy responds in channels to non-@mentions when true
    monitored_channels TEXT[] DEFAULT '{}',             -- channel IDs where Pivvy is active
    auto_ingest_enabled BOOLEAN DEFAULT false,          -- auto-pull Slack history for CRM
    response_style TEXT DEFAULT 'professional',         -- professional, casual, concise
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
