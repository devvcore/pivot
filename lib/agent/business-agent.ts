/**
 * ARIA — Adaptive Revenue Intelligence Advisor
 *
 * Pivot's business intelligence AI agent. Powered by Gemini Flash.
 *
 * Architecture (token-efficient):
 * - Loads ~600-word AgentMemory summary (not full report) at conversation start
 * - Has 3 tools: web_search, get_report_section, analyze_website
 * - Client maintains conversation history; server is stateless per request
 * - Trims to last 16 messages to bound token usage
 *
 * Personality:
 * - Strict, matter-of-fact, data-driven
 * - Compassionate about the owner's position
 * - Affirms that joining Pivot was the right move
 * - Never sugarcoats; always gives next steps
 */
import { GoogleGenAI } from "@google/genai";
import { getAgentMemory } from "./memory";
import { analyzeWebsite } from "./website-analyzer";
import { findRoute, findRouteById } from "./page-routes";
import { getJob, listJobs } from "@/lib/job-store";
import { collectIntegrationContext, formatIntegrationContextAsText } from "@/lib/integrations/collect";
import { LoopGuard, closestToolName, smartTruncate } from "./agent-guardrails";
import type { ChatMessage, AgentMemory, MVPDeliverables } from "@/lib/types";

const FLASH_MODEL = "gemini-2.5-flash";
const MAX_HISTORY_MESSAGES = 16;
const AVAILABLE_TOOL_NAMES = ["search_web", "get_report_section", "analyze_website", "generate_projection", "navigate_to_page", "get_integration_data", "search_crm", "get_crm_contact", "get_pipeline_summary"];

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_web",
    description:
      "Search the web for current market data, competitor information, industry benchmarks, or business intelligence. Use when the user asks about markets, trends, competitors, or when you need current external data.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query — be specific about industry/geography/topic",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_report_section",
    description:
      "Retrieve detailed data from a specific section of the business intelligence report. Use when the user asks for specifics you don't have in your memory summary.",
    parameters: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description: "Which section of the report to retrieve. Use camelCase names from the AVAILABLE REPORT SECTIONS list in your system prompt.",
        },
        runId: {
          type: "string",
          description: "The run ID of the report (optional — uses most recent if not specified)",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "analyze_website",
    description:
      "Analyze a business website for marketing effectiveness, offer clarity, and conversion optimization. Returns a grade (A-F), specific issues, and actionable recommendations.",
    parameters: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The full URL of the website to analyze",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_projection",
    description:
      "Generate a what-if financial projection based on the business report data. Returns structured data points that render as an interactive chart. Use when the user asks about future scenarios, impact of fixing issues, or 'what would happen if...' questions.",
    parameters: {
      type: "object" as const,
      properties: {
        projectionType: {
          type: "string",
          enum: ["cash_forecast", "revenue_recovery", "customer_churn", "growth_scenario"],
          description: "Type of projection to generate",
        },
        timeframeMonths: {
          type: "number",
          description: "Number of months to project (1-24)",
        },
        scenario: {
          type: "string",
          description: "Description of the scenario to model (e.g. 'fix top 3 revenue leaks', 'lose highest-risk customer')",
        },
      },
      required: ["projectionType", "timeframeMonths", "scenario"],
    },
  },
  {
    name: "navigate_to_page",
    description:
      "Navigate the user to a specific page or section in the Pivot analysis. Use this when the user asks to see something, go somewhere, view a specific report section, or when showing them relevant data would help. Examples: 'show me revenue leaks', 'take me to issues', 'where is my health score', 'go to marketing'.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What the user wants to see or navigate to",
        },
        routeId: {
          type: "string",
          description: "The specific route ID to navigate to, if known (e.g. 'health-score', 'revenue-leaks', 'financial', 'customers', 'market', 'growth', 'marketing', 'operations', 'risk')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_integration_data",
    description:
      "Retrieve live data from connected business tools (Slack, Gmail, QuickBooks, Stripe, Salesforce, HubSpot, GitHub, Jira, etc.). Use when the user asks about their connected tools, real-time metrics from integrations, or when you need actual data from their business apps.",
    parameters: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          description: "Filter by provider (e.g. 'slack', 'quickbooks', 'stripe'). Leave empty for all providers.",
        },
        recordType: {
          type: "string",
          description: "Filter by record type. Known types — stripe: payments, customers, charges_overview, customers_overview; slack: channel_list, team_overview; gmail: emails, recent_activity, profile. Leave empty to get all records for a provider (RECOMMENDED when unsure).",
        },
      },
      required: [],
    },
  },
  {
    name: "search_crm",
    description:
      "Search CRM contacts by name, email, or company. Returns contact details, pipeline stage, deal value, and recent activities. Use when the user asks about clients, contacts, leads, deals, or pipeline.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term — name, email, or company. Partial matches supported.",
        },
        stage: {
          type: "string",
          description: "Optional stage filter: lead, prospect, qualified, proposal, negotiation, won, lost, churned, active",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_crm_contact",
    description:
      "Get full CRM contact profile with activity timeline, deal history, and AI summary. Use after search_crm to dive deep into a specific contact, or when user asks about a specific person/company.",
    parameters: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description: "Contact email address to look up.",
        },
        name: {
          type: "string",
          description: "Contact name (if email not available).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_pipeline_summary",
    description:
      "Get CRM pipeline overview — contacts grouped by stage with counts, total deal values, and win rate. Use when user asks about pipeline, deals, CRM status, or sales funnel.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string
): Promise<string> {
  if (toolName === "search_web") {
    const query = String(args.query ?? '');
    if (!query) return '[Web Search] No query provided.';

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return `[Web Search] Query: "${query}" — Live search not configured (OPENROUTER_API_KEY missing). Answering from training knowledge.`;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pivotcommandcenter.com',
          'X-Title': 'Pivot Command Center',
        },
        body: JSON.stringify({
          model: 'perplexity/sonar',
          messages: [
            { role: 'system', content: 'You are a research assistant. Provide concise, factual answers with sources.' },
            { role: 'user', content: query },
          ],
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return `[Web Search] Search unavailable (HTTP ${response.status}). Answering from training knowledge for: "${query}"`;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? 'No results found.';
      const citations: string[] = data.citations ?? [];
      const citationsText = citations.length > 0
        ? '\n\nSources:\n' + citations.slice(0, 5).map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')
        : '';

      return `[Web Search Results]\n${smartTruncate(content, 2000)}${citationsText}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `[Web Search] Failed: ${msg}. Answering from training knowledge for: "${query}"`;
    }
  }

  if (toolName === "get_report_section") {
    const section = args.section as string;
    const runId = args.runId as string | undefined;

    // Find the job
    let job;
    if (runId) {
      job = await getJob(runId);
    } else {
      // Get most recent completed job for this org
      const allJobs = await listJobs();
      job = allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed")
        ?? allJobs.find((j) => j.status === "completed");
    }

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report. Try: healthScore, cashIntelligence, revenueLeakAnalysis, issuesRegister, atRiskCustomers, costIntelligence, expenseManagement, kpiReport, unitEconomics.`;

    // Limit arrays to top 10 items before serialization (avoid loading 100+ items then truncating)
    let dataToSerialize = sectionData;
    if (Array.isArray(sectionData)) {
      dataToSerialize = sectionData.slice(0, 10);
    } else if (typeof sectionData === 'object' && sectionData !== null) {
      // For objects with array values, limit each array
      dataToSerialize = { ...sectionData };
      for (const [key, val] of Object.entries(dataToSerialize)) {
        if (Array.isArray(val) && val.length > 10) {
          (dataToSerialize as any)[key] = val.slice(0, 10);
        }
      }
    }

    // Compact JSON (no pretty-printing) saves 30-40% tokens
    const json = JSON.stringify(dataToSerialize);
    return `[Report Section: ${section}]\n${smartTruncate(json, 2000)}`;
  }

  if (toolName === "analyze_website") {
    const url = args.url as string;
    try {
      const analysis = await analyzeWebsite(url);
      return `[Website Analysis: ${url}]
Grade: ${analysis.grade} (${analysis.score}/100)
Synopsis: ${analysis.synopsis}
Actual Offer: ${analysis.actualOffer}
Offer Gap: ${analysis.offerGap}
Top Issues: ${analysis.topIssues.join("; ")}
Recommendations: ${analysis.recommendations.join("; ")}
Suggested Headline: "${analysis.suggestedHeadline}"
Marketing Direction: ${analysis.marketingDirection}
CTA Assessment: ${analysis.ctaAssessment}`;
    } catch (e) {
      return `Website analysis failed: ${String(e)}`;
    }
  }

  if (toolName === "generate_projection") {
    const projectionType = args.projectionType as string;
    const timeframeMonths = Math.min(Math.max(Number(args.timeframeMonths ?? 12), 1), 24);
    const scenario = args.scenario as string;

    // Load report data for context
    const allJobs = await listJobs();
    const job = allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed")
      ?? allJobs.find((j) => j.status === "completed");

    if (!job?.deliverables) return `No completed report found for projection.`;

    const d = job.deliverables as MVPDeliverables;
    const contextParts: string[] = [];

    if (projectionType === "cash_forecast" || projectionType === "growth_scenario") {
      contextParts.push(`Cash Intelligence: ${JSON.stringify({
        currentCash: (d.cashIntelligence as any).currentCashPosition ?? 0,
        runway: (d.cashIntelligence as any).runwayWeeks ?? 0,
        risks: d.cashIntelligence.risks?.slice(0, 3),
      })}`);
    }
    if (projectionType === "revenue_recovery" || projectionType === "growth_scenario") {
      contextParts.push(`Revenue Leaks: ${JSON.stringify({
        total: d.revenueLeakAnalysis.totalIdentified,
        items: d.revenueLeakAnalysis.items?.slice(0, 5).map(i => ({ desc: i.description, amount: i.amount })),
      })}`);
    }
    if (projectionType === "customer_churn") {
      contextParts.push(`At-Risk Customers: ${JSON.stringify({
        customers: d.atRiskCustomers.customers?.slice(0, 5).map(c => ({ name: c.name, revenue: c.revenueAtRisk, risk: c.risk })),
      })}`);
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return "Projection unavailable — API key not configured.";

      const genai = new GoogleGenAI({ apiKey });
      const projResp = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{ text: `Generate a ${timeframeMonths}-month financial projection.
Type: ${projectionType}
Scenario: ${scenario}

Business data:
${contextParts.join("\n")}

Return ONLY valid JSON with this structure:
{
  "title": "Chart title",
  "subtitle": "Brief scenario description",
  "dataPoints": [
    { "month": "Mon YYYY", "baseline": <number>, "projected": <number> }
  ],
  "parameters": {
    "growthRate": { "min": 0, "max": 50, "default": <number>, "step": 1, "label": "Growth Rate %", "unit": "%" },
    "churnRate": { "min": 0, "max": 30, "default": <number>, "step": 0.5, "label": "Churn Rate %", "unit": "%" }
  },
  "formula": "projected = baseline * (1 + growthRate/100 - churnRate/100)^month",
  "insight": "One sentence key insight",
  "totalImpact": "Dollar impact summary"
}

Rules:
- Generate one data point per month for ${timeframeMonths} months starting from the current month
- baseline = what happens if nothing changes
- projected = what happens under the scenario
- Use realistic numbers grounded in the business data provided
- All monetary values in raw numbers (not formatted strings)
- parameters: Include 2-4 adjustable variables relevant to this projection type. Set defaults to match the projected scenario. Include min/max/step/label/unit for each.
  - cash_forecast: growthRate, burnRate, newRevenue
  - revenue_recovery: recoveryRate, implementationMonths, churnReduction
  - customer_churn: churnRate, acquisitionRate, retentionSpend
  - growth_scenario: growthRate, marketingSpend, conversionRate
- formula: A human-readable formula showing how parameters affect the projection` }],
        }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        } as Record<string, unknown>,
      });

      let text = projResp.text ?? "";
      // Strip markdown code fences if present
      text = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[Pivvy] Projection: no JSON found in response (${text.length} chars): "${text.slice(0, 200)}"`);
        return `Projection generation failed — could not parse response.`;
      }

      const projection = JSON.parse(jsonMatch[0]);

      // Build enhanced projection with chartData and metrics for rich chart rendering
      const chartData = (projection.dataPoints ?? []).map((dp: any) => ({
        period: dp.month,
        baseline: dp.baseline,
        projected: dp.projected,
      }));

      const firstPoint = projection.dataPoints?.[0];
      const lastPoint = projection.dataPoints?.[projection.dataPoints.length - 1];
      const currentValue = firstPoint?.baseline ?? 0;
      const projectedValue = lastPoint?.projected ?? 0;
      const changePercent = currentValue > 0
        ? Math.round(((projectedValue - currentValue) / currentValue) * 100)
        : 0;

      const enhanced = {
        ...projection,
        chartData,
        metrics: {
          currentValue,
          projectedValue,
          changePercent,
          timeframe: `${timeframeMonths} months`,
        },
        // Interactive chart parameters (for slider controls)
        parameters: projection.parameters ?? {},
        formula: projection.formula ?? '',
      };

      return `[Projection Generated]\n${projection.insight}\n${projection.totalImpact}\n\n<!--PROJECTION:${JSON.stringify(enhanced)}-->`;
    } catch (e) {
      return `Projection generation failed: ${String(e)}`;
    }
  }

  if (toolName === "navigate_to_page") {
    const query = args.query as string;
    const routeId = args.routeId as string | undefined;

    const route = routeId ? findRouteById(routeId) : findRoute(query);
    if (!route) {
      return `No matching page found for "${query}". Available sections: Health Score, Cash Intelligence, Revenue Leaks, Issues, At-Risk Clients, Decision Brief, Action Plan, Financial Intelligence, Customers & Revenue, Market & Competition, Growth & Strategy, Marketing & Brand, Operations & Team, Risk & Compliance.`;
    }

    return `<!--NAVIGATE:${JSON.stringify(route)}-->\nNavigating to ${route.label}: ${route.description}`;
  }

  if (toolName === "get_integration_data") {
    const provider = args.provider as string | undefined;
    const recordType = args.recordType as string | undefined;

    try {
      // DB-level filtering: only load what's needed instead of all records
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      let query = supabase
        .from('integration_data')
        .select('provider, record_type, data, synced_at')
        .eq('org_id', orgId)
        .order('synced_at', { ascending: false });

      if (provider) query = query.eq('provider', provider);
      if (recordType) query = query.eq('record_type', recordType);
      // Limit to 10 records max per query (was loading 50+ before)
      query = query.limit(10);

      const { data: rows, error } = await query;
      if (error || !rows || rows.length === 0) {
        // Fall back to listing connected providers
        const { data: providerRows } = await supabase
          .from('integrations')
          .select('provider')
          .eq('org_id', orgId)
          .eq('status', 'connected');
        const connectedProviders = providerRows?.map(r => r.provider).join(', ') ?? 'none';
        if (!provider && !recordType) {
          return `No integration data available. Connected providers: ${connectedProviders}. Try: get_integration_data(provider: "stripe") or get_integration_data(provider: "gmail").`;
        }
        return `No data found for ${provider ?? 'any'} / ${recordType ?? 'any'}. Connected providers: ${connectedProviders}`;
      }

      // Compact output: truncate each record to 1000 chars (was 1500), no pretty-print
      const result = rows.map((r: any) => {
        const parsed = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
        return {
          provider: r.provider,
          type: r.record_type,
          data: parsed.slice(0, 1000),
        };
      });

      return `[Integration Data — ${rows.length} records]\n${JSON.stringify(result)}`;
    } catch (e) {
      return `Failed to retrieve integration data: ${String(e)}`;
    }
  }

  if (toolName === "search_crm") {
    const query = String(args.query ?? '');
    const stage = args.stage as string | undefined;
    if (!query) return '[CRM] No search query provided.';

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let q = supabase
        .from('crm_contacts')
        .select('name, email, company, title, stage, deal_value, score, last_activity, next_followup_at, ai_summary')
        .eq('org_id', orgId)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .order('score', { ascending: false })
        .limit(10);

      if (stage) q = q.eq('stage', stage);

      const { data, error } = await q;
      if (error) return `[CRM] Search failed: ${error.message}`;
      if (!data || data.length === 0) return `[CRM] No contacts found matching "${query}".`;

      const lines = [`[CRM Search: "${query}" — ${data.length} contacts]\n`];
      for (const c of data) {
        lines.push(`${c.name}${c.company ? ` (${c.company})` : ''} — ${c.email ?? 'no email'}`);
        lines.push(`  Stage: ${c.stage} | Score: ${c.score}/100${c.deal_value ? ` | Deal: $${Number(c.deal_value).toLocaleString()}` : ''}`);
        if (c.last_activity) lines.push(`  Last: ${c.last_activity}`);
        if (c.ai_summary) lines.push(`  Summary: ${c.ai_summary}`);
        if (c.next_followup_at) lines.push(`  Follow-up: ${new Date(c.next_followup_at).toLocaleDateString()}`);
        lines.push('');
      }
      return lines.join('\n');
    } catch (e) {
      return `[CRM] Error: ${String(e)}`;
    }
  }

  if (toolName === "get_crm_contact") {
    const email = args.email as string | undefined;
    const name = args.name as string | undefined;
    if (!email && !name) return '[CRM] Provide email or name to look up a contact.';

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let q = supabase.from('crm_contacts').select('*').eq('org_id', orgId);
      if (email) q = q.eq('email', email);
      else if (name) q = q.ilike('name', `%${name}%`);

      const { data: contacts } = await q.limit(1);
      if (!contacts || contacts.length === 0) return `[CRM] Contact not found.`;

      const c = contacts[0];

      // Get activities
      const { data: activities } = await supabase
        .from('crm_activities')
        .select('type, title, sentiment, created_at')
        .eq('contact_id', c.id)
        .order('created_at', { ascending: false })
        .limit(15);

      const lines = [
        `[CRM Contact: ${c.name}]`,
        c.company ? `Company: ${c.company}` : '',
        c.title ? `Title: ${c.title}` : '',
        `Email: ${c.email ?? 'N/A'} | Phone: ${c.phone ?? 'N/A'}`,
        `Stage: ${c.stage} | Score: ${c.score}/100`,
        c.deal_value ? `Deal Value: $${Number(c.deal_value).toLocaleString()}` : '',
        c.tags?.length > 0 ? `Tags: ${c.tags.join(', ')}` : '',
        c.website ? `Website: ${c.website}` : '',
        c.linkedin_url ? `LinkedIn: ${c.linkedin_url}` : '',
        c.ai_summary ? `AI Summary: ${c.ai_summary}` : '',
        c.notes ? `Notes: ${c.notes}` : '',
      ].filter(Boolean);

      if (activities && activities.length > 0) {
        lines.push('\nRecent Activity:');
        for (const a of activities) {
          const date = new Date(a.created_at).toLocaleDateString();
          lines.push(`- ${date}: ${a.title}${a.sentiment ? ` (${a.sentiment})` : ''}`);
        }
      }

      if (c.next_followup_at) {
        lines.push(`\nNext Follow-up: ${new Date(c.next_followup_at).toLocaleDateString()}`);
        if (c.followup_note) lines.push(`  Note: ${c.followup_note}`);
      }

      return lines.join('\n');
    } catch (e) {
      return `[CRM] Error: ${String(e)}`;
    }
  }

  if (toolName === "get_pipeline_summary") {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('stage, deal_value, name')
        .eq('org_id', orgId);

      if (!contacts || contacts.length === 0) return '[CRM] Pipeline is empty — no contacts yet.';

      const stages: Record<string, { count: number; value: number; names: string[] }> = {};
      for (const c of contacts) {
        const s = c.stage ?? 'lead';
        if (!stages[s]) stages[s] = { count: 0, value: 0, names: [] };
        stages[s].count++;
        stages[s].value += Number(c.deal_value ?? 0);
        if (stages[s].names.length < 3) stages[s].names.push(c.name);
      }

      const order = ['lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'churned', 'active'];
      const lines = ['[CRM Pipeline Summary]\n'];
      let totalValue = 0;

      for (const stage of order) {
        const s = stages[stage];
        if (!s) continue;
        totalValue += s.value;
        const valueStr = s.value > 0 ? ` | $${s.value.toLocaleString()}` : '';
        lines.push(`${stage.charAt(0).toUpperCase() + stage.slice(1)}: ${s.count} contacts${valueStr}`);
        lines.push(`  ${s.names.join(', ')}${s.count > 3 ? `, +${s.count - 3} more` : ''}`);
      }

      const wonCount = stages['won']?.count ?? 0;
      const lostCount = stages['lost']?.count ?? 0;
      const closedCount = wonCount + lostCount;
      const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

      lines.push(`\nTotal: ${contacts.length} contacts | Pipeline value: $${totalValue.toLocaleString()} | Win rate: ${winRate}%`);

      return lines.join('\n');
    } catch (e) {
      return `[CRM] Error: ${String(e)}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  // Preserve <!--PROJECTION:...--> and <!--NAVIGATE:...--> markers by temporarily replacing them
  const markers: string[] = [];
  let cleaned = text.replace(/<!--(PROJECTION|NAVIGATE):[\s\S]*?-->/g, (match) => {
    markers.push(match);
    return `__MARKER_${markers.length - 1}__`;
  });

  cleaned = cleaned
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")   // em dash
    .replace(/\u2013/g, " - ")   // en dash
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();

  // Restore markers
  markers.forEach((marker, i) => {
    cleaned = cleaned.replace(`__MARKER_${i}__`, marker);
  });

  return cleaned;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(memory: AgentMemory): string {
  return `Your name is Pivvy. You are the AI business advisor inside Pivot.

IDENTITY — ABSOLUTE:
- Your name is Pivvy. NEVER say "I am Coach" or "I am an AI assistant." You are Pivvy.
- You are this founder's thinking partner — strict, data-driven, compassionate but not soft.
- You KNOW their business. You have their data in memory. Use it.

CONVERSATION RULES:
- "hi"/"hey"/"hello" → "Hey! What are we working on?" (1-2 sentences max, no data dump)
- "what can you do" → "I know your business inside out — health score, cash, revenue, customers. I can pull reports, build projections, research competitors, and dispatch my team to create content, send emails, or build plans. What do you need?"  (3 sentences max)
- "do it" / "go ahead" / "yes" / "make it happen" → CALL YOUR TOOLS IMMEDIATELY. Do not explain what you would do. DO IT. Call get_report_section, generate_projection, or dispatch to your team.
- NEVER give a to-do list when the user says "do it." The whole point is YOU do the work.

LENGTH LIMIT — HARD CAP:
- Max 200 words for conversational responses
- Max 350 words for data-heavy responses
- Dense beats long. Every sentence must earn its place.
- If you catch yourself listing more than 5 bullet points, stop and summarize.

STYLE:
- Lead with the key number or insight. Not "Let me analyze..." — just give the answer.
- Use the KEY NUMBERS below. You have them. Don't call tools for data you already have in memory.
- Only call tools when you need DEEPER detail beyond your memory summary.
- When someone asks a question and you know the answer from memory, ANSWER IMMEDIATELY. No tool calls needed.
- Do NOT use em dashes, en dashes, double dashes, or asterisks for formatting.

YOUR TOOLS:
- search_web(query): Search for current market data, competitors, benchmarks
- get_report_section(section): Get full details from the intelligence report. USE THIS when asked about specifics.
- analyze_website(url): Grade and analyze any website for marketing effectiveness
- generate_projection(projectionType, timeframeMonths, scenario): Create interactive what-if projections that render as LIVE CHARTS with sliders, scenario bands, and drag-to-adjust. ALWAYS use this when the user asks about the future, projections, "what if", forecasts, growth, runway, cash flow, or "what do I look like in X months". Types: cash_forecast, revenue_recovery, customer_churn, growth_scenario. The chart is interactive — users can adjust parameters with sliders and drag data points.
- navigate_to_page(query, routeId?): Navigate the user to a specific page or section in the analysis. Use when they say "show me", "take me to", "go to", "where is", or ask to see specific data. Available pages: health-score, cash-intelligence, revenue-leaks, issues, at-risk-clients, decision-brief, action-plan, financial, customers, market, growth, marketing, operations, risk.
- get_integration_data(provider?, recordType?): Pull LIVE data from connected tools (Stripe, Gmail, Slack, etc.). Use this for real-time metrics.
- search_crm(query, stage?): Search CRM contacts by name, email, or company. Use when user asks about clients, contacts, leads, deals, or specific people.
- get_crm_contact(email?, name?): Get full CRM contact profile with activity timeline and deal history. Use after search_crm for deep dive.
- get_pipeline_summary(): Get CRM pipeline overview — stages, counts, deal values, win rate. Use when user asks about pipeline, deals, funnel, or CRM health.

CRM CONTEXT:
You can manage the CRM pipeline — search contacts, view deal history, and check pipeline health.
When the user asks about clients, contacts, deals, pipeline, leads, or prospects, SEARCH THE CRM FIRST with search_crm or get_pipeline_summary before answering.
For actions (moving deals, adding notes, creating contacts), dispatch to Forge (Operator) who has full CRM write access.

YOUR TEAM (Execution Agents you can dispatch work to):
You have a team of specialized agents. When the user needs ACTION, proactively offer to dispatch:
- Maven (Marketer): LinkedIn posts, social media content, email campaigns, marketing strategy
- Quant (Analyst): Financial models, budget analysis, forecasts, spreadsheet exports
- Atlas (Strategist): Business strategy, competitive analysis, growth plans, market research
- Scout (Recruiter): Job postings, hiring plans, candidate outreach, LinkedIn job listings
- Radar (Researcher): Market research, competitor deep-dives, industry analysis
- Forge (Operator): Project plans, Jira tickets, process optimization, operations
- Chip (CodeBot): GitHub issues, code review, technical planning

ACTION TRIGGERS — WHEN USER SAYS "DO IT":
- "do it" / "go ahead" / "yes" / "make it" / "let's go" / "proceed" → CALL TOOLS NOW
- If you just discussed cash → call get_report_section("cashOptimization") or generate_projection("cash_forecast", 6, "current trajectory")
- If you just discussed competitors → call get_report_section("competitorAnalysis")
- If you just discussed issues → call get_report_section("issuesRegister")
- NEVER respond to "do it" with a to-do list. Call the tool. Show the data. Do the work.
- If a section doesn't exist, try a related one: cashIntelligence, cashBurnAnalysis, expenseManagement, budgetPlanning. NEVER say "section not available."

NEVER ASK QUESTIONS YOU CAN ANSWER — ABSOLUTE RULE:
- You have the business report, integration data, and tools. USE THEM.
- NEVER ask "Do you have pending invoices?" — call get_integration_data or get_report_section to find out.
- NEVER ask "What are your monthly expenses?" — check the report data. If it's there, show it. If not, say "I don't have expense data in your report" and move on.
- NEVER give the user homework ("List your top 3 expenses", "Outline upsell opportunities"). YOU do the analysis.
- The only questions you should ask are about BUSINESS DIRECTION: "Which market do you want to enter?" "Do you want to prioritize growth or profitability?" These are strategic choices only the founder can make.
- Everything else — data, analysis, research, content — is YOUR job. Do it.

PROACTIVE — END EVERY RESPONSE WITH 1 ACTION:
- After answering, suggest ONE specific thing you or your team can do next
- Keep it short: "Want me to model a 6-month cash forecast?" or "Should Maven draft an upsell email?"
- Make it a question they can say "yes" to — then you execute immediately

PROJECTION TRIGGERS — CALL generate_projection FOR THESE:
- "What do I look like in X months/weeks/years?"
- "What's my forecast/projection/outlook?"
- "What happens if I fix/lose/change X?"
- "How long until I run out of money?"
- "What if my growth rate changes?"
- "Model/project/forecast X for me"
- Any future-looking financial question → generate_projection → show the interactive chart

AVAILABLE REPORT SECTIONS (for get_report_section):
Core: healthScore, cashIntelligence, revenueLeakAnalysis, issuesRegister, atRiskCustomers, decisionBrief, actionPlan
Market: marketIntelligence, competitorAnalysis, pricingIntelligence, websiteAnalysis, marketingStrategy, marketSizing, partnershipOpportunities
Analysis: pitchDeckAnalysis, techOptimization, terminology, kpiReport, roadmap, healthChecklist, leadReport, clvAnalysis, revenueAttribution
Strategy: swotAnalysis, unitEconomics, customerSegmentation, competitiveWinLoss, investorOnePager, competitiveMoat, scenarioPlanner, fundingReadiness
Operations: hiringPlan, revenueForecast, churnPlaybook, salesPlaybook, goalTracker, benchmarkScore, executiveSummary, milestoneTracker, riskRegister, operationalEfficiency
Growth: retentionPlaybook, boardDeck, gtmScorecard, cashOptimization
Extended: talentGapAnalysis, revenueDiversification, productMarketFit, brandHealth, financialRatios, costIntelligence, budgetPlanning, salesForecast, expenseManagement, cashBurnAnalysis
(100+ more sections available — use any camelCase topic name and the tool will find the closest match)

BUSINESS INTELLIGENCE MEMORY (${memory.orgName}):
${memory.summary}

KEY NUMBERS:
- Health Score: ${memory.keyNumbers.healthScore ?? "?"}/100 Grade ${memory.keyNumbers.healthGrade ?? "?"}
- Cash Runway: ${memory.keyNumbers.cashRunway ?? "?"} weeks
- Revenue at Risk: $${memory.keyNumbers.revenueAtRisk?.toLocaleString() ?? "?"}
- Total Revenue Leaks: $${memory.keyNumbers.totalLeaks?.toLocaleString() ?? "?"}
- Website Grade: ${memory.websiteGrade ?? "Not analyzed"}

RECENT ANALYSES:
${memory.reportSummaries
  .slice(0, 5)
  .map((r) => `- ${new Date(r.date).toLocaleDateString()}: ${r.headline} (Score: ${r.score ?? "?"}/${r.grade ?? "?"})`)
  .join("\n")}

ANSWER STRATEGY (follow this order):
1. Check your MEMORY above. If the answer is there, respond immediately. No tool call needed.
2. If you need more detail, call get_report_section with the relevant section.
3. If you need live metrics (payments, emails, etc.), call get_integration_data.
4. NEVER say "I don't have that data" without trying steps 1-3 first.
5. After answering, suggest 1-2 actions your team can take.`;
}

// ── Main agent function ────────────────────────────────────────────────────────

export interface AgentRequest {
  orgId: string;
  messages: ChatMessage[];     // full conversation history from client
  message: string;             // current user message
}

export interface AgentResponse {
  message: string;
  toolsUsed?: string[];
}

export async function runBusinessAgent(req: AgentRequest): Promise<AgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Pivvy is not available. GEMINI_API_KEY is not configured." };
  }

  const memory = await getAgentMemory(req.orgId);
  if (!memory) {
    return {
      message: `I don't have a memory built for this organization yet. Please complete a full analysis first, then I'll have everything I need to advise you effectively.`,
    };
  }

  const genai = new GoogleGenAI({ apiKey });

  // Trim history to last N messages for token efficiency
  const trimmedHistory = req.messages.slice(-MAX_HISTORY_MESSAGES);

  // Build Gemini contents array
  const contents = [
    ...trimmedHistory.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    {
      role: "user" as const,
      parts: [{ text: req.message }],
    },
  ];

  const toolsUsed: string[] = [];

  try {
    // First call — may request tool use
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(memory),
        temperature: 0.4,
        maxOutputTokens: 4000,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: { functionCallingMode: "AUTO" },
      } as Record<string, unknown>,
    });

    // Check if model requested tool calls
    const candidate = resp.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p: any) => p.functionCall);

    if (fnCalls.length > 0) {
      // Execute all requested tools with guardrails
      const guard = new LoopGuard();
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          let { name, args } = part.functionCall;

          // Fuzzy match tool name if not recognized
          if (!AVAILABLE_TOOL_NAMES.includes(name)) {
            const matched = closestToolName(name, AVAILABLE_TOOL_NAMES);
            if (matched) {
              console.warn(`[Pivvy] Tool name corrected: "${name}" -> "${matched}"`);
              name = matched;
            }
          }

          // Loop guard check
          const guardResult = guard.check(name, args);
          if (!guardResult.allowed) {
            console.warn(`[Pivvy] LoopGuard blocked: ${guardResult.warning}`);
            return { name, result: `Tool call blocked by safety guard: ${guardResult.warning}` };
          }
          if (guardResult.warning) {
            console.warn(`[Pivvy] LoopGuard warning: ${guardResult.warning}`);
          }

          toolsUsed.push(name);
          const result = await executeTool(name, args as Record<string, unknown>, req.orgId);
          return { name, result };
        })
      );

      // Extract <!--PROJECTION:...--> and <!--NAVIGATE:...--> markers from tool results
      // before sending to Gemini (Gemini won't reproduce them), then append to final response
      const embeddedMarkers: string[] = [];
      const cleanedToolResults = toolResults.map((tr) => {
        let cleanResult = tr.result;
        const markerRegex = /<!--(PROJECTION|NAVIGATE):[\s\S]*?-->/g;
        let match: RegExpExecArray | null;
        while ((match = markerRegex.exec(tr.result)) !== null) {
          embeddedMarkers.push(match[0]);
        }
        cleanResult = cleanResult.replace(markerRegex, "").trim();
        return { name: tr.name, result: cleanResult };
      });

      // Second call with tool results (markers stripped so Gemini gets clean text)
      const contentsWithTools = [
        ...contents,
        { role: "model" as const, parts },
        {
          role: "user" as const,
          parts: cleanedToolResults.map((tr) => ({
            functionResponse: { name: tr.name, response: { result: tr.result } },
          })),
        },
      ];

      // Retry up to 2 times if Gemini returns null/empty text
      let resp2Text: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const resp2 = await genai.models.generateContent({
          model: FLASH_MODEL,
          contents: contentsWithTools,
          config: {
            systemInstruction: buildSystemPrompt(memory),
            temperature: 0.4,
            maxOutputTokens: 4000,
          } as Record<string, unknown>,
        });
        resp2Text = resp2.text ?? null;
        if (resp2Text?.trim()) break;
        if (attempt < 2) console.warn(`[Pivvy] Empty response (attempt ${attempt + 1}/3), retrying...`);
      }

      // Append extracted markers to the response so the UI can parse them
      let finalMessage = sanitize(resp2Text || "I encountered an issue generating a response. Please try again.");
      if (embeddedMarkers.length > 0) {
        finalMessage = finalMessage + "\n\n" + embeddedMarkers.join("\n");
      }

      return {
        message: finalMessage,
        toolsUsed,
      };
    }

    // Retry if Gemini returned empty/null on the direct (no-tool) path
    if (!resp.text?.trim()) {
      for (let attempt = 0; attempt < 2; attempt++) {
        console.warn(`[Pivvy] Empty direct response (attempt ${attempt + 2}/3), retrying...`);
        const retry = await genai.models.generateContent({
          model: FLASH_MODEL,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(memory),
            temperature: 0.4,
            maxOutputTokens: 4000,
            tools: [{ functionDeclarations: TOOLS }],
            toolConfig: { functionCallingMode: "AUTO" },
          } as Record<string, unknown>,
        });
        if (retry.text?.trim()) {
          return { message: sanitize(retry.text), toolsUsed };
        }
      }
    }

    return {
      message: sanitize(resp.text ?? "I encountered an issue generating a response. Please try again."),
      toolsUsed,
    };
  } catch (e) {
    console.error("[Pivvy] Agent error:", e);
    return {
      message: "I ran into a technical issue. Please try again in a moment.",
      toolsUsed,
    };
  }
}
