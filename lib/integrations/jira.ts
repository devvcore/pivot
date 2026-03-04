// ═══════════════════════════════════════════════════════════════
// Pivot — Jira Cloud Integration
// Fetches projects, issues, sprint metrics, and team velocity
// Base: https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/
// Agile: https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/
// Auth: OAuth2
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ─── Jira Types ──────────────────────────────────────────────────────────────

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectType: string;
  style: string;
  lead: string | null;
  description: string | null;
  url: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: 'new' | 'indeterminate' | 'done';
  assignee: string | null;
  reporter: string | null;
  priority: string;
  type: string; // Bug, Story, Task, Epic, etc.
  labels: string[];
  created: string;
  updated: string;
  resolved: string | null;
  storyPoints: number | null;
  sprintName: string | null;
  epicKey: string | null;
  epicName: string | null;
  timeEstimate: number | null; // seconds
  timeSpent: number | null; // seconds
}

export interface JiraSprintMetrics {
  velocity: number; // avg story points per sprint
  completionRate: number; // % of committed items completed
  avgCycleTime: number; // days from start to done
  bugRate: number; // % of issues that are bugs
  currentSprint: {
    name: string;
    startDate: string | null;
    endDate: string | null;
    committed: number;
    completed: number;
    remaining: number;
    storyPointsCommitted: number;
    storyPointsCompleted: number;
  } | null;
  recentSprints: Array<{
    name: string;
    velocity: number;
    completionRate: number;
    startDate: string | null;
    endDate: string | null;
  }>;
  issueTypeDistribution: Record<string, number>;
  teamWorkload: Array<{ assignee: string; openIssues: number; storyPoints: number }>;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

const JIRA_BASE = 'https://api.atlassian.com/ex/jira';

async function jiraFetch<T>(
  accessToken: string,
  cloudId: string,
  path: string,
  apiType: 'rest' | 'agile' = 'rest',
): Promise<T> {
  const base = apiType === 'agile'
    ? `${JIRA_BASE}/${cloudId}/rest/agile/1.0`
    : `${JIRA_BASE}/${cloudId}/rest/api/3`;
  const url = `${base}/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jira API error ${res.status}: ${res.statusText} — ${body}`);
  }

  return res.json();
}

function getJqlDateRange(daysBack: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().split('T')[0];
}

// ─── Fetch Functions ─────────────────────────────────────────────────────────

/**
 * Fetch all accessible projects.
 */
export async function fetchJiraProjects(
  accessToken: string,
  cloudId: string,
): Promise<JiraProject[]> {
  const data = await jiraFetch<any[]>(
    accessToken,
    cloudId,
    'project?expand=lead,description',
  );

  return (data ?? []).map((p: any) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    projectType: p.projectTypeKey || 'software',
    style: p.style || 'classic',
    lead: p.lead?.displayName || null,
    description: p.description || null,
    url: p.self,
  }));
}

/**
 * Fetch issues matching optional filters.
 * Returns up to 100 recently updated issues.
 */
export async function fetchJiraIssues(
  accessToken: string,
  cloudId: string,
  options?: { projectKey?: string; daysBack?: number },
): Promise<JiraIssue[]> {
  const daysBack = options?.daysBack ?? 30;
  const dateStr = getJqlDateRange(daysBack);

  let jql = `updated >= '${dateStr}'`;
  if (options?.projectKey) {
    jql = `project = ${options.projectKey} AND ${jql}`;
  }
  jql += ` ORDER BY updated DESC`;

  const fields = [
    'summary', 'status', 'assignee', 'reporter', 'priority', 'issuetype',
    'labels', 'created', 'updated', 'resolutiondate',
    'customfield_10016', // Story Points (common field ID)
    'sprint', 'epic', 'timeestimate', 'timespent',
  ].join(',');

  const encoded = encodeURIComponent(jql);
  const data = await jiraFetch<{
    issues: any[];
    total: number;
    maxResults: number;
  }>(
    accessToken,
    cloudId,
    `search?jql=${encoded}&maxResults=100&fields=${fields}`,
  );

  return (data.issues ?? []).map((issue: any) => {
    const fields = issue.fields;
    const statusCategory = fields.status?.statusCategory?.key;
    let normalizedCategory: JiraIssue['statusCategory'] = 'indeterminate';
    if (statusCategory === 'new') normalizedCategory = 'new';
    else if (statusCategory === 'done') normalizedCategory = 'done';

    // Sprint can be an array or single value
    const sprint = Array.isArray(fields.sprint)
      ? fields.sprint[fields.sprint.length - 1]
      : fields.sprint;

    return {
      id: issue.id,
      key: issue.key,
      summary: fields.summary || '',
      status: fields.status?.name || 'Unknown',
      statusCategory: normalizedCategory,
      assignee: fields.assignee?.displayName || null,
      reporter: fields.reporter?.displayName || null,
      priority: fields.priority?.name || 'Medium',
      type: fields.issuetype?.name || 'Task',
      labels: fields.labels || [],
      created: fields.created,
      updated: fields.updated,
      resolved: fields.resolutiondate || null,
      storyPoints: fields.customfield_10016 || null,
      sprintName: sprint?.name || null,
      epicKey: fields.epic?.key || null,
      epicName: fields.epic?.name || null,
      timeEstimate: fields.timeestimate || null,
      timeSpent: fields.timespent || null,
    };
  });
}

/**
 * Fetch sprint metrics: velocity, completion rate, cycle time, and bug rate.
 * Uses the Jira Agile API to get board and sprint data.
 */
export async function fetchJiraSprintMetrics(
  accessToken: string,
  cloudId: string,
): Promise<JiraSprintMetrics> {
  // Step 1: Find boards
  const boardsData = await jiraFetch<{
    values: Array<{ id: number; name: string; type: string }>;
  }>(accessToken, cloudId, 'board?maxResults=10', 'agile');

  const scrumBoards = boardsData.values.filter(
    (b) => b.type === 'scrum' || b.type === 'simple',
  );

  if (scrumBoards.length === 0) {
    // No scrum boards, return empty metrics with issue-based data
    const issues = await fetchJiraIssues(accessToken, cloudId, { daysBack: 90 });
    return buildMetricsFromIssues(issues);
  }

  const boardId = scrumBoards[0].id;

  // Step 2: Fetch sprints
  const sprintsData = await jiraFetch<{
    values: Array<{
      id: number;
      name: string;
      state: string;
      startDate?: string;
      endDate?: string;
      completeDate?: string;
    }>;
  }>(accessToken, cloudId, `board/${boardId}/sprint?state=active,closed&maxResults=10`, 'agile');

  const sprints = sprintsData.values || [];
  const activeSprint = sprints.find((s) => s.state === 'active');
  const closedSprints = sprints.filter((s) => s.state === 'closed').slice(-5); // Last 5 closed

  // Step 3: Get issues for each sprint
  const recentSprints: JiraSprintMetrics['recentSprints'] = [];
  const velocities: number[] = [];

  for (const sprint of closedSprints) {
    try {
      const sprintIssues = await jiraFetch<{
        issues: any[];
      }>(
        accessToken,
        cloudId,
        `sprint/${sprint.id}/issue?maxResults=200&fields=status,customfield_10016,issuetype`,
        'agile',
      );

      const issues = sprintIssues.issues || [];
      const done = issues.filter(
        (i: any) => i.fields?.status?.statusCategory?.key === 'done',
      );
      const spDone = done.reduce(
        (sum: number, i: any) => sum + (i.fields?.customfield_10016 || 0),
        0,
      );
      const spTotal = issues.reduce(
        (sum: number, i: any) => sum + (i.fields?.customfield_10016 || 0),
        0,
      );

      velocities.push(spDone);
      recentSprints.push({
        name: sprint.name,
        velocity: spDone,
        completionRate: issues.length > 0 ? (done.length / issues.length) * 100 : 0,
        startDate: sprint.startDate || null,
        endDate: sprint.endDate || sprint.completeDate || null,
      });
    } catch {
      // Skip sprints we can't access
    }
  }

  // Step 4: Current sprint data
  let currentSprint: JiraSprintMetrics['currentSprint'] = null;
  if (activeSprint) {
    try {
      const activeIssues = await jiraFetch<{
        issues: any[];
      }>(
        accessToken,
        cloudId,
        `sprint/${activeSprint.id}/issue?maxResults=200&fields=status,customfield_10016,issuetype`,
        'agile',
      );

      const issues = activeIssues.issues || [];
      const done = issues.filter(
        (i: any) => i.fields?.status?.statusCategory?.key === 'done',
      );
      const inProgress = issues.filter(
        (i: any) => i.fields?.status?.statusCategory?.key === 'indeterminate',
      );

      const spCommitted = issues.reduce(
        (sum: number, i: any) => sum + (i.fields?.customfield_10016 || 0),
        0,
      );
      const spCompleted = done.reduce(
        (sum: number, i: any) => sum + (i.fields?.customfield_10016 || 0),
        0,
      );

      currentSprint = {
        name: activeSprint.name,
        startDate: activeSprint.startDate || null,
        endDate: activeSprint.endDate || null,
        committed: issues.length,
        completed: done.length,
        remaining: issues.length - done.length,
        storyPointsCommitted: spCommitted,
        storyPointsCompleted: spCompleted,
      };
    } catch {
      // Fall through
    }
  }

  // Step 5: Calculate aggregate metrics
  const velocity =
    velocities.length > 0
      ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length
      : 0;

  const completionRate =
    recentSprints.length > 0
      ? recentSprints.reduce((sum, s) => sum + s.completionRate, 0) / recentSprints.length
      : 0;

  // Cycle time: from all recently resolved issues
  const allIssues = await fetchJiraIssues(accessToken, cloudId, { daysBack: 90 });
  const resolved = allIssues.filter((i) => i.resolved);
  let avgCycleTime = 0;
  if (resolved.length > 0) {
    const cycleTimes = resolved.map((i) => {
      const created = new Date(i.created).getTime();
      const resolvedTime = new Date(i.resolved!).getTime();
      return Math.max(0, (resolvedTime - created) / (1000 * 60 * 60 * 24));
    });
    avgCycleTime = cycleTimes.reduce((sum, d) => sum + d, 0) / cycleTimes.length;
  }

  // Bug rate
  const bugs = allIssues.filter(
    (i) => i.type.toLowerCase() === 'bug',
  );
  const bugRate = allIssues.length > 0 ? (bugs.length / allIssues.length) * 100 : 0;

  // Issue type distribution
  const issueTypeDistribution: Record<string, number> = {};
  for (const issue of allIssues) {
    issueTypeDistribution[issue.type] = (issueTypeDistribution[issue.type] || 0) + 1;
  }

  // Team workload
  const workloadMap: Record<string, { openIssues: number; storyPoints: number }> = {};
  for (const issue of allIssues) {
    if (!issue.assignee || issue.statusCategory === 'done') continue;
    if (!workloadMap[issue.assignee]) {
      workloadMap[issue.assignee] = { openIssues: 0, storyPoints: 0 };
    }
    workloadMap[issue.assignee].openIssues++;
    workloadMap[issue.assignee].storyPoints += issue.storyPoints || 0;
  }
  const teamWorkload = Object.entries(workloadMap)
    .map(([assignee, data]) => ({ assignee, ...data }))
    .sort((a, b) => b.storyPoints - a.storyPoints);

  return {
    velocity,
    completionRate,
    avgCycleTime,
    bugRate,
    currentSprint,
    recentSprints,
    issueTypeDistribution,
    teamWorkload,
  };
}

/**
 * Fallback: build metrics from issues alone (no boards available).
 */
function buildMetricsFromIssues(issues: JiraIssue[]): JiraSprintMetrics {
  const resolved = issues.filter((i) => i.resolved);
  let avgCycleTime = 0;
  if (resolved.length > 0) {
    const cycleTimes = resolved.map((i) => {
      const created = new Date(i.created).getTime();
      const resolvedTime = new Date(i.resolved!).getTime();
      return Math.max(0, (resolvedTime - created) / (1000 * 60 * 60 * 24));
    });
    avgCycleTime = cycleTimes.reduce((sum, d) => sum + d, 0) / cycleTimes.length;
  }

  const bugs = issues.filter((i) => i.type.toLowerCase() === 'bug');
  const bugRate = issues.length > 0 ? (bugs.length / issues.length) * 100 : 0;

  const totalSP = issues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const doneSP = resolved.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  const issueTypeDistribution: Record<string, number> = {};
  for (const issue of issues) {
    issueTypeDistribution[issue.type] = (issueTypeDistribution[issue.type] || 0) + 1;
  }

  const workloadMap: Record<string, { openIssues: number; storyPoints: number }> = {};
  for (const issue of issues) {
    if (!issue.assignee || issue.statusCategory === 'done') continue;
    if (!workloadMap[issue.assignee]) {
      workloadMap[issue.assignee] = { openIssues: 0, storyPoints: 0 };
    }
    workloadMap[issue.assignee].openIssues++;
    workloadMap[issue.assignee].storyPoints += issue.storyPoints || 0;
  }
  const teamWorkload = Object.entries(workloadMap)
    .map(([assignee, data]) => ({ assignee, ...data }))
    .sort((a, b) => b.storyPoints - a.storyPoints);

  return {
    velocity: doneSP / 3, // Approximate monthly velocity from 90 days
    completionRate: issues.length > 0 ? (resolved.length / issues.length) * 100 : 0,
    avgCycleTime,
    bugRate,
    currentSprint: null,
    recentSprints: [],
    issueTypeDistribution,
    teamWorkload,
  };
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Orchestrates all Jira fetches, computes metrics, and saves to Supabase.
 */
export async function syncJiraToAnalytics(
  orgId: string,
  accessToken: string,
  cloudId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;
  let insightsGenerated = 0;
  const supabase = createAdminClient();

  const [projectsResult, issuesResult, metricsResult] = await Promise.allSettled([
    fetchJiraProjects(accessToken, cloudId),
    fetchJiraIssues(accessToken, cloudId, { daysBack: 30 }),
    fetchJiraSprintMetrics(accessToken, cloudId),
  ]);

  // Save projects
  if (projectsResult.status === 'fulfilled') {
    const projects = projectsResult.value;
    recordsProcessed += projects.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'jira',
      data_type: 'projects',
      data: { projects, count: projects.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Projects save error: ${error.message}`);
  } else {
    errors.push(`Projects fetch error: ${projectsResult.reason}`);
  }

  // Save issues
  if (issuesResult.status === 'fulfilled') {
    const issues = issuesResult.value;
    recordsProcessed += issues.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'jira',
      data_type: 'issues',
      data: { issues, count: issues.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Issues save error: ${error.message}`);

    // Backlog health insight
    const openIssues = issues.filter((i) => i.statusCategory !== 'done');
    const unassigned = openIssues.filter((i) => !i.assignee);
    if (unassigned.length > 10) {
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'jira',
        insight_type: 'backlog_health',
        subject_name: 'Unassigned Issues',
        data: {
          unassigned: unassigned.length,
          totalOpen: openIssues.length,
          percentage: ((unassigned.length / openIssues.length) * 100).toFixed(1),
          message: `${unassigned.length} open issues have no assignee`,
          severity: unassigned.length > 25 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Backlog insight error: ${insightError.message}`);
      insightsGenerated++;
    }

    // Stale issues insight (open but not updated in 14+ days)
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const staleIssues = openIssues.filter((i) => new Date(i.updated) < twoWeeksAgo);
    if (staleIssues.length > 5) {
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'jira',
        insight_type: 'backlog_health',
        subject_name: 'Stale Issues',
        data: {
          staleCount: staleIssues.length,
          totalOpen: openIssues.length,
          issues: staleIssues.slice(0, 5).map((i) => ({
            key: i.key,
            summary: i.summary,
            status: i.status,
            lastUpdated: i.updated,
          })),
          message: `${staleIssues.length} open issues have not been updated in 14+ days`,
          severity: 'warning',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Stale issue insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Issues fetch error: ${issuesResult.reason}`);
  }

  // Save sprint metrics
  if (metricsResult.status === 'fulfilled') {
    const metrics = metricsResult.value;
    recordsProcessed += 1;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'jira',
      data_type: 'sprint_metrics',
      data: metrics,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Sprint metrics save error: ${error.message}`);

    // Sprint health insights
    const insights: Record<string, unknown>[] = [];
    if (metrics.completionRate < 70 && metrics.recentSprints.length >= 2) {
      insights.push({
        org_id: orgId,
        source: 'jira',
        insight_type: 'sprint_health',
        subject_name: 'Low Sprint Completion',
        data: {
          completionRate: metrics.completionRate,
          velocity: metrics.velocity,
          message: `Sprint completion rate is ${metrics.completionRate.toFixed(1)}%, indicating over-commitment or scope changes`,
          severity: metrics.completionRate < 50 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }
    if (metrics.bugRate > 30) {
      insights.push({
        org_id: orgId,
        source: 'jira',
        insight_type: 'quality_health',
        subject_name: 'High Bug Rate',
        data: {
          bugRate: metrics.bugRate,
          distribution: metrics.issueTypeDistribution,
          message: `${metrics.bugRate.toFixed(1)}% of issues are bugs, indicating potential quality concerns`,
          severity: metrics.bugRate > 50 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }
    if (metrics.avgCycleTime > 14) {
      insights.push({
        org_id: orgId,
        source: 'jira',
        insight_type: 'process_health',
        subject_name: 'Long Cycle Time',
        data: {
          avgCycleTime: metrics.avgCycleTime,
          message: `Average cycle time is ${metrics.avgCycleTime.toFixed(1)} days — consider workflow bottleneck analysis`,
          severity: metrics.avgCycleTime > 30 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
    }

    // Team workload imbalance
    if (metrics.teamWorkload.length >= 3) {
      const maxLoad = metrics.teamWorkload[0].storyPoints;
      const minLoad = metrics.teamWorkload[metrics.teamWorkload.length - 1].storyPoints;
      if (maxLoad > 0 && minLoad > 0 && maxLoad / minLoad > 3) {
        insights.push({
          org_id: orgId,
          source: 'jira',
          insight_type: 'team_health',
          subject_name: 'Workload Imbalance',
          data: {
            maxAssignee: metrics.teamWorkload[0].assignee,
            maxPoints: maxLoad,
            minAssignee: metrics.teamWorkload[metrics.teamWorkload.length - 1].assignee,
            minPoints: minLoad,
            ratio: (maxLoad / minLoad).toFixed(1),
            message: `Workload ratio of ${(maxLoad / minLoad).toFixed(1)}x between team members`,
            severity: 'warning',
          },
          created_at: new Date().toISOString(),
        });
      }
    }

    // Current sprint progress
    if (metrics.currentSprint) {
      const sprint = metrics.currentSprint;
      if (sprint.endDate) {
        const remaining = new Date(sprint.endDate).getTime() - Date.now();
        const totalDuration =
          sprint.startDate
            ? new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()
            : remaining;
        const timeElapsed = totalDuration > 0 ? 1 - remaining / totalDuration : 1;
        const workCompleted =
          sprint.committed > 0 ? sprint.completed / sprint.committed : 0;

        if (timeElapsed > 0.5 && workCompleted < 0.3) {
          insights.push({
            org_id: orgId,
            source: 'jira',
            insight_type: 'sprint_risk',
            subject_name: 'Sprint At Risk',
            data: {
              sprintName: sprint.name,
              timeElapsed: (timeElapsed * 100).toFixed(0),
              workCompleted: (workCompleted * 100).toFixed(0),
              remaining: sprint.remaining,
              message: `${(timeElapsed * 100).toFixed(0)}% of sprint elapsed but only ${(workCompleted * 100).toFixed(0)}% of work completed`,
              severity: 'critical',
            },
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    if (insights.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert(insights);
      if (insightError) errors.push(`Sprint insight error: ${insightError.message}`);
      insightsGenerated += insights.length;
    }
  } else {
    errors.push(`Sprint metrics error: ${metricsResult.reason}`);
  }

  const nextSync = new Date();
  nextSync.setMinutes(nextSync.getMinutes() + 15); // Jira: sync every 15 min

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated,
    errors,
    nextSyncAt: nextSync.toISOString(),
  };
}
