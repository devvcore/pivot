/**
 * Marketing Execution Tools
 *
 * Social media content, ad copy, landing pages, competitor analysis,
 * email campaigns, and SEO auditing.
 *
 * Uses Gemini Flash for content generation via @google/genai.
 */

import { GoogleGenAI } from '@google/genai';
import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

const FLASH_MODEL = 'gemini-2.5-flash';

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.7, maxOutputTokens: 4000 },
  });
  return response.text ?? '';
}

function getDeliverableContext(context: ToolContext): string {
  if (!context.deliverables) return 'No analysis data available.';
  const d = context.deliverables;
  const parts: string[] = [];

  if (d.marketingStrategy) parts.push(`Marketing Strategy: ${JSON.stringify(d.marketingStrategy).slice(0, 1500)}`);
  if (d.competitorAnalysis) parts.push(`Competitor Analysis: ${JSON.stringify(d.competitorAnalysis).slice(0, 1000)}`);
  if (d.websiteAnalysis) parts.push(`Website Analysis: ${JSON.stringify(d.websiteAnalysis).slice(0, 800)}`);
  if (d.pricingIntelligence) parts.push(`Pricing: ${JSON.stringify(d.pricingIntelligence).slice(0, 500)}`);

  return parts.length > 0 ? parts.join('\n\n') : 'Limited analysis data available.';
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const createSocialPost: Tool = {
  name: 'create_social_post',
  description: 'Generate social media content tailored for specific platforms (LinkedIn, Twitter/X, Instagram, Facebook, TikTok). Creates platform-appropriate copy with hashtags, CTAs, and formatting.',
  parameters: {
    topic: {
      type: 'string',
      description: 'The topic or theme of the post (e.g., "product launch announcement", "industry insight about AI").',
    },
    platforms: {
      type: 'string',
      description: 'Comma-separated platforms to create for (e.g., "linkedin,twitter,instagram").',
    },
    tone: {
      type: 'string',
      description: 'Desired tone of the content.',
      enum: ['professional', 'casual', 'inspirational', 'educational', 'urgent', 'humorous'],
    },
    cta: {
      type: 'string',
      description: 'Call-to-action to include (e.g., "Visit our website", "Book a demo").',
    },
    key_points: {
      type: 'string',
      description: 'Key points to cover, comma-separated.',
    },
  },
  required: ['topic', 'platforms'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const topic = String(args.topic ?? '');
    const platforms = String(args.platforms ?? 'linkedin').split(',').map(p => p.trim());
    const tone = String(args.tone ?? 'professional');
    const cta = args.cta ? String(args.cta) : 'Learn more';
    const keyPoints = args.key_points ? String(args.key_points) : '';

    const businessContext = getDeliverableContext(context);

    const prompt = `You are an expert social media content creator. Generate platform-specific posts for each requested platform.

BUSINESS CONTEXT:
${businessContext}

REQUIREMENTS:
- Topic: ${topic}
- Platforms: ${platforms.join(', ')}
- Tone: ${tone}
- CTA: ${cta}
${keyPoints ? `- Key Points: ${keyPoints}` : ''}

For each platform, create a post that:
- Follows platform-specific best practices (character limits, format, hashtag usage)
- LinkedIn: Professional, longer form (up to 1300 chars), 3-5 hashtags
- Twitter/X: Concise (under 280 chars), 2-3 hashtags, punchy
- Instagram: Visual description + caption (2200 char limit), 15-20 hashtags
- Facebook: Conversational, medium length, 1-2 hashtags
- TikTok: Hook-first, trend-aware, 3-5 hashtags

Output each platform's content under a clear header. Include the CTA naturally.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{ type: 'document', name: `social-posts-${topic.slice(0, 30).replace(/[^a-z0-9]/gi, '-')}.md`, content }],
      cost: 0.01,
    };
  },
};

const createAdCopy: Tool = {
  name: 'create_ad_copy',
  description: 'Generate advertising copy with A/B test variants for Google Ads, Facebook/Meta Ads, or LinkedIn Ads. Includes headlines, descriptions, CTAs, and targeting suggestions.',
  parameters: {
    product_or_service: {
      type: 'string',
      description: 'What you are advertising.',
    },
    platform: {
      type: 'string',
      description: 'Ad platform.',
      enum: ['google_ads', 'facebook_ads', 'linkedin_ads', 'all'],
    },
    target_audience: {
      type: 'string',
      description: 'Who you are targeting (demographics, interests, job titles).',
    },
    unique_selling_points: {
      type: 'string',
      description: 'Key differentiators, comma-separated.',
    },
    budget_range: {
      type: 'string',
      description: 'Monthly ad budget range (e.g., "$500-$2000").',
    },
  },
  required: ['product_or_service', 'platform'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const product = String(args.product_or_service ?? '');
    const platform = String(args.platform ?? 'all');
    const audience = String(args.target_audience ?? 'general audience');
    const usps = String(args.unique_selling_points ?? '');
    const budget = String(args.budget_range ?? 'not specified');
    const businessContext = getDeliverableContext(context);

    const prompt = `You are an expert paid advertising copywriter. Create A/B test ad variants.

BUSINESS CONTEXT:
${businessContext}

REQUIREMENTS:
- Product/Service: ${product}
- Platform: ${platform}
- Target Audience: ${audience}
- USPs: ${usps || 'Not specified — infer from context'}
- Budget Range: ${budget}

For each platform requested, provide:

1. **Variant A** (benefit-focused):
   - Headline(s) (Google: 3 headlines x 30 chars each; Facebook: 1 headline x 40 chars; LinkedIn: 1 headline x 70 chars)
   - Description(s) (Google: 2 x 90 chars; Facebook/LinkedIn: up to 125 chars)
   - CTA button text
   - Display URL path (Google)

2. **Variant B** (urgency/social-proof focused):
   - Same format as above with different angle

3. **Targeting Suggestions**:
   - Keywords (Google) or Interests/Demographics (Facebook/LinkedIn)
   - Negative keywords
   - Recommended bid strategy

4. **Budget Allocation Recommendation** based on their budget range.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{ type: 'document', name: `ad-copy-${platform}.md`, content }],
      cost: 0.01,
    };
  },
};

const createLandingPage: Tool = {
  name: 'create_landing_page',
  description: 'Generate a complete landing page with HTML structure, copy, sections, and conversion-optimized layout. Outputs clean HTML with inline Tailwind CSS classes.',
  parameters: {
    purpose: {
      type: 'string',
      description: 'Landing page purpose (e.g., "lead generation", "product launch", "webinar signup").',
    },
    headline: {
      type: 'string',
      description: 'Main headline for the page.',
    },
    product_or_service: {
      type: 'string',
      description: 'What you are promoting.',
    },
    target_audience: {
      type: 'string',
      description: 'Who this page is for.',
    },
    cta: {
      type: 'string',
      description: 'Primary call-to-action (e.g., "Start Free Trial", "Book Demo").',
    },
  },
  required: ['purpose', 'product_or_service'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const purpose = String(args.purpose ?? '');
    const headline = args.headline ? String(args.headline) : '';
    const product = String(args.product_or_service ?? '');
    const audience = String(args.target_audience ?? 'general audience');
    const cta = String(args.cta ?? 'Get Started');
    const businessContext = getDeliverableContext(context);

    const prompt = `You are an expert landing page designer and conversion copywriter. Create a complete, production-ready landing page.

BUSINESS CONTEXT:
${businessContext}

REQUIREMENTS:
- Purpose: ${purpose}
- Product/Service: ${product}
- Target Audience: ${audience}
- CTA: ${cta}
${headline ? `- Headline: ${headline}` : '- Generate a compelling headline'}

Create a COMPLETE HTML landing page with:
1. Hero section with headline, subheadline, CTA button
2. Problem/Pain point section (3 pain points)
3. Solution section with features (3-4 features with icons described)
4. Social proof section (placeholder testimonials with realistic content)
5. Pricing or offer section
6. FAQ section (4-5 questions)
7. Final CTA section

Use Tailwind CSS classes for styling. Make it responsive.
Include a clean, modern design with good color contrast.
Use placeholder image descriptions in comments where images would go.

Output ONLY the HTML, starting with <!DOCTYPE html>.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: `Landing page generated for "${purpose}" (${product}).\n\nThe complete HTML is available as an artifact. Key sections: Hero, Problem, Solution, Social Proof, Pricing, FAQ, Final CTA.`,
      artifacts: [{ type: 'html', name: `landing-page-${purpose.replace(/[^a-z0-9]/gi, '-')}.html`, content }],
      cost: 0.01,
    };
  },
};

const analyzeCompetitors: Tool = {
  name: 'analyze_competitors',
  description: 'Conduct deep competitor analysis by scraping and analyzing competitor websites. Compares positioning, features, pricing, and provides strategic recommendations.',
  parameters: {
    competitor_urls: {
      type: 'string',
      description: 'Comma-separated URLs of competitors to analyze.',
    },
    focus_areas: {
      type: 'string',
      description: 'What to focus the analysis on.',
      enum: ['positioning', 'pricing', 'features', 'content', 'all'],
    },
    your_product: {
      type: 'string',
      description: 'Brief description of your own product/service for comparison.',
    },
  },
  required: ['competitor_urls'],
  category: 'marketing',
  costTier: 'expensive',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const urls = String(args.competitor_urls ?? '').split(',').map(u => u.trim()).filter(Boolean);
    const focus = String(args.focus_areas ?? 'all');
    const yourProduct = String(args.your_product ?? '');
    const businessContext = getDeliverableContext(context);

    if (urls.length === 0) {
      return { success: false, output: 'At least one competitor URL is required.' };
    }

    // Scrape each competitor
    const scrapedData: { url: string; title: string; text: string }[] = [];

    for (const url of urls.slice(0, 5)) {
      try {
        const response = await fetch(url.startsWith('http') ? url : `https://${url}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PivotBot/1.0)', 'Accept': 'text/html' },
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const html = await response.text();
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000);
          scrapedData.push({ url, title: titleMatch?.[1]?.trim() ?? url, text });
        } else {
          scrapedData.push({ url, title: url, text: `[Could not scrape: HTTP ${response.status}]` });
        }
      } catch {
        scrapedData.push({ url, title: url, text: '[Could not scrape: connection failed]' });
      }
    }

    const prompt = `You are a competitive intelligence analyst. Analyze these competitors and provide strategic recommendations.

BUSINESS CONTEXT:
${businessContext}
${yourProduct ? `\nOUR PRODUCT: ${yourProduct}` : ''}

COMPETITOR DATA:
${scrapedData.map(s => `--- ${s.title} (${s.url}) ---\n${s.text}`).join('\n\n')}

FOCUS: ${focus}

Provide a structured analysis with:

1. **Competitor Overview** — For each competitor:
   - What they offer
   - Their positioning/messaging
   - Target audience
   - Pricing model (if visible)
   - Key strengths
   - Key weaknesses

2. **Comparative Matrix** — Feature/capability comparison table

3. **Positioning Gaps** — Where competitors are weak that we can exploit

4. **Strategic Recommendations** — Top 5 actionable recommendations ranked by impact

5. **Differentiation Opportunities** — How to stand out in this market`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{ type: 'document', name: 'competitor-analysis.md', content }],
      cost: 0.05,
    };
  },
};

const createEmailCampaign: Tool = {
  name: 'create_email_campaign',
  description: 'Design a multi-step email marketing sequence (drip campaign). Generates subject lines, body copy, timing, and segmentation recommendations for each email in the sequence.',
  parameters: {
    campaign_goal: {
      type: 'string',
      description: 'Goal of the campaign (e.g., "onboarding new users", "re-engaging churned customers", "launching new feature").',
    },
    audience_segment: {
      type: 'string',
      description: 'Who receives this campaign.',
    },
    num_emails: {
      type: 'number',
      description: 'Number of emails in the sequence (3-7 recommended).',
    },
    brand_voice: {
      type: 'string',
      description: 'Brand voice description.',
      enum: ['professional', 'friendly', 'bold', 'minimalist', 'luxurious'],
    },
    key_offer: {
      type: 'string',
      description: 'The main offer or value proposition.',
    },
  },
  required: ['campaign_goal', 'audience_segment'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const goal = String(args.campaign_goal ?? '');
    const audience = String(args.audience_segment ?? '');
    const numEmails = Number(args.num_emails ?? 5);
    const voice = String(args.brand_voice ?? 'professional');
    const offer = String(args.key_offer ?? '');
    const businessContext = getDeliverableContext(context);

    const prompt = `You are an expert email marketing strategist. Design a ${numEmails}-email drip campaign.

BUSINESS CONTEXT:
${businessContext}

CAMPAIGN DETAILS:
- Goal: ${goal}
- Audience: ${audience}
- Number of Emails: ${numEmails}
- Brand Voice: ${voice}
${offer ? `- Key Offer: ${offer}` : ''}

For EACH email in the sequence, provide:

1. **Email #N** — [Purpose]
   - **Send Timing**: Day X after trigger (or specific timing)
   - **Subject Line A**: (primary)
   - **Subject Line B**: (A/B test variant)
   - **Preview Text**: (40-90 chars)
   - **Body Copy**: Full email content with sections, CTAs, and formatting
   - **CTA Button Text**: Primary CTA
   - **Design Notes**: Layout suggestions

After all emails, include:
- **Campaign Flow Diagram**: Visual description of triggers and branches
- **Segmentation Rules**: Who gets what and when
- **Expected Metrics**: Open rate, click rate benchmarks
- **A/B Testing Plan**: What to test first`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{ type: 'document', name: `email-campaign-${goal.slice(0, 30).replace(/[^a-z0-9]/gi, '-')}.md`, content }],
      cost: 0.01,
    };
  },
};

const seoAudit: Tool = {
  name: 'seo_audit',
  description: 'Perform an SEO analysis of a website URL. Checks on-page factors, meta tags, content quality, and provides actionable improvement recommendations with priority ranking.',
  parameters: {
    url: {
      type: 'string',
      description: 'Website URL to audit.',
    },
    target_keywords: {
      type: 'string',
      description: 'Comma-separated target keywords to check optimization for.',
    },
    competitor_urls: {
      type: 'string',
      description: 'Comma-separated competitor URLs for comparison.',
    },
  },
  required: ['url'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    const keywords = args.target_keywords ? String(args.target_keywords).split(',').map(k => k.trim()) : [];
    const businessContext = getDeliverableContext(context);

    if (!url) {
      return { success: false, output: 'URL is required for SEO audit.' };
    }

    // Fetch the page
    let pageData = '';
    try {
      const response = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PivotBot/1.0)', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        const html = await response.text();

        // Extract SEO-relevant elements
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
        const h1Matches: string[] = [];
        const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
        let m;
        while ((m = h1Regex.exec(html)) !== null) h1Matches.push(m[1].replace(/<[^>]+>/g, '').trim());

        const h2Matches: string[] = [];
        const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
        while ((m = h2Regex.exec(html)) !== null && h2Matches.length < 10) h2Matches.push(m[1].replace(/<[^>]+>/g, '').trim());

        const imgCount = (html.match(/<img/gi) || []).length;
        const imgAltCount = (html.match(/<img[^>]+alt=["'][^"']+["']/gi) || []).length;
        const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
        const hasOpenGraph = /<meta[^>]+property=["']og:/i.test(html);
        const hasTwitterCard = /<meta[^>]+name=["']twitter:/i.test(html);
        const wordCount = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;

        pageData = `Title: ${titleMatch?.[1]?.trim() ?? 'MISSING'}
Meta Description: ${metaDescMatch?.[1]?.trim() ?? 'MISSING'}
H1 Tags (${h1Matches.length}): ${h1Matches.join(', ') || 'NONE'}
H2 Tags (${h2Matches.length}): ${h2Matches.slice(0, 5).join(', ')}
Images: ${imgCount} total, ${imgAltCount} with alt text
Canonical Tag: ${hasCanonical ? 'Yes' : 'MISSING'}
Open Graph Tags: ${hasOpenGraph ? 'Yes' : 'MISSING'}
Twitter Card: ${hasTwitterCard ? 'Yes' : 'MISSING'}
Estimated Word Count: ${wordCount}`;
      } else {
        pageData = `Could not fetch page: HTTP ${response.status}`;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      pageData = `Could not fetch page: ${errMsg}`;
    }

    const prompt = `You are an expert SEO consultant. Perform a thorough SEO audit.

BUSINESS CONTEXT:
${businessContext}

PAGE DATA:
URL: ${url}
${pageData}
${keywords.length > 0 ? `Target Keywords: ${keywords.join(', ')}` : ''}

Provide a structured SEO audit with:

1. **SEO Score**: 0-100 with letter grade (A-F)

2. **On-Page Factors**:
   - Title tag analysis (length, keyword usage, quality)
   - Meta description analysis
   - Heading structure (H1, H2 hierarchy)
   - Image optimization (alt tags)
   - Content quality & length

3. **Technical SEO**:
   - Canonical tags
   - Open Graph / Social tags
   - Mobile-friendliness assessment
   - Page structure

4. **Content Recommendations**:
   - Keyword optimization suggestions
   - Content gaps to fill
   - Internal linking strategy

5. **Priority Action Items** (ranked 1-10):
   - Quick wins (can fix today)
   - Medium-term improvements
   - Long-term strategy

6. **Keyword Strategy**:
   - Primary keyword recommendations
   - Long-tail opportunities
   - Content topics to target`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{ type: 'document', name: `seo-audit-${new URL(url.startsWith('http') ? url : `https://${url}`).hostname}.md`, content }],
      cost: 0.01,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const marketingTools: Tool[] = [
  createSocialPost,
  createAdCopy,
  createLandingPage,
  analyzeCompetitors,
  createEmailCampaign,
  seoAudit,
];
registerTools(marketingTools);
