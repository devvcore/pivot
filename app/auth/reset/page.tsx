"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "motion/react";
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function handleRecovery() {
      // PKCE flow: Supabase sends ?code= query param that must be exchanged
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setSessionReady(true);
        } else {
          setError("This reset link is invalid or has already been used.");
        }
        setChecking(false);
        return;
      }

      // Implicit flow fallback: token in URL hash
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event) => {
          if (event === "PASSWORD_RECOVERY") {
            setSessionReady(true);
            setChecking(false);
          }
        }
      );

      // Check if there's already an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      }
      setChecking(false);

      return () => subscription.unsubscribe();
    }

    handleRecovery();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw new Error(updateError.message);
      setSuccess(true);
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

          {checking ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              <p className="text-sm text-zinc-500">Verifying reset link...</p>
            </div>
          ) : success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <h2 className="text-xl font-semibold text-zinc-900">Password updated</h2>
              <p className="text-sm text-zinc-500 text-center">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <a
                href="/"
                className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-900 py-3 px-6 text-sm font-bold text-white shadow-xl shadow-zinc-900/10 hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                Go to Sign In
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          ) : !sessionReady ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <AlertCircle className="w-12 h-12 text-amber-500" />
              <h2 className="text-xl font-semibold text-zinc-900">Invalid or expired link</h2>
              <p className="text-sm text-zinc-500 text-center">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <a
                href="/"
                className="mt-4 text-xs text-zinc-400 hover:text-zinc-900 transition-colors uppercase font-mono tracking-widest"
              >
                Back to Sign In
              </a>
            </motion.div>
          ) : (
            <>
              <div className="space-y-2 mb-10">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-zinc-400" />
                  <h2 className="text-3xl font-light tracking-tight text-zinc-900">
                    Set new password
                  </h2>
                </div>
                <p className="text-sm text-zinc-500">
                  Enter your new password below.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 px-4 pr-11 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all"
                      placeholder="Min 6 characters"
                      autoFocus
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

                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-widest">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`block w-full rounded-xl border bg-zinc-50/50 py-3 px-4 text-sm focus:bg-white focus:outline-none transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? "border-red-300 focus:border-red-500"
                        : "border-zinc-200 focus:border-zinc-900"
                    }`}
                    placeholder="Confirm your password"
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-[10px] text-red-500 mt-1 font-mono">Passwords do not match</p>
                  )}
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
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Update Password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
                <a
                  href="/"
                  className="text-xs text-zinc-400 hover:text-zinc-900 transition-colors uppercase font-mono tracking-widest"
                >
                  Back to Sign In
                </a>
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
            <KeyRound className="w-20 h-20 text-zinc-800 mb-10 mx-auto" strokeWidth={1} />
            <h2 className="text-5xl font-light text-white tracking-tighter mb-6 leading-[1.1]">
              Secure your<br /><span className="italic font-normal">account</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-lg leading-relaxed mx-auto font-light">
              Choose a strong password to keep your workspace protected.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
