/**
 * RAG Tools — Semantic search across uploaded documents.
 *
 * Gives agents the ability to search and reference original document content,
 * not just pre-computed synthesis sections. Answers questions like:
 * "What did the pitch deck say about TAM?"
 * "Find the revenue numbers from the financial statement"
 * "What does the contract say about payment terms?"
 */

import { globalRegistry, type ToolResult, type ToolContext } from './index';
import { searchDocuments, type SearchResult } from '@/lib/pipeline/embed';

function registerTools(tools: any[]) {
  for (const tool of tools) {
    globalRegistry.register(tool);
  }
}

registerTools([
  {
    name: 'search_documents',
    description: 'Search the original uploaded documents using semantic search. Use this to find specific information, quotes, numbers, or context from the business documents. Returns the most relevant passages with source attribution.',
    parameters: {
      query: {
        type: 'string',
        description: 'What to search for. Be specific. Example: "total addressable market", "payment terms", "revenue projections for Q2"',
      },
      filename: {
        type: 'string',
        description: 'Optional: filter by specific document name (partial match). Example: "pitch deck", "financial", "contract"',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 5, max: 10)',
      },
    },
    required: ['query'],
    category: 'data',
    costTier: 'cheap',

    async execute(
      args: Record<string, unknown>,
      context: ToolContext,
    ): Promise<ToolResult> {
      const query = String(args.query ?? '');
      if (!query || query.length < 3) {
        return { success: false, output: 'Query too short. Provide a specific search query.' };
      }

      const limit = Math.min(Number(args.limit ?? 5), 10);
      const filename = args.filename ? String(args.filename) : undefined;

      try {
        const results = await searchDocuments(context.orgId, query, {
          limit,
          filename,
          minSimilarity: 0.25,
        });

        if (results.length === 0) {
          return {
            success: true,
            output: `No matching content found for "${query}" in the uploaded documents. Try a different query or check if the relevant documents were uploaded.`,
          };
        }

        // Format results with source attribution
        const formatted = results.map((r: SearchResult, i: number) => {
          const sim = Math.round(r.similarity * 100);
          return `--- Result ${i + 1} (${sim}% match) from "${r.filename}" ---\n${r.content}`;
        }).join('\n\n');

        const fileSet = new Set(results.map(r => r.filename));
        const sources = [...fileSet].join(', ');

        return {
          success: true,
          output: `Found ${results.length} relevant passages for "${query}"\nSources: ${sources}\n\n${formatted}`,
        };
      } catch (err) {
        return {
          success: false,
          output: `Document search failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  },

  {
    name: 'list_documents',
    description: 'List all uploaded documents for this organization. Shows filenames, sizes, and categories.',
    parameters: {},
    required: [],
    category: 'data',
    costTier: 'free',

    async execute(
      _args: Record<string, unknown>,
      context: ToolContext,
    ): Promise<ToolResult> {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();

        // Get unique filenames and chunk counts
        const { data } = await supabase
          .from('document_chunks')
          .select('filename, metadata, token_count')
          .eq('org_id', context.orgId);

        if (!data || data.length === 0) {
          return { success: true, output: 'No documents have been indexed yet. Upload documents in the Pivot dashboard to enable document search.' };
        }

        // Aggregate by filename
        const docs: Record<string, { chunks: number; tokens: number; category: string }> = {};
        for (const row of data) {
          const fn = row.filename;
          if (!docs[fn]) docs[fn] = { chunks: 0, tokens: 0, category: (row.metadata as any)?.category ?? 'unknown' };
          docs[fn].chunks++;
          docs[fn].tokens += row.token_count ?? 0;
        }

        const formatted = Object.entries(docs)
          .map(([fn, info]) => `- ${fn} (${info.chunks} chunks, ~${Math.round(info.tokens / 250)} pages, category: ${info.category})`)
          .join('\n');

        return {
          success: true,
          output: `**${Object.keys(docs).length} Indexed Documents:**\n${formatted}`,
        };
      } catch (err) {
        return { success: false, output: `Failed to list documents: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  },
]);
