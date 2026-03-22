-- 018_campaigns.sql — Multi-step campaign/workflow engine

-- Campaign: a named sequence of coordinated agent tasks
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  template_id TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'
  )),
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN (
    'manual', 'scheduled', 'event', 'webhook'
  )),
  cron_expression TEXT,
  timezone TEXT DEFAULT 'UTC',
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  current_step_id UUID,
  shared_context JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign step: one task in the sequence
CREATE TABLE IF NOT EXISTS campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  agent_id TEXT NOT NULL,
  depends_on UUID[],
  condition TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'waiting', 'running', 'completed', 'failed', 'skipped'
  )),
  task_id UUID,
  result_summary TEXT,
  delay_minutes INTEGER DEFAULT 0,
  timeout_minutes INTEGER DEFAULT 30,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_status ON campaign_steps(status);
