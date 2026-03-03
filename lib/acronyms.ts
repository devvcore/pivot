/** Business acronym definitions for hover tooltips throughout the analysis */

export const ACRONYMS: Record<string, string> = {
  "ROI": "Return on Investment -- profit relative to cost",
  "KPI": "Key Performance Indicator -- measurable value showing progress",
  "CAC": "Customer Acquisition Cost -- cost to gain one new customer",
  "LTV": "Lifetime Value -- total revenue from a customer over time",
  "MRR": "Monthly Recurring Revenue -- predictable monthly income",
  "ARR": "Annual Recurring Revenue -- yearly recurring income",
  "EBITDA": "Earnings Before Interest, Taxes, Depreciation & Amortization",
  "NPS": "Net Promoter Score -- customer loyalty measurement",
  "COGS": "Cost of Goods Sold -- direct costs of producing goods",
  "TAM": "Total Addressable Market -- total market demand",
  "SAM": "Serviceable Addressable Market -- market you can reach",
  "SOM": "Serviceable Obtainable Market -- market you can capture",
  "P&L": "Profit and Loss Statement",
  "B2B": "Business to Business",
  "B2C": "Business to Consumer",
  "SaaS": "Software as a Service",
  "CRM": "Customer Relationship Management",
  "ATS": "Applicant Tracking System",
  "SEO": "Search Engine Optimization",
  "CPC": "Cost Per Click",
  "CPM": "Cost Per Mille (per 1,000 impressions)",
  "CTR": "Click-Through Rate",
  "ROAS": "Return on Ad Spend",
  "CLV": "Customer Lifetime Value",
  "GMV": "Gross Merchandise Value",
  "OKR": "Objectives and Key Results",
  "SLA": "Service Level Agreement",
  "MVP": "Minimum Viable Product",
  "PMF": "Product-Market Fit",
  "QoQ": "Quarter over Quarter",
  "YoY": "Year over Year",
  "MoM": "Month over Month",
  "SWOT": "Strengths, Weaknesses, Opportunities, Threats",
  "LLC": "Limited Liability Company",
  "ERP": "Enterprise Resource Planning",
  "API": "Application Programming Interface",
  "CTO": "Chief Technology Officer",
  "CFO": "Chief Financial Officer",
  "CEO": "Chief Executive Officer",
  "COO": "Chief Operating Officer",
  "CMO": "Chief Marketing Officer",
  "GTM": "Go-to-Market -- strategy for reaching target customers",
  "PLG": "Product-Led Growth -- growth driven by the product itself",
  "NRR": "Net Revenue Retention -- revenue kept from existing customers",
  "GRR": "Gross Revenue Retention -- revenue kept before expansion",
  "DSO": "Days Sales Outstanding -- average collection period",
  "DPO": "Days Payable Outstanding -- average payment period",
  "DORA": "DevOps Research and Assessment -- software delivery metrics",
  "ABM": "Account-Based Marketing -- targeted marketing to key accounts",
  "DEI": "Diversity, Equity, and Inclusion",
  "ESG": "Environmental, Social, and Governance",
  "IPO": "Initial Public Offering",
  "M&A": "Mergers and Acquisitions",
  "R&D": "Research and Development",
  "PQL": "Product-Qualified Lead -- lead identified by product usage",
  "SQL": "Sales-Qualified Lead -- lead ready for sales outreach",
  "MQL": "Marketing-Qualified Lead -- lead engaged with marketing",
  "RICE": "Reach, Impact, Confidence, Effort -- prioritization framework",
  "DOL": "Degree of Operating Leverage",
  "RevOps": "Revenue Operations -- aligning sales, marketing, and CS",
};

// Build a sorted array of acronyms (longest first so multi-word acronyms match before shorter ones)
const SORTED_ACRONYMS = Object.keys(ACRONYMS).sort((a, b) => b.length - a.length);

// Build regex that matches any known acronym as a whole word
// Escape special regex characters in acronym keys (e.g., P&L, M&A)
const escaped = SORTED_ACRONYMS.map(a => a.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&"));
const ACRONYM_REGEX = new RegExp(`\\b(${escaped.join("|")})\\b`, "g");

/** Find all acronyms in a text string with their positions */
export function findAcronyms(text: string): { acronym: string; definition: string; index: number }[] {
  const results: { acronym: string; definition: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  ACRONYM_REGEX.lastIndex = 0;

  while ((match = ACRONYM_REGEX.exec(text)) !== null) {
    const acronym = match[1];
    const definition = ACRONYMS[acronym];
    if (definition) {
      results.push({ acronym, definition, index: match.index });
    }
  }

  return results;
}
