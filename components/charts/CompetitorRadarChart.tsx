// @ts-nocheck
"use client";

import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from "recharts";
import { CHART_COLORS } from "./chart-utils";
import { OverlayProjection } from "./OverlayProjection";

interface Competitor {
  name: string;
  url: string;
  websiteGrade?: string;
  offer?: string;
  isIndustryLeader?: boolean;
}

interface OverlayData {
  dataPoints: { month: string; baseline: number; projected: number }[];
  title?: string;
  subtitle?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  competitors: Competitor[];
  yourGrade?: string;
  overlay?: OverlayData;
  onDismissOverlay?: () => void;
}

const GRADE_TO_NUM: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

export function CompetitorRadarChart({ competitors, yourGrade, overlay, onDismissOverlay }: Props) {
  const graded = competitors.filter((c) => c.websiteGrade && GRADE_TO_NUM[c.websiteGrade]);
  if (graded.length === 0) return null;

  // Build radar data: each competitor is a dimension
  const yourScore = GRADE_TO_NUM[yourGrade ?? ""] ?? 0;

  const data = graded.slice(0, 6).map((c) => ({
    name: c.name,
    competitor: GRADE_TO_NUM[c.websiteGrade!] ?? 0,
    you: yourScore,
  }));

  return (
    <div>
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Website Grade: You vs Competitors
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data}>
            <PolarGrid stroke="#e4e4e7" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
            {yourScore > 0 && (
              <Radar
                name="You"
                dataKey="you"
                stroke={CHART_COLORS.primary}
                fill={CHART_COLORS.primary}
                fillOpacity={0.15}
              />
            )}
            <Radar
              name="Competitors"
              dataKey="competitor"
              stroke={CHART_COLORS.accent}
              fill={CHART_COLORS.accent}
              fillOpacity={0.15}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {overlay && overlay.dataPoints?.length > 0 && (
        <OverlayProjection data={overlay} onDismiss={onDismissOverlay} />
      )}
    </div>
  );
}
