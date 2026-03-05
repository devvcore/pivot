/**
 * Outfit System — Tool + context bundles per domain
 *
 * Each outfit defines:
 * - Which tools are available for that domain
 * - Domain-specific system prompt extensions
 * - Cost ceilings per session
 * - Maximum tool call rounds
 *
 * Based on BetterBot's outfit pattern: agents "wear" an outfit
 * that determines their capabilities and constraints for a given task.
 */

import type { Tool } from './tools/index';
import { OUTFIT_TOOL_MAP, type ToolRegistry } from './tools/index';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Outfit {
  name: string;
  description: string;
  tools: string[];                   // tool names from the global registry
  systemPromptExtension: string;     // domain-specific instructions appended to agent prompt
  costCeiling: number;               // max cost in dollars per session in this outfit
  maxToolRounds: number;             // max tool-call rounds before forcing completion
}

// ── Outfit Definitions ────────────────────────────────────────────────────────

export const OUTFITS: Record<string, Outfit> = {
  marketing: {
    name: 'marketing',
    description: 'Marketing execution outfit — content creation, campaigns, SEO, competitor analysis',
    tools: [
      'create_social_post',
      'create_ad_copy',
      'create_landing_page',
      'analyze_competitors',
      'create_email_campaign',
      'seo_audit',
      'web_search',
      'scrape_website',
      'create_document',
      'create_spreadsheet',
      'query_analysis',
      'create_chart_data',
    ],
    systemPromptExtension: `You are operating in MARKETING mode. Your focus is on:
- Creating high-converting marketing content
- Data-driven campaign design
- Competitive positioning and differentiation
- SEO and content strategy
- Multi-channel marketing execution

Always reference the business analysis data when making recommendations.
Ground your content in the company's actual positioning, target audience, and competitive landscape.
When creating content, match the company's brand voice and industry norms.
Provide A/B variants when creating ad copy or subject lines.
Include measurable KPIs for every campaign or initiative you propose.`,
    costCeiling: 0.50,
    maxToolRounds: 8,
  },

  finance: {
    name: 'finance',
    description: 'Financial analysis outfit — budgets, projections, invoicing, pricing',
    tools: [
      'create_invoice',
      'create_budget',
      'financial_projection',
      'expense_analysis',
      'pricing_optimizer',
      'query_analysis',
      'create_chart_data',
      'create_report',
      'create_spreadsheet',
      'create_document',
      'benchmark_comparison',
      'trend_analysis',
    ],
    systemPromptExtension: `You are operating in FINANCE mode. Your focus is on:
- Accurate financial analysis and modeling
- Budget creation and optimization
- Revenue and expense management
- Pricing strategy
- Financial forecasting with scenario analysis

CRITICAL RULES:
- Always distinguish between VERIFIED data (from uploaded documents) and ESTIMATES.
- Never present estimates as facts. Use language like "based on available data" or "estimated at".
- Provide conservative, base, and optimistic scenarios for any projection.
- Include assumptions explicitly — never hide them.
- Flag any data gaps that could affect accuracy.
- Use the company's actual financial data from analysis whenever available.`,
    costCeiling: 0.30,
    maxToolRounds: 6,
  },

  hr: {
    name: 'hr',
    description: 'HR and talent outfit — hiring, interviews, compensation, onboarding',
    tools: [
      'create_job_posting',
      'create_interview_questions',
      'salary_benchmark',
      'create_onboarding_plan',
      'performance_review_template',
      'query_analysis',
      'create_document',
      'create_spreadsheet',
      'web_search',
      'benchmark_comparison',
    ],
    systemPromptExtension: `You are operating in HR mode. Your focus is on:
- Talent acquisition and job posting creation
- Interview process design and question development
- Compensation benchmarking and salary negotiation
- Employee onboarding and development
- Performance management frameworks

IMPORTANT GUIDELINES:
- Use inclusive, non-discriminatory language in all job postings.
- Base salary benchmarks on current market data with appropriate caveats.
- Design interview questions that assess competency, not pedigree.
- Include diversity and inclusion considerations in all HR processes.
- Reference the company's hiring plan and talent gap analysis when available.
- Always recommend structured interviews over unstructured ones.`,
    costCeiling: 0.30,
    maxToolRounds: 6,
  },

  operations: {
    name: 'operations',
    description: 'Operations outfit — processes, SOPs, risk management, project planning',
    tools: [
      'create_process_document',
      'create_sop',
      'risk_assessment',
      'create_project_plan',
      'vendor_comparison',
      'query_analysis',
      'create_document',
      'create_spreadsheet',
      'create_report',
      'benchmark_comparison',
    ],
    systemPromptExtension: `You are operating in OPERATIONS mode. Your focus is on:
- Business process documentation and optimization
- Standard operating procedure creation
- Risk identification and mitigation
- Project planning and execution
- Vendor selection and management

OPERATIONAL STANDARDS:
- All process documents must include owners, inputs, outputs, and decision points.
- SOPs must follow a formal, auditable format.
- Risk assessments must use likelihood x impact scoring.
- Project plans must include dependencies, milestones, and resource allocation.
- Reference the company's operational data (health checklist, process efficiency) when available.
- Always include change management considerations.`,
    costCeiling: 0.30,
    maxToolRounds: 6,
  },

  sales: {
    name: 'sales',
    description: 'Sales execution outfit — sales content, proposals, competitive handling',
    tools: [
      'create_document',
      'create_spreadsheet',
      'send_email',
      'query_analysis',
      'web_search',
      'scrape_website',
      'analyze_competitors',
      'create_report',
      'benchmark_comparison',
    ],
    systemPromptExtension: `You are operating in SALES mode. Your focus is on:
- Sales collateral creation (proposals, one-pagers, pitch decks)
- Competitive battle cards and objection handling
- Email sequences for outreach and follow-up
- Pipeline analysis and deal support
- Customer research and preparation

SALES GUIDELINES:
- Reference the sales playbook and competitive analysis from Pivot's analysis.
- Use the company's actual value propositions and differentiators.
- Create content that addresses specific buyer pain points.
- Include specific ROI calculations when proposing solutions.
- Design email sequences with appropriate follow-up timing.
- Ground competitive analysis in real data, not assumptions.`,
    costCeiling: 0.40,
    maxToolRounds: 8,
  },

  growth: {
    name: 'growth',
    description: 'Growth strategy outfit — growth levers, experiments, funnel optimization',
    tools: [
      'web_search',
      'scrape_website',
      'analyze_competitors',
      'create_landing_page',
      'create_social_post',
      'create_email_campaign',
      'seo_audit',
      'query_analysis',
      'create_chart_data',
      'create_report',
      'trend_analysis',
      'benchmark_comparison',
      'create_document',
    ],
    systemPromptExtension: `You are operating in GROWTH mode. Your focus is on:
- Growth experimentation and A/B testing frameworks
- Funnel optimization and conversion improvement
- Channel identification and scaling
- Viral loops and referral programs
- Product-led growth strategies

GROWTH PRINCIPLES:
- Every recommendation must be testable as an experiment.
- Prioritize by ICE score (Impact x Confidence x Ease).
- Always design with metrics and success criteria.
- Reference the company's current growth data and KPIs.
- Distinguish between acquisition, activation, retention, revenue, and referral (AARRR).
- Focus on scalable, repeatable growth — not one-time tactics.`,
    costCeiling: 0.50,
    maxToolRounds: 10,
  },

  research: {
    name: 'research',
    description: 'Research outfit — deep web research, market analysis, competitive intelligence',
    tools: [
      'web_search',
      'scrape_website',
      'check_domain_availability',
      'analyze_competitors',
      'query_analysis',
      'create_report',
      'trend_analysis',
      'benchmark_comparison',
      'create_chart_data',
      'create_document',
      'create_spreadsheet',
    ],
    systemPromptExtension: `You are operating in RESEARCH mode. Your focus is on:
- Deep web research and information gathering
- Market size estimation and opportunity analysis
- Competitive intelligence and landscape mapping
- Industry trend identification and analysis
- Data synthesis and insight generation

RESEARCH STANDARDS:
- Always cite sources for factual claims.
- Distinguish between facts, estimates, and opinions.
- Use multiple sources to triangulate information.
- Note the recency of data — markets change quickly.
- Provide confidence levels for estimates.
- Organize findings in a structured, scannable format.
- Always include a "methodology" or "sources" section.
- Flag potential biases in sources.`,
    costCeiling: 0.60,
    maxToolRounds: 12,
  },
};

// ── Populate the outfit-tool map (used by ToolRegistry.getForOutfit) ──────────

for (const [name, outfit] of Object.entries(OUTFITS)) {
  OUTFIT_TOOL_MAP[name] = outfit.tools;
}

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Get resolved Tool objects for an outfit from the registry.
 */
export function getOutfitTools(outfitName: string, registry: ToolRegistry): Tool[] {
  const outfit = OUTFITS[outfitName];
  if (!outfit) return [];
  return registry.getByNames(outfit.tools);
}

/**
 * Get the system prompt extension for an outfit.
 */
export function getOutfitSystemPrompt(outfitName: string): string {
  return OUTFITS[outfitName]?.systemPromptExtension ?? '';
}

/**
 * Get the cost ceiling for an outfit.
 */
export function getOutfitCostCeiling(outfitName: string): number {
  return OUTFITS[outfitName]?.costCeiling ?? 0.20;
}

/**
 * List all available outfits with their descriptions.
 */
export function listOutfits(): { name: string; description: string; toolCount: number }[] {
  return Object.values(OUTFITS).map(o => ({
    name: o.name,
    description: o.description,
    toolCount: o.tools.length,
  }));
}
