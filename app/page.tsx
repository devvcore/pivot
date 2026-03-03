"use client";

import { useState, useEffect } from "react";
import { AuthView } from "@/components/AuthView";
import { DashboardView } from "@/components/DashboardView";
import { UploadView } from "@/components/UploadView";
import { ProcessingView } from "@/components/ProcessingView";
import { ResultsView } from "@/components/ResultsView";
import { TeamView } from "@/components/TeamView";
import { motion, AnimatePresence } from "motion/react";
import { Building2 } from "lucide-react";

const RUN_ID_KEY = "pivot_runId";

type AppView = "dashboard" | "upload" | "processing" | "results" | "team";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RUN_ID_KEY);
      if (stored) setRunId(stored);

      const storedUser = localStorage.getItem("pivot_user");
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch {
      // ignore
    }
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

  if (!user) {
    return <AuthView onLogin={(u: any) => setUser(u)} />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view + (runId || "") + user.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
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
            onTeam={() => setView("team")}
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
          />
        )}

        <button
          onClick={() => setUser(null)}
          className="fixed bottom-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-zinc-500 hover:text-zinc-900 transition-all border border-zinc-200 shadow-sm z-50 group"
          title="Sign Out"
        >
          <div className="text-[10px] font-mono uppercase tracking-widest px-2 hidden group-hover:block absolute right-12 top-1/2 -translate-y-1/2 bg-white py-1 rounded shadow-sm">Sign Out</div>
          <Building2 className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
