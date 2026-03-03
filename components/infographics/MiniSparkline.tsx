"use client";

interface MiniSparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function MiniSparkline({ values, width = 48, height = 20, color }: MiniSparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const trending = values[values.length - 1] >= values[0];
  const strokeColor = color ?? (trending ? "#10b981" : "#ef4444");

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
