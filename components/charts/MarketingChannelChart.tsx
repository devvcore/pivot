"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { EFFORT_COLORS, CHART_COLORS, TOOLTIP_STYLE, gradeToNumber } from "./chart-utils";

interface ChannelRec {
  rank: number;
  channel: string;
  effort: "Low" | "Medium" | "High";
  expectedImpact: string;
}

interface SocialStrategy {
  platform: string;
  currentGrade?: string;
  vsCompetitorGrade?: string;
}

interface Props {
  channels: ChannelRec[];
  socialStrategy: SocialStrategy[];
}

export function MarketingChannelChart({ channels, socialStrategy }: Props) {
  const channelData = channels.slice(0, 7).map((c) => ({
    name: c.channel.length > 20 ? c.channel.slice(0, 18) + "..." : c.channel,
    rank: channels.length + 1 - c.rank, // invert so rank 1 = tallest bar
    effort: c.effort,
  }));

  const socialData = socialStrategy
    .filter((s) => s.currentGrade || s.vsCompetitorGrade)
    .map((s) => ({
      name: s.platform,
      you: gradeToNumber(s.currentGrade ?? ""),
      competitor: gradeToNumber(s.vsCompetitorGrade ?? ""),
    }));

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {channelData.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
            Recommended Channels (by priority)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={channelData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(_v, _name, props) =>
                  [`Effort: ${(props?.payload as Record<string, unknown>)?.effort ?? ""}`, "Priority"]
                }
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="rank" radius={[0, 4, 4, 0]}>
                {channelData.map((entry, i) => (
                  <Cell key={i} fill={EFFORT_COLORS[entry.effort] ?? CHART_COLORS.secondary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 justify-center text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Low effort</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> High</span>
          </div>
        </div>
      )}

      {socialData.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
            Social Media Grade: You vs Competitors
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={socialData} margin={{ left: 5, right: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tickFormatter={(v) => ["", "F", "D", "C", "B", "A"][v] ?? ""}
                tick={{ fontSize: 9 }}
              />
              <Tooltip
                formatter={(v) => ["", "F", "D", "C", "B", "A"][Number(v ?? 0)] ?? "N/A"}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="you" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} name="You" />
              <Bar dataKey="competitor" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} name="Competitor" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 justify-center text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-900" /> You</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-300" /> Competitor</span>
          </div>
        </div>
      )}
    </div>
  );
}
