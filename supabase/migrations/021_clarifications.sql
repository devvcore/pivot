-- 021_clarifications.sql — Pre-execution clarification questions

CREATE TABLE IF NOT EXISTS execution_clarifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  context TEXT,
  user_response TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'skipped', 'timeout')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clarifications_task ON execution_clarifications(task_id);
CREATE INDEX IF NOT EXISTS idx_clarifications_status ON execution_clarifications(status, created_at DESC);
