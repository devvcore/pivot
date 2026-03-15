-- ═══════════════════════════════════════════════════════════════
-- Migration 007: Add username column to profiles table
-- ═══════════════════════════════════════════════════════════════

-- Add username column (nullable initially so existing rows aren't broken)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Add display_name column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create unique index on username (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- Update RLS: allow any authenticated user to SELECT profiles (for username lookups)
-- Drop old restrictive policy and replace with public-read policy
DO $$ BEGIN
    DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "profiles_select_all" ON profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep existing update/insert policies (users can only update/insert their own)
