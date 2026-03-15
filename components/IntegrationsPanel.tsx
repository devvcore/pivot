"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2, Unlink, RefreshCw, AlertCircle, Loader2, ArrowLeft,
} from "lucide-react";

// ── Provider Config ──────────────────────────────────────────────────────────

interface ProviderInfo {
  provider: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  color: string;
}

const PROVIDERS: ProviderInfo[] = [
  { provider: "slack",             name: "Slack",            description: "Team communication analytics",              category: "Communication",      logo: "https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png",              color: "#4A154B" },
  { provider: "gmail",             name: "Gmail",            description: "Email patterns and response tracking",      category: "Communication",      logo: "https://cdn.simpleicons.org/gmail",              color: "#EA4335" },
  { provider: "microsoft_teams",   name: "Microsoft Teams",  description: "Enterprise chat and meeting data",          category: "Communication",      logo: "https://statics.teams.cdn.office.net/evergreen-assets/icons/microsoft_teams_logo_refresh_v2025.ico",     color: "#5059C9" },
  { provider: "quickbooks",        name: "QuickBooks",       description: "Invoices, expenses, P&L, cash flow",        category: "Finance",            logo: "https://cdn.simpleicons.org/quickbooks",         color: "#2CA01C" },
  { provider: "stripe",            name: "Stripe",           description: "Revenue, subscriptions, churn, LTV",        category: "Payments",           logo: "https://cdn.simpleicons.org/stripe",             color: "#635BFF" },
  { provider: "salesforce",        name: "Salesforce",       description: "Pipeline, deals, customer health",          category: "CRM",                logo: "https://www.salesforce.com/etc/designs/sfdc-www/en_us/favicon.ico",         color: "#00A1E0" },
  { provider: "hubspot",           name: "HubSpot",          description: "Contacts, deals, campaigns",                category: "CRM",                logo: "https://cdn.simpleicons.org/hubspot",            color: "#FF7A59" },
  { provider: "jira",              name: "Jira",             description: "Sprint velocity, bugs, capacity",           category: "Project Management", logo: "https://cdn.simpleicons.org/jira",               color: "#0052CC" },
  { provider: "github",            name: "GitHub",           description: "Commits, PRs, CI health, code quality",     category: "Project Management", logo: "https://cdn.simpleicons.org/github",             color: "#24292F" },
  { provider: "linear",            name: "Linear",           description: "Issue cycle times, sprint velocity",        category: "Project Management", logo: "https://cdn.simpleicons.org/linear",             color: "#5E6AD2" },
  { provider: "asana",             name: "Asana",            description: "Task completion, workload, timelines",      category: "Project Management", logo: "https://cdn.simpleicons.org/asana",              color: "#F06A6A" },
  { provider: "google_analytics",  name: "Google Analytics", description: "Traffic, conversions, audience data",       category: "Analytics",          logo: "https://cdn.simpleicons.org/googleanalytics",    color: "#E37400" },
  { provider: "google_sheets",     name: "Google Sheets",    description: "Import/export data and KPI tracking",       category: "Productivity",       logo: "https://cdn.simpleicons.org/googlesheets",       color: "#0F9D58" },
  { provider: "notion",            name: "Notion",           description: "OKRs, meeting notes, wiki search",          category: "Productivity",       logo: "https://cdn.simpleicons.org/notion",             color: "#000000" },
  { provider: "google_calendar",   name: "Google Calendar",  description: "Meeting patterns, focus time analysis",     category: "Productivity",       logo: "https://cdn.simpleicons.org/googlecalendar",     color: "#4285F4" },
  { provider: "airtable",          name: "Airtable",         description: "Custom databases and workflow data",        category: "Productivity",       logo: "https://cdn.simpleicons.org/airtable",           color: "#18BFFF" },
  { provider: "adp",               name: "ADP",              description: "Payroll, benefits, workforce data",         category: "HR",                 logo: "https://cdn.simpleicons.org/adp",                color: "#D0271D" },
  { provider: "workday",           name: "Workday",          description: "HR data, compensation, org structure",      category: "HR",                 logo: "https://www.workday.com/favicon.ico",            color: "#F68D2E" },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface ConnectedProvider {
  id: string;
  provider: string;
  status: string;
  lastSyncAt?: string | null;
  connectionMethod?: string;
  metadata?: Record<string, any>;
}

interface IntegrationsPanelProps {
  orgId: string;
  onBack?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function IntegrationsPanel({ orgId, onBack }: IntegrationsPanelProps) {
  const [connectedMap, setConnectedMap] = useState<Record<string, ConnectedProvider>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});

  // Fetch brand logos from OpenBrand API (cached server-side)
  useEffect(() => {
    fetch("/api/brand-logos")
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, string> | null) => {
        if (data && !("error" in data)) setBrandLogos(data);
      })
      .catch(() => {});
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/list?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, ConnectedProvider> = {};
      for (const c of (data.connected ?? [])) {
        map[c.provider] = c;
      }
      setConnectedMap(map);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    setError(null);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, provider }),
      });
      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        // Save view so we return here after OAuth
        try { localStorage.setItem("pivot_returnView", "team"); } catch {}
        window.location.href = data.redirectUrl;
        return;
      }
      if (res.ok && data.connected) {
        await fetchConnections();
      } else {
        setError(data.error ?? "Connection failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (provider: string) => {
    setConnecting(provider);
    try {
      await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, provider }),
      });
      setTimeout(() => fetchConnections(), 2000);
    } catch {
      // silent
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm("Disconnect this integration?")) return;
    setConnecting(provider);
    try {
      await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, provider }),
      });
      await fetchConnections();
    } catch {
      // silent
    } finally {
      setConnecting(null);
    }
  };

  // Group by category
  const categories = PROVIDERS.reduce<Record<string, ProviderInfo[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const connectedCount = Object.values(connectedMap).filter(c => c.status === "connected" || c.status === "syncing").length;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Integrations</h1>
              <p className="text-xs text-zinc-400">{connectedCount} connected</p>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchConnections(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        )}

        {/* Loading */}
        {loading && Object.keys(connectedMap).length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        )}

        {/* Categories */}
        {!loading && Object.entries(categories).map(([category, providers]) => (
          <div key={category}>
            <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {providers.map(p => {
                const conn = connectedMap[p.provider];
                const isConnected = conn && (conn.status === "connected" || conn.status === "syncing");
                const isLoading = connecting === p.provider;

                return (
                  <div
                    key={p.provider}
                    className={`bg-white rounded-xl border p-4 transition-all ${
                      isConnected ? "border-emerald-300 ring-1 ring-emerald-100" : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {/* Top row: logo + name + status dot */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-50 overflow-hidden">
                        <img src={brandLogos[p.provider] || p.logo} alt={p.name} className="w-5 h-5 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-zinc-900">{p.name}</span>
                          {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">{p.description}</p>
                      </div>
                    </div>

                    {/* Connected: sync info + actions */}
                    {isConnected ? (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                        <span className="text-[11px] text-zinc-400">
                          {conn.lastSyncAt ? `Synced ${timeAgo(conn.lastSyncAt)}` : "Never synced"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSync(p.provider)}
                            disabled={isLoading}
                            className="px-2.5 py-1 text-[10px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleDisconnect(p.provider)}
                            disabled={isLoading}
                            className="px-2.5 py-1 text-[10px] font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Unlink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Not connected: Connect button */
                      <button
                        onClick={() => handleConnect(p.provider)}
                        disabled={isLoading}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors active:scale-[0.98] disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntegrationsPanel;
