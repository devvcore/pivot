/**
 * Perplexity Search API — web research for the onboarding agent.
 * Use for industry context, current events, or company info when available.
 * Note: Perplexity may have limited info on companies with little web presence.
 */

export interface PerplexityResult {
  title: string;
  url: string;
  snippet: string;
  date?: string | null;
  last_updated?: string | null;
}

export interface PerplexitySearchResponse {
  results: PerplexityResult[];
  id: string;
  server_time?: string | null;
}

export async function perplexitySearch(
  query: string,
  maxResults = 8
): Promise<PerplexitySearchResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { results: [], id: "" };
  }

  // Detect OpenRouter key (sk-or-*) vs native Perplexity key (pplx-*)
  const isOpenRouter = apiKey.startsWith("sk-or-");

  if (isOpenRouter) {
    return perplexityViaOpenRouter(apiKey, query, maxResults);
  }

  const res = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Perplexity] Search failed:", res.status, err);
    return { results: [], id: "" };
  }

  const data = (await res.json()) as PerplexitySearchResponse;
  return data;
}

async function perplexityViaOpenRouter(
  apiKey: string,
  query: string,
  maxResults: number
): Promise<PerplexitySearchResponse> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [
          {
            role: "system",
            content: `You are a web research assistant. Search for the query and return structured results as a JSON array. Each result should have: title, url, snippet. Return ${maxResults} results max. Return ONLY valid JSON array, no other text.`,
          },
          { role: "user", content: query },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Perplexity/OpenRouter] Failed:", res.status, err);
      return { results: [], id: "" };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data.citations ?? [];

    // Try to parse structured JSON from the response
    let results: PerplexityResult[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        results = (Array.isArray(parsed) ? parsed : []).slice(0, maxResults).map(
          (r: { title?: string; url?: string; snippet?: string }) => ({
            title: r.title ?? "",
            url: r.url ?? "",
            snippet: r.snippet ?? "",
          })
        );
      }
    } catch {
      // Fallback: use citations + content as a single result
      if (citations.length > 0) {
        results = citations.slice(0, maxResults).map((url, i) => ({
          title: `Source ${i + 1}`,
          url,
          snippet: content.slice(0, 200),
        }));
      } else if (content) {
        results = [{ title: "Research", url: "", snippet: content.slice(0, 500) }];
      }
    }

    return { results, id: data.id ?? "" };
  } catch (e) {
    console.error("[Perplexity/OpenRouter] Error:", e);
    return { results: [], id: "" };
  }
}
