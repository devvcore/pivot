/**
 * HR / Talent Tools — Job postings, interviews, salary benchmarks, onboarding, reviews
 *
 * Uses Gemini Flash for intelligent content generation.
 * Pulls from MVPDeliverables (hiringPlan, talentGapAnalysis, etc.) for context.
 */

import { GoogleGenAI } from '@google/genai';
import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

const FLASH_MODEL = 'gemini-2.5-flash';

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '[Error: GEMINI_API_KEY not configured. HR tools unavailable.]';

  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: { temperature: 0.5, maxOutputTokens: 6000 },
      });
      const text = response.text ?? '';
      if (text.trim()) return text;
      if (attempt < 2) console.warn(`[HR] Empty response (attempt ${attempt + 1}/3), retrying...`);
    } catch (e) {
      console.warn(`[HR] Gemini call failed (attempt ${attempt + 1}/3):`, e);
      if (attempt === 2) return '[Error: HR tool failed after 3 attempts. Please try again.]';
    }
  }
  return '[Error: Could not generate HR content. Please try again.]';
}

function getHRContext(context: ToolContext): string {
  if (!context.deliverables) {
    return `No pre-existing HR analysis data is available.
IMPORTANT: You MUST still produce specific, professional HR deliverables. Use the role title, department, seniority level, location, salary range, and any other details provided in the tool arguments. Base salary estimates on publicly available market data for the specified role and location. Do NOT produce generic job descriptions — tailor every section to the specific role, company type, and industry mentioned.`;
  }
  const d = context.deliverables;
  const parts: string[] = [];

  if (d.hiringPlan) {
    const hp = d.hiringPlan as any;
    parts.push(`Hiring Plan: ${hp.recommendations?.length ?? 0} roles recommended. Gaps: ${hp.currentTeamGaps?.slice(0, 5).map((g: any) => g.role ?? g.title ?? g).join(', ') ?? 'N/A'}. ${hp.summary ?? ''}`);
  }
  if (d.talentGapAnalysis) {
    const tg = d.talentGapAnalysis as any;
    parts.push(`Talent Gaps: ${tg.gaps?.slice(0, 5).map((g: any) => `${g.skill ?? g.role ?? g} (${g.severity ?? g.priority ?? 'medium'})`).join(', ') ?? 'N/A'}`);
  }
  if (d.cultureAssessment) {
    const ca = d.cultureAssessment as any;
    parts.push(`Culture: Score ${ca.score ?? ca.overallScore ?? '?'}/100. Values: ${ca.coreValues?.join(', ') ?? 'N/A'}`);
  }
  if (d.teamPerformance) {
    const tp = d.teamPerformance as any;
    parts.push(`Team: ${tp.teamSize ?? '?'} members. ${tp.summary ?? ''}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Limited HR data available. Focus on the role details and requirements provided to create specific deliverables.';
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const createJobPosting: Tool = {
  name: 'create_job_posting',
  description: 'Generate a comprehensive, compelling job posting for any role. Includes job description, requirements, responsibilities, benefits, and company pitch. Tailored to attract the right candidates.',
  parameters: {
    role_title: {
      type: 'string',
      description: 'Job title (e.g., "Senior Full-Stack Developer", "VP of Sales").',
    },
    department: {
      type: 'string',
      description: 'Department.',
      enum: ['engineering', 'sales', 'marketing', 'operations', 'finance', 'hr', 'product', 'design', 'support', 'executive'],
    },
    seniority: {
      type: 'string',
      description: 'Seniority level.',
      enum: ['intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'c_level'],
    },
    employment_type: {
      type: 'string',
      description: 'Employment type.',
      enum: ['full_time', 'part_time', 'contract', 'freelance'],
    },
    location: {
      type: 'string',
      description: 'Location (e.g., "Remote", "New York, NY", "Hybrid - San Francisco").',
    },
    salary_range: {
      type: 'string',
      description: 'Salary range (e.g., "$120K-$160K").',
    },
    key_requirements: {
      type: 'string',
      description: 'Must-have skills or experience, comma-separated.',
    },
    company_pitch: {
      type: 'string',
      description: 'Brief company description and why someone would want to work there.',
    },
  },
  required: ['role_title', 'department'],
  category: 'hr',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const role = String(args.role_title ?? '');
    const department = String(args.department ?? '');
    const seniority = String(args.seniority ?? 'mid');
    const employmentType = String(args.employment_type ?? 'full_time');
    const location = String(args.location ?? 'Remote');
    const salaryRange = args.salary_range ? String(args.salary_range) : '';
    const requirements = args.key_requirements ? String(args.key_requirements) : '';
    const companyPitch = args.company_pitch ? String(args.company_pitch) : '';
    const hrContext = getHRContext(context);

    const prompt = `You are an expert technical recruiter and employer branding specialist. Create a compelling job posting.

BUSINESS CONTEXT:
${hrContext}

JOB PARAMETERS:
- Title: ${role}
- Department: ${department}
- Seniority: ${seniority}
- Type: ${employmentType.replace('_', ' ')}
- Location: ${location}
${salaryRange ? `- Salary Range: ${salaryRange}` : ''}
${requirements ? `- Must-Have Requirements: ${requirements}` : ''}
${companyPitch ? `- Company Pitch: ${companyPitch}` : ''}

Create a job posting with these sections:

1. **Headline** — Compelling, specific title (not just the role name)
2. **About the Company** — Engaging 2-3 paragraphs about the mission and culture
3. **About the Role** — What makes this role exciting and impactful
4. **Responsibilities** — 6-8 specific, measurable responsibilities
5. **Requirements** — Split into "Must Have" (5-6) and "Nice to Have" (3-4)
6. **What We Offer** — Benefits, perks, culture, growth opportunities
7. **How to Apply** — Process and what to include

Writing guidelines:
- Use inclusive language (avoid gendered pronouns, age-biased terms)
- Focus on impact, not just tasks
- Be specific about the tech stack or tools for technical roles
- Highlight growth and learning opportunities
- Keep requirements realistic (avoid "10 years of React" syndrome)`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.002,
    };
  },
};

const createInterviewQuestions: Tool = {
  name: 'create_interview_questions',
  description: 'Generate role-specific interview questions with evaluation rubrics. Covers behavioral, technical, situational, and culture-fit questions with ideal response criteria.',
  parameters: {
    role_title: {
      type: 'string',
      description: 'Role being interviewed for.',
    },
    interview_stage: {
      type: 'string',
      description: 'Interview stage.',
      enum: ['phone_screen', 'technical', 'behavioral', 'final_round', 'comprehensive'],
    },
    focus_areas: {
      type: 'string',
      description: 'Specific areas to focus on, comma-separated (e.g., "leadership,problem-solving,technical-depth").',
    },
    num_questions: {
      type: 'number',
      description: 'Number of questions to generate (5-15).',
    },
  },
  required: ['role_title'],
  category: 'hr',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const role = String(args.role_title ?? '');
    const stage = String(args.interview_stage ?? 'comprehensive');
    const focusAreas = args.focus_areas ? String(args.focus_areas) : '';
    const numQuestions = Number(args.num_questions ?? 10);
    const hrContext = getHRContext(context);

    const prompt = `You are an expert interviewer and talent assessment specialist.

BUSINESS CONTEXT:
${hrContext}

INTERVIEW PARAMETERS:
- Role: ${role}
- Stage: ${stage.replace('_', ' ')}
- Number of Questions: ${numQuestions}
${focusAreas ? `- Focus Areas: ${focusAreas}` : ''}

Generate a structured interview guide with:

For each question provide:

**Q#: [Question]**
- **Type**: Behavioral / Technical / Situational / Culture Fit
- **Skill Assessed**: What competency this evaluates
- **What to Listen For**: Key indicators of a strong answer
- **Red Flags**: Warning signs in the response
- **Follow-up**: A probing follow-up question
- **Scoring Guide**: 1 (Poor) to 5 (Exceptional) criteria

Also include:
- **Opening Script**: How to start the interview
- **Closing Script**: How to end and set expectations
- **Evaluation Summary Sheet**: Scorecard template
- **Decision Framework**: How to make the hire/no-hire decision`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.002,
    };
  },
};

const salaryBenchmark: Tool = {
  name: 'salary_benchmark',
  description: 'Research salary benchmarks for a specific role, adjusted for location, seniority, company stage, and industry. Provides percentile ranges and total compensation analysis.',
  parameters: {
    role_title: {
      type: 'string',
      description: 'Job title to benchmark.',
    },
    location: {
      type: 'string',
      description: 'Location for cost-of-living adjustment.',
    },
    seniority: {
      type: 'string',
      description: 'Seniority level.',
      enum: ['junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'c_level'],
    },
    company_stage: {
      type: 'string',
      description: 'Company stage.',
      enum: ['pre_seed', 'seed', 'series_a', 'series_b', 'growth', 'enterprise', 'public'],
    },
    industry: {
      type: 'string',
      description: 'Industry sector.',
    },
  },
  required: ['role_title'],
  category: 'hr',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const role = String(args.role_title ?? '');
    const location = String(args.location ?? 'United States');
    const seniority = String(args.seniority ?? 'mid');
    const companyStage = args.company_stage ? String(args.company_stage).replace('_', ' ') : '';
    const industry = args.industry ? String(args.industry) : '';
    const hrContext = getHRContext(context);

    const prompt = `You are a compensation analyst and HR benchmarking expert.

BUSINESS CONTEXT:
${hrContext}

BENCHMARK PARAMETERS:
- Role: ${role}
- Location: ${location}
- Seniority: ${seniority}
${companyStage ? `- Company Stage: ${companyStage}` : ''}
${industry ? `- Industry: ${industry}` : ''}

Provide a comprehensive salary benchmark analysis:

1. **Base Salary Range** (25th, 50th, 75th, 90th percentile)
2. **Total Compensation Breakdown**:
   - Base salary
   - Bonus/commission structure
   - Equity/stock options (if applicable)
   - Benefits value
3. **Location Adjustment**: Cost-of-living factor vs national average
4. **Company Stage Adjustment**: How startup vs enterprise affects comp
5. **Market Trends**: Is this role's compensation trending up/down?
6. **Competing Offers**: What top companies are paying
7. **Recommendation**: Where to price to attract strong candidates without overpaying
8. **Negotiation Range**: Floor, target, and ceiling for negotiations

IMPORTANT: Label ALL salary figures as "AI-estimated based on 2025-2026 market data patterns." Include a disclaimer that actual salaries vary.
Recommend the user verify with: Levels.fyi, Glassdoor, Payscale, or Radford surveys.
If you are uncertain about a specific market, say so — do NOT fabricate precise numbers.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.002,
    };
  },
};

const createOnboardingPlan: Tool = {
  name: 'create_onboarding_plan',
  description: 'Design a comprehensive employee onboarding plan. Covers first 90 days with daily/weekly milestones, training modules, key relationships, and success metrics.',
  parameters: {
    role_title: {
      type: 'string',
      description: 'Role being onboarded.',
    },
    department: {
      type: 'string',
      description: 'Department.',
    },
    start_date: {
      type: 'string',
      description: 'Planned start date (YYYY-MM-DD).',
    },
    team_size: {
      type: 'number',
      description: 'Size of the team they are joining.',
    },
    key_tools: {
      type: 'string',
      description: 'Key tools/systems they will need to learn, comma-separated.',
    },
    buddy_name: {
      type: 'string',
      description: 'Onboarding buddy or mentor name.',
    },
  },
  required: ['role_title', 'department'],
  category: 'hr',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const role = String(args.role_title ?? '');
    const department = String(args.department ?? '');
    const startDate = args.start_date ? String(args.start_date) : 'TBD';
    const teamSize = args.team_size ? Number(args.team_size) : undefined;
    const keyTools = args.key_tools ? String(args.key_tools) : '';
    const buddy = args.buddy_name ? String(args.buddy_name) : '';
    const hrContext = getHRContext(context);

    const prompt = `You are an expert in employee onboarding and organizational development.

BUSINESS CONTEXT:
${hrContext}

ONBOARDING PARAMETERS:
- Role: ${role}
- Department: ${department}
- Start Date: ${startDate}
${teamSize ? `- Team Size: ${teamSize}` : ''}
${keyTools ? `- Key Tools: ${keyTools}` : ''}
${buddy ? `- Buddy/Mentor: ${buddy}` : ''}

Create a detailed 90-day onboarding plan:

**Pre-Day-1 Checklist** (HR/IT prep):
- Equipment, accounts, access to set up
- Welcome package items

**Week 1: Orientation**
- Day-by-day schedule
- Key meetings and introductions
- Systems access and training
- Company overview sessions

**Weeks 2-4: Foundation**
- Week-by-week milestones
- Training modules to complete
- Key relationships to build
- First small project/task

**Month 2: Contribution**
- Week-by-week expectations
- Increasing responsibility milestones
- Feedback checkpoints

**Month 3: Independence**
- Full role expectations
- Self-directed projects
- 90-day review criteria

For each section include:
- Specific tasks with owners
- Success metrics (how to know it's going well)
- Check-in schedule
- Potential red flags to watch for

Also include a 30-60-90 day review template.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.002,
    };
  },
};

const performanceReviewTemplate: Tool = {
  name: 'performance_review_template',
  description: 'Create a structured performance review framework for any role. Includes competency rubrics, self-assessment prompts, manager evaluation criteria, and growth planning.',
  parameters: {
    role_title: {
      type: 'string',
      description: 'Role being reviewed.',
    },
    review_period: {
      type: 'string',
      description: 'Review period (e.g., "Q4 2025", "Annual 2025").',
    },
    competencies: {
      type: 'string',
      description: 'Key competencies to evaluate, comma-separated. Leave empty for auto-generated.',
    },
    review_type: {
      type: 'string',
      description: 'Type of review.',
      enum: ['quarterly', 'semi_annual', 'annual', '360_degree'],
    },
  },
  required: ['role_title'],
  category: 'hr',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const role = String(args.role_title ?? '');
    const reviewPeriod = String(args.review_period ?? 'Current Period');
    const competencies = args.competencies ? String(args.competencies) : '';
    const reviewType = String(args.review_type ?? 'quarterly');
    const hrContext = getHRContext(context);

    const prompt = `You are an HR expert specializing in performance management.

BUSINESS CONTEXT:
${hrContext}

REVIEW PARAMETERS:
- Role: ${role}
- Period: ${reviewPeriod}
- Type: ${reviewType.replace('_', ' ')}
${competencies ? `- Key Competencies: ${competencies}` : '- Competencies: Generate appropriate ones for this role'}

Create a comprehensive performance review framework:

1. **Self-Assessment Section** (for the employee):
   - 5-7 reflection prompts
   - Accomplishments summary template
   - Challenges and learning section
   - Goals achieved vs goals set

2. **Manager Evaluation Section**:
   - For each competency:
     - Rating scale (1-5) with clear descriptors
     - Behavioral examples at each level
     - Evidence/example requirement

3. **360-Degree Feedback Prompts** (if applicable):
   - Peer review questions (5)
   - Cross-functional feedback questions (3)
   - Direct report feedback questions (if manager role) (4)

4. **Goal Setting for Next Period**:
   - SMART goal template (3-5 goals)
   - Development goals (1-2)
   - Stretch goals (1)

5. **Growth & Development Plan**:
   - Skill development priorities
   - Training/learning recommendations
   - Mentorship opportunities
   - Career pathing discussion guide

6. **Summary and Rating**:
   - Overall rating template
   - Compensation discussion framework
   - Promotion readiness assessment`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.002,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const hrTools: Tool[] = [
  createJobPosting,
  createInterviewQuestions,
  salaryBenchmark,
  createOnboardingPlan,
  performanceReviewTemplate,
];
registerTools(hrTools);
