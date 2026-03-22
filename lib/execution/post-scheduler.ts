import { createAdminClient } from '@/lib/supabase/admin';

interface PublishResult {
  success: boolean;
  url?: string;
  id?: string;
  error?: string;
}

async function publishToLinkedIn(orgId: string, content: string): Promise<PublishResult> {
  try {
    const { createLinkedInPost } = await import('@/lib/integrations/composio-tools');
    const result = await createLinkedInPost(orgId, content);
    return {
      success: true,
      id: result?.id ?? result?.postId ?? result?.data?.id,
      url: result?.url ?? result?.data?.url,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

async function publishToTwitter(orgId: string, content: string): Promise<PublishResult> {
  try {
    const { createTweet } = await import('@/lib/integrations/composio-tools');
    const result = await createTweet(orgId, content);
    return {
      success: true,
      id: result?.id ?? result?.data?.id,
      url: result?.url ?? result?.data?.url,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

async function publishToInstagram(
  orgId: string,
  caption: string,
  imageUrl: string,
): Promise<PublishResult> {
  try {
    const { createInstagramPost } = await import('@/lib/integrations/composio-tools');
    // NOTE: createInstagramPost signature is (orgId, imageUrl, caption)
    const result = await createInstagramPost(orgId, imageUrl, caption);
    return {
      success: true,
      id: result?.id ?? result?.data?.id,
      url: result?.url ?? result?.data?.url,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

async function publishToFacebook(orgId: string, content: string): Promise<PublishResult> {
  try {
    const { getFacebookPages, createFacebookPost } = await import('@/lib/integrations/composio-tools');
    const pagesResult = await getFacebookPages(orgId);
    const pages = pagesResult?.data ?? pagesResult;
    const pageId =
      (Array.isArray(pages) ? pages[0]?.id : pages?.data?.[0]?.id) ??
      pagesResult?.pages?.[0]?.id;

    if (!pageId) {
      return { success: false, error: 'No Facebook page found for this account' };
    }

    const result = await createFacebookPost(orgId, pageId, content);
    return {
      success: true,
      id: result?.id ?? result?.data?.id,
      url: result?.url ?? result?.data?.url,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Publish all scheduled posts that are due.
 * Called by cron endpoint every 5 minutes.
 */
export async function publishDuePosts(): Promise<{
  published: number;
  failed: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let published = 0;
  let failed = 0;

  // 1. Query due scheduled posts
  const { data: posts, error: fetchError } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20);

  if (fetchError) {
    errors.push(`Failed to fetch scheduled posts: ${fetchError.message}`);
    return { published, failed, errors };
  }

  if (!posts || posts.length === 0) {
    return { published, failed, errors };
  }

  // 2. Process each post
  for (const post of posts) {
    // a. Mark as 'posting'
    await supabase
      .from('scheduled_posts')
      .update({ status: 'posting', updated_at: new Date().toISOString() })
      .eq('id', post.id);

    let result: PublishResult;

    // b. Call the appropriate publisher
    switch (post.platform?.toLowerCase()) {
      case 'linkedin':
        result = await publishToLinkedIn(post.org_id, post.content);
        break;
      case 'twitter':
      case 'x':
        result = await publishToTwitter(post.org_id, post.content);
        break;
      case 'instagram': {
        const imageUrl = post.media_urls?.[0] ?? '';
        if (!imageUrl) {
          result = { success: false, error: 'Instagram posts require at least one media URL' };
        } else {
          result = await publishToInstagram(post.org_id, post.content, imageUrl);
        }
        break;
      }
      case 'facebook':
        result = await publishToFacebook(post.org_id, post.content);
        break;
      default:
        result = { success: false, error: `Unsupported platform: ${post.platform}` };
    }

    // c/d. Mark as posted or failed
    if (result.success) {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'posted',
          post_id: result.id ?? null,
          post_url: result.url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      published++;
    } else {
      const errMsg = `[${post.platform}] post ${post.id}: ${result.error}`;
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: result.error ?? 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      errors.push(errMsg);
      failed++;
    }
  }

  return { published, failed, errors };
}
