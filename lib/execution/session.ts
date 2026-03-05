/**
 * Execution Session — Core Conversation Engine
 *
 * Adapted from BetterBot's session.js for TypeScript + Pivot.
 *
 * Features:
 *  - Per-turn cost tracking
 *  - Auto-compaction at 100k input tokens
 *  - Cost ceilings and deadlines
 *  - Parallel tool execution (Promise.all)
 *  - Max 30 tool rounds per send()
 *  - Save/resume from Supabase
 *  - Graph memory integration (auto-recall before send)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createProvider } from './provider';
import { getCostTracker } from './cost-tracker';
import { compactMessages } from './compaction';
import { getGraphMemory } from './graph-memory';
import type {
  ChatMessage,
  ChatResponse,
  Tool,
  ToolCall,
  ToolResult,
  TokenUsage,
  SessionOptions,
  SessionResult,
  SessionMetadata,
  SessionSnapshot,
  CostData,
  ModelRole,
  LLMProvider,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 30;
const COMPACTION_THRESHOLD_TOKENS = 100_000;
const DEFAULT_MODEL_ROLE: ModelRole = 'default';

// ── Session ──────────────────────────────────────────────────────────────────────

export class ExecutionSession {
  readonly id: string;
  readonly agentId: string;
  readonly orgId: string;
  messages: ChatMessage[];
  metadata: SessionMetadata;

  private systemPrompt: string;
  private maxToolRounds: number;
  private costCeiling: number | null;
  private deadline: number | null;
  private modelRole: ModelRole;
  private provider: LLMProvider;
  private costTracker = getCostTracker();
  private totalInputTokens = 0;

  /** Tool executor registry: name → handler function */
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<string>> =
    new Map();

  constructor(opts: SessionOptions) {
    this.id = opts.id ?? generateSessionId();
    this.agentId = opts.agentId;
    this.orgId = opts.orgId;
    this.systemPrompt = opts.systemPrompt ?? '';
    this.maxToolRounds = opts.maxToolRounds ?? MAX_TOOL_ROUNDS;
    this.costCeiling = opts.costCeiling ?? null;
    this.deadline = opts.deadline ?? null;
    this.modelRole = opts.modelRole ?? DEFAULT_MODEL_ROLE;
    this.provider = createProvider(this.modelRole);
    this.messages = [];

    const now = new Date().toISOString();
    this.metadata = {
      cost: {
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        byModel: {},
      },
      turns: 0,
      created: now,
      lastActive: now,
      compactionCount: 0,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  /**
   * Send a simple message (no tools). Returns the assistant's response.
   */
  async send(message: string): Promise<string> {
    // Auto-recall from graph memory
    const recalled = await this.recallContext(message);

    // Build messages
    const msgs = this.buildMessages(message, recalled);

    // Check compaction
    await this.maybeCompact();

    // Call LLM
    const response = await this.provider.chat(msgs);

    // Track
    this.trackTurn(message, response);

    return response.content;
  }

  /**
   * Send a message with tool support. Executes tool loops until done or limits hit.
   */
  async sendWithTools(message: string, tools: Tool[]): Promise<SessionResult> {
    // Auto-recall from graph memory
    const recalled = await this.recallContext(message);

    // Build initial messages
    const msgs = this.buildMessages(message, recalled);

    // Check compaction
    await this.maybeCompact();

    let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cost: 0 };
    const allToolResults: ToolResult[] = [];
    let rounds = 0;
    let finalContent = '';

    // Tool execution loop
    let currentMessages = [...msgs];

    while (rounds < this.maxToolRounds) {
      // Check cost ceiling
      if (this.costCeiling !== null && this.metadata.cost.totalCost >= this.costCeiling) {
        finalContent = '[Session stopped: cost ceiling reached]';
        break;
      }

      // Check deadline
      if (this.deadline !== null && Date.now() >= this.deadline) {
        finalContent = '[Session stopped: deadline exceeded]';
        break;
      }

      const response = await this.provider.chat(currentMessages, tools);
      totalUsage = mergeUsage(totalUsage, response.usage);
      this.recordUsage(response);

      // No tool calls — we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalContent = response.content;
        break;
      }

      // Execute tool calls in parallel
      const results = await this.executeToolCalls(response.toolCalls);
      allToolResults.push(...results);

      // Add assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // Add tool results as messages
      for (const result of results) {
        currentMessages.push({
          role: 'tool',
          content: result.content,
          toolCallId: result.toolCallId,
        });
      }

      rounds++;
    }

    if (rounds >= this.maxToolRounds && !finalContent) {
      finalContent = '[Session stopped: maximum tool rounds reached]';
    }

    // Record the turn
    this.messages.push({ role: 'user', content: message });
    this.messages.push({
      role: 'assistant',
      content: finalContent,
      toolCalls: undefined,
    });
    this.metadata.turns++;
    this.metadata.lastActive = new Date().toISOString();

    return {
      content: finalContent,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      usage: totalUsage,
      turns: rounds + 1,
    };
  }

  /**
   * Register a tool handler function.
   */
  registerTool(name: string, handler: (args: Record<string, unknown>) => Promise<string>): void {
    this.toolHandlers.set(name, handler);
  }

  /**
   * Set a cost ceiling (in USD). Session will stop tool loops when exceeded.
   */
  setCostCeiling(maxCost: number): void {
    this.costCeiling = maxCost;
  }

  /**
   * Set a deadline (timestamp ms). Session will stop tool loops when exceeded.
   */
  setDeadline(timestamp: number): void {
    this.deadline = timestamp;
  }

  // ── Context Building ───────────────────────────────────────────────────────────

  private buildMessages(userMessage: string, recalled: string): ChatMessage[] {
    const msgs: ChatMessage[] = [];

    // System prompt
    if (this.systemPrompt) {
      let system = this.systemPrompt;
      if (recalled) {
        system += `\n\n${recalled}`;
      }
      msgs.push({ role: 'system', content: system });
    } else if (recalled) {
      msgs.push({ role: 'system', content: recalled });
    }

    // History
    msgs.push(...this.messages);

    // Current user message
    msgs.push({ role: 'user', content: userMessage });

    return msgs;
  }

  private async recallContext(query: string): Promise<string> {
    try {
      const graphMemory = getGraphMemory(this.orgId);
      return await graphMemory.recall(query);
    } catch {
      return '';
    }
  }

  // ── Tool Execution ─────────────────────────────────────────────────────────────

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const promises = toolCalls.map(async (tc): Promise<ToolResult> => {
      const handler = this.toolHandlers.get(tc.name);

      if (!handler) {
        return {
          toolCallId: tc.id,
          name: tc.name,
          content: `Error: Unknown tool "${tc.name}"`,
          isError: true,
        };
      }

      try {
        const result = await handler(tc.arguments);
        return {
          toolCallId: tc.id,
          name: tc.name,
          content: result,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          toolCallId: tc.id,
          name: tc.name,
          content: `Error executing ${tc.name}: ${errorMessage}`,
          isError: true,
        };
      }
    });

    return Promise.all(promises);
  }

  // ── Compaction ─────────────────────────────────────────────────────────────────

  /**
   * Check if compaction is needed and perform it.
   */
  needsCompaction(): boolean {
    return this.totalInputTokens >= COMPACTION_THRESHOLD_TOKENS;
  }

  async compact(): Promise<void> {
    if (this.messages.length < 4) return; // Nothing meaningful to compact

    const { summary, keptMessages } = await compactMessages(this.messages);

    if (summary) {
      // Replace history: compaction summary + recent messages
      this.messages = [
        {
          role: 'system',
          content: `[Previous conversation summary]\n${summary}`,
        },
        ...keptMessages,
      ];

      this.metadata.compactionCount++;
      this.totalInputTokens = estimateTokens(this.messages);

      // Extract entities from the summary for the knowledge graph
      try {
        const graphMemory = getGraphMemory(this.orgId);
        await graphMemory.ingestCompactionSummary(summary);
      } catch (err) {
        console.warn('[Session] Graph entity extraction failed:', err);
      }

      console.log(
        `[Session ${this.id}] Compacted. Summary: ${summary.length} chars, kept ${keptMessages.length} messages`
      );
    }
  }

  private async maybeCompact(): Promise<void> {
    if (this.needsCompaction()) {
      await this.compact();
    }
  }

  // ── Cost Tracking ──────────────────────────────────────────────────────────────

  private trackTurn(userMessage: string, response: ChatResponse): void {
    this.messages.push({ role: 'user', content: userMessage });
    this.messages.push({ role: 'assistant', content: response.content });
    this.metadata.turns++;
    this.metadata.lastActive = new Date().toISOString();
    this.recordUsage(response);
  }

  private recordUsage(response: ChatResponse): void {
    const usage = response.usage;

    // Update session metadata
    this.metadata.cost.totalCost += usage.cost;
    this.metadata.cost.totalInputTokens += usage.inputTokens;
    this.metadata.cost.totalOutputTokens += usage.outputTokens;
    this.totalInputTokens += usage.inputTokens;

    if (!this.metadata.cost.byModel[response.model]) {
      this.metadata.cost.byModel[response.model] = {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        calls: 0,
      };
    }
    const modelEntry = this.metadata.cost.byModel[response.model];
    modelEntry.inputTokens += usage.inputTokens;
    modelEntry.outputTokens += usage.outputTokens;
    modelEntry.cost += usage.cost;
    modelEntry.calls += 1;

    // Track in global cost tracker
    this.costTracker.trackUsage(
      this.agentId,
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: response.model,
      },
      this.orgId
    );
  }

  // ── Persistence ────────────────────────────────────────────────────────────────

  /**
   * Save session state to Supabase.
   */
  async save(): Promise<void> {
    try {
      const supabase = createAdminClient();

      const snapshot: SessionSnapshot = {
        id: this.id,
        agentId: this.agentId,
        orgId: this.orgId,
        messages: this.messages,
        metadata: this.metadata,
        systemPrompt: this.systemPrompt,
      };

      const { error } = await supabase.from('agent_sessions').upsert(
        {
          id: this.id,
          agent_id: this.agentId,
          org_id: this.orgId,
          messages: JSON.stringify(snapshot.messages),
          metadata: JSON.stringify(snapshot.metadata),
          system_prompt: snapshot.systemPrompt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        console.error('[Session] Save failed:', error.message);
      }
    } catch (err) {
      console.error('[Session] Save error:', err);
    }
  }

  /**
   * Resume a session from Supabase.
   */
  static async resume(sessionId: string): Promise<ExecutionSession> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      throw new Error(`Session ${sessionId} not found: ${error?.message ?? 'no data'}`);
    }

    const row = data as {
      id: string;
      agent_id: string;
      org_id: string;
      messages: string;
      metadata: string;
      system_prompt: string;
    };

    const session = new ExecutionSession({
      id: row.id,
      agentId: row.agent_id,
      orgId: row.org_id,
      systemPrompt: row.system_prompt,
    });

    session.messages = JSON.parse(row.messages) as ChatMessage[];
    session.metadata = JSON.parse(row.metadata) as SessionMetadata;
    session.totalInputTokens = estimateTokens(session.messages);

    return session;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `sess_${timestamp}_${random}`;
}

/**
 * Rough token estimate: ~4 chars per token for English text.
 */
function estimateTokens(messages: ChatMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += msg.content.length;
    if (msg.toolCalls) {
      totalChars += JSON.stringify(msg.toolCalls).length;
    }
  }
  return Math.ceil(totalChars / 4);
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cost: a.cost + b.cost,
  };
}

// ── Convenience factory ──────────────────────────────────────────────────────────

/**
 * Create a new session with common defaults for Pivot's BI agents.
 */
export function createBISession(opts: {
  agentId: string;
  orgId: string;
  systemPrompt: string;
  costCeiling?: number;
}): ExecutionSession {
  return new ExecutionSession({
    agentId: opts.agentId,
    orgId: opts.orgId,
    systemPrompt: opts.systemPrompt,
    modelRole: 'default',
    costCeiling: opts.costCeiling ?? 1.0, // Default $1 ceiling for BI sessions
    maxToolRounds: 20,
  });
}
