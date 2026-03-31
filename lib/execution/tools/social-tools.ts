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

// ── Duplicate Post Prevention ────────────────────────────────────────────────
// Track recent posts to prevent double-posting within a short window
const recentPosts = new Map<string, number>(); // hash → timestamp
const DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

function isDuplicatePost(platform: string, content: string): boolean {
  const key = `${platform}:${content.slice(0, 100).toLowerCase().trim()}`;
  const lastPosted = recentPosts.get(key);
  if (lastPosted && Date.now() - lastPosted < DEDUP_WINDOW) return true;
  recentPosts.set(key, Date.now());
  // Clean old entries
  for (const [k, v] of recentPosts) {
    if (Date.now() - v > DEDUP_WINDOW) recentPosts.delete(k);
  }
  return false;
}

// ── Connection Check Helper ──────────────────────────────────────────────────

async function checkConnection(orgId: string, provider: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('integrations')
      .select('status, composio_connected_account_id')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .maybeSingle();

    if (!data) return false;

    // If DB says 'error', it's a known stale connection
    if (data.status === 'error' || data.status === 'pending') return false;

    if (data.status === 'connected') {
      // Quick verification: if we have a composio account ID, verify it's still valid
      if (data.composio_connected_account_id) {
        try {
          const { verifyConnection } = await import('@/lib/integrations/composio');
          await verifyConnection(data.composio_connected_account_id);
          return true;
        } catch {
          // Composio rejected — mark as error so we don't keep checking
          await supabase
            .from('integrations')
            .update({ status: 'error', updated_at: new Date().toISOString() })
            .eq('org_id', orgId)
            .eq('provider', provider);
          console.warn(`[checkConnection] ${provider} marked as 'error' — Composio verification failed for org ${orgId}`);
          return false;
        }
      }
      return true; // No composio ID stored, trust DB
    }

    return false;
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

    if (text.length > 3000) {
      return { success: false, output: `Post is ${text.length} characters — LinkedIn max is 3000. Shorten it and try again.` };
    }

    if (isDuplicatePost('linkedin', text)) {
      return { success: false, output: 'This content was already posted to LinkedIn in the last 5 minutes. Skipping to avoid duplicates.' };
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
      console.error('[LinkedIn] Post failed:', err);
      return { success: false, output: 'LinkedIn post failed. The account may need to be reconnected. Try again.' };
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

    if (isDuplicatePost('twitter', text)) {
      return { success: false, output: 'This content was already posted to Twitter in the last 5 minutes. Skipping to avoid duplicates.' };
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
      console.error('[Twitter] Post failed:', err);
      return { success: false, output: 'Tweet failed. The account may need to be reconnected. Try again.' };
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

    // Validate image URL is accessible before posting
    try {
      const headCheck = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (!headCheck.ok) {
        return { success: false, output: `Image URL is not accessible (HTTP ${headCheck.status}). Generate a new image first or provide a valid public URL.` };
      }
      const contentType = headCheck.headers.get('content-type') ?? '';
      if (!contentType.includes('image')) {
        return { success: false, output: `URL does not point to an image (got ${contentType}). Provide a direct image URL (JPEG or PNG).` };
      }
    } catch {
      return { success: false, output: 'Image URL is not reachable. The URL may have expired. Generate a new image and try again.' };
    }

    // Validate caption length
    if (caption.length > 2200) {
      return { success: false, output: `Caption is ${caption.length} characters — Instagram max is 2200. Shorten the caption and try again.` };
    }

    if (isDuplicatePost('instagram', caption)) {
      return { success: false, output: 'This content was already posted to Instagram in the last 5 minutes. Skipping to avoid duplicates.' };
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
      console.error('[Instagram] Post failed:', err);
      return { success: false, output: 'Instagram post failed. The account may need to be reconnected, or the image URL may have expired. Try again.' };
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
      console.error('[Facebook] Post failed:', err);
      return { success: false, output: 'Facebook post failed. The account may need to be reconnected. Try again.' };
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
      enum: ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube', 'tiktok', 'github', 'gmail', 'slack', 'hubspot', 'jira', 'notion', 'google_sheets', 'google_calendar', 'stripe', 'salesforce', 'quickbooks'],
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

// ── Post to TikTok ──────────────────────────────────────────────────────────
// Ported from windmill-satisfying-videos/tiktok_post_video.py
// Uses TikTok Content Posting API v2 (Direct Post)
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post

const postToTikTok: Tool = {
  name: 'post_to_tiktok',
  description: 'Upload and publish a video to the user\'s TikTok account. Uses TikTok Content Posting API v2 (Direct Post). Requires a TikTok OAuth access token stored via Composio. The video must be provided as a base64-encoded MP4 (from generate_media or stitch_images_to_video). Creates a real TikTok post.',
  parameters: {
    video_data_url: {
      type: 'string',
      description: 'Base64-encoded video as a data URL (data:video/mp4;base64,...) or raw base64 string.',
    },
    title: {
      type: 'string',
      description: 'Video caption with hashtags (max 2200 characters). Include relevant hashtags for reach.',
    },
    privacy_level: {
      type: 'string',
      description: 'Video privacy level.',
      enum: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
    },
  },
  required: ['video_data_url', 'title'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const videoInput = String(args.video_data_url ?? '');
    const title = String(args.title ?? '').slice(0, 2200);
    const privacyLevel = String(args.privacy_level ?? 'SELF_ONLY');

    if (!videoInput) {
      return { success: false, output: 'video_data_url is required. Generate a video first with generate_media or stitch_images_to_video.' };
    }
    if (!title) {
      return { success: false, output: 'Title/caption is required.' };
    }

    // Check TikTok connection
    const connected = await checkConnection(context.orgId, 'tiktok');
    if (!connected) {
      return connectionRequiredResult('tiktok');
    }

    try {
      // Get TikTok access token from Composio
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from('integrations')
        .select('access_token, composio_connected_account_id')
        .eq('org_id', context.orgId)
        .eq('provider', 'tiktok')
        .eq('status', 'connected')
        .maybeSingle();

      if (!integration?.access_token) {
        return { success: false, output: 'TikTok access token not found. Please reconnect TikTok. [connect:tiktok]' };
      }

      const accessToken = integration.access_token;

      // Extract base64 video bytes
      let videoBase64 = videoInput;
      const dataUrlMatch = videoInput.match(/^data:video\/\w+;base64,(.+)$/);
      if (dataUrlMatch) {
        videoBase64 = dataUrlMatch[1];
      }
      const videoBytes = Buffer.from(videoBase64, 'base64');
      const videoSize = videoBytes.length;

      // Step 1: Initialize direct post upload
      const initResp = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title,
            privacy_level: privacyLevel,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          },
        }),
      });

      const initData = await initResp.json() as {
        error?: { code?: string; message?: string; log_id?: string };
        data?: { publish_id?: string; upload_url?: string };
      };
      const errorCode = initData.error?.code ?? '';

      if (errorCode !== 'ok') {
        const errorMsg = initData.error?.message ?? 'Unknown error';
        return { success: false, output: `TikTok upload init failed: ${errorMsg} (code: ${errorCode})` };
      }

      const publishId = initData.data?.publish_id;
      const uploadUrl = initData.data?.upload_url;

      if (!publishId || !uploadUrl) {
        return { success: false, output: 'TikTok init response missing publish_id or upload_url.' };
      }

      // Step 2: Upload video bytes (single chunk)
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoSize),
          'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
        },
        body: videoBytes,
      });

      if (!uploadResp.ok) {
        const uploadErr = await uploadResp.text().catch(() => '');
        return { success: false, output: `TikTok video upload failed: HTTP ${uploadResp.status} — ${uploadErr.slice(0, 200)}` };
      }

      // Step 3: Poll for publish status (max 10 attempts, 5s apart = 50s timeout)
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResp = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: publishId }),
        });

        const statusData = await statusResp.json() as {
          error?: { code?: string; message?: string };
          data?: { status?: string; fail_reason?: string };
        };
        const statusError = statusData.error?.code ?? '';

        if (statusError !== 'ok') {
          return { success: false, output: `TikTok status check failed: ${statusData.error?.message ?? 'Unknown'}` };
        }

        const status = statusData.data?.status ?? '';

        if (status === 'PUBLISH_COMPLETE') {
          return {
            success: true,
            output: `TikTok video published successfully!\n\nCaption: "${title.slice(0, 200)}${title.length > 200 ? '...' : ''}"\nPrivacy: ${privacyLevel}\nPublish ID: ${publishId}`,
            cost: 0,
          };
        } else if (status === 'FAILED' || status === 'PUBLISH_FAILED') {
          const failReason = statusData.data?.fail_reason ?? 'Unknown';
          return { success: false, output: `TikTok publish failed: ${failReason}` };
        }
        // PROCESSING_UPLOAD or PROCESSING_DOWNLOAD — keep polling
      }

      return {
        success: true,
        output: `TikTok video upload submitted (publish_id: ${publishId}). The video is still processing on TikTok's side — it should appear on the account within a few minutes.\n\nCaption: "${title.slice(0, 200)}${title.length > 200 ? '...' : ''}"`,
        cost: 0,
      };
    } catch (err) {
      console.error('[TikTok] Post failed:', err);
      return { success: false, output: 'TikTok post failed. The account may need to be reconnected. Try again.' };
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
      console.error(`[SocialAnalytics] ${platform} fetch failed:`, err);
      return { success: false, output: `Failed to fetch ${platform} analytics. The account may not be connected or data hasn't synced yet.` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const socialTools: Tool[] = [postToLinkedIn, postToTwitter, postToInstagram, postToFacebook, postToTikTok, getSocialAnalytics, checkServiceConnection];
registerTools(socialTools);
