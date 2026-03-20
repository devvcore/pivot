/**
 * Slack User Mapping Utility
 *
 * Resolves Slack user IDs to Pivot org members.
 * Maintains a cached mapping table, auto-populating from the Slack API
 * when a user is encountered for the first time.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface SlackUserMapping {
  orgId: string;
  slackTeamId: string;
  slackUserId: string;
  slackUsername: string | null;
  slackDisplayName: string | null;
  pivotUserId: string | null;
  email: string | null;
  isBot: boolean;
}

/**
 * Resolve a Slack user ID to an org.
 * First checks the mapping table; if not found, looks up the user via
 * the Slack integration and caches the result.
 */
export async function resolveSlackUser(
  slackUserId: string,
  slackTeamId: string,
): Promise<SlackUserMapping | null> {
  const supabase = createAdminClient();

  // 1. Check existing mapping
  const { data: existing } = await supabase
    .from('slack_user_mappings')
    .select('*')
    .eq('slack_team_id', slackTeamId)
    .eq('slack_user_id', slackUserId)
    .maybeSingle();

  if (existing) {
    return {
      orgId: existing.org_id,
      slackTeamId: existing.slack_team_id,
      slackUserId: existing.slack_user_id,
      slackUsername: existing.slack_username,
      slackDisplayName: existing.slack_display_name,
      pivotUserId: existing.pivot_user_id,
      email: existing.email,
      isBot: existing.is_bot ?? false,
    };
  }

  // 2. Look up which org owns this Slack team
  const orgId = await resolveOrgFromSlackTeam(slackTeamId);
  if (!orgId) return null;

  // 3. Try to get user info from Slack API
  const userInfo = await fetchSlackUserInfo(orgId, slackUserId);

  // 4. Create mapping
  const mapping: SlackUserMapping = {
    orgId,
    slackTeamId,
    slackUserId,
    slackUsername: userInfo?.name ?? null,
    slackDisplayName: userInfo?.realName ?? null,
    pivotUserId: null,
    email: userInfo?.email ?? null,
    isBot: userInfo?.isBot ?? false,
  };

  // 5. Try to link to a Pivot user by email
  if (mapping.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', mapping.email)
      .maybeSingle();
    if (profile?.id) {
      mapping.pivotUserId = profile.id;
    }
  }

  // 6. Upsert into mapping table
  await supabase
    .from('slack_user_mappings')
    .upsert({
      org_id: mapping.orgId,
      slack_team_id: mapping.slackTeamId,
      slack_user_id: mapping.slackUserId,
      slack_username: mapping.slackUsername,
      slack_display_name: mapping.slackDisplayName,
      pivot_user_id: mapping.pivotUserId,
      email: mapping.email,
      is_bot: mapping.isBot,
    }, { onConflict: 'slack_team_id,slack_user_id' });

  return mapping;
}

/**
 * Find the Pivot org associated with a Slack team/workspace ID.
 * Uses the integrations table (Slack integration stores team_id in metadata).
 * Falls back to finding any connected Slack integration.
 */
export async function resolveOrgFromSlackTeam(slackTeamId: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Try metadata match first (team_id stored during OAuth)
  const { data: byMeta } = await supabase
    .from('integrations')
    .select('org_id')
    .eq('provider', 'slack')
    .eq('status', 'connected')
    .contains('metadata', { team_id: slackTeamId })
    .limit(1)
    .maybeSingle();

  if (byMeta?.org_id) return byMeta.org_id;

  // Fallback: check slack_user_mappings for any user in this team
  const { data: byMapping } = await supabase
    .from('slack_user_mappings')
    .select('org_id')
    .eq('slack_team_id', slackTeamId)
    .limit(1)
    .maybeSingle();

  if (byMapping?.org_id) return byMapping.org_id;

  // Last resort: any connected Slack integration (single-tenant scenario)
  const { data: anySlack } = await supabase
    .from('integrations')
    .select('org_id')
    .eq('provider', 'slack')
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();

  return anySlack?.org_id ?? null;
}

/**
 * Fetch user info from the Slack API via Composio.
 */
async function fetchSlackUserInfo(
  orgId: string,
  slackUserId: string,
): Promise<{ name: string; realName: string; email: string | null; isBot: boolean } | null> {
  try {
    const { executeComposioAction } = await import('@/lib/integrations/composio');
    const result = await executeComposioAction(orgId, 'slack', 'SLACKBOT_GET_USER_INFO', {
      user: slackUserId,
    });

    const user = result?.data?.user ?? result?.user ?? result;
    if (!user) return null;

    return {
      name: user.name ?? user.profile?.display_name ?? slackUserId,
      realName: user.real_name ?? user.profile?.real_name ?? '',
      email: user.profile?.email ?? null,
      isBot: user.is_bot ?? false,
    };
  } catch (err) {
    console.warn(`[SlackUserMapping] Failed to fetch user info for ${slackUserId}:`, err);

    // Try direct Slack API as fallback
    const token = process.env.SLACK_APP_TOKEN;
    if (token) {
      try {
        const resp = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        const data = await resp.json();
        if (data.ok && data.user) {
          return {
            name: data.user.name ?? slackUserId,
            realName: data.user.real_name ?? '',
            email: data.user.profile?.email ?? null,
            isBot: data.user.is_bot ?? false,
          };
        }
      } catch { /* ignore */ }
    }

    return null;
  }
}

/**
 * Bulk sync all Slack users for an org into the mapping table.
 * Called during Slack history ingestion.
 */
export async function syncSlackUsers(orgId: string, slackTeamId: string): Promise<number> {
  const supabase = createAdminClient();
  let synced = 0;

  try {
    const { getSlackUsers } = await import('@/lib/integrations/composio-tools');
    const result = await getSlackUsers(orgId);
    const members = result?.data?.members ?? result?.members ?? result?.data ?? [];

    if (!Array.isArray(members)) return 0;

    for (const member of members) {
      if (!member.id) continue;

      await supabase
        .from('slack_user_mappings')
        .upsert({
          org_id: orgId,
          slack_team_id: slackTeamId,
          slack_user_id: member.id,
          slack_username: member.name ?? null,
          slack_display_name: member.real_name ?? member.profile?.real_name ?? null,
          email: member.profile?.email ?? null,
          is_bot: member.is_bot ?? false,
        }, { onConflict: 'slack_team_id,slack_user_id' });

      synced++;
    }
  } catch (err) {
    console.error(`[SlackUserMapping] Bulk sync failed for org ${orgId}:`, err);
  }

  return synced;
}

/**
 * Get all Slack user mappings for an org.
 */
export async function getOrgSlackUsers(orgId: string): Promise<SlackUserMapping[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('slack_user_mappings')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_bot', false)
    .order('slack_display_name');

  if (!data) return [];

  return data.map(row => ({
    orgId: row.org_id,
    slackTeamId: row.slack_team_id,
    slackUserId: row.slack_user_id,
    slackUsername: row.slack_username,
    slackDisplayName: row.slack_display_name,
    pivotUserId: row.pivot_user_id,
    email: row.email,
    isBot: row.is_bot ?? false,
  }));
}
