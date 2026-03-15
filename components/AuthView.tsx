"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowRight, Building2, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, AtSign } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  organizationId: string;
  organizationName?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function AuthView({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  const checkUsernameAvailability = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_REGEX.test(value)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
      const data = await res.json();
      setUsernameStatus(data.available ? "available" : "taken");
    } catch {
      setUsernameStatus("idle");
    }
  }, []);

  const handleUsernameChange = (value: string) => {
    // Only allow valid characters
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    setUsername(sanitized);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (!sanitized || sanitized.length < 3) {
      setUsernameStatus(sanitized.length > 0 ? "invalid" : "idle");
      return;
    }
    usernameDebounceRef.current = setTimeout(() => checkUsernameAvailability(sanitized), 400);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/auth/reset` }
        );
        if (resetError) throw new Error(resetError.message);
        setResetSent(true);
        return;
      }

      if (mode === "signup") {
        if (!name || !organizationName) {
          throw new Error("Name and company are required");
        }
        if (!username || !USERNAME_REGEX.test(username)) {
          throw new Error("Username must be 3-20 characters, alphanumeric and underscores only");
        }
        if (usernameStatus === "taken") {
          throw new Error("That username is already taken");
        }

        // Sign up directly through Supabase Auth
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { name, username: username.toLowerCase(), organizationName },
          },
        });

        if (signUpError) throw new Error(signUpError.message);
        if (!signUpData.user) throw new Error("Signup failed");

        // Create org + profile via API (needs admin privileges)
        const setupRes = await fetch("/api/auth/setup-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: signUpData.user.id,
            email: email.trim().toLowerCase(),
            name,
            username: username.toLowerCase(),
            organizationName,
          }),
        });

        if (!setupRes.ok) {
          const err = await setupRes.json().catch(() => ({ error: "Profile setup failed" }));
          throw new Error(err.error);
        }

        const setupData = await setupRes.json();

        onLogin({
          id: signUpData.user.id,
          email: signUpData.user.email ?? email,
          name,
          username: username.toLowerCase(),
          organizationId: setupData.organizationId ?? "",
          organizationName,
        });
        return;
      }

      // Login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        if (loginError.message.includes("Invalid login")) {
          throw new Error("Invalid email or password");
        }
        throw new Error(loginError.message);
      }

      // Fetch profile for org info and username
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, username, organization_id")
        .eq("id", data.user.id)
        .single();

      // Fetch org name
      let orgName = "";
      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profile.organization_id)
          .single();
        orgName = org?.name ?? "";
      }

      onLogin({
        id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.name ?? profile?.name ?? email.split("@")[0],
        username: profile?.username ?? data.user.user_metadata?.username ?? "",
        organizationId: profile?.organization_id ?? data.user.user_metadata?.organizationId ?? "",
        organizationName: orgName,
      });
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
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
            </h2>
            <p className="text-sm text-zinc-500">
              {mode === "login"
                ? "Sign in to access your workspace."
                : mode === "signup"
                ? "Get started with Pivot in seconds."
                : "Enter your email to receive a reset link."}
            </p>
          </div>

          {mode === "forgot" && resetSent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm text-zinc-600 text-center">
                If an account exists with that email, a password reset link has been sent. Check your inbox.
              </p>
              <button
                onClick={() => { setMode("login"); setResetSent(false); setError(null); }}
                className="text-xs text-zinc-400 hover:text-zinc-900 transition-colors uppercase font-mono tracking-widest mt-4"
              >
                Back to Sign In
              </button>
            </motion.div>
          ) : (
            <>
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
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Username</label>
                        <div className="relative">
                          <AtSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            required
                            value={username}
                            onChange={e => handleUsernameChange(e.target.value)}
                            className={`block w-full rounded-xl border bg-zinc-50/50 py-3 pl-10 pr-10 text-sm focus:bg-white focus:outline-none transition-all ${
                              usernameStatus === "available" ? "border-green-300 focus:border-green-500" :
                              usernameStatus === "taken" || usernameStatus === "invalid" ? "border-red-300 focus:border-red-500" :
                              "border-zinc-200 focus:border-zinc-900"
                            }`}
                            placeholder="3-20 chars, letters, numbers, _"
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                            {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                            {usernameStatus === "available" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {usernameStatus === "taken" && <AlertCircle className="w-4 h-4 text-red-500" />}
                            {usernameStatus === "invalid" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                          </div>
                        </div>
                        {usernameStatus === "taken" && (
                          <p className="text-[10px] text-red-500 mt-1 font-mono">Username is already taken</p>
                        )}
                        {usernameStatus === "invalid" && username.length > 0 && (
                          <p className="text-[10px] text-amber-500 mt-1 font-mono">Min 3 chars, letters, numbers, underscores only</p>
                        )}
                        {usernameStatus === "available" && (
                          <p className="text-[10px] text-green-500 mt-1 font-mono">Username is available</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Company</label>
                        <input
                          type="text"
                          required
                          value={organizationName}
                          onChange={e => setOrganizationName(e.target.value)}
                          className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all"
                          placeholder="Your company name"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all font-medium"
                    placeholder="you@company.com"
                  />
                </div>

                {mode !== "forgot" && (
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 pr-11 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all"
                        placeholder="Min 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

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
                      {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {mode === "login" && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => { setMode("forgot"); setError(null); }}
                    className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
                <button
                  onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setResetSent(false); }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  {mode === "login" ? (
                    <>Don&apos;t have an account? <span className="font-semibold text-zinc-900">Sign up</span></>
                  ) : (
                    <>Already have an account? <span className="font-semibold text-zinc-900">Sign in</span></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block bg-zinc-950 overflow-hidden">
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
              <div className="text-sm text-zinc-300">Ingest &rarr; Plan &rarr; Execute</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Status</div>
              <div className="text-sm text-zinc-300">v2.0 Live</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
