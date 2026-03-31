"use client";

import { useState, useRef, useEffect } from "react";
import {
  Home,
  BarChart3,
  Bot,
  Users,
  ClipboardList,
  UserCheck,
  Plug,
  Cpu,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

type AppView =
  | "dashboard"
  | "upload"
  | "processing"
  | "results"
  | "team"
  | "execution"
  | "employees"
  | "lean"
  | "mission-control"
  | "integrations"
  | "crm"
  | "pm";

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "results", label: "Analysis", icon: BarChart3 },
  { id: "execution", label: "Agents", icon: Bot },
  { id: "crm", label: "CRM", icon: Users },
  { id: "pm", label: "Projects", icon: ClipboardList },
  { id: "employees", label: "Team", icon: UserCheck },
  { id: "integrations", label: "Integrations", icon: Plug },
];

interface AppShellProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  orgName?: string;
  orgLogoUrl?: string | null;
  children: React.ReactNode;
}

export function AppShell({
  currentView,
  onNavigate,
  onLogout,
  orgName,
  orgLogoUrl,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [currentView]);

  // Close mobile sidebar on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  const isActive = (id: AppView) => {
    if (id === "results" && (currentView === "results" || currentView === "upload" || currentView === "processing")) return true;
    if (id === "employees" && (currentView === "employees" || currentView === "team" || currentView === "lean")) return true;
    return currentView === id;
  };

  const collapsed = !hovered && !mobileOpen;

  return (
    <div className="min-h-screen flex bg-[#FAFAF9]">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white border border-zinc-200 rounded-lg shadow-sm"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-zinc-600" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          "fixed top-0 left-0 h-full z-50 flex flex-col bg-white border-r border-stone-200",
          "transition-all duration-150 ease-in-out",
          // Desktop: 64px collapsed, 240px expanded on hover
          collapsed ? "w-16" : "w-60",
          // Mobile: slide in/out
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {/* Logo area */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-stone-100 shrink-0 overflow-hidden">
          {orgLogoUrl ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-zinc-200 flex items-center justify-center shrink-0">
              <img src={orgLogoUrl} alt="" className="w-5 h-5 object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center rounded-lg shrink-0">
              <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sm text-zinc-900 truncate leading-none">
                {orgName || "Pivot"}
              </div>
              <div className="pivot-label mt-0.5">
                Intelligence
              </div>
            </div>
          )}
          {!collapsed && (
            <div className="ml-auto">
              <NotificationBell />
            </div>
          )}
          {/* Mobile close */}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={[
                  "w-full flex items-center gap-3 rounded-lg transition-all duration-150 relative group",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-teal-50/40 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700",
                ].join(" ")}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-600 rounded-r-full" />
                )}
                <Icon
                  className={[
                    "w-5 h-5 shrink-0",
                    active ? "text-teal-600" : "text-zinc-400 group-hover:text-zinc-600",
                  ].join(" ")}
                />
                {!collapsed && (
                  <span
                    className={[
                      "text-[13px] font-medium truncate",
                      active ? "text-zinc-900" : "text-zinc-600",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                )}
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 hidden md:block">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-stone-100 py-3 px-2 shrink-0">
          <div className={[
            "flex items-center rounded-lg",
            collapsed ? "justify-center gap-0" : "px-3 py-2.5 gap-3",
          ].join(" ")}>
            <button
              onClick={onLogout}
              title={collapsed ? "Sign out" : undefined}
              className="flex items-center gap-3 text-zinc-500 hover:text-zinc-700 transition-colors group relative"
            >
              <LogOut className="w-5 h-5 shrink-0 text-zinc-400 group-hover:text-zinc-600" />
              {!collapsed && (
                <span className="text-[13px] font-medium text-zinc-600">Sign out</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 hidden md:block">
                  Sign out
                </div>
              )}
            </button>
            {!collapsed && (
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content — offset by sidebar width */}
      <div
        className={[
          "flex-1 min-h-screen transition-all duration-150",
          "pt-14 md:pt-0", // top padding for mobile hamburger button
          "md:ml-16", // always offset by collapsed width on desktop
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
