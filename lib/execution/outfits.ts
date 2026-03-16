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
  domainKnowledge: string;           // BetterBot-style domain reference knowledge
  costCeiling: number;               // max cost in dollars per session in this outfit
  maxToolRounds: number;             // max tool-call rounds before forcing completion
}

// ── Outfit Definitions ────────────────────────────────────────────────────────

export const OUTFITS: Record<string, Outfit> = {
  marketing: {
    name: 'marketing',
    description: 'Marketing execution outfit — content creation, campaigns, SEO, competitor analysis, social posting',
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
      // Composio action tools
      'post_to_linkedin',
      'post_to_twitter',
      'post_to_instagram',
      'post_to_facebook',
      'check_connection',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'create_calendar_event',
    ],
    systemPromptExtension: `You are operating in MARKETING mode. Your focus is on:
- Creating high-converting marketing content
- Data-driven campaign design
- Competitive positioning and differentiation
- SEO and content strategy
- Multi-channel marketing execution

IMPORTANT — CONVERSATIONAL OUTPUT:
- Present your work conversationally. Show the content, explain your choices, then ask what the user wants to do next.
- After creating social posts, ALWAYS offer to publish them: "Want me to post these? I can push directly to LinkedIn, X/Twitter, Instagram, and Facebook."
- Use check_connection to verify if accounts are linked before posting. If not linked, guide the user to connect in Integration settings.
- Use post_to_linkedin, post_to_twitter, post_to_instagram, and post_to_facebook tools when the user approves posting.
- Format content with markdown: ## headers for platforms, > blockquotes for post content, **bold** for key elements.

Always reference the business analysis data when making recommendations.
Ground your content in the company's actual positioning, target audience, and competitive landscape.
When creating content, match the company's brand voice and industry norms.`,
    domainKnowledge: `Platform Best Practices:
- LinkedIn: Professional tone, 1300 char max, 3-5 hashtags, hook in first 2 lines, post Tue-Thu 8-10am
- Twitter/X: Punchy, 280 chars, 2-3 hashtags, threads for longer content, engage in replies
- Instagram: Visual-first, 2200 char caption, 15-20 hashtags, Reels outperform static posts 3x, use post_to_instagram tool
- TikTok: Hook in first 3 seconds, trend-aware, authentic > polished, 3-5 hashtags
- Facebook: Conversational, medium length, 1-2 hashtags, video gets 2x engagement, use post_to_facebook tool
- YouTube: Strong thumbnails + titles, first 30 seconds hook, 10-15 min optimal length, SEO in description

Ad Copy Benchmarks:
- Google Ads: 3 headlines x 30 chars, 2 descriptions x 90 chars, CTR benchmark 2-5%
- Facebook Ads: Single image CTR ~1%, video CTR ~1.5%, carousel CTR ~2%
- LinkedIn Ads: CPM $30-80, best for B2B, job title targeting most effective

Email Benchmarks:
- Open rate: 20-25% average, 30%+ is excellent
- Click rate: 2-5% average, 5%+ is excellent
- Best send times: Tue/Wed/Thu 10am or 2pm
- Subject line: 6-10 words, personalization increases opens 26%`,
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
      // Composio action tools
      'write_to_google_sheets',
      'read_from_google_sheets',
      'send_email',
      'check_connection',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
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
    domainKnowledge: `Financial Modeling Reference:
- SaaS Metrics: ARR, MRR, churn rate, LTV, CAC, LTV:CAC ratio (target 3:1+)
- Burn Rate: Monthly cash outflow. Runway = cash / burn rate
- Unit Economics: Revenue per unit - cost per unit. Must be positive for viability
- Break-even: Fixed costs / (price - variable cost per unit)

Projection Scenarios:
- Conservative: 70% of base growth, 120% of base costs
- Base Case: Use historical trends + market data
- Optimistic: 130% of base growth, 90% of base costs

Budget Allocation Benchmarks (startups):
- Engineering: 25-35% of spend
- Sales & Marketing: 20-30%
- G&A: 10-15%
- Product: 15-20%

Pricing Strategy Frameworks:
- Cost-plus: cost x (1 + margin). Simple but leaves money on table
- Value-based: price based on customer value delivered. Higher margins
- Competitive: price relative to alternatives. Good for commoditized markets
- Penetration: low price to gain share, raise later. Risky but fast growth`,
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
      // Composio action tools
      'post_to_linkedin',
      'send_email',
      'check_connection',
      'create_jira_ticket',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'create_calendar_event',
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
    domainKnowledge: `Salary Benchmarking (2026 US):
- Software Engineer (mid): $130-170K base + equity
- Senior Software Engineer: $170-220K base + equity
- Product Manager: $140-180K base
- Marketing Manager: $100-140K base
- Sales (AE): $80-120K base + $80-120K OTE
- Note: Add 20-30% for SF/NYC, subtract 10-20% for other markets

Interview Design:
- Structured > unstructured (2x more predictive of job performance)
- Behavioral questions: "Tell me about a time when..." with scoring rubric
- Technical: real-world problems > leetcode. Pair programming > whiteboard
- Culture fit questions should assess values alignment, not "beer test"

Job Posting Best Practices:
- Lead with impact, not requirements. What will they BUILD?
- Salary transparency increases applications 30%+
- "Requirements" section: keep to 5-7 items, mark nice-to-haves
- Include benefits, growth path, and team culture
- Avoid: "ninja", "rockstar", "fast-paced" (signals dysfunction)

Onboarding Milestones:
- Day 1: Setup, intros, first commit or task
- Week 1: Understand product, complete first meaningful PR/task
- Month 1: Ship first feature/project independently
- Month 3: Full contributor, own a domain or project area`,
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
      // Composio action tools
      'create_jira_ticket',
      'send_email',
      'send_slack_message',
      'check_connection',
      'write_to_google_sheets',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'search_emails',
      'create_calendar_event',
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
    domainKnowledge: `Risk Assessment Matrix:
- Likelihood: 1 (rare) to 5 (almost certain)
- Impact: 1 (negligible) to 5 (catastrophic)
- Risk Score = Likelihood x Impact. Critical: 15+, High: 10-14, Medium: 5-9, Low: 1-4
- Mitigation strategies: Avoid, Transfer, Mitigate, Accept

Project Planning:
- Always pad estimates 20-30% for unknowns
- Critical path: longest sequence of dependent tasks
- Milestone: measurable checkpoint, not just a date
- RACI matrix: Responsible, Accountable, Consulted, Informed

SOP Format:
1. Purpose and scope
2. Definitions
3. Responsibilities (RACI)
4. Procedure steps (numbered, with decision points)
5. Exception handling
6. Quality checks
7. Version history

Vendor Evaluation Criteria:
- Functionality fit (30% weight)
- Total cost of ownership (25%)
- Integration capability (20%)
- Support and reliability (15%)
- Scalability (10%)`,
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
      // Composio action tools
      'post_to_linkedin',
      'check_connection',
      'create_hubspot_contact',
      'create_slide_deck',
      'write_to_google_sheets',
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
    domainKnowledge: `Sales Frameworks:
- MEDDIC: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion
- SPIN Selling: Situation, Problem, Implication, Need-payoff questions
- Challenger Sale: Teach, Tailor, Take control

Email Outreach Benchmarks:
- Cold email open rate: 15-25%. Above 25% is excellent
- Reply rate: 2-5% cold, 10-20% warm
- Best cadence: Day 1, Day 3, Day 7, Day 14 (4-touch minimum)
- Subject lines: personalized > generic by 3x

Objection Handling:
- Price: reframe as ROI. "It costs $X but saves you $Y"
- Timing: create urgency with real data. "Your competitors are already..."
- Competition: never badmouth. Focus on unique differentiators
- Authority: "Let's loop in the decision maker for a brief call"`,
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
      // Composio action tools
      'post_to_linkedin',
      'post_to_twitter',
      'post_to_instagram',
      'post_to_facebook',
      'check_connection',
      'create_slide_deck',
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
    domainKnowledge: `AARRR Pirate Metrics:
- Acquisition: How users find you (SEO, ads, referral, organic)
- Activation: First "aha" moment (signup to value in <5 min is ideal)
- Retention: Do they come back? (D1/D7/D30 retention benchmarks)
- Revenue: Do they pay? (conversion rate, ARPU, expansion revenue)
- Referral: Do they tell others? (viral coefficient, NPS)

ICE Scoring:
- Impact: 1-10 (how much will this move the needle?)
- Confidence: 1-10 (how sure are we this will work?)
- Ease: 1-10 (how easy is this to implement?)
- Score = I x C x E. Prioritize highest scores first

Growth Benchmarks (SaaS):
- Good monthly growth rate: 10-15% for early stage, 5-7% for growth
- Churn: <2% monthly for B2B SaaS, <5% for B2C
- Viral coefficient >1.0 = organic growth (rare and powerful)
- Payback period: <12 months for healthy unit economics`,
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
      // Composio action tools
      'check_connection',
      'search_notion',
      'create_slide_deck',
      'write_to_google_sheets',
      'read_emails',
      'search_emails',
    ],
    systemPromptExtension: `You are operating in RESEARCH mode. Your focus is on:
- Deep web research and information gathering
- Market size estimation and opportunity analysis
- Competitive intelligence and landscape mapping
- Industry trend identification and analysis
- Data synthesis and insight generation

TOOL USAGE — IMPORTANT:
- FIRST: Call query_analysis(section: "list_sections") to discover what analysis data exists.
- Use query_analysis(section: "search", query: "your question") to search across ALL sections at once.
- Use query_analysis(section: "sectionName") to get specific section data.
- If web_search fails, immediately use scrape_website on specific relevant URLs instead.
- Never repeat a failed tool call. Adapt and try different tools.

RESEARCH STANDARDS:
- Always cite sources for factual claims.
- Distinguish between facts, estimates, and opinions.
- Use multiple sources to triangulate information.
- Note the recency of data — markets change quickly.
- Provide confidence levels for estimates.
- Organize findings in a structured, scannable format.
- Always include a "methodology" or "sources" section.
- Flag potential biases in sources.`,
    domainKnowledge: `Market Sizing Frameworks:
- TAM (Total Addressable Market): entire market if 100% share
- SAM (Serviceable Addressable Market): segment you can reach
- SOM (Serviceable Obtainable Market): realistic near-term capture
- Top-down: industry size x your segment %. Bottom-up: customers x price x usage

Competitive Analysis Framework:
- Direct competitors: same product, same market
- Indirect competitors: different product, same problem
- Substitute competitors: entirely different approach to same need
- For each: positioning, pricing, strengths, weaknesses, market share

Research Quality Tiers:
- Primary: direct surveys, interviews, company filings (highest confidence)
- Secondary: analyst reports, industry studies (high confidence)
- Tertiary: news articles, blog posts (moderate confidence)
- Inference: extrapolation from partial data (low confidence, must label)

Trend Analysis:
- Look for: acceleration, deceleration, inflection points
- Compare: year-over-year, quarter-over-quarter
- Context: macro trends, regulatory changes, technology shifts`,
    costCeiling: 0.60,
    maxToolRounds: 12,
  },

  codebot: {
    name: 'codebot',
    description: 'Engineering outfit — GitHub actions, code review, CI/CD, issue/PR management',
    tools: [
      'web_search',
      'scrape_website',
      'query_analysis',
      'create_report',
      'create_document',
      'create_spreadsheet',
      'create_chart_data',
      'benchmark_comparison',
      // GitHub action tools via Composio
      'github_create_issue',
      'github_create_pr',
      'github_list_repos',
      'github_create_comment',
      'github_list_issues',
      'github_list_prs',
      'check_connection',
      'send_slack_message',
      'create_jira_ticket',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
    ],
    systemPromptExtension: `You are operating in CODEBOT mode. Your focus is on:
- GitHub repository management and code quality
- Creating issues, PRs, and code review comments
- Engineering metrics and developer productivity
- CI/CD pipeline analysis
- Tech debt identification

ENGINEERING CAPABILITIES:
- You can directly create GitHub issues, PRs, and comments via Composio.
- Always check_connection for 'github' before attempting GitHub actions.
- When creating issues, include clear reproduction steps and acceptance criteria.
- When creating PRs, include a clear description of changes and testing instructions.
- Use Jira integration for project management when available.
- Reference DORA metrics and industry benchmarks in engineering reports.`,
    domainKnowledge: `DORA Metrics (Elite Benchmarks):
- Deployment Frequency: Multiple times per day
- Lead Time for Changes: Less than 1 hour
- Mean Time to Recovery: Less than 1 hour
- Change Failure Rate: Less than 15%

Code Quality Signals:
- Test coverage: 80%+ for critical paths, 60%+ overall
- PR size: <400 lines changed ideal, >1000 is a red flag
- Review turnaround: <4 hours for first review
- CI pass rate: >95% is healthy, <85% needs attention

Tech Debt Categories:
- Architecture debt: wrong abstractions, tight coupling
- Code debt: duplication, poor naming, missing tests
- Infrastructure debt: manual deployments, missing monitoring
- Documentation debt: outdated docs, missing runbooks
- Prioritize by: business impact x fix effort ratio

GitHub Best Practices:
- Issues: clear title, reproduction steps, expected vs actual, labels
- PRs: description of WHY, not just what. Link to issue. Include test plan
- Branch naming: type/description (feature/add-auth, fix/login-bug)`,
    costCeiling: 0.60,
    maxToolRounds: 10,
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
 * Get the system prompt extension for an outfit (includes domain knowledge).
 */
export function getOutfitSystemPrompt(outfitName: string): string {
  const outfit = OUTFITS[outfitName];
  if (!outfit) return '';
  const parts = [outfit.systemPromptExtension];
  if (outfit.domainKnowledge) {
    parts.push(`\n--- Domain Reference ---\n${outfit.domainKnowledge}`);
  }
  return parts.join('\n');
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
