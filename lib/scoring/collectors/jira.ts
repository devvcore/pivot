// ================================================================
// Pivot -- Jira Score Collector
// Extracts per-employee metrics from Jira integration data
// and maps them to scoring dimensions.
// ================================================================

import { createAdminClient } from '@/lib/supabase/admin';

import type { CollectorResult } from './index';

// ── Time-weight buckets (30-day rolling) ────────────────────────

function getTimeWeight(dateStr: string): number {
  const now = Date.now();
  const eventTime = new Date(dateStr).getTime();
  const daysAgo = (now - eventTime) / (1000 * 60 * 60 * 24);

  if (daysAgo <= 7) return 3;
  if (daysAgo <= 14) return 2;
  if (daysAgo <= 30) return 1;
  return 0;
}

function weightedAverage(values: { value: number; weight: number }[]): number | null {
  const valid = values.filter((v) => v.weight > 0);
  if (valid.length === 0) return null;

  const totalWeight = valid.reduce((sum, v) => sum + v.weight, 0);
  const weightedSum = valid.reduce((sum, v) => sum + v.value * v.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ── Types for Jira data stored in integration_data ──────────────

interface JiraIssueRecord {
  key?: string;
  summary?: string;
  status?: string;
  statusCategory?: string; // 'new' | 'indeterminate' | 'done'
  assignee?: string;
  reporter?: string;
  priority?: string;
  type?: string; // Bug, Story, Task, etc.
  labels?: string[];
  created?: string;
  updated?: string;
  resolved?: string;
  storyPoints?: number;
  sprintName?: string;
  epicKey?: string;
  epicName?: string;
  timeEstimate?: number; // seconds
  timeSpent?: number; // seconds
  dueDate?: string;
  projectKey?: string;
}

interface JiraComment {
  issueKey?: string;
  author?: string;
  created?: string;
  body?: string;
  isInternal?: boolean;
}

// ── Collector ───────────────────────────────────────────────────

export async function collectJiraMetrics(
  employeeId: string,
  orgId: string,
): Promise<CollectorResult> {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Look up the employee's name and email for matching
  const { data: employee } = await supabase
    .from('employees')
    .select('name, email')
    .eq('id', employeeId)
    .single();

  if (!employee) {
    return {
      source: 'jira',
      dimensions: {
        responsiveness: null,
        outputVolume: null,
        qualitySignal: null,
        collaboration: null,
        reliability: null,
      },
    };
  }

  const employeeName = employee.name?.toLowerCase() ?? '';
  const employeeEmail = employee.email?.toLowerCase() ?? '';

  // 2. Fetch integration_data for Jira within this org
  //    Jira stores data with provider='jira' and data_type='issues', 'sprint_metrics', etc.
  const { data: integrationRows } = await supabase
    .from('integration_data')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'jira')
    .gte('synced_at', thirtyDaysAgo);

  const allData = integrationRows ?? [];

  // Parse issues from stored data
  const allIssues: JiraIssueRecord[] = [];
  let sprintMetrics: any = null;

  for (const row of allData) {
    const data = row.data ?? {};
    const dataType = row.record_type ?? row.data_type ?? '';

    if (dataType === 'issues') {
      const items: JiraIssueRecord[] = Array.isArray(data)
        ? data
        : (data.issues ?? []);
      allIssues.push(...items);
    } else if (dataType === 'sprint_metrics') {
      sprintMetrics = data;
    }
  }

  // Filter issues assigned to or reported by this employee
  const myIssues = allIssues.filter((issue) => {
    const assignee = (issue.assignee ?? '').toLowerCase();
    const reporter = (issue.reporter ?? '').toLowerCase();
    return (
      assignee === employeeName ||
      assignee === employeeEmail ||
      assignee.includes(employeeName) ||
      reporter === employeeName ||
      reporter === employeeEmail
    );
  });

  const assignedIssues = allIssues.filter((issue) => {
    const assignee = (issue.assignee ?? '').toLowerCase();
    return (
      assignee === employeeName ||
      assignee === employeeEmail ||
      assignee.includes(employeeName)
    );
  });

  if (assignedIssues.length === 0 && myIssues.length === 0) {
    return {
      source: 'jira',
      dimensions: {
        responsiveness: null,
        outputVolume: null,
        qualitySignal: null,
        collaboration: null,
        reliability: null,
      },
    };
  }

  // ── Responsiveness: comment response time on assigned issues ───

  // We don't have direct comment data in most cases, but we can check
  // issue update frequency as a proxy for responsiveness
  let responsiveness: number | null = null;

  const issuesWithUpdates = assignedIssues.filter(
    (i) => i.updated && i.created,
  );
  if (issuesWithUpdates.length > 0) {
    const responseScores = issuesWithUpdates.map((issue) => {
      const created = new Date(issue.created!).getTime();
      const updated = new Date(issue.updated!).getTime();
      const hoursBetween = (updated - created) / (1000 * 60 * 60);

      // First update speed as a proxy for response time
      let score: number;
      if (hoursBetween <= 1) score = 95;
      else if (hoursBetween <= 4) score = 80;
      else if (hoursBetween <= 8) score = 65;
      else if (hoursBetween <= 24) score = 50;
      else if (hoursBetween <= 48) score = 35;
      else score = 20;

      return {
        value: clamp(score),
        weight: getTimeWeight(issue.updated!),
      };
    });
    responsiveness = weightedAverage(responseScores);
  }

  // ── Output Volume: tickets closed ─────────────────────────────

  let outputVolume: number | null = null;
  const closedIssues = assignedIssues.filter(
    (i) =>
      i.statusCategory === 'done' ||
      i.status?.toLowerCase() === 'done' ||
      i.status?.toLowerCase() === 'closed' ||
      i.resolved,
  );

  if (assignedIssues.length > 0) {
    // Group by week for time weighting
    const now = Date.now();
    const weekBuckets: Map<number, number> = new Map();

    for (const issue of closedIssues) {
      const resolvedDate = issue.resolved ?? issue.updated ?? issue.created;
      if (!resolvedDate) continue;
      const daysAgo =
        (now - new Date(resolvedDate).getTime()) / (1000 * 60 * 60 * 24);
      const week = Math.floor(daysAgo / 7);
      const points = (issue.storyPoints ?? 1); // weight by story points if available
      weekBuckets.set(week, (weekBuckets.get(week) ?? 0) + points);
    }

    const volumeEntries: { value: number; weight: number }[] = [];
    for (const [week, points] of weekBuckets) {
      // Normalize: 1-3 points/week = low, 5-10 = medium, 10+ = high
      let score: number;
      if (points >= 15) score = 95;
      else if (points >= 10) score = 80;
      else if (points >= 5) score = 65;
      else if (points >= 2) score = 45;
      else score = 25;

      const daysAgo = week * 7 + 3.5;
      const weight = daysAgo <= 7 ? 3 : daysAgo <= 14 ? 2 : 1;
      volumeEntries.push({ value: clamp(score), weight });
    }

    outputVolume = weightedAverage(volumeEntries);

    // Fallback: if no weeks could be formed
    if (outputVolume === null && closedIssues.length > 0) {
      const totalPoints = closedIssues.reduce(
        (sum, i) => sum + (i.storyPoints ?? 1),
        0,
      );
      if (totalPoints >= 30) outputVolume = 85;
      else if (totalPoints >= 15) outputVolume = 65;
      else if (totalPoints >= 5) outputVolume = 45;
      else outputVolume = 25;
    }
  }

  // ── Quality Signal: bug reopen rate ───────────────────────────

  let qualitySignal: number | null = null;
  const bugIssues = assignedIssues.filter(
    (i) =>
      i.type?.toLowerCase() === 'bug' ||
      i.labels?.some((l) => l.toLowerCase().includes('bug')),
  );

  if (bugIssues.length > 0) {
    // Check for issues that were resolved then reopened (status went back to non-done)
    const resolvedBugs = bugIssues.filter(
      (b) => b.resolved || b.statusCategory === 'done',
    );
    const reopenedBugs = bugIssues.filter(
      (b) =>
        b.resolved &&
        b.statusCategory !== 'done' &&
        b.status?.toLowerCase() !== 'done',
    );

    if (resolvedBugs.length > 0) {
      const reopenRate = reopenedBugs.length / resolvedBugs.length;
      // 0% reopen = 100, 10% = 75, 20% = 50, 40%+ = 20
      const score = Math.max(20, 100 - reopenRate * 200);
      qualitySignal = clamp(score);
    }
  }

  // Also factor in overall issue resolution quality if we have story points
  if (qualitySignal === null && closedIssues.length > 0) {
    // Use completion ratio as a quality proxy
    const completionRatio = closedIssues.length / Math.max(assignedIssues.length, 1);
    qualitySignal = clamp(completionRatio * 100);
  }

  // ── Collaboration: cross-project tickets ──────────────────────

  let collaboration: number | null = null;
  if (myIssues.length > 0) {
    // Count unique projects the employee touches
    const projects = new Set(
      myIssues
        .filter((i) => i.projectKey || i.epicKey)
        .map((i) => i.projectKey ?? i.epicKey ?? ''),
    );
    projects.delete('');

    // Count issues where employee is reporter but not assignee (cross-team contribution)
    const crossTeamIssues = myIssues.filter((issue) => {
      const assignee = (issue.assignee ?? '').toLowerCase();
      const reporter = (issue.reporter ?? '').toLowerCase();
      return (
        (reporter === employeeName || reporter === employeeEmail) &&
        assignee !== employeeName &&
        assignee !== employeeEmail &&
        !assignee.includes(employeeName)
      );
    });

    const projectCount = projects.size;
    const crossTeamCount = crossTeamIssues.length;

    // Score: more projects + cross-team issues = more collaborative
    let score: number;
    const signal = projectCount * 10 + crossTeamCount * 5;
    if (signal >= 40) score = 90;
    else if (signal >= 25) score = 75;
    else if (signal >= 15) score = 60;
    else if (signal >= 5) score = 40;
    else score = 25;

    collaboration = clamp(score);
  }

  // ── Reliability: on-time completion % ─────────────────────────

  let reliability: number | null = null;
  const issuesWithDueDate = assignedIssues.filter(
    (i) => i.dueDate && i.resolved,
  );

  if (issuesWithDueDate.length > 0) {
    const onTimeCount = issuesWithDueDate.filter((issue) => {
      const dueDate = new Date(issue.dueDate!).getTime();
      const resolved = new Date(issue.resolved!).getTime();
      return resolved <= dueDate;
    }).length;

    const onTimeRate = (onTimeCount / issuesWithDueDate.length) * 100;
    reliability = clamp(onTimeRate);
  }

  // Fallback: use sprint completion rate from sprint_metrics if available
  if (reliability === null && sprintMetrics) {
    const teamWorkload = sprintMetrics.teamWorkload as Array<{
      assignee: string;
      openIssues: number;
      storyPoints: number;
    }> | undefined;

    if (teamWorkload) {
      const myWorkload = teamWorkload.find(
        (w) =>
          w.assignee.toLowerCase() === employeeName ||
          w.assignee.toLowerCase() === employeeEmail ||
          w.assignee.toLowerCase().includes(employeeName),
      );

      if (myWorkload && sprintMetrics.completionRate != null) {
        // Use overall sprint completion rate as a baseline
        reliability = clamp(sprintMetrics.completionRate);
      }
    }
  }

  return {
    source: 'jira',
    dimensions: {
      responsiveness,
      outputVolume,
      qualitySignal,
      collaboration,
      reliability,
    },
  };
}
