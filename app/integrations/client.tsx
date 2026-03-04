"use client";

import { useState, useEffect } from "react";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { Loader2 } from "lucide-react";

interface IntegrationPageClientProps {
  initialOrgId: string;
}

export function IntegrationPageClient({ initialOrgId }: IntegrationPageClientProps) {
  const [orgId, setOrgId] = useState(initialOrgId);
  const [loading, setLoading] = useState(!initialOrgId);

  useEffect(() => {
    if (orgId) return;

    // Try to get orgId from the session API
    fetch("/api/auth/session")
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("No session");
      })
      .then(data => {
        if (data.user?.organizationId) {
          setOrgId(data.user.organizationId);
        }
      })
      .catch(() => {
        // Try localStorage fallback
        try {
          const stored = localStorage.getItem("pivot_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.organizationId) {
              setOrgId(parsed.organizationId);
            }
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-700 mb-2">Sign in Required</h2>
          <p className="text-sm text-zinc-500 mb-4">Please sign in to manage your integrations.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10 active:scale-95 rounded-xl font-bold"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <IntegrationsPanel
      orgId={orgId}
      onBack={() => window.history.back()}
    />
  );
}
