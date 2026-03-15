// ═══════════════════════════════════════════════════════════════
// Pivot — GitHub Integration
// OAuth + API client for GitHub repository analytics.
// Syncs commits, PRs, reviews, and CI status into integration_data
// for the scoring engine's GitHub collector to consume.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ── GitHub API Client ──────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Pivot-BI/1.0',
  };
}

async function ghFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: ghHeaders(token),
    });
    if (!res.ok) {
      console.error(`[github] API ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[github] Fetch error for ${path}:`, err);
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  pushed_at: string;
  language: string | null;
}

interface GHCommit {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
  author: { login: string } | null;
  stats?: { additions: number; deletions: number };
}

interface GHPR {
  id: number;
  number: number;
  title: string;
  state: string;
  user: { login: string };
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  additions: number;
  deletions: number;
  merged: boolean;
  requested_reviewers: { login: string }[];
}

interface GHReview {
  id: number;
  user: { login: string };
  state: string;
  submitted_at: string;
}

interface GHCheckRun {
  id: number;
  name: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
}

// ── Sync Functions ─────────────────────────────────────────────

/**
 * Full sync: fetches repos, recent commits, PRs, reviews, and CI status
 * for an org. Stores everything in integration_data for the scoring collectors.
 */
export async function syncGitHubToAnalytics(
  orgId: string,
  accessToken: string,
  githubOrg?: string,
): Promise<SyncResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let recordsProcessed = 0;
  const now = new Date().toISOString();

  try {
    // 1. Get repos (user repos or org repos)
    let repos: GHRepo[] = [];
    if (githubOrg) {
      repos = (await ghFetch<GHRepo[]>(`/orgs/${encodeURIComponent(githubOrg)}/repos?sort=pushed&per_page=20`, accessToken)) ?? [];
    }
    if (repos.length === 0) {
      repos = (await ghFetch<GHRepo[]>('/user/repos?sort=pushed&per_page=20&affiliation=owner,collaborator,organization_member', accessToken)) ?? [];
    }

    // Filter to recently active repos (pushed in last 60 days)
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const activeRepos = repos.filter(r => new Date(r.pushed_at).getTime() > sixtyDaysAgo);

    // Store repo list
    await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'github',
      record_type: 'repos',
      external_id: `repos_${orgId}`,
      data: activeRepos.map(r => ({
        name: r.full_name,
        language: r.language,
        private: r.private,
        default_branch: r.default_branch,
        pushed_at: r.pushed_at,
      })),
      synced_at: now,
    }, { onConflict: 'org_id,provider,external_id' });

    // 2. For each active repo, fetch commits, PRs, reviews
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const repo of activeRepos.slice(0, 10)) {
      const repoName = repo.full_name;

      // Commits (last 30 days)
      const commits = await ghFetch<GHCommit[]>(
        `/repos/${repoName}/commits?since=${thirtyDaysAgo}&per_page=100`,
        accessToken,
      );
      if (commits && commits.length > 0) {
        await supabase.from('integration_data').upsert({
          org_id: orgId,
          provider: 'github',
          record_type: 'commits',
          external_id: `commits_${repoName}`,
          data: commits.map(c => ({
            sha: c.sha,
            author: c.author?.login ?? c.commit.author.name,
            date: c.commit.author.date,
            message: c.commit.message.slice(0, 200),
            additions: c.stats?.additions ?? 0,
            deletions: c.stats?.deletions ?? 0,
          })),
          synced_at: now,
        }, { onConflict: 'org_id,provider,external_id' });
        recordsProcessed += commits.length;
      }

      // Pull requests (last 30 days, all states)
      const prs = await ghFetch<GHPR[]>(
        `/repos/${repoName}/pulls?state=all&sort=created&direction=desc&per_page=50`,
        accessToken,
      );
      if (prs && prs.length > 0) {
        const recentPRs = prs.filter(p => new Date(p.created_at) >= new Date(thirtyDaysAgo));
        if (recentPRs.length > 0) {
          // Fetch reviews for each PR
          const prsWithReviews = await Promise.all(
            recentPRs.slice(0, 30).map(async (pr) => {
              const reviews = await ghFetch<GHReview[]>(
                `/repos/${repoName}/pulls/${pr.number}/reviews`,
                accessToken,
              );

              // Check CI status
              const checks = await ghFetch<{ check_runs: GHCheckRun[] }>(
                `/repos/${repoName}/commits/${pr.merged_at ? 'HEAD' : pr.state === 'open' ? 'HEAD' : 'HEAD'}/check-runs?per_page=10`,
                accessToken,
              );
              const ciPassed = checks?.check_runs?.every(c => c.conclusion === 'success') ?? undefined;

              return {
                number: pr.number,
                title: pr.title,
                author: pr.user.login,
                state: pr.merged ? 'merged' : pr.state,
                merged: pr.merged,
                created_at: pr.created_at,
                merged_at: pr.merged_at,
                closed_at: pr.closed_at,
                additions: pr.additions,
                deletions: pr.deletions,
                ci_status: ciPassed === true ? 'success' : ciPassed === false ? 'failure' : undefined,
                approved: reviews?.some(r => r.state === 'APPROVED') ?? false,
                reviewers: (reviews ?? []).map(r => r.user.login),
              };
            }),
          );

          await supabase.from('integration_data').upsert({
            org_id: orgId,
            provider: 'github',
            record_type: 'pull_requests',
            external_id: `prs_${repoName}`,
            data: prsWithReviews,
            synced_at: now,
          }, { onConflict: 'org_id,provider,external_id' });
          recordsProcessed += prsWithReviews.length;

          // Store reviews separately for the collaboration collector
          const allReviews = await Promise.all(
            recentPRs.slice(0, 30).map(async (pr) => {
              const reviews = await ghFetch<GHReview[]>(
                `/repos/${repoName}/pulls/${pr.number}/reviews`,
                accessToken,
              );
              return (reviews ?? []).map(r => ({
                pr_number: pr.number,
                reviewer: r.user.login,
                state: r.state,
                submitted_at: r.submitted_at,
                turnaround_hours: r.submitted_at && pr.created_at
                  ? Math.round((new Date(r.submitted_at).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60))
                  : undefined,
              }));
            }),
          );

          const flatReviews = allReviews.flat();
          if (flatReviews.length > 0) {
            await supabase.from('integration_data').upsert({
              org_id: orgId,
              provider: 'github',
              record_type: 'reviews',
              external_id: `reviews_${repoName}`,
              data: flatReviews,
              synced_at: now,
            }, { onConflict: 'org_id,provider,external_id' });
            recordsProcessed += flatReviews.length;
          }
        }
      }
    }

    return {
      success: true,
      recordsProcessed,
      insightsGenerated: 0,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error('[github] Sync error:', msg);
    return {
      success: false,
      recordsProcessed,
      insightsGenerated: 0,
      errors,
    };
  }
}

// ── Code Audit Helper ──────────────────────────────────────────

/**
 * Run a quick code audit on a repo by fetching recent activity.
 * Returns a summary object for the CodeBot agent to analyze.
 */
export async function auditRepository(
  accessToken: string,
  repoFullName: string,
): Promise<{
  repo: string;
  languages: Record<string, number>;
  openIssues: number;
  openPRs: number;
  recentCommits: number;
  contributors: string[];
  defaultBranch: string;
  codeFrequency: { week: number; additions: number; deletions: number }[];
} | null> {
  // Repo info
  const repo = await ghFetch<any>(`/repos/${repoFullName}`, accessToken);
  if (!repo) return null;

  // Languages
  const languages = (await ghFetch<Record<string, number>>(`/repos/${repoFullName}/languages`, accessToken)) ?? {};

  // Open PRs count
  const openPRs = (await ghFetch<any[]>(`/repos/${repoFullName}/pulls?state=open&per_page=100`, accessToken))?.length ?? 0;

  // Recent commits (30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const commits = (await ghFetch<any[]>(`/repos/${repoFullName}/commits?since=${since}&per_page=100`, accessToken))?.length ?? 0;

  // Contributors
  const contribs = (await ghFetch<any[]>(`/repos/${repoFullName}/contributors?per_page=20`, accessToken)) ?? [];
  const contributors = contribs.map(c => c.login);

  // Code frequency (weekly additions/deletions)
  const freq = (await ghFetch<number[][]>(`/repos/${repoFullName}/stats/code_frequency`, accessToken)) ?? [];
  const codeFrequency = freq.slice(-8).map(w => ({
    week: w[0],
    additions: w[1],
    deletions: Math.abs(w[2]),
  }));

  return {
    repo: repoFullName,
    languages,
    openIssues: repo.open_issues_count ?? 0,
    openPRs,
    recentCommits: commits,
    contributors,
    defaultBranch: repo.default_branch ?? 'main',
    codeFrequency,
  };
}
