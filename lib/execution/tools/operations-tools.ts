/**
 * Operations Tools — Process docs, SOPs, risk assessment, project plans, vendor comparison
 *
 * Uses Gemini Flash for intelligent content generation.
 * Pulls from MVPDeliverables (riskRegister, processEfficiency, etc.) for context.
 */

import { GoogleGenAI } from '@google/genai';
import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

const FLASH_MODEL = 'gemini-2.5-flash';

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.4, maxOutputTokens: 4000 },
  });
  return response.text ?? '';
}

function getOpsContext(context: ToolContext): string {
  if (!context.deliverables) return 'No analysis data available.';
  const d = context.deliverables;
  const parts: string[] = [];

  if (d.riskRegister) parts.push(`Risk Register: ${JSON.stringify(d.riskRegister).slice(0, 1000)}`);
  if (d.processEfficiency) parts.push(`Process Efficiency: ${JSON.stringify(d.processEfficiency).slice(0, 1000)}`);
  if (d.healthChecklist) parts.push(`Health Checklist: ${JSON.stringify(d.healthChecklist).slice(0, 800)}`);
  if (d.strategicInitiatives) parts.push(`Strategic Initiatives: ${JSON.stringify(d.strategicInitiatives).slice(0, 800)}`);
  if (d.complianceChecklist) parts.push(`Compliance: ${JSON.stringify(d.complianceChecklist).slice(0, 500)}`);

  return parts.length > 0 ? parts.join('\n\n') : 'Limited operations data available.';
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const createProcessDocument: Tool = {
  name: 'create_process_document',
  description: 'Document a business process with clear steps, decision points, ownership, inputs/outputs, and process flow. Suitable for knowledge transfer and process improvement.',
  parameters: {
    process_name: {
      type: 'string',
      description: 'Name of the process (e.g., "Customer Onboarding", "Invoice Approval").',
    },
    department: {
      type: 'string',
      description: 'Department that owns this process.',
    },
    current_steps: {
      type: 'string',
      description: 'Known current steps (brief description). Leave empty to generate from context.',
    },
    pain_points: {
      type: 'string',
      description: 'Known issues with the current process, comma-separated.',
    },
    stakeholders: {
      type: 'string',
      description: 'People/roles involved in this process, comma-separated.',
    },
  },
  required: ['process_name'],
  category: 'operations',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const processName = String(args.process_name ?? '');
    const department = args.department ? String(args.department) : '';
    const currentSteps = args.current_steps ? String(args.current_steps) : '';
    const painPoints = args.pain_points ? String(args.pain_points) : '';
    const stakeholders = args.stakeholders ? String(args.stakeholders) : '';
    const opsContext = getOpsContext(context);

    const prompt = `You are a business process analyst and documentation expert.

BUSINESS CONTEXT:
${opsContext}

PROCESS DETAILS:
- Process: ${processName}
${department ? `- Department: ${department}` : ''}
${currentSteps ? `- Current Steps: ${currentSteps}` : ''}
${painPoints ? `- Pain Points: ${painPoints}` : ''}
${stakeholders ? `- Stakeholders: ${stakeholders}` : ''}

Create a comprehensive process document:

1. **Process Overview**
   - Purpose and scope
   - Process owner
   - Trigger (what starts this process)
   - Expected outcome

2. **Process Flow** (step-by-step):
   For each step:
   - Step number and name
   - Description (what happens)
   - Responsible party (role, not person)
   - Input required
   - Output produced
   - Decision points (if any) with Yes/No paths
   - Time estimate
   - Tools/systems used

3. **RACI Matrix**
   Step | Responsible | Accountable | Consulted | Informed

4. **Exception Handling**
   - Common exceptions and how to handle them
   - Escalation paths

5. **Metrics & KPIs**
   - Process cycle time target
   - Quality metrics
   - Volume metrics

6. **Improvement Opportunities**
   - Automation candidates
   - Bottleneck reduction
   - Quality improvements

7. **Version Control**
   - Document version, date, author placeholder`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `process-${processName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

const createSOP: Tool = {
  name: 'create_sop',
  description: 'Create a Standard Operating Procedure (SOP) with detailed instructions, safety considerations, compliance requirements, and training materials. Formal, auditable format.',
  parameters: {
    sop_title: {
      type: 'string',
      description: 'SOP title (e.g., "Data Backup Procedure", "Client Complaint Resolution").',
    },
    department: {
      type: 'string',
      description: 'Owning department.',
    },
    audience: {
      type: 'string',
      description: 'Who will use this SOP (e.g., "all employees", "engineering team", "customer support").',
    },
    regulatory_requirements: {
      type: 'string',
      description: 'Any regulatory or compliance requirements to address.',
    },
    frequency: {
      type: 'string',
      description: 'How often this procedure is performed.',
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'as_needed', 'event_triggered'],
    },
  },
  required: ['sop_title'],
  category: 'operations',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const title = String(args.sop_title ?? '');
    const department = args.department ? String(args.department) : '';
    const audience = args.audience ? String(args.audience) : 'all employees';
    const regulatory = args.regulatory_requirements ? String(args.regulatory_requirements) : '';
    const frequency = String(args.frequency ?? 'as_needed');
    const opsContext = getOpsContext(context);

    const prompt = `You are an expert in creating Standard Operating Procedures (SOPs) and quality management systems.

BUSINESS CONTEXT:
${opsContext}

SOP PARAMETERS:
- Title: ${title}
${department ? `- Department: ${department}` : ''}
- Audience: ${audience}
- Frequency: ${frequency.replace('_', ' ')}
${regulatory ? `- Regulatory Requirements: ${regulatory}` : ''}

Create a formal SOP document with:

**HEADER BLOCK:**
- SOP Number: [auto-generate]
- Title: ${title}
- Department: ${department || '[Department]'}
- Effective Date: [Today's date]
- Review Date: [+1 year]
- Version: 1.0
- Approved By: [Approver]

1. **PURPOSE**
   - Clear statement of why this SOP exists

2. **SCOPE**
   - What is covered and not covered
   - Who this applies to

3. **DEFINITIONS**
   - Key terms used in this SOP

4. **RESPONSIBILITIES**
   - Role | Responsibility matrix

5. **PROCEDURE**
   - Numbered step-by-step instructions
   - Include warnings/cautions where safety-relevant
   - Decision trees for conditional steps
   - Screenshots/diagram descriptions where helpful

6. **SAFETY & COMPLIANCE**
   - Safety considerations
   - Regulatory compliance requirements
   - Data handling/privacy considerations

7. **DOCUMENTATION & RECORDS**
   - What records must be kept
   - Where to file them
   - Retention period

8. **EXCEPTIONS & ESCALATION**
   - When to deviate from this SOP
   - Escalation contacts and process

9. **TRAINING REQUIREMENTS**
   - Initial training requirements
   - Refresher training schedule
   - Competency assessment method

10. **REVISION HISTORY**
    - Version | Date | Changes | Author table`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `sop-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

const riskAssessment: Tool = {
  name: 'risk_assessment',
  description: 'Conduct a comprehensive risk assessment for a project, initiative, or business area. Uses analysis data to identify risks, assess likelihood and impact, and propose mitigations.',
  parameters: {
    subject: {
      type: 'string',
      description: 'What to assess risks for (e.g., "product launch", "market expansion to EU", "migration to new platform").',
    },
    risk_category: {
      type: 'string',
      description: 'Category focus.',
      enum: ['strategic', 'operational', 'financial', 'compliance', 'technology', 'all'],
    },
    time_horizon: {
      type: 'string',
      description: 'Time period to assess.',
      enum: ['30_days', '90_days', '6_months', '12_months'],
    },
    risk_appetite: {
      type: 'string',
      description: 'Organization risk appetite.',
      enum: ['conservative', 'moderate', 'aggressive'],
    },
  },
  required: ['subject'],
  category: 'operations',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const subject = String(args.subject ?? '');
    const category = String(args.risk_category ?? 'all');
    const horizon = String(args.time_horizon ?? '90_days').replace('_', ' ');
    const appetite = String(args.risk_appetite ?? 'moderate');
    const opsContext = getOpsContext(context);

    const prompt = `You are a risk management expert and strategic advisor.

BUSINESS CONTEXT:
${opsContext}

RISK ASSESSMENT PARAMETERS:
- Subject: ${subject}
- Category Focus: ${category}
- Time Horizon: ${horizon}
- Risk Appetite: ${appetite}

Conduct a comprehensive risk assessment:

1. **Risk Identification** — For each risk:
   - Risk ID (R-001, R-002, etc.)
   - Risk description
   - Category (Strategic/Operational/Financial/Compliance/Technology)
   - Root cause

2. **Risk Analysis Matrix**:
   Risk ID | Likelihood (1-5) | Impact (1-5) | Risk Score | Priority

3. **Heat Map Summary**:
   - Critical (score 20-25): Immediate action required
   - High (score 12-19): Active management needed
   - Medium (score 6-11): Monitor closely
   - Low (score 1-5): Accept and monitor

4. **Mitigation Plans** (for High/Critical risks):
   - Risk ID
   - Mitigation strategy
   - Action items with owners
   - Timeline
   - Residual risk after mitigation
   - Cost of mitigation

5. **Contingency Plans**:
   - Trigger events
   - Response actions
   - Communication plan

6. **Risk Monitoring Plan**:
   - Key risk indicators (KRIs) to track
   - Review frequency
   - Escalation thresholds

7. **Recommendations**:
   - Top 3 risks to address immediately
   - Insurance or transfer opportunities
   - Organizational changes to reduce risk exposure`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `risk-assessment-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

const createProjectPlan: Tool = {
  name: 'create_project_plan',
  description: 'Create a project plan with phases, milestones, timeline, resource allocation, dependencies, and risk considerations. Outputs a structured plan with Gantt-chart-ready data.',
  parameters: {
    project_name: {
      type: 'string',
      description: 'Project name.',
    },
    objective: {
      type: 'string',
      description: 'Project objective / what success looks like.',
    },
    duration_weeks: {
      type: 'number',
      description: 'Expected project duration in weeks.',
    },
    team_size: {
      type: 'number',
      description: 'Number of team members available.',
    },
    budget: {
      type: 'number',
      description: 'Project budget in dollars.',
    },
    constraints: {
      type: 'string',
      description: 'Known constraints (e.g., "must launch before Q2", "limited to 2 developers").',
    },
  },
  required: ['project_name', 'objective'],
  category: 'operations',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const projectName = String(args.project_name ?? '');
    const objective = String(args.objective ?? '');
    const durationWeeks = Number(args.duration_weeks ?? 12);
    const teamSize = args.team_size ? Number(args.team_size) : undefined;
    const budget = args.budget ? Number(args.budget) : undefined;
    const constraints = args.constraints ? String(args.constraints) : '';
    const opsContext = getOpsContext(context);

    const prompt = `You are a senior project manager with PMP-level expertise.

BUSINESS CONTEXT:
${opsContext}

PROJECT PARAMETERS:
- Project: ${projectName}
- Objective: ${objective}
- Duration: ${durationWeeks} weeks
${teamSize ? `- Team Size: ${teamSize}` : ''}
${budget ? `- Budget: $${budget.toLocaleString()}` : ''}
${constraints ? `- Constraints: ${constraints}` : ''}

Create a comprehensive project plan:

1. **Project Charter**
   - Objective, scope, success criteria
   - Key stakeholders
   - Out of scope items

2. **Work Breakdown Structure (WBS)**
   Phase > Deliverable > Task hierarchy

3. **Timeline & Milestones**
   Week | Phase | Key Activities | Milestone | Deliverable
   (Provide data that could be used to generate a Gantt chart)

4. **Resource Allocation**
   Role | Allocation % | Phase assignments

5. **Dependencies**
   Task | Depends On | Type (FS/SS/FF/SF)

6. **Risk Register** (project-specific risks)
   Risk | Likelihood | Impact | Mitigation

7. **Communication Plan**
   - Status report frequency
   - Meeting cadence
   - Escalation path

8. **Quality Assurance**
   - Acceptance criteria per deliverable
   - Review/approval process

9. **Budget Breakdown** (if budget provided)
   Category | Amount | % of Total

10. **Change Management**
    - How to handle scope changes
    - Approval workflow

Output the timeline data as a CSV at the end for Gantt chart import.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `project-plan-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

const vendorComparison: Tool = {
  name: 'vendor_comparison',
  description: 'Compare vendors, tools, or solutions across key criteria. Generates a weighted scoring matrix, pros/cons analysis, and recommendation with rationale.',
  parameters: {
    category: {
      type: 'string',
      description: 'What type of vendor/solution (e.g., "CRM", "cloud hosting", "email marketing", "payroll").',
    },
    vendors: {
      type: 'string',
      description: 'Comma-separated list of vendors to compare (e.g., "HubSpot,Salesforce,Pipedrive").',
    },
    criteria: {
      type: 'string',
      description: 'Evaluation criteria, comma-separated (e.g., "price,features,support,scalability").',
    },
    budget: {
      type: 'string',
      description: 'Budget range (e.g., "$0-$500/mo").',
    },
    team_size: {
      type: 'number',
      description: 'Number of users/seats needed.',
    },
    must_haves: {
      type: 'string',
      description: 'Must-have features, comma-separated.',
    },
  },
  required: ['category'],
  category: 'operations',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const categoryName = String(args.category ?? '');
    const vendors = args.vendors ? String(args.vendors).split(',').map(v => v.trim()) : [];
    const criteria = args.criteria ? String(args.criteria).split(',').map(c => c.trim()) : [];
    const budget = args.budget ? String(args.budget) : '';
    const teamSize = args.team_size ? Number(args.team_size) : undefined;
    const mustHaves = args.must_haves ? String(args.must_haves) : '';
    const opsContext = getOpsContext(context);

    const prompt = `You are a technology consultant specializing in vendor selection and procurement.

BUSINESS CONTEXT:
${opsContext}

COMPARISON PARAMETERS:
- Category: ${categoryName}
${vendors.length > 0 ? `- Vendors to Compare: ${vendors.join(', ')}` : '- Vendors: Recommend top 3-5 options'}
${criteria.length > 0 ? `- Criteria: ${criteria.join(', ')}` : '- Criteria: Generate appropriate ones'}
${budget ? `- Budget: ${budget}` : ''}
${teamSize ? `- Team Size: ${teamSize} users` : ''}
${mustHaves ? `- Must-Have Features: ${mustHaves}` : ''}

Create a comprehensive vendor comparison:

1. **Vendor Overview** (for each):
   - Company background
   - Target market
   - Pricing model and tiers
   - Key differentiators

2. **Weighted Scoring Matrix**:
   Criteria (Weight) | Vendor1 | Vendor2 | Vendor3 | ...
   Score each 1-10, multiply by weight, total at bottom

3. **Detailed Comparison** (for each criterion):
   - How each vendor performs
   - Evidence/reasoning for scores

4. **Pros & Cons** (for each vendor):
   - Top 3 pros
   - Top 3 cons
   - Best for (use case)

5. **Total Cost of Ownership (TCO)**:
   - Monthly/annual cost
   - Implementation cost
   - Training cost
   - Hidden costs (integrations, add-ons)

6. **Recommendation**:
   - Best overall choice and why
   - Best budget choice
   - Best premium choice
   - Migration/implementation plan for recommended vendor

7. **Decision Matrix Summary**:
   One-line verdict for quick stakeholder review`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `vendor-comparison-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const operationsTools: Tool[] = [
  createProcessDocument,
  createSOP,
  riskAssessment,
  createProjectPlan,
  vendorComparison,
];
registerTools(operationsTools);
