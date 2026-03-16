/**
 * GitHub Action Tools — Create issues, PRs, comments via Composio
 *
 * These tools EXECUTE real GitHub actions using the user's connected
 * GitHub account through Composio. They go beyond read-only analytics
 * to actually create issues, PRs, comments, and manage repositories.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

// ── Connection Check ─────────────────────────────────────────────────────────

async function checkGitHubConnection(orgId: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('integrations')
      .select('status')
      .eq('org_id', orgId)
      .eq('provider', 'github')
      .eq('status', 'connected')
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

const GITHUB_NOT_CONNECTED: ToolResult = {
  success: false,
  output: '⚠️ GitHub is not connected. The user needs to connect their GitHub account before you can take actions on their behalf.\n\nAsk the user to connect GitHub via Settings → Integrations → Connect GitHub.',
  cost: 0,
};

// ── Tool Definitions ─────────────────────────────────────────────────────────

const githubCreateIssue: Tool = {
  name: 'github_create_issue',
  description: 'Create a new issue in a GitHub repository. Requires GitHub to be connected via Composio.',
  parameters: {
    owner: {
      type: 'string',
      description: 'Repository owner (username or org name).',
    },
    repo: {
      type: 'string',
      description: 'Repository name.',
    },
    title: {
      type: 'string',
      description: 'Issue title.',
    },
    body: {
      type: 'string',
      description: 'Issue body/description in markdown.',
    },
  },
  required: ['owner', 'repo', 'title', 'body'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const owner = String(args.owner ?? '');
    const repo = String(args.repo ?? '');
    const title = String(args.title ?? '');
    const body = String(args.body ?? '');

    if (!owner || !repo || !title) {
      return { success: false, output: 'owner, repo, and title are required.' };
    }

    const connected = await checkGitHubConnection(context.orgId);
    if (!connected) return GITHUB_NOT_CONNECTED;

    try {
      const { createGitHubIssue } = await import('@/lib/integrations/composio-tools');
      const result = await createGitHubIssue(context.orgId, owner, repo, title, body);

      if (result) {
        const issueUrl = result?.html_url ?? result?.data?.html_url ?? `https://github.com/${owner}/${repo}/issues`;
        return {
          success: true,
          output: `✅ GitHub issue created successfully!\n\nRepository: ${owner}/${repo}\nTitle: ${title}\nURL: ${issueUrl}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to create GitHub issue. Check repository access.' };
    } catch (err) {
      return { success: false, output: `GitHub issue creation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const githubCreatePR: Tool = {
  name: 'github_create_pr',
  description: 'Create a pull request in a GitHub repository. Requires GitHub to be connected via Composio. The head branch must already exist.',
  parameters: {
    owner: {
      type: 'string',
      description: 'Repository owner (username or org name).',
    },
    repo: {
      type: 'string',
      description: 'Repository name.',
    },
    title: {
      type: 'string',
      description: 'PR title.',
    },
    body: {
      type: 'string',
      description: 'PR description in markdown.',
    },
    head: {
      type: 'string',
      description: 'The branch containing changes (e.g., "feature/new-thing").',
    },
    base: {
      type: 'string',
      description: 'The branch to merge into (e.g., "main").',
    },
  },
  required: ['owner', 'repo', 'title', 'body', 'head', 'base'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const owner = String(args.owner ?? '');
    const repo = String(args.repo ?? '');
    const title = String(args.title ?? '');
    const body = String(args.body ?? '');
    const head = String(args.head ?? '');
    const base = String(args.base ?? 'main');

    if (!owner || !repo || !title || !head) {
      return { success: false, output: 'owner, repo, title, and head branch are required.' };
    }

    const connected = await checkGitHubConnection(context.orgId);
    if (!connected) return GITHUB_NOT_CONNECTED;

    try {
      const { createGitHubPR } = await import('@/lib/integrations/composio-tools');
      const result = await createGitHubPR(context.orgId, owner, repo, title, body, head, base);

      if (result) {
        const prUrl = result?.html_url ?? result?.data?.html_url ?? `https://github.com/${owner}/${repo}/pulls`;
        return {
          success: true,
          output: `✅ Pull request created successfully!\n\nRepository: ${owner}/${repo}\nTitle: ${title}\nBranch: ${head} → ${base}\nURL: ${prUrl}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to create PR. Check that the head branch exists and there are changes to merge.' };
    } catch (err) {
      return { success: false, output: `PR creation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const githubListRepos: Tool = {
  name: 'github_list_repos',
  description: 'List GitHub repositories for the authenticated user or a specific organization. Requires GitHub to be connected via Composio.',
  parameters: {
    org: {
      type: 'string',
      description: 'Optional organization name. If not provided, lists the authenticated user\'s repos.',
    },
  },
  required: [],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const org = args.org ? String(args.org) : undefined;

    const connected = await checkGitHubConnection(context.orgId);
    if (!connected) return GITHUB_NOT_CONNECTED;

    try {
      const { getGitHubRepos } = await import('@/lib/integrations/composio-tools');
      const result = await getGitHubRepos(context.orgId, org);

      if (result) {
        const repos = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
        const repoList = (repos as Array<Record<string, unknown>>).slice(0, 20).map((r: Record<string, unknown>) =>
          `- ${r.full_name ?? r.name} (${r.private ? 'private' : 'public'})${r.description ? `: ${String(r.description).slice(0, 80)}` : ''}`
        ).join('\n');

        return {
          success: true,
          output: `GitHub repositories${org ? ` for ${org}` : ''}:\n\n${repoList || 'No repositories found.'}`,
          cost: 0,
        };
      }
      return { success: true, output: 'No repositories found.', cost: 0 };
    } catch (err) {
      return { success: false, output: `Failed to list repos: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const githubCreateComment: Tool = {
  name: 'github_create_comment',
  description: 'Add a comment to a GitHub issue or pull request. Requires GitHub to be connected via Composio.',
  parameters: {
    owner: {
      type: 'string',
      description: 'Repository owner.',
    },
    repo: {
      type: 'string',
      description: 'Repository name.',
    },
    issue_number: {
      type: 'number',
      description: 'Issue or PR number to comment on.',
    },
    body: {
      type: 'string',
      description: 'Comment text in markdown.',
    },
  },
  required: ['owner', 'repo', 'issue_number', 'body'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const owner = String(args.owner ?? '');
    const repo = String(args.repo ?? '');
    const issueNumber = Number(args.issue_number ?? 0);
    const body = String(args.body ?? '');

    if (!owner || !repo || !issueNumber || !body) {
      return { success: false, output: 'owner, repo, issue_number, and body are required.' };
    }

    const connected = await checkGitHubConnection(context.orgId);
    if (!connected) return GITHUB_NOT_CONNECTED;

    try {
      const { createGitHubComment } = await import('@/lib/integrations/composio-tools');
      const result = await createGitHubComment(context.orgId, owner, repo, issueNumber, body);

      if (result) {
        return {
          success: true,
          output: `✅ Comment added to ${owner}/${repo}#${issueNumber}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to add comment.' };
    } catch (err) {
      return { success: false, output: `Comment failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const githubListIssues: Tool = {
  name: 'github_list_issues',
  description: 'List open issues for a GitHub repository. Requires GitHub to be connected via Composio.',
  parameters: {
    owner: {
      type: 'string',
      description: 'Repository owner.',
    },
    repo: {
      type: 'string',
      description: 'Repository name.',
    },
  },
  required: ['owner', 'repo'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const owner = String(args.owner ?? '');
    const repo = String(args.repo ?? '');

    if (!owner || !repo) {
      return { success: false, output: 'owner and repo are required.' };
    }

    const connected = await checkGitHubConnection(context.orgId);
    if (!connected) return GITHUB_NOT_CONNECTED;

    try {
      const { getGitHubIssues } = await import('@/lib/integrations/composio-tools');
      const result = await getGitHubIssues(context.orgId, owner, repo);

      if (result) {
        const issues = Array.isArray(result) ? result : (result?.data ?? []);
        const issueList = (issues as Array<Record<string, unknown>>).slice(0, 15).map((i: Record<string, unknown>) =>
          `- #${i.number}: ${i.title} (${i.state})`
        ).join('\n');

        return {
          success: true,
          output: `Issues for ${owner}/${repo}:\n\n${issueList || 'No open issues.'}`,
          cost: 0,
        };
      }
      return { success: true, output: 'No issues found.', cost: 0 };
    } catch (err) {
      return { success: false, output: `Failed to list issues: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const githubListPRs: Tool = {
  name: 'github_list_prs',
  description: 'List pull requests for a GitHub repository. Requires GitHub to be connected via Composio.',
  parameters: {
    owner: {
      type: 'string',
      description: 'Repository owner.',
    },
    repo: {
      type: 'string',
      description: 'Repository name.',
    },
  },
  required: ['owner', 'repo'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const owner = String(args.owner ?? '');
    const repo = String(args.repo ?? '');

    if (!owner || !repo) {
      return { success: false, output: 'owner and repo are required.' };
    }

    const connected = await checkGitHubConnection(context.orgId);
    if (!connected) return GITHUB_NOT_CONNECTED;

    try {
      const { getGitHubPRs } = await import('@/lib/integrations/composio-tools');
      const result = await getGitHubPRs(context.orgId, owner, repo);

      if (result) {
        const prs = Array.isArray(result) ? result : (result?.data ?? []);
        const prList = (prs as Array<Record<string, unknown>>).slice(0, 15).map((p: Record<string, unknown>) =>
          `- #${p.number}: ${p.title} (${p.state}) — ${p.head && (p.head as Record<string, unknown>).ref} → ${p.base && (p.base as Record<string, unknown>).ref}`
        ).join('\n');

        return {
          success: true,
          output: `Pull requests for ${owner}/${repo}:\n\n${prList || 'No open PRs.'}`,
          cost: 0,
        };
      }
      return { success: true, output: 'No pull requests found.', cost: 0 };
    } catch (err) {
      return { success: false, output: `Failed to list PRs: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const githubActionTools: Tool[] = [
  githubCreateIssue,
  githubCreatePR,
  githubListRepos,
  githubCreateComment,
  githubListIssues,
  githubListPRs,
];
registerTools(githubActionTools);
