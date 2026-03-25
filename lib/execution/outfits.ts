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
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'create_calendar_event',
      'send_slack_message',
      'query_integration_data',
      'get_social_analytics',
      'generate_media',
      'generate_image_batch',
      'stitch_images_to_video',
      'research_brand',
      'post_to_tiktok',
      // CRM tools (for personalized outreach)
      'search_crm',
      'get_contact_details',
      'add_contact_note',
      // Scheduling & A/B testing
      'schedule_post',
      'create_ab_test',
      'get_scheduled_posts',
      'get_ab_test_results',
      'get_cross_platform_analytics',
    ],
    systemPromptExtension: `MARKETING MODE — Content creation and publishing.

TOOL STRATEGY — FOLLOW THIS ORDER:
1. **ANALYTICS FIRST**: If creating social content, call get_social_analytics(platform) FIRST. This gives you engagement data, top posts, best times, and themes.
2. **Data gathering**: query_analysis → query_integration_data → web_search → scrape_website
3. **WRITE CONTENT**: Based on analytics, create content that matches what performs well. Reference real numbers.
4. **POST IT**: Call post_to_linkedin / post_to_twitter / post_to_instagram / post_to_facebook. They handle connections internally.
5. **If tools fail**: Try the next in hierarchy once → write with what you have.

CONTENT-FIRST WORKFLOW (MANDATORY):
1. If creating social content → get_social_analytics(platform) FIRST to see what works
2. WRITE all posts/ads/emails DIRECTLY in your response. Your response IS the deliverable.
3. Reference REAL engagement data: "Your top post got 150 likes — here's one in the same style"
4. AFTER writing → call posting tool. They handle connection checks.
5. Do NOT call check_connection — action tools handle it automatically.

Ground ALL content in the company's actual positioning, audience, AND engagement data.

## CAMPAIGN & SCHEDULING
- You can SCHEDULE posts for future dates using schedule_post tool
- You can create A/B TESTS to optimize content using create_ab_test tool
- When creating content for a campaign, be aware of the CAMPAIGN CONTEXT from prior steps
- Use get_cross_platform_analytics to inform content strategy with real engagement data
- After creating content, ALWAYS offer to schedule it for optimal posting time

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    costCeiling: 1.50,
    maxToolRounds: 12,
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
      'send_slack_message',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'query_integration_data',
      'web_search',
      'create_calendar_event',
    ],
    systemPromptExtension: `FINANCE MODE — Financial analysis, budgets, projections.

TOOL FALLBACK HIERARCHY:
1. Live financial data: query_integration_data(provider: "stripe") → query_integration_data(provider: "quickbooks")
2. Analysis data: query_analysis(search) → query_analysis(specific section)
3. Market research: web_search for industry benchmarks, competitor pricing, market rates
4. Export: write_to_google_sheets (checks connection internally — returns [connect:google_sheets] if not connected)
5. If no financial data found: say "I don't have financial data from your connected tools" and ask the user.

CONTENT-FIRST WORKFLOW:
1. Create the full financial deliverable (budget, projection, report) in your response FIRST.
2. AFTER writing, if the user wants export, call write_to_google_sheets directly. It handles connection checks internally.
3. Do NOT call check_connection — action tools handle it automatically.

DATA INTEGRITY — ABSOLUTE:
- ONLY use numbers from: (1) query_integration_data output, (2) query_analysis output, (3) user's own words, (4) clearly labeled industry benchmarks.
- NEVER fabricate expenses, revenue breakdowns, or burn rates. If you don't have the data, say so.
- Distinguish: VERIFIED (from tools) vs INDUSTRY BENCHMARK (labeled). Never present benchmarks as company data.
- Include assumptions explicitly. Flag data gaps that affect accuracy.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    costCeiling: 0.80,
    maxToolRounds: 10,
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
      'send_slack_message',
      'create_jira_ticket',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'create_calendar_event',
      'query_integration_data',
      // CRM tools (for relationship context)
      'search_crm',
      'get_contact_details',
    ],
    systemPromptExtension: `HR MODE — Hiring, interviews, compensation, onboarding.

TOOL FALLBACK HIERARCHY:
1. Company data: query_analysis(search, "hiring plan") → query_analysis(search, "talent gap")
2. Job posting: create_job_posting → post_to_linkedin (checks connection internally)
3. Email: send_email (checks connection internally — returns [connect:gmail] if not connected)
4. Project management: create_jira_ticket (checks connection internally — returns [connect:jira] if not connected)

CONTENT-FIRST WORKFLOW:
1. WRITE the full job posting in your response FIRST. Do NOT call tools before writing it.
2. AFTER the posting is written, call post_to_linkedin directly. It handles connection checks internally.
3. Do NOT call check_connection — action tools handle it automatically.
4. The job posting content is the DELIVERABLE — the user gets it regardless of LinkedIn status.

GUIDELINES:
- Inclusive language in all postings. No gendered terms, no unnecessary requirements.
- Salary benchmarks labeled as "industry estimates" — never as company-specific data.
- Structured interviews > unstructured (2x more predictive of performance).
- Reference company's hiring plan and talent gap analysis when available.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    costCeiling: 0.60,
    maxToolRounds: 10,
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
      // Internal PM tools
      'create_ticket',
      'list_tickets',
      'update_ticket',
      'assign_ticket',
      // Composio action tools
      'create_jira_ticket',
      'send_email',
      'send_slack_message',
      'write_to_google_sheets',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'search_emails',
      'create_calendar_event',
      'query_integration_data',
      // CRM tools (full pipeline management)
      'search_crm',
      'get_contact_details',
      'update_contact_stage',
      'add_contact_note',
      'create_contact',
      'suggest_followups',
      'get_pipeline_summary',
    ],
    systemPromptExtension: `OPERATIONS MODE — Processes, SOPs, project plans, risk management, ticket tracking.

TOOL FALLBACK HIERARCHY:
1. Company data: query_analysis(search, "operations") → query_analysis(search, "health checklist")
2. Project management: create_jira_ticket (checks connection internally — returns [connect:jira] if not connected)
3. Export: write_to_google_sheets (checks connection internally — returns [connect:google_sheets] if not connected)
4. Communication: send_email / send_slack_message (check connections internally)

CONTENT-FIRST WORKFLOW:
1. Create the full deliverable (SOP, project plan, risk assessment) in your response FIRST.
2. AFTER writing, offer to create Jira tickets or export — call tools directly. They handle connection checks internally.
3. Do NOT call check_connection — action tools handle it automatically.

STANDARDS:
- Process docs: owners, inputs, outputs, decision points.
- Risk: Likelihood x Impact scoring. SOPs: formal auditable format.
- Project plans: dependencies, milestones, pad 20-30%.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    costCeiling: 0.60,
    maxToolRounds: 10,
  },

  sales: {
    name: 'sales',
    description: 'Sales execution outfit — sales content, proposals, competitive handling, CRM pipeline',
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
      'create_hubspot_contact',
      'create_slide_deck',
      'write_to_google_sheets',
      'read_emails',
      'reply_to_email',
      'search_emails',
      'send_slack_message',
      'create_calendar_event',
      'query_integration_data',
      'get_social_analytics',
      // CRM tools (full pipeline management)
      'search_crm',
      'get_contact_details',
      'update_contact_stage',
      'add_contact_note',
      'create_contact',
      'suggest_followups',
      'get_pipeline_summary',
    ],
    systemPromptExtension: `SALES MODE — Proposals, battle cards, email sequences, pipeline management, CRM.

TOOL FALLBACK HIERARCHY:
1. Company data: query_analysis(search, "sales playbook") → query_analysis(search, "competitive analysis")
2. Live data: query_integration_data(provider: "stripe") for revenue, query_integration_data(provider: "salesforce") or query_integration_data(provider: "hubspot") for pipeline
3. CRM: search_crm → get_contact_details → suggest_followups → update_contact_stage for pipeline management
4. Research: web_search → scrape_website (1 attempt each) → write with available data
5. Outreach: send_email, post_to_linkedin, create_hubspot_contact (check connections internally)
6. Export: write_to_google_sheets (checks connection internally — returns [connect:google_sheets] if not connected)

CONTENT-FIRST WORKFLOW:
1. Create the sales deliverable grounded in company data FIRST in your response.
2. AFTER writing, call action tools directly for publishing/export. They handle connection checks internally.
3. Do NOT call check_connection — action tools handle it automatically.

CRM WORKFLOW:
- For "follow up with leads": search_crm → get_contact_details → suggest_followups → draft personalized emails
- For "update pipeline": search_crm → update_contact_stage with notes
- For "add prospect": create_contact with all known details, then add_contact_note
- For "pipeline review": get_pipeline_summary → analyze conversion, suggest actions

GUIDELINES:
- Use actual value propositions and differentiators from analysis data.
- ROI calculations must use real numbers, not fabricated metrics.
- Email sequences: Day 1, Day 3, Day 7, Day 14 cadence.
- Ground competitive analysis in real data, not assumptions.
- Personalize EVERY outreach with real client data from CRM and integrations.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    maxToolRounds: 10,
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
      'post_to_tiktok',
      'generate_media',
      'generate_image_batch',
      'stitch_images_to_video',
      'research_brand',
      'create_slide_deck',
      'get_social_analytics',
      'query_integration_data',
      'send_email',
      'send_slack_message',
      'write_to_google_sheets',
      'create_spreadsheet',
    ],
    systemPromptExtension: `GROWTH MODE — Experiments, funnel optimization, channel scaling.

TOOL FALLBACK HIERARCHY:
1. Company data: query_analysis(search, "growth") → query_analysis(search, "KPIs")
2. Live metrics: query_integration_data(provider: "stripe") for revenue trends, query_integration_data(provider: "google_analytics") for traffic
3. Social analytics: get_social_analytics(platform) for engagement data before creating content
4. Research: web_search → scrape_website → write with available data
5. Social: post_to_linkedin / post_to_twitter / post_to_instagram / post_to_facebook (check connections internally)
6. Content: create_social_post, create_landing_page, create_email_campaign
7. Export: write_to_google_sheets for experiment trackers and results

CONTENT-FIRST WORKFLOW:
1. Pull live metrics with query_integration_data + get_social_analytics to ground strategy in real data.
2. Analyze current growth data from analysis.
3. Design experiments with ICE scores, success metrics, and test plans.
4. WRITE your content/strategy directly in your response FIRST.
5. AFTER writing, call posting tools directly. They handle connection checks internally.
6. Do NOT call check_connection — action tools handle it automatically.

PRINCIPLES:
- Every recommendation must be testable as an experiment.
- Prioritize by ICE (Impact x Confidence x Ease).
- AARRR framework: Acquisition, Activation, Retention, Revenue, Referral.
- Focus on scalable, repeatable growth — not one-time tactics.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
      'search_notion',
      'create_slide_deck',
      'write_to_google_sheets',
      'read_emails',
      'search_emails',
      'send_email',
      'reply_to_email',
      'send_slack_message',
      'query_integration_data',
      // CRM tools (for client research + sales support)
      'search_crm',
      'get_contact_details',
      'add_contact_note',
      'create_contact',
      'suggest_followups',
      'get_pipeline_summary',
    ],
    systemPromptExtension: `RESEARCH MODE — Web research, market analysis, competitive intelligence.

TOOL FALLBACK HIERARCHY:
1. Internal data: query_analysis(list_sections) → query_analysis(search, "...") → specific section
2. Web research: web_search (1-2 queries max) → scrape_website (1 URL) → write with available data
3. Integration data: query_integration_data for live metrics from connected services
4. Export: write_to_google_sheets / search_notion (check connections internally — return [connect:provider] if not connected)

ERROR RECOVERY:
- web_search fails → scrape_website on a specific URL ONCE → write with what you have.
- ALL tools fail → use query_analysis data + domain knowledge. State limitations clearly.
- NEVER retry same failed call. After 2 failures, write your answer and note gaps.
- Do NOT call check_connection — action tools handle it automatically.

STANDARDS:
- Cite sources for factual claims. Confidence levels: High/Medium/Low.
- Distinguish facts vs estimates vs opinions.
- Note data recency — markets change fast. Flag source biases.
- Never fabricate market sizes, competitor metrics, or statistics.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    costCeiling: 1.00,
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
      'send_slack_message',
      'send_email',
      'create_jira_ticket',
      'create_slide_deck',
      'read_emails',
      'reply_to_email',
      'search_emails',
      'write_to_google_sheets',
      'query_integration_data',
    ],
    systemPromptExtension: `CODEBOT MODE — GitHub actions, code quality, engineering metrics.

TOOL FALLBACK HIERARCHY:
1. Live data: query_integration_data(provider: "github") → real repo/PR/issue data
2. Analysis data: query_analysis(search, "engineering") → DORA metrics, tech debt
3. GitHub actions: check_connection(github) → github_create_issue/github_create_pr or [connect:github]
4. Project management: check_connection(jira) → create_jira_ticket or [connect:jira]

ACTION WORKFLOW (MANDATORY):
1. Pull GitHub data with query_integration_data BEFORE making claims about repos.
2. BEFORE any GitHub action: call check_connection for github.
3. Connected → call github_create_issue, github_create_pr, etc.
4. Not connected → output [connect:github]. NEVER say "go to settings."
5. NEVER pretend you created an issue/PR by writing it inline. The tool executes; text does not.

STANDARDS:
- Issues: clear title, reproduction steps, acceptance criteria, labels.
- PRs: description of WHY (not just what), link to issue, test plan.
- NEVER fabricate repo metrics, commit counts, or CI pass rates.

## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.`,
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
    costCeiling: 0.80,
    maxToolRounds: 10,
  },
};

// ── RAG tools: add document search to ALL outfits ────────────────────────────
// Every agent can search original uploaded documents for specific information.
const RAG_TOOLS = ['search_documents', 'list_documents'];

for (const outfit of Object.values(OUTFITS)) {
  for (const tool of RAG_TOOLS) {
    if (!outfit.tools.includes(tool)) {
      outfit.tools.push(tool);
    }
  }
}

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
