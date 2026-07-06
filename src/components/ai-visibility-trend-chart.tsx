"use client";

import { useState } from "react";

export interface AiVisibilityTrendPoint {
  runAt: string;
  mentionedPct: number;
  contestedPct: number;
  openPct: number;
}

// Categorical palette slots 1/2/3 from the dataviz reference palette
// (blue/aqua/yellow, dark-mode steps) — validated via
// scripts/validate_palette.js (worst adjacent CVD ΔE 41.3, all lightness/
// chroma/contrast checks pass). Fixed order, not chosen per series meaning:
// Mentioned/Open/Contested always map to slot 1/2/3 respectively.
const SERIES = [
  { key: "mentionedPct" as const, label: "Mentioned", color: "#3987e5" },
  { key: "openPct" as const, label: "Open", color: "#199e70" },
  { key: "contestedPct" as const, label: "Contested", color: "#c98500" },
];

const WIDTH = 640;
const HEIGHT = 200;
const PADDING = { top: 12, right: 12, bottom: 24, left: 32 };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A single-hue line chart of Mentioned/Open/Contested % over time — the
// trend the dashboard's own delta line ("Since last run") only ever
// compared two points of before this. Built as plain SVG (no chart library
// dependency in this codebase) following the dataviz skill's mark specs:
// 2px lines, ≥8px end markers with a surface-color ring, a crosshair +
// one-tooltip-per-series-at-X on hover, a legend (3 series), gridlines
// recessive one step off the surface.
export function AiVisibilityTrendChart({ points }: { points: readonly AiVisibilityTrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough runs yet for a trend line — keep measuring (or enable Otomatik Pilot) to build one up.
      </p>
    );
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xFor = (index: number) => PADDING.left + (index / (points.length - 1)) * plotWidth;
  const yFor = (pct: number) => PADDING.top + plotHeight - (pct / 100) * plotHeight;

  const linePathFor = (key: (typeof SERIES)[number]["key"]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p[key])}`).join(" ");

  const gridPcts = [0, 25, 50, 75, 100];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="AI visibility trend: Mentioned, Open, and Contested percentage over time"
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const relativeX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          const index = Math.round(((relativeX - PADDING.left) / plotWidth) * (points.length - 1));
          setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
        }}
      >
        {gridPcts.map((pct) => (
          <line
            key={pct}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yFor(pct)}
            y2={yFor(pct)}
            stroke="currentColor"
            strokeWidth={1}
            className="text-white/10"
          />
        ))}
        {gridPcts.map((pct) => (
          <text key={pct} x={PADDING.left - 6} y={yFor(pct)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
            {pct}%
          </text>
        ))}
        <text x={xFor(0)} y={HEIGHT - 6} textAnchor="start" className="fill-muted-foreground text-[9px]">
          {formatDate(points[0].runAt)}
        </text>
        <text x={xFor(points.length - 1)} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {formatDate(points[points.length - 1].runAt)}
        </text>

        {SERIES.map((s) => (
          <path key={s.key} d={linePathFor(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            stroke="currentColor"
            strokeWidth={1}
            className="text-white/30"
          />
        )}
        {SERIES.map((s) =>
          hoverIndex !== null ? (
            <circle
              key={s.key}
              cx={xFor(hoverIndex)}
              cy={yFor(points[hoverIndex][s.key])}
              r={4}
              fill={s.color}
              stroke="#1a1a19"
              strokeWidth={2}
            />
          ) : null
        )}
      </svg>
      {hovered && (
        <div className="flex flex-col gap-0.5 rounded-md border border-white/10 bg-black/30 p-2 text-xs">
          <span className="text-muted-foreground">{new Date(hovered.runAt).toLocaleString()}</span>
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-foreground">{hovered[s.key]}%</span>
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
