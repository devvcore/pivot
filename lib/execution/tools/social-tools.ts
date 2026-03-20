/**
 * Social Media Action Tools — Post to LinkedIn, Twitter/X via Composio
 *
 * These tools EXECUTE real actions (posting, sharing, engaging) on
 * social media platforms using the user's connected Composio accounts.
 * If a service is not connected, the tool returns a connection prompt
 * so the agent can guide the user to connect.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

// ── Connection Check Helper ──────────────────────────────────────────────────

async function checkConnection(orgId: string, provider: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('integrations')
      .select('status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

function connectionRequiredResult(provider: string): ToolResult {
  return {
    success: false,
    output: `[connect:${provider}]`,
    cost: 0,
  };
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const postToLinkedIn: Tool = {
  name: 'post_to_linkedin',
  description: 'Post content directly to the user\'s LinkedIn profile. Requires LinkedIn to be connected via Composio. Creates a real LinkedIn post visible to the user\'s network.',
  parameters: {
    text: {
      type: 'string',
      description: 'The post text content. LinkedIn supports up to 3000 characters. Use line breaks for formatting.',
    },
    visibility: {
      type: 'string',
      description: 'Post visibility.',
      enum: ['PUBLIC', 'CONNECTIONS'],
    },
    url: {
      type: 'string',
      description: 'Optional URL to share with the post (creates a link preview).',
    },
  },
  required: ['text'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const text = String(args.text ?? '');
    const visibility = String(args.visibility ?? 'PUBLIC') as 'PUBLIC' | 'CONNECTIONS';
    const url = args.url ? String(args.url) : undefined;

    if (!text) {
      return { success: false, output: 'Post text is required.' };
    }

    const connected = await checkConnection(context.orgId, 'linkedin');
    if (!connected) {
      return connectionRequiredResult('linkedin');
    }

    try {
      const { createLinkedInPost, createLinkedInSharePost } = await import('@/lib/integrations/composio-tools');

      let result;
      if (url) {
        result = await createLinkedInSharePost(context.orgId, text, url);
      } else {
        result = await createLinkedInPost(context.orgId, text, visibility);
      }

      if (result) {
        return {
          success: true,
          output: `✅ LinkedIn post published successfully!\n\nPost content:\n"${text.slice(0, 200)}${text.length > 200 ? '...' : ''}"\n\nVisibility: ${visibility}${url ? `\nShared URL: ${url}` : ''}`,
          cost: 0,
        };
      } else {
        return {
          success: false,
          output: 'LinkedIn post failed. The Composio API returned no result. The user may need to reconnect their LinkedIn account.',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `LinkedIn post failed: ${message}` };
    }
  },
};

const postToTwitter: Tool = {
  name: 'post_to_twitter',
  description: 'Post a tweet to the user\'s X (Twitter) account. Requires Twitter/X to be connected via Composio. Creates a real tweet visible to the user\'s followers.',
  parameters: {
    text: {
      type: 'string',
      description: 'Tweet text content. Maximum 280 characters for standard tweets.',
    },
    reply_to: {
      type: 'string',
      description: 'Optional tweet ID to reply to (creates a reply instead of a new tweet).',
    },
  },
  required: ['text'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const text = String(args.text ?? '');
    const replyTo = args.reply_to ? String(args.reply_to) : undefined;

    if (!text) {
      return { success: false, output: 'Tweet text is required.' };
    }
    if (text.length > 280) {
      return { success: false, output: `Tweet is ${text.length} characters. Maximum is 280. Please shorten it.` };
    }

    const connected = await checkConnection(context.orgId, 'twitter');
    if (!connected) {
      return connectionRequiredResult('twitter');
    }

    try {
      const { createTweet, replyToTweet } = await import('@/lib/integrations/composio-tools');

      let result;
      if (replyTo) {
        result = await replyToTweet(context.orgId, text, replyTo);
      } else {
        result = await createTweet(context.orgId, text);
      }

      if (result) {
        return {
          success: true,
          output: `✅ Tweet posted successfully!\n\nTweet: "${text}"${replyTo ? `\n(Reply to tweet ${replyTo})` : ''}`,
          cost: 0,
        };
      } else {
        return {
          success: false,
          output: 'Tweet failed. The Composio API returned no result. The user may need to reconnect their X (Twitter) account.',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Tweet failed: ${message}` };
    }
  },
};

const postToInstagram: Tool = {
  name: 'post_to_instagram',
  description: 'Post a photo to the user\'s Instagram Business/Creator account. Requires Instagram to be connected via Composio. Creates a real Instagram post visible to the user\'s followers.',
  parameters: {
    image_url: {
      type: 'string',
      description: 'Public URL of the image to post. Must be a publicly accessible JPEG or PNG URL.',
    },
    caption: {
      type: 'string',
      description: 'The caption for the post. Instagram supports up to 2200 characters. Use hashtags for reach.',
    },
  },
  required: ['image_url', 'caption'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const imageUrl = String(args.image_url ?? '');
    const caption = String(args.caption ?? '');

    if (!imageUrl || !caption) {
      return { success: false, output: 'Both image_url and caption are required.' };
    }

    const connected = await checkConnection(context.orgId, 'instagram');
    if (!connected) {
      return connectionRequiredResult('instagram');
    }

    try {
      const { createInstagramPost } = await import('@/lib/integrations/composio-tools');
      const result = await createInstagramPost(context.orgId, imageUrl, caption);

      if (result) {
        return {
          success: true,
          output: `✅ Instagram post published successfully!\n\nCaption:\n"${caption.slice(0, 200)}${caption.length > 200 ? '...' : ''}"\n\nImage: ${imageUrl}`,
          cost: 0,
        };
      } else {
        return {
          success: false,
          output: 'Instagram post failed. The Composio API returned no result. The user may need to reconnect their Instagram account.',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Instagram post failed: ${message}` };
    }
  },
};

const postToFacebook: Tool = {
  name: 'post_to_facebook',
  description: 'Post content to the user\'s Facebook Page. Requires Facebook to be connected via Composio. Creates a real Facebook post visible to the Page\'s audience.',
  parameters: {
    message: {
      type: 'string',
      description: 'The post text content.',
    },
    page_id: {
      type: 'string',
      description: 'Optional Facebook Page ID. If not provided, posts to the first available page.',
    },
  },
  required: ['message'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const message = String(args.message ?? '');
    const pageId = args.page_id ? String(args.page_id) : undefined;

    if (!message) {
      return { success: false, output: 'Post message is required.' };
    }

    const connected = await checkConnection(context.orgId, 'facebook');
    if (!connected) {
      return connectionRequiredResult('facebook');
    }

    try {
      const { createFacebookPost, getFacebookPages } = await import('@/lib/integrations/composio-tools');

      let targetPageId: string | undefined = pageId;
      if (!targetPageId) {
        const pages = await getFacebookPages(context.orgId);
        if (pages && Array.isArray(pages) && pages.length > 0 && pages[0]?.id) {
          targetPageId = pages[0].id;
        } else {
          return {
            success: false,
            output: 'No Facebook Pages found. The user needs a Facebook Page to post content.',
          };
        }
      }

      if (!targetPageId) {
        return { success: false, output: 'Could not determine Facebook Page ID.' };
      }

      const result = await createFacebookPost(context.orgId, targetPageId, message);

      if (result) {
        return {
          success: true,
          output: `✅ Facebook post published successfully!\n\nPost:\n"${message.slice(0, 200)}${message.length > 200 ? '...' : ''}"\n\nPage ID: ${targetPageId}`,
          cost: 0,
        };
      } else {
        return {
          success: false,
          output: 'Facebook post failed. The Composio API returned no result. The user may need to reconnect their Facebook account.',
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Facebook post failed: ${msg}` };
    }
  },
};

const checkServiceConnection: Tool = {
  name: 'check_connection',
  description: 'Check if a specific service (LinkedIn, Twitter, Instagram, Facebook, YouTube, GitHub, Gmail, Slack, etc.) is connected for this organization. Use this before attempting to post or take actions on external services.',
  parameters: {
    provider: {
      type: 'string',
      description: 'The service/provider to check (e.g., "linkedin", "github", "gmail").',
      enum: ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube', 'github', 'gmail', 'slack', 'hubspot', 'jira', 'notion', 'google_sheets', 'google_calendar', 'stripe', 'salesforce', 'quickbooks'],
    },
  },
  required: ['provider'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    // Accept both "provider" and "service" parameter names for compatibility
    const service = String(args.provider ?? args.service ?? '');
    if (!service) {
      return { success: false, output: 'Service name is required.' };
    }

    const connected = await checkConnection(context.orgId, service);

    if (connected) {
      return {
        success: true,
        output: `✅ ${service} is connected and ready to use. You can call the ${service} action tools now.`,
        cost: 0,
      };
    } else {
      return {
        success: true,
        output: `${service} is not connected. Include [connect:${service}] in your response so the user can connect it. You should still CREATE your content/deliverable — just note that you can't publish it yet. The user gets the content regardless of connection status.`,
        cost: 0,
      };
    }
  },
};

// ── Social Analytics Tool ────────────────────────────────────────────────────

const getSocialAnalytics: Tool = {
  name: 'get_social_analytics',
  description: 'Get engagement analytics for a social media platform (Instagram, Facebook, Twitter, LinkedIn). Returns top-performing posts, engagement rates, best posting times, and content themes. Use this BEFORE creating social media content to understand what performs well.',
  parameters: {
    platform: {
      type: 'string',
      description: 'The platform to get analytics for: instagram, facebook, twitter, linkedin, youtube',
    },
  },
  required: ['platform'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const platform = String(args.platform ?? '').toLowerCase();
    if (!platform) {
      return { success: false, output: 'Platform name is required (instagram, facebook, twitter, linkedin, youtube).' };
    }

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      // Check connection first
      const { data: integration } = await supabase
        .from('integrations')
        .select('status')
        .eq('org_id', context.orgId)
        .eq('provider', platform)
        .eq('status', 'connected')
        .maybeSingle();

      if (!integration) {
        return {
          success: false,
          output: `[connect:${platform}]\n\nConnect ${platform} to see your engagement analytics. Once connected, I can analyze your top-performing content and create posts optimized for your audience.`,
        };
      }

      // Pull analytics from integration_data
      const { data: records } = await supabase
        .from('integration_data')
        .select('record_type, data, synced_at')
        .eq('org_id', context.orgId)
        .eq('provider', platform);

      if (!records || records.length === 0) {
        // Data not synced yet — trigger a pull
        return {
          success: true,
          output: `${platform} is connected but no analytics data has been synced yet. The data will be available after the next sync cycle. For now, create your best content and I'll analyze engagement once data is available.`,
        };
      }

      // Format analytics
      const parts: string[] = [`## ${platform.charAt(0).toUpperCase() + platform.slice(1)} Analytics\n`];

      for (const rec of records) {
        const data = typeof rec.data === 'string' ? (() => { try { return JSON.parse(rec.data); } catch { return rec.data; } })() : rec.data;

        if (rec.record_type === 'engagement_summary' && data && typeof data === 'object') {
          parts.push(`**Engagement Overview:**`);
          parts.push(`- Total posts analyzed: ${data.totalPosts ?? 'N/A'}`);
          parts.push(`- Total likes: ${data.totalLikes?.toLocaleString() ?? 'N/A'}`);
          parts.push(`- Total comments: ${data.totalComments?.toLocaleString() ?? 'N/A'}`);
          parts.push(`- Avg engagement per post: ${data.avgEngagementPerPost ?? 'N/A'}`);
          if (data.engagementRate) parts.push(`- Engagement rate: ${data.engagementRate}%`);
          if (data.totalImpressions) parts.push(`- Total impressions: ${data.totalImpressions.toLocaleString()}`);
          if (data.totalReach) parts.push(`- Total reach: ${data.totalReach.toLocaleString()}`);

          if (data.topPerformingPosts?.length > 0) {
            parts.push(`\n**Top Performing Posts:**`);
            for (const post of data.topPerformingPosts.slice(0, 5)) {
              parts.push(`- "${post.caption?.slice(0, 60)}..." → ${post.likes} likes, ${post.comments} comments${post.impressions ? `, ${post.impressions} impressions` : ''}`);
            }
          }

          if (data.bestPostingTimes?.length > 0) {
            parts.push(`\n**Best Posting Times:** ${data.bestPostingTimes.join(', ')}`);
          }

          if (data.contentThemes?.length > 0) {
            parts.push(`\n**Top Hashtags/Themes:** ${data.contentThemes.join(' ')}`);
          }

          if (data.worstPerformingPosts?.length > 0) {
            parts.push(`\n**Lowest Performing Posts (avoid these patterns):**`);
            for (const post of data.worstPerformingPosts.slice(0, 3)) {
              parts.push(`- "${post.caption?.slice(0, 60)}..." → ${post.likes} likes, ${post.comments} comments`);
            }
          }
        } else if (rec.record_type === 'profile' && data && typeof data === 'object') {
          const name = data.name ?? data.username ?? data.screen_name ?? '';
          const followers = data.followers_count ?? data.followers ?? data.fan_count ?? '';
          if (name) parts.push(`**Profile:** ${name}`);
          if (followers) parts.push(`**Followers:** ${Number(followers).toLocaleString()}`);
        }
      }

      if (parts.length <= 1) {
        parts.push('Analytics data is available but engagement metrics have not been synced yet. Create your content based on the profile data, and analytics will be enriched on the next sync.');
      }

      const synced = records[0]?.synced_at ? new Date(records[0].synced_at).toLocaleString() : 'unknown';
      parts.push(`\n*Last synced: ${synced}*`);

      return { success: true, output: parts.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `Failed to fetch ${platform} analytics: ${err instanceof Error ? err.message : 'unknown error'}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const socialTools: Tool[] = [postToLinkedIn, postToTwitter, postToInstagram, postToFacebook, getSocialAnalytics, checkServiceConnection];
registerTools(socialTools);
