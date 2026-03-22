/**
 * Content Scheduling & A/B Testing Tools
 *
 * Turns agents from "single-action executors" into "strategy executors" by
 * letting them plan and schedule content across time, run structured A/B tests,
 * and report aggregated cross-platform analytics.
 *
 * Tools:
 * - schedule_post          — Queue a social post for a future date/time
 * - create_ab_test         — Launch a 2-3 variant A/B test across a platform
 * - get_scheduled_posts    — List upcoming / recent scheduled posts
 * - get_ab_test_results    — Compare variant performance and identify winner
 * - get_cross_platform_analytics — Aggregated analytics across all platforms
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';
import { v4 as uuidv4 } from 'uuid';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook'];

function validatePlatform(platform: string): string | null {
  const p = platform.toLowerCase();
  if (!VALID_PLATFORMS.includes(p)) {
    return `Invalid platform "${platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}.`;
  }
  return null;
}

function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ── schedule_post ─────────────────────────────────────────────────────────────

const schedulePost: Tool = {
  name: 'schedule_post',
  description:
    'Schedule a social media post to be published at a future date and time. ' +
    'Use this to plan content calendars, time posts for peak engagement hours, or ' +
    'queue up a series of posts in advance. Supports LinkedIn, Twitter, Instagram, and Facebook.',
  parameters: {
    platform: {
      type: 'string',
      description: 'Target social platform: linkedin, twitter, instagram, or facebook.',
      enum: VALID_PLATFORMS,
    },
    content: {
      type: 'string',
      description: 'The full post text / caption to publish.',
    },
    scheduled_at: {
      type: 'string',
      description:
        'ISO 8601 datetime string for when to publish (e.g. "2026-03-25T14:00:00Z"). Must be in the future.',
    },
    media_urls: {
      type: 'string',
      description: 'Optional comma-separated list of public media URLs to attach to the post.',
    },
    timezone: {
      type: 'string',
      description:
        'IANA timezone name (e.g. "America/New_York"). Used for display purposes. Defaults to UTC.',
    },
  },
  required: ['platform', 'content', 'scheduled_at'],
  category: 'marketing',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const platform = String(args.platform ?? '').toLowerCase();
    const content = String(args.content ?? '').trim();
    const scheduledAtRaw = String(args.scheduled_at ?? '').trim();
    const mediaUrlsRaw = args.media_urls ? String(args.media_urls) : '';
    const timezone = String(args.timezone ?? 'UTC');

    // Validate
    const platformError = validatePlatform(platform);
    if (platformError) return { success: false, output: platformError };
    if (!content) return { success: false, output: 'Post content is required.' };

    const scheduledAt = parseDate(scheduledAtRaw);
    if (!scheduledAt) {
      return { success: false, output: `Invalid date: "${scheduledAtRaw}". Use ISO 8601 format (e.g. "2026-03-25T14:00:00Z").` };
    }
    if (scheduledAt <= new Date()) {
      return { success: false, output: 'scheduled_at must be in the future.' };
    }

    const mediaUrls = mediaUrlsRaw
      ? mediaUrlsRaw.split(',').map((u) => u.trim()).filter(Boolean)
      : [];

    // Extract hashtags from content
    const hashtags = (content.match(/#\w+/g) ?? []).map((h) => h.toLowerCase());

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const postId = uuidv4();
      const { error } = await supabase.from('scheduled_posts').insert({
        id: postId,
        org_id: context.orgId,
        platform,
        content,
        media_urls: mediaUrls,
        hashtags,
        scheduled_at: scheduledAt.toISOString(),
        timezone,
        status: 'scheduled',
        created_by: context.agentId,
        task_id: context.sessionId ? undefined : undefined, // optional linkage
      });

      if (error) {
        return { success: false, output: `Failed to schedule post: ${error.message}` };
      }

      const displayTime = scheduledAt.toLocaleString('en-US', {
        timeZone: timezone === 'UTC' ? 'UTC' : timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      return {
        success: true,
        output: [
          `Post scheduled successfully!`,
          ``,
          `**Platform:** ${platform}`,
          `**Scheduled for:** ${displayTime} (${timezone})`,
          `**Post ID:** ${postId}`,
          `**Content preview:** "${content.slice(0, 150)}${content.length > 150 ? '...' : ''}"`,
          mediaUrls.length ? `**Media:** ${mediaUrls.length} attachment(s)` : '',
        ].filter(Boolean).join('\n'),
        cost: 0,
      };
    } catch (err) {
      return { success: false, output: `schedule_post failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── create_ab_test ────────────────────────────────────────────────────────────

const createAbTest: Tool = {
  name: 'create_ab_test',
  description:
    'Create an A/B test with 2 or 3 content variants on a social platform. ' +
    'Each variant is scheduled 1 hour apart so performance can be compared. ' +
    'Use this to test different hooks, CTAs, tones, or formats before committing to a strategy.',
  parameters: {
    platform: {
      type: 'string',
      description: 'Target social platform: linkedin, twitter, instagram, or facebook.',
      enum: VALID_PLATFORMS,
    },
    name: {
      type: 'string',
      description: 'Descriptive name for this A/B test (e.g. "March Product Launch Hook Test").',
    },
    variant_a: {
      type: 'string',
      description: 'Content for Variant A.',
    },
    variant_b: {
      type: 'string',
      description: 'Content for Variant B.',
    },
    variant_c: {
      type: 'string',
      description: 'Optional content for Variant C (3-way test).',
    },
    schedule_at: {
      type: 'string',
      description:
        'ISO 8601 datetime for the first variant. Subsequent variants post 1 hour later. ' +
        'Defaults to 24 hours from now if omitted.',
    },
    metric: {
      type: 'string',
      description:
        'Primary metric to determine winner: engagement_rate, likes, comments, shares, or clicks. ' +
        'Defaults to engagement_rate.',
      enum: ['engagement_rate', 'likes', 'comments', 'shares', 'clicks'],
    },
  },
  required: ['platform', 'name', 'variant_a', 'variant_b'],
  category: 'marketing',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const platform = String(args.platform ?? '').toLowerCase();
    const name = String(args.name ?? '').trim();
    const variantA = String(args.variant_a ?? '').trim();
    const variantB = String(args.variant_b ?? '').trim();
    const variantC = args.variant_c ? String(args.variant_c).trim() : null;
    const metric = String(args.metric ?? 'engagement_rate');

    const platformError = validatePlatform(platform);
    if (platformError) return { success: false, output: platformError };
    if (!name) return { success: false, output: 'A/B test name is required.' };
    if (!variantA || !variantB) return { success: false, output: 'variant_a and variant_b are required.' };

    // Determine start time
    let startAt: Date;
    if (args.schedule_at) {
      const parsed = parseDate(String(args.schedule_at));
      if (!parsed) {
        return { success: false, output: `Invalid schedule_at date. Use ISO 8601 format.` };
      }
      if (parsed <= new Date()) {
        return { success: false, output: 'schedule_at must be in the future.' };
      }
      startAt = parsed;
    } else {
      startAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now
    }

    const variants: Array<{ label: string; content: string; scheduled_at: Date }> = [
      { label: 'A', content: variantA, scheduled_at: startAt },
      { label: 'B', content: variantB, scheduled_at: new Date(startAt.getTime() + 60 * 60 * 1000) },
    ];
    if (variantC) {
      variants.push({
        label: 'C',
        content: variantC,
        scheduled_at: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
      });
    }

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      // Create ab_tests record
      const testId = uuidv4();
      const { error: testError } = await supabase.from('ab_tests').insert({
        id: testId,
        org_id: context.orgId,
        name,
        platform,
        status: 'running',
        variant_count: variants.length,
        metric,
        started_at: new Date().toISOString(),
      });

      if (testError) {
        return { success: false, output: `Failed to create A/B test: ${testError.message}` };
      }

      // Insert one scheduled_post per variant
      const postRows = variants.map((v) => ({
        id: uuidv4(),
        org_id: context.orgId,
        platform,
        content: v.content,
        media_urls: [],
        hashtags: (v.content.match(/#\w+/g) ?? []).map((h: string) => h.toLowerCase()),
        scheduled_at: v.scheduled_at.toISOString(),
        timezone: 'UTC',
        status: 'scheduled',
        ab_group_id: testId,
        variant_label: v.label,
        created_by: context.agentId,
      }));

      const { error: postsError } = await supabase.from('scheduled_posts').insert(postRows);
      if (postsError) {
        return { success: false, output: `A/B test created but posts failed: ${postsError.message}` };
      }

      const lines = [
        `A/B test created: **${name}**`,
        ``,
        `**Test ID:** ${testId}`,
        `**Platform:** ${platform}`,
        `**Metric:** ${metric}`,
        `**Variants:**`,
        ...variants.map(
          (v) =>
            `- Variant ${v.label}: "${v.content.slice(0, 100)}${v.content.length > 100 ? '...' : ''}" → scheduled ${v.scheduled_at.toUTCString()}`
        ),
        ``,
        `Use \`get_ab_test_results\` after posts go live to see the winner.`,
      ];

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `create_ab_test failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── get_scheduled_posts ───────────────────────────────────────────────────────

const getScheduledPosts: Tool = {
  name: 'get_scheduled_posts',
  description:
    'List scheduled social media posts for this organization. ' +
    'Filter by platform or status. Returns upcoming posts sorted by scheduled time. ' +
    'Use this to review the content calendar or check what is queued.',
  parameters: {
    platform: {
      type: 'string',
      description: 'Optional platform filter: linkedin, twitter, instagram, or facebook.',
      enum: VALID_PLATFORMS,
    },
    status: {
      type: 'string',
      description: 'Filter by status. Defaults to "scheduled" (upcoming posts).',
      enum: ['scheduled', 'posting', 'posted', 'failed', 'cancelled'],
    },
    limit: {
      type: 'string',
      description: 'Maximum number of posts to return (default 20, max 50).',
    },
  },
  required: [],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const platform = args.platform ? String(args.platform).toLowerCase() : null;
    const status = args.status ? String(args.status) : 'scheduled';
    const limit = Math.min(50, Math.max(1, parseInt(String(args.limit ?? '20'), 10) || 20));

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let query = supabase
        .from('scheduled_posts')
        .select('id, platform, content, scheduled_at, timezone, status, variant_label, ab_group_id, post_url, likes, comments, shares, engagement_rate')
        .eq('org_id', context.orgId)
        .eq('status', status)
        .order('scheduled_at', { ascending: true })
        .limit(limit);

      if (platform) {
        const platformError = validatePlatform(platform);
        if (platformError) return { success: false, output: platformError };
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;
      if (error) return { success: false, output: `Failed to fetch scheduled posts: ${error.message}` };

      if (!data || data.length === 0) {
        const filterDesc = platform ? ` for ${platform}` : '';
        return {
          success: true,
          output: `No ${status} posts found${filterDesc}. Use \`schedule_post\` to queue content or \`create_ab_test\` to run a test.`,
          cost: 0,
        };
      }

      const lines: string[] = [
        `## Scheduled Posts (${data.length} ${status})`,
        '',
      ];

      for (const post of data) {
        const dt = new Date(post.scheduled_at);
        const timeStr = dt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
        const abTag = post.ab_group_id ? ` [A/B Variant ${post.variant_label ?? '?'}]` : '';
        const preview = post.content.slice(0, 120) + (post.content.length > 120 ? '...' : '');
        lines.push(`**${post.platform.toUpperCase()}** — ${timeStr} UTC${abTag}`);
        lines.push(`"${preview}"`);
        if (post.status === 'posted' && post.engagement_rate != null) {
          lines.push(`Engagement: ${post.likes} likes · ${post.comments} comments · ${post.shares} shares · ${(post.engagement_rate * 100).toFixed(2)}% rate`);
        }
        if (post.post_url) lines.push(`Post URL: ${post.post_url}`);
        lines.push(`ID: ${post.id}`);
        lines.push('');
      }

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `get_scheduled_posts failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── get_ab_test_results ───────────────────────────────────────────────────────

const getAbTestResults: Tool = {
  name: 'get_ab_test_results',
  description:
    'Get performance results for an A/B test. Compares variant posts by engagement metrics ' +
    'and identifies the winning variant. If test_id is omitted, shows results for the most recent test.',
  parameters: {
    test_id: {
      type: 'string',
      description: 'UUID of the A/B test. Omit to get the latest test.',
    },
  },
  required: [],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const testId = args.test_id ? String(args.test_id).trim() : null;

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      // Fetch test record
      let testQuery = supabase
        .from('ab_tests')
        .select('*')
        .eq('org_id', context.orgId);

      if (testId) {
        testQuery = testQuery.eq('id', testId);
      } else {
        testQuery = testQuery.order('created_at', { ascending: false }).limit(1);
      }

      const { data: tests, error: testError } = await testQuery;
      if (testError) return { success: false, output: `Failed to fetch A/B test: ${testError.message}` };

      if (!tests || tests.length === 0) {
        return {
          success: true,
          output: 'No A/B tests found. Use `create_ab_test` to start one.',
          cost: 0,
        };
      }

      const test = tests[0];

      // Fetch variant posts for this test
      const { data: posts, error: postsError } = await supabase
        .from('scheduled_posts')
        .select('id, variant_label, content, status, scheduled_at, likes, comments, shares, clicks, engagement_rate, post_url')
        .eq('org_id', context.orgId)
        .eq('ab_group_id', test.id)
        .order('variant_label', { ascending: true });

      if (postsError) return { success: false, output: `Failed to fetch variant posts: ${postsError.message}` };

      const metric = test.metric as string;
      const lines: string[] = [
        `## A/B Test Results: ${test.name}`,
        ``,
        `**Platform:** ${test.platform}`,
        `**Status:** ${test.status}`,
        `**Metric:** ${metric}`,
        `**Started:** ${new Date(test.started_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
        ``,
        `### Variant Performance`,
      ];

      if (!posts || posts.length === 0) {
        lines.push('No variant posts found for this test.');
        return { success: true, output: lines.join('\n'), cost: 0 };
      }

      // Determine winner
      type Post = typeof posts[0];
      let winner: Post | null = null;
      let winnerScore = -Infinity;

      for (const post of posts) {
        const score = (() => {
          switch (metric) {
            case 'likes': return post.likes ?? 0;
            case 'comments': return post.comments ?? 0;
            case 'shares': return post.shares ?? 0;
            case 'clicks': return post.clicks ?? 0;
            default: return post.engagement_rate ?? 0;
          }
        })();

        const statusTag = post.status === 'posted' ? 'LIVE' : post.status.toUpperCase();
        const timeStr = new Date(post.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
        const preview = post.content.slice(0, 120) + (post.content.length > 120 ? '...' : '');

        lines.push(`**Variant ${post.variant_label}** [${statusTag}] — ${timeStr} UTC`);
        lines.push(`"${preview}"`);
        if (post.status === 'posted') {
          lines.push(`Likes: ${post.likes} · Comments: ${post.comments} · Shares: ${post.shares} · Clicks: ${post.clicks ?? 0} · Eng. rate: ${((post.engagement_rate ?? 0) * 100).toFixed(2)}%`);
          if (post.post_url) lines.push(`URL: ${post.post_url}`);
        } else {
          lines.push(`(Not yet posted — no engagement data available)`);
        }
        lines.push('');

        if (score > winnerScore) {
          winnerScore = score;
          winner = post;
        }
      }

      const allPosted = posts.every((p) => p.status === 'posted');
      if (allPosted && winner && winnerScore > 0) {
        lines.push(`### Winner: Variant ${winner.variant_label}`);
        lines.push(`Outperformed others on **${metric}** with a score of ${metric === 'engagement_rate' ? `${(winnerScore * 100).toFixed(2)}%` : winnerScore}.`);
        lines.push(`Use this variant's content and style as the template for your next campaign.`);
      } else if (!allPosted) {
        const pending = posts.filter((p) => p.status !== 'posted').length;
        lines.push(`_${pending} variant(s) still pending. Check back after all posts have gone live._`);
      }

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `get_ab_test_results failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── get_cross_platform_analytics ─────────────────────────────────────────────

const getCrossPlatformAnalytics: Tool = {
  name: 'get_cross_platform_analytics',
  description:
    'Get aggregated social media analytics across all platforms. ' +
    'Combines engagement data from posted scheduled_posts with integration_data pulled from connected accounts. ' +
    'Returns a platform-by-platform breakdown plus top performing posts. ' +
    'Use this to understand which platforms drive the most value and where to focus content strategy.',
  parameters: {
    days: {
      type: 'string',
      description: 'Number of days to look back (default 30, max 365).',
    },
  },
  required: [],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const days = Math.min(365, Math.max(1, parseInt(String(args.days ?? '30'), 10) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      // Pull posted scheduled_posts within window
      const { data: posts, error: postsError } = await supabase
        .from('scheduled_posts')
        .select('platform, content, likes, comments, shares, clicks, engagement_rate, scheduled_at, post_url')
        .eq('org_id', context.orgId)
        .eq('status', 'posted')
        .gte('scheduled_at', since)
        .order('engagement_rate', { ascending: false });

      if (postsError) {
        return { success: false, output: `Failed to fetch analytics: ${postsError.message}` };
      }

      // Pull integration_data engagement summaries
      const { data: integrationRecords } = await supabase
        .from('integration_data')
        .select('provider, record_type, data')
        .eq('org_id', context.orgId)
        .in('provider', VALID_PLATFORMS)
        .eq('record_type', 'engagement_summary');

      // Aggregate scheduled_posts by platform
      type PlatformStats = {
        posts: number;
        totalLikes: number;
        totalComments: number;
        totalShares: number;
        totalClicks: number;
        totalEngagementRate: number;
        topPost: { content: string; engagement_rate: number; likes: number; post_url?: string } | null;
      };

      const platformStats: Record<string, PlatformStats> = {};

      for (const post of posts ?? []) {
        const p = post.platform as string;
        if (!platformStats[p]) {
          platformStats[p] = {
            posts: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalClicks: 0,
            totalEngagementRate: 0,
            topPost: null,
          };
        }
        const s = platformStats[p];
        s.posts += 1;
        s.totalLikes += post.likes ?? 0;
        s.totalComments += post.comments ?? 0;
        s.totalShares += post.shares ?? 0;
        s.totalClicks += post.clicks ?? 0;
        s.totalEngagementRate += post.engagement_rate ?? 0;

        if (!s.topPost || (post.engagement_rate ?? 0) > s.topPost.engagement_rate) {
          s.topPost = {
            content: post.content,
            engagement_rate: post.engagement_rate ?? 0,
            likes: post.likes ?? 0,
            post_url: post.post_url ?? undefined,
          };
        }
      }

      // Merge in integration_data engagement summaries for platforms with no scheduled posts
      for (const rec of integrationRecords ?? []) {
        const p = rec.provider as string;
        const raw = rec.data;
        const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw ?? {});

        if (!platformStats[p] && typeof data === 'object' && data !== null) {
          const d = data as Record<string, unknown>;
          platformStats[p] = {
            posts: Number(d.totalPosts ?? 0),
            totalLikes: Number(d.totalLikes ?? 0),
            totalComments: Number(d.totalComments ?? 0),
            totalShares: Number(d.totalShares ?? 0),
            totalClicks: 0,
            totalEngagementRate: 0,
            topPost: null,
          };
        }
      }

      if (Object.keys(platformStats).length === 0) {
        return {
          success: true,
          output: [
            `## Cross-Platform Analytics (last ${days} days)`,
            '',
            'No posted content found in this period. Schedule and publish posts first, or connect social accounts to pull engagement data.',
          ].join('\n'),
          cost: 0,
        };
      }

      const lines: string[] = [`## Cross-Platform Analytics (last ${days} days)`, ''];

      // Sort platforms by total likes descending
      const sortedPlatforms = Object.entries(platformStats).sort(
        ([, a], [, b]) => b.totalLikes - a.totalLikes
      );

      for (const [platform, s] of sortedPlatforms) {
        const avgEngRate = s.posts > 0 ? (s.totalEngagementRate / s.posts) * 100 : 0;
        lines.push(`### ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
        lines.push(`- Posts (tracked): ${s.posts}`);
        lines.push(`- Total likes: ${s.totalLikes.toLocaleString()}`);
        lines.push(`- Total comments: ${s.totalComments.toLocaleString()}`);
        lines.push(`- Total shares: ${s.totalShares.toLocaleString()}`);
        if (s.totalClicks > 0) lines.push(`- Total clicks: ${s.totalClicks.toLocaleString()}`);
        if (s.posts > 0) lines.push(`- Avg engagement rate: ${avgEngRate.toFixed(2)}%`);
        if (s.topPost) {
          const preview = s.topPost.content.slice(0, 80) + (s.topPost.content.length > 80 ? '...' : '');
          lines.push(`- Top post: "${preview}" (${s.topPost.likes} likes, ${(s.topPost.engagement_rate * 100).toFixed(2)}% eng.)`);
          if (s.topPost.post_url) lines.push(`  URL: ${s.topPost.post_url}`);
        }
        lines.push('');
      }

      // Overall totals
      const totals = Object.values(platformStats).reduce(
        (acc, s) => ({
          posts: acc.posts + s.posts,
          likes: acc.likes + s.totalLikes,
          comments: acc.comments + s.totalComments,
          shares: acc.shares + s.totalShares,
        }),
        { posts: 0, likes: 0, comments: 0, shares: 0 }
      );

      lines.push(`### Overall Totals`);
      lines.push(`- Platforms active: ${Object.keys(platformStats).length}`);
      lines.push(`- Total posts: ${totals.posts}`);
      lines.push(`- Total likes: ${totals.likes.toLocaleString()}`);
      lines.push(`- Total comments: ${totals.comments.toLocaleString()}`);
      lines.push(`- Total shares: ${totals.shares.toLocaleString()}`);

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `get_cross_platform_analytics failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const schedulingTools: Tool[] = [
  schedulePost,
  createAbTest,
  getScheduledPosts,
  getAbTestResults,
  getCrossPlatformAnalytics,
];

registerTools(schedulingTools);
