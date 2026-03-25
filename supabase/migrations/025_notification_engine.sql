-- 025_notification_engine.sql — Enhanced alerts and webhook processing

-- Add missing columns to alerts table for notification engine
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'system';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_event_type TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add processed_at to webhook events for tracking
ALTER TABLE integration_webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Index for fast unprocessed event lookup
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON integration_webhook_events(processed)
  WHERE processed = false;

-- Index for alert deduplication
CREATE INDEX IF NOT EXISTS idx_alerts_dedup
  ON alerts(org_id, source_event_type, created_at);

-- Index for unread alerts badge count
CREATE INDEX IF NOT EXISTS idx_alerts_unread
  ON alerts(org_id, read)
  WHERE read = false;

-- Browser automation: webpage monitoring state
CREATE TABLE IF NOT EXISTS webpage_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    last_hash TEXT,
    last_content TEXT,
    last_checked_at TIMESTAMPTZ,
    check_interval_minutes INTEGER DEFAULT 60,
    notify_on_change BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, url)
);

CREATE INDEX IF NOT EXISTS idx_webpage_monitors_org ON webpage_monitors(org_id);
