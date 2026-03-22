export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'hiring' | 'product' | 'operations';
  estimatedDuration: string;
  steps: Array<{
    title: string;
    description: string;
    agentId: string;
    dependsOn?: number[];
    delayMinutes?: number;
  }>;
}

const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch Campaign',
    description:
      'End-to-end product launch workflow: from competitive research through post-launch analytics. Covers messaging, content, visuals, social posts, email, and a 24-hour performance report.',
    category: 'marketing',
    estimatedDuration: '~4 hours',
    steps: [
      {
        title: 'Market Research & Competitive Analysis',
        description:
          'Research the competitive landscape, identify key differentiators, and analyze the target audience. Use web_search and analyze_competitors tools to gather data on top 3–5 competitors.',
        agentId: 'researcher',
      },
      {
        title: 'Launch Messaging & Positioning',
        description:
          'Based on the research findings, craft core messaging: tagline, value proposition, key benefits, and a clear positioning statement that differentiates the product from competitors.',
        agentId: 'strategist',
        dependsOn: [1],
      },
      {
        title: 'Create Launch Content Suite',
        description:
          'Write all written launch assets: blog post, press release snippet, product description, and social copy variations for each channel. Ground every claim in the positioning from Step 2.',
        agentId: 'marketer',
        dependsOn: [2],
      },
      {
        title: 'Generate Visual Assets',
        description:
          'Create visual assets for the launch: hero image, social media graphics, and any ad creatives. Use image generation tools and align visuals to the brand palette and messaging from Step 2.',
        agentId: 'marketer',
        dependsOn: [2],
      },
      {
        title: 'Publish Social Media Posts',
        description:
          'Publish launch posts across LinkedIn, Twitter, Instagram, and Facebook using the content from Step 3 and visuals from Step 4. Use post_to_linkedin, post_to_twitter, post_to_instagram, and post_to_facebook tools.',
        agentId: 'marketer',
        dependsOn: [3, 4],
      },
      {
        title: 'Send Launch Email Campaign',
        description:
          'Compose and send the launch announcement email to the mailing list using content from Step 3. Use send_email tool; include subject line, preheader, body, and a clear CTA.',
        agentId: 'marketer',
        dependsOn: [3],
      },
      {
        title: 'Post-Launch Analytics Report',
        description:
          'Pull engagement metrics from all channels 24 hours after launch and produce an analytics report: impressions, clicks, open rate, and top-performing content. Use analyze_data and any connected analytics tools.',
        agentId: 'analyst',
        dependsOn: [5, 6],
        delayMinutes: 1440,
      },
    ],
  },
  {
    id: 'content-calendar-week',
    name: 'Weekly Content Calendar',
    description:
      'Plan and produce a full week of content: LinkedIn posts for Mon–Fri, a Twitter thread, a newsletter draft, and export everything to a content calendar spreadsheet.',
    category: 'marketing',
    estimatedDuration: '~1 hour',
    steps: [
      {
        title: 'Content Strategy & Topics',
        description:
          'Define this week\'s content themes, choose 5 LinkedIn post topics and 1 Twitter thread topic aligned to business goals. Output a structured topic list with angle, hook, and target audience for each.',
        agentId: 'strategist',
      },
      {
        title: 'Write LinkedIn Posts Mon–Fri',
        description:
          'Write 5 LinkedIn posts (one per day) based on the topics from Step 1. Each post should have a strong hook, 3–5 paragraphs, and a clear CTA. Vary formats: story, tip list, insight, question, and stat.',
        agentId: 'marketer',
        dependsOn: [1],
      },
      {
        title: 'Write Twitter Thread Content',
        description:
          'Write the Twitter thread identified in Step 1: tweet 1 (hook), tweets 2–8 (value), tweet 9 (CTA/summary). Each tweet must be under 280 characters. Format as a numbered list.',
        agentId: 'marketer',
        dependsOn: [1],
      },
      {
        title: 'Draft Newsletter',
        description:
          'Compile the week\'s content into a newsletter draft: intro paragraph, 3 highlights from the LinkedIn posts, the full Twitter thread, and a closing CTA. Aim for 400–600 words.',
        agentId: 'marketer',
        dependsOn: [2, 3],
      },
      {
        title: 'Export to Content Calendar',
        description:
          'Export all content (LinkedIn posts with publish dates, Twitter thread, newsletter draft) to Google Sheets using write_to_google_sheets. Columns: Date, Platform, Content, Status, Notes.',
        agentId: 'operator',
        dependsOn: [2, 3, 4],
      },
    ],
  },
  {
    id: 'hiring-pipeline',
    name: 'Hiring Pipeline Setup',
    description:
      'Build a complete hiring pipeline for a new role: job description, salary benchmarks, screening scorecard, interview questions for 3 rounds, and job posting with team notification.',
    category: 'hiring',
    estimatedDuration: '~2 hours',
    steps: [
      {
        title: 'Job Description & Requirements',
        description:
          'Write a full job description for the role: summary, responsibilities (8–10 bullets), required qualifications, nice-to-haves, and what success looks like in 30/60/90 days.',
        agentId: 'recruiter',
      },
      {
        title: 'Salary Benchmarking',
        description:
          'Research market compensation for this role by level and location using web_search. Provide a recommended salary band (low/mid/high), total compensation breakdown, and 2–3 comparable job postings as references.',
        agentId: 'recruiter',
        dependsOn: [1],
      },
      {
        title: 'Screening Criteria & Scorecard',
        description:
          'Create a structured screening scorecard based on the job description: 5–7 evaluation criteria, a 1–4 rating scale per criterion, and the minimum bar to advance to interviews.',
        agentId: 'recruiter',
        dependsOn: [1],
      },
      {
        title: 'Interview Questions — 3 Rounds',
        description:
          'Write interview questions for three rounds: (1) recruiter screen — 5 behavioral questions, (2) hiring manager — 8 technical/situational questions, (3) team panel — 6 culture and collaboration questions. Include what a strong answer looks like for each.',
        agentId: 'recruiter',
        dependsOn: [1, 3],
      },
      {
        title: 'Post Job & Notify Team',
        description:
          'Post the job description to relevant job boards and send a Slack message to the hiring channel with the role summary, salary band, and timeline. Use send_slack_message for internal notification.',
        agentId: 'recruiter',
        dependsOn: [1, 2],
      },
    ],
  },
  {
    id: 'financial-review',
    name: 'Monthly Financial Review',
    description:
      'End-to-end financial review: pull live data from connected integrations, compute KPIs, write an executive summary, generate strategic recommendations, and deliver outputs to Sheets with team notification.',
    category: 'operations',
    estimatedDuration: '~2 hours',
    steps: [
      {
        title: 'Pull Financial Data',
        description:
          'Retrieve the latest financial data from connected integrations (Stripe, QuickBooks, or Salesforce). Compile MRR, ARR, churn, burn rate, runway, top revenue sources, and expense categories.',
        agentId: 'analyst',
      },
      {
        title: 'Financial Analysis & KPIs',
        description:
          'Analyze the data from Step 1 and compute key financial KPIs: growth rate (MoM, YoY), gross margin, CAC, LTV, LTV:CAC ratio, and NRR. Identify trends, anomalies, and month-over-month changes.',
        agentId: 'analyst',
        dependsOn: [1],
      },
      {
        title: 'Executive Summary Report',
        description:
          'Write a 1-page executive summary covering: financial health snapshot, 3 wins, 3 concerns, KPI dashboard table, and a 30-day outlook. Ground every statement in the data from Step 2.',
        agentId: 'analyst',
        dependsOn: [2],
      },
      {
        title: 'Strategic Recommendations',
        description:
          'Based on the financial analysis, produce 3–5 prioritized strategic recommendations with rationale, expected impact, effort level, and a suggested owner. Focus on moves that improve the weakest KPIs.',
        agentId: 'strategist',
        dependsOn: [2],
      },
      {
        title: 'Export to Sheets & Notify Team',
        description:
          'Write the KPI table and recommendations to Google Sheets using write_to_google_sheets, then send a Slack summary with key numbers and a link to the sheet using send_slack_message.',
        agentId: 'operator',
        dependsOn: [3, 4],
      },
    ],
  },
  {
    id: 'competitor-intel',
    name: 'Competitor Intelligence Report',
    description:
      'Deep competitive intelligence workflow: web research on competitors, market positioning analysis, SWOT, battle cards for the sales team, and a strategic response plan.',
    category: 'sales',
    estimatedDuration: '~3 hours',
    steps: [
      {
        title: 'Competitor Web Research',
        description:
          'Use web_search to research the top 3–5 competitors: pricing pages, feature lists, recent news, customer reviews (G2/Capterra), hiring trends, and any recent product updates or pivots.',
        agentId: 'researcher',
      },
      {
        title: 'Market Positioning Analysis',
        description:
          'Analyze how each competitor positions itself: messaging, target segment, key claims, and pricing model. Map each competitor on a 2×2 positioning matrix (e.g., price vs. features) and identify whitespace.',
        agentId: 'researcher',
        dependsOn: [1],
      },
      {
        title: 'SWOT Analysis',
        description:
          'Produce a structured SWOT analysis for our company relative to the competitive landscape from Steps 1–2. Each quadrant should have 4–6 specific, evidence-backed points — no generic statements.',
        agentId: 'strategist',
        dependsOn: [1, 2],
      },
      {
        title: 'Battle Cards',
        description:
          'Create one-page battle cards for the top 3 competitors. Each card: competitor overview, their pitch, our winning differentiators, common objections + rebuttals, and when we win vs. lose.',
        agentId: 'marketer',
        dependsOn: [3],
      },
      {
        title: 'Strategic Response Plan',
        description:
          'Write a 90-day strategic response plan addressing the most pressing competitive threats. Include 3–5 initiatives with priority, rationale, expected outcome, and suggested owner based on the SWOT and battle cards.',
        agentId: 'strategist',
        dependsOn: [3, 4],
      },
    ],
  },
];

export function getCampaignTemplate(templateId: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === templateId);
}

export function listCampaignTemplates(): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES;
}

export function getTemplatesByCategory(
  category: CampaignTemplate['category'],
): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter((t) => t.category === category);
}
