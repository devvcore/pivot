"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, Mail, Users, Building2, Receipt, TrendingUp,
  Target, CreditCard, KanbanSquare, Link2, Unlink, RefreshCw,
  Check, AlertCircle, Clock, Loader2, ChevronRight, ChevronDown,
  Zap, Shield, ExternalLink, Sparkles, ArrowLeft,
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
    description: "Team communication, channel analytics, and response time tracking",
    category: "Communication",
    icon: "MessageSquare",
    color: "#4A154B",
    features: ["Channel activity monitoring", "Response time analytics", "Engagement scoring", "Bottleneck detection", "Sentiment analysis"],
    requiredScopes: ["channels:read", "users:read", "chat:read"],
    docsUrl: "https://api.slack.com/docs",
  },
  {
    provider: "gmail",
    name: "Gmail",
    description: "Email communication patterns, response times, and relationship mapping",
    category: "Communication",
    icon: "Mail",
    color: "#EA4335",
    features: ["Email volume tracking", "Response time analysis", "Communication network mapping", "Thread analytics", "Sentiment detection"],
    requiredScopes: ["gmail.readonly", "gmail.metadata"],
    docsUrl: "https://developers.google.com/gmail/api",
  },
  {
    provider: "gusto",
    name: "Gusto",
    description: "Payroll, benefits, and HR data for workforce analytics",
    category: "HR",
    icon: "Users",
    color: "#0A8080",
    features: ["Employee directory sync", "Payroll cost analysis", "Benefits utilization", "Headcount tracking", "Compensation benchmarking"],
    requiredScopes: ["employees:read", "payrolls:read", "benefits:read"],
    docsUrl: "https://docs.gusto.com/",
  },
  {
    provider: "adp",
    name: "ADP",
    description: "Enterprise HR, payroll processing, and workforce management",
    category: "HR",
    icon: "Building2",
    color: "#D0271D",
    features: ["Payroll analytics", "Workforce demographics", "Time & attendance", "Benefits administration", "Compliance tracking"],
    requiredScopes: ["workers", "payroll", "benefits"],
    docsUrl: "https://developers.adp.com/",
  },
  {
    provider: "quickbooks",
    name: "QuickBooks",
    description: "Accounting, invoicing, and financial reporting",
    category: "Finance",
    icon: "Receipt",
    color: "#2CA01C",
    features: ["Revenue tracking", "Expense categorization", "Invoice analytics", "Cash flow monitoring", "P&L reporting"],
    requiredScopes: ["com.intuit.quickbooks.accounting"],
    docsUrl: "https://developer.intuit.com/",
  },
  {
    provider: "xero",
    name: "Xero",
    description: "Cloud accounting, bank reconciliation, and financial insights",
    category: "Finance",
    icon: "Receipt",
    color: "#13B5EA",
    features: ["Bank feed analysis", "Aged receivables tracking", "Budget vs actuals", "Multi-currency support", "Tax reporting"],
    requiredScopes: ["accounting.transactions.read", "accounting.contacts.read"],
    docsUrl: "https://developer.xero.com/",
  },
  {
    provider: "salesforce",
    name: "Salesforce",
    description: "CRM pipeline, deal analytics, and customer relationship tracking",
    category: "CRM",
    icon: "TrendingUp",
    color: "#00A1E0",
    features: ["Pipeline health monitoring", "Deal velocity tracking", "Win/loss analysis", "Account health scoring", "Forecast accuracy"],
    requiredScopes: ["api", "refresh_token"],
    docsUrl: "https://developer.salesforce.com/",
  },
  {
    provider: "hubspot",
    name: "HubSpot",
    description: "Inbound marketing, sales CRM, and customer engagement",
    category: "CRM",
    icon: "Target",
    color: "#FF7A59",
    features: ["Lead scoring analytics", "Marketing attribution", "Deal pipeline analysis", "Email engagement tracking", "Contact intelligence"],
    requiredScopes: ["crm.objects.contacts.read", "crm.objects.deals.read"],
    docsUrl: "https://developers.hubspot.com/",
  },
  {
    provider: "stripe",
    name: "Stripe",
    description: "Payment processing, subscription management, and revenue analytics",
    category: "Payments",
    icon: "CreditCard",
    color: "#635BFF",
    features: ["MRR/ARR tracking", "Churn rate analysis", "Payment failure monitoring", "Subscription cohort analysis", "Revenue recognition"],
    requiredScopes: ["read_only"],
    docsUrl: "https://stripe.com/docs/api",
  },
  {
    provider: "jira",
    name: "Jira",
    description: "Project tracking, sprint analytics, and engineering velocity",
    category: "Project Management",
    icon: "KanbanSquare",
    color: "#0052CC",
    features: ["Sprint velocity tracking", "Bug trend analysis", "Cycle time metrics", "Backlog health scoring", "Team workload balancing"],
    requiredScopes: ["read:jira-work", "read:jira-user"],
    docsUrl: "https://developer.atlassian.com/cloud/jira/",
  },
];

// ── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Mail, Users, Building2, Receipt, TrendingUp,
  Target, CreditCard, KanbanSquare,
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Communication: MessageSquare,
  HR: Users,
  Finance: Receipt,
  CRM: TrendingUp,
  Payments: CreditCard,
  "Project Management": KanbanSquare,
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
