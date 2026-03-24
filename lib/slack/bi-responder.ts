/**
 * BI Responder — pulls business intelligence data from the latest analysis
 * report and formats it as rich Slack Block Kit messages.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { section, fieldsSection, divider, context, header, type SlackBlock } from './block-kit';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatSectionName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function scoreEmoji(score: number): string {
  if (score >= 80) return ':large_green_circle:';
  if (score >= 60) return ':large_yellow_circle:';
  return ':red_circle:';
}

function gradeEmoji(grade: string): string {
  const g = grade?.toUpperCase() ?? '';
  if (g.startsWith('A')) return ':trophy:';
  if (g.startsWith('B')) return ':large_green_circle:';
  if (g.startsWith('C')) return ':large_yellow_circle:';
  return ':red_circle:';
}

// ── Section Formatters ───────────────────────────────────────────────────────

function formatHealthScore(data: Record<string, unknown>): SlackBlock[] {
  const score = Number(data.score ?? data.overall_score ?? 0);
  const grade = String(data.grade ?? data.overall_grade ?? 'N/A');
  const emoji = scoreEmoji(score);
  const interpretation = String(data.interpretation ?? data.summary ?? '');
  const dimensions = (data.dimensions ?? data.categories ?? []) as Array<Record<string, unknown>>;

  const blocks: SlackBlock[] = [
    header(`${emoji} Business Health Score`),
    fieldsSection([
      ['Score', `*${score}/100*`],
      ['Grade', `${gradeEmoji(grade)} *${grade}*`],
    ]),
  ];

  if (dimensions.length > 0) {
    const pairs: [string, string][] = dimensions.slice(0, 10).map(d => [
      String(d.name ?? d.category ?? 'Dimension'),
      `${scoreEmoji(Number(d.score ?? 0))} ${d.score ?? 0} (${d.grade ?? 'N/A'})${d.driver ? ` — ${d.driver}` : ''}`,
    ]);
    blocks.push(divider());
    blocks.push(fieldsSection(pairs));
  }

  if (interpretation) {
    blocks.push(divider());
    blocks.push(context([interpretation]));
  }

  return blocks;
}

function formatCashIntelligence(data: Record<string, unknown>): SlackBlock[] {
  const cashPosition = data.cash_position ?? data.cashPosition ?? data.current_cash;
  const runway = data.runway_weeks ?? data.runwayWeeks ?? data.runway;
  const summary = String(data.summary ?? data.analysis ?? '');
  const risks = (data.risks ?? data.top_risks ?? data.topRisks ?? []) as Array<unknown>;
  const recommendations = (data.recommendations ?? data.actions ?? []) as Array<unknown>;

  const blocks: SlackBlock[] = [
    header(':moneybag: Cash Intelligence'),
    fieldsSection([
      ['Cash Position', cashPosition != null ? fmt(Number(cashPosition)) : 'N/A'],
      ['Runway', runway != null ? `*${runway}* weeks` : 'N/A'],
    ]),
  ];

  if (summary) {
    blocks.push(divider());
    blocks.push(section(summary));
  }

  if (risks.length > 0) {
    blocks.push(divider());
    const riskLines = risks.slice(0, 5).map((r, i) => {
      const text = typeof r === 'string' ? r : String((r as Record<string, unknown>).description ?? (r as Record<string, unknown>).risk ?? r);
      return `${i + 1}. ${text}`;
    });
    blocks.push(section(`*Top Risks*\n${riskLines.join('\n')}`));
  }

  if (recommendations.length > 0) {
    blocks.push(divider());
    const recLines = recommendations.slice(0, 5).map(r => {
      const text = typeof r === 'string' ? r : String((r as Record<string, unknown>).action ?? (r as Record<string, unknown>).recommendation ?? r);
      return `• ${text}`;
    });
    blocks.push(section(`*Recommendations*\n${recLines.join('\n')}`));
  }

  return blocks;
}

function formatRevenueLeak(data: Record<string, unknown>): SlackBlock[] {
  const totalIdentified = data.total_identified ?? data.totalIdentified ?? data.total_leaks;
  const recoverable = data.recoverable ?? data.recoverable_amount;
  const ninetyDay = data.ninety_day_opportunity ?? data.ninetyDayOpportunity ?? data.opportunity_90_days;
  const summary = String(data.summary ?? data.analysis ?? '');
  const items = (data.items ?? data.leaks ?? data.leak_items ?? []) as Array<Record<string, unknown>>;

  const blocks: SlackBlock[] = [
    header(':mag: Revenue Leak Analysis'),
    fieldsSection([
      ['Total Identified', totalIdentified != null ? fmt(Number(totalIdentified)) : 'N/A'],
      ['Recoverable', recoverable != null ? fmt(Number(recoverable)) : 'N/A'],
      ['90-Day Opportunity', ninetyDay != null ? fmt(Number(ninetyDay)) : 'N/A'],
    ]),
  ];

  if (summary) {
    blocks.push(divider());
    blocks.push(section(summary));
  }

  if (items.length > 0) {
    blocks.push(divider());
    for (const item of items.slice(0, 5)) {
      const rank = item.rank ?? item.priority ?? '';
      const category = String(item.category ?? item.type ?? '');
      const amount = item.amount != null ? fmt(Number(item.amount)) : '';
      const description = String(item.description ?? item.issue ?? '');
      const rankStr = rank ? `*#${rank}*` : '';
      const amountStr = amount ? ` — ${amount}` : '';
      blocks.push(section(`${rankStr}${rankStr && category ? ' ' : ''}${category ? `*${category}*` : ''}${amountStr}\n${description}`));
    }
  }

  return blocks;
}

function formatRevenueForecast(data: Record<string, unknown>): SlackBlock[] {
  const mrr = data.mrr ?? data.monthly_recurring_revenue ?? data.current_mrr;
  const arr = data.arr ?? data.annual_recurring_revenue ?? data.current_arr;
  const growthRate = data.growth_rate ?? data.growthRate ?? data.projected_growth;
  const summary = String(data.summary ?? data.outlook ?? '');
  const scenarios = (data.scenarios ?? data.forecast_scenarios ?? []) as Array<Record<string, unknown>>;

  const blocks: SlackBlock[] = [
    header(':chart_with_upwards_trend: Revenue Forecast'),
  ];

  const fieldPairs: [string, string][] = [];
  if (mrr != null) fieldPairs.push(['MRR', fmt(Number(mrr))]);
  if (arr != null) fieldPairs.push(['ARR', fmt(Number(arr))]);
  if (growthRate != null) fieldPairs.push(['Growth Rate', `${Number(growthRate).toFixed(1)}%`]);
  if (fieldPairs.length > 0) blocks.push(fieldsSection(fieldPairs));

  if (summary) {
    blocks.push(divider());
    blocks.push(section(summary));
  }

  if (scenarios.length > 0) {
    blocks.push(divider());
    const scenarioPairs: [string, string][] = scenarios.slice(0, 5).map(s => {
      const name = String(s.name ?? s.scenario ?? 'Scenario');
      const rev = s.revenue != null ? fmt(Number(s.revenue)) : '';
      const profit = s.profit != null ? ` | Profit: ${fmt(Number(s.profit))}` : '';
      const breakEven = s.break_even ?? s.breakEven;
      const beStr = breakEven ? ` | Break-even: ${breakEven}` : '';
      return [name, `${rev}${profit}${beStr}`] as [string, string];
    });
    blocks.push(fieldsSection(scenarioPairs));
  }

  return blocks;
}

function formatExecutiveSummary(data: Record<string, unknown>): SlackBlock[] {
  const summaryText = String(data.summary ?? data.executive_summary ?? data.overview ?? '');
  const findings = (data.key_findings ?? data.keyFindings ?? data.findings ?? []) as Array<unknown>;
  const actions = (data.critical_actions ?? data.criticalActions ?? data.action_items ?? []) as Array<unknown>;

  const blocks: SlackBlock[] = [
    header(':clipboard: Executive Summary'),
  ];

  if (summaryText) {
    blocks.push(section(summaryText));
  }

  if (findings.length > 0) {
    blocks.push(divider());
    const findingLines = findings.slice(0, 6).map(f => {
      const text = typeof f === 'string' ? f : String((f as Record<string, unknown>).finding ?? (f as Record<string, unknown>).text ?? f);
      return `• ${text}`;
    });
    blocks.push(section(`*Key Findings*\n${findingLines.join('\n')}`));
  }

  if (actions.length > 0) {
    blocks.push(divider());
    const actionLines = actions.slice(0, 5).map(a => {
      const text = typeof a === 'string' ? a : String((a as Record<string, unknown>).action ?? (a as Record<string, unknown>).text ?? a);
      return `:rotating_light: ${text}`;
    });
    blocks.push(section(`*Critical Actions*\n${actionLines.join('\n')}`));
  }

  return blocks;
}

function formatKpiReport(data: Record<string, unknown>): SlackBlock[] {
  const summary = String(data.summary ?? data.overview ?? '');
  const kpis = (data.kpis ?? data.metrics ?? data.key_metrics ?? []) as Array<Record<string, unknown>>;

  const blocks: SlackBlock[] = [
    header(':bar_chart: KPI Report'),
  ];

  if (summary) {
    blocks.push(section(summary));
  }

  if (kpis.length > 0) {
    blocks.push(divider());
    // Render KPIs as fields, 2 per row, max 10 per fieldsSection
    for (let i = 0; i < Math.min(kpis.length, 20); i += 10) {
      const chunk = kpis.slice(i, i + 10);
      const pairs: [string, string][] = chunk.map(k => {
        const name = String(k.name ?? k.metric ?? k.label ?? 'KPI');
        const status = String(k.status ?? '').toLowerCase();
        const statusEmoji = status === 'on_track' || status === 'on track' || status === 'green'
          ? ':white_check_mark:'
          : status === 'at_risk' || status === 'at risk' || status === 'yellow' || status === 'warning'
            ? ':warning:'
            : ':question:';
        const value = k.value != null ? String(k.value) : 'N/A';
        return [name, `${statusEmoji} ${value}`] as [string, string];
      });
      blocks.push(fieldsSection(pairs));
    }
  }

  return blocks;
}

function formatAtRiskCustomers(data: Record<string, unknown>): SlackBlock[] {
  const revenueAtRisk = data.revenue_at_risk ?? data.revenueAtRisk ?? data.total_at_risk;
  const count = data.count ?? data.customer_count ?? data.at_risk_count;
  const summary = String(data.summary ?? data.analysis ?? '');
  const customers = (data.customers ?? data.at_risk_customers ?? data.accounts ?? []) as Array<Record<string, unknown>>;

  const blocks: SlackBlock[] = [
    header(':warning: At-Risk Customers'),
    fieldsSection([
      ['Revenue at Risk', revenueAtRisk != null ? fmt(Number(revenueAtRisk)) : 'N/A'],
      ['Customers at Risk', count != null ? String(count) : 'N/A'],
    ]),
  ];

  if (summary) {
    blocks.push(divider());
    blocks.push(section(summary));
  }

  if (customers.length > 0) {
    blocks.push(divider());
    for (const customer of customers.slice(0, 5)) {
      const name = String(customer.name ?? customer.company ?? customer.account ?? 'Customer');
      const riskScore = customer.risk_score ?? customer.riskScore ?? customer.churn_score;
      const intervention = String(customer.intervention ?? customer.recommended_action ?? customer.action ?? '');
      const riskStr = riskScore != null ? ` — Risk: *${riskScore}*` : '';
      const intStr = intervention ? `\n_${intervention}_` : '';
      blocks.push(section(`*${name}*${riskStr}${intStr}`));
    }
  }

  return blocks;
}

function formatGeneric(sectionKey: string, data: Record<string, unknown>): SlackBlock[] {
  const title = formatSectionName(sectionKey);
  const summary = String(data.summary ?? data.overview ?? data.description ?? data.analysis ?? '');
  const recommendations = (data.recommendations ?? data.actions ?? data.insights ?? []) as Array<unknown>;

  const blocks: SlackBlock[] = [
    header(title),
  ];

  if (summary) {
    blocks.push(section(summary));
  }

  // Auto-extract numeric metrics as fields
  const metricPairs: [string, string][] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'summary' || key === 'overview' || key === 'description' || key === 'analysis') continue;
    if (typeof val === 'number') {
      metricPairs.push([formatSectionName(key), val >= 1000 ? fmt(val) : String(val)]);
    } else if (typeof val === 'string' && val.length < 60) {
      // Include short string values as metrics
      metricPairs.push([formatSectionName(key), val]);
    }
    if (metricPairs.length >= 10) break;
  }

  if (metricPairs.length > 0) {
    blocks.push(divider());
    blocks.push(fieldsSection(metricPairs));
  }

  if (recommendations.length > 0) {
    blocks.push(divider());
    const recLines = (recommendations as Array<unknown>).slice(0, 5).map(r => {
      const text = typeof r === 'string' ? r : String((r as Record<string, unknown>).action ?? (r as Record<string, unknown>).recommendation ?? (r as Record<string, unknown>).text ?? r);
      return `• ${text}`;
    });
    blocks.push(section(`*Recommendations*\n${recLines.join('\n')}`));
  }

  return blocks;
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Answer a BI query by pulling the latest completed analysis job for the org,
 * extracting the requested section, and formatting as Slack Block Kit blocks.
 */
export async function answerBiQuery(
  orgId: string,
  section: string,
  question: string,
): Promise<SlackBlock[]> {
  const supabase = createAdminClient();

  // 1. Fetch latest completed job for this org
  const { data: job, error } = await supabase
    .from('jobs')
    .select('results_json')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    return [
      header(':x: No Analysis Available'),
      { type: 'section', text: { type: 'mrkdwn', text: 'No completed analysis report was found for your organization. Run an analysis first, then try again.' } },
    ];
  }

  const results = (job.results_json ?? {}) as Record<string, unknown>;

  // 2. Locate the requested section (case-insensitive, camelCase and snake_case variants)
  const normalize = (s: string) => s.toLowerCase().replace(/[_\s]/g, '');
  const sectionKey = Object.keys(results).find(k => normalize(k) === normalize(section)) ?? section;
  const sectionData = results[sectionKey] as Record<string, unknown> | undefined;

  if (!sectionData || typeof sectionData !== 'object') {
    // Section not found — list available sections
    const available = Object.keys(results).join(', ');
    return [
      header(`:x: Section Not Found: ${formatSectionName(section)}`),
      { type: 'section', text: { type: 'mrkdwn', text: `The section *${section}* was not found in the latest report.\n\n*Available sections:* ${available || 'none'}` } },
    ];
  }

  // 3. Route to the appropriate formatter
  const key = normalize(sectionKey);

  if (key === 'healthscore' || key === 'businesshealth' || key === 'health') {
    return formatHealthScore(sectionData);
  }
  if (key === 'cashintelligence' || key === 'cash' || key === 'cashflow') {
    return formatCashIntelligence(sectionData);
  }
  if (key === 'revenueleakanalysis' || key === 'revenueleak' || key === 'revenueleaks') {
    return formatRevenueLeak(sectionData);
  }
  if (key === 'revenueforecast' || key === 'forecast' || key === 'revenueprojection') {
    return formatRevenueForecast(sectionData);
  }
  if (key === 'executivesummary' || key === 'executive' || key === 'summary') {
    return formatExecutiveSummary(sectionData);
  }
  if (key === 'kpireport' || key === 'kpis' || key === 'metrics') {
    return formatKpiReport(sectionData);
  }
  if (key === 'atriskustomers' || key === 'atrisk' || key === 'customerrisk' || key === 'churn') {
    return formatAtRiskCustomers(sectionData);
  }

  // Fallback: generic formatter
  return formatGeneric(sectionKey, sectionData);
}
