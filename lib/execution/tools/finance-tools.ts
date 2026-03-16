/**
 * Finance Tools — Invoicing, budgeting, projections, expense analysis, pricing
 *
 * Uses Gemini Flash for intelligent financial analysis and content generation.
 * Pulls from MVPDeliverables for context (cashIntelligence, unitEconomics, etc.).
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

function getFinanceContext(context: ToolContext): string {
  if (!context.deliverables) {
    return `No pre-existing financial analysis data is available.
IMPORTANT: You MUST still produce specific, actionable financial deliverables. Use the parameters provided (budget amounts, revenue figures, expense data, time periods, team size) as your primary inputs. Make reasonable industry-standard assumptions where needed, and LABEL every assumption explicitly. Do NOT return vague or generic financial content. Every number should be justified.`;
  }
  const d = context.deliverables;
  const parts: string[] = [];

  if (d.cashIntelligence) parts.push(`Cash Intelligence: ${JSON.stringify(d.cashIntelligence).slice(0, 2000)}`);
  if (d.unitEconomics) parts.push(`Unit Economics: ${JSON.stringify(d.unitEconomics).slice(0, 1500)}`);
  if (d.revenueForecast) parts.push(`Revenue Forecast: ${JSON.stringify(d.revenueForecast).slice(0, 1000)}`);
  if (d.revenueLeakAnalysis) parts.push(`Revenue Leaks: ${JSON.stringify(d.revenueLeakAnalysis).slice(0, 800)}`);
  if (d.healthScore) parts.push(`Health Score: ${JSON.stringify(d.healthScore).slice(0, 500)}`);
  if (d.pricingIntelligence) parts.push(`Pricing: ${JSON.stringify(d.pricingIntelligence).slice(0, 800)}`);
  if (d.financialRatios) parts.push(`Financial Ratios: ${JSON.stringify(d.financialRatios).slice(0, 800)}`);

  return parts.length > 0 ? parts.join('\n\n') : 'Limited financial data available. Focus on the task parameters to produce specific deliverables.';
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const createInvoice: Tool = {
  name: 'create_invoice',
  description: 'Generate a professional invoice with line items, taxes, payment terms, and totals. Outputs structured invoice data and a formatted text version.',
  parameters: {
    client_name: {
      type: 'string',
      description: 'Client/customer name for the invoice.',
    },
    items: {
      type: 'string',
      description: 'Line items in format: "description|qty|unit_price" separated by newlines. E.g., "Web Design|1|5000\\nSEO Setup|1|2000"',
    },
    invoice_number: {
      type: 'string',
      description: 'Invoice number (e.g., "INV-001").',
    },
    payment_terms: {
      type: 'string',
      description: 'Payment terms.',
      enum: ['due_on_receipt', 'net_15', 'net_30', 'net_60'],
    },
    tax_rate: {
      type: 'number',
      description: 'Tax rate as percentage (e.g., 8.5 for 8.5%). Default 0.',
    },
    notes: {
      type: 'string',
      description: 'Additional notes for the invoice.',
    },
  },
  required: ['client_name', 'items'],
  category: 'finance',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const clientName = String(args.client_name ?? '');
    const itemsStr = String(args.items ?? '');
    const invoiceNumber = String(args.invoice_number ?? `INV-${Date.now().toString(36).toUpperCase()}`);
    const paymentTerms = String(args.payment_terms ?? 'net_30');
    const taxRate = Number(args.tax_rate ?? 0);
    const notes = args.notes ? String(args.notes) : '';

    if (!clientName || !itemsStr) {
      return { success: false, output: 'client_name and items are required.' };
    }

    // Parse items
    const lines = itemsStr.split('\n').filter(Boolean);
    const items: { description: string; qty: number; unitPrice: number; total: number }[] = [];
    let subtotal = 0;

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      const description = parts[0] ?? 'Item';
      const qty = Number(parts[1] ?? 1);
      const unitPrice = Number(parts[2] ?? 0);
      const total = qty * unitPrice;
      items.push({ description, qty, unitPrice, total });
      subtotal += total;
    }

    const taxAmount = subtotal * (taxRate / 100);
    const grandTotal = subtotal + taxAmount;

    const termsLabel: Record<string, string> = {
      due_on_receipt: 'Due on Receipt',
      net_15: 'Net 15 Days',
      net_30: 'Net 30 Days',
      net_60: 'Net 60 Days',
    };

    const today = new Date().toISOString().split('T')[0];

    // Build formatted invoice
    let invoice = `INVOICE\n${'='.repeat(60)}\n\n`;
    invoice += `Invoice #: ${invoiceNumber}\n`;
    invoice += `Date: ${today}\n`;
    invoice += `Payment Terms: ${termsLabel[paymentTerms] ?? paymentTerms}\n\n`;
    invoice += `Bill To:\n${clientName}\n\n`;
    invoice += `${'─'.repeat(60)}\n`;
    invoice += `${'Description'.padEnd(30)} ${'Qty'.padStart(5)} ${'Price'.padStart(10)} ${'Total'.padStart(12)}\n`;
    invoice += `${'─'.repeat(60)}\n`;

    for (const item of items) {
      invoice += `${item.description.padEnd(30)} ${String(item.qty).padStart(5)} $${item.unitPrice.toFixed(2).padStart(9)} $${item.total.toFixed(2).padStart(11)}\n`;
    }

    invoice += `${'─'.repeat(60)}\n`;
    invoice += `${'Subtotal:'.padStart(48)} $${subtotal.toFixed(2).padStart(11)}\n`;
    if (taxRate > 0) {
      invoice += `${`Tax (${taxRate}%):`.padStart(48)} $${taxAmount.toFixed(2).padStart(11)}\n`;
    }
    invoice += `${'TOTAL:'.padStart(48)} $${grandTotal.toFixed(2).padStart(11)}\n`;

    if (notes) {
      invoice += `\nNotes:\n${notes}\n`;
    }

    // JSON version for programmatic use
    const invoiceJson = JSON.stringify({
      invoiceNumber,
      date: today,
      clientName,
      items,
      subtotal,
      taxRate,
      taxAmount,
      grandTotal,
      paymentTerms,
      notes,
    }, null, 2);

    return {
      success: true,
      output: `Invoice ${invoiceNumber} created for ${clientName}. Total: $${grandTotal.toFixed(2)}.`,
      artifacts: [
        { type: 'document', name: `${invoiceNumber}.txt`, content: invoice },
        { type: 'json', name: `${invoiceNumber}.json`, content: invoiceJson },
      ],
      cost: 0,
    };
  },
};

const createBudget: Tool = {
  name: 'create_budget',
  description: 'Create a detailed budget plan with categories, line items, monthly allocations, and variance analysis. Uses business analysis data to inform recommendations.',
  parameters: {
    period: {
      type: 'string',
      description: 'Budget period (e.g., "Q1 2026", "FY2026", "Monthly").',
    },
    total_budget: {
      type: 'number',
      description: 'Total available budget in dollars.',
    },
    categories: {
      type: 'string',
      description: 'Budget categories to include, comma-separated (e.g., "marketing,engineering,operations,sales"). Leave empty for auto-generated categories.',
    },
    priorities: {
      type: 'string',
      description: 'Strategic priorities that should influence allocation (e.g., "growth,retention,cost reduction").',
    },
  },
  required: ['period', 'total_budget'],
  category: 'finance',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const period = String(args.period ?? 'Monthly');
    const totalBudget = Number(args.total_budget ?? 0);
    const categories = args.categories ? String(args.categories).split(',').map(c => c.trim()) : [];
    const priorities = args.priorities ? String(args.priorities) : '';
    const finContext = getFinanceContext(context);

    const prompt = `You are a financial planning expert. Create a detailed budget plan.

BUSINESS FINANCIAL DATA:
${finContext}

BUDGET PARAMETERS:
- Period: ${period}
- Total Budget: $${totalBudget.toLocaleString()}
${categories.length > 0 ? `- Categories: ${categories.join(', ')}` : '- Categories: Auto-generate appropriate ones'}
${priorities ? `- Strategic Priorities: ${priorities}` : ''}

Create a comprehensive budget with:

1. **Budget Summary**
   - Total budget and period
   - Strategic allocation rationale

2. **Category Breakdown** (for each category):
   - Allocated amount and % of total
   - Line items with individual amounts
   - Justification for each allocation

3. **Monthly Breakdown Table**:
   Month | Category1 | Category2 | ... | Total

4. **Key Assumptions**

5. **Variance Thresholds** — When to review/adjust

6. **Cost Optimization Opportunities** — Where to save if budget is tight

7. **Investment Recommendations** — Where extra budget would have highest ROI

Output as a well-formatted markdown document.
Also output the monthly data as a CSV table at the end.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.01,
    };
  },
};

const financialProjection: Tool = {
  name: 'financial_projection',
  description: 'Build financial projections (P&L, cash flow, revenue) for 6-24 months. Generates conservative, base, and optimistic scenarios using analysis data as the foundation.',
  parameters: {
    projection_type: {
      type: 'string',
      description: 'Type of financial projection.',
      enum: ['revenue', 'profit_loss', 'cash_flow', 'comprehensive'],
    },
    months: {
      type: 'number',
      description: 'Number of months to project (6, 12, 18, or 24).',
    },
    assumptions: {
      type: 'string',
      description: 'Key assumptions to incorporate (e.g., "10% monthly growth, new hire in month 3, $50K funding in month 6").',
    },
    current_monthly_revenue: {
      type: 'number',
      description: 'Current monthly revenue in dollars. Will auto-detect from analysis if not provided.',
    },
    current_monthly_expenses: {
      type: 'number',
      description: 'Current monthly expenses in dollars. Will auto-detect from analysis if not provided.',
    },
  },
  required: ['projection_type'],
  category: 'finance',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const projType = String(args.projection_type ?? 'comprehensive');
    const months = Number(args.months ?? 12);
    const assumptions = args.assumptions ? String(args.assumptions) : '';
    const revenue = args.current_monthly_revenue ? Number(args.current_monthly_revenue) : undefined;
    const expenses = args.current_monthly_expenses ? Number(args.current_monthly_expenses) : undefined;
    const finContext = getFinanceContext(context);

    const prompt = `You are a financial analyst. Build detailed financial projections.

BUSINESS FINANCIAL DATA:
${finContext}

PROJECTION PARAMETERS:
- Type: ${projType}
- Duration: ${months} months
${revenue !== undefined ? `- Current Monthly Revenue: $${revenue.toLocaleString()}` : '- Current Revenue: Use from analysis data'}
${expenses !== undefined ? `- Current Monthly Expenses: $${expenses.toLocaleString()}` : '- Current Expenses: Use from analysis data'}
${assumptions ? `- Assumptions: ${assumptions}` : ''}

Create THREE scenarios: Conservative, Base Case, and Optimistic.

For each scenario provide:

1. **Key Assumptions** (growth rate, churn, costs, hiring, etc.)

2. **Monthly Projection Table**:
   Month | Revenue | COGS | Gross Profit | OpEx | Net Income | Cash Balance

3. **Key Metrics**:
   - Break-even point
   - Cash runway
   - Revenue CAGR
   - Profit margin trajectory

4. **Risks and Sensitivities**:
   - What could go wrong
   - Which assumptions matter most

5. **Recommendations**:
   - Financial actions to take
   - When to raise capital (if applicable)
   - Cost levers to pull

Format the tables as CSV data at the end of the document for easy import.
Use realistic numbers grounded in the business data provided.`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.01,
    };
  },
};

const expenseAnalysis: Tool = {
  name: 'expense_analysis',
  description: 'Analyze and categorize business expenses. Identifies areas of overspending, cost-saving opportunities, and provides benchmarks against industry standards.',
  parameters: {
    expenses: {
      type: 'string',
      description: 'Expense data in format "category|description|amount" per line. E.g., "Marketing|Google Ads|2000\\nSaaS|AWS Hosting|500"',
    },
    period: {
      type: 'string',
      description: 'Period these expenses cover (e.g., "January 2026", "Q4 2025").',
    },
    revenue: {
      type: 'number',
      description: 'Revenue for the same period (for ratio analysis).',
    },
  },
  required: ['expenses'],
  category: 'finance',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const expensesStr = String(args.expenses ?? '');
    const period = String(args.period ?? 'Current Period');
    const revenue = args.revenue ? Number(args.revenue) : undefined;
    const finContext = getFinanceContext(context);

    if (!expensesStr) {
      return { success: false, output: 'Expense data is required.' };
    }

    // Parse expenses
    const lines = expensesStr.split('\n').filter(Boolean);
    const expenses: { category: string; description: string; amount: number }[] = [];
    let totalExpenses = 0;

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      const amount = Number(parts[2] ?? 0);
      expenses.push({
        category: parts[0] ?? 'Other',
        description: parts[1] ?? 'Unknown',
        amount,
      });
      totalExpenses += amount;
    }

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const exp of expenses) {
      byCategory[exp.category] = (byCategory[exp.category] ?? 0) + exp.amount;
    }

    const prompt = `You are a financial controller and expense optimization expert.

BUSINESS CONTEXT:
${finContext}

EXPENSE DATA (${period}):
${expenses.map(e => `- ${e.category}: ${e.description} — $${e.amount.toLocaleString()}`).join('\n')}

Total Expenses: $${totalExpenses.toLocaleString()}
${revenue ? `Revenue: $${revenue.toLocaleString()} (Expense Ratio: ${((totalExpenses / revenue) * 100).toFixed(1)}%)` : ''}

By Category:
${Object.entries(byCategory).map(([cat, amt]) => `- ${cat}: $${amt.toLocaleString()} (${((amt / totalExpenses) * 100).toFixed(1)}%)`).join('\n')}

Provide:

1. **Expense Health Score**: 0-100 with assessment
2. **Category Analysis**: For each category, is spending appropriate, high, or low?
3. **Industry Benchmarks**: How do these expenses compare to industry norms?
4. **Cost-Saving Opportunities**: Top 5 ranked by potential savings
5. **ROI Assessment**: Which expenses are generating good returns?
6. **Recommendations**: Specific actions to optimize spending
7. **90-Day Savings Plan**: Step-by-step plan to reduce costs`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.01,
    };
  },
};

const pricingOptimizer: Tool = {
  name: 'pricing_optimizer',
  description: 'Analyze and optimize pricing strategy. Evaluates current pricing, recommends optimal price points, tiering strategies, and discount structures based on market data and unit economics.',
  parameters: {
    current_pricing: {
      type: 'string',
      description: 'Current pricing structure description (e.g., "Basic $29/mo, Pro $79/mo, Enterprise $199/mo").',
    },
    product_type: {
      type: 'string',
      description: 'Type of product/service.',
      enum: ['saas', 'services', 'physical_product', 'marketplace', 'subscription', 'one_time'],
    },
    target_margin: {
      type: 'number',
      description: 'Target gross margin percentage (e.g., 70 for 70%).',
    },
    competitor_pricing: {
      type: 'string',
      description: 'Known competitor pricing for comparison.',
    },
    cost_per_unit: {
      type: 'number',
      description: 'Cost to deliver one unit/serve one customer per month.',
    },
  },
  required: ['current_pricing', 'product_type'],
  category: 'finance',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const currentPricing = String(args.current_pricing ?? '');
    const productType = String(args.product_type ?? 'saas');
    const targetMargin = args.target_margin ? Number(args.target_margin) : undefined;
    const competitorPricing = args.competitor_pricing ? String(args.competitor_pricing) : '';
    const costPerUnit = args.cost_per_unit ? Number(args.cost_per_unit) : undefined;
    const finContext = getFinanceContext(context);

    const prompt = `You are a pricing strategy expert with deep knowledge of ${productType} pricing models.

BUSINESS FINANCIAL DATA:
${finContext}

PRICING PARAMETERS:
- Current Pricing: ${currentPricing}
- Product Type: ${productType}
${targetMargin ? `- Target Margin: ${targetMargin}%` : ''}
${competitorPricing ? `- Competitor Pricing: ${competitorPricing}` : ''}
${costPerUnit ? `- Cost per Unit: $${costPerUnit}` : ''}

Provide a comprehensive pricing optimization analysis:

1. **Current Pricing Assessment**
   - Is current pricing too low, right, or too high?
   - Price-to-value ratio
   - Pricing psychology analysis

2. **Recommended Pricing Structure**
   - Optimal tier design (2-4 tiers)
   - For each tier: name, price, features, target segment
   - Annual discount recommendation (typically 15-20%)

3. **Pricing Strategy**
   - Value metric (what to charge per)
   - Freemium vs free trial recommendation
   - Enterprise/custom pricing approach

4. **Revenue Impact Modeling**
   - Expected revenue change from pricing optimization
   - Customer migration between tiers
   - Churn risk from price changes

5. **Implementation Plan**
   - How to roll out pricing changes
   - Grandfathering strategy for existing customers
   - Communication templates

6. **Discount & Negotiation Framework**
   - Maximum discount thresholds
   - Volume discount tiers
   - When to offer discounts vs walk away`;

    const content = await generateWithGemini(prompt);

    return {
      success: true,
      output: content,
      cost: 0.01,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const financeTools: Tool[] = [
  createInvoice,
  createBudget,
  financialProjection,
  expenseAnalysis,
  pricingOptimizer,
];
registerTools(financeTools);
