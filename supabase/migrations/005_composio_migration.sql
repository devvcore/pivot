-- Migration: Add Composio connected account support
-- Composio manages OAuth tokens, so we store the connected account ID instead

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS composio_connected_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_integrations_composio_id
  ON integrations(composio_connected_account_id)
  WHERE composio_connected_account_id IS NOT NULL;

-- Note: We keep access_token/refresh_token columns for ADP (manual OAuth)
-- For Composio-managed providers, these columns will be NULL
