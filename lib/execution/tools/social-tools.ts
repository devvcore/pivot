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

function connectionRequiredResult(provider: string, displayName: string): ToolResult {
  return {
    success: false,
    output: `⚠️ ${displayName} is not connected. The user needs to connect their ${displayName} account before you can post on their behalf.\n\nPlease ask the user to connect ${displayName} by clicking the ${displayName} logo in the connection panel, or direct them to Settings → Integrations → Connect ${displayName}.`,
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
      return connectionRequiredResult('linkedin', 'LinkedIn');
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
      return connectionRequiredResult('twitter', 'X (Twitter)');
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

const checkServiceConnection: Tool = {
  name: 'check_connection',
  description: 'Check if a specific service (LinkedIn, Twitter, GitHub, Gmail, Slack, etc.) is connected for this organization. Use this before attempting to post or take actions on external services.',
  parameters: {
    service: {
      type: 'string',
      description: 'The service to check.',
      enum: ['linkedin', 'twitter', 'github', 'gmail', 'slack', 'hubspot', 'jira', 'notion', 'google_sheets'],
    },
  },
  required: ['service'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const service = String(args.service ?? '');
    if (!service) {
      return { success: false, output: 'Service name is required.' };
    }

    const connected = await checkConnection(context.orgId, service);

    if (connected) {
      return {
        success: true,
        output: `✅ ${service} is connected and ready to use.`,
        cost: 0,
      };
    } else {
      return {
        success: true,
        output: `❌ ${service} is NOT connected. The user needs to connect ${service} before you can take actions on their behalf. Ask them to connect it via Settings → Integrations.`,
        cost: 0,
      };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const socialTools: Tool[] = [postToLinkedIn, postToTwitter, checkServiceConnection];
registerTools(socialTools);
