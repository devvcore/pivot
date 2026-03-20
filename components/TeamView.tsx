"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Plus, Users, Briefcase, Building2, DollarSign,
  TrendingUp, X, Loader2, UserCircle, AlertCircle,
} from "lucide-react";

interface Employee {
  id: string;
  orgId: string;
  name: string;
  roleTitle?: string;
  department?: string;
  salary?: number;
  startDate?: string;
  netValueEstimate?: number;
  roiScore?: number;
  status: "active" | "on_notice" | "departed";
  createdAt: string;
  updatedAt: string;
}

interface TeamViewProps {
  orgId: string;
  onBack: () => void;
}

const STATUS_CONFIG = {
  active: { label: "Active", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  on_notice: { label: "On Notice", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  departed: { label: "Departed", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

function formatCurrency(n?: number) {
  if (n == null) return "--";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TeamView({ orgId, onBack }: TeamViewProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formSalary, setFormSalary] = useState("");

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const resetForm = () => {
    setFormName("");
    setFormRole("");
    setFormDept("");
    setFormSalary("");
    setError(null);
  };

  const handleAdd = async () => {
    if (!formName.trim()) {
      setError("Employee name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          name: formName.trim(),
          roleTitle: formRole.trim() || undefined,
          department: formDept.trim() || undefined,
          salary: formSalary ? parseFloat(formSalary) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add employee");
      }

      resetForm();
      setShowForm(false);
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || "Failed to add employee");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = employees.filter((e) => e.status === "active").length;
  const onNoticeCount = employees.filter((e) => e.status === "on_notice").length;
  const departedCount = employees.filter((e) => e.status === "departed").length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-100 rounded-full blur-[100px] -mr-64 -mt-64 opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-zinc-100 rounded-full blur-[80px] -ml-40 -mb-40 opacity-50 pointer-events-none" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 p-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4">
            <div className="w-9 h-9 bg-zinc-900 flex items-center justify-center rounded-xl shadow-lg shadow-zinc-900/10">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-xl text-zinc-900 leading-none">Team Management</div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-1">Employee Directory</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-colors active:scale-95 group font-bold rounded-lg"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Add Employee
        </button>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-8 lg:p-12 relative z-10">
        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10"
        >
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-2">Total</div>
            <div className="text-3xl font-light">{employees.length}</div>
          </div>
          <div className="bg-white border border-emerald-200 p-6 rounded-2xl shadow-sm">
            <div className="text-[10px] font-mono text-emerald-600 uppercase tracking-[0.2em] mb-2">Active</div>
            <div className="text-3xl font-light text-emerald-700">{activeCount}</div>
          </div>
          <div className="bg-white border border-amber-200 p-6 rounded-2xl shadow-sm">
            <div className="text-[10px] font-mono text-amber-600 uppercase tracking-[0.2em] mb-2">On Notice</div>
            <div className="text-3xl font-light text-amber-700">{onNoticeCount}</div>
          </div>
          <div className="bg-white border border-red-200 p-6 rounded-2xl shadow-sm">
            <div className="text-[10px] font-mono text-red-600 uppercase tracking-[0.2em] mb-2">Departed</div>
            <div className="text-3xl font-light text-red-700">{departedCount}</div>
          </div>
        </motion.div>

        {/* Add Employee Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-zinc-400" />
                    New Employee
                  </h3>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 block">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 block">
                      Role Title
                    </label>
                    <input
                      type="text"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      placeholder="e.g. Senior Developer"
                      className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 block">
                      Department
                    </label>
                    <input
                      type="text"
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 block">
                      Salary
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                      <input
                        type="number"
                        value={formSalary}
                        onChange={(e) => setFormSalary(e.target.value)}
                        placeholder="Annual salary"
                        className="w-full pl-8 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-4">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-zinc-200 text-zinc-600 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50 transition-all rounded-lg shadow-sm"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? "Saving..." : "Add Employee"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Employee List */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-xs font-mono text-zinc-900 uppercase tracking-[0.3em] flex items-center gap-3">
              <Users className="w-4 h-4 text-zinc-400" /> Employees
            </h2>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              {employees.length} {employees.length === 1 ? "member" : "members"}
            </div>
          </div>

          {loading ? (
            <div className="p-20 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 border-2 border-zinc-100 border-t-zinc-900 rounded-full mx-auto mb-4"
              />
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Loading team...</div>
            </div>
          ) : employees.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-100">
                <Users className="w-7 h-7 text-zinc-200" />
              </div>
              <h3 className="text-lg font-light text-zinc-900 mb-2">No team members yet</h3>
              <p className="text-zinc-500 text-sm mb-8 max-w-xs mx-auto">
                Add your first employee to start tracking team performance and ROI.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-3 px-6 py-3 bg-zinc-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all rounded-xl"
              >
                <Plus className="w-4 h-4" /> Add First Employee
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {employees.map((emp, i) => {
                const status = STATUS_CONFIG[emp.status] || STATUS_CONFIG.active;
                return (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="px-6 py-5 hover:bg-zinc-50/50 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar placeholder */}
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0 text-zinc-400">
                        <UserCircle className="w-6 h-6" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <span className="text-sm font-bold text-zinc-900">{emp.name}</span>
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${status.text} ${status.bg} ${status.border}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap">
                          {emp.roleTitle && (
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-zinc-300" />
                              {emp.roleTitle}
                            </span>
                          )}
                          {emp.department && (
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-zinc-300" />
                              {emp.department}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-400">
                            Added {formatDate(emp.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-0.5">Salary</div>
                          <div className="text-sm font-medium text-zinc-900 tabular-nums">
                            {formatCurrency(emp.salary)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-0.5">Net Value</div>
                          <div className={`text-sm font-medium tabular-nums ${emp.netValueEstimate != null ? "text-zinc-900" : "text-zinc-300"}`}>
                            {formatCurrency(emp.netValueEstimate)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-0.5">ROI</div>
                          <div className={`text-sm font-medium tabular-nums ${emp.roiScore != null ? "text-zinc-900" : "text-zinc-300"}`}>
                            {emp.roiScore != null ? `${emp.roiScore.toFixed(1)}x` : "--"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="p-10 text-center border-t border-zinc-100 bg-white">
        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.4em]">Pivot Intelligence Platform</div>
      </footer>
    </div>
  );
}
