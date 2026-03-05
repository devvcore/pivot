/**
 * Tool Registry & Execution System
 *
 * Central registry for all execution tools. Each tool is a typed, executable
 * unit with cost awareness, category tagging, and Gemini function-calling
 * format export.
 *
 * Based on BetterBot's tools.js pattern, adapted for TypeScript + Gemini.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToolCategory =
  | 'web'
  | 'communication'
  | 'data'
  | 'finance'
  | 'marketing'
  | 'hr'
  | 'operations'
  | 'system';

export type CostTier = 'free' | 'cheap' | 'moderate' | 'expensive';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: { type: string };
  default?: unknown;
}

export interface ToolContext {
  orgId: string;
  agentId: string;
  sessionId: string;
  deliverables?: Record<string, unknown>; // MVPDeliverables from analysis
  costTracker: CostTracker;
}

export interface CostTracker {
  totalSpent: number;
  ceiling: number;
  log(tool: string, cost: number): void;
  canAfford(estimatedCost: number): boolean;
}

export interface ToolResult {
  success: boolean;
  output: string;
  artifacts?: ToolArtifact[];
  cost?: number;
}

export interface ToolArtifact {
  type: string;  // 'document' | 'spreadsheet' | 'html' | 'json' | 'email' | 'image'
  name: string;
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required?: string[];
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  category: ToolCategory;
  costTier: CostTier;
}

// ── Cost Tracker Implementation ───────────────────────────────────────────────

export function createCostTracker(ceiling: number): CostTracker {
  const tracker: CostTracker = {
    totalSpent: 0,
    ceiling,
    log(tool: string, cost: number) {
      tracker.totalSpent += cost;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CostTracker] ${tool}: $${cost.toFixed(4)} (total: $${tracker.totalSpent.toFixed(4)}/${tracker.ceiling})`);
      }
    },
    canAfford(estimatedCost: number) {
      return tracker.totalSpent + estimatedCost <= tracker.ceiling;
    },
  };
  return tracker;
}

// ── Tool Registry ─────────────────────────────────────────────────────────────

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getByCategory(category: ToolCategory): Tool[] {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  getForOutfit(outfitName: string): Tool[] {
    // Dynamically resolve from outfit definitions
    // This is a forward reference; outfits.ts will use tool names
    const outfitTools = OUTFIT_TOOL_MAP[outfitName];
    if (!outfitTools) return [];
    return outfitTools
      .map(name => this.tools.get(name))
      .filter((t): t is Tool => t !== undefined);
  }

  listAll(): { name: string; description: string; category: string; costTier: string }[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      costTier: t.costTier,
    }));
  }

  getByNames(names: string[]): Tool[] {
    return names
      .map(n => this.tools.get(n))
      .filter((t): t is Tool => t !== undefined);
  }

  /**
   * Export tools in Gemini function-calling format.
   * Uses `parametersJsonSchema` which accepts standard JSON Schema objects,
   * avoiding the need to use Gemini's `Type` enum.
   * See: https://ai.google.dev/gemini-api/docs/function-calling
   */
  toGeminiFunctionDeclarations(toolNames?: string[]): GeminiFunctionDeclaration[] {
    const tools = toolNames
      ? this.getByNames(toolNames)
      : Array.from(this.tools.values());

    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
              ...(param.items ? { items: param.items } : {}),
            },
          ])
        ),
        required: tool.required ?? [],
      },
    }));
  }

  /**
   * Execute a tool by name with cost checking.
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: `Unknown tool: ${name}` };
    }

    // Cost check
    const estimatedCost = COST_ESTIMATES[tool.costTier];
    if (!context.costTracker.canAfford(estimatedCost)) {
      return {
        success: false,
        output: `Budget exceeded. Tool "${name}" estimated at $${estimatedCost.toFixed(2)}, but only $${(context.costTracker.ceiling - context.costTracker.totalSpent).toFixed(2)} remaining.`,
      };
    }

    try {
      const result = await tool.execute(args, context);
      context.costTracker.log(name, result.cost ?? estimatedCost);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Tool "${name}" failed: ${message}`,
      };
    }
  }
}

// ── Gemini Format Types ───────────────────────────────────────────────────────

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// ── Cost Estimates by Tier ────────────────────────────────────────────────────

const COST_ESTIMATES: Record<CostTier, number> = {
  free: 0,
  cheap: 0.001,
  moderate: 0.01,
  expensive: 0.05,
};

// ── Outfit Tool Map (populated by outfits.ts at import time) ──────────────────

export const OUTFIT_TOOL_MAP: Record<string, string[]> = {};

// ── Global Registry Singleton ─────────────────────────────────────────────────

export const globalRegistry = new ToolRegistry();

// ── Registration helper ───────────────────────────────────────────────────────

export function registerTools(tools: Tool[]): void {
  for (const tool of tools) {
    globalRegistry.register(tool);
  }
}
