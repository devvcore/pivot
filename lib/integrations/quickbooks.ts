// ═══════════════════════════════════════════════════════════════
// Pivot — QuickBooks Online Integration
// Fetches financial reports, invoices, expenses, and customers
// Base: https://quickbooks.api.intuit.com/v3/company/{realmId}/
// Auth: OAuth2
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import type { SyncResult } from './types';

// ─── QuickBooks Types ────────────────────────────────────────────────────────

export interface QBFinancials {
  revenue: number;
  expenses: number;
  netIncome: number;
  grossMargin: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  operatingCashFlow: number;
  periodStart: string;
  periodEnd: string;
}

export interface QBInvoice {
  id: string;
  docNumber: string;
  customer: string;
  customerId: string;
  amount: number;
  balance: number;
  date: string;
  dueDate: string;
  status: 'Paid' | 'Open' | 'Overdue' | 'Voided';
  currency: string;
}

export interface QBExpense {
  id: string;
  vendor: string;
  vendorId: string;
  amount: number;
  category: string;
  date: string;
  paymentType: string;
  description: string;
}

export interface QBCustomer {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  balance: number;
  active: boolean;
  createdAt: string;
}

interface QBReportRow {
  ColData?: Array<{ value: string; id?: string }>;
  Rows?: { Row?: QBReportRow[] };
  Header?: { ColData?: Array<{ value: string }> };
  Summary?: { ColData?: Array<{ value: string }> };
  group?: string;
}

interface QBReportResponse {
  Header: { Time: string; StartPeriod: string; EndPeriod: string };
  Columns: { Column: Array<{ ColTitle: string; ColType: string }> };
  Rows: { Row: QBReportRow[] };
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

const QB_BASE = 'https://quickbooks.api.intuit.com/v3/company';

async function qbFetch<T>(
  accessToken: string,
  realmId: string,
  path: string,
): Promise<T> {
  const url = `${QB_BASE}/${realmId}/${path}`;
  const separator = path.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}minorversion=73`;

  const res = await fetch(fullUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`QuickBooks API error ${res.status}: ${res.statusText} — ${body}`);
  }

  return res.json();
}

function extractReportTotal(report: QBReportResponse, sectionName: string): number {
  const rows = report.Rows?.Row ?? [];
  for (const row of rows) {
    if (row.group === sectionName && row.Summary?.ColData) {
      const val = row.Summary.ColData[1]?.value;
      if (val) return parseFloat(val) || 0;
    }
    // Also check direct row ColData for non-grouped reports
    if (row.ColData && row.ColData[0]?.value === sectionName) {
      const val = row.ColData[1]?.value;
      if (val) return parseFloat(val) || 0;
    }
  }
  return 0;
}

function getDateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ─── Fetch Functions ─────────────────────────────────────────────────────────

/**
 * Fetch P&L, Balance Sheet, and Cash Flow reports.
 * Computes revenue, expenses, netIncome, grossMargin, assets/liabilities, and cash flow.
 */
export async function fetchQBFinancials(
  accessToken: string,
  realmId: string,
  options?: { daysBack?: number },
): Promise<QBFinancials> {
  const { startDate, endDate } = getDateRange(options?.daysBack ?? 365);

  const [pnl, balance, cashflow] = await Promise.all([
    qbFetch<{ QueryResponse?: never } & Record<string, QBReportResponse>>(
      accessToken,
      realmId,
      `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`,
    ),
    qbFetch<Record<string, QBReportResponse>>(
      accessToken,
      realmId,
      `reports/BalanceSheet?date_macro=Today`,
    ),
    qbFetch<Record<string, QBReportResponse>>(
      accessToken,
      realmId,
      `reports/CashFlow?start_date=${startDate}&end_date=${endDate}`,
    ),
  ]);

  // The QB API wraps reports differently — the key is the report name
  const pnlReport: QBReportResponse =
    (pnl as any).Header ? (pnl as any) : Object.values(pnl)[0];
  const balanceReport: QBReportResponse =
    (balance as any).Header ? (balance as any) : Object.values(balance)[0];
  const cashflowReport: QBReportResponse =
    (cashflow as any).Header ? (cashflow as any) : Object.values(cashflow)[0];

  const revenue = extractReportTotal(pnlReport, 'Income');
  const costOfGoods = extractReportTotal(pnlReport, 'COGS');
  const expenses = extractReportTotal(pnlReport, 'Expenses');
  const netIncome = extractReportTotal(pnlReport, 'NetIncome');

  const totalAssets = extractReportTotal(balanceReport, 'TotalAssets') ||
    extractReportTotal(balanceReport, 'Assets');
  const totalLiabilities = extractReportTotal(balanceReport, 'TotalLiabilities') ||
    extractReportTotal(balanceReport, 'Liabilities');
  const equity = extractReportTotal(balanceReport, 'Equity');

  const operatingCashFlow = extractReportTotal(cashflowReport, 'OperatingActivities');

  const grossMargin = revenue > 0 ? ((revenue - costOfGoods) / revenue) * 100 : 0;

  return {
    revenue,
    expenses,
    netIncome,
    grossMargin,
    totalAssets,
    totalLiabilities,
    equity,
    operatingCashFlow,
    periodStart: startDate,
    periodEnd: endDate,
  };
}

/**
 * Fetch recent invoices via QB query API.
 */
export async function fetchQBInvoices(
  accessToken: string,
  realmId: string,
  options?: { daysBack?: number },
): Promise<QBInvoice[]> {
  const { startDate } = getDateRange(options?.daysBack ?? 90);
  const query = encodeURIComponent(
    `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC MAXRESULTS 500`,
  );

  const res = await qbFetch<{
    QueryResponse: { Invoice?: any[]; totalCount?: number };
  }>(accessToken, realmId, `query?query=${query}`);

  const invoices = res.QueryResponse?.Invoice ?? [];
  const now = new Date();

  return invoices.map((inv: any) => {
    const dueDate = inv.DueDate || inv.TxnDate;
    const balance = parseFloat(inv.Balance) || 0;
    let status: QBInvoice['status'] = 'Open';
    if (inv.PrivateNote?.includes('Voided') || inv.Balance === undefined) {
      status = 'Voided';
    } else if (balance === 0) {
      status = 'Paid';
    } else if (new Date(dueDate) < now) {
      status = 'Overdue';
    }

    return {
      id: inv.Id,
      docNumber: inv.DocNumber || '',
      customer: inv.CustomerRef?.name || 'Unknown',
      customerId: inv.CustomerRef?.value || '',
      amount: parseFloat(inv.TotalAmt) || 0,
      balance,
      date: inv.TxnDate,
      dueDate,
      status,
      currency: inv.CurrencyRef?.value || 'USD',
    };
  });
}

/**
 * Fetch recent purchase/expense transactions.
 */
export async function fetchQBExpenses(
  accessToken: string,
  realmId: string,
  options?: { daysBack?: number },
): Promise<QBExpense[]> {
  const { startDate } = getDateRange(options?.daysBack ?? 90);
  const query = encodeURIComponent(
    `SELECT * FROM Purchase WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC MAXRESULTS 500`,
  );

  const res = await qbFetch<{
    QueryResponse: { Purchase?: any[]; totalCount?: number };
  }>(accessToken, realmId, `query?query=${query}`);

  const purchases = res.QueryResponse?.Purchase ?? [];

  return purchases.map((p: any) => {
    // Expenses can have multiple lines; sum up and use first category
    const lines = p.Line ?? [];
    const firstDetail = lines[0]?.AccountBasedExpenseLineDetail;
    const category = firstDetail?.AccountRef?.name || 'Uncategorized';

    return {
      id: p.Id,
      vendor: p.EntityRef?.name || 'Unknown',
      vendorId: p.EntityRef?.value || '',
      amount: parseFloat(p.TotalAmt) || 0,
      category,
      date: p.TxnDate,
      paymentType: p.PaymentType || 'Other',
      description: lines[0]?.Description || '',
    };
  });
}

/**
 * Fetch all customers.
 */
export async function fetchQBCustomers(
  accessToken: string,
  realmId: string,
): Promise<QBCustomer[]> {
  const query = encodeURIComponent(
    `SELECT * FROM Customer MAXRESULTS 1000`,
  );

  const res = await qbFetch<{
    QueryResponse: { Customer?: any[]; totalCount?: number };
  }>(accessToken, realmId, `query?query=${query}`);

  const customers = res.QueryResponse?.Customer ?? [];

  return customers.map((c: any) => ({
    id: c.Id,
    name: c.DisplayName || `${c.GivenName || ''} ${c.FamilyName || ''}`.trim(),
    companyName: c.CompanyName || null,
    email: c.PrimaryEmailAddr?.Address || null,
    phone: c.PrimaryPhone?.FreeFormNumber || null,
    balance: parseFloat(c.Balance) || 0,
    active: c.Active !== false,
    createdAt: c.MetaData?.CreateTime || new Date().toISOString(),
  }));
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Orchestrates all QuickBooks fetches, computes key metrics, and saves to Supabase.
 */
export async function syncQuickBooksToAnalytics(
  orgId: string,
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;
  let insightsGenerated = 0;
  const supabase = createAdminClient();

  // Fetch all data in parallel
  const [financialsResult, invoicesResult, expensesResult, customersResult] =
    await Promise.allSettled([
      fetchQBFinancials(accessToken, realmId),
      fetchQBInvoices(accessToken, realmId, { daysBack: 90 }),
      fetchQBExpenses(accessToken, realmId, { daysBack: 90 }),
      fetchQBCustomers(accessToken, realmId),
    ]);

  // Process financials
  if (financialsResult.status === 'fulfilled') {
    const fin = financialsResult.value;
    recordsProcessed += 3; // 3 reports

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'quickbooks',
      data_type: 'financials',
      data: fin,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Financials save error: ${error.message}`);

    // Generate financial health insights
    const insights: Record<string, unknown>[] = [];
    if (fin.grossMargin < 30) {
      insights.push({
        org_id: orgId,
        source: 'quickbooks',
        insight_type: 'financial_health',
        subject_name: 'Gross Margin Alert',
        data: {
          metric: 'grossMargin',
          value: fin.grossMargin,
          threshold: 30,
          message: `Gross margin is ${fin.grossMargin.toFixed(1)}%, below the 30% threshold`,
          severity: 'warning',
        },
        period_start: fin.periodStart,
        period_end: fin.periodEnd,
        created_at: new Date().toISOString(),
      });
    }
    if (fin.netIncome < 0) {
      insights.push({
        org_id: orgId,
        source: 'quickbooks',
        insight_type: 'financial_health',
        subject_name: 'Net Loss Alert',
        data: {
          metric: 'netIncome',
          value: fin.netIncome,
          message: `Operating at a net loss of $${Math.abs(fin.netIncome).toLocaleString()}`,
          severity: 'critical',
        },
        period_start: fin.periodStart,
        period_end: fin.periodEnd,
        created_at: new Date().toISOString(),
      });
    }
    if (fin.operatingCashFlow < 0) {
      insights.push({
        org_id: orgId,
        source: 'quickbooks',
        insight_type: 'financial_health',
        subject_name: 'Negative Cash Flow',
        data: {
          metric: 'operatingCashFlow',
          value: fin.operatingCashFlow,
          message: `Negative operating cash flow of $${Math.abs(fin.operatingCashFlow).toLocaleString()}`,
          severity: 'warning',
        },
        period_start: fin.periodStart,
        period_end: fin.periodEnd,
        created_at: new Date().toISOString(),
      });
    }

    if (insights.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert(insights);
      if (insightError) errors.push(`Insight save error: ${insightError.message}`);
      insightsGenerated += insights.length;
    }
  } else {
    errors.push(`Financials fetch error: ${financialsResult.reason}`);
  }

  // Process invoices
  if (invoicesResult.status === 'fulfilled') {
    const invoices = invoicesResult.value;
    recordsProcessed += invoices.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'quickbooks',
      data_type: 'invoices',
      data: { invoices, count: invoices.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Invoices save error: ${error.message}`);

    // Invoice health insights
    const overdue = invoices.filter((i) => i.status === 'Overdue');
    const overdueTotal = overdue.reduce((sum, i) => sum + i.balance, 0);
    if (overdue.length > 0) {
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'quickbooks',
        insight_type: 'accounts_receivable',
        subject_name: 'Overdue Invoices',
        data: {
          overdueCount: overdue.length,
          overdueTotal,
          totalInvoices: invoices.length,
          overdueRate: ((overdue.length / invoices.length) * 100).toFixed(1),
          message: `${overdue.length} overdue invoices totaling $${overdueTotal.toLocaleString()}`,
          severity: overdueTotal > 10000 ? 'critical' : 'warning',
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Invoice insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Invoices fetch error: ${invoicesResult.reason}`);
  }

  // Process expenses
  if (expensesResult.status === 'fulfilled') {
    const expenses = expensesResult.value;
    recordsProcessed += expenses.length;

    // Aggregate by category
    const byCategory: Record<string, number> = {};
    for (const exp of expenses) {
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
    }

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'quickbooks',
      data_type: 'expenses',
      data: { expenses, count: expenses.length, byCategory },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Expenses save error: ${error.message}`);

    // Top expense category insight
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const topCategory = sorted[0];
      const { error: insightError } = await supabase.from('integration_insights').insert({
        org_id: orgId,
        source: 'quickbooks',
        insight_type: 'expense_analysis',
        subject_name: 'Top Expense Categories',
        data: {
          topCategory: topCategory[0],
          topCategoryAmount: topCategory[1],
          topCategoryShare: ((topCategory[1] / totalExpenses) * 100).toFixed(1),
          categories: sorted.slice(0, 5).map(([name, amount]) => ({ name, amount })),
          totalExpenses,
        },
        created_at: new Date().toISOString(),
      });
      if (insightError) errors.push(`Expense insight error: ${insightError.message}`);
      insightsGenerated++;
    }
  } else {
    errors.push(`Expenses fetch error: ${expensesResult.reason}`);
  }

  // Process customers
  if (customersResult.status === 'fulfilled') {
    const customers = customersResult.value;
    recordsProcessed += customers.length;

    const { error } = await supabase.from('integration_data').upsert({
      org_id: orgId,
      provider: 'quickbooks',
      data_type: 'customers',
      data: { customers, count: customers.length },
      synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider,data_type' });

    if (error) errors.push(`Customers save error: ${error.message}`);

    // Customer concentration insight
    const activeCustomers = customers.filter((c) => c.active);
    const totalBalance = activeCustomers.reduce((sum, c) => sum + c.balance, 0);
    if (activeCustomers.length > 0 && totalBalance > 0) {
      const topCustomer = activeCustomers.sort((a, b) => b.balance - a.balance)[0];
      const concentration = (topCustomer.balance / totalBalance) * 100;
      if (concentration > 30) {
        const { error: insightError } = await supabase.from('integration_insights').insert({
          org_id: orgId,
          source: 'quickbooks',
          insight_type: 'customer_concentration',
          subject_name: 'Revenue Concentration Risk',
          data: {
            topCustomer: topCustomer.name,
            concentration: concentration.toFixed(1),
            totalCustomers: activeCustomers.length,
            message: `${topCustomer.name} represents ${concentration.toFixed(1)}% of outstanding receivables`,
            severity: concentration > 50 ? 'critical' : 'warning',
          },
          created_at: new Date().toISOString(),
        });
        if (insightError) errors.push(`Customer insight error: ${insightError.message}`);
        insightsGenerated++;
      }
    }
  } else {
    errors.push(`Customers fetch error: ${customersResult.reason}`);
  }

  // Update last sync timestamp
  const nextSync = new Date();
  nextSync.setMinutes(nextSync.getMinutes() + 60); // Default: sync every hour

  return {
    success: errors.length === 0,
    recordsProcessed,
    insightsGenerated,
    errors,
    nextSyncAt: nextSync.toISOString(),
  };
}
