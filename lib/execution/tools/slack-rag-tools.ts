/**
 * Slack RAG Tools — Semantic search across Slack message history.
 *
 * Gives agents the ability to search team conversations for context,
 * decisions, and historical discussions. Answers questions like:
 * "What did the team decide about the pricing change?"
 * "Who was discussing the deployment issue last week?"
 * "Find conversations about the Q2 roadmap"
 */

import { globalRegistry, type ToolResult, type ToolContext } from './index';
import { searchSlackMessages, getThreadMessages } from '@/lib/slack/slack-rag';

function registerTools(tools: any[]) {
  for (const tool of tools) {
    globalRegistry.register(tool);
  }
}

registerTools([
  {
    name: 'search_slack_history',
    description:
      'Search through Slack message history using semantic search. Find relevant conversations, decisions, and context from team communications. Returns messages with channel, author, time, and full text. Use this to find what the team discussed about a topic.',
    parameters: {
      query: {
        type: 'string',
        description:
          'What to search for in Slack history. Be specific. Example: "pricing decision for enterprise tier", "deployment incident last week", "Q2 roadmap discussion"',
      },
      channel: {
        type: 'string',
        description:
          'Optional: limit to a specific channel name (e.g., "engineering", "sales", "general"). Leave empty to search all channels.',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default: 10, max: 20)',
      },
    },
    required: ['query'],
    category: 'data' as const,
    costTier: 'cheap' as const,

    async execute(
      args: Record<string, unknown>,
      context: ToolContext,
    ): Promise<ToolResult> {
      const query = String(args.query ?? '');
      if (!query || query.length < 3) {
        return {
          success: false,
          output: 'Query too short. Provide a specific search query (at least 3 characters).',
        };
      }

      const limit = Math.min(Number(args.limit ?? 10), 20);
      const channel = args.channel ? String(args.channel) : undefined;

      try {
        const results = await searchSlackMessages(context.orgId, query, {
          channel,
          limit,
          minSimilarity: 0.25,
        });

        if (results.length === 0) {
          return {
            success: true,
            output: `No matching Slack messages found for "${query}". The Slack history may not be indexed yet, or try a different search query.`,
          };
        }

        // Format results with context
        const formatted = results
          .map((r, i) => {
            const sim = Math.round(r.similarity * 100);
            const date = r.messageTs
              ? new Date(parseFloat(r.messageTs) * 1000).toISOString().split('T')[0]
              : 'unknown date';
            const time = r.messageTs
              ? new Date(parseFloat(r.messageTs) * 1000).toISOString().split('T')[1]?.slice(0, 5) ?? ''
              : '';
            const threadLabel = r.threadTs ? ' [thread]' : '';
            return `--- Result ${i + 1} (${sim}% match) ---\n#${r.channelName} | ${r.authorName} | ${date} ${time}${threadLabel}\n${r.messageText}`;
          })
          .join('\n\n');

        // Summarize channels and authors
        const channelSet = new Set(results.map(r => r.channelName).filter(Boolean));
        const authorSet = new Set(results.map(r => r.authorName).filter(Boolean));

        return {
          success: true,
          output: `Found ${results.length} relevant Slack messages for "${query}"\nChannels: ${[...channelSet].join(', ') || 'unknown'}\nPeople: ${[...authorSet].join(', ') || 'unknown'}\n\n${formatted}`,
        };
      } catch (err) {
        return {
          success: false,
          output: `Slack history search failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  },
]);
