"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import SmartSectionRenderer from "./SmartSectionRenderer";
import ProgressRing from "./infographics/ProgressRing";
import type { ClaimValidation } from "@/lib/types";
import { getPopulatedGroups } from "@/lib/chapter-groups";

interface ChapterViewProps {
  chapterId: string;
  sections: string[];
  deliverables: Record<string, unknown>;
  title: string;
  description: string;
  claimValidations?: ClaimValidation[];
}

// Convert camelCase to Title Case
function formatSectionTitle(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, s => s.toUpperCase());
}

// Extract a score from section data (for group summary rings)
function extractSectionScore(data: Record<string, unknown>): { score: number; grade?: string } | null {
  const scoreVal = data.score ?? data.overallScore ?? data.readinessScore ?? data.maturityScore ?? data.healthScore;
  if (typeof scoreVal === "number") {
    return { score: scoreVal, grade: typeof data.grade === "string" ? data.grade : undefined };
  }
  return null;
}

// Extract top-level KPIs across multiple sections for chapter banner
function extractChapterKPIs(
  sections: string[],
  deliverables: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  const kpis: Array<{ label: string; value: string }> = [];

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  for (const key of sections) {
    if (kpis.length >= 4) break;
    const data = deliverables[key];
    if (!data || typeof data !== "object") continue;

    const d = data as Record<string, unknown>;
    for (const [k, val] of Object.entries(d)) {
      if (kpis.length >= 4) break;
      if (k.endsWith("_source") || k === "recommendations" || k === "items" || k === "summary") continue;

      if (typeof val === "number" && !k.includes("source")) {
        const label = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, s => s.toUpperCase());
        if (k.toLowerCase().includes("score") || k.toLowerCase().includes("grade")) {
          kpis.push({ label, value: String(val) });
        } else if (k.toLowerCase().includes("percent") || k.toLowerCase().includes("pct") || k.toLowerCase().includes("rate")) {
          kpis.push({ label, value: `${val}%` });
        } else if (val > 100) {
          kpis.push({ label, value: fmt(val) });
        }
      }
      if (typeof val === "string" && (k === "grade" || k === "headline") && val.length < 60) {
        kpis.push({ label: k.replace(/^./, s => s.toUpperCase()), value: val });
      }
    }
  }

  return kpis;
}

// Extract group-level scores for the group header summary
function extractGroupScores(
  sectionKeys: string[],
  deliverables: Record<string, unknown>,
): { key: string; score: number; grade?: string }[] {
  const scores: { key: string; score: number; grade?: string }[] = [];
  for (const key of sectionKeys) {
    const data = deliverables[key];
    if (!data || typeof data !== "object") continue;
    const s = extractSectionScore(data as Record<string, unknown>);
    if (s) scores.push({ key, ...s });
  }
  return scores.slice(0, 3);
}

export default function ChapterView({ chapterId, sections, deliverables, title, description, claimValidations }: ChapterViewProps) {
  // Get populated groups (only groups with data)
  const populatedGroups = useMemo(
    () => getPopulatedGroups(chapterId, deliverables),
    [chapterId, deliverables],
  );

  // Count total populated sections
  const totalSections = useMemo(
    () => populatedGroups.reduce((sum, g) => sum + g.populatedSections.length, 0),
    [populatedGroups],
  );

  // Chapter-level KPIs across all sections
  const chapterKPIs = useMemo(
    () => extractChapterKPIs(sections, deliverables),
    [sections, deliverables],
  );

  // Expand/collapse state: first 2 groups expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    populatedGroups.slice(0, 2).forEach(g => initial.add(g.group.id));
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  if (totalSections === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No data available for this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chapter Header + KPIs */}
      <div className="border-b border-zinc-200 pb-6">
        <h2 className="text-2xl font-light text-zinc-900 tracking-tight">{title}</h2>
        <p className="text-sm text-zinc-500 mt-1">{description}</p>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
            {totalSections} insight{totalSections !== 1 ? "s" : ""} across {populatedGroups.length} categories
          </span>
        </div>
      </div>

      {/* Chapter KPI Hero Cards */}
      {chapterKPIs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chapterKPIs.map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm"
            >
              <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1 truncate">
                {kpi.label}
              </div>
              <div className="text-xl font-light text-zinc-900 tabular-nums">
                {kpi.value}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Grouped Sections (Accordion) */}
      <div className="space-y-3">
        {populatedGroups.map(({ group, populatedSections: groupSections }, groupIdx) => {
          const isExpanded = expandedGroups.has(group.id);
          const groupScores = extractGroupScores(groupSections, deliverables);
          const sectionClaims = claimValidations?.filter(c =>
            groupSections.some(s => c.field.startsWith(s)),
          );

          return (
            <div
              key={group.id}
              className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-50/50 transition-colors text-left"
              >
                <div className="shrink-0 text-zinc-400">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{group.label}</h3>
                    <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {groupSections.length}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{group.description}</p>
                </div>

                {/* Group summary: scores as mini rings */}
                {groupScores.length > 0 && (
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    {groupScores.map(s => (
                      <ProgressRing
                        key={s.key}
                        score={s.score}
                        size={36}
                        strokeWidth={3}
                        label={formatSectionTitle(s.key).split(" ")[0]}
                      />
                    ))}
                  </div>
                )}
              </button>

              {/* Group Content (expandable) */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-8">
                      {groupSections.map((sectionKey, idx) => {
                        const sectionData = deliverables[sectionKey] as Record<string, unknown>;
                        const sectionClaimsForKey = sectionClaims?.filter(c => c.field.startsWith(sectionKey));

                        return (
                          <motion.div
                            key={sectionKey}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                          >
                            {idx > 0 && <div className="border-t border-zinc-100 mb-6" />}
                            <SmartSectionRenderer
                              sectionKey={sectionKey}
                              data={sectionData}
                              title={formatSectionTitle(sectionKey)}
                              claimValidations={sectionClaimsForKey}
                              compact={groupSections.length > 4}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
