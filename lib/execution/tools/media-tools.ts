/**
 * Media Generation Tools — Image & Video creation for social media posts
 *
 * - Gemini Imagen for image generation (primary)
 * - Self-contained brand research (scrape + Gemini analysis, no external server needed)
 * - Image-to-video stitching via ffmpeg for short video compilations
 * - Remotion-based ad generator as optional external service for video ads
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
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
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

// ── Self-contained Brand Research Helpers ────────────────────────────────────
// Ported from saas-ad-generator/researchWebsite.ts — uses regex extraction
// instead of cheerio (no extra dependency) + Gemini for brand analysis.

function extractColorsFromHTML(html: string): string[] {
  const colors = new Set<string>();
  const hexPattern = /#[0-9a-fA-F]{3,8}/g;

  // From inline styles and style blocks
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  const inlineStyles = html.match(/style="[^"]*"/gi) ?? [];
  const allStyleText = [...styleBlocks, ...inlineStyles].join(' ');

  const matches = allStyleText.match(hexPattern);
  if (matches) matches.forEach((c) => colors.add(c.toLowerCase()));

  // Also check CSS custom properties for brand colors
  const cssVarPattern = /--[\w-]*(?:color|brand|primary|accent)[\w-]*:\s*([^;]+)/gi;
  let varMatch;
  while ((varMatch = cssVarPattern.exec(allStyleText)) !== null) {
    const val = varMatch[1].trim();
    const hexMatch = val.match(hexPattern);
    if (hexMatch) hexMatch.forEach((c) => colors.add(c.toLowerCase()));
  }

  // Filter out common non-brand colors
  const nonBrand = new Set([
    '#fff', '#ffffff', '#000', '#000000', '#333', '#333333',
    '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc',
    '#eee', '#eeeeee', '#f5f5f5', '#fafafa',
  ]);
  return Array.from(colors).filter((c) => !nonBrand.has(c));
}

function extractFontsFromHTML(html: string): string[] {
  const fonts = new Set<string>();

  // Google Fonts links
  const googleFontLinks = html.match(/href="[^"]*fonts\.googleapis\.com[^"]*"/gi) ?? [];
  for (const link of googleFontLinks) {
    const familyMatch = link.match(/family=([^&:"]+)/);
    if (familyMatch) {
      fonts.add(familyMatch[1].replace(/\+/g, ' '));
    }
  }

  // font-family in styles
  const fontPattern = /font-family:\s*['"]?([^;'"]+)/gi;
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    let match;
    while ((match = fontPattern.exec(block)) !== null) {
      const family = match[1].split(',')[0].trim().replace(/['"]/g, '');
      if (family && !['inherit', 'sans-serif', 'serif', 'monospace', 'system-ui'].includes(family.toLowerCase())) {
        fonts.add(family);
      }
    }
  }

  return Array.from(fonts);
}

function extractLogoFromHTML(html: string, baseUrl: string): string | undefined {
  // Try common logo patterns
  const patterns = [
    /img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i,
    /img[^>]*alt="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i,
    /img[^>]*src="([^"]+)"[^>]*class="[^"]*logo[^"]*"/i,
    /img[^>]*src="([^"]+)"[^>]*alt="[^"]*logo[^"]*"/i,
    /a[^>]*class="[^"]*logo[^"]*"[^>]*>.*?img[^>]*src="([^"]+)"/i,
    /link[^>]*rel="icon"[^>]*href="([^"]+)"/i,
    /link[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).href;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

function extractBodyText(html: string): string {
  // Remove scripts, styles, nav, footer, header
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  // Strip remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, 2000);
}

/**
 * Self-contained brand research — scrape website + analyze with Gemini.
 * Replaces the dependency on the external saas-ad-generator service.
 */
async function researchWebsiteInline(url: string): Promise<{
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    logoUrl?: string;
    tone: string;
  };
  suggestedForm: {
    saasName: string;
    description: string;
    targetCustomer: string;
    painOrBenefit: string;
  };
  rawExtraction: {
    title: string;
    metaDescription: string;
    ogImage?: string;
    colorsFound: string[];
    fontsFound: string[];
    bodyTextSample: string;
  };
}> {
  // Normalize URL
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${normalizedUrl}: ${response.status}`);
  }

  const html = await response.text();

  // Extract metadata
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? '';

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
    ?? html.match(/<meta\s+content=["'](.*?)["']\s+name=["']description["']/i);
  const metaDescription = metaDescMatch?.[1]?.trim() ?? '';

  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  const ogImage = ogImageMatch?.[1] ?? undefined;

  // Extract colors, fonts, logo, body text
  const colorsFound = extractColorsFromHTML(html);
  const fontsFound = extractFontsFromHTML(html);
  const logoUrl = extractLogoFromHTML(html, normalizedUrl);
  const bodyText = extractBodyText(html);

  const finalTitle = title || ogTitleMatch?.[1] || '';

  // Use Gemini to analyze the extracted data (mirrors saas-ad-generator's GPT-4o analysis)
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set — needed for brand analysis');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const analysisPrompt = `Analyze this website data and extract brand identity information.

URL: ${normalizedUrl}
Page Title: ${finalTitle}
Meta Description: ${metaDescription}
Colors Found in CSS: ${colorsFound.slice(0, 20).join(', ') || 'none detected'}
Fonts Found: ${fontsFound.join(', ') || 'none detected'}
Body Text Sample: ${bodyText.slice(0, 1500)}

Based on this data, determine:
1. The primary brand color (most prominent/signature color, must be a valid hex code)
2. A secondary/accent color (must be a valid hex code)
3. Whether the site uses a dark or light background theme
4. The brand's tone of voice (exactly one of: professional, casual, bold, playful, minimal)
5. The primary font family (with web-safe fallbacks)
6. The product/company name
7. A one-sentence product description
8. Who the target customer is
9. The main pain point or benefit they emphasize

Return ONLY valid JSON with this exact shape:
{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "backgroundColor": "#hex",
  "textColor": "#hex",
  "tone": "professional|casual|bold|playful|minimal",
  "fontFamily": "FontName, fallback, sans-serif",
  "saasName": "string",
  "description": "string",
  "targetCustomer": "string",
  "painOrBenefit": "string"
}

No markdown. No explanation. Only JSON.`;

  const aiResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: analysisPrompt,
    config: {
      maxOutputTokens: 512,
      temperature: 0.1,
    },
  });

  let aiText = aiResponse.text ?? '';
  aiText = aiText.trim();
  // Strip markdown code fences if Gemini wraps the JSON
  if (aiText.startsWith('```')) {
    aiText = aiText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const parsed = JSON.parse(aiText.trim());

  return {
    theme: {
      primaryColor: parsed.primaryColor ?? '#6C5CE7',
      secondaryColor: parsed.secondaryColor ?? '#a29bfe',
      backgroundColor: parsed.backgroundColor ?? '#ffffff',
      textColor: parsed.textColor ?? '#333333',
      fontFamily: parsed.fontFamily ?? 'sans-serif',
      logoUrl: logoUrl || ogImage,
      tone: parsed.tone ?? 'professional',
    },
    suggestedForm: {
      saasName: parsed.saasName ?? finalTitle,
      description: parsed.description ?? metaDescription,
      targetCustomer: parsed.targetCustomer ?? 'business professionals',
      painOrBenefit: parsed.painOrBenefit ?? '',
    },
    rawExtraction: {
      title: finalTitle,
      metaDescription,
      ogImage,
      colorsFound,
      fontsFound,
      bodyTextSample: bodyText.slice(0, 500),
    },
  };
}

// ── Generate Social Media Image/Video ────────────────────────────────────────

const generateMedia: Tool = {
  name: 'generate_media',
  description: 'Generate a branded image or video ad for social media. For images, uses Gemini Imagen AI to create professional visuals. For videos, uses Remotion-based ad generator (requires external service) or generates a sequence of Gemini images. Creates content based on the business brand, product, and target audience. Use this when the user wants to create visual content for Instagram, LinkedIn, Facebook, TikTok, etc. Returns a data URL (image) or URL (video) that can be passed to posting tools.',
  parameters: {
    type: {
      type: 'string',
      description: 'Type of media to generate: "video_ad" (short video ad via Remotion), "social_image" (static branded image via Gemini Imagen)',
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

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const type = String(args.type ?? 'social_image');
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
      // If website URL provided, research it first for brand context (self-contained)
      let resolvedBrandColor = brandColor;
      if (websiteUrl) {
        try {
          const research = await researchWebsiteInline(websiteUrl);
          resolvedBrandColor = research.theme.primaryColor || brandColor;
        } catch {
          // Website research failed — continue with provided brand color
        }
      }

      if (type === 'video_ad') {
        // Try Remotion-based ad generator (external service)
        try {
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
                primaryColor: resolvedBrandColor,
                tone,
              }),
            }),
            signal: AbortSignal.timeout(120000),
          });

          if (genRes.ok) {
            const result = await genRes.json();
            return {
              success: true,
              output: `Video ad generated successfully!\n\nVideo URL: ${result.videoUrl}\n\nAd Copy:\n- Hook: ${result.copy?.hook ?? headline}\n- Problem: ${result.copy?.problem ?? ''}\n- Solution: ${result.copy?.solutionIntro ?? ''}\n- Benefits: ${result.copy?.benefits?.join(', ') ?? ''}\n- CTA: ${result.copy?.cta ?? 'Get started today'}\n\nYou can now use this video URL with post_to_instagram, post_to_facebook, post_to_tiktok, or post_to_linkedin to publish it.`,
              cost: 0.02,
            };
          }
        } catch {
          // Remotion service not running — fall through to image generation
        }

        // Fallback: generate a single image frame instead
        if (GEMINI_API_KEY) {
          const imagePrompt = buildImagePrompt({
            headline,
            description,
            targetAudience,
            brandColor: resolvedBrandColor,
            tone,
          });
          const { dataUrl, mimeType } = await generateImageWithGemini(imagePrompt);
          return {
            success: true,
            output: `Image created for your post.\n\nYou can post this image using post_to_instagram, post_to_facebook, or post_to_linkedin.\n\nImage Data URL: ${dataUrl}`,
            cost: 0.02,
          };
        }

        return {
          success: false,
          output: `Video creation is not available right now. Use type social_image for a static image instead.`,
        };
      }

      // Static image generation — Gemini Imagen (primary), OpenBrand (fallback)
      if (type === 'social_image') {
        if (GEMINI_API_KEY) {
          try {
            const imagePrompt = buildImagePrompt({
              headline,
              description,
              targetAudience,
              brandColor: resolvedBrandColor,
              tone,
            });
            const { dataUrl, mimeType } = await generateImageWithGemini(imagePrompt);
            return {
              success: true,
              output: `Image created!\n\nImage Data URL: ${dataUrl}\nFormat: ${mimeType}\n\nHeadline: ${headline}\nDescription: ${description}\n\nUse this data URL with post_to_instagram(image_url, caption), post_to_facebook, or post_to_tiktok to publish.`,
              cost: 0.02,
            };
          } catch (err) {
            console.warn('[generate_media] Gemini Imagen failed:', err instanceof Error ? err.message : err);
          }
        }

        // Fallback: OpenBrand API
        if (OPENBRAND_API_KEY) {
          try {
            const obRes = await fetch('https://api.openbrand.ai/v1/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENBRAND_API_KEY}`,
              },
              body: JSON.stringify({
                prompt: `Create a professional social media post image. Headline: "${headline}". Description: "${description}". Brand color: ${resolvedBrandColor}. Tone: ${tone}. For: ${targetAudience}.`,
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

      // No image generation available — still provide useful content
      return {
        success: true,
        output: `## Social Media Post Ready\n\n**Caption:**\n${headline}\n\n${description}\n\n**Visual Direction:**\n- Background: ${tone} style with ${resolvedBrandColor} as accent color\n- Text overlay: "${headline}"\n- Suggested dimensions: 1080x1080 (Instagram square)\n- Style: ${tone}, professional, brand-consistent\n\n**Target Audience:** ${targetAudience}\n\nThe caption is ready to use. For the image, you can use Canva or any design tool with the visual direction above. Once you have an image, I can post it to Instagram, LinkedIn, or Facebook for you.`,
        cost: 0,
      };
    } catch (err) {
      return {
        success: false,
        output: `Media generation failed: ${err instanceof Error ? err.message : 'unknown error'}.`,
      };
    }
  },
};

// ── Generate Image Batch (for video stitching) ──────────────────────────────

const generateImageBatch: Tool = {
  name: 'generate_image_batch',
  description: 'Generate multiple images in sequence using Gemini Imagen. Each image gets a different prompt. Useful for creating frames for a short video compilation or a carousel post. Returns an array of base64 images with indices for ordering. Use stitch_images_to_video to combine them into a video afterward.',
  parameters: {
    prompts: {
      type: 'array',
      description: 'Array of image prompts, one per frame. Each generates a 1080x1080 image.',
      items: { type: 'string' },
    },
    style_prefix: {
      type: 'string',
      description: 'Optional style prefix applied to all prompts (e.g. "Minimalist flat illustration: ")',
    },
  },
  required: ['prompts'],
  category: 'marketing',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const prompts = args.prompts as string[] | undefined;
    const stylePrefix = args.style_prefix ? String(args.style_prefix) : '';

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return { success: false, output: 'At least one prompt is required.' };
    }
    if (prompts.length > 10) {
      return { success: false, output: 'Maximum 10 images per batch to stay within budget.' };
    }
    if (!GEMINI_API_KEY) {
      return { success: false, output: 'GEMINI_API_KEY is not set.' };
    }

    const results: { index: number; dataUrl: string; mimeType: string }[] = [];
    const errors: string[] = [];

    // Generate sequentially to avoid rate limits
    for (let i = 0; i < prompts.length; i++) {
      try {
        const fullPrompt = stylePrefix ? `${stylePrefix}${prompts[i]}` : prompts[i];
        const { dataUrl, mimeType } = await generateImageWithGemini(fullPrompt);
        results.push({ index: i, dataUrl, mimeType });
      } catch (err) {
        errors.push(`Frame ${i}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    if (results.length === 0) {
      return { success: false, output: `All image generations failed:\n${errors.join('\n')}` };
    }

    const imageList = results.map((r) => `- Frame ${r.index}: ${r.mimeType} (generated)`).join('\n');

    return {
      success: true,
      output: `Generated ${results.length}/${prompts.length} images.\n\n${imageList}${errors.length > 0 ? `\n\nFailed:\n${errors.join('\n')}` : ''}\n\nImage data URLs are embedded in this response. Use stitch_images_to_video to combine them into a video, or post individually to social platforms.`,
      artifacts: results.map((r) => ({
        type: 'image',
        name: `frame_${r.index}.png`,
        content: r.dataUrl,
      })),
      cost: results.length * 0.02,
    };
  },
};

// ── Stitch Images to Video ──────────────────────────────────────────────────
// Ported from windmill-satisfying-videos/stitch_video.py

const stitchImagesToVideo: Tool = {
  name: 'stitch_images_to_video',
  description: 'Combine multiple images into an MP4 video using ffmpeg. Takes base64-encoded images (from generate_image_batch or generate_media) and stitches them into a short video at the specified framerate. Great for creating slideshows, animated content, or TikTok/Instagram Reels from generated images.',
  parameters: {
    image_data_urls: {
      type: 'array',
      description: 'Array of image data URLs (data:image/png;base64,...) in the order they should appear in the video.',
      items: { type: 'string' },
    },
    fps: {
      type: 'number',
      description: 'Frames per second for the output video. Lower = slower slideshow (default: 2 for 0.5s per image).',
    },
    duration_per_image: {
      type: 'number',
      description: 'Seconds to show each image (default: 3). Overrides fps if provided.',
    },
  },
  required: ['image_data_urls'],
  category: 'marketing',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const dataUrls = args.image_data_urls as string[] | undefined;
    const durationPerImage = args.duration_per_image ? Number(args.duration_per_image) : 3;
    const fps = args.fps ? Number(args.fps) : Math.max(1, Math.round(1 / durationPerImage));

    if (!dataUrls || !Array.isArray(dataUrls) || dataUrls.length < 2) {
      return { success: false, output: 'At least 2 image data URLs are required.' };
    }

    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      const execFileAsync = promisify(execFile);

      // Check if ffmpeg is available
      try {
        await execFileAsync('ffmpeg', ['-version']);
      } catch {
        return {
          success: false,
          output: 'ffmpeg is not installed or not in PATH. Install ffmpeg to use video stitching: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux).',
        };
      }

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pivot-stitch-'));

      try {
        // Write each image to disk
        for (let i = 0; i < dataUrls.length; i++) {
          const dataUrl = dataUrls[i];
          // Extract base64 from data URL
          const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
          if (!base64Match) {
            return { success: false, output: `Image ${i} is not a valid data URL. Expected format: data:image/png;base64,...` };
          }
          const buffer = Buffer.from(base64Match[1], 'base64');
          await fs.writeFile(path.join(tmpDir, `frame_${String(i).padStart(4, '0')}.png`), buffer);
        }

        const outputPath = path.join(tmpDir, 'output.mp4');

        // Use ffmpeg to stitch (same pattern as windmill stitch_video.py)
        // -framerate controls input fps, -r controls output fps for smooth playback
        const effectiveFps = durationPerImage > 0 ? `1/${durationPerImage}` : String(fps);

        await execFileAsync('ffmpeg', [
          '-y',
          '-framerate', effectiveFps,
          '-i', path.join(tmpDir, 'frame_%04d.png'),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-r', '30', // output at 30fps for smooth playback
          outputPath,
        ]);

        // Read output and convert to base64 data URL
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');
        const videoDataUrl = `data:video/mp4;base64,${videoBase64}`;

        const totalDuration = dataUrls.length * durationPerImage;

        return {
          success: true,
          output: `Video created! ${dataUrls.length} frames stitched into ${totalDuration}s MP4.\n\nVideo Data URL: ${videoDataUrl}\n\nYou can post this video using post_to_tiktok, post_to_instagram, or post_to_facebook.`,
          cost: 0.001,
        };
      } finally {
        // Clean up temp directory
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (err) {
      return {
        success: false,
        output: `Video stitching failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      };
    }
  },
};

// ── Brand Research Tool ──────────────────────────────────────────────────────

const researchBrand: Tool = {
  name: 'research_brand',
  description: 'Research a website to extract brand identity: colors, fonts, logo, tone, product description, and target audience. Self-contained — scrapes the website and uses Gemini for brand analysis (no external service required). Use this before generating media to match the brand. Also useful for competitor research and client intelligence.',
  parameters: {
    url: {
      type: 'string',
      description: 'Website URL to research',
    },
  },
  required: ['url'],
  category: 'marketing',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) return { success: false, output: 'URL is required.' };

    try {
      // Self-contained research (no external service needed)
      const result = await researchWebsiteInline(url);
      const theme = result.theme;
      const form = result.suggestedForm;
      const raw = result.rawExtraction;

      return {
        success: true,
        output: [
          `## Brand Research: ${form.saasName || raw.title || url}`,
          '',
          `**Product:** ${form.description || raw.metaDescription || 'N/A'}`,
          `**Target:** ${form.targetCustomer || 'N/A'}`,
          `**Key Benefit:** ${form.painOrBenefit || 'N/A'}`,
          '',
          `**Brand Colors:**`,
          `- Primary: ${theme.primaryColor}`,
          `- Secondary: ${theme.secondaryColor}`,
          `- Background: ${theme.backgroundColor}`,
          `- Text: ${theme.textColor}`,
          '',
          `**Typography:** ${theme.fontFamily}`,
          `**Tone:** ${theme.tone}`,
          `**Logo:** ${theme.logoUrl ?? 'Not detected'}`,
          '',
          `**Raw Extraction:**`,
          `- CSS Colors: ${raw.colorsFound.slice(0, 10).join(', ') || 'none'}`,
          `- Fonts: ${raw.fontsFound.join(', ') || 'none'}`,
          `- OG Image: ${raw.ogImage ?? 'none'}`,
          '',
          `Use these brand details with generate_media to create on-brand social content.`,
        ].join('\n'),
        cost: 0.001,
      };
    } catch (err) {
      return { success: false, output: `Brand research failed: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Register ────────────────────────────────────────────────────────────────

export const mediaTools: Tool[] = [generateMedia, generateImageBatch, stitchImagesToVideo, researchBrand];
registerTools(mediaTools);
