"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

// ── Type definitions ────────────────────────────────────────────────────────

export interface PlanSubtask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "need-help" | "failed";
  priority: "low" | "medium" | "high";
  tools?: string[];
}

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "need-help" | "failed";
  priority: "low" | "medium" | "high";
  level: number;
  dependencies: string[];
  subtasks: PlanSubtask[];
}

interface AgentPlanProps {
  /** Tasks to display. If not provided, uses internal demo data */
  tasks?: PlanTask[];
  /** Whether the plan is still being generated/updated */
  isLive?: boolean;
  /** Callback when user clicks a task status */
  onTaskStatusChange?: (taskId: string, newStatus: string) => void;
  /** Callback when user clicks a subtask status */
  onSubtaskStatusChange?: (taskId: string, subtaskId: string, newStatus: string) => void;
  /** Compact mode for embedding in chat */
  compact?: boolean;
}

// ── Status icon component ───────────────────────────────────────────────────

function StatusIcon({ status, size = "normal" }: { status: string; size?: "normal" | "small" }) {
  const cls = size === "small" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";

  switch (status) {
    case "completed":
      return <CheckCircle2 className={`${cls} text-green-500`} />;
    case "in-progress":
      return <CircleDotDashed className={`${cls} text-blue-500`} />;
    case "need-help":
      return <CircleAlert className={`${cls} text-yellow-500`} />;
    case "failed":
      return <CircleX className={`${cls} text-red-500`} />;
    default:
      return <Circle className={`${cls} text-muted-foreground`} />;
  }
}

// ── Status badge colors ─────────────────────────────────────────────────────

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "completed": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "in-progress": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "need-help": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "failed": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AgentPlan({
  tasks: externalTasks,
  isLive = false,
  onTaskStatusChange,
  onSubtaskStatusChange,
  compact = false,
}: AgentPlanProps) {
  const [tasks, setTasks] = useState<PlanTask[]>(externalTasks ?? []);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(() => {
    // Auto-expand in-progress tasks
    return (externalTasks ?? [])
      .filter(t => t.status === "in-progress")
      .map(t => t.id);
  });
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  // Sync with external tasks when they update
  useEffect(() => {
    if (externalTasks) {
      setTasks(externalTasks);
      // Auto-expand newly in-progress tasks
      const inProgress = externalTasks.filter(t => t.status === "in-progress").map(t => t.id);
      setExpandedTasks(prev => [...new Set([...prev, ...inProgress])]);
    }
  }, [externalTasks]);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId],
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTaskStatusClick = (taskId: string) => {
    if (onTaskStatusChange) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const next = task.status === "completed" ? "pending" : "completed";
        onTaskStatusChange(taskId, next);
      }
    }
  };

  const handleSubtaskStatusClick = (taskId: string, subtaskId: string) => {
    if (onSubtaskStatusChange) {
      const task = tasks.find(t => t.id === taskId);
      const subtask = task?.subtasks.find(s => s.id === subtaskId);
      if (subtask) {
        const next = subtask.status === "completed" ? "pending" : "completed";
        onSubtaskStatusChange(taskId, subtaskId, next);
      }
    }
  };

  // Progress stats
  const totalSubtasks = tasks.reduce((sum, t) => sum + t.subtasks.length, 0);
  const completedSubtasks = tasks.reduce(
    (sum, t) => sum + t.subtasks.filter(s => s.status === "completed").length,
    0,
  );
  const progressPct = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Animation variants
  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: prefersReducedMotion ? "tween" : "spring",
        stiffness: 500,
        damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      height: "auto",
      opacity: 1,
      overflow: "visible" as const,
      transition: {
        duration: 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren" as const,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden" as const,
      transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] },
    },
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: prefersReducedMotion ? "tween" : "spring",
        stiffness: 500,
        damping: 25,
      },
    },
  };

  if (tasks.length === 0) return null;

  return (
    <div className={compact ? "" : "bg-white text-zinc-900"}>
      <motion.div
        className={`${compact ? "" : "rounded-xl border border-zinc-200 shadow-sm"} overflow-hidden`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] } }}
      >
        {/* Progress header */}
        {!compact && (
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              {isLive && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Execution Plan
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-24 rounded-full bg-zinc-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {completedSubtasks}/{totalSubtasks}
              </span>
            </div>
          </div>
        )}

        <LayoutGroup>
          <div className={compact ? "py-1" : "p-4"}>
            <ul className="space-y-1">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);

                return (
                  <motion.li
                    key={task.id}
                    className={index !== 0 ? "mt-1 pt-1" : ""}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    {/* Task row */}
                    <motion.div
                      className="group flex items-center px-2 py-1.5 rounded-lg cursor-pointer"
                      whileHover={{ backgroundColor: "rgba(0,0,0,0.03)", transition: { duration: 0.15 } }}
                      onClick={() => toggleTaskExpansion(task.id)}
                    >
                      <motion.div
                        className="mr-2 shrink-0"
                        onClick={e => { e.stopPropagation(); handleTaskStatusClick(task.id); }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={task.status}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                          >
                            <StatusIcon status={task.status} />
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>

                      <div className="flex min-w-0 flex-grow items-center justify-between">
                        <span className={`text-sm truncate ${task.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
                          {task.title}
                        </span>

                        <div className="flex shrink-0 items-center gap-2 ml-2 text-xs">
                          {task.dependencies.length > 0 && (
                            <div className="flex gap-1">
                              {task.dependencies.map((dep, idx) => (
                                <span
                                  key={idx}
                                  className="bg-zinc-100 text-zinc-500 rounded px-1.5 py-0.5 text-[10px] font-mono"
                                >
                                  #{dep}
                                </span>
                              ))}
                            </div>
                          )}
                          <motion.span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getStatusBadgeClasses(task.status)}`}
                            key={task.status}
                            initial={{ scale: 1 }}
                            animate={{ scale: prefersReducedMotion ? 1 : [1, 1.05, 1], transition: { duration: 0.3 } }}
                          >
                            {task.status}
                          </motion.span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Subtasks */}
                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div
                          className="relative overflow-hidden"
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <div className="absolute top-0 bottom-0 left-[18px] border-l-2 border-dashed border-zinc-200" />
                          <ul className="mt-1 mb-1.5 ml-3 space-y-0.5">
                            {task.subtasks.map(subtask => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubExpanded = expandedSubtasks[subtaskKey];

                              return (
                                <motion.li
                                  key={subtask.id}
                                  className="flex flex-col py-0.5 pl-5"
                                  variants={subtaskVariants}
                                >
                                  <motion.div
                                    className="flex items-center rounded-md px-1 py-0.5 cursor-pointer"
                                    whileHover={{ backgroundColor: "rgba(0,0,0,0.02)", transition: { duration: 0.15 } }}
                                    onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                                  >
                                    <motion.div
                                      className="mr-2 shrink-0"
                                      onClick={e => { e.stopPropagation(); handleSubtaskStatusClick(task.id, subtask.id); }}
                                      whileTap={{ scale: 0.9 }}
                                    >
                                      <AnimatePresence mode="wait">
                                        <motion.div
                                          key={subtask.status}
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.8 }}
                                          transition={{ duration: 0.15 }}
                                        >
                                          <StatusIcon status={subtask.status} size="small" />
                                        </motion.div>
                                      </AnimatePresence>
                                    </motion.div>

                                    <span className={`text-[13px] ${subtask.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                                      {subtask.title}
                                    </span>
                                  </motion.div>

                                  {/* Subtask details */}
                                  <AnimatePresence mode="wait">
                                    {isSubExpanded && (
                                      <motion.div
                                        className="text-zinc-400 mt-1 ml-1.5 border-l border-dashed border-zinc-200 pl-5 text-xs overflow-hidden"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto", transition: { duration: 0.2 } }}
                                        exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                                      >
                                        <p className="py-1 text-zinc-500">{subtask.description}</p>
                                        {subtask.tools && subtask.tools.length > 0 && (
                                          <div className="mt-0.5 mb-1.5 flex flex-wrap items-center gap-1.5">
                                            <span className="text-zinc-400 font-medium text-[10px] uppercase tracking-wider">
                                              Tools:
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                              {subtask.tools.map((tool, idx) => (
                                                <motion.span
                                                  key={idx}
                                                  className="bg-indigo-50 text-indigo-600 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                  initial={{ opacity: 0, y: -3 }}
                                                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.03 } }}
                                                >
                                                  {tool}
                                                </motion.span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}
