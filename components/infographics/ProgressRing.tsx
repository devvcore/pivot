"use client";

import { motion } from "motion/react";

interface ProgressRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  grade?: string;
  label?: string;
}

function getColor(pct: number): string {
  if (pct >= 80) return "#10b981";
  if (pct >= 60) return "#f59e0b";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}

export default function ProgressRing({ score, maxScore = 100, size = 64, strokeWidth = 5, grade, label }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const offset = circumference - (pct / 100) * circumference;
  const color = getColor(pct);

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e4e4e7" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-zinc-900 tabular-nums">{Math.round(score)}</span>
        </div>
      </div>
      {(grade || label) && (
        <div className="flex flex-col">
          {grade && <span className="text-xs font-bold text-zinc-700">{grade}</span>}
          {label && <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">{label}</span>}
        </div>
      )}
    </div>
  );
}
