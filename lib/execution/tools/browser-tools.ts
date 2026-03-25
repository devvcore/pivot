/**
 * Browser Automation Tools — Navigate, scrape, fill forms, extract data, monitor changes
 *
 * Lightweight approach for serverless (Firebase Cloud Functions):
 * - Simple scraping: fetch + regex-based HTML parsing (no external deps)
 * - Complex automation: puppeteer-core + @sparticuz/chromium (optional, graceful fallback)
 * - Screenshot: puppeteer-core when available, otherwise returns page metadata
 *
 * Tools self-register via registerTools() at import time.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';
import { createHash } from 'crypto';

// ── HTML Parsing Helpers ─────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
}

function extractMetaDescription(html: string): string {
  const match =
    html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) ??
    html.match(/<meta\s+content=["'](.*?)["']\s+name=["']description["']/i);
  return match?.[1]?.trim() ?? '';
}

function extractMetaOG(html: string): Record<string, string> {
  const og: Record<string, string> = {};
  const regex = /<meta\s+property=["'](og:[^"']+)["']\s+content=["'](.*?)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    og[match[1]] = match[2];
  }
  return og;
}

function extractHeadings(html: string, maxCount = 30): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const regex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && headings.length < maxCount) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push({ level: parseInt(match[1]), text });
  }
  return headings;
}

function extractLinks(html: string, baseUrl: string, maxCount = 50): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && links.length < maxCount) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    let href = match[1];
    // Resolve relative URLs
    if (href.startsWith('/')) {
      try {
        const url = new URL(baseUrl);
        href = `${url.protocol}//${url.host}${href}`;
      } catch { /* keep as-is */ }
    }
    if (href.startsWith('http')) {
      links.push({ text: text || '[no text]', href });
    }
  }
  return links;
}

function extractTextContent(html: string, maxLength = 15000): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength);
}

function extractFormFields(html: string): { name: string; type: string; id: string; label: string; required: boolean }[] {
  const fields: { name: string; type: string; id: string; label: string; required: boolean }[] = [];
  // Extract input, select, textarea elements
  const inputRegex = /<(?:input|select|textarea)\s+([^>]*)>/gi;
  let match;
  while ((match = inputRegex.exec(html)) !== null && fields.length < 50) {
    const attrs = match[1];
    const name = attrs.match(/name=["']([^"']+)["']/)?.[1] ?? '';
    const type = attrs.match(/type=["']([^"']+)["']/)?.[1] ?? 'text';
    const id = attrs.match(/id=["']([^"']+)["']/)?.[1] ?? '';
    const required = /required/i.test(attrs);
    // Try to find associated label
    let label = '';
    if (id) {
      const labelMatch = html.match(new RegExp(`<label[^>]*for=["']${id}["'][^>]*>(.*?)</label>`, 'i'));
      label = labelMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
    }
    if (name || id) {
      fields.push({ name, type, id, label, required });
    }
  }
  return fields;
}

function extractBySelector(html: string, selector: string): string[] {
  const results: string[] = [];

  // Support basic CSS selectors: tag, .class, #id, tag.class, tag#id
  let regex: RegExp | null = null;

  if (selector.startsWith('#')) {
    // ID selector
    const id = selector.slice(1);
    regex = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'gi');
  } else if (selector.startsWith('.')) {
    // Class selector
    const cls = selector.slice(1);
    regex = new RegExp(`<[^>]+class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'gi');
  } else if (selector.includes('.')) {
    // tag.class
    const [tag, cls] = selector.split('.');
    regex = new RegExp(`<${tag}[^>]+class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  } else if (selector.includes('#')) {
    // tag#id
    const [tag, id] = selector.split('#');
    regex = new RegExp(`<${tag}[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  } else {
    // Simple tag selector
    regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
  }

  if (regex) {
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 100) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text) results.push(text);
    }
  }

  return results;
}

// ── Fetch Helper ─────────────────────────────────────────────────────────────

async function fetchPage(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }
): Promise<{ html: string; status: number; headers: Record<string, string>; finalUrl: string }> {
  const timeout = options?.timeout ?? 20000;
  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options?.headers,
    },
    body: options?.body,
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const resHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    resHeaders[key] = value;
  });

  return { html, status: response.status, headers: resHeaders, finalUrl: response.url };
}

// ── Puppeteer Helper (optional, for advanced automation) ─────────────────────

async function launchBrowser(): Promise<{ browser: unknown; page: unknown } | null> {
  try {
    // Try to import puppeteer-core and chromium for serverless
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional peer dependency, gracefully handled
    const chromium = await import('@sparticuz/chromium').catch(() => null);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional peer dependency, gracefully handled
    const puppeteer = await import('puppeteer-core').catch(() => null);

    if (!puppeteer || !chromium) return null;

    const execPath = await (chromium.default?.executablePath?.() ?? chromium.default?.executablePath);
    if (!execPath) return null;

    const browser = await (puppeteer.default?.launch ?? puppeteer.launch)({
      args: chromium.default?.args ?? [],
      defaultViewport: { width: 1280, height: 800 },
      executablePath: execPath,
      headless: true,
    });

    const page = await (browser as { newPage: () => Promise<unknown> }).newPage();
    return { browser, page };
  } catch {
    return null;
  }
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const browseWebsite: Tool = {
  name: 'browse_website',
  description: 'Navigate to a URL and return page content including title, meta description, headings, text content, links, and form fields. Lightweight fetch-based — fast and reliable for most websites.',
  parameters: {
    url: {
      type: 'string',
      description: 'The full URL to browse (must include https:// or http://).',
    },
    extract: {
      type: 'string',
      description: 'What to extract: "all" (default), "text", "headings", "links", "forms", "metadata".',
      enum: ['all', 'text', 'headings', 'links', 'forms', 'metadata'],
    },
    max_content_length: {
      type: 'number',
      description: 'Maximum characters of text content to return. Default: 8000.',
    },
  },
  required: ['url'],
  category: 'web',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) {
      return { success: false, output: 'URL is required.' };
    }

    try {
      const { html, status, finalUrl } = await fetchPage(url);
      const extract = String(args.extract ?? 'all');
      const maxLen = Number(args.max_content_length) || 8000;
      const timestamp = new Date().toISOString();

      const title = extractTitle(html);
      const metaDescription = extractMetaDescription(html);
      const og = extractMetaOG(html);

      const parts: string[] = [
        `## Browse Results`,
        `**URL:** ${finalUrl}`,
        `**Status:** ${status}`,
        `**Title:** ${title}`,
        `**Description:** ${metaDescription}`,
        `**Extracted at:** ${timestamp}`,
      ];

      if (Object.keys(og).length > 0 && (extract === 'all' || extract === 'metadata')) {
        parts.push(`\n**Open Graph:**`);
        for (const [key, val] of Object.entries(og)) {
          parts.push(`  - ${key}: ${val}`);
        }
      }

      if (extract === 'all' || extract === 'headings') {
        const headings = extractHeadings(html);
        if (headings.length > 0) {
          parts.push(`\n**Headings (${headings.length}):**`);
          for (const h of headings) {
            parts.push(`  ${'#'.repeat(h.level)} ${h.text}`);
          }
        }
      }

      if (extract === 'all' || extract === 'text') {
        const text = extractTextContent(html, maxLen);
        parts.push(`\n**Page Content (${text.length} chars):**\n${text}`);
      }

      if (extract === 'all' || extract === 'links') {
        const links = extractLinks(html, url, 30);
        if (links.length > 0) {
          parts.push(`\n**Links (${links.length}):**`);
          for (const l of links.slice(0, 30)) {
            parts.push(`  - [${l.text}](${l.href})`);
          }
        }
      }

      if (extract === 'all' || extract === 'forms') {
        const forms = extractFormFields(html);
        if (forms.length > 0) {
          parts.push(`\n**Form Fields (${forms.length}):**`);
          for (const f of forms) {
            const req = f.required ? ' *required*' : '';
            parts.push(`  - ${f.label || f.name || f.id} (type: ${f.type}, name: "${f.name}")${req}`);
          }
        }
      }

      return {
        success: true,
        output: parts.join('\n'),
        artifacts: [{
          type: 'json',
          name: `browse-${new URL(finalUrl).hostname}.json`,
          content: JSON.stringify({ url: finalUrl, title, metaDescription, og, timestamp }),
        }],
        cost: 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to browse ${url}: ${message}` };
    }
  },
};

const takeScreenshot: Tool = {
  name: 'take_screenshot',
  description: 'Navigate to a URL and take a screenshot. Saves the image to Supabase storage and returns the public URL. Requires puppeteer-core + @sparticuz/chromium. Falls back to page metadata if browser is unavailable.',
  parameters: {
    url: {
      type: 'string',
      description: 'The URL to screenshot.',
    },
    full_page: {
      type: 'boolean',
      description: 'Whether to capture the full scrollable page (default: false, captures viewport only).',
    },
    viewport_width: {
      type: 'number',
      description: 'Viewport width in pixels. Default: 1280.',
    },
    viewport_height: {
      type: 'number',
      description: 'Viewport height in pixels. Default: 800.',
    },
  },
  required: ['url'],
  category: 'web',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) {
      return { success: false, output: 'URL is required.' };
    }

    const fullPage = Boolean(args.full_page ?? false);
    const viewportWidth = Number(args.viewport_width) || 1280;
    const viewportHeight = Number(args.viewport_height) || 800;

    // Try puppeteer first
    const instance = await launchBrowser();
    if (instance) {
      try {
        const page = instance.page as {
          setViewport: (v: { width: number; height: number }) => Promise<void>;
          goto: (url: string, opts: Record<string, unknown>) => Promise<void>;
          screenshot: (opts: Record<string, unknown>) => Promise<Buffer>;
        };
        const browser = instance.browser as { close: () => Promise<void> };

        await page.setViewport({ width: viewportWidth, height: viewportHeight });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const buffer = await page.screenshot({ fullPage, type: 'png' }) as Buffer;
        await browser.close();

        // Upload to Supabase storage
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin');
          const supabase = createAdminClient();
          const fileName = `screenshots/${ctx.orgId}/${ctx.sessionId}/${Date.now()}.png`;

          const { error: uploadError } = await supabase.storage
            .from('artifacts')
            .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage.from('artifacts').getPublicUrl(fileName);
          const publicUrl = urlData?.publicUrl ?? '';

          return {
            success: true,
            output: `Screenshot captured for ${url}\n\n**Image URL:** ${publicUrl}\n**Viewport:** ${viewportWidth}x${viewportHeight}\n**Full page:** ${fullPage}`,
            artifacts: [{ type: 'image', name: `screenshot-${new URL(url).hostname}.png`, content: publicUrl }],
            cost: 0.01,
          };
        } catch (storageErr) {
          const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
          return {
            success: true,
            output: `Screenshot captured but could not upload to storage: ${msg}. Screenshot buffer size: ${buffer.length} bytes.`,
            cost: 0.01,
          };
        }
      } catch (err) {
        const browser = instance.browser as { close: () => Promise<void> };
        await browser.close().catch(() => {});
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, output: `Screenshot failed with browser: ${message}. Falling back to page metadata.` };
      }
    }

    // Fallback: fetch page and return metadata (no screenshot)
    try {
      const { html, finalUrl } = await fetchPage(url);
      const title = extractTitle(html);
      const metaDescription = extractMetaDescription(html);
      const og = extractMetaOG(html);
      const ogImage = og['og:image'] ?? '';

      let output = `Browser automation not available in this environment — returning page metadata instead.\n\n`;
      output += `**URL:** ${finalUrl}\n**Title:** ${title}\n**Description:** ${metaDescription}\n`;
      if (ogImage) {
        output += `**OG Image:** ${ogImage}\n`;
      }
      output += `\nTo enable screenshots, install puppeteer-core and @sparticuz/chromium.`;

      return {
        success: true,
        output,
        cost: 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to access ${url}: ${message}` };
    }
  },
};

const fillAndSubmitForm: Tool = {
  name: 'fill_and_submit_form',
  description: 'Navigate to a URL, fill form fields with provided values, and submit the form. Returns the result page content. Uses fetch-based form submission (POST). For JavaScript-heavy forms, falls back to reporting form structure.',
  parameters: {
    url: {
      type: 'string',
      description: 'The URL of the page containing the form.',
    },
    fields: {
      type: 'object',
      description: 'Key-value pairs of form field names and their values. E.g., {"email": "user@example.com", "name": "John Doe"}',
    },
    submit_url: {
      type: 'string',
      description: 'Optional explicit form action URL. If not provided, will detect from the form element or use the page URL.',
    },
    method: {
      type: 'string',
      description: 'HTTP method for form submission. Default: "POST".',
      enum: ['GET', 'POST'],
    },
  },
  required: ['url', 'fields'],
  category: 'web',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    const fields = args.fields as Record<string, string> | undefined;
    if (!url) return { success: false, output: 'URL is required.' };
    if (!fields || typeof fields !== 'object') return { success: false, output: 'fields must be an object of name→value pairs.' };

    const method = String(args.method ?? 'POST').toUpperCase();

    try {
      // First, fetch the page to understand the form structure
      const { html, finalUrl } = await fetchPage(url);
      const formFields = extractFormFields(html);
      const timestamp = new Date().toISOString();

      // Detect form action URL
      let submitUrl = String(args.submit_url ?? '');
      if (!submitUrl) {
        const actionMatch = html.match(/<form[^>]*action=["']([^"']+)["']/i);
        if (actionMatch) {
          submitUrl = actionMatch[1];
          // Resolve relative URL
          if (submitUrl.startsWith('/')) {
            const baseUrl = new URL(finalUrl);
            submitUrl = `${baseUrl.protocol}//${baseUrl.host}${submitUrl}`;
          } else if (!submitUrl.startsWith('http')) {
            submitUrl = new URL(submitUrl, finalUrl).href;
          }
        } else {
          submitUrl = finalUrl;
        }
      }

      // Try puppeteer for JS-heavy forms
      const instance = await launchBrowser();
      if (instance) {
        try {
          const page = instance.page as {
            goto: (url: string, opts: Record<string, unknown>) => Promise<void>;
            type: (selector: string, value: string) => Promise<void>;
            select: (selector: string, value: string) => Promise<void>;
            click: (selector: string) => Promise<void>;
            waitForNavigation: (opts: Record<string, unknown>) => Promise<void>;
            content: () => Promise<string>;
            url: () => string;
          };
          const browser = instance.browser as { close: () => Promise<void> };

          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

          // Fill fields
          for (const [name, value] of Object.entries(fields)) {
            try {
              await page.type(`[name="${name}"], #${name}`, String(value));
            } catch {
              // Field not found — try alternative selectors
              try {
                await page.type(`input[placeholder*="${name}" i], textarea[placeholder*="${name}" i]`, String(value));
              } catch { /* skip unfound fields */ }
            }
          }

          // Submit
          try {
            await Promise.all([
              page.waitForNavigation({ timeout: 15000 }),
              page.click('button[type="submit"], input[type="submit"], form button:last-of-type'),
            ]);
          } catch { /* navigation timeout is OK — SPA might not navigate */ }

          const resultHtml = await page.content();
          const resultUrl = page.url();
          await browser.close();

          const resultTitle = extractTitle(resultHtml);
          const resultText = extractTextContent(resultHtml, 4000);

          return {
            success: true,
            output: `## Form Submission Result\n\n**Submitted to:** ${resultUrl}\n**Result page title:** ${resultTitle}\n**Submitted at:** ${timestamp}\n**Fields filled:** ${Object.keys(fields).join(', ')}\n\n**Result page content:**\n${resultText}`,
            cost: 0.01,
          };
        } catch (err) {
          const browser = instance.browser as { close: () => Promise<void> };
          await browser.close().catch(() => {});
          // Fall through to fetch-based submission
        }
      }

      // Fetch-based form submission (works for standard HTML forms)
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, String(value));
      }

      if (method === 'GET') {
        const getUrl = `${submitUrl}${submitUrl.includes('?') ? '&' : '?'}${formData.toString()}`;
        const { html: resultHtml, finalUrl: resultUrl } = await fetchPage(getUrl);
        const resultTitle = extractTitle(resultHtml);
        const resultText = extractTextContent(resultHtml, 4000);

        return {
          success: true,
          output: `## Form Submission Result (GET)\n\n**Submitted to:** ${resultUrl}\n**Result page title:** ${resultTitle}\n**Submitted at:** ${timestamp}\n**Fields:** ${Object.keys(fields).join(', ')}\n\n**Result page content:**\n${resultText}`,
          cost: 0.001,
        };
      }

      // POST submission
      const { html: resultHtml, finalUrl: resultUrl } = await fetchPage(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const resultTitle = extractTitle(resultHtml);
      const resultText = extractTextContent(resultHtml, 4000);

      let output = `## Form Submission Result (POST)\n\n`;
      output += `**Submitted to:** ${resultUrl}\n`;
      output += `**Result page title:** ${resultTitle}\n`;
      output += `**Submitted at:** ${timestamp}\n`;
      output += `**Fields submitted:** ${Object.keys(fields).join(', ')}\n`;
      output += `\n**Available form fields on page:**\n`;
      for (const f of formFields) {
        output += `  - ${f.label || f.name} (type: ${f.type}${f.required ? ', required' : ''})\n`;
      }
      output += `\n**Result page content:**\n${resultText}`;

      return {
        success: true,
        output,
        cost: 0.001,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Form submission failed for ${url}: ${message}` };
    }
  },
};

const extractStructuredData: Tool = {
  name: 'extract_structured_data',
  description: 'Navigate to a URL and extract structured data using CSS selectors or a schema. Returns JSON. Useful for extracting prices, product listings, tables, contact info, or any repeating data patterns.',
  parameters: {
    url: {
      type: 'string',
      description: 'The URL to extract data from.',
    },
    selectors: {
      type: 'object',
      description: 'Map of field names to CSS selectors. E.g., {"title": "h1", "price": ".price", "description": ".product-desc"}. Each selector extracts all matching elements.',
    },
    extract_tables: {
      type: 'boolean',
      description: 'Whether to extract all HTML tables as structured data. Default: false.',
    },
    extract_json_ld: {
      type: 'boolean',
      description: 'Whether to extract JSON-LD structured data from the page. Default: true.',
    },
    list_selector: {
      type: 'string',
      description: 'CSS selector for a repeating list container (e.g., ".product-card"). Combined with selectors, extracts data from each list item.',
    },
  },
  required: ['url'],
  category: 'web',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) return { success: false, output: 'URL is required.' };

    const selectors = args.selectors as Record<string, string> | undefined;
    const extractTables = Boolean(args.extract_tables ?? false);
    const extractJsonLd = Boolean(args.extract_json_ld ?? true);
    const listSelector = String(args.list_selector ?? '');

    try {
      const { html, finalUrl } = await fetchPage(url);
      const timestamp = new Date().toISOString();
      const result: Record<string, unknown> = {
        url: finalUrl,
        extracted_at: timestamp,
      };

      // Extract JSON-LD structured data
      if (extractJsonLd) {
        const jsonLdBlocks: unknown[] = [];
        const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = jsonLdRegex.exec(html)) !== null) {
          try {
            jsonLdBlocks.push(JSON.parse(match[1]));
          } catch { /* invalid JSON-LD, skip */ }
        }
        if (jsonLdBlocks.length > 0) {
          result.json_ld = jsonLdBlocks;
        }
      }

      // Extract by CSS selectors
      if (selectors && typeof selectors === 'object') {
        const extracted: Record<string, string[]> = {};
        for (const [fieldName, selector] of Object.entries(selectors)) {
          extracted[fieldName] = extractBySelector(html, String(selector));
        }
        result.selectors = extracted;
      }

      // Extract list items with sub-selectors
      if (listSelector) {
        const listItems = extractBySelector(html, listSelector);
        // For list items, re-extract each item's inner HTML and apply selectors
        const listRegex = new RegExp(
          `<[^>]+class=["'][^"']*\\b${listSelector.replace('.', '')}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`,
          'gi'
        );
        const items: Record<string, string>[] = [];
        let listMatch;
        while ((listMatch = listRegex.exec(html)) !== null && items.length < 50) {
          const itemHtml = listMatch[1];
          const item: Record<string, string> = {};
          if (selectors) {
            for (const [fieldName, selector] of Object.entries(selectors)) {
              const values = extractBySelector(itemHtml, String(selector));
              item[fieldName] = values[0] ?? '';
            }
          } else {
            item.text = itemHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          if (Object.values(item).some(v => v)) items.push(item);
        }
        if (items.length > 0) {
          result.list_items = items;
        } else {
          result.list_items_raw = listItems;
        }
      }

      // Extract tables
      if (extractTables) {
        const tables: { headers: string[]; rows: string[][] }[] = [];
        const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
        let tableMatch;
        while ((tableMatch = tableRegex.exec(html)) !== null && tables.length < 10) {
          const tableHtml = tableMatch[1];
          const headers: string[] = [];
          const thRegex = /<th[^>]*>(.*?)<\/th>/gi;
          let thMatch;
          while ((thMatch = thRegex.exec(tableHtml)) !== null) {
            headers.push(thMatch[1].replace(/<[^>]+>/g, '').trim());
          }

          const rows: string[][] = [];
          const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
          let trMatch;
          while ((trMatch = trRegex.exec(tableHtml)) !== null && rows.length < 100) {
            const cells: string[] = [];
            const tdRegex = /<td[^>]*>(.*?)<\/td>/gi;
            let tdMatch;
            while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
              cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
            }
            if (cells.length > 0) rows.push(cells);
          }

          if (headers.length > 0 || rows.length > 0) {
            tables.push({ headers, rows });
          }
        }
        if (tables.length > 0) result.tables = tables;
      }

      // Extract common structured elements (emails, phones, prices)
      const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
      const phones = html.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) ?? [];
      const prices = html.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [];
      if (emails.length > 0) result.emails = Array.from(new Set(emails)).slice(0, 20);
      if (phones.length > 0) result.phones = Array.from(new Set(phones)).slice(0, 20);
      if (prices.length > 0) result.prices = Array.from(new Set(prices)).slice(0, 50);

      const jsonOutput = JSON.stringify(result, null, 2);
      const summary: string[] = [];
      summary.push(`## Structured Data Extracted from ${new URL(finalUrl).hostname}`);
      summary.push(`**Extracted at:** ${timestamp}`);
      if (result.json_ld) summary.push(`**JSON-LD blocks:** ${(result.json_ld as unknown[]).length}`);
      if (result.selectors) summary.push(`**Selector fields:** ${Object.keys(result.selectors as Record<string, unknown>).join(', ')}`);
      if (result.tables) summary.push(`**Tables found:** ${(result.tables as unknown[]).length}`);
      if (result.emails) summary.push(`**Emails found:** ${(result.emails as string[]).length}`);
      if (result.prices) summary.push(`**Prices found:** ${(result.prices as string[]).join(', ')}`);
      if (result.list_items) summary.push(`**List items:** ${(result.list_items as unknown[]).length}`);

      return {
        success: true,
        output: summary.join('\n') + '\n\n```json\n' + jsonOutput.slice(0, 6000) + '\n```',
        artifacts: [{ type: 'json', name: `extract-${new URL(finalUrl).hostname}.json`, content: jsonOutput }],
        cost: 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Data extraction failed for ${url}: ${message}` };
    }
  },
};

const monitorWebpage: Tool = {
  name: 'monitor_webpage',
  description: 'Check a URL for content changes since the last check. Stores a content hash in Supabase. Returns whether the page changed and what the differences are. Useful for price monitoring, competitor tracking, and content change detection.',
  parameters: {
    url: {
      type: 'string',
      description: 'The URL to monitor for changes.',
    },
    selector: {
      type: 'string',
      description: 'Optional CSS selector to monitor only a specific part of the page (e.g., ".pricing" to monitor just the pricing section).',
    },
    label: {
      type: 'string',
      description: 'A human-readable label for this monitor (e.g., "Competitor X pricing page").',
    },
  },
  required: ['url'],
  category: 'web',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) return { success: false, output: 'URL is required.' };

    const selector = String(args.selector ?? '');
    const label = String(args.label ?? url);
    const timestamp = new Date().toISOString();

    try {
      const { html, finalUrl } = await fetchPage(url);

      // Extract the content to monitor
      let content: string;
      if (selector) {
        const selected = extractBySelector(html, selector);
        content = selected.join('\n');
        if (!content) {
          content = extractTextContent(html, 10000);
        }
      } else {
        content = extractTextContent(html, 10000);
      }

      // Hash the content
      const currentHash = createHash('sha256').update(content).digest('hex');

      // Check previous hash in Supabase storage (JSON file per monitor)
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const monitorId = createHash('md5').update(url + selector).digest('hex');
      const monitorPath = `monitors/${ctx.orgId}/${monitorId}.json`;

      let previousData: { hash: string; content: string; checked_at: string; label: string } | null = null;
      try {
        const { data: fileData } = await supabase.storage
          .from('artifacts')
          .download(monitorPath);
        if (fileData) {
          const text = await fileData.text();
          previousData = JSON.parse(text);
        }
      } catch { /* first check — no previous data */ }

      const isFirstCheck = !previousData;
      const hasChanged = !isFirstCheck && previousData!.hash !== currentHash;

      // Store current state
      const stateJson = JSON.stringify({ hash: currentHash, content: content.slice(0, 5000), checked_at: timestamp, label });
      await supabase.storage
        .from('artifacts')
        .upload(monitorPath, new Blob([stateJson], { type: 'application/json' }), { upsert: true });

      if (isFirstCheck) {
        return {
          success: true,
          output: `## Website Monitor: ${label}\n\n**URL:** ${finalUrl}\n**Status:** First check — baseline recorded\n**Checked at:** ${timestamp}\n**Content hash:** ${currentHash.slice(0, 12)}...\n${selector ? `**Monitoring selector:** ${selector}` : '**Monitoring:** Full page content'}\n\n**Current content preview:**\n${content.slice(0, 2000)}`,
          cost: 0.001,
        };
      }

      if (!hasChanged && previousData) {
        return {
          success: true,
          output: `## Website Monitor: ${label}\n\n**URL:** ${finalUrl}\n**Status:** No changes detected\n**Checked at:** ${timestamp}\n**Previous check:** ${previousData.checked_at}\n**Content hash:** ${currentHash.slice(0, 12)}... (unchanged)`,
          cost: 0.001,
        };
      }

      // Content changed — compute a simple diff
      const prevContent = previousData?.content ?? '';
      const prevCheckedAt = previousData?.checked_at ?? 'unknown';
      const prevHash = previousData?.hash ?? '';
      const prevLines = prevContent.split(/[.!?]\s+/).filter(Boolean);
      const currLines = content.slice(0, 5000).split(/[.!?]\s+/).filter(Boolean);
      const added = currLines.filter(l => !prevLines.some(p => p.includes(l.slice(0, 50))));
      const removed = prevLines.filter(l => !currLines.some(c => c.includes(l.slice(0, 50))));

      let diffOutput = '';
      if (added.length > 0) {
        diffOutput += `\n**Added content:**\n${added.slice(0, 10).map(l => `  + ${l.slice(0, 200)}`).join('\n')}`;
      }
      if (removed.length > 0) {
        diffOutput += `\n**Removed content:**\n${removed.slice(0, 10).map(l => `  - ${l.slice(0, 200)}`).join('\n')}`;
      }

      return {
        success: true,
        output: `## Website Monitor: ${label}\n\n**URL:** ${finalUrl}\n**Status:** CHANGES DETECTED\n**Checked at:** ${timestamp}\n**Previous check:** ${prevCheckedAt}\n**Hash changed:** ${prevHash.slice(0, 12)}... → ${currentHash.slice(0, 12)}...\n${diffOutput}\n\n**Current content preview:**\n${content.slice(0, 2000)}`,
        artifacts: [{
          type: 'json',
          name: `monitor-diff-${new URL(finalUrl).hostname}.json`,
          content: JSON.stringify({ url: finalUrl, changed: true, added, removed, timestamp }),
        }],
        cost: 0.001,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Monitor check failed for ${url}: ${message}` };
    }
  },
};

const runBrowserWorkflow: Tool = {
  name: 'run_browser_workflow',
  description: 'Execute a multi-step browser automation workflow defined as JSON steps. Steps can include: navigate, click, type, wait, extract, screenshot. This is the power tool for complex automation sequences. Falls back to fetch-based execution when puppeteer is unavailable.',
  parameters: {
    steps: {
      type: 'array',
      description: 'Array of workflow steps. Each step has: action ("navigate"|"click"|"type"|"wait"|"extract"|"screenshot"), and action-specific params. E.g., [{"action":"navigate","url":"https://example.com"}, {"action":"type","selector":"#email","value":"test@example.com"}, {"action":"click","selector":"button[type=submit]"}, {"action":"extract","selector":".result"}]',
      items: { type: 'object' },
    },
    name: {
      type: 'string',
      description: 'A descriptive name for this workflow (e.g., "Check competitor pricing").',
    },
  },
  required: ['steps'],
  category: 'web',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const steps = args.steps as Array<Record<string, unknown>> | undefined;
    const workflowName = String(args.name ?? 'Browser Workflow');

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return { success: false, output: 'steps array is required and must not be empty.' };
    }

    if (steps.length > 20) {
      return { success: false, output: 'Maximum 20 steps per workflow.' };
    }

    const timestamp = new Date().toISOString();
    const results: { step: number; action: string; status: string; data?: string }[] = [];

    // Try puppeteer first for full browser automation
    const instance = await launchBrowser();
    if (instance) {
      const page = instance.page as {
        goto: (url: string, opts: Record<string, unknown>) => Promise<void>;
        click: (selector: string) => Promise<void>;
        type: (selector: string, text: string) => Promise<void>;
        waitForSelector: (selector: string, opts: Record<string, unknown>) => Promise<void>;
        waitForTimeout: (ms: number) => Promise<void>;
        evaluate: (fn: () => string) => Promise<string>;
        content: () => Promise<string>;
        screenshot: (opts: Record<string, unknown>) => Promise<Buffer>;
        url: () => string;
      };
      const browser = instance.browser as { close: () => Promise<void> };

      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const action = String(step.action ?? '');

          try {
            switch (action) {
              case 'navigate': {
                const url = String(step.url ?? '');
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                results.push({ step: i + 1, action, status: 'success', data: `Navigated to ${url}` });
                break;
              }
              case 'click': {
                const selector = String(step.selector ?? '');
                await page.click(selector);
                results.push({ step: i + 1, action, status: 'success', data: `Clicked ${selector}` });
                break;
              }
              case 'type': {
                const selector = String(step.selector ?? '');
                const value = String(step.value ?? '');
                await page.type(selector, value);
                results.push({ step: i + 1, action, status: 'success', data: `Typed into ${selector}` });
                break;
              }
              case 'wait': {
                const ms = Number(step.ms ?? 1000);
                const waitSelector = String(step.selector ?? '');
                if (waitSelector) {
                  await page.waitForSelector(waitSelector, { timeout: ms });
                  results.push({ step: i + 1, action, status: 'success', data: `Waited for ${waitSelector}` });
                } else {
                  await page.waitForTimeout(Math.min(ms, 10000));
                  results.push({ step: i + 1, action, status: 'success', data: `Waited ${ms}ms` });
                }
                break;
              }
              case 'extract': {
                const selector = String(step.selector ?? '');
                const html = await page.content();
                const extracted = selector ? extractBySelector(html, selector) : [extractTextContent(html, 4000)];
                results.push({ step: i + 1, action, status: 'success', data: extracted.join('\n').slice(0, 3000) });
                break;
              }
              case 'screenshot': {
                const buffer = await page.screenshot({ type: 'png' });
                results.push({ step: i + 1, action, status: 'success', data: `Screenshot captured (${(buffer as Buffer).length} bytes)` });
                break;
              }
              default:
                results.push({ step: i + 1, action, status: 'skipped', data: `Unknown action: ${action}` });
            }
          } catch (stepErr) {
            const msg = stepErr instanceof Error ? stepErr.message : String(stepErr);
            results.push({ step: i + 1, action, status: 'failed', data: msg });
          }
        }

        await browser.close();
      } catch (err) {
        await browser.close().catch(() => {});
        const message = err instanceof Error ? err.message : String(err);
        results.push({ step: 0, action: 'browser', status: 'error', data: message });
      }
    } else {
      // Fallback: fetch-based execution (supports navigate + extract steps)
      let currentHtml = '';
      let currentUrl = '';

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const action = String(step.action ?? '');

        try {
          switch (action) {
            case 'navigate': {
              const url = String(step.url ?? '');
              const { html, finalUrl } = await fetchPage(url);
              currentHtml = html;
              currentUrl = finalUrl;
              results.push({ step: i + 1, action, status: 'success', data: `Fetched ${finalUrl}` });
              break;
            }
            case 'extract': {
              if (!currentHtml) {
                results.push({ step: i + 1, action, status: 'skipped', data: 'No page loaded. Use a navigate step first.' });
                break;
              }
              const selector = String(step.selector ?? '');
              const extracted = selector
                ? extractBySelector(currentHtml, selector)
                : [extractTextContent(currentHtml, 4000)];
              results.push({ step: i + 1, action, status: 'success', data: extracted.join('\n').slice(0, 3000) });
              break;
            }
            case 'click':
            case 'type':
            case 'screenshot':
              results.push({
                step: i + 1,
                action,
                status: 'skipped',
                data: `"${action}" requires a full browser (puppeteer). Install puppeteer-core + @sparticuz/chromium to enable.`,
              });
              break;
            case 'wait':
              // No-op in fetch mode
              results.push({ step: i + 1, action, status: 'success', data: 'Wait step (no-op in fetch mode).' });
              break;
            default:
              results.push({ step: i + 1, action, status: 'skipped', data: `Unknown action: ${action}` });
          }
        } catch (stepErr) {
          const msg = stepErr instanceof Error ? stepErr.message : String(stepErr);
          results.push({ step: i + 1, action, status: 'failed', data: msg });
        }
      }
    }

    // Format output
    const succeeded = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    let output = `## Workflow: ${workflowName}\n\n`;
    output += `**Executed at:** ${timestamp}\n`;
    output += `**Steps:** ${steps.length} total — ${succeeded} succeeded, ${failed} failed, ${skipped} skipped\n`;
    output += `**Browser:** ${instance ? 'Puppeteer (full)' : 'Fetch-based (limited)'}\n\n`;

    for (const r of results) {
      const icon = r.status === 'success' ? '[OK]' : r.status === 'failed' ? '[FAIL]' : '[SKIP]';
      output += `**Step ${r.step}** (${r.action}) ${icon}\n`;
      if (r.data) output += `${r.data.slice(0, 1000)}\n`;
      output += '\n';
    }

    return {
      success: failed < steps.length, // succeed if at least one step worked
      output,
      artifacts: [{
        type: 'json',
        name: `workflow-${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`,
        content: JSON.stringify({ name: workflowName, timestamp, results }, null, 2),
      }],
      cost: instance ? 0.01 : 0.001,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const browserTools: Tool[] = [
  browseWebsite,
  takeScreenshot,
  fillAndSubmitForm,
  extractStructuredData,
  monitorWebpage,
  runBrowserWorkflow,
];

registerTools(browserTools);
