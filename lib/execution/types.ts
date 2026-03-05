/**
 * Execution Engine — Shared Types
 *
 * All type definitions for Pivot's agent execution system.
 * Based on BetterBot's architecture, adapted for TypeScript.
 */

// ── LLM Provider Types ──────────────────────────────────────────────────────────

export type ModelRole = 'router' | 'quick' | 'default' | 'deep';

export type ProviderName = 'gemini' | 'anthropic' | 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface ModelConfig {
  provider: ProviderName;
  model: string;
  maxOutputTokens: number;
  temperature: number;
}

// ── Tool Types ───────────────────────────────────────────────────────────────────

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: ToolProperty;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

// ── Session Types ────────────────────────────────────────────────────────────────

export interface SessionOptions {
  id?: string;
  agentId: string;
  orgId: string;
  systemPrompt?: string;
  maxToolRounds?: number;
  costCeiling?: number;
  deadline?: number;
  modelRole?: ModelRole;
}

export interface SessionResult {
  content: string;
  toolResults?: ToolResult[];
  usage: TokenUsage;
  turns: number;
}

export interface SessionMetadata {
  cost: CostData;
  turns: number;
  created: string;
  lastActive: string;
  compactionCount: number;
}

export interface SessionSnapshot {
  id: string;
  agentId: string;
  orgId: string;
  messages: ChatMessage[];
  metadata: SessionMetadata;
  systemPrompt: string;
}

// ── Agent Types ──────────────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: Tool[];
  modelRole: ModelRole;
  outfit?: string;
  dailyBudget: number;
}

export interface OutfitConfig {
  name: string;
  tools: Tool[];
  contextDepth: 'minimal' | 'full';
  historyDepth: number;
}

// ── Router Types ─────────────────────────────────────────────────────────────────

export interface RouteResult {
  tools: 'none' | 'core' | string;
  context: 'minimal' | 'full';
  history: 1 | 3 | 5 | 10;
  source: 'classifier' | 'llm';
  confidence: number;
}

export interface ClassifierPrediction {
  label: string;
  confidence: number;
  scores: Record<string, number>;
}

export interface TrainingExample {
  text: string;
  label: string;
  timestamp?: string;
  source?: 'manual' | 'llm' | 'feedback';
}

// ── Cost Types ───────────────────────────────────────────────────────────────────

export interface CostData {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, ModelCostEntry>;
}

export interface ModelCostEntry {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  calls: number;
}

export interface AgentCostSummary {
  today: number;
  total: number;
  byModel: Record<string, number>;
}

export interface OrgCostSummary {
  today: number;
  total: number;
  byAgent: Record<string, number>;
}

// ── Graph Types ──────────────────────────────────────────────────────────────────

export type GraphNodeType =
  | 'entity'
  | 'person'
  | 'decision'
  | 'fact'
  | 'preference'
  | 'tool'
  | 'product'
  | 'company';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  aliases: string[];
  properties: Record<string, string>;
  orgId: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
  properties: Record<string, string>;
  orgId: string;
  createdAt: string;
}

export interface GraphSearchResult {
  node: GraphNode;
  score: number;
  edges: GraphEdge[];
}

// ── Task / Approval Types ────────────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval';

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  agentId: string;
  action: string;
  description: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// ── Event Types ──────────────────────────────────────────────────────────────────

export type ExecutionEventType =
  | 'session_start'
  | 'session_end'
  | 'message_sent'
  | 'message_received'
  | 'tool_call'
  | 'tool_result'
  | 'compaction'
  | 'cost_warning'
  | 'budget_exceeded'
  | 'deadline_exceeded'
  | 'error';

export interface ExecutionEvent {
  type: ExecutionEventType;
  sessionId: string;
  agentId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ── LLM Provider Interface ───────────────────────────────────────────────────────

export interface LLMProvider {
  readonly name: ProviderName;
  readonly model: string;
  readonly role: ModelRole;

  chat(messages: ChatMessage[], tools?: Tool[]): Promise<ChatResponse>;
}

// ── Cost Rates ───────────────────────────────────────────────────────────────────

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-2.5-flash': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'gemini-3-flash-preview': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'claude-sonnet-4-20250514': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'gpt-4o': { inputPerMillion: 2.50, outputPerMillion: 10.0 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
};
