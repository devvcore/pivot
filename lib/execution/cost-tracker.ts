/**
 * Cost Tracker — Per-Agent Token & Cost Accounting
 *
 * Tracks LLM usage per agent with daily budgets.
 * Stores data in Supabase for persistence and org-level reporting.
 *
 * Cost per model (approximate, per 1M tokens):
 *  - gemini-2.5-flash: $0.15 input / $0.60 output
 *  - claude-sonnet:    $3.00 input / $15.00 output
 *  - gpt-4o:           $2.50 input / $10.00 output
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AgentCostSummary,
  OrgCostSummary,
  ModelCostEntry,
} from './types';
import { MODEL_PRICING } from './types';

// ── In-Memory Ledger Entry ───────────────────────────────────────────────────────

interface UsageEntry {
  agentId: string;
  orgId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: string;
}

// ── Cost Tracker ─────────────────────────────────────────────────────────────────

export class CostTracker {
  /**
   * In-memory buffer of usage entries for the current process.
   * Flushed to Supabase periodically or on demand.
   */
  private buffer: UsageEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs = 10_000; // 10 seconds

  /**
   * Per-agent daily cost accumulator (in-memory for fast budget checks).
   * Key: `${agentId}:${dateStr}`
   */
  private dailyCosts: Map<string, number> = new Map();

  /**
   * Per-agent total cost accumulator.
   */
  private totalCosts: Map<string, number> = new Map();

  /**
   * Per-agent per-model breakdown.
   */
  private modelBreakdown: Map<string, Record<string, ModelCostEntry>> = new Map();

  constructor() {
    // Schedule periodic flush
    this.scheduleFlush();
  }

  /**
   * Track a usage event for an agent.
   */
  trackUsage(
    agentId: string,
    usage: { inputTokens: number; outputTokens: number; model: string },
    orgId: string = 'default'
  ): void {
    const cost = this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString();

    // Update in-memory accumulators
    const dailyKey = `${agentId}:${dateStr}`;
    this.dailyCosts.set(dailyKey, (this.dailyCosts.get(dailyKey) ?? 0) + cost);
    this.totalCosts.set(agentId, (this.totalCosts.get(agentId) ?? 0) + cost);

    // Update model breakdown
    if (!this.modelBreakdown.has(agentId)) {
      this.modelBreakdown.set(agentId, {});
    }
    const breakdown = this.modelBreakdown.get(agentId)!;
    if (!breakdown[usage.model]) {
      breakdown[usage.model] = { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 };
    }
    breakdown[usage.model].inputTokens += usage.inputTokens;
    breakdown[usage.model].outputTokens += usage.outputTokens;
    breakdown[usage.model].cost += cost;
    breakdown[usage.model].calls += 1;

    // Buffer for async flush (cap at 10k entries to prevent memory leak)
    if (this.buffer.length >= 10_000) {
      console.warn('[CostTracker] Buffer full (10k entries), dropping oldest 1000');
      this.buffer.splice(0, 1000);
    }
    this.buffer.push({
      agentId,
      orgId,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost,
      timestamp,
    });
  }

  /**
   * Get cost summary for a specific agent.
   */
  getAgentCost(agentId: string): AgentCostSummary {
    const dateStr = new Date().toISOString().slice(0, 10);
    const dailyKey = `${agentId}:${dateStr}`;

    const breakdown = this.modelBreakdown.get(agentId) ?? {};
    const byModel: Record<string, number> = {};
    for (const [model, entry] of Object.entries(breakdown)) {
      byModel[model] = Math.round(entry.cost * 1_000_000) / 1_000_000;
    }

    return {
      today: Math.round((this.dailyCosts.get(dailyKey) ?? 0) * 1_000_000) / 1_000_000,
      total: Math.round((this.totalCosts.get(agentId) ?? 0) * 1_000_000) / 1_000_000,
      byModel,
    };
  }

  /**
   * Check if an agent has exceeded its daily budget.
   */
  isOverBudget(agentId: string, dailyLimit: number): boolean {
    const dateStr = new Date().toISOString().slice(0, 10);
    const dailyKey = `${agentId}:${dateStr}`;
    return (this.dailyCosts.get(dailyKey) ?? 0) >= dailyLimit;
  }

  /**
   * Get aggregated costs for an organization.
   */
  getOrgCosts(orgId: string): OrgCostSummary {
    const dateStr = new Date().toISOString().slice(0, 10);
    let todayTotal = 0;
    let grandTotal = 0;
    const byAgent: Record<string, number> = {};

    // Scan buffer entries for this org
    const orgAgents = new Set<string>();
    for (const entry of this.buffer) {
      if (entry.orgId === orgId) {
        orgAgents.add(entry.agentId);
      }
    }

    for (const agentId of orgAgents) {
      const dailyKey = `${agentId}:${dateStr}`;
      const todayCost = this.dailyCosts.get(dailyKey) ?? 0;
      const totalCost = this.totalCosts.get(agentId) ?? 0;
      todayTotal += todayCost;
      grandTotal += totalCost;
      byAgent[agentId] = Math.round(totalCost * 1_000_000) / 1_000_000;
    }

    return {
      today: Math.round(todayTotal * 1_000_000) / 1_000_000,
      total: Math.round(grandTotal * 1_000_000) / 1_000_000,
      byAgent,
    };
  }

  /**
   * Get detailed model breakdown for an agent.
   */
  getModelBreakdown(agentId: string): Record<string, ModelCostEntry> {
    return { ...(this.modelBreakdown.get(agentId) ?? {}) };
  }

  /**
   * Calculate cost for a given model and token counts.
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] ?? this.findPricing(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
    return inputCost + outputCost;
  }

  private findPricing(model: string): { inputPerMillion: number; outputPerMillion: number } {
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (model.startsWith(key) || key.startsWith(model)) return pricing;
    }
    // Conservative default
    return { inputPerMillion: 0.15, outputPerMillion: 0.60 };
  }

  /**
   * Flush buffered entries to Supabase.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from('execution_costs').insert(
        entries.map((e) => ({
          agent_id: e.agentId,
          org_id: e.orgId,
          model: e.model,
          input_tokens: e.inputTokens,
          output_tokens: e.outputTokens,
          cost_usd: e.cost,
          created_at: e.timestamp,
        }))
      );

      if (error) {
        // Put entries back if flush failed
        console.error('[CostTracker] Flush failed:', error.message);
        this.buffer.unshift(...entries);
      }
    } catch (err) {
      // Put entries back on error
      console.error('[CostTracker] Flush error:', err);
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Load historical costs from Supabase for an agent.
   */
  async loadFromDatabase(agentId: string): Promise<void> {
    try {
      const supabase = createAdminClient();
      const dateStr = new Date().toISOString().slice(0, 10);

      // Get today's total
      const { data: todayData } = await supabase
        .from('execution_costs')
        .select('cost_usd')
        .eq('agent_id', agentId)
        .gte('created_at', `${dateStr}T00:00:00Z`);

      if (todayData) {
        const todayTotal = todayData.reduce(
          (sum: number, row: { cost_usd: number }) => sum + row.cost_usd,
          0
        );
        const dailyKey = `${agentId}:${dateStr}`;
        this.dailyCosts.set(dailyKey, todayTotal);
      }

      // Get all-time total
      const { data: totalData } = await supabase
        .from('execution_costs')
        .select('cost_usd, model, input_tokens, output_tokens')
        .eq('agent_id', agentId);

      if (totalData) {
        let total = 0;
        const breakdown: Record<string, ModelCostEntry> = {};

        for (const row of totalData as Array<{
          cost_usd: number;
          model: string;
          input_tokens: number;
          output_tokens: number;
        }>) {
          total += row.cost_usd;
          if (!breakdown[row.model]) {
            breakdown[row.model] = { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 };
          }
          breakdown[row.model].inputTokens += row.input_tokens;
          breakdown[row.model].outputTokens += row.output_tokens;
          breakdown[row.model].cost += row.cost_usd;
          breakdown[row.model].calls += 1;
        }

        this.totalCosts.set(agentId, total);
        this.modelBreakdown.set(agentId, breakdown);
      }
    } catch (err) {
      console.error('[CostTracker] Load from DB failed:', err);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => console.error('[CostTracker] Auto-flush error:', err));
    }, this.flushIntervalMs);

    // Unref so the timer doesn't prevent process exit
    if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  /**
   * Stop the auto-flush timer (for cleanup/testing).
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ── Singleton instance ───────────────────────────────────────────────────────────

let _instance: CostTracker | null = null;

export function getCostTracker(): CostTracker {
  if (!_instance) {
    _instance = new CostTracker();
  }
  return _instance;
}
