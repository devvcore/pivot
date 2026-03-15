// ================================================================
// Pivot -- GitHub Score Collector
// Extracts per-employee metrics from GitHub integration data
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

// ── Types for GitHub data stored in integration_data ────────────

interface GitHubCommit {
  sha?: string;
  author?: string;
  date?: string;
  message?: string;
  additions?: number;
  deletions?: number;
}

interface GitHubPR {
  id?: number;
  number?: number;
  title?: string;
  author?: string;
  state?: string; // 'open' | 'closed' | 'merged'
  merged?: boolean;
  created_at?: string;
  merged_at?: string;
  closed_at?: string;
  review_comments?: number;
  additions?: number;
  deletions?: number;
  ci_status?: string; // 'success' | 'failure' | 'pending'
  reverted?: boolean;
  approved?: boolean;
  reviewers?: string[];
  bugs_introduced?: number;
  bugs_fixed?: number;
}

interface GitHubReview {
  pr_number?: number;
  reviewer?: string;
  state?: string; // 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
  submitted_at?: string;
  turnaround_hours?: number;
}

// ── Collector ───────────────────────────────────────────────────

export async function collectGitHubMetrics(
  employeeId: string,
  orgId: string,
): Promise<CollectorResult> {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Look up the employee's github_username
  const { data: employee } = await supabase
    .from('employees')
    .select('github_username, name, email')
    .eq('id', employeeId)
    .single();

  if (!employee?.github_username) {
    return {
      source: 'github',
      dimensions: {
        responsiveness: null,
        outputVolume: null,
        qualitySignal: null,
        collaboration: null,
        reliability: null,
      },
    };
  }

  const ghUsername = employee.github_username.toLowerCase();

  // 2. Fetch integration_data for GitHub within this org
  //    GitHub data is stored with provider='github' (or via webhook events)
  //    Data types we look for: commits, pull_requests, reviews, ci_runs
  const { data: integrationRows } = await supabase
    .from('integration_data')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'github')
    .gte('synced_at', thirtyDaysAgo);

  // Also check webhook events for recent GitHub activity
  const { data: webhookRows } = await supabase
    .from('integration_webhook_events')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'github')
    .gte('created_at', thirtyDaysAgo);

  // ── Extract data from integration_data rows ───────────────────

  const allData = integrationRows ?? [];
  const allWebhooks = webhookRows ?? [];

  // Parse commits, PRs, and reviews from stored data
  const commits: (GitHubCommit & { _syncedAt: string })[] = [];
  const prs: (GitHubPR & { _syncedAt: string })[] = [];
  const reviews: (GitHubReview & { _syncedAt: string })[] = [];

  for (const row of allData) {
    const data = row.data ?? {};
    const recordType = row.record_type ?? row.data_type ?? '';
    const syncedAt = row.synced_at ?? row.created_at;

    if (recordType === 'commits' || recordType === 'commit') {
      const items: GitHubCommit[] = Array.isArray(data) ? data : (data.commits ?? [data]);
      for (const c of items) {
        if (c.author?.toLowerCase() === ghUsername) {
          commits.push({ ...c, _syncedAt: c.date ?? syncedAt });
        }
      }
    } else if (recordType === 'pull_requests' || recordType === 'prs') {
      const items: GitHubPR[] = Array.isArray(data) ? data : (data.pull_requests ?? data.prs ?? [data]);
      for (const pr of items) {
        if (pr.author?.toLowerCase() === ghUsername) {
          prs.push({ ...pr, _syncedAt: pr.created_at ?? syncedAt });
        }
      }
    } else if (recordType === 'reviews' || recordType === 'pr_reviews') {
      const items: GitHubReview[] = Array.isArray(data) ? data : (data.reviews ?? [data]);
      for (const r of items) {
        if (r.reviewer?.toLowerCase() === ghUsername) {
          reviews.push({ ...r, _syncedAt: r.submitted_at ?? syncedAt });
        }
      }
    }
  }

  // Also extract from webhook payloads
  for (const wh of allWebhooks) {
    const payload = wh.payload ?? {};
    const eventType = wh.event_type ?? '';

    if (eventType === 'push' && payload.commits) {
      for (const c of payload.commits) {
        const author = (c.author?.username ?? c.author?.name ?? '').toLowerCase();
        if (author === ghUsername) {
          commits.push({ ...c, _syncedAt: c.timestamp ?? wh.created_at });
        }
      }
    } else if (eventType === 'pull_request') {
      const pr = payload.pull_request ?? payload;
      const author = (pr.user?.login ?? pr.author ?? '').toLowerCase();
      if (author === ghUsername) {
        prs.push({
          author: ghUsername,
          state: pr.state,
          merged: pr.merged ?? false,
          created_at: pr.created_at,
          merged_at: pr.merged_at,
          _syncedAt: pr.created_at ?? wh.created_at,
        });
      }
    } else if (eventType === 'pull_request_review') {
      const review = payload.review ?? payload;
      const reviewer = (review.user?.login ?? review.reviewer ?? '').toLowerCase();
      if (reviewer === ghUsername) {
        reviews.push({
          reviewer: ghUsername,
          state: review.state,
          submitted_at: review.submitted_at,
          _syncedAt: review.submitted_at ?? wh.created_at,
        });
      }
    }
  }

  // ── Responsiveness: PR review turnaround time ─────────────────

  let responsiveness: number | null = null;
  if (reviews.length > 0) {
    const reviewScores = reviews
      .filter((r) => typeof r.turnaround_hours === 'number')
      .map((r) => {
        const hours = r.turnaround_hours!;
        let score: number;
        if (hours <= 2) score = 100;
        else if (hours <= 4) score = 85;
        else if (hours <= 8) score = 70;
        else if (hours <= 24) score = 50;
        else if (hours <= 48) score = 30;
        else score = 15;
        return { value: clamp(score), weight: getTimeWeight(r._syncedAt) };
      });

    responsiveness = weightedAverage(reviewScores);
  }

  // ── Output Volume: commits + PRs merged ───────────────────────

  let outputVolume: number | null = null;
  if (commits.length > 0 || prs.length > 0) {
    // Score based on activity level over the 30-day window
    // Each commit = 1 point, each merged PR = 5 points
    const mergedPRs = prs.filter((p) => p.merged || p.state === 'merged');

    // Build daily activity scores
    const activityEntries: { value: number; weight: number }[] = [];

    // Group by week for weighting
    const weekBuckets: Map<number, number> = new Map(); // weekIndex -> activity points
    const now = Date.now();

    for (const c of commits) {
      const daysAgo = (now - new Date(c._syncedAt).getTime()) / (1000 * 60 * 60 * 24);
      const week = Math.floor(daysAgo / 7);
      weekBuckets.set(week, (weekBuckets.get(week) ?? 0) + 1);
    }
    for (const pr of mergedPRs) {
      const daysAgo = (now - new Date(pr._syncedAt).getTime()) / (1000 * 60 * 60 * 24);
      const week = Math.floor(daysAgo / 7);
      weekBuckets.set(week, (weekBuckets.get(week) ?? 0) + 5);
    }

    for (const [week, points] of weekBuckets) {
      // Normalize weekly points to a 0-100 score
      // 1-5 points/week = low, 5-15 = medium, 15-30 = high, 30+ = very high
      let score: number;
      if (points >= 30) score = 95;
      else if (points >= 15) score = 80;
      else if (points >= 8) score = 65;
      else if (points >= 3) score = 45;
      else score = 25;

      const daysAgo = week * 7 + 3.5; // midpoint of the week
      const weight = daysAgo <= 7 ? 3 : daysAgo <= 14 ? 2 : 1;
      activityEntries.push({ value: clamp(score), weight });
    }

    outputVolume = weightedAverage(activityEntries);

    // Fallback: if no week buckets could be formed, use total counts
    if (outputVolume === null) {
      const totalPoints = commits.length + mergedPRs.length * 5;
      if (totalPoints >= 50) outputVolume = 90;
      else if (totalPoints >= 25) outputVolume = 70;
      else if (totalPoints >= 10) outputVolume = 50;
      else if (totalPoints >= 3) outputVolume = 30;
      else outputVolume = 15;
    }
  }

  // ── Quality Signal: PR approval rate, bugs introduced vs fixed ─

  let qualitySignal: number | null = null;
  if (prs.length > 0) {
    const qualityEntries: { value: number; weight: number }[] = [];

    // PR approval rate
    const reviewedPRs = prs.filter(
      (p) => p.approved !== undefined || p.state === 'merged' || p.merged,
    );
    if (reviewedPRs.length > 0) {
      const approvedCount = reviewedPRs.filter((p) => p.approved || p.merged).length;
      const approvalRate = (approvedCount / reviewedPRs.length) * 100;
      qualityEntries.push({
        value: clamp(approvalRate),
        weight: 2, // static weight for aggregate metric
      });
    }

    // Bug ratio (bugs introduced vs fixed)
    const bugsIntroduced = prs.reduce((sum, p) => sum + (p.bugs_introduced ?? 0), 0);
    const bugsFixed = prs.reduce((sum, p) => sum + (p.bugs_fixed ?? 0), 0);
    if (bugsIntroduced > 0 || bugsFixed > 0) {
      const total = bugsIntroduced + bugsFixed;
      // Higher ratio of fixed-to-introduced = better quality
      const fixRatio = total > 0 ? bugsFixed / total : 0.5;
      qualityEntries.push({
        value: clamp(fixRatio * 100),
        weight: 2,
      });
    }

    qualitySignal = weightedAverage(qualityEntries);
  }

  // ── Collaboration: PR reviews given to teammates ──────────────

  let collaboration: number | null = null;
  if (reviews.length > 0) {
    // More reviews given = more collaborative
    // Group by week for time weighting
    const weekBuckets: Map<number, number> = new Map();
    const now = Date.now();

    for (const r of reviews) {
      const daysAgo = (now - new Date(r._syncedAt).getTime()) / (1000 * 60 * 60 * 24);
      const week = Math.floor(daysAgo / 7);
      weekBuckets.set(week, (weekBuckets.get(week) ?? 0) + 1);
    }

    const collabEntries: { value: number; weight: number }[] = [];
    for (const [week, count] of weekBuckets) {
      // 1 review/week = low, 3 = medium, 5+ = high
      let score: number;
      if (count >= 8) score = 95;
      else if (count >= 5) score = 80;
      else if (count >= 3) score = 65;
      else if (count >= 1) score = 45;
      else score = 15;

      const daysAgo = week * 7 + 3.5;
      const weight = daysAgo <= 7 ? 3 : daysAgo <= 14 ? 2 : 1;
      collabEntries.push({ value: clamp(score), weight });
    }

    collaboration = weightedAverage(collabEntries);
  }

  // ── Reliability: CI pass rate, reverted commits ───────────────

  let reliability: number | null = null;
  if (prs.length > 0) {
    const reliabilityEntries: { value: number; weight: number }[] = [];

    // CI pass rate
    const prsWithCI = prs.filter((p) => p.ci_status);
    if (prsWithCI.length > 0) {
      const passCount = prsWithCI.filter((p) => p.ci_status === 'success').length;
      const passRate = (passCount / prsWithCI.length) * 100;
      reliabilityEntries.push({ value: clamp(passRate), weight: 2 });
    }

    // Reverted commits penalty
    const revertedCount = prs.filter((p) => p.reverted).length;
    if (prs.length > 0) {
      const revertRate = revertedCount / prs.length;
      // 0% reverted = 100, 10% = 70, 20% = 40, 30%+ = 10
      const revertScore = Math.max(10, 100 - revertRate * 300);
      reliabilityEntries.push({ value: clamp(revertScore), weight: 2 });
    }

    reliability = weightedAverage(reliabilityEntries);
  }

  return {
    source: 'github',
    dimensions: {
      responsiveness,
      outputVolume,
      qualitySignal,
      collaboration,
      reliability,
    },
  };
}
