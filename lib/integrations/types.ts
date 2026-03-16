// ═══════════════════════════════════════════════════════════════
// Pivot — Integration Types
// Core type definitions for all third-party integrations
// ═══════════════════════════════════════════════════════════════

export type IntegrationProvider =
  | 'slack' | 'gmail' | 'adp' | 'workday'
  | 'quickbooks' | 'salesforce' | 'hubspot' | 'stripe' | 'jira' | 'github'
  | 'google_analytics' | 'google_sheets' | 'notion' | 'linear'
  | 'asana' | 'google_calendar' | 'microsoft_teams' | 'airtable'
  | 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'youtube';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface Integration {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  composioConnectedAccountId: string | null;
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
  category: 'communication' | 'hr' | 'finance' | 'crm' | 'project_management' | 'payments' | 'analytics' | 'productivity';
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
  {
    provider: 'github',
    name: 'GitHub',
    description: 'Code repository analytics including commit velocity, PR quality, review turnaround, and CI health',
    category: 'project_management',
    icon: 'GitBranch',
    color: 'zinc',
    features: [
      'Commit velocity tracking',
      'PR review turnaround',
      'CI/CD pass rates',
      'Code quality signals',
      'Collaboration metrics',
      'Automated code audits',
    ],
    requiredScopes: ['repo', 'read:org'],
    docsUrl: 'https://docs.github.com/en/rest',
  },
  {
    provider: 'google_analytics',
    name: 'Google Analytics',
    description: 'Web traffic analytics including user behavior, conversion funnels, traffic sources, and realtime data',
    category: 'analytics',
    icon: 'BarChart3',
    color: 'amber',
    features: [
      'Traffic source analysis',
      'Conversion funnels',
      'Realtime visitors',
      'Audience demographics',
      'Page performance',
      'Campaign attribution',
    ],
    requiredScopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting',
  },
  {
    provider: 'google_sheets',
    name: 'Google Sheets',
    description: 'Import and export data from spreadsheets for flexible reporting and data pipelines',
    category: 'productivity',
    icon: 'Table',
    color: 'emerald',
    features: [
      'Data import/export',
      'Report generation',
      'Custom dashboards',
      'Automated updates',
      'Formula-driven KPIs',
    ],
    requiredScopes: ['https://www.googleapis.com/auth/spreadsheets'],
    docsUrl: 'https://developers.google.com/sheets/api',
  },
  {
    provider: 'notion',
    name: 'Notion',
    description: 'Knowledge base and project data including OKRs, meeting notes, wikis, and team documentation',
    category: 'productivity',
    icon: 'BookOpen',
    color: 'zinc',
    features: [
      'OKR tracking',
      'Meeting notes analysis',
      'Wiki content search',
      'Database queries',
      'Task completion rates',
    ],
    requiredScopes: ['read_content', 'read_databases'],
    docsUrl: 'https://developers.notion.com/',
  },
  {
    provider: 'linear',
    name: 'Linear',
    description: 'Engineering project data including issue cycle times, sprint velocity, and team workload',
    category: 'project_management',
    icon: 'Zap',
    color: 'indigo',
    features: [
      'Issue cycle time',
      'Sprint velocity',
      'Bug tracking',
      'Team workload',
      'Release tracking',
      'Triage analytics',
    ],
    requiredScopes: ['read'],
    docsUrl: 'https://developers.linear.app/docs',
  },
  {
    provider: 'asana',
    name: 'Asana',
    description: 'Project management analytics including task completion, team workload, and project timelines',
    category: 'project_management',
    icon: 'CheckSquare',
    color: 'rose',
    features: [
      'Task completion rates',
      'Project timelines',
      'Team workload',
      'Milestone tracking',
      'Portfolio analytics',
    ],
    requiredScopes: ['default'],
    docsUrl: 'https://developers.asana.com/docs',
  },
  {
    provider: 'google_calendar',
    name: 'Google Calendar',
    description: 'Meeting patterns and time allocation analysis for productivity insights',
    category: 'productivity',
    icon: 'Calendar',
    color: 'sky',
    features: [
      'Meeting time analysis',
      'Focus time tracking',
      'Meeting frequency',
      'Calendar conflicts',
      'Attendance patterns',
    ],
    requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    docsUrl: 'https://developers.google.com/calendar/api',
  },
  {
    provider: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Enterprise communication analytics including chat patterns, meeting data, and team collaboration',
    category: 'communication',
    icon: 'MessagesSquare',
    color: 'blue',
    features: [
      'Chat analytics',
      'Meeting data',
      'Channel activity',
      'Response times',
      'Collaboration metrics',
    ],
    requiredScopes: ['Chat.Read', 'Channel.ReadBasic.All', 'Team.ReadBasic.All'],
    docsUrl: 'https://learn.microsoft.com/en-us/graph/teams-concept-overview',
  },
  {
    provider: 'airtable',
    name: 'Airtable',
    description: 'Flexible database and spreadsheet data for CRM, inventory, project tracking, and custom workflows',
    category: 'productivity',
    icon: 'Grid3x3',
    color: 'teal',
    features: [
      'Custom database queries',
      'Inventory tracking',
      'Project management',
      'CRM data',
      'Workflow automation',
    ],
    requiredScopes: ['data.records:read', 'schema.bases:read'],
    docsUrl: 'https://airtable.com/developers/web/api',
  },
  {
    provider: 'linkedin',
    name: 'LinkedIn',
    description: 'Post content, share updates, and manage your professional presence on LinkedIn',
    category: 'communication',
    icon: 'Linkedin',
    color: 'blue',
    features: [
      'Create text posts',
      'Share articles & links',
      'Post on company pages',
      'Engagement analytics',
      'Profile management',
    ],
    requiredScopes: ['w_member_social', 'r_liteprofile'],
    docsUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/',
  },
  {
    provider: 'twitter',
    name: 'X (Twitter)',
    description: 'Post tweets, engage with followers, and manage your X/Twitter presence',
    category: 'communication',
    icon: 'Twitter',
    color: 'zinc',
    features: [
      'Post tweets',
      'Reply to threads',
      'Like & retweet',
      'Search tweets',
      'Engagement analytics',
    ],
    requiredScopes: ['tweet.read', 'tweet.write', 'users.read'],
    docsUrl: 'https://developer.x.com/en/docs',
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    description: 'Post photos, reels, and carousels. View analytics, comments, and DMs on your Business/Creator account',
    category: 'communication',
    icon: 'Camera',
    color: 'pink',
    features: [
      'Create photo/video posts',
      'Carousel posts',
      'Reels publishing',
      'Post analytics & insights',
      'Comment management',
      'DM conversations',
    ],
    requiredScopes: ['instagram_basic', 'instagram_content_publish'],
    docsUrl: 'https://developers.facebook.com/docs/instagram-api/',
  },
  {
    provider: 'facebook',
    name: 'Facebook',
    description: 'Post to Pages, manage comments, view insights, and engage with your Facebook audience',
    category: 'communication',
    icon: 'Facebook',
    color: 'blue',
    features: [
      'Create page posts',
      'Photo & video posts',
      'Page insights & analytics',
      'Comment management',
      'Messenger conversations',
      'Scheduled posts',
    ],
    requiredScopes: ['pages_manage_posts', 'pages_read_engagement'],
    docsUrl: 'https://developers.facebook.com/docs/graph-api/',
  },
  {
    provider: 'youtube',
    name: 'YouTube',
    description: 'Upload videos, manage playlists, view analytics, and engage with your YouTube channel',
    category: 'communication',
    icon: 'Youtube',
    color: 'red',
    features: [
      'Upload videos',
      'Playlist management',
      'Channel analytics',
      'Comment management',
      'Search videos',
      'Subscription tracking',
    ],
    requiredScopes: ['https://www.googleapis.com/auth/youtube'],
    docsUrl: 'https://developers.google.com/youtube/v3',
  },
];
