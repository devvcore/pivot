import { useState } from "react";
import { ArrowRight, Building2, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

export function AuthView({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login"
      ? { email, password }
      : { email, password, name, organizationName };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      if (mode === "signup") {
        // Automatically switch to login or log them in directly
        // For simplicity, let's just attempt login immediately
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.error || "Login failed after signup");
        onLogin(loginData);
      } else {
        onLogin(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:flex-none lg:px-24 xl:px-32 relative z-10">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-12"
          >
            <div className="w-10 h-10 bg-zinc-900 flex items-center justify-center rounded-xl shadow-lg shadow-zinc-900/10">
              <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tighter text-zinc-900">Pivot</span>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none mt-0.5">Enterprise OS</div>
            </div>
          </motion.div>

          <div className="space-y-2 mb-10">
            <h2 className="text-3xl font-light tracking-tight text-zinc-900">
              {mode === "login" ? "System Access" : "Network Ingress"}
            </h2>
            <p className="text-sm text-zinc-500">
              {mode === "login"
                ? "Enter credentials to access the internal intelligence layer."
                : "Initialize a new organizational node in the Pivot network."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all"
                      placeholder="Alexander Hamilton"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Company</label>
                    <input
                      type="text"
                      required
                      value={organizationName}
                      onChange={e => setOrganizationName(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all"
                      placeholder="Acme Strategic Corp"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all font-medium"
                placeholder="executive@pivot.ai"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Security Key</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center items-center gap-2 rounded-xl bg-zinc-900 py-3 px-4 text-sm font-bold text-white shadow-xl shadow-zinc-900/10 hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  {mode === "login" ? "Authorize Access" : "Initialize Node"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-xs text-zinc-400 hover:text-zinc-900 transition-colors uppercase font-mono tracking-widest"
            >
              {mode === "login" ? "Request Node Ingress" : "Back to Security Gates"}
            </button>
          </div>
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block bg-zinc-950 overflow-hidden">
        {/* Abstract Background Design */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-zinc-700 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-zinc-800 rounded-full blur-[100px]" />
        </div>

        <div className="absolute inset-0 h-full w-full flex flex-col items-center justify-center p-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <ShieldCheck className="w-20 h-20 text-zinc-800 mb-10 mx-auto" strokeWidth={1} />
            <h2 className="text-5xl font-light text-white tracking-tighter mb-6 leading-[1.1]">
              The Operating System for<br /><span className="italic font-normal">Autonomous Growth</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-lg leading-relaxed mx-auto font-light">
              Pivot replaces fragmented advisory infrastructure with a single, continuously learning system that ingests, plans, and executes.
            </p>
          </motion.div>

          <div className="mt-20 grid grid-cols-2 gap-x-12 gap-y-8 text-left max-w-sm">
            <div>
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Architecture</div>
              <div className="text-sm text-zinc-300">Phase Ingest → Plan</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Status</div>
              <div className="text-sm text-zinc-300">v2.0 Beta Live</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
