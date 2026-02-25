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
