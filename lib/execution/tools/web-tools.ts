/**
 * Web Tools — Search, scrape, and domain lookup
 *
 * Uses OpenRouter API (proxying Perplexity sonar) for web search.
 * Key in .env as OPENROUTER_API_KEY.
 * Scraping uses fetch + basic HTML extraction.
 * Domain availability via WHOIS lookup.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function webSearchViaOpenRouter(query: string): Promise<{ answer: string; citations: string[] }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { answer: `[Web search not configured] Search query: "${query}" — configure OPENROUTER_API_KEY to enable live search.`, citations: [] };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pivotcommandcenter.com',
        'X-Title': 'Pivot Command Center',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar',
        messages: [
          { role: 'system', content: 'You are a research assistant. Provide concise, factual answers with sources.' },
          { role: 'user', content: query },
        ],
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      return {
        answer: `[Web search unavailable — API returned ${response.status}] Could not search for: "${query}". Use the scrape_website tool to visit specific URLs instead, or use query_analysis to check existing business data.`,
        citations: [],
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? 'No results found.';
    const citations: string[] = data.citations ?? [];

    return { answer: content, citations };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      answer: `[Web search failed: ${message}] Could not search for: "${query}". Use the scrape_website tool to visit specific URLs instead, or use query_analysis to check existing business data.`,
      citations: [],
    };
  }
}

function extractTextFromHTML(html: string): string {
  // Strip script/style tags and their contents
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Strip HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Truncate to reasonable length
  return text.slice(0, 8000);
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const webSearch: Tool = {
  name: 'web_search',
  description: 'Search the web for current market data, competitor information, industry benchmarks, news, or any external information. Returns a synthesized answer with citations.',
  parameters: {
    query: {
      type: 'string',
      description: 'The search query. Be specific about industry, geography, and topic for best results.',
    },
    focus: {
      type: 'string',
      description: 'Optional focus area for the search.',
      enum: ['general', 'business', 'finance', 'technology', 'news'],
    },
  },
  required: ['query'],
  category: 'web',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const query = String(args.query ?? '');
    if (!query) {
      return { success: false, output: 'Search query is required.' };
    }

    const { answer, citations } = await webSearchViaOpenRouter(query);
    const citationsText = citations.length > 0
      ? '\n\nSources:\n' + citations.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : '';

    return {
      success: true,
      output: answer + citationsText,
      cost: 0.001,
    };
  },
};

const scrapeWebsite: Tool = {
  name: 'scrape_website',
  description: 'Scrape a webpage and extract its text content, title, meta description, and key headings. Useful for competitor research, content analysis, and market research.',
  parameters: {
    url: {
      type: 'string',
      description: 'The full URL to scrape (must include https://).',
    },
    extract: {
      type: 'string',
      description: 'What to extract from the page.',
      enum: ['text', 'headings', 'links', 'all'],
    },
  },
  required: ['url'],
  category: 'web',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const url = String(args.url ?? '');
    if (!url) {
      return { success: false, output: 'URL is required.' };
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PivotBot/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return { success: false, output: `Failed to fetch ${url}: HTTP ${response.status}` };
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch?.[1]?.trim() ?? 'No title found';

      // Extract meta description
      const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
        ?? html.match(/<meta\s+content=["'](.*?)["']\s+name=["']description["']/i);
      const metaDescription = metaMatch?.[1]?.trim() ?? 'No meta description';

      // Extract headings
      const headings: string[] = [];
      const headingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
      let match;
      while ((match = headingRegex.exec(html)) !== null && headings.length < 20) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) headings.push(text);
      }

      // Extract body text
      const bodyText = extractTextFromHTML(html);

      const extractMode = String(args.extract ?? 'all');

      let output = `URL: ${url}\nTitle: ${title}\nDescription: ${metaDescription}\n`;

      if (extractMode === 'headings' || extractMode === 'all') {
        output += `\nHeadings:\n${headings.map(h => `  - ${h}`).join('\n')}\n`;
      }

      if (extractMode === 'text' || extractMode === 'all') {
        output += `\nPage Content (first 4000 chars):\n${bodyText.slice(0, 4000)}\n`;
      }

      if (extractMode === 'links' || extractMode === 'all') {
        const links: string[] = [];
        const linkRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gi;
        while ((match = linkRegex.exec(html)) !== null && links.length < 30) {
          const linkText = match[2].replace(/<[^>]+>/g, '').trim();
          links.push(`${linkText || '[no text]'}: ${match[1]}`);
        }
        if (links.length > 0) {
          output += `\nExternal Links:\n${links.map(l => `  - ${l}`).join('\n')}\n`;
        }
      }

      return {
        success: true,
        output,
        artifacts: [{ type: 'json', name: `scrape-${new URL(url).hostname}.json`, content: JSON.stringify({ title, metaDescription, headings, bodyText: bodyText.slice(0, 4000) }) }],
        cost: 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to scrape ${url}: ${message}` };
    }
  },
};

const checkDomainAvailability: Tool = {
  name: 'check_domain_availability',
  description: 'Check if a domain name is available for registration by attempting to resolve its DNS records. Returns availability status and basic DNS info.',
  parameters: {
    domain: {
      type: 'string',
      description: 'The domain name to check (e.g., "mycompany.com").',
    },
  },
  required: ['domain'],
  category: 'web',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const domain = String(args.domain ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) {
      return { success: false, output: 'Domain name is required.' };
    }

    try {
      // Try to fetch the domain to see if it resolves
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`https://${domain}`, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PivotBot/1.0)' },
        });
        clearTimeout(timeout);

        return {
          success: true,
          output: `Domain "${domain}" is TAKEN (resolves to an active website, HTTP ${response.status}).\n\nThe domain appears to be registered and hosting a website. Consider alternative domain names or different TLDs (.io, .co, .ai, .app).`,
          cost: 0,
        };
      } catch (fetchErr) {
        clearTimeout(timeout);

        // Try HTTP as well
        try {
          const response2 = await fetch(`http://${domain}`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PivotBot/1.0)' },
          });

          return {
            success: true,
            output: `Domain "${domain}" is TAKEN (resolves via HTTP, status ${response2.status}). Consider alternative names.`,
            cost: 0,
          };
        } catch {
          // Domain didn't resolve — likely available
          return {
            success: true,
            output: `Domain "${domain}" appears POTENTIALLY AVAILABLE (no website detected at this address).\n\nNote: This is based on DNS/HTTP resolution. For definitive availability, check with a domain registrar (Namecheap, Google Domains, etc.). The domain may be registered but not hosting a website.`,
            cost: 0,
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Domain check failed: ${message}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const webTools: Tool[] = [webSearch, scrapeWebsite, checkDomainAvailability];
registerTools(webTools);
