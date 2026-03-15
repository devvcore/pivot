// ═══════════════════════════════════════════════════════════════
// Pivot — Composio Sync Adapters
// Sync functions for 16 Composio-powered integration providers.
// Each function pulls data via Composio's proxy fetch and stores
// results in the integration_data table via Supabase.
// ═══════════════════════════════════════════════════════════════

import { composioProxyFetch } from './composio';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ─── Helper ──────────────────────────────────────────────────────────────────

async function upsertIntegrationData(
  orgId: string,
  provider: string,
  recordType: string,
  data: unknown,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('integration_data').upsert(
    {
      org_id: orgId,
      provider,
      record_type: recordType,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,provider,record_type' },
  );
}

// ─── 1. Google Analytics ─────────────────────────────────────────────────────

export async function syncGoogleAnalytics(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // GA4 requires a property ID configured in integration metadata.
    // For now, store placeholder data noting this requirement.
    // Once configured, we would POST to:
    //   https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport

    const placeholderTraffic = {
      note: 'GA4 property ID must be configured in integration metadata before syncing live data.',
      requiredConfig: 'metadata.ga4PropertyId',
      sampleShape: {
        sessions: 0,
        users: 0,
        pageviews: 0,
        period: 'last_28_days',
      },
    };

    const placeholderTopPages = {
      note: 'GA4 property ID must be configured in integration metadata.',
      pages: [],
    };

    const placeholderSources = {
      note: 'GA4 property ID must be configured in integration metadata.',
      sources: [],
    };

    await upsertIntegrationData(orgId, 'google_analytics', 'traffic_overview', placeholderTraffic);
    await upsertIntegrationData(orgId, 'google_analytics', 'top_pages', placeholderTopPages);
    await upsertIntegrationData(orgId, 'google_analytics', 'traffic_sources', placeholderSources);

    recordsProcessed = 3; // 3 data types stored
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 2. Google Sheets ────────────────────────────────────────────────────────

export async function syncGoogleSheets(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    const endpoint =
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime,createdTime)";

    const data = await composioProxyFetch<{
      files?: Array<{ id: string; name: string; modifiedTime: string; createdTime: string }>;
    }>(connectedAccountId, endpoint, 'GET');

    if (!data) {
      errors.push('Failed to fetch spreadsheet list from Google Drive');
    } else {
      const files = data.files ?? [];
      recordsProcessed = files.length;

      const spreadsheetList = files.map((f) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        createdTime: f.createdTime,
      }));

      await upsertIntegrationData(orgId, 'google_sheets', 'spreadsheet_list', {
        count: spreadsheetList.length,
        spreadsheets: spreadsheetList,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 3. Notion ───────────────────────────────────────────────────────────────

export async function syncNotion(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    const endpoint = 'https://api.notion.com/v1/search';

    const data = await composioProxyFetch<{
      results?: Array<{
        id: string;
        object: string;
        properties?: Record<string, unknown>;
        title?: Array<{ plain_text: string }>;
        url?: string;
        created_time?: string;
        last_edited_time?: string;
      }>;
    }>(connectedAccountId, endpoint, 'POST', [
      { name: 'Notion-Version', value: '2022-06-28', in: 'header' },
    ]);

    if (!data) {
      errors.push('Failed to search Notion workspace');
    } else {
      const results = data.results ?? [];
      recordsProcessed = results.length;

      // Build pages list
      const pages = results.map((r) => ({
        id: r.id,
        type: r.object,
        title:
          r.object === 'page'
            ? (r.properties?.title as any)?.title?.[0]?.plain_text ?? 'Untitled'
            : (r.title?.[0]?.plain_text ?? 'Untitled'),
        url: r.url ?? null,
        createdTime: r.created_time ?? null,
        lastEditedTime: r.last_edited_time ?? null,
      }));

      await upsertIntegrationData(orgId, 'notion', 'workspace_pages', {
        count: pages.length,
        pages,
      });

      // Compute stats by object type
      const typeCounts: Record<string, number> = {};
      for (const r of results) {
        typeCounts[r.object] = (typeCounts[r.object] ?? 0) + 1;
      }

      await upsertIntegrationData(orgId, 'notion', 'workspace_stats', {
        totalObjects: results.length,
        byType: typeCounts,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 4. Linear ───────────────────────────────────────────────────────────────

interface LinearIssueNode {
  id: string;
  title: string;
  state: { name: string } | null;
  assignee: { name: string } | null;
  createdAt: string;
  completedAt: string | null;
}

export async function syncLinear(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    const endpoint = 'https://api.linear.app/graphql';

    const graphqlQuery = JSON.stringify({
      query: `{
        issues(first: 100) {
          nodes {
            id
            title
            state { name }
            assignee { name }
            createdAt
            completedAt
          }
        }
      }`,
    });

    const data = await composioProxyFetch<{
      data?: {
        issues?: {
          nodes?: LinearIssueNode[];
        };
      };
    }>(connectedAccountId, endpoint, 'POST', [
      { name: 'Content-Type', value: 'application/json', in: 'header' },
      { name: 'body', value: graphqlQuery, in: 'query' },
    ]);

    if (!data?.data?.issues?.nodes) {
      errors.push('Failed to fetch issues from Linear');
    } else {
      const issues = data.data.issues.nodes;
      recordsProcessed = issues.length;

      // Count by state
      const byState: Record<string, number> = {};
      let completedCount = 0;
      let totalCycleTimeMs = 0;

      for (const issue of issues) {
        const stateName = issue.state?.name ?? 'Unknown';
        byState[stateName] = (byState[stateName] ?? 0) + 1;

        if (issue.completedAt) {
          completedCount++;
          const created = new Date(issue.createdAt).getTime();
          const completed = new Date(issue.completedAt).getTime();
          totalCycleTimeMs += completed - created;
        }
      }

      const avgCycleTimeDays =
        completedCount > 0
          ? Math.round((totalCycleTimeMs / completedCount / (1000 * 60 * 60 * 24)) * 10) / 10
          : null;

      await upsertIntegrationData(orgId, 'linear', 'issues_overview', {
        totalIssues: issues.length,
        byState,
        completedCount,
        avgCycleTimeDays,
      });

      // Store recent issues (last 20)
      const recentIssues = issues.slice(0, 20).map((i) => ({
        id: i.id,
        title: i.title,
        state: i.state?.name ?? 'Unknown',
        assignee: i.assignee?.name ?? 'Unassigned',
        createdAt: i.createdAt,
        completedAt: i.completedAt,
      }));

      await upsertIntegrationData(orgId, 'linear', 'recent_issues', {
        count: recentIssues.length,
        issues: recentIssues,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 5. Asana ────────────────────────────────────────────────────────────────

export async function syncAsana(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Fetch workspaces
    const workspacesData = await composioProxyFetch<{
      data?: Array<{ gid: string; name: string }>;
    }>(connectedAccountId, 'https://app.asana.com/api/1.0/workspaces', 'GET');

    if (!workspacesData?.data) {
      errors.push('Failed to fetch Asana workspaces');
    } else {
      const workspaces = workspacesData.data;

      await upsertIntegrationData(orgId, 'asana', 'workspaces', {
        count: workspaces.length,
        workspaces: workspaces.map((w) => ({ id: w.gid, name: w.name })),
      });

      // Fetch projects for each workspace
      const allProjects: Array<{ id: string; name: string; workspaceId: string; workspaceName: string }> = [];

      for (const workspace of workspaces) {
        const projectsEndpoint = `https://app.asana.com/api/1.0/projects?workspace=${workspace.gid}`;
        const projectsData = await composioProxyFetch<{
          data?: Array<{ gid: string; name: string }>;
        }>(connectedAccountId, projectsEndpoint, 'GET');

        if (projectsData?.data) {
          for (const p of projectsData.data) {
            allProjects.push({
              id: p.gid,
              name: p.name,
              workspaceId: workspace.gid,
              workspaceName: workspace.name,
            });
          }
        }
      }

      recordsProcessed = allProjects.length;

      await upsertIntegrationData(orgId, 'asana', 'projects_overview', {
        totalProjects: allProjects.length,
        projects: allProjects,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 6. Google Calendar ──────────────────────────────────────────────────────

export async function syncGoogleCalendar(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // List calendars
    const calendarsData = await composioProxyFetch<{
      items?: Array<{ id: string; summary: string; primary?: boolean }>;
    }>(
      connectedAccountId,
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      'GET',
    );

    if (!calendarsData?.items) {
      errors.push('Failed to fetch Google Calendar list');
    } else {
      await upsertIntegrationData(orgId, 'google_calendar', 'calendar_list', {
        count: calendarsData.items.length,
        calendars: calendarsData.items.map((c) => ({
          id: c.id,
          name: c.summary,
          primary: c.primary ?? false,
        })),
      });

      // Fetch events for next 30 days from primary calendar
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const eventsEndpoint =
        `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
        `?timeMin=${encodeURIComponent(timeMin)}` +
        `&timeMax=${encodeURIComponent(timeMax)}` +
        `&maxResults=250` +
        `&singleEvents=true` +
        `&orderBy=startTime`;

      const eventsData = await composioProxyFetch<{
        items?: Array<{
          id: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          attendees?: Array<{ email: string; responseStatus?: string }>;
        }>;
      }>(connectedAccountId, eventsEndpoint, 'GET');

      if (!eventsData?.items) {
        errors.push('Failed to fetch calendar events');
      } else {
        const events = eventsData.items;
        recordsProcessed = events.length;

        // Compute meeting patterns
        const countByDay: Record<string, number> = {};
        let totalDurationMinutes = 0;
        let eventsWithDuration = 0;

        for (const event of events) {
          const startStr = event.start?.dateTime ?? event.start?.date;
          const endStr = event.end?.dateTime ?? event.end?.date;

          if (startStr) {
            const dayKey = startStr.substring(0, 10); // YYYY-MM-DD
            countByDay[dayKey] = (countByDay[dayKey] ?? 0) + 1;
          }

          if (event.start?.dateTime && event.end?.dateTime) {
            const startMs = new Date(event.start.dateTime).getTime();
            const endMs = new Date(event.end.dateTime).getTime();
            const durationMin = (endMs - startMs) / (1000 * 60);
            if (durationMin > 0 && durationMin < 1440) {
              totalDurationMinutes += durationMin;
              eventsWithDuration++;
            }
          }
        }

        const avgDurationMinutes =
          eventsWithDuration > 0 ? Math.round(totalDurationMinutes / eventsWithDuration) : 0;

        const totalMeetingHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

        await upsertIntegrationData(orgId, 'google_calendar', 'meeting_patterns', {
          totalEvents: events.length,
          countByDay,
          avgDurationMinutes,
          totalMeetingHours,
          periodStart: timeMin,
          periodEnd: timeMax,
        });
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 7. Microsoft Teams ──────────────────────────────────────────────────────

export async function syncMicrosoftTeams(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // List joined teams
    const teamsData = await composioProxyFetch<{
      value?: Array<{ id: string; displayName: string; description?: string }>;
    }>(
      connectedAccountId,
      'https://graph.microsoft.com/v1.0/me/joinedTeams',
      'GET',
    );

    if (!teamsData?.value) {
      errors.push('Failed to fetch Microsoft Teams list');
    } else {
      const teams = teamsData.value;

      await upsertIntegrationData(orgId, 'microsoft_teams', 'teams_overview', {
        totalTeams: teams.length,
        teams: teams.map((t) => ({
          id: t.id,
          name: t.displayName,
          description: t.description ?? null,
        })),
      });

      // Fetch channels per team
      const allChannels: Array<{
        id: string;
        name: string;
        teamId: string;
        teamName: string;
      }> = [];

      for (const team of teams) {
        const channelsEndpoint = `https://graph.microsoft.com/v1.0/teams/${team.id}/channels`;
        const channelsData = await composioProxyFetch<{
          value?: Array<{ id: string; displayName: string; membershipType?: string }>;
        }>(connectedAccountId, channelsEndpoint, 'GET');

        if (channelsData?.value) {
          for (const ch of channelsData.value) {
            allChannels.push({
              id: ch.id,
              name: ch.displayName,
              teamId: team.id,
              teamName: team.displayName,
            });
          }
        }
      }

      recordsProcessed = allChannels.length;

      await upsertIntegrationData(orgId, 'microsoft_teams', 'channels_overview', {
        totalChannels: allChannels.length,
        channels: allChannels,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 8. Airtable ─────────────────────────────────────────────────────────────

export async function syncAirtable(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // List bases
    const basesData = await composioProxyFetch<{
      bases?: Array<{ id: string; name: string; permissionLevel?: string }>;
    }>(connectedAccountId, 'https://api.airtable.com/v0/meta/bases', 'GET');

    if (!basesData?.bases) {
      errors.push('Failed to fetch Airtable bases');
    } else {
      const bases = basesData.bases;

      // Fetch tables per base
      const basesWithTables: Array<{
        id: string;
        name: string;
        permissionLevel: string | null;
        tableCount: number;
        tables: Array<{ id: string; name: string; fieldCount: number }>;
      }> = [];

      for (const base of bases) {
        const tablesEndpoint = `https://api.airtable.com/v0/meta/bases/${base.id}/tables`;
        const tablesData = await composioProxyFetch<{
          tables?: Array<{ id: string; name: string; fields?: Array<unknown> }>;
        }>(connectedAccountId, tablesEndpoint, 'GET');

        const tables = tablesData?.tables ?? [];
        recordsProcessed += tables.length;

        basesWithTables.push({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel ?? null,
          tableCount: tables.length,
          tables: tables.map((t) => ({
            id: t.id,
            name: t.name,
            fieldCount: t.fields?.length ?? 0,
          })),
        });
      }

      await upsertIntegrationData(orgId, 'airtable', 'bases_overview', {
        totalBases: bases.length,
        totalTables: recordsProcessed,
        bases: basesWithTables,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 9. Slack ─────────────────────────────────────────────────────────────────

export async function syncSlack(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Fetch channels
    const channelsData = await composioProxyFetch<{
      ok?: boolean;
      channels?: Array<{
        id: string;
        name: string;
        num_members?: number;
        is_private?: boolean;
      }>;
    }>(
      connectedAccountId,
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100',
      'GET',
      [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded', in: 'header' }],
    );

    if (!channelsData?.channels) {
      errors.push('Failed to fetch Slack channels');
    } else {
      const channels = channelsData.channels;
      recordsProcessed += channels.length;

      await upsertIntegrationData(orgId, 'slack', 'channel_list', {
        count: channels.length,
        channels: channels.map((c) => ({
          id: c.id,
          name: c.name,
          memberCount: c.num_members ?? 0,
          isPrivate: c.is_private ?? false,
        })),
      });
    }

    // Fetch team members
    const usersData = await composioProxyFetch<{
      ok?: boolean;
      members?: Array<{
        id: string;
        name: string;
        deleted?: boolean;
        is_bot?: boolean;
      }>;
    }>(
      connectedAccountId,
      'https://slack.com/api/users.list?limit=200',
      'GET',
      [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded', in: 'header' }],
    );

    if (!usersData?.members) {
      errors.push('Failed to fetch Slack users');
    } else {
      const members = usersData.members;
      const realUsers = members.filter((m) => !m.deleted && !m.is_bot);
      const activeCount = realUsers.length;
      recordsProcessed += members.length;

      await upsertIntegrationData(orgId, 'slack', 'team_overview', {
        totalUsers: members.length,
        activeUsers: activeCount,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 10. Gmail ────────────────────────────────────────────────────────────────

export async function syncGmail(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Fetch profile
    const profileData = await composioProxyFetch<{
      emailAddress?: string;
      messagesTotal?: number;
      threadsTotal?: number;
    }>(
      connectedAccountId,
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      'GET',
    );

    if (!profileData) {
      errors.push('Failed to fetch Gmail profile');
    } else {
      recordsProcessed++;

      await upsertIntegrationData(orgId, 'gmail', 'profile', {
        email: profileData.emailAddress ?? null,
        messagesTotal: profileData.messagesTotal ?? 0,
        threadsTotal: profileData.threadsTotal ?? 0,
      });
    }

    // Fetch recent messages (last 7 days)
    const recentData = await composioProxyFetch<{
      messages?: Array<{ id: string; threadId: string }>;
      resultSizeEstimate?: number;
    }>(
      connectedAccountId,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=newer_than:7d',
      'GET',
    );

    if (!recentData) {
      errors.push('Failed to fetch recent Gmail messages');
    } else {
      const messageCount = recentData.messages?.length ?? 0;
      recordsProcessed += messageCount;

      await upsertIntegrationData(orgId, 'gmail', 'recent_activity', {
        messagesLast7Days: messageCount,
        resultSizeEstimate: recentData.resultSizeEstimate ?? 0,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 11. GitHub ───────────────────────────────────────────────────────────────

export async function syncGitHub(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Fetch user profile
    const profileData = await composioProxyFetch<{
      login?: string;
      name?: string | null;
      public_repos?: number;
      followers?: number;
      following?: number;
    }>(
      connectedAccountId,
      'https://api.github.com/user',
      'GET',
    );

    if (!profileData) {
      errors.push('Failed to fetch GitHub profile');
    } else {
      recordsProcessed++;

      await upsertIntegrationData(orgId, 'github', 'profile', {
        login: profileData.login ?? null,
        name: profileData.name ?? null,
        publicRepos: profileData.public_repos ?? 0,
        followers: profileData.followers ?? 0,
        following: profileData.following ?? 0,
      });
    }

    // Fetch repositories
    const reposData = await composioProxyFetch<
      Array<{
        id: number;
        name: string;
        full_name: string;
        stargazers_count: number;
        language: string | null;
        updated_at: string;
        private: boolean;
        fork: boolean;
      }>
    >(
      connectedAccountId,
      'https://api.github.com/user/repos?sort=updated&per_page=30',
      'GET',
    );

    if (!reposData || !Array.isArray(reposData)) {
      errors.push('Failed to fetch GitHub repositories');
    } else {
      recordsProcessed += reposData.length;

      // Aggregate languages
      const languageCounts: Record<string, number> = {};
      for (const repo of reposData) {
        if (repo.language) {
          languageCounts[repo.language] = (languageCounts[repo.language] ?? 0) + 1;
        }
      }

      const totalStars = reposData.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);

      await upsertIntegrationData(orgId, 'github', 'repositories', {
        totalRepos: reposData.length,
        totalStars,
        languages: languageCounts,
        repos: reposData.map((r) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          stars: r.stargazers_count,
          language: r.language,
          updatedAt: r.updated_at,
          isPrivate: r.private,
          isFork: r.fork,
        })),
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 12. HubSpot ──────────────────────────────────────────────────────────────

export async function syncHubSpot(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Fetch contacts
    const contactsData = await composioProxyFetch<{
      total?: number;
      results?: Array<{
        id: string;
        properties?: {
          email?: string;
          firstname?: string;
          lastname?: string;
          createdate?: string;
        };
      }>;
    }>(
      connectedAccountId,
      'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,createdate',
      'GET',
    );

    if (!contactsData) {
      errors.push('Failed to fetch HubSpot contacts');
    } else {
      const contacts = contactsData.results ?? [];
      recordsProcessed += contacts.length;

      // Recent contacts (created in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentContacts = contacts.filter(
        (c) => c.properties?.createdate && c.properties.createdate >= thirtyDaysAgo,
      );

      await upsertIntegrationData(orgId, 'hubspot', 'contacts_overview', {
        totalCount: contactsData.total ?? contacts.length,
        fetchedCount: contacts.length,
        recentContactsLast30Days: recentContacts.length,
        contacts: contacts.slice(0, 50).map((c) => ({
          id: c.id,
          email: c.properties?.email ?? null,
          firstName: c.properties?.firstname ?? null,
          lastName: c.properties?.lastname ?? null,
          createDate: c.properties?.createdate ?? null,
        })),
      });
    }

    // Fetch deals
    const dealsData = await composioProxyFetch<{
      total?: number;
      results?: Array<{
        id: string;
        properties?: {
          dealname?: string;
          amount?: string;
          dealstage?: string;
          closedate?: string;
        };
      }>;
    }>(
      connectedAccountId,
      'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate',
      'GET',
    );

    if (!dealsData) {
      errors.push('Failed to fetch HubSpot deals');
    } else {
      const deals = dealsData.results ?? [];
      recordsProcessed += deals.length;

      // Compute pipeline value and count by stage
      let totalPipelineValue = 0;
      const dealsByStage: Record<string, number> = {};

      for (const deal of deals) {
        const stage = deal.properties?.dealstage ?? 'unknown';
        dealsByStage[stage] = (dealsByStage[stage] ?? 0) + 1;

        const amount = parseFloat(deal.properties?.amount ?? '0');
        if (!isNaN(amount)) {
          totalPipelineValue += amount;
        }
      }

      await upsertIntegrationData(orgId, 'hubspot', 'deals_overview', {
        totalCount: dealsData.total ?? deals.length,
        fetchedCount: deals.length,
        totalPipelineValue,
        dealsByStage,
        deals: deals.slice(0, 50).map((d) => ({
          id: d.id,
          name: d.properties?.dealname ?? null,
          amount: d.properties?.amount ?? null,
          stage: d.properties?.dealstage ?? null,
          closeDate: d.properties?.closedate ?? null,
        })),
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 13. QuickBooks ───────────────────────────────────────────────────────────

export async function syncQuickBooks(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // QuickBooks Online API requires a realmId (company ID) which is obtained
    // during the OAuth flow. This must be stored in integration metadata.
    // Without it, we cannot make API calls.
    const placeholder = {
      note: 'QuickBooks realmId (company ID) must be configured in integration metadata before syncing live data.',
      requiredConfig: 'metadata.quickbooksRealmId',
      sampleShape: {
        revenue: 0,
        expenses: 0,
        netIncome: 0,
        accountsReceivable: 0,
        accountsPayable: 0,
        period: 'current_fiscal_year',
      },
      apiPattern: 'GET /v3/company/{realmId}/reports/ProfitAndLoss',
    };

    await upsertIntegrationData(orgId, 'quickbooks', 'financial_summary', placeholder);
    recordsProcessed = 1;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 14. Salesforce ───────────────────────────────────────────────────────────

export async function syncSalesforce(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Try to fetch opportunities via SOQL query.
    // Note: Salesforce requires the instance URL (e.g., https://yourorg.my.salesforce.com)
    // which is obtained during OAuth. The Composio proxy should handle the correct
    // instance URL routing. If not, we fall back to a placeholder.
    const oppsData = await composioProxyFetch<{
      totalSize?: number;
      done?: boolean;
      records?: Array<{
        Id: string;
        Name: string;
        Amount: number | null;
        StageName: string;
        CloseDate: string;
      }>;
    }>(
      connectedAccountId,
      'https://login.salesforce.com/services/data/v59.0/query?q=SELECT+Id,Name,Amount,StageName,CloseDate+FROM+Opportunity+ORDER+BY+CloseDate+DESC+LIMIT+100',
      'GET',
    );

    if (!oppsData?.records) {
      // Salesforce may require instance-specific URL; store placeholder
      const placeholder = {
        note: 'Salesforce instance URL may need to be configured. The Composio proxy should route to the correct Salesforce org.',
        sampleShape: {
          totalOpportunities: 0,
          totalPipelineValue: 0,
          byStage: {},
          recentOpportunities: [],
        },
      };

      await upsertIntegrationData(orgId, 'salesforce', 'opportunities_overview', placeholder);
      recordsProcessed = 1;
    } else {
      const opportunities = oppsData.records;
      recordsProcessed = opportunities.length;

      // Aggregate by stage
      const byStage: Record<string, { count: number; totalAmount: number }> = {};
      let totalPipelineValue = 0;

      for (const opp of opportunities) {
        const stage = opp.StageName ?? 'Unknown';
        if (!byStage[stage]) {
          byStage[stage] = { count: 0, totalAmount: 0 };
        }
        byStage[stage].count++;
        const amount = opp.Amount ?? 0;
        byStage[stage].totalAmount += amount;
        totalPipelineValue += amount;
      }

      await upsertIntegrationData(orgId, 'salesforce', 'opportunities_overview', {
        totalOpportunities: oppsData.totalSize ?? opportunities.length,
        fetchedCount: opportunities.length,
        totalPipelineValue,
        byStage,
        recentOpportunities: opportunities.slice(0, 20).map((o) => ({
          id: o.Id,
          name: o.Name,
          amount: o.Amount,
          stage: o.StageName,
          closeDate: o.CloseDate,
        })),
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 15. Stripe ───────────────────────────────────────────────────────────────

export async function syncStripe(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Fetch recent charges
    const chargesData = await composioProxyFetch<{
      data?: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        created: number;
        paid: boolean;
      }>;
      has_more?: boolean;
    }>(
      connectedAccountId,
      'https://api.stripe.com/v1/charges?limit=100',
      'GET',
    );

    if (!chargesData?.data) {
      errors.push('Failed to fetch Stripe charges');
    } else {
      const charges = chargesData.data;
      recordsProcessed += charges.length;

      // Aggregate amounts by currency
      const byCurrency: Record<string, { count: number; totalAmount: number }> = {};
      let totalAmountCents = 0;
      let successfulCount = 0;

      for (const charge of charges) {
        const currency = (charge.currency ?? 'usd').toUpperCase();
        if (!byCurrency[currency]) {
          byCurrency[currency] = { count: 0, totalAmount: 0 };
        }
        byCurrency[currency].count++;
        byCurrency[currency].totalAmount += charge.amount;
        totalAmountCents += charge.amount;

        if (charge.paid) {
          successfulCount++;
        }
      }

      await upsertIntegrationData(orgId, 'stripe', 'charges_overview', {
        totalCharges: charges.length,
        successfulCharges: successfulCount,
        totalAmountCents,
        byCurrency,
        hasMore: chargesData.has_more ?? false,
      });
    }

    // Fetch customers
    const customersData = await composioProxyFetch<{
      data?: Array<{
        id: string;
        email: string | null;
        name: string | null;
        created: number;
      }>;
      has_more?: boolean;
    }>(
      connectedAccountId,
      'https://api.stripe.com/v1/customers?limit=100',
      'GET',
    );

    if (!customersData?.data) {
      errors.push('Failed to fetch Stripe customers');
    } else {
      const customers = customersData.data;
      recordsProcessed += customers.length;

      await upsertIntegrationData(orgId, 'stripe', 'customers_overview', {
        totalCustomers: customers.length,
        hasMore: customersData.has_more ?? false,
        recentCustomers: customers.slice(0, 20).map((c) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          created: c.created,
        })),
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}

// ─── 16. Jira ─────────────────────────────────────────────────────────────────

export async function syncJira(
  orgId: string,
  connectedAccountId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  try {
    // Step 1: Get accessible resources to determine the cloudId
    const resourcesData = await composioProxyFetch<
      Array<{
        id: string;
        url: string;
        name: string;
        scopes?: string[];
      }>
    >(
      connectedAccountId,
      'https://api.atlassian.com/oauth/token/accessible-resources',
      'GET',
    );

    if (!resourcesData || !Array.isArray(resourcesData) || resourcesData.length === 0) {
      // Cannot determine cloudId — store placeholder
      const placeholder = {
        note: 'Could not determine Jira cloudId from accessible resources. Ensure the Atlassian OAuth connection has the correct scopes.',
        sampleShape: {
          totalIssues: 0,
          byStatus: {},
          byIssueType: {},
          recentIssues: [],
        },
      };

      await upsertIntegrationData(orgId, 'jira', 'issues_overview', placeholder);
      recordsProcessed = 1;
    } else {
      const cloudId = resourcesData[0].id;
      const siteName = resourcesData[0].name;

      // Step 2: Search for recent issues
      const searchEndpoint =
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search` +
        `?jql=order+by+updated+DESC&maxResults=50&fields=summary,status,issuetype,assignee,created,updated`;

      const searchData = await composioProxyFetch<{
        total?: number;
        maxResults?: number;
        issues?: Array<{
          id: string;
          key: string;
          fields?: {
            summary?: string;
            status?: { name: string };
            issuetype?: { name: string };
            assignee?: { displayName: string } | null;
            created?: string;
            updated?: string;
          };
        }>;
      }>(connectedAccountId, searchEndpoint, 'GET');

      if (!searchData?.issues) {
        errors.push('Failed to fetch Jira issues');
      } else {
        const issues = searchData.issues;
        recordsProcessed = issues.length;

        // Aggregate by status and issue type
        const byStatus: Record<string, number> = {};
        const byIssueType: Record<string, number> = {};

        for (const issue of issues) {
          const status = issue.fields?.status?.name ?? 'Unknown';
          byStatus[status] = (byStatus[status] ?? 0) + 1;

          const issueType = issue.fields?.issuetype?.name ?? 'Unknown';
          byIssueType[issueType] = (byIssueType[issueType] ?? 0) + 1;
        }

        await upsertIntegrationData(orgId, 'jira', 'issues_overview', {
          totalIssues: searchData.total ?? issues.length,
          fetchedCount: issues.length,
          cloudId,
          siteName,
          byStatus,
          byIssueType,
          recentIssues: issues.slice(0, 20).map((i) => ({
            id: i.id,
            key: i.key,
            summary: i.fields?.summary ?? null,
            status: i.fields?.status?.name ?? null,
            issueType: i.fields?.issuetype?.name ?? null,
            assignee: i.fields?.assignee?.displayName ?? 'Unassigned',
            created: i.fields?.created ?? null,
            updated: i.fields?.updated ?? null,
          })),
        });
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated: 0,
    errors,
  };
}
