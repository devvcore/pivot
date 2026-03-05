/**
 * Multi-Provider LLM Abstraction
 *
 * Supports Gemini (primary), Anthropic (fallback for complex reasoning),
 * and OpenAI (fallback). Inspired by BetterBot's provider.js.
 *
 * Roles:
 *  - router: cheapest model, low token budget — for classification/routing
 *  - quick:  fast model for compaction/triage
 *  - default: balanced for general use
 *  - deep:   highest capability, larger token budget
 */

import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import type {
  ModelRole,
  ProviderName,
  ChatMessage,
  ChatResponse,
  TokenUsage,
  Tool,
  ToolCall,
  LLMProvider,
  ModelConfig,
  ModelPricing,
} from './types';
import { MODEL_PRICING } from './types';

// ── Role → Model Config mapping ─────────────────────────────────────────────────

const ROLE_CONFIGS: Record<ModelRole, ModelConfig> = {
  router: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    maxOutputTokens: 256,
    temperature: 0.0,
  },
  quick: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    maxOutputTokens: 2048,
    temperature: 0.2,
  },
  default: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    maxOutputTokens: 4096,
    temperature: 0.3,
  },
  deep: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    maxOutputTokens: 8192,
    temperature: 0.4,
  },
};

// ── Cost calculation ─────────────────────────────────────────────────────────────

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Normalize model name for pricing lookup
  const pricing = findPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}

function findPricing(model: string): ModelPricing {
  // Direct lookup
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Prefix match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) || key.startsWith(model)) return pricing;
  }

  // Default to cheapest pricing to avoid overcharging
  return { inputPerMillion: 0.15, outputPerMillion: 0.60 };
}

// ── Gemini Provider ──────────────────────────────────────────────────────────────

class GeminiProvider implements LLMProvider {
  readonly name: ProviderName = 'gemini';
  readonly model: string;
  readonly role: ModelRole;
  private config: ModelConfig;
  private client: GoogleGenAI;

  constructor(role: ModelRole, config: ModelConfig) {
    this.role = role;
    this.model = config.model;
    this.config = config;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.client = new GoogleGenAI({ apiKey });
  }

  async chat(messages: ChatMessage[], tools?: Tool[]): Promise<ChatResponse> {
    const { systemInstruction, contents } = this.formatMessages(messages);

    const geminiConfig: Record<string, unknown> = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    };

    if (systemInstruction) {
      geminiConfig.systemInstruction = systemInstruction;
    }

    if (tools && tools.length > 0) {
      geminiConfig.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const resp = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: geminiConfig,
    });

    // Parse tool calls from function call parts
    const toolCalls = this.extractToolCalls(resp);

    // Extract usage
    const usage = this.extractUsage(resp);

    return {
      content: resp.text ?? '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      model: this.model,
    };
  }

  private formatMessages(
    messages: ChatMessage[]
  ): { systemInstruction: string | undefined; contents: string | object[] } {
    let systemInstruction: string | undefined;
    const parts: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = (systemInstruction ?? '') + msg.content + '\n';
        continue;
      }

      if (msg.role === 'tool') {
        // Tool results get folded into the conversation as user messages
        parts.push({
          role: 'user',
          parts: [
            {
              text: `[Tool Result${msg.toolCallId ? ` for ${msg.toolCallId}` : ''}]: ${msg.content}`,
            },
          ],
        });
        continue;
      }

      const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      parts.push({
        role: geminiRole,
        parts: [{ text: msg.content }],
      });
    }

    // Gemini needs at least one content part
    if (parts.length === 0) {
      parts.push({ role: 'user', parts: [{ text: '' }] });
    }

    return {
      systemInstruction: systemInstruction?.trim(),
      contents: parts,
    };
  }

  private extractToolCalls(resp: GenerateContentResponse): ToolCall[] {
    const calls: ToolCall[] = [];
    const candidates = resp.candidates;
    if (!candidates || candidates.length === 0) return calls;

    const parts = candidates[0]?.content?.parts;
    if (!parts) return calls;

    for (const part of parts) {
      const fc = part.functionCall;
      if (fc && fc.name) {
        calls.push({
          id: fc.id ?? `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: fc.name,
          arguments: fc.args ?? {},
        });
      }
    }

    return calls;
  }

  private extractUsage(resp: GenerateContentResponse): TokenUsage {
    const meta = resp.usageMetadata;
    const inputTokens = meta?.promptTokenCount ?? 0;
    const outputTokens = meta?.candidatesTokenCount ?? 0;
    return {
      inputTokens,
      outputTokens,
      cost: calculateCost(this.model, inputTokens, outputTokens),
    };
  }
}

// ── Anthropic Provider ───────────────────────────────────────────────────────────

class AnthropicProvider implements LLMProvider {
  readonly name: ProviderName = 'anthropic';
  readonly model: string;
  readonly role: ModelRole;
  private config: ModelConfig;

  constructor(role: ModelRole, config: ModelConfig) {
    this.role = role;
    this.model = config.model;
    this.config = config;
  }

  async chat(messages: ChatMessage[], tools?: Tool[]): Promise<ChatResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    // Extract system prompt
    let systemPrompt = '';
    const anthropicMessages: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n';
      } else if (msg.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: `[Tool Result${msg.toolCallId ? ` for ${msg.toolCallId}` : ''}]: ${msg.content}`,
        });
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.config.maxOutputTokens,
      temperature: this.config.temperature,
      messages: anthropicMessages,
    };

    if (systemPrompt.trim()) {
      body.system = systemPrompt.trim();
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }

    const data = (await resp.json()) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        content += block.text;
      } else if (block.type === 'tool_use' && block.name) {
        toolCalls.push({
          id: block.id ?? `call_${Date.now()}`,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens,
        outputTokens,
        cost: calculateCost(this.model, inputTokens, outputTokens),
      },
      model: this.model,
    };
  }
}

// ── OpenAI Provider ──────────────────────────────────────────────────────────────

class OpenAIProvider implements LLMProvider {
  readonly name: ProviderName = 'openai';
  readonly model: string;
  readonly role: ModelRole;
  private config: ModelConfig;

  constructor(role: ModelRole, config: ModelConfig) {
    this.role = role;
    this.model = config.model;
    this.config = config;
  }

  async chat(messages: ChatMessage[], tools?: Tool[]): Promise<ChatResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openaiMessages = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId ?? '',
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });

    const body: Record<string, unknown> = {
      model: this.model,
      messages: openaiMessages,
      max_tokens: this.config.maxOutputTokens,
      temperature: this.config.temperature,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${errText}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];
    const content = choice?.message?.content ?? '';
    const toolCalls: ToolCall[] = [];

    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          args = { raw: tc.function.arguments };
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        });
      }
    }

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens,
        outputTokens,
        cost: calculateCost(this.model, inputTokens, outputTokens),
      },
      model: this.model,
    };
  }
}

// ── Provider Factory ─────────────────────────────────────────────────────────────

/**
 * Create an LLM provider for the given role.
 *
 * Checks for provider-specific API keys and falls back:
 *   Gemini → Anthropic → OpenAI
 *
 * For the 'deep' role, prefers Anthropic if ANTHROPIC_API_KEY is set.
 */
export function createProvider(role: ModelRole): LLMProvider {
  const config = { ...ROLE_CONFIGS[role] };

  // For deep reasoning, prefer Anthropic if available
  if (role === 'deep' && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(role, {
      ...config,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxOutputTokens: 8192,
    });
  }

  // Primary: Gemini
  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider(role, config);
  }

  // Fallback: Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(role, {
      ...config,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  }

  // Fallback: OpenAI
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider(role, {
      ...config,
      provider: 'openai',
      model: 'gpt-4o',
    });
  }

  throw new Error(
    'No LLM API key configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.'
  );
}

/**
 * Create a provider for a specific model override (bypasses role config).
 */
export function createProviderForModel(
  provider: ProviderName,
  model: string,
  role: ModelRole = 'default'
): LLMProvider {
  const baseConfig = ROLE_CONFIGS[role];
  const config: ModelConfig = { ...baseConfig, provider, model };

  switch (provider) {
    case 'gemini':
      return new GeminiProvider(role, config);
    case 'anthropic':
      return new AnthropicProvider(role, config);
    case 'openai':
      return new OpenAIProvider(role, config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export { calculateCost };
