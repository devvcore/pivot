"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, Mail, Users, Building2, Receipt, TrendingUp,
  Target, CreditCard, KanbanSquare, Link2, Unlink, RefreshCw,
  Check, AlertCircle, Clock, Loader2, ChevronRight, ChevronDown,
  Zap, Shield, ExternalLink, Sparkles, ArrowLeft,
  GitBranch, BarChart3, Table, BookOpen, CheckSquare, Calendar,
  MessagesSquare, Grid3x3,
} from "lucide-react";

// ── Provider Capabilities (mirrors lib/integrations/types.ts) ────────────────

interface ProviderCapability {
  provider: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  features: string[];
  requiredScopes: string[];
  docsUrl: string;
}

const PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    provider: "slack",
    name: "Slack",
    description: "Analyze team communication patterns, response times, bottlenecks, and collaboration health",
    category: "Communication",
    icon: "MessageSquare",
    color: "#4A154B",
    features: ["Channel analysis", "Response time tracking", "Meeting attendance", "Sentiment analysis", "Bottleneck detection", "Relationship mapping"],
    requiredScopes: ["channels:history", "channels:read", "users:read", "reactions:read", "groups:history", "im:history"],
    docsUrl: "https://api.slack.com/docs",
  },
  {
    provider: "gmail",
    name: "Gmail",
    description: "Analyze email patterns, client communication, follow-up rates, and response quality",
    category: "Communication",
    icon: "Mail",
    color: "#EA4335",
    features: ["Email volume analysis", "Response time tracking", "Client communication scoring", "Follow-up detection", "Thread analysis"],
    requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    docsUrl: "https://developers.google.com/gmail/api",
  },
  {
    provider: "microsoft_teams",
    name: "Microsoft Teams",
    description: "Enterprise communication analytics including chat patterns, meeting data, and team collaboration",
    category: "Communication",
    icon: "MessagesSquare",
    color: "#5059C9",
    features: ["Chat analytics", "Meeting data", "Channel activity", "Response times", "Collaboration metrics"],
    requiredScopes: ["Chat.Read", "Channel.ReadBasic.All", "Team.ReadBasic.All"],
    docsUrl: "https://learn.microsoft.com/en-us/graph/teams-concept-overview",
  },
  {
    provider: "adp",
    name: "ADP",
    description: "Sync employee data, payroll, benefits, and time-off for workforce analytics",
    category: "HR",
    icon: "Users",
    color: "#D0271D",
    features: ["Employee roster sync", "Payroll data", "Benefits enrollment", "Time & attendance", "Performance data"],
    requiredScopes: ["worker-demographics", "payroll", "time-management"],
    docsUrl: "https://developers.adp.com/",
  },
  {
    provider: "workday",
    name: "Workday",
    description: "Sync HR data, compensation, talent management, and organizational structure",
    category: "HR",
    icon: "Building2",
    color: "#F68D2E",
    features: ["Employee data sync", "Compensation analysis", "Org chart", "Talent management", "Learning & development"],
    requiredScopes: ["wd:workers", "wd:compensation", "wd:organizations"],
    docsUrl: "https://community.workday.com/api",
  },
  {
    provider: "quickbooks",
    name: "QuickBooks",
    description: "Real-time financial data including invoices, expenses, P&L, and cash flow",
    category: "Finance",
    icon: "Receipt",
    color: "#2CA01C",
    features: ["Invoice tracking", "Expense categorization", "P&L statements", "Cash flow analysis", "Tax preparation data"],
    requiredScopes: ["com.intuit.quickbooks.accounting"],
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs",
  },
  {
    provider: "salesforce",
    name: "Salesforce",
    description: "CRM data including pipeline, deals, customer health, and sales performance",
    category: "CRM",
    icon: "TrendingUp",
    color: "#00A1E0",
    features: ["Pipeline analysis", "Deal tracking", "Customer health scores", "Sales rep performance", "Forecast accuracy"],
    requiredScopes: ["api", "refresh_token"],
    docsUrl: "https://developer.salesforce.com/docs",
  },
  {
    provider: "hubspot",
    name: "HubSpot",
    description: "Marketing & sales data including contacts, deals, campaigns, and engagement",
    category: "CRM",
    icon: "Target",
    color: "#FF7A59",
    features: ["Contact management", "Deal pipeline", "Campaign analytics", "Email engagement", "Lead scoring"],
    requiredScopes: ["crm.objects.contacts.read", "crm.objects.deals.read"],
    docsUrl: "https://developers.hubspot.com/docs/api",
  },
  {
    provider: "stripe",
    name: "Stripe",
    description: "Payment data including revenue, subscriptions, churn, and customer LTV",
    category: "Payments",
    icon: "CreditCard",
    color: "#635BFF",
    features: ["Revenue tracking", "Subscription analytics", "Churn detection", "Customer LTV", "Payment failure analysis"],
    requiredScopes: ["read_only"],
    docsUrl: "https://stripe.com/docs/api",
  },
  {
    provider: "jira",
    name: "Jira",
    description: "Project data including sprint velocity, bug tracking, team productivity, and capacity",
    category: "Project Management",
    icon: "KanbanSquare",
    color: "#0052CC",
    features: ["Sprint velocity", "Bug tracking", "Team productivity", "Capacity planning", "Release tracking"],
    requiredScopes: ["read:jira-work", "read:jira-user"],
    docsUrl: "https://developer.atlassian.com/cloud/jira/",
  },
  {
    provider: "github",
    name: "GitHub",
    description: "Code repository analytics including commit velocity, PR quality, review turnaround, and CI health",
    category: "Project Management",
    icon: "GitBranch",
    color: "#24292F",
    features: ["Commit velocity tracking", "PR review turnaround", "CI/CD pass rates", "Code quality signals", "Collaboration metrics", "Automated code audits"],
    requiredScopes: ["repo", "read:org"],
    docsUrl: "https://docs.github.com/en/rest",
  },
  {
    provider: "linear",
    name: "Linear",
    description: "Engineering project data including issue cycle times, sprint velocity, and team workload",
    category: "Project Management",
    icon: "Zap",
    color: "#5E6AD2",
    features: ["Issue cycle time", "Sprint velocity", "Bug tracking", "Team workload", "Release tracking", "Triage analytics"],
    requiredScopes: ["read"],
    docsUrl: "https://developers.linear.app/docs",
  },
  {
    provider: "asana",
    name: "Asana",
    description: "Project management analytics including task completion, team workload, and project timelines",
    category: "Project Management",
    icon: "CheckSquare",
    color: "#F06A6A",
    features: ["Task completion rates", "Project timelines", "Team workload", "Milestone tracking", "Portfolio analytics"],
    requiredScopes: ["default"],
    docsUrl: "https://developers.asana.com/docs",
  },
  {
    provider: "google_analytics",
    name: "Google Analytics",
    description: "Web traffic analytics including user behavior, conversion funnels, traffic sources, and realtime data",
    category: "Analytics",
    icon: "BarChart3",
    color: "#E37400",
    features: ["Traffic source analysis", "Conversion funnels", "Realtime visitors", "Audience demographics", "Page performance", "Campaign attribution"],
    requiredScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    docsUrl: "https://developers.google.com/analytics/devguides/reporting",
  },
  {
    provider: "google_sheets",
    name: "Google Sheets",
    description: "Import and export data from spreadsheets for flexible reporting and data pipelines",
    category: "Productivity",
    icon: "Table",
    color: "#0F9D58",
    features: ["Data import/export", "Report generation", "Custom dashboards", "Automated updates", "Formula-driven KPIs"],
    requiredScopes: ["https://www.googleapis.com/auth/spreadsheets"],
    docsUrl: "https://developers.google.com/sheets/api",
  },
  {
    provider: "notion",
    name: "Notion",
    description: "Knowledge base and project data including OKRs, meeting notes, wikis, and team documentation",
    category: "Productivity",
    icon: "BookOpen",
    color: "#000000",
    features: ["OKR tracking", "Meeting notes analysis", "Wiki content search", "Database queries", "Task completion rates"],
    requiredScopes: ["read_content", "read_databases"],
    docsUrl: "https://developers.notion.com/",
  },
  {
    provider: "google_calendar",
    name: "Google Calendar",
    description: "Meeting patterns and time allocation analysis for productivity insights",
    category: "Productivity",
    icon: "Calendar",
    color: "#4285F4",
    features: ["Meeting time analysis", "Focus time tracking", "Meeting frequency", "Calendar conflicts", "Attendance patterns"],
    requiredScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    docsUrl: "https://developers.google.com/calendar/api",
  },
  {
    provider: "airtable",
    name: "Airtable",
    description: "Flexible database and spreadsheet data for CRM, inventory, project tracking, and custom workflows",
    category: "Productivity",
    icon: "Grid3x3",
    color: "#18BFFF",
    features: ["Custom database queries", "Inventory tracking", "Project management", "CRM data", "Workflow automation"],
    requiredScopes: ["data.records:read", "schema.bases:read"],
    docsUrl: "https://airtable.com/developers/web/api",
  },
];

// ── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Mail, Users, Building2, Receipt, TrendingUp,
  Target, CreditCard, KanbanSquare, GitBranch, BarChart3, Table,
  BookOpen, Zap, CheckSquare, Calendar, MessagesSquare, Grid3x3,
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Communication: MessageSquare,
  HR: Users,
  Finance: Receipt,
  CRM: TrendingUp,
  Payments: CreditCard,
  "Project Management": KanbanSquare,
  Analytics: BarChart3,
  Productivity: Table,
};

// ── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = "connected" | "not_connected" | "syncing" | "error";

interface ConnectedIntegration {
  provider: string;
  status: ConnectionStatus;
  lastSyncAt?: string;
  error?: string;
  syncedRecords?: number;
}

interface IntegrationsPanelProps {
  orgId: string;
  onBack?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const configs: Record<ConnectionStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
    connected:     { label: "Connected",     dot: "bg-emerald-500",                    text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    not_connected: { label: "Not Connected", dot: "bg-zinc-300",                       text: "text-zinc-500",    bg: "bg-zinc-50",    border: "border-zinc-200" },
    syncing:       { label: "Syncing",       dot: "bg-blue-500 animate-pulse",         text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
    error:         { label: "Error",         dot: "bg-red-500",                        text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  };
  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── AI Recommendations ───────────────────────────────────────────────────────

const AI_RECOMMENDATIONS: Record<string, { provider: string; reason: string }[]> = {
  default: [
    { provider: "quickbooks", reason: "Financial data enables cash flow forecasting, margin analysis, and revenue intelligence across 50+ financial reports." },
    { provider: "slack", reason: "Communication analytics reveal team bottlenecks, engagement patterns, and organizational health signals." },
    { provider: "stripe", reason: "Payment data powers subscription health monitoring, churn prediction, and revenue cohort analysis." },
  ],
};

// ── Main Component ───────────────────────────────────────────────────────────

export function IntegrationsPanel({ orgId, onBack }: IntegrationsPanelProps) {
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/list?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.integrations ?? []);
      }
    } catch {
      // Silently handle - will show empty state
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const getStatus = (provider: string): ConnectionStatus => {
    const conn = connected.find(c => c.provider === provider);
    return conn?.status ?? "not_connected";
  };

  const getConnection = (provider: string): ConnectedIntegration | undefined => {
    return connected.find(c => c.provider === provider);
  };

  const handleConnect = async (provider: string) => {
    setActionLoading(provider);
    setError(null);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, provider }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        await fetchConnections();
      } else {
        const err = await res.json().catch(() => ({ error: "Connection failed" }));
        setError(err.error ?? "Failed to connect");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async (provider: string) => {
    setActionLoading(provider);
    setError(null);
    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, provider }),
      });
      if (res.ok) {
        // Update status to syncing locally
        setConnected(prev =>
          prev.map(c => c.provider === provider ? { ...c, status: "syncing" as ConnectionStatus } : c)
        );
        // Poll for completion after a delay
        setTimeout(() => fetchConnections(), 3000);
      } else {
        setError("Sync failed. Please try again.");
      }
    } catch {
      setError("Network error during sync.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm("Are you sure you want to disconnect this integration? Historical data will be preserved.")) return;
    setActionLoading(provider);
    setError(null);
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, provider }),
      });
      if (res.ok) {
        await fetchConnections();
      } else {
        setError("Failed to disconnect. Please try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpanded = (provider: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  // Group providers by category
  const categories = PROVIDER_CAPABILITIES.reduce<Record<string, ProviderCapability[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const connectedCount = connected.filter(c => c.status === "connected" || c.status === "syncing").length;
  const totalCount = PROVIDER_CAPABILITIES.length;
  const lastSyncTime = connected
    .filter(c => c.lastSyncAt)
    .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0]?.lastSyncAt;

  const recommendations = AI_RECOMMENDATIONS.default.filter(
    r => getStatus(r.provider) === "not_connected"
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">Integrations</h1>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-0.5">
                Connect your tools for live analytics
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchConnections()}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-widest hover:bg-zinc-50 transition-all active:scale-95 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Sync Status Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/10">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-light tabular-nums">{connectedCount}</span>
                  <span className="text-zinc-400 text-sm">of {totalCount} integrations connected</span>
                </div>
                {lastSyncTime && (
                  <p className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last sync: {timeAgo(lastSyncTime)}
                  </p>
                )}
              </div>
            </div>

            {/* Connection progress bar */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(connectedCount / totalCount) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                {Math.round((connectedCount / totalCount) * 100)}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center gap-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600 text-xs font-mono uppercase"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading && connected.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        )}

        {/* Integration Categories */}
        {!loading && Object.entries(categories).map(([category, providers], catIdx) => {
          const CategoryIcon = CATEGORY_ICONS[category] ?? Zap;
          return (
            <motion.section
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <CategoryIcon className="w-4 h-4 text-zinc-400" />
                <h2 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] font-bold">
                  {category}
                </h2>
                <div className="flex-1 h-px bg-zinc-200 ml-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((provider, idx) => {
                  const status = getStatus(provider.provider);
                  const conn = getConnection(provider.provider);
                  const isExpanded = expandedCards.has(provider.provider);
                  const isLoading = actionLoading === provider.provider;
                  const ProviderIcon = ICON_MAP[provider.icon] ?? Zap;

                  return (
                    <motion.div
                      key={provider.provider}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: catIdx * 0.05 + idx * 0.03 }}
                      className={`bg-white rounded-2xl border transition-all hover:shadow-md ${
                        status === "connected" ? "border-emerald-200 shadow-sm" :
                        status === "error" ? "border-red-200" :
                        "border-zinc-200"
                      }`}
                    >
                      <div className="p-5">
                        {/* Provider Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: `${provider.color}15` }}
                            >
                              <span style={{ color: provider.color }}>
                                <ProviderIcon className="w-5 h-5" />
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-zinc-900 text-sm">{provider.name}</h3>
                              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed max-w-[280px]">
                                {provider.description}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={status} />
                        </div>

                        {/* Connected state: last sync + actions */}
                        {(status === "connected" || status === "syncing") && conn && (
                          <div className="mt-4 pt-3 border-t border-zinc-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-xs text-zinc-500">
                                {conn.lastSyncAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Last synced: {timeAgo(conn.lastSyncAt)}
                                  </span>
                                )}
                                {conn.syncedRecords != null && (
                                  <span className="font-mono tabular-nums">
                                    {conn.syncedRecords.toLocaleString()} records
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSync(provider.provider)}
                                  disabled={isLoading || status === "syncing"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-600 bg-zinc-50 hover:bg-zinc-100 rounded-lg transition-all disabled:opacity-50 border border-zinc-200"
                                >
                                  {status === "syncing" ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  {status === "syncing" ? "Syncing" : "Sync"}
                                </button>
                                <button
                                  onClick={() => handleDisconnect(provider.provider)}
                                  disabled={isLoading}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50 border border-red-200"
                                >
                                  <Unlink className="w-3 h-3" />
                                  Disconnect
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error state */}
                        {status === "error" && conn?.error && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <div>
                              <p>{conn.error}</p>
                              <button
                                onClick={() => handleConnect(provider.provider)}
                                className="mt-2 text-[10px] font-mono uppercase tracking-wider text-red-800 underline"
                              >
                                Reconnect
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Not connected: connect button */}
                        {status === "not_connected" && (
                          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                            <button
                              onClick={() => handleConnect(provider.provider)}
                              disabled={isLoading}
                              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm active:scale-95 rounded-xl disabled:opacity-50 font-bold"
                            >
                              {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                              Connect
                            </button>
                            <a
                              href={provider.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition-colors"
                            >
                              Docs <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {/* Features (collapsible) */}
                        <div className="mt-3">
                          <button
                            onClick={() => toggleExpanded(provider.provider)}
                            className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-600 uppercase tracking-wider transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {provider.features.length} features
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <ul className="mt-2 space-y-1.5 pl-1">
                                  {provider.features.map((feat, i) => (
                                    <li key={i} className="flex items-center gap-2 text-xs text-zinc-600">
                                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                      {feat}
                                    </li>
                                  ))}
                                </ul>
                                <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
                                  <Shield className="w-3 h-3" />
                                  Requires: {provider.requiredScopes.join(", ")}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          );
        })}

        {/* AI Recommendations */}
        {recommendations.length > 0 && !loading && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-zinc-400" />
              <h2 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] font-bold">
                Recommended for You
              </h2>
              <div className="flex-1 h-px bg-zinc-200 ml-2" />
            </div>

            <div className="space-y-3">
              {recommendations.map(rec => {
                const provider = PROVIDER_CAPABILITIES.find(p => p.provider === rec.provider);
                if (!provider) return null;
                const ProviderIcon = ICON_MAP[provider.icon] ?? Zap;
                const isLoading = actionLoading === rec.provider;

                return (
                  <motion.div
                    key={rec.provider}
                    className="bg-white rounded-2xl border border-zinc-200 p-5 hover:shadow-md transition-all group"
                    whileHover={{ scale: 1.005 }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                        style={{ backgroundColor: `${provider.color}15` }}
                      >
                        <span style={{ color: provider.color }}><ProviderIcon className="w-5 h-5" /></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 text-sm">{provider.name}</h3>
                          <Sparkles className="w-3 h-3 text-amber-500" />
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                          <span className="font-medium text-zinc-700">Why this matters:</span>{" "}
                          {rec.reason}
                        </p>
                      </div>
                      <button
                        onClick={() => handleConnect(rec.provider)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm active:scale-95 rounded-xl disabled:opacity-50 font-bold shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        Connect
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Empty State */}
        {!loading && PROVIDER_CAPABILITIES.length === 0 && (
          <div className="text-center py-20">
            <Link2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-700 mb-2">No Integrations Available</h3>
            <p className="text-sm text-zinc-500">Check back soon for new integration options.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IntegrationsPanel;
