/**
 * Data & Analysis Tools — Query analysis, charts, reports, trends, benchmarks
 *
 * These tools work directly with MVPDeliverables to provide data-driven insights.
 * Uses Gemini Flash for intelligent synthesis and report generation.
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
    config: { temperature: 0.3, maxOutputTokens: 4000 },
  });
  return response.text ?? '';
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const queryAnalysis: Tool = {
  name: 'query_analysis',
  description: 'Query the existing Pivot business analysis data (MVPDeliverables). Retrieves specific sections or searches across all data. Use "list_sections" as the section to see all available sections. Use this to ground responses in actual analysis data.',
  parameters: {
    section: {
      type: 'string',
      description: 'Which analysis section to query (e.g., "roadmap", "kpiReport", "actionPlan"). Use "list_sections" to see all available sections. Use "search" to search across all sections for relevant data.',
    },
    query: {
      type: 'string',
      description: 'Specific question about this section (e.g., "what is the biggest revenue leak?" or "list at-risk customers"). Required when section is "search".',
    },
  },
  required: ['section'],
  category: 'data',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const section = String(args.section ?? '');
    const query = args.query ? String(args.query) : '';

    if (!context.deliverables) {
      return { success: false, output: 'No analysis data available. Run a Pivot analysis first.' };
    }

    const deliverables = context.deliverables as Record<string, unknown>;
    const availableSections = Object.keys(deliverables).filter(k => deliverables[k] != null);

    // List all available sections
    if (section === 'list_sections') {
      return {
        success: true,
        output: `Available analysis sections (${availableSections.length}):\n${availableSections.map(s => `  - ${s}`).join('\n')}\n\nUse any of these section names with the query_analysis tool to retrieve data.`,
        cost: 0,
      };
    }

    // Search across all sections
    if (section === 'search') {
      if (!query) {
        return { success: false, output: 'A query is required when using section "search". Example: query_analysis(section: "search", query: "competitor information")' };
      }

      // Gather summaries from all sections for Gemini to search through
      const sectionSummaries: string[] = [];
      for (const key of availableSections) {
        const data = deliverables[key];
        const serialized = JSON.stringify(data);
        sectionSummaries.push(`[${key}]: ${serialized.slice(0, 500)}`);
      }

      const answer = await generateWithGemini(
        `You have access to a business analysis with these sections:\n\n${sectionSummaries.join('\n\n')}\n\nAnswer this question using the most relevant data: ${query}\n\nBe specific and cite which sections the data comes from.`
      );

      return {
        success: true,
        output: answer,
        cost: 0.001,
      };
    }

    // Try exact match first, then case-insensitive match
    let sectionData = deliverables[section];

    if (!sectionData) {
      // Try case-insensitive match
      const lowerSection = section.toLowerCase();
      const matchedKey = availableSections.find(k => k.toLowerCase() === lowerSection);
      if (matchedKey) {
        sectionData = deliverables[matchedKey];
      }
    }

    if (!sectionData) {
      // Suggest closest matches
      const lowerSection = section.toLowerCase();
      const suggestions = availableSections
        .filter(k => k.toLowerCase().includes(lowerSection) || lowerSection.includes(k.toLowerCase()))
        .slice(0, 5);

      const suggestionText = suggestions.length > 0
        ? `\n\nDid you mean: ${suggestions.join(', ')}?`
        : '';

      return {
        success: false,
        output: `Section "${section}" not found in analysis data. Available sections (${availableSections.length}): ${availableSections.join(', ')}${suggestionText}\n\nTip: Use section "search" with a query to find data across all sections, or "list_sections" to see everything available.`,
      };
    }

    const serialized = JSON.stringify(sectionData, null, 2);

    if (query) {
      // Use Gemini to answer the specific question against this data
      const answer = await generateWithGemini(
        `Given this business analysis data:\n\n${serialized.slice(0, 6000)}\n\nAnswer this question concisely: ${query}`
      );
      return {
        success: true,
        output: `[${section}] ${answer}`,
        cost: 0.001,
      };
    }

    // Return raw section data (truncated if very large)
    const truncated = serialized.length > 4000
      ? serialized.slice(0, 4000) + '\n\n[... truncated — ask a specific question for targeted data]'
      : serialized;

    return {
      success: true,
      output: `[${section}] Analysis Data:\n\n${truncated}`,
      cost: 0,
    };
  },
};

const createChartData: Tool = {
  name: 'create_chart_data',
  description: 'Generate structured data suitable for charts and visualizations. Outputs JSON in a format ready for Recharts or any charting library. Can pull from analysis data or generate projections.',
  parameters: {
    chart_type: {
      type: 'string',
      description: 'Type of chart to generate data for.',
      enum: ['line', 'bar', 'pie', 'area', 'scatter', 'radar', 'funnel'],
    },
    data_source: {
      type: 'string',
      description: 'Where to get the data.',
      enum: ['analysis', 'custom', 'projection'],
    },
    metric: {
      type: 'string',
      description: 'What metric to chart (e.g., "revenue_by_month", "expenses_by_category", "risk_by_severity").',
    },
    custom_data: {
      type: 'string',
      description: 'For custom data source: "label|value" pairs separated by newlines.',
    },
    title: {
      type: 'string',
      description: 'Chart title.',
    },
  },
  required: ['chart_type', 'metric'],
  category: 'data',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const chartType = String(args.chart_type ?? 'bar');
    const dataSource = String(args.data_source ?? 'analysis');
    const metric = String(args.metric ?? '');
    const customData = args.custom_data ? String(args.custom_data) : '';
    const title = String(args.title ?? metric);

    let chartData: Record<string, unknown>[] = [];

    if (dataSource === 'custom' && customData) {
      // Parse custom data
      const lines = customData.split('\n').filter(Boolean);
      chartData = lines.map(line => {
        const parts = line.split('|').map(p => p.trim());
        return { name: parts[0] ?? '', value: Number(parts[1] ?? 0) };
      });
    } else if (dataSource === 'analysis' && context.deliverables) {
      // Try to extract relevant data from deliverables
      const d = context.deliverables as Record<string, unknown>;

      // Generate chart data using Gemini to interpret the metric request
      const relevantData = JSON.stringify(d).slice(0, 6000);
      const prompt = `Given this business analysis data, generate chart data for: "${metric}"

Data: ${relevantData}

Output ONLY a JSON array of objects suitable for a ${chartType} chart.
For line/bar/area: [{name: "label", value: number}, ...]
For pie: [{name: "category", value: number}, ...]
For radar: [{subject: "dimension", value: number, fullMark: 100}, ...]

If the exact data is not available, create reasonable estimates based on the context.
Output ONLY the JSON array, no explanation.`;

      try {
        const result = await generateWithGemini(prompt);
        // Extract JSON from response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          chartData = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Fallback to placeholder data
        chartData = [
          { name: 'Q1', value: 100 },
          { name: 'Q2', value: 120 },
          { name: 'Q3', value: 140 },
          { name: 'Q4', value: 160 },
        ];
      }
    } else if (dataSource === 'projection') {
      // Generate projection data
      const prompt = `Generate realistic projected data for: "${metric}"
${context.deliverables ? `Business context: ${JSON.stringify(context.deliverables).slice(0, 3000)}` : ''}

Output ONLY a JSON array for a ${chartType} chart with 12 monthly data points.
Format: [{name: "Month Name", value: number, projected: true}, ...]
Make the projections realistic based on any business context available.`;

      try {
        const result = await generateWithGemini(prompt);
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          chartData = JSON.parse(jsonMatch[0]);
        }
      } catch {
        chartData = Array.from({ length: 12 }, (_, i) => ({
          name: new Date(2026, i).toLocaleString('default', { month: 'short' }),
          value: Math.round(10000 + i * 1000 + Math.random() * 500),
        }));
      }
    }

    const chartJson = JSON.stringify({
      title,
      type: chartType,
      data: chartData,
    }, null, 2);

    return {
      success: true,
      output: `Chart data generated for "${title}" (${chartType} chart, ${chartData.length} data points).`,
      artifacts: [{ type: 'json', name: `chart-${metric.replace(/[^a-z0-9]/gi, '-')}.json`, content: chartJson }],
      cost: dataSource === 'custom' ? 0 : 0.001,
    };
  },
};

const createReport: Tool = {
  name: 'create_report',
  description: 'Generate a comprehensive business report on a specific topic. Pulls data from analysis and synthesizes into an executive-ready document with sections, data tables, charts, and recommendations.',
  parameters: {
    report_type: {
      type: 'string',
      description: 'Type of report.',
      enum: ['executive_summary', 'financial_review', 'marketing_performance', 'competitive_landscape', 'operational_review', 'growth_assessment', 'custom'],
    },
    title: {
      type: 'string',
      description: 'Report title.',
    },
    audience: {
      type: 'string',
      description: 'Who will read this report.',
      enum: ['executive', 'board', 'team', 'investors', 'general'],
    },
    sections: {
      type: 'string',
      description: 'For custom reports: comma-separated section names to include.',
    },
    time_period: {
      type: 'string',
      description: 'Period covered by the report.',
    },
  },
  required: ['report_type'],
  category: 'data',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const reportType = String(args.report_type ?? 'executive_summary');
    const title = String(args.title ?? `${reportType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Report`);
    const audience = String(args.audience ?? 'executive');
    const customSections = args.sections ? String(args.sections) : '';
    const timePeriod = String(args.time_period ?? 'Current Period');

    const deliverablesSummary = context.deliverables
      ? JSON.stringify(context.deliverables).slice(0, 8000)
      : 'No analysis data available.';

    const prompt = `You are a senior business analyst creating a ${audience}-level report.

BUSINESS DATA:
${deliverablesSummary}

REPORT PARAMETERS:
- Type: ${reportType.replace(/_/g, ' ')}
- Title: ${title}
- Audience: ${audience}
- Period: ${timePeriod}
${customSections ? `- Custom Sections: ${customSections}` : ''}

Create a comprehensive, data-driven report. For ${audience} audience, adjust:
- executive: concise, decision-focused, lead with key numbers
- board: strategic, high-level, quarterly trends
- team: detailed, actionable, includes task-level items
- investors: growth-focused, metrics-heavy, opportunity-oriented
- general: balanced, accessible language

Include:
1. **Executive Summary** (3-5 bullet points with key takeaways)
2. **Key Metrics Dashboard** (table format)
3. **Detailed Sections** (3-5 sections based on report type)
4. **Data Tables** where relevant
5. **Trend Analysis** (what is improving/declining)
6. **Risks and Concerns** (top 3)
7. **Recommendations** (prioritized action items)
8. **Appendix** (methodology notes, data sources)

Use concrete numbers from the analysis data. If exact data is not available, note it as "estimated" and provide reasonable ranges.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `report-${reportType.replace(/_/g, '-')}-${timePeriod.toLowerCase().replace(/\s+/g, '-')}.md`,
        content: `# ${title}\n\nPeriod: ${timePeriod} | Audience: ${audience}\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n---\n\n${content}`,
      }],
      cost: 0.01,
    };
  },
};

const trendAnalysis: Tool = {
  name: 'trend_analysis',
  description: 'Analyze trends from business data. Identifies patterns, inflection points, seasonal effects, and projects forward trends. Works with both analysis data and custom data.',
  parameters: {
    metric: {
      type: 'string',
      description: 'Metric to analyze trends for (e.g., "revenue", "customer_count", "churn_rate").',
    },
    data_points: {
      type: 'string',
      description: 'Historical data points in "period|value" format, one per line. E.g., "Jan|10000\\nFeb|12000\\nMar|11500"',
    },
    analysis_depth: {
      type: 'string',
      description: 'How deep to analyze.',
      enum: ['quick', 'standard', 'deep'],
    },
    compare_to: {
      type: 'string',
      description: 'What to compare the trend against (e.g., "industry_average", "last_year", "competitor").',
    },
  },
  required: ['metric'],
  category: 'data',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const metric = String(args.metric ?? '');
    const dataPoints = args.data_points ? String(args.data_points) : '';
    const depth = String(args.analysis_depth ?? 'standard');
    const compareTo = args.compare_to ? String(args.compare_to) : '';

    const deliverablesSummary = context.deliverables
      ? JSON.stringify(context.deliverables).slice(0, 5000)
      : '';

    const prompt = `You are a data analyst specializing in business trend analysis.

BUSINESS DATA:
${deliverablesSummary || 'No analysis data available.'}

TREND ANALYSIS PARAMETERS:
- Metric: ${metric}
${dataPoints ? `- Historical Data:\n${dataPoints}` : '- Use data from business analysis'}
- Analysis Depth: ${depth}
${compareTo ? `- Compare To: ${compareTo}` : ''}

Provide a ${depth} trend analysis:

1. **Trend Summary**
   - Overall direction (growing/declining/flat)
   - Rate of change (acceleration/deceleration)
   - Current trajectory

2. **Pattern Identification**
   - Seasonal patterns
   - Cyclical patterns
   - Anomalies and outliers
   - Inflection points

3. **Statistical Analysis** (for ${depth === 'deep' ? 'deep' : 'standard'} depth):
   - Growth rate (MoM, QoQ, YoY)
   - Moving averages
   - Volatility assessment
   ${depth === 'deep' ? '- Correlation with other metrics\n   - Regression analysis\n   - Confidence intervals' : ''}

4. **Forward Projection**
   - 3-month forecast
   - 6-month forecast (if deep)
   - Key assumptions

5. **Actionable Insights**
   - What is driving this trend
   - What could change it
   - Recommended actions

${compareTo ? `6. **Comparison to ${compareTo}**\n   - How does this compare?\n   - Gap analysis\n   - What to learn from the comparison` : ''}`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `trend-analysis-${metric.replace(/[^a-z0-9]/gi, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

const benchmarkComparison: Tool = {
  name: 'benchmark_comparison',
  description: 'Compare business metrics against industry benchmarks and best-in-class standards. Identifies gaps and provides specific improvement targets.',
  parameters: {
    metrics: {
      type: 'string',
      description: 'Metrics to benchmark, comma-separated (e.g., "gross_margin,cac,ltv,churn_rate"). Leave empty to auto-select key metrics.',
    },
    industry: {
      type: 'string',
      description: 'Industry for benchmarking (e.g., "SaaS", "e-commerce", "professional services").',
    },
    company_stage: {
      type: 'string',
      description: 'Company stage for appropriate benchmarks.',
      enum: ['pre_revenue', 'early_stage', 'growth', 'scale', 'mature'],
    },
    custom_values: {
      type: 'string',
      description: 'Custom metric values in "metric|value" format per line.',
    },
  },
  required: ['industry'],
  category: 'data',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const metrics = args.metrics ? String(args.metrics).split(',').map(m => m.trim()) : [];
    const industry = String(args.industry ?? '');
    const stage = String(args.company_stage ?? 'growth');
    const customValues = args.custom_values ? String(args.custom_values) : '';

    const deliverablesSummary = context.deliverables
      ? JSON.stringify(context.deliverables).slice(0, 6000)
      : '';

    const prompt = `You are a benchmarking analyst with deep knowledge of ${industry} industry standards.

BUSINESS DATA:
${deliverablesSummary || 'No analysis data available.'}
${customValues ? `\nCustom Values:\n${customValues}` : ''}

BENCHMARK PARAMETERS:
- Industry: ${industry}
- Company Stage: ${stage}
${metrics.length > 0 ? `- Metrics to Benchmark: ${metrics.join(', ')}` : '- Metrics: Auto-select top 10 most relevant'}

Create a comprehensive benchmark comparison:

1. **Benchmark Summary Table**:
   Metric | Your Value | Industry Median | Top Quartile | Gap | Status (Above/At/Below)

2. **Performance Scorecard**:
   - Overall performance vs industry: score out of 100
   - Grade: A-F
   - Areas of strength
   - Areas needing improvement

3. **Detailed Analysis** (for each key metric):
   - Your current performance
   - Industry median
   - Top-quartile performance
   - Gap to median and top-quartile
   - Why this matters
   - How to close the gap

4. **Peer Comparison** (where possible):
   - How similar-stage companies in ${industry} perform
   - What the best companies do differently

5. **Improvement Roadmap**:
   - Priority metrics to improve (ranked by impact)
   - Specific targets for next quarter
   - Actions to reach each target

6. **Data Sources Note**:
   - Where benchmark data comes from
   - Caveats and limitations

Note: Benchmarks are AI-generated estimates based on publicly available industry data. For definitive benchmarks, consult industry reports from Bain, McKinsey, or industry-specific databases.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      artifacts: [{
        type: 'document',
        name: `benchmark-${industry.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
        content,
      }],
      cost: 0.01,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const dataTools: Tool[] = [
  queryAnalysis,
  createChartData,
  createReport,
  trendAnalysis,
  benchmarkComparison,
];
registerTools(dataTools);
