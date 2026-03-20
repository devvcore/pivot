"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  suggested_action?: string;
  source_provider?: string;
  read: boolean;
  created_at: string;
}

interface AlertsResponse {
  alerts: AlertItem[];
  total: number;
  unreadCount: number;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function SeverityIcon({ severity }: { severity: AlertItem["severity"] }) {
  switch (severity) {
    case "critical":
      return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case "info":
      return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
  }
}

function severityBorder(severity: AlertItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-l-red-500";
    case "warning":
      return "border-l-amber-500";
    case "info":
      return "border-l-blue-500";
  }
}

export function NotificationBell() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch("/api/alerts?limit=20");
      if (!res.ok) return;
      const data: AlertsResponse = await res.json();
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail on network errors
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAlerts]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const markAsRead = async (alertId: string) => {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await authFetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds: [alertId] }),
      });
    } catch {
      // Revert on failure
      fetchAlerts();
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    // Optimistic update
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);

    try {
      await authFetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch {
      fetchAlerts();
    } finally {
      setLoading(false);
    }
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors"
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell
          className={`w-5 h-5 ${hasUnread ? "text-zinc-900" : "text-zinc-400"}`}
        />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute top-full left-0 mt-2 w-80 max-h-[420px] bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden z-[100] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span className="text-sm font-semibold text-zinc-900">
              Notifications
            </span>
            {hasUnread && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Alert list */}
          <div className="flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-400">
                No notifications yet
              </div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => {
                    if (!alert.read) markAsRead(alert.id);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-50 border-l-2 transition-colors ${
                    severityBorder(alert.severity)
                  } ${
                    alert.read
                      ? "bg-white"
                      : "bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      <SeverityIcon severity={alert.severity} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[13px] leading-tight truncate ${
                            alert.read
                              ? "text-zinc-500 font-normal"
                              : "text-zinc-900 font-medium"
                          }`}
                        >
                          {alert.title}
                        </span>
                        <span className="text-[11px] text-zinc-400 whitespace-nowrap shrink-0">
                          {timeAgo(alert.created_at)}
                        </span>
                      </div>
                      {alert.suggested_action && (
                        <p className="text-[12px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                          {alert.suggested_action}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
