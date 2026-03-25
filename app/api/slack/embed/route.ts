/**
 * POST /api/slack/embed
 *
 * Bulk embed Slack message history for an organization.
 * Fetches messages from Slack API via the existing integration,
 * then embeds them all for semantic search via RAG.
 *
 * Body: { orgId: string, daysBack?: number, channelTypes?: string }
 * Returns: { embedded: number, skipped: number, errors: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchSlackMessages } from '@/lib/integrations/slack';
import { embedSlackMessages, type SlackMessageForEmbedding } from '@/lib/slack/slack-rag';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orgId = body.orgId as string;
    const daysBack = Number(body.daysBack ?? 30);
    const channelTypes = (body.channelTypes as string) ?? 'public_channel,private_channel';

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Find the Slack integration for this org
    const supabase = createAdminClient();
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('access_token, metadata')
      .eq('org_id', orgId)
      .eq('provider', 'slack')
      .eq('status', 'connected')
      .maybeSingle();

    if (intError || !integration) {
      return NextResponse.json(
        { error: 'Slack integration not found or not connected for this org.' },
        { status: 404 },
      );
    }

    const accessToken = integration.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No Slack access token available.' },
        { status: 401 },
      );
    }

    // Fetch messages from Slack API
    console.log(`[SlackEmbed] Fetching ${daysBack} days of Slack messages for org ${orgId}...`);
    const messages = await fetchSlackMessages(accessToken, {
      channelTypes,
      daysBack,
      limit: 500, // Per channel limit
    });

    if (messages.length === 0) {
      return NextResponse.json({
        embedded: 0,
        skipped: 0,
        errors: [],
        message: 'No messages found in Slack history.',
      });
    }

    console.log(`[SlackEmbed] Fetched ${messages.length} messages, starting embedding...`);

    // Convert SlackMessage to SlackMessageForEmbedding
    const forEmbedding: SlackMessageForEmbedding[] = messages.map(msg => ({
      channelId: msg.channelId,
      channelName: msg.channelName,
      authorName: msg.senderName,
      authorId: msg.senderId,
      messageText: msg.text,
      threadTs: msg.isThreadReply ? msg.timestamp : null,
      messageTs: msg.timestamp,
    }));

    // Embed all messages
    const result = await embedSlackMessages(orgId, forEmbedding);

    console.log(
      `[SlackEmbed] Done: ${result.embedded} embedded, ${result.skipped} skipped, ${result.errors.length} errors`,
    );

    return NextResponse.json({
      embedded: result.embedded,
      skipped: result.skipped,
      errors: result.errors.slice(0, 10), // Limit error output
      totalFetched: messages.length,
    });
  } catch (err) {
    console.error('[SlackEmbed] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Embedding failed' },
      { status: 500 },
    );
  }
}
