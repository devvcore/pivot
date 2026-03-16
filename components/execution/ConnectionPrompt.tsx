"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  CheckCircle2,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";

/* ── Types ── */

interface ServiceConnection {
  id: string;
  name: string;
  provider: string;
  icon: string; // SVG path or lucide icon
  color: string;
  connected: boolean;
  description: string;
}

const SERVICES: ServiceConnection[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    provider: "linkedin",
    icon: "linkedin",
    color: "#0A66C2",
    connected: false,
    description: "Post updates, share articles, manage your professional presence",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    provider: "twitter",
    icon: "twitter",
    color: "#000000",
    connected: false,
    description: "Post tweets, engage with followers, share updates",
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    icon: "github",
    color: "#333333",
    connected: false,
    description: "Create issues, PRs, manage repos, code review",
  },
  {
    id: "gmail",
    name: "Gmail",
    provider: "gmail",
    icon: "gmail",
    color: "#EA4335",
    connected: false,
    description: "Send and manage emails on your behalf",
  },
  {
    id: "slack",
    name: "Slack",
    provider: "slack",
    icon: "slack",
    color: "#4A154B",
    connected: false,
    description: "Send messages, manage channels, notifications",
  },
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    icon: "notion",
    color: "#000000",
    connected: false,
    description: "Search and manage your Notion workspace",
  },
  {
    id: "jira",
    name: "Jira",
    provider: "jira",
    icon: "jira",
    color: "#0052CC",
    connected: false,
    description: "Create tickets, manage sprints, track issues",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    provider: "google_sheets",
    icon: "sheets",
    color: "#0F9D58",
    connected: false,
    description: "Read and write spreadsheet data",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    provider: "google_calendar",
    icon: "calendar",
    color: "#4285F4",
    connected: false,
    description: "View and manage calendar events",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    provider: "hubspot",
    icon: "hubspot",
    color: "#FF7A59",
    connected: false,
    description: "Manage contacts, deals, and CRM data",
  },
];

/* ── Service Icon Component ── */

function ServiceIcon({ service, size = 24 }: { service: ServiceConnection; size?: number }) {
  const iconMap: Record<string, React.ReactNode> = {
    linkedin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    twitter: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    github: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    gmail: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
      </svg>
    ),
    slack: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
      </svg>
    ),
    notion: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.28 2.25c-.42-.326-.98-.7-2.055-.607L3.34 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.746 0-.933-.234-1.493-.933l-4.574-7.186v6.953l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.094-.42.14-1.026.793-1.073l3.454-.234 4.76 7.28V9.34l-1.214-.14c-.093-.514.28-.886.747-.933z" />
      </svg>
    ),
    jira: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.575 24V12.518a1.005 1.005 0 00-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 005.215 5.214h2.129v2.058a5.218 5.218 0 005.215 5.214V6.758a1.001 1.001 0 00-1.001-1.001zM23 .006H11.455a5.215 5.215 0 005.215 5.215h2.129v2.057A5.215 5.215 0 0024 12.483V1.005A.998.998 0 0023 .006z" />
      </svg>
    ),
    sheets: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.318 12.545H7.91v-1.909h3.41v1.909zM14.728 0v6h6l-6-6zM16.091 12.545h-3.41v1.909h3.41v-1.909zM7.91 14.455h3.41v1.909H7.91v-1.909zM16.091 14.455h-3.41v1.909h3.41v-1.909zM14.182 6.545V0H3.727v24h16.91V6.545h-6.455zM17.455 17.727H6.545v-8.727h10.909v8.727zM16.091 10.636h-3.41v1.909h3.41v-1.909zM7.91 10.636v1.909h3.41v-1.909H7.91z" />
      </svg>
    ),
    calendar: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
      </svg>
    ),
    hubspot: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.235.838h-.066a2.198 2.198 0 00-2.196 2.196v.066c0 .907.55 1.684 1.335 2.02v2.81a6.27 6.27 0 00-2.792 1.266l-7.453-5.794a2.465 2.465 0 00.076-.6A2.476 2.476 0 003.663.326h-.001a2.476 2.476 0 000 4.953c.487 0 .939-.144 1.32-.39l7.333 5.7a6.293 6.293 0 00-.16 7.415l-2.2 2.2a2.053 2.053 0 00-.597-.098 2.078 2.078 0 102.078 2.078c0-.206-.04-.402-.097-.589l2.168-2.168a6.29 6.29 0 009.16-5.556 6.291 6.291 0 00-5.503-6.24z" />
      </svg>
    ),
  };

  return (
    <span style={{ color: service.color }}>
      {iconMap[service.icon] ?? <Link2 size={size} />}
    </span>
  );
}

/* ── Main Component ── */

export interface ConnectionPromptProps {
  orgId: string;
  /** If provided, only show these services */
  filterServices?: string[];
  /** Compact mode for inline chat display */
  compact?: boolean;
  onConnectionChange?: () => void;
}

export default function ConnectionPrompt({
  orgId,
  filterServices,
  compact = false,
  onConnectionChange,
}: ConnectionPromptProps) {
  const [services, setServices] = useState<ServiceConnection[]>(
    filterServices
      ? SERVICES.filter((s) => filterServices.includes(s.provider))
      : SERVICES
  );
  const [connecting, setConnecting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  // Check which services are connected
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/list?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const connectedProviders = new Set(
        (data.integrations ?? [])
          .filter((i: { status: string }) => i.status === "connected")
          .map((i: { provider: string }) => i.provider)
      );

      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          connected: connectedProviders.has(s.provider),
        }))
      );
    } catch {
      // Silent fail
    }
  }, [orgId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Listen for OAuth callback redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "connected") {
      fetchConnections();
      onConnectionChange?.();
    }
  }, [fetchConnections, onConnectionChange]);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, orgId }),
      });

      const data = await res.json();

      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "width=600,height=700");
        // Poll for connection status
        const interval = setInterval(async () => {
          await fetchConnections();
          const connected = services.find(
            (s) => s.provider === provider
          )?.connected;
          if (connected) {
            clearInterval(interval);
            setConnecting(null);
            onConnectionChange?.();
          }
        }, 3000);
        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(interval);
          setConnecting(null);
        }, 120000);
      } else if (data.connected) {
        await fetchConnections();
        setConnecting(null);
        onConnectionChange?.();
      } else {
        console.error("Connection failed:", data.error);
        setConnecting(null);
      }
    } catch (err) {
      console.error("Connection error:", err);
      setConnecting(null);
    }
  };

  const connectedCount = services.filter((s) => s.connected).length;

  // Single-service inline mode — fits inside chat bubbles
  if (filterServices?.length === 1 && compact) {
    const service = services[0];
    if (!service) return null;
    if (service.connected) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 size={14} />
          <span>{service.name} connected</span>
        </div>
      );
    }
    return (
      <button
        onClick={() => handleConnect(service.provider)}
        disabled={connecting === service.provider}
        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-all active:scale-95"
      >
        {connecting === service.provider ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ServiceIcon service={service} size={16} />
        )}
        <span>
          {connecting === service.provider
            ? "Connecting..."
            : `Connect ${service.name}`}
        </span>
        {connecting !== service.provider && <ExternalLink size={10} />}
      </button>
    );
  }

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900/50 border border-zinc-800 rounded-lg transition-colors"
      >
        <Link2 size={14} />
        <span>
          {connectedCount}/{services.length} connected
        </span>
      </button>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">
            Connect Services
          </h3>
          <span className="text-xs text-zinc-500">
            {connectedCount}/{services.length}
          </span>
        </div>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-zinc-500 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Service Grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => !service.connected && handleConnect(service.provider)}
            disabled={service.connected || connecting === service.provider}
            className={`
              group relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all
              ${
                service.connected
                  ? "border-emerald-500/30 bg-emerald-500/5 cursor-default"
                  : connecting === service.provider
                  ? "border-blue-500/30 bg-blue-500/5 cursor-wait"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900 cursor-pointer"
              }
            `}
            title={service.description}
          >
            {/* Status indicator */}
            {service.connected && (
              <div className="absolute top-1.5 right-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" />
              </div>
            )}

            {/* Icon */}
            <div className="relative">
              {connecting === service.provider ? (
                <Loader2
                  size={24}
                  className="animate-spin text-blue-400"
                />
              ) : (
                <ServiceIcon service={service} size={24} />
              )}
            </div>

            {/* Name */}
            <span
              className={`text-xs font-medium ${
                service.connected
                  ? "text-emerald-400"
                  : "text-zinc-400 group-hover:text-white"
              }`}
            >
              {service.name}
            </span>

            {/* Connect hint */}
            {!service.connected && connecting !== service.provider && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 text-xs text-white font-medium">
                  Connect <ExternalLink size={10} />
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Helper text */}
      <div className="px-4 pb-3">
        <p className="text-xs text-zinc-600">
          Connect services so your agents can take real actions — post to
          social media, send emails, create issues, and more.
        </p>
      </div>
    </div>
  );
}
