"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, AlertTriangle, Clock, TrendingUp, Users,
  ChevronDown, ChevronRight, Shield, Flame, UserX, Heart,
  BarChart3, Activity, Zap, Hash,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommunicationInsight {
  employeeId: string;
  name: string;
  department?: string;
  title?: string;
  responsiveness: number;       // 0-100
  engagement: number;           // 0-100
  sentiment: number;            // 0-100 (50=neutral, <50=negative, >50=positive)
  meetingAttendance: number;    // 0-100
  overallScore: number;         // 0-100
  avgResponseTimeMinutes: number;
  messagesPerDay: number;
  topCollaborators: string[];
  riskFlags?: string[];
}

export interface ChannelActivity {
  channel: string;
  messagesPerDay: number;
  uniqueParticipants: number;
  sentiment: number;
}

export interface Bottleneck {
  name: string;
  type: "person" | "channel";
  description: string;
  impact: "high" | "medium" | "low";
  avgDelayMinutes: number;
}

export interface RiskFlag {
  type: "burnout" | "exclusion" | "favoritism" | "disengagement" | "overload";
  severity: "high" | "medium" | "low";
  description: string;
  affectedPeople: string[];
  recommendation: string;
}

interface CommunicationInsightsProps {
  orgId: string;
  insights: CommunicationInsight[];
  channels?: ChannelActivity[];
  bottlenecks?: Bottleneck[];
  riskFlags?: RiskFlag[];
  communicationHealthScore?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 80) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 60) return { text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
  if (score >= 40) return { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" };
  if (score >= 20) return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
  return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
}

function sentimentLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Positive", color: "text-emerald-700" };
  if (score >= 50) return { label: "Neutral", color: "text-zinc-600" };
  if (score >= 30) return { label: "Mixed", color: "text-amber-700" };
  return { label: "Negative", color: "text-red-700" };
}

function impactColor(impact: string): string {
  if (impact === "high") return "text-red-700 bg-red-50 border-red-200";
  if (impact === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-zinc-600 bg-zinc-50 border-zinc-200";
}

const RISK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  burnout: Flame,
  exclusion: UserX,
  favoritism: Heart,
  disengagement: Activity,
  overload: Zap,
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = Math.floor(mins / 60);
  const remainder = Math.round(mins % 60);
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

// ── Health Gauge ─────────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const colors = scoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#f4f4f5" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="45" fill="none"
            stroke={score >= 70 ? "#10b981" : score >= 50 ? "#eab308" : score >= 30 ? "#f97316" : "#ef4444"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-light tabular-nums text-zinc-900">{score}</span>
          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">/100</span>
        </div>
      </div>
      <div>
        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border ${colors.text} ${colors.bg} ${colors.border}`}>
          {score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : score >= 20 ? "Needs Work" : "Critical"}
        </span>
        <p className="text-xs text-zinc-500 mt-2 max-w-[200px] leading-relaxed">
          {score >= 70
            ? "Strong communication patterns with healthy collaboration signals."
            : score >= 50
            ? "Generally healthy but some areas need attention."
            : "Communication patterns suggest significant organizational friction."}
        </p>
      </div>
    </div>
  );
}

// ── Relationship Heatmap ─────────────────────────────────────────────────────

function RelationshipHeatmap({ insights }: { insights: CommunicationInsight[] }) {
  const top = insights.slice(0, 8);
  const names = top.map(i => i.name.split(" ")[0]);

  // Generate a mock intensity matrix from collaboration data
  const matrix = top.map((person, i) =>
    top.map((other, j) => {
      if (i === j) return 100;
      const isCollaborator = person.topCollaborators.some(
        c => c.toLowerCase().includes(other.name.toLowerCase().split(" ")[0])
      );
      if (isCollaborator) return 60 + Math.floor(Math.random() * 30);
      return 5 + Math.floor(Math.random() * 25);
    })
  );

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[300px]">
        <div className="flex">
          <div className="w-20" />
          {names.map(n => (
            <div key={n} className="w-12 text-center text-[9px] font-mono text-zinc-400 truncate px-0.5">
              {n}
            </div>
          ))}
        </div>
        {matrix.map((row, i) => (
          <div key={i} className="flex items-center">
            <div className="w-20 text-[10px] font-mono text-zinc-500 truncate pr-2 text-right">
              {names[i]}
            </div>
            {row.map((val, j) => (
              <div
                key={j}
                className="w-12 h-8 flex items-center justify-center text-[8px] font-mono border border-white/50 rounded-sm"
                style={{
                  backgroundColor: i === j
                    ? "#f4f4f5"
                    : `rgba(16, 185, 129, ${val / 100})`,
                  color: val > 50 && i !== j ? "white" : "#71717a",
                }}
                title={`${names[i]} - ${names[j]}: ${val}%`}
              >
                {i !== j ? val : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[9px] font-mono text-zinc-400">Low</span>
        <div className="flex gap-0.5">
          {[0.1, 0.2, 0.4, 0.6, 0.8].map(opacity => (
            <div
              key={opacity}
              className="w-6 h-3 rounded-sm"
              style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})` }}
            />
          ))}
        </div>
        <span className="text-[9px] font-mono text-zinc-400">High</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CommunicationInsights({
  orgId,
  insights,
  channels = [],
  bottlenecks = [],
  riskFlags = [],
  communicationHealthScore,
}: CommunicationInsightsProps) {
  const [sortKey, setSortKey] = useState<keyof CommunicationInsight>("overallScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedRisks, setExpandedRisks] = useState<Set<number>>(new Set());

  const healthScore = communicationHealthScore ?? Math.round(
    insights.reduce((sum, i) => sum + i.overallScore, 0) / Math.max(insights.length, 1)
  );

  const sortedInsights = useMemo(() => {
    return [...insights].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      return 0;
    });
  }, [insights, sortKey, sortDir]);

  const handleSort = (key: keyof CommunicationInsight) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Response time chart data
  const responseTimeData = sortedInsights.slice(0, 12).map(i => ({
    name: i.name.split(" ")[0],
    minutes: i.avgResponseTimeMinutes,
    fill: i.avgResponseTimeMinutes > 60 ? "#ef4444" : i.avgResponseTimeMinutes > 30 ? "#f59e0b" : "#10b981",
  }));

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
        <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-zinc-700 mb-2">No Communication Data Yet</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Connect Slack or Gmail integrations to unlock team communication insights, engagement scoring, and bottleneck detection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Communication Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
      >
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Team Communication Health
        </h3>
        <HealthGauge score={healthScore} />
      </motion.div>

      {/* Employee Engagement Rankings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-zinc-100">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Employee Engagement Rankings
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {[
                  { key: "name" as keyof CommunicationInsight, label: "Name" },
                  { key: "responsiveness" as keyof CommunicationInsight, label: "Responsiveness" },
                  { key: "engagement" as keyof CommunicationInsight, label: "Engagement" },
                  { key: "sentiment" as keyof CommunicationInsight, label: "Sentiment" },
                  { key: "meetingAttendance" as keyof CommunicationInsight, label: "Meeting Att." },
                  { key: "overallScore" as keyof CommunicationInsight, label: "Overall" },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key !== "name" ? handleSort(col.key) : undefined}
                    className={`px-4 py-3 text-left text-[10px] font-mono text-zinc-400 uppercase tracking-wider whitespace-nowrap ${
                      col.key !== "name" ? "cursor-pointer hover:text-zinc-700 select-none" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-zinc-600">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedInsights.map((person, idx) => {
                const sc = scoreColor(person.overallScore);
                const sent = sentimentLabel(person.sentiment);
                return (
                  <motion.tr
                    key={person.employeeId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-zinc-900 text-sm">{person.name}</span>
                        {person.department && (
                          <span className="text-[10px] text-zinc-400 ml-2 font-mono">{person.department}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar value={person.responsiveness} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar value={person.engagement} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${sent.color}`}>{sent.label}</span>
                      <span className="text-[10px] text-zinc-400 ml-1 tabular-nums">{person.sentiment}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar value={person.meetingAttendance} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${sc.text} ${sc.bg} ${sc.border} tabular-nums`}>
                        {person.overallScore}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Relationship Map */}
      {insights.length >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Communication Relationship Map
          </h3>
          <RelationshipHeatmap insights={insights} />
        </motion.div>
      )}

      {/* Response Time Distribution */}
      {responseTimeData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Avg Response Time by Person
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatMinutes(v)} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={55}
                />
                <Tooltip
                  formatter={(value) => [formatMinutes(Number(value)), "Avg Response Time"]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e4e4e7",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={20}>
                  {responseTimeData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-zinc-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Under 30m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 30-60m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Over 60m</span>
          </div>
        </motion.div>
      )}

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Communication Bottlenecks
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bottlenecks.map((b, i) => (
              <div key={i} className={`rounded-xl border p-4 ${impactColor(b.impact)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{b.name}</span>
                    <span className="text-[9px] font-mono uppercase tracking-wider opacity-80">
                      {b.type}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                    {b.impact}
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{b.description}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-mono opacity-70">
                  <Clock className="w-3 h-3" />
                  Avg delay: {formatMinutes(b.avgDelayMinutes)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Risk Flags */}
      {riskFlags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Risk Flags
          </h3>
          <div className="space-y-3">
            {riskFlags.map((flag, i) => {
              const RiskIcon = RISK_ICONS[flag.type] ?? AlertTriangle;
              const isExpanded = expandedRisks.has(i);
              const severityClass = impactColor(flag.severity);

              return (
                <div key={i} className={`rounded-xl border p-4 ${severityClass}`}>
                  <button
                    onClick={() => {
                      setExpandedRisks(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RiskIcon className="w-4 h-4 shrink-0" />
                        <span className="font-semibold text-sm capitalize">{flag.type}</span>
                        <span className="text-[9px] font-mono uppercase tracking-wider font-bold">
                          {flag.severity}
                        </span>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">{flag.description}</p>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                            Affected: {flag.affectedPeople.join(", ")}
                          </div>
                          <div className="text-xs leading-relaxed">
                            <span className="font-medium">Recommendation:</span> {flag.recommendation}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Channel Activity */}
      {channels.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" />
            Channel Activity
          </h3>
          <div className="space-y-3">
            {channels
              .sort((a, b) => b.messagesPerDay - a.messagesPerDay)
              .map((ch, i) => {
                const maxMsgs = Math.max(...channels.map(c => c.messagesPerDay), 1);
                const pct = (ch.messagesPerDay / maxMsgs) * 100;
                const sent = sentimentLabel(ch.sentiment);
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-28 text-sm text-zinc-700 font-medium truncate shrink-0">
                      #{ch.channel}
                    </div>
                    <div className="flex-1 h-6 bg-zinc-100 rounded-full overflow-hidden relative">
                      <motion.div
                        className="h-full bg-emerald-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-[10px] font-mono text-zinc-600">
                        {ch.messagesPerDay.toFixed(0)} msg/day
                      </span>
                    </div>
                    <div className="w-16 text-right text-[10px] font-mono text-zinc-500">
                      {ch.uniqueParticipants} people
                    </div>
                    <div className={`w-16 text-right text-[10px] font-medium ${sent.color}`}>
                      {sent.label}
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Score Bar (mini inline visualization) ────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const colors = scoreColor(value);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 70 ? "bg-emerald-500" : value >= 50 ? "bg-yellow-500" : value >= 30 ? "bg-orange-500" : "bg-red-500"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-zinc-500 tabular-nums w-6">{value}</span>
    </div>
  );
}

export default CommunicationInsights;
