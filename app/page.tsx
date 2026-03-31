"use client";

import { useState, useEffect } from "react";
import { AuthView } from "@/components/AuthView";
import { DashboardView } from "@/components/DashboardView";
import { UploadView } from "@/components/UploadView";
import { ProcessingView } from "@/components/ProcessingView";
import { ResultsView } from "@/components/ResultsView";
import { TeamView } from "@/components/TeamView";
import { ExecutionDashboard } from "@/components/execution";
import { EmployeeDashboard } from "@/components/EmployeeDashboard";
import { LeanDashboard } from "@/components/LeanDashboard";
import MissionControl from "@/components/MissionControl";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { CRMDashboard } from "@/components/CRMDashboard";
import { PMBoard } from "@/components/PMBoard";
import { AppShell } from "@/components/AppShell";
import { motion, AnimatePresence } from "motion/react";
import PivvyFloatingChat from "@/components/PivvyFloatingChat";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { createClient } from "@/lib/supabase/client";

const RUN_ID_KEY = "pivot_runId";

type AppView = "dashboard" | "upload" | "processing" | "results" | "team" | "execution" | "employees" | "lean" | "mission-control" | "integrations" | "crm" | "pm";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  organizationId: string;
  organizationName?: string;
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [runId, setRunId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Hydrate from localStorage + verify Supabase session on mount
  useEffect(() => {
    // Restore state from localStorage (instant, no flicker)
    try {
      const storedUser = localStorage.getItem("pivot_user");
      if (storedUser) setUser(JSON.parse(storedUser));

      const storedRunId = localStorage.getItem(RUN_ID_KEY);
      if (storedRunId) setRunId(storedRunId);

      const returnView = localStorage.getItem("pivot_returnView");
      if (returnView) {
        localStorage.removeItem("pivot_returnView");
        setView(returnView as AppView);
      }

      // Clean integration callback params from URL
      if (window.location.search.includes("integration=")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {}
    setHydrated(true);

    // Verify session with Supabase
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) {
        setUser(null);
        localStorage.removeItem("pivot_user");
        return;
      }
      const { data: profile } = await sb
        .from("profiles")
        .select("name, first_name, last_name, username, organization_id")
        .eq("id", authUser.id)
        .single();

      let organizationName = "";
      if (profile?.organization_id) {
        const { data: org } = await sb
          .from("organizations")
          .select("name")
          .eq("id", profile.organization_id)
          .single();
        organizationName = org?.name ?? "";
      }

      const fullName = authUser.user_metadata?.name ?? profile?.name ?? "";
      const u: UserProfile = {
        id: authUser.id,
        email: authUser.email ?? "",
        name: fullName,
        firstName: profile?.first_name ?? authUser.user_metadata?.firstName ?? fullName.split(" ")[0] ?? "",
        lastName: profile?.last_name ?? authUser.user_metadata?.lastName ?? fullName.split(" ").slice(1).join(" ") ?? "",
        username: profile?.username ?? authUser.user_metadata?.username ?? "",
        organizationId: profile?.organization_id ?? "",
        organizationName,
      };
      setUser(u);
      localStorage.setItem("pivot_user", JSON.stringify(u));
    }).catch(() => {
      setUser(null);
      localStorage.removeItem("pivot_user");
    }).finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    try {
      if (runId) localStorage.setItem(RUN_ID_KEY, runId);
      else localStorage.removeItem(RUN_ID_KEY);
    } catch {
      // ignore
    }
  }, [runId]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("pivot_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("pivot_user");
    }
  }, [user]);

  // Check if onboarding wizard should show
  useEffect(() => {
    if (!user || !sessionChecked) return;
    try {
      if (localStorage.getItem("pivot_onboarded")) return;
    } catch {
      return;
    }
    // Check if user has any completed analyses
    fetch("/api/job/list")
      .then((res) => res.ok ? res.json() : [])
      .then((jobs: any[]) => {
        if (!Array.isArray(jobs) || jobs.length === 0) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, [user, sessionChecked]);

  // Fetch org logo when user is available
  useEffect(() => {
    if (!user?.organizationId) return;
    fetch(`/api/org-logo?orgId=${encodeURIComponent(user.organizationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.logoUrl) setOrgLogoUrl(data.logoUrl); })
      .catch(() => {});
  }, [user?.organizationId]);

  useEffect(() => {
    if (!runId || view !== "upload") return;
    fetch(`/api/job?runId=${encodeURIComponent(runId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((job) => {
        if (!job) return;
        if (job.status === "completed" || job.status === "failed") {
          setView("results");
        } else {
          setView("processing");
        }
      })
      .catch(() => setView("processing"));
  }, [runId, view]);

  const handleLogout = async () => {
    try {
      const sb = createClient();
      await sb.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    localStorage.removeItem("pivot_user");
  };

  // Before hydration, render empty shell (must match server output to avoid hydration mismatch)
  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  // After hydration but before session check completes, show spinner if no cached user
  if (!user && !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView onLogin={(u: any) => setUser(u)} />;
  }

  return (
    <AppShell
      currentView={view}
      onNavigate={(v) => {
        // If navigating to Analysis with no report selected, go to dashboard instead
        if (v === "results" && !runId) {
          setView("dashboard");
          return;
        }
        setView(v);
      }}
      onLogout={handleLogout}
      orgName={user?.organizationName || "Pivot"}
      orgLogoUrl={orgLogoUrl}
    >
      {showOnboarding && user && (
        <OnboardingWizard
          orgId={user.organizationId}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={view + (runId || "") + user.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="min-h-screen"
        >
          {view === "dashboard" && (
            <DashboardView
              onStartNew={() => {
                setRunId(null);
                setView("upload");
              }}
              onViewRun={(id: string) => {
                setRunId(id);
                setView("results");
              }}
              userName={user?.name}
              username={user?.username}
              orgLogoUrl={orgLogoUrl}
              orgId={user?.organizationId}
            />
          )}

          {view === "team" && user && (
            <TeamView
              orgId={user.organizationId}
              onBack={() => setView("dashboard")}
            />
          )}

          {view === "upload" && (
            <UploadView
              onBack={() => setView("dashboard")}
              onUploadComplete={(id: string) => {
                setRunId(id);
                setView("processing");
              }}
              orgId={user?.organizationId}
            />
          )}

          {view === "processing" && runId && (
            <ProcessingView
              runId={runId}
              onComplete={() => setView("results")}
              onError={() => { }}
            />
          )}

          {view === "results" && runId && (
            <ResultsView
              runId={runId}
              onBack={() => setView("dashboard")}
              onNewRun={() => {
                setRunId(null);
                setView("upload");
              }}
              onReprocess={() => setView("processing")}
              onExecute={() => setView("execution")}
            />
          )}


          {view === "execution" && user && (
            <ExecutionDashboard
              orgName="Pivot"
              runId={runId ?? ""}
              orgId={user.organizationId}
              onSwitchToAnalysis={() => setView("results")}
            />
          )}

          {view === "employees" && user && (
            <EmployeeDashboard
              orgId={user.organizationId}
              onBack={() => setView("dashboard")}
            />
          )}

          {view === "lean" && user && (
            <LeanDashboard
              orgId={user.organizationId}
              onBack={() => setView("dashboard")}
            />
          )}

          {view === "mission-control" && (
            <MissionControl
              orgId={user?.organizationId ?? ""}
              onBack={() => setView("dashboard")}
            />
          )}

          {view === "integrations" && user && (
            <IntegrationsPanel
              orgId={user.organizationId}
              onBack={() => setView("dashboard")}
            />
          )}

          {view === "crm" && user && (
            <CRMDashboard
              orgId={user.organizationId}
              onBack={() => setView("dashboard")}
              onExecute={() => setView("execution")}
            />
          )}

          {view === "pm" && user && (
            <PMBoard
              orgId={user.organizationId}
              onBack={() => setView("dashboard")}
            />
          )}

          {/* Floating Pivvy Chat — available on every page */}
          <PivvyFloatingChat orgId={user?.organizationId ?? ""} onNavigate={(section) => { setView("results"); }} />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
