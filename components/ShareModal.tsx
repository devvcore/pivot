"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Share2, Link, Copy, Trash2, Shield, User, GraduationCap,
  X, Check, Loader2, AlertCircle, Users,
} from "lucide-react";

interface ShareLink {
  id: string;
  role: "owner" | "employee" | "coach";
  employeeName?: string;
  token: string;
  url?: string;
  createdAt: string;
  usedCount: number;
}

interface Employee {
  id: string;
  name: string;
}

interface ShareModalProps {
  runId: string;
  orgId: string;
  open: boolean;
  onClose: () => void;
}

const ROLES = [
  {
    value: "owner" as const,
    label: "Owner",
    description: "Full access to all data and analytics",
    icon: Shield,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    activeColor: "bg-violet-600 text-white border-violet-600",
  },
  {
    value: "employee" as const,
    label: "Employee",
    description: "Personal dashboard with tasks, KPIs, and coaching",
    icon: User,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    activeColor: "bg-blue-600 text-white border-blue-600",
  },
  {
    value: "coach" as const,
    label: "Coach",
    description: "Coaching-focused view with team performance data",
    icon: GraduationCap,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    activeColor: "bg-emerald-600 text-white border-emerald-600",
  },
];

export function ShareModal({ runId, orgId, open, onClose }: ShareModalProps) {
  const [selectedRole, setSelectedRole] = useState<"owner" | "employee" | "coach">("owner");
  const [employeeName, setEmployeeName] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/share/list?runId=${encodeURIComponent(runId)}`);
      if (res.ok) {
        const data = await res.json();
        setShareLinks(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLinks(false);
    }
  }, [runId]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch {
      // ignore
    }
  }, [orgId]);

  useEffect(() => {
    if (open) {
      fetchLinks();
      fetchEmployees();
      setGeneratedLink(null);
      setError(null);
    }
  }, [open, fetchLinks, fetchEmployees]);

  const handleGenerate = async () => {
    if (selectedRole === "employee" && !employeeName.trim()) {
      setError("Please enter an employee name.");
      return;
    }
    setGenerating(true);
    setError(null);
    setGeneratedLink(null);

    try {
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          orgId,
          role: selectedRole,
          employeeName: selectedRole === "employee" ? employeeName.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate link");
      }

      const data = await res.json();
      setGeneratedLink(data.url);
      fetchLinks();
    } catch (err: any) {
      setError(err.message || "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    setRevoking(linkId);
    try {
      await fetch("/api/share/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      });
      fetchLinks();
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      const fullUrl = `${window.location.origin}${generatedLink}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const roleConfig = ROLES.find((r) => r.value === selectedRole)!;

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Share Report</h2>
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Generate access links</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Role Selector */}
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3 block">
                    Select Role
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {ROLES.map((role) => {
                      const Icon = role.icon;
                      const isActive = selectedRole === role.value;
                      return (
                        <button
                          key={role.value}
                          onClick={() => {
                            setSelectedRole(role.value);
                            setGeneratedLink(null);
                            setError(null);
                          }}
                          className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                            isActive
                              ? role.activeColor
                              : `border-zinc-200 hover:border-zinc-300 bg-white`
                          }`}
                        >
                          <Icon className={`w-5 h-5 mb-2 ${isActive ? "text-current" : role.color}`} />
                          <div className={`text-xs font-bold ${isActive ? "text-current" : "text-zinc-900"}`}>
                            {role.label}
                          </div>
                          <div className={`text-[10px] mt-0.5 leading-tight ${isActive ? "text-current opacity-80" : "text-zinc-400"}`}>
                            {role.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Employee Name Input */}
                <AnimatePresence>
                  {selectedRole === "employee" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2 block">
                        Employee Name
                      </label>
                      {employees.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            value={employeeName}
                            onChange={(e) => setEmployeeName(e.target.value)}
                            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                          >
                            <option value="">Select an employee...</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-zinc-400 font-mono">Or type a new name:</div>
                          <input
                            type="text"
                            value={employeeName}
                            onChange={(e) => setEmployeeName(e.target.value)}
                            placeholder="Enter employee name..."
                            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={employeeName}
                          onChange={(e) => setEmployeeName(e.target.value)}
                          placeholder="Enter employee name..."
                          className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-xl shadow-lg shadow-zinc-900/10"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  {generating ? "Generating..." : "Generate Link"}
                </button>

                {/* Generated Link */}
                <AnimatePresence>
                  {generatedLink && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-zinc-50 border border-zinc-200 rounded-xl p-4"
                    >
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                        Share Link Generated
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-mono text-zinc-600 truncate">
                          {typeof window !== "undefined" ? `${window.location.origin}${generatedLink}` : generatedLink}
                        </div>
                        <button
                          onClick={handleCopy}
                          className={`p-2.5 rounded-lg transition-all ${
                            copied
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-zinc-900 text-white hover:bg-zinc-800"
                          }`}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Existing Links */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                      Active Links
                    </label>
                    {loadingLinks && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
                  </div>

                  {shareLinks.length === 0 && !loadingLinks ? (
                    <div className="text-center py-6 text-zinc-300">
                      <Link className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-xs font-mono text-zinc-400">No active share links</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {shareLinks.map((link) => {
                        const roleInfo = ROLES.find((r) => r.value === link.role);
                        const RoleIcon = roleInfo?.icon ?? Users;
                        return (
                          <div
                            key={link.id}
                            className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-xl group hover:border-zinc-300 transition-all"
                          >
                            <div className={`w-8 h-8 rounded-lg ${roleInfo?.bgColor ?? "bg-zinc-50"} flex items-center justify-center shrink-0`}>
                              <RoleIcon className={`w-4 h-4 ${roleInfo?.color ?? "text-zinc-400"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-900">{roleInfo?.label ?? link.role}</span>
                                {link.employeeName && (
                                  <span className="text-[10px] font-mono text-zinc-500 truncate">
                                    {link.employeeName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {formatDate(link.createdAt)}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {link.usedCount} view{link.usedCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevoke(link.id)}
                              disabled={revoking === link.id}
                              className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Revoke link"
                            >
                              {revoking === link.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
