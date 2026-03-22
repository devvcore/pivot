-- User feedback on task results
CREATE TABLE IF NOT EXISTS task_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  thumbs TEXT CHECK (thumbs IN ('up', 'down')),
  feedback_text TEXT,
  corrections TEXT,
  lessons_extracted JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent performance scores (rolling monthly)
CREATE TABLE IF NOT EXISTS agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  avg_rating REAL DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  avg_cost_per_task REAL DEFAULT 0,
  avg_execution_time_ms REAL DEFAULT 0,
  thumbs_up INTEGER DEFAULT 0,
  thumbs_down INTEGER DEFAULT 0,
  feedback_count INTEGER DEFAULT 0,
  flash_tasks INTEGER DEFAULT 0,
  pro_tasks INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, agent_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_task_feedback_task ON task_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_task_feedback_org ON task_feedback(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_org ON agent_performance(org_id, agent_id);
