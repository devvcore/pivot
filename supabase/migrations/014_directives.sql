-- Directives & Governance System
-- Org-level rules that constrain agent behavior

CREATE TABLE IF NOT EXISTS directives (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('never', 'always', 'prefer', 'ignore')),
  content    TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'agent', 'system')),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast org lookup
CREATE INDEX IF NOT EXISTS idx_directives_org_active ON directives (org_id, active) WHERE active = true;

-- RLS
ALTER TABLE directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view directives"
  ON directives FOR SELECT
  USING (true);

CREATE POLICY "Org members can insert directives"
  ON directives FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Org members can update directives"
  ON directives FOR UPDATE
  USING (true);
