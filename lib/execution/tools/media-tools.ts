/**
 * Media Generation Tools — Image & Video creation for social media posts
 *
 * Integrates with the saas-ad-generator service (Remotion-based) for video ads,
 * and OpenBrand API for brand-consistent image generation.
 * Agents can generate media and then post it to social platforms.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';
import { GoogleGenAI } from '@google/genai';

const AD_GENERATOR_URL = process.env.AD_GENERATOR_URL ?? 'http://localhost:3001';
const OPENBRAND_API_KEY = process.env.OPENBRAND_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ── Gemini Imagen Helper ────────────────────────────────────────────────────

/**
 * Generate an image using Gemini Imagen (gemini-2.0-flash-preview-image-generation).
 * Returns { base64, mimeType, dataUrl } on success.
 */
async function generateImageWithGemini(prompt: string): Promise<{
  base64: string;
  mimeType: string;
  dataUrl: string;
}> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: prompt,
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  // Extract image data from the response
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini Imagen returned no candidates');
  }

  const parts = candidates[0].content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error('Gemini Imagen returned no parts in response');
  }

  // Find the part with inline image data
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart || !imagePart.inlineData?.data) {
    // Check if there's a text-only response (e.g. safety refusal)
    const textPart = parts.find((p) => p.text);
    const reason = textPart?.text ?? 'no image data in response';
    throw new Error(`Gemini Imagen did not return image data: ${reason}`);
  }

  const base64 = imagePart.inlineData.data;
  const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return { base64, mimeType, dataUrl };
}

/**
 * Build a detailed image generation prompt from business context.
 */
function buildImagePrompt(args: {
  headline: string;
  description: string;
  targetAudience: string;
  brandColor: string;
  tone: string;
}): string {
  const toneGuide: Record<string, string> = {
    professional: 'clean corporate design with structured layout, subtle gradients',
    casual: 'friendly warm design with rounded shapes and approachable feel',
    bold: 'high-contrast dramatic design with strong typography and vivid colors',
    playful: 'colorful energetic design with dynamic shapes and fun elements',
    minimal: 'minimalist design with lots of whitespace and simple geometric elements',
  };

  return [
    `Create a professional social media post image (1080x1080px square format).`,
    ``,
    `Headline text on the image: "${args.headline}"`,
    `Topic/context: ${args.description}`,
    `Target audience: ${args.targetAudience}`,
    `Primary brand color: ${args.brandColor}`,
    `Design style: ${toneGuide[args.tone] ?? toneGuide.professional}`,
    ``,
    `Requirements:`,
    `- Modern, high-quality social media graphic`,
    `- The headline text must be clearly readable and prominent`,
    `- Use the brand color as the primary accent color`,
    `- Include subtle design elements that relate to the topic`,
    `- No stock photo look — make it feel designed and intentional`,
    `- Suitable for Instagram, LinkedIn, and Facebook posts`,
  ].join('\n');
}

// ── Generate Social Media Image/Video ────────────────────────────────────────

const generateMedia: Tool = {
  name: 'generate_media',
  description: 'Generate a branded image or video ad for social media. For images, uses Gemini Imagen AI to create professional visuals. For videos, uses Remotion-based ad generator. Creates content based on the business brand, product, and target audience. Use this when the user wants to create visual content for Instagram, LinkedIn, Facebook, etc. Returns a data URL (image) or URL (video) that can be passed to posting tools.',
  parameters: {
    type: {
      type: 'string',
      description: 'Type of media to generate: "video_ad" (short video ad), "social_image" (static branded image)',
      enum: ['video_ad', 'social_image'],
    },
    headline: {
      type: 'string',
      description: 'Main headline/hook text for the ad (max 8 words for video, max 15 for image)',
    },
    description: {
      type: 'string',
      description: 'Product/service description to feature',
    },
    target_audience: {
      type: 'string',
      description: 'Who this content is for (e.g. "small business owners", "B2B SaaS founders")',
    },
    pain_or_benefit: {
      type: 'string',
      description: 'The main pain point or benefit to highlight',
    },
    brand_color: {
      type: 'string',
      description: 'Primary brand color as hex (e.g. "#6C5CE7"). Will auto-detect from website if not provided.',
    },
    tone: {
      type: 'string',
      description: 'Tone of the content: professional, casual, bold, playful, minimal',
      enum: ['professional', 'casual', 'bold', 'playful', 'minimal'],
    },
    website_url: {
      type: 'string',
      description: 'Business website URL — used to auto-extract brand colors, fonts, and logo',
    },
  },
  required: ['headline', 'description'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const type = String(args.type ?? 'video_ad');
    const headline = String(args.headline ?? '');
    const description = String(args.description ?? '');
    const targetAudience = String(args.target_audience ?? 'business owners');
    const painOrBenefit = String(args.pain_or_benefit ?? description);
    const brandColor = String(args.brand_color ?? '#6C5CE7');
    const tone = String(args.tone ?? 'professional') as 'professional' | 'casual' | 'bold' | 'playful' | 'minimal';
    const websiteUrl = args.website_url ? String(args.website_url) : undefined;

    if (!headline) {
      return { success: false, output: 'Headline is required for media generation.' };
    }

    try {
      // If website URL provided, research it first for brand context
      let brandTheme: Record<string, unknown> | undefined;
      if (websiteUrl) {
        try {
          const researchRes = await fetch(`${AD_GENERATOR_URL}/api/research`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: websiteUrl }),
            signal: AbortSignal.timeout(15000),
          });
          if (researchRes.ok) {
            const research = await researchRes.json();
            brandTheme = research.theme;
          }
        } catch {
          // Website research failed — continue with provided brand color
        }
      }

      if (type === 'video_ad') {
        // Call the Remotion-based ad generator
        const genRes = await fetch(`${AD_GENERATOR_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saasName: headline.split(' ').slice(0, 3).join(' '),
            description,
            targetCustomer: targetAudience,
            painOrBenefit,
            template: 'SaasAd',
            transparent: 'false',
            theme: JSON.stringify({
              primaryColor: (brandTheme?.primaryColor as string) ?? brandColor,
              tone,
            }),
          }),
          signal: AbortSignal.timeout(120000), // Video rendering can take up to 2 min
        });

        if (!genRes.ok) {
          const err = await genRes.text();
          return { success: false, output: `Video generation failed: ${err}` };
        }

        const result = await genRes.json();
        return {
          success: true,
          output: `Video ad generated successfully!\n\nVideo URL: ${result.videoUrl}\n\nAd Copy:\n- Hook: ${result.copy?.hook ?? headline}\n- Problem: ${result.copy?.problem ?? ''}\n- Solution: ${result.copy?.solutionIntro ?? ''}\n- Benefits: ${result.copy?.benefits?.join(', ') ?? ''}\n- CTA: ${result.copy?.cta ?? 'Get started today'}\n\nYou can now use this video URL with post_to_instagram, post_to_facebook, or post_to_linkedin to publish it.`,
          cost: 0.02,
        };
      }

      // Static image generation — try Gemini Imagen first, then OpenBrand fallback
      if (type === 'social_image') {
        // 1. Try Gemini Imagen (preferred)
        if (GEMINI_API_KEY) {
          try {
            const imagePrompt = buildImagePrompt({
              headline,
              description,
              targetAudience,
              brandColor,
              tone,
            });
            const { dataUrl, mimeType } = await generateImageWithGemini(imagePrompt);
            return {
              success: true,
              output: `Social media image generated with Gemini Imagen!\n\nImage Data URL: ${dataUrl}\nFormat: ${mimeType}\n\nHeadline: ${headline}\nDescription: ${description}\n\nUse this data URL with post_to_instagram(image_url, caption) or post_to_facebook to publish.`,
              cost: 0.02,
            };
          } catch (err) {
            console.warn('[generate_media] Gemini Imagen failed:', err instanceof Error ? err.message : err);
            // Fall through to OpenBrand
          }
        }

        // 2. Fallback: OpenBrand API
        if (OPENBRAND_API_KEY) {
          try {
            const obRes = await fetch('https://api.openbrand.ai/v1/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENBRAND_API_KEY}`,
              },
              body: JSON.stringify({
                prompt: `Create a professional social media post image. Headline: "${headline}". Description: "${description}". Brand color: ${brandColor}. Tone: ${tone}. For: ${targetAudience}.`,
                width: 1080,
                height: 1080,
              }),
              signal: AbortSignal.timeout(30000),
            });

            if (obRes.ok) {
              const obResult = await obRes.json();
              const imageUrl = obResult.url ?? obResult.image_url ?? obResult.data?.url;
              if (imageUrl) {
                return {
                  success: true,
                  output: `Social media image generated!\n\nImage URL: ${imageUrl}\n\nHeadline: ${headline}\nDescription: ${description}\n\nUse this image URL with post_to_instagram(image_url, caption) or post_to_facebook to publish.`,
                  cost: 0.01,
                };
              }
            }
          } catch (err) {
            console.warn('[generate_media] OpenBrand failed:', err instanceof Error ? err.message : err);
          }
        }
      }

      // Fallback: return content plan without generated media
      return {
        success: true,
        output: `Media content plan created (no image generation service available):\n\nHeadline: ${headline}\nDescription: ${description}\nTarget: ${targetAudience}\nTone: ${tone}\nBrand Color: ${brandColor}\n\nTo generate images, ensure GEMINI_API_KEY is set (preferred) or OPENBRAND_API_KEY.\nFor video ads, ensure the ad-generator service is running on ${AD_GENERATOR_URL}.\n\nCaption ready to use with posting tools once media is generated.`,
        cost: 0,
      };
    } catch (err) {
      return {
        success: false,
        output: `Media generation failed: ${err instanceof Error ? err.message : 'unknown error'}. The ad-generator service may not be running.`,
      };
    }
  },
};

// ── Brand Research Tool ──────────────────────────────────────────────────────

const researchBrand: Tool = {
  name: 'research_brand',
  description: 'Research a website to extract brand identity: colors, fonts, logo, tone, product description, and target audience. Use this before generating media to match the brand. Also useful for competitor research and client intelligence.',
  parameters: {
    url: {
      type: 'string',
      description: 'Website URL to research',
    },
  },
  required: ['url'],
  category: 'marketing',
  costTier: 'free',

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) return { success: false, output: 'URL is required.' };

    try {
      const res = await fetch(`${AD_GENERATOR_URL}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        // Fallback: do a basic scrape ourselves
        return { success: false, output: `Brand research service unavailable. Use scrape_website("${url}") as an alternative.` };
      }

      const result = await res.json();
      const theme = result.theme ?? {};
      const form = result.suggestedForm ?? {};
      const raw = result.rawExtraction ?? {};

      return {
        success: true,
        output: [
          `## Brand Research: ${form.saasName ?? raw.title ?? url}`,
          '',
          `**Product:** ${form.description ?? raw.metaDescription ?? 'N/A'}`,
          `**Target:** ${form.targetCustomer ?? 'N/A'}`,
          `**Key Benefit:** ${form.painOrBenefit ?? 'N/A'}`,
          '',
          `**Brand Colors:**`,
          `- Primary: ${theme.primaryColor ?? 'N/A'}`,
          `- Secondary: ${theme.secondaryColor ?? 'N/A'}`,
          `- Background: ${theme.backgroundColor ?? 'N/A'}`,
          '',
          `**Typography:** ${theme.fontFamily ?? 'N/A'}`,
          `**Tone:** ${theme.tone ?? 'N/A'}`,
          `**Logo:** ${theme.logoUrl ?? 'Not detected'}`,
          '',
          `Use these brand details with generate_media to create on-brand social content.`,
        ].join('\n'),
        cost: 0,
      };
    } catch (err) {
      return { success: false, output: `Brand research failed: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Register ────────────────────────────────────────────────────────────────

export const mediaTools: Tool[] = [generateMedia, researchBrand];
registerTools(mediaTools);
