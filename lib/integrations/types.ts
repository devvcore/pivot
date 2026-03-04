// ═══════════════════════════════════════════════════════════════
// Pivot — Integration Types
// Core type definitions for all third-party integrations
// ═══════════════════════════════════════════════════════════════

export type IntegrationProvider =
  | 'slack' | 'gmail' | 'adp' | 'workday'
  | 'quickbooks' | 'salesforce' | 'hubspot' | 'stripe' | 'jira';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface Integration {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  metadata: Record<string, any>; // provider-specific config
  lastSyncAt: string | null;
  syncFrequencyMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  orgId: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  insightsGenerated: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface CommunicationInsight {
  id: string;
  orgId: string;
  jobId: string | null;
  source: 'slack' | 'gmail';
  insightType: 'relationship_score' | 'meeting_attendance' | 'response_time' | 'bottleneck' | 'sentiment' | 'engagement' | 'risk_flag';
  subjectName: string | null;
  data: Record<string, any>;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

export interface HREmployeeData {
  id: string;
  orgId: string;
  source: 'adp' | 'workday' | 'manual';
  externalId: string | null;
  employeeName: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  salary: number | null;
  payFrequency: string | null;
  employmentStatus: string | null;
  managerName: string | null;
  performanceRating: number | null;
  lastReviewDate: string | null;
  benefits: Record<string, any> | null;
  timeOffBalance: Record<string, any> | null;
  metadata: Record<string, any>;
  syncedAt: string;
}

// ─── OAuth Configuration ──────────────────────────────────────────────────────

export interface OAuthConfig {
  provider: IntegrationProvider;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

// ─── Sync Results ─────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  insightsGenerated: number;
  errors: string[];
  nextSyncAt?: string;
}

// ─── Provider Capabilities ────────────────────────────────────────────────────

export interface ProviderCapability {
  provider: IntegrationProvider;
  name: string;
  description: string;
  category: 'communication' | 'hr' | 'finance' | 'crm' | 'project_management' | 'payments';
  icon: string; // lucide icon name
  color: string; // tailwind color
  features: string[];
  requiredScopes: string[];
  docsUrl: string;
}

export const PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    provider: 'slack',
    name: 'Slack',
    description: 'Analyze team communication patterns, response times, bottlenecks, and collaboration health',
    category: 'communication',
    icon: 'MessageSquare',
    color: 'purple',
    features: [
      'Channel analysis',
      'Response time tracking',
      'Meeting attendance',
      'Sentiment analysis',
      'Bottleneck detection',
      'Relationship mapping',
    ],
    requiredScopes: ['channels:history', 'channels:read', 'users:read', 'reactions:read', 'groups:history', 'im:history'],
    docsUrl: 'https://api.slack.com/docs',
  },
  {
    provider: 'gmail',
    name: 'Gmail',
    description: 'Analyze email patterns, client communication, follow-up rates, and response quality',
    category: 'communication',
    icon: 'Mail',
    color: 'red',
    features: [
      'Email volume analysis',
      'Response time tracking',
      'Client communication scoring',
      'Follow-up detection',
      'Thread analysis',
    ],
    requiredScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    docsUrl: 'https://developers.google.com/gmail/api',
  },
  {
    provider: 'adp',
    name: 'ADP',
    description: 'Sync employee data, payroll, benefits, and time-off for workforce analytics',
    category: 'hr',
    icon: 'Users',
    color: 'blue',
    features: [
      'Employee roster sync',
      'Payroll data',
      'Benefits enrollment',
      'Time & attendance',
      'Performance data',
    ],
    requiredScopes: ['worker-demographics', 'payroll', 'time-management'],
    docsUrl: 'https://developers.adp.com/',
  },
  {
    provider: 'workday',
    name: 'Workday',
    description: 'Sync HR data, compensation, talent management, and organizational structure',
    category: 'hr',
    icon: 'Building2',
    color: 'orange',
    features: [
      'Employee data sync',
      'Compensation analysis',
      'Org chart',
      'Talent management',
      'Learning & development',
    ],
    requiredScopes: ['wd:workers', 'wd:compensation', 'wd:organizations'],
    docsUrl: 'https://community.workday.com/api',
  },
  {
    provider: 'quickbooks',
    name: 'QuickBooks',
    description: 'Real-time financial data including invoices, expenses, P&L, and cash flow',
    category: 'finance',
    icon: 'Receipt',
    color: 'green',
    features: [
      'Invoice tracking',
      'Expense categorization',
      'P&L statements',
      'Cash flow analysis',
      'Tax preparation data',
    ],
    requiredScopes: ['com.intuit.quickbooks.accounting'],
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs',
  },
  {
    provider: 'salesforce',
    name: 'Salesforce',
    description: 'CRM data including pipeline, deals, customer health, and sales performance',
    category: 'crm',
    icon: 'TrendingUp',
    color: 'sky',
    features: [
      'Pipeline analysis',
      'Deal tracking',
      'Customer health scores',
      'Sales rep performance',
      'Forecast accuracy',
    ],
    requiredScopes: ['api', 'refresh_token'],
    docsUrl: 'https://developer.salesforce.com/docs',
  },
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description: 'Marketing & sales data including contacts, deals, campaigns, and engagement',
    category: 'crm',
    icon: 'Target',
    color: 'orange',
    features: [
      'Contact management',
      'Deal pipeline',
      'Campaign analytics',
      'Email engagement',
      'Lead scoring',
    ],
    requiredScopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
    docsUrl: 'https://developers.hubspot.com/docs/api',
  },
  {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Payment data including revenue, subscriptions, churn, and customer LTV',
    category: 'payments',
    icon: 'CreditCard',
    color: 'violet',
    features: [
      'Revenue tracking',
      'Subscription analytics',
      'Churn detection',
      'Customer LTV',
      'Payment failure analysis',
    ],
    requiredScopes: ['read_only'],
    docsUrl: 'https://stripe.com/docs/api',
  },
  {
    provider: 'jira',
    name: 'Jira',
    description: 'Project data including sprint velocity, bug tracking, team productivity, and capacity',
    category: 'project_management',
    icon: 'KanbanSquare',
    color: 'blue',
    features: [
      'Sprint velocity',
      'Bug tracking',
      'Team productivity',
      'Capacity planning',
      'Release tracking',
    ],
    requiredScopes: ['read:jira-work', 'read:jira-user'],
    docsUrl: 'https://developer.atlassian.com/cloud/jira/',
  },
];
