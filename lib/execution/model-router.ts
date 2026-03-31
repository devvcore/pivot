/**
 * Model Router — Adaptive model selection for execution agents
 *
 * Routes tasks to the appropriate Gemini model tier based on task complexity,
 * agent type, triage level, and budget constraints.
 */

export type ModelTier = 'flash' | 'pro' | 'deep';

export interface ModelConfig {
  id: string;
  tier: ModelTier;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  maxOutputTokens: number;
  strengths: string[];
}

export const MODELS: Record<ModelTier, ModelConfig> = {
  flash: {
    id: 'gemini-2.5-flash',
    tier: 'flash',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    maxOutputTokens: 8192,
    strengths: ['speed', 'simple-tasks', 'tool-calling', 'data-lookup'],
  },
  pro: {
    id: 'gemini-2.5-pro',
    tier: 'pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    maxOutputTokens: 16384,
    strengths: ['reasoning', 'analysis', 'multi-step', 'nuance', 'strategy'],
  },
  deep: {
    id: 'gemini-2.5-pro',
    tier: 'deep',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    maxOutputTokens: 32768,
    strengths: ['complex-strategy', 'long-form', 'multi-domain', 'creative'],
  },
};

interface RoutingSignals {
  triageLevel: 'quick' | 'standard' | 'heavy';
  agentId: string;
  taskTitle: string;
  taskDescription: string;
  costCeiling: number;
  costSpent: number;
  hasIntegrationData: boolean;
  toolCount: number;
}

export function selectModel(signals: RoutingSignals): ModelConfig {
  // Budget guard: if we can't afford pro, use flash
  const remaining = signals.costCeiling - signals.costSpent;
  if (remaining < 0.05) return MODELS.flash;

  // QUICK always flash — even for strategist
  if (signals.triageLevel === 'quick') return MODELS.flash;

  // HEAVY tasks get pro
  if (signals.triageLevel === 'heavy') return MODELS.pro;

  // Strategist: pro only for complex tasks, flash for simple ones
  if (signals.agentId === 'strategist') {
    const text = `${signals.taskTitle} ${signals.taskDescription}`.toLowerCase();
    const complexKeywords = [
      'strategy', 'strategic', 'comprehensive', 'go-to-market', 'gtm',
      'competitive analysis', 'market entry', 'business plan', 'fundraising',
      'investor', 'board', 'due diligence', 'pricing strategy', 'financial model',
      'unit economics', 'expansion', 'acquisition', 'partnership',
    ];
    if (complexKeywords.some(kw => text.includes(kw))) return MODELS.pro;
    // Simple queries (list, check, summarize) use flash
    return MODELS.flash;
  }

  // Marketer: pro for complex campaigns, flash for single posts
  if (signals.agentId === 'marketer') {
    const text = `${signals.taskTitle} ${signals.taskDescription}`.toLowerCase();
    const complexKeywords = [
      'campaign', 'a/b test', 'multi-platform', 'multi-channel', 'launch',
      'rebrand', 'content calendar', 'email sequence', 'landing page',
      'full funnel', 'marketing strategy', 'brand voice',
    ];
    if (complexKeywords.some(kw => text.includes(kw))) return MODELS.pro;
    return MODELS.flash;
  }

  // Analyst: pro for complex financial modeling, flash for simple lookups
  if (signals.agentId === 'analyst') {
    const text = `${signals.taskTitle} ${signals.taskDescription}`.toLowerCase();
    const complexKeywords = [
      'projection', 'forecast', 'financial model', 'p&l', 'profit and loss',
      'comprehensive', 'multi-scenario', 'sensitivity analysis', 'valuation',
      'unit economics', 'pricing strategy', 'cash flow model', 'budget plan',
    ];
    if (complexKeywords.some(kw => text.includes(kw))) return MODELS.pro;
    return MODELS.flash;
  }

  // Keyword-based upgrade
  const text = `${signals.taskTitle} ${signals.taskDescription}`.toLowerCase();
  const proKeywords = [
    'strategy', 'strategic', 'analyze deeply', 'comprehensive plan',
    'competitive analysis', 'market entry', 'business plan', 'fundraising',
    'investor', 'board presentation', 'due diligence', 'risk assessment',
    'pricing strategy', 'go-to-market', 'financial model', 'unit economics',
  ];
  if (proKeywords.some(kw => text.includes(kw))) return MODELS.pro;

  // Many tools = complex selection
  if (signals.toolCount > 15) return MODELS.pro;

  return MODELS.flash;
}

export function getModelConfig(tier: ModelTier): ModelConfig {
  return MODELS[tier];
}

export function calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * model.inputPricePerMillion +
         (outputTokens / 1_000_000) * model.outputPricePerMillion;
}
