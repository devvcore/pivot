import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Known acronyms to preserve when title-casing */
const ACRONYMS = new Set([
  'AI', 'API', 'SaaS', 'MRR', 'ARR', 'LTV', 'CLV', 'CAC', 'ROI', 'KPI',
  'NPS', 'OKR', 'SEO', 'CRM', 'ERP', 'HR', 'PR', 'QA', 'UX', 'UI',
  'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'VP', 'SVP', 'EVP', 'IC',
  'B2B', 'B2C', 'D2C', 'PPC', 'CTR', 'CPC', 'CPM', 'ROAS',
  'AWS', 'GCP', 'CI', 'CD', 'ML', 'NLP', 'LLM', 'GPT',
  'SQL', 'CSV', 'PDF', 'URL', 'IP', 'IT', 'QoQ', 'YoY', 'MoM',
  'COGS', 'EBITDA', 'P&L', 'GAAP', 'IRR', 'NPV', 'TAM', 'SAM', 'SOM',
  'GTM', 'PMF', 'MVP', 'POC', 'SLA', 'DORA', 'ESG', 'DEI',
  'ABM', 'SDR', 'AE', 'BDR', 'ACV', 'TCV', 'NDR', 'NRR', 'GRR',
  'CS', 'PLG', 'BI', 'PWA', 'SSO', 'MFA', 'RBAC', 'OAuth',
  'IG', 'FB', 'YT',
]);

/** Convert any code key (camelCase, snake_case, or mixed) to a readable Title Case label.
 *  "approaching_fit" → "Approaching Fit"
 *  "healthScore"     → "Health Score"
 *  "csExpansionPlaybook" → "CS Expansion Playbook"
 *  "AI_Content_Addon" → "AI Content Addon"
 */
export function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w+/g, word => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // Special mixed-case acronyms
      if (upper === 'SAAS') return 'SaaS';
      if (upper === 'OAUTH') return 'OAuth';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

/** Humanize a string value — clean up underscore-style product/field names.
 *  "AI_Content_Addon" → "AI Content Addon"
 *  "Maintenance_Subscription_Monthly" → "Maintenance Subscription Monthly"
 *  "Per_Update_Fee_Min" → "Per Update Fee Min"
 */
export function humanizeValue(value: string): string {
  if (typeof value !== 'string') return String(value);
  // Only transform if it looks like a code/DB name (has underscores or camelCase)
  if (!value.includes('_') && !/[a-z][A-Z]/.test(value)) return value;
  return formatLabel(value);
}
