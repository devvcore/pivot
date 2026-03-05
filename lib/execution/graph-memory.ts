/**
 * Graph Memory — Knowledge Graph Backed by Supabase
 *
 * Extracts entities from compaction summaries and stores them
 * in a knowledge graph. Auto-recalls relevant context before
 * each session.send().
 *
 * Tables:
 *  - knowledge_graph_nodes: Stores graph nodes
 *  - knowledge_graph_edges: Stores graph edges
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { MiniGraph } from './mini-graph';
import { extractGraphEntities } from './compaction';
import type { GraphNode, GraphEdge } from './types';

// ── Graph Memory Manager ─────────────────────────────────────────────────────────

export class GraphMemory {
  private orgId: string;
  private graph: MiniGraph;
  private loaded = false;

  constructor(orgId: string) {
    this.orgId = orgId;
    this.graph = new MiniGraph();
  }

  /**
   * Load the org's knowledge graph from Supabase.
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const supabase = createAdminClient();

      // Load nodes
      const { data: nodeRows } = await supabase
        .from('knowledge_graph_nodes')
        .select('*')
        .eq('org_id', this.orgId);

      if (nodeRows) {
        for (const row of nodeRows as Array<{
          id: string;
          label: string;
          type: string;
          aliases: string[];
          properties: Record<string, string>;
        }>) {
          this.graph.addNode({
            id: row.id,
            label: row.label,
            type: row.type,
            aliases: row.aliases ?? [],
            properties: row.properties ?? {},
          });
        }
      }

      // Load edges
      const { data: edgeRows } = await supabase
        .from('knowledge_graph_edges')
        .select('*')
        .eq('org_id', this.orgId);

      if (edgeRows) {
        for (const row of edgeRows as Array<{
          from_id: string;
          to_id: string;
          relation: string;
          weight: number;
          properties: Record<string, string>;
        }>) {
          this.graph.addEdge({
            from: row.from_id,
            to: row.to_id,
            relation: row.relation,
            weight: row.weight ?? 1.0,
            properties: row.properties ?? {},
          });
        }
      }

      this.loaded = true;
      const stats = this.graph.stats();
      console.log(
        `[GraphMemory] Loaded ${stats.nodeCount} nodes, ${stats.edgeCount} edges for org ${this.orgId}`
      );
    } catch (err) {
      console.error('[GraphMemory] Failed to load from Supabase:', err);
      this.loaded = true; // Mark as loaded to avoid retry loops
    }
  }

  /**
   * Process a compaction summary: extract entities and store them.
   */
  async ingestCompactionSummary(summary: string): Promise<GraphNode[]> {
    await this.load();

    // Extract entities using LLM
    const nodes = await extractGraphEntities(summary, this.orgId);

    if (nodes.length === 0) return [];

    // Add to in-memory graph
    for (const node of nodes) {
      this.graph.addNode({
        id: node.id,
        label: node.label,
        type: node.type,
        aliases: node.aliases,
        properties: node.properties,
      });
    }

    // Persist to Supabase
    await this.persistNodes(nodes);

    // Detect and create edges between co-occurring entities
    const edges = this.detectEdges(nodes);
    if (edges.length > 0) {
      await this.persistEdges(edges);
    }

    return nodes;
  }

  /**
   * Recall relevant context for a user message.
   * Searches the knowledge graph and returns formatted context.
   */
  async recall(query: string, maxResults: number = 5): Promise<string> {
    await this.load();

    const results = this.graph.search(query, maxResults);

    if (results.length === 0) return '';

    const lines: string[] = ['## Recalled Knowledge'];

    for (const result of results) {
      const node = result.node;
      let entry = `- **${node.label}** (${node.type})`;

      // Add key properties
      const propEntries = Object.entries(node.properties);
      if (propEntries.length > 0) {
        const props = propEntries
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        entry += ` — ${props}`;
      }

      // Add connected nodes
      const edges = this.graph.getEdges(node.id);
      if (edges.length > 0) {
        const connections = edges
          .slice(0, 3)
          .map((e) => {
            const target = this.graph.getNode(e.to);
            return target ? `${e.relation} → ${target.label}` : null;
          })
          .filter(Boolean);
        if (connections.length > 0) {
          entry += ` [${connections.join(', ')}]`;
        }
      }

      lines.push(entry);
    }

    return lines.join('\n');
  }

  /**
   * Get the in-memory graph for direct access.
   */
  getGraph(): MiniGraph {
    return this.graph;
  }

  /**
   * Get graph statistics.
   */
  stats(): { nodeCount: number; edgeCount: number; typeDistribution: Record<string, number> } {
    return this.graph.stats();
  }

  // ── Persistence ────────────────────────────────────────────────────────────────

  private async persistNodes(nodes: GraphNode[]): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Upsert nodes (merge on conflict)
      const rows = nodes.map((n) => ({
        id: n.id,
        org_id: this.orgId,
        type: n.type,
        label: n.label,
        aliases: n.aliases,
        properties: n.properties,
        source: n.source,
        created_at: n.createdAt,
        updated_at: n.updatedAt,
      }));

      const { error } = await supabase
        .from('knowledge_graph_nodes')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('[GraphMemory] Node persist error:', error.message);
      }
    } catch (err) {
      console.error('[GraphMemory] Node persist failed:', err);
    }
  }

  private async persistEdges(edges: GraphEdge[]): Promise<void> {
    try {
      const supabase = createAdminClient();

      const rows = edges.map((e) => ({
        id: e.id,
        org_id: this.orgId,
        from_id: e.fromId,
        to_id: e.toId,
        relation: e.relation,
        weight: e.weight,
        properties: e.properties,
        created_at: e.createdAt,
      }));

      const { error } = await supabase.from('knowledge_graph_edges').insert(rows);

      if (error) {
        console.error('[GraphMemory] Edge persist error:', error.message);
      }
    } catch (err) {
      console.error('[GraphMemory] Edge persist failed:', err);
    }
  }

  /**
   * Detect edges between co-occurring nodes from the same compaction batch.
   * Nodes extracted together are assumed to be related.
   */
  private detectEdges(nodes: GraphNode[]): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const now = new Date().toISOString();

    // Create "co-mentioned" edges between all pairs in the batch
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        // Only create edges between different types (more meaningful)
        if (a.type === b.type) continue;

        const edgeId = `edge_${a.id}_${b.id}`;
        const relation = inferRelation(a.type, b.type);

        edges.push({
          id: edgeId,
          fromId: a.id,
          toId: b.id,
          relation,
          weight: 1.0,
          properties: {},
          orgId: this.orgId,
          createdAt: now,
        });

        // Add to in-memory graph
        this.graph.addEdge({
          from: a.id,
          to: b.id,
          relation,
          weight: 1.0,
        });
      }
    }

    return edges;
  }
}

/**
 * Infer a relationship label from node types.
 */
function inferRelation(typeA: string, typeB: string): string {
  const pair = [typeA, typeB].sort().join('_');

  const relationMap: Record<string, string> = {
    'company_person': 'employs',
    'company_product': 'offers',
    'company_tool': 'uses',
    'decision_person': 'decided_by',
    'decision_fact': 'based_on',
    'fact_person': 'reported_by',
    'person_preference': 'prefers',
    'company_entity': 'related_to',
    'entity_person': 'associated_with',
    'entity_product': 'includes',
    'entity_tool': 'utilizes',
    'fact_preference': 'influences',
    'product_tool': 'integrates_with',
  };

  return relationMap[pair] ?? 'related_to';
}

// ── Singleton cache per org ──────────────────────────────────────────────────────

const _instances: Map<string, GraphMemory> = new Map();

export function getGraphMemory(orgId: string): GraphMemory {
  let instance = _instances.get(orgId);
  if (!instance) {
    instance = new GraphMemory(orgId);
    _instances.set(orgId, instance);
  }
  return instance;
}
