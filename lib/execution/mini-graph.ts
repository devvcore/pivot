/**
 * Mini-Graph — Pure TypeScript Directed Graph
 *
 * Ported from BetterBot's graph.js. Features:
 *  - Porter-ish stemmer (plurals, -ed, -ing, -tion, -ness, -ment, -able, -ible)
 *  - Stop word filtering
 *  - IDF-weighted text search
 *  - BFS traversal with configurable depth
 *  - Alias support for fuzzy matching
 *  - Merge nodes (update existing, don't duplicate)
 */

// ── Stop Words ───────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'also', 'now', 'then', 'here', 'there', 'where', 'when',
  'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
]);

// ── Stemmer ──────────────────────────────────────────────────────────────────────

/**
 * Porter-ish stemmer for English text.
 * Handles common suffixes to normalize words for search.
 */
export function porterStem(word: string): string {
  if (word.length < 4) return word;

  const rules: Array<[string, string, number]> = [
    // [suffix, replacement, minStemLength]
    ['ational', 'ate', 3],
    ['tional', 'tion', 3],
    ['ization', 'ize', 3],
    ['fulness', 'ful', 3],
    ['ousness', 'ous', 3],
    ['iveness', 'ive', 3],
    ['ibility', 'ible', 3],
    ['ability', 'able', 3],
    ['lessly', 'less', 3],
    ['ement', '', 3],
    ['ment', '', 3],
    ['ness', '', 3],
    ['able', '', 3],
    ['ible', '', 3],
    ['tion', 't', 3],
    ['sion', 's', 3],
    ['ling', 'l', 3],
    ['ally', 'al', 3],
    ['ful', '', 3],
    ['ing', '', 3],
    ['ies', 'i', 3],
    ['ous', '', 3],
    ['ive', '', 3],
    ['ess', '', 3],
    ['ed', '', 3],
    ['ly', '', 3],
    ['er', '', 3],
    ['es', '', 3],
    ['s', '', 3],
  ];

  for (const [suffix, replacement, minLen] of rules) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length) + replacement;
      if (stem.length >= minLen) return stem;
    }
  }

  return word;
}

// ── Tokenization ─────────────────────────────────────────────────────────────────

/**
 * Tokenize and stem text, filtering stop words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(porterStem);
}

// ── Graph Node & Edge ────────────────────────────────────────────────────────────

export interface MiniNode {
  id: string;
  label: string;
  type: string;
  aliases: string[];
  properties: Record<string, string>;
  /** Pre-computed stemmed tokens from label + aliases + property values */
  tokens: string[];
}

export interface MiniEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  properties: Record<string, string>;
}

export interface SearchResult {
  node: MiniNode;
  score: number;
}

// ── Mini-Graph ───────────────────────────────────────────────────────────────────

export class MiniGraph {
  private nodes: Map<string, MiniNode> = new Map();
  private adjacency: Map<string, MiniEdge[]> = new Map();
  private reverseAdjacency: Map<string, MiniEdge[]> = new Map();

  /** IDF cache: token → inverse document frequency */
  private idfCache: Map<string, number> = new Map();
  private idfDirty = true;

  // ── Node Operations ──────────────────────────────────────────────────────────

  /**
   * Add or merge a node. If a node with the same ID exists,
   * merge aliases and properties instead of duplicating.
   */
  addNode(node: {
    id: string;
    label: string;
    type: string;
    aliases?: string[];
    properties?: Record<string, string>;
  }): MiniNode {
    const existing = this.nodes.get(node.id);

    if (existing) {
      return this.mergeNode(existing, node);
    }

    const aliases = node.aliases ?? [];
    const properties = node.properties ?? {};
    const tokens = this.computeTokens(node.label, aliases, properties);

    const newNode: MiniNode = {
      id: node.id,
      label: node.label,
      type: node.type,
      aliases,
      properties,
      tokens,
    };

    this.nodes.set(node.id, newNode);
    this.idfDirty = true;
    return newNode;
  }

  /**
   * Merge new data into an existing node.
   */
  private mergeNode(
    existing: MiniNode,
    update: { label?: string; aliases?: string[]; properties?: Record<string, string> }
  ): MiniNode {
    if (update.label && update.label !== existing.label) {
      existing.label = update.label;
    }

    if (update.aliases) {
      const aliasSet = new Set(existing.aliases);
      for (const alias of update.aliases) {
        aliasSet.add(alias);
      }
      existing.aliases = Array.from(aliasSet);
    }

    if (update.properties) {
      for (const [key, value] of Object.entries(update.properties)) {
        existing.properties[key] = value;
      }
    }

    existing.tokens = this.computeTokens(existing.label, existing.aliases, existing.properties);
    this.idfDirty = true;
    return existing;
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): MiniNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Find a node by label or alias (case-insensitive).
   */
  findByLabel(label: string): MiniNode | undefined {
    const lower = label.toLowerCase();
    for (const node of this.nodes.values()) {
      if (node.label.toLowerCase() === lower) return node;
      for (const alias of node.aliases) {
        if (alias.toLowerCase() === lower) return node;
      }
    }
    return undefined;
  }

  /**
   * Remove a node and all its edges.
   */
  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;

    this.nodes.delete(id);
    this.adjacency.delete(id);
    this.reverseAdjacency.delete(id);

    // Remove edges referencing this node
    for (const [nodeId, edges] of this.adjacency.entries()) {
      this.adjacency.set(
        nodeId,
        edges.filter((e) => e.to !== id)
      );
    }
    for (const [nodeId, edges] of this.reverseAdjacency.entries()) {
      this.reverseAdjacency.set(
        nodeId,
        edges.filter((e) => e.from !== id)
      );
    }

    this.idfDirty = true;
    return true;
  }

  // ── Edge Operations ──────────────────────────────────────────────────────────

  /**
   * Add a directed edge between two nodes.
   */
  addEdge(edge: {
    from: string;
    to: string;
    relation: string;
    weight?: number;
    properties?: Record<string, string>;
  }): MiniEdge {
    const newEdge: MiniEdge = {
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      weight: edge.weight ?? 1.0,
      properties: edge.properties ?? {},
    };

    if (!this.adjacency.has(edge.from)) {
      this.adjacency.set(edge.from, []);
    }
    this.adjacency.get(edge.from)!.push(newEdge);

    if (!this.reverseAdjacency.has(edge.to)) {
      this.reverseAdjacency.set(edge.to, []);
    }
    this.reverseAdjacency.get(edge.to)!.push(newEdge);

    return newEdge;
  }

  /**
   * Get all outgoing edges from a node.
   */
  getEdges(nodeId: string): MiniEdge[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  /**
   * Get all incoming edges to a node.
   */
  getIncomingEdges(nodeId: string): MiniEdge[] {
    return this.reverseAdjacency.get(nodeId) ?? [];
  }

  // ── IDF Computation ──────────────────────────────────────────────────────────

  private computeTokens(
    label: string,
    aliases: string[],
    properties: Record<string, string>
  ): string[] {
    const textParts = [label, ...aliases, ...Object.values(properties)];
    return tokenize(textParts.join(' '));
  }

  private recomputeIDF(): void {
    if (!this.idfDirty) return;

    const N = this.nodes.size;
    if (N === 0) {
      this.idfCache.clear();
      this.idfDirty = false;
      return;
    }

    // Count how many nodes contain each token
    const docFreq: Map<string, number> = new Map();
    for (const node of this.nodes.values()) {
      const uniqueTokens = new Set(node.tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
      }
    }

    // IDF = log(N / df)
    this.idfCache.clear();
    for (const [token, df] of docFreq.entries()) {
      this.idfCache.set(token, Math.log(N / df));
    }

    this.idfDirty = false;
  }

  // ── Search ─────────────────────────────────────────────────────────────────────

  /**
   * Search nodes by text query using IDF-weighted scoring.
   * Returns results sorted by score descending.
   */
  search(query: string, maxResults: number = 10): SearchResult[] {
    this.recomputeIDF();

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const results: SearchResult[] = [];

    for (const node of this.nodes.values()) {
      let score = 0;

      // Count token frequencies in this node
      const tokenFreq: Map<string, number> = new Map();
      for (const token of node.tokens) {
        tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
      }

      for (const qt of queryTokens) {
        const tf = tokenFreq.get(qt) ?? 0;
        if (tf > 0) {
          const idf = this.idfCache.get(qt) ?? 1;
          score += tf * idf;
        }
      }

      // Bonus for exact label match
      if (node.label.toLowerCase().includes(query.toLowerCase())) {
        score += 5;
      }

      // Bonus for alias match
      for (const alias of node.aliases) {
        if (alias.toLowerCase().includes(query.toLowerCase())) {
          score += 3;
          break;
        }
      }

      if (score > 0) {
        results.push({ node, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  // ── BFS Traversal ──────────────────────────────────────────────────────────────

  /**
   * Breadth-first traversal from a starting node, returning all reachable
   * nodes within `maxDepth` hops.
   */
  bfs(startId: string, maxDepth: number = 2): MiniNode[] {
    const visited = new Set<string>();
    const result: MiniNode[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const node = this.nodes.get(current.id);
      if (node) result.push(node);

      if (current.depth < maxDepth) {
        const edges = this.adjacency.get(current.id) ?? [];
        for (const edge of edges) {
          if (!visited.has(edge.to)) {
            queue.push({ id: edge.to, depth: current.depth + 1 });
          }
        }

        // Also traverse reverse edges for undirected-like behavior
        const reverseEdges = this.reverseAdjacency.get(current.id) ?? [];
        for (const edge of reverseEdges) {
          if (!visited.has(edge.from)) {
            queue.push({ id: edge.from, depth: current.depth + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get the subgraph (nodes + edges) reachable from a starting node.
   */
  subgraph(startId: string, maxDepth: number = 2): { nodes: MiniNode[]; edges: MiniEdge[] } {
    const nodes = this.bfs(startId, maxDepth);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: MiniEdge[] = [];

    for (const nodeId of nodeIds) {
      const outEdges = this.adjacency.get(nodeId) ?? [];
      for (const edge of outEdges) {
        if (nodeIds.has(edge.to)) {
          edges.push(edge);
        }
      }
    }

    return { nodes, edges };
  }

  // ── Bulk Operations ────────────────────────────────────────────────────────────

  /**
   * Get all nodes.
   */
  allNodes(): MiniNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges.
   */
  allEdges(): MiniEdge[] {
    const edges: MiniEdge[] = [];
    for (const nodeEdges of this.adjacency.values()) {
      edges.push(...nodeEdges);
    }
    return edges;
  }

  /**
   * Get graph statistics.
   */
  stats(): { nodeCount: number; edgeCount: number; typeDistribution: Record<string, number> } {
    const typeDistribution: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      typeDistribution[node.type] = (typeDistribution[node.type] ?? 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.allEdges().length,
      typeDistribution,
    };
  }

  /**
   * Clear all nodes and edges.
   */
  clear(): void {
    this.nodes.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();
    this.idfCache.clear();
    this.idfDirty = true;
  }

  // ── Serialization ──────────────────────────────────────────────────────────────

  /**
   * Serialize the graph to a JSON-compatible object.
   */
  toJSON(): string {
    return JSON.stringify({
      nodes: Array.from(this.nodes.values()).map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        aliases: n.aliases,
        properties: n.properties,
      })),
      edges: this.allEdges().map((e) => ({
        from: e.from,
        to: e.to,
        relation: e.relation,
        weight: e.weight,
        properties: e.properties,
      })),
    });
  }

  /**
   * Restore a graph from serialized JSON.
   */
  static fromJSON(json: string): MiniGraph {
    const data = JSON.parse(json) as {
      nodes: Array<{
        id: string;
        label: string;
        type: string;
        aliases: string[];
        properties: Record<string, string>;
      }>;
      edges: Array<{
        from: string;
        to: string;
        relation: string;
        weight: number;
        properties: Record<string, string>;
      }>;
    };

    const graph = new MiniGraph();

    for (const node of data.nodes) {
      graph.addNode(node);
    }

    for (const edge of data.edges) {
      graph.addEdge(edge);
    }

    return graph;
  }
}
