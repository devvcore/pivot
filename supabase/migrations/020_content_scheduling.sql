-- Migration 020: Content Scheduling & A/B Testing
-- Adds scheduled_posts and ab_tests tables for social media strategy tools.

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'posting', 'posted', 'failed', 'cancelled'
  )),
  ab_group_id UUID,
  variant_label TEXT,
  post_url TEXT,
  post_id TEXT,
  impressions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  created_by TEXT,
  task_id UUID,
  campaign_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('draft', 'running', 'completed')),
  variant_count INTEGER DEFAULT 2,
  metric TEXT DEFAULT 'engagement_rate',
  winner_variant TEXT,
  winner_post_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_org ON scheduled_posts(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_ab ON scheduled_posts(ab_group_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_org ON ab_tests(org_id);
