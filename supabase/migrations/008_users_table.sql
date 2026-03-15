-- ═══════════════════════════════════════════════════════════════
-- Migration 008: Enhance profiles into a full users table + team invites
-- ═══════════════════════════════════════════════════════════════

-- Add user profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'active';

-- Index for active user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;

-- ─── Team Invites ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invites (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'MEMBER',
    invited_by UUID REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_org_email ON team_invites(org_id, email) WHERE accepted_at IS NULL;

-- RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_invites_select_org" ON team_invites
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );

CREATE POLICY "team_invites_insert_org" ON team_invites
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );

CREATE POLICY "team_invites_delete_org" ON team_invites
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
    );
