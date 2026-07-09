"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";

// One scorer's cumulative-points timeline. `points[i]` is the running total
// after action `i` (same index space across all players — the x-axis is the
// chronological action index of every scoring play in the game).
export interface ScorerSeries {
  personId: number;
  name: string;
  teamTricode: string;
  color: string;
  total: number;
  points: number[];
}

interface Props {
  // Length === number of scoring actions + 1 (index 0 is the pre-tip 0-0 state).
  series: ScorerSeries[];
  // Action index at which each quarter STARTS (first boundary is quarter 2's
  // tip, etc.) — used to draw vertical gridlines + period labels.
  quarterStarts: { index: number; label: string }[];
  // Total number of x-steps (series[*].points.length).
  steps: number;
}

const W = 760;
const H = 360;
const PAD = { top: 18, right: 16, bottom: 30, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export default memo(function TakeoverChart({ series, quarterStarts, steps }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  // Hovered x-step (action index). null = nothing hovered.
  const [hover, setHover] = useState<number | null>(null);

  // Navigating between games is a soft nav that reuses this instance — clear a
  // stale hover index or it reads `points[oldIndex]` (undefined → NaN coords).
  useEffect(() => {
    setHover(null);
  }, [series, steps]);

  if (series.length === 0 || steps < 2) return null;

  const maxPts = Math.max(...series.map((s) => s.total), 1);
  const maxX = steps - 1;

  const toX = (i: number) => PAD.left + (i / maxX) * PLOT_W;
  const toY = (v: number) => PAD.top + PLOT_H - (v / maxPts) * PLOT_H;

  // The player with the most points at the very end — highlighted as the
  // game's scoring leader (thicker line + end annotation).
  const leaderId = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]).personId;

  // Y gridlines at sensible point intervals.
  const yTicks: number[] = [];
  const tickStep = maxPts <= 20 ? 5 : maxPts <= 40 ? 10 : 15;
  for (let v = 0; v <= maxPts; v += tickStep) yTicks.push(v);

  const hoverX = hover != null ? toX(hover) : 0;

  // Map a pointer x onto the nearest x-step. Shared by move + down so a tap
  // (touch) reads the same as a hover (mouse) — pointer events cover both.
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.left) / PLOT_W;
    const i = Math.round(ratio * maxX);
    setHover(Math.max(0, Math.min(maxX, i)));
  };

  return (
    <div className="glass-tile p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        {series.map((s) => {
          return (
            <Link
              key={s.personId}
              href={`/player/${s.personId}`}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <span
                className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 bg-bg-hover"
                style={{ boxShadow: `0 0 0 2px ${s.color}` }}
              >
                <Image
                  src={playerHeadshotUrl(s.personId, "260x190")}
                  alt={s.name}
                  width={28}
                  height={28}
                  unoptimized
                  className="object-cover object-top"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate max-w-[120px]">
                  {s.name}
                </span>
                <span className="block text-[10px] font-mono tabular-nums" style={{ color: s.color }}>
                  {s.teamTricode} · {hover != null ? s.points[hover] : s.total} {isZh ? "分" : "PTS"}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none touch-none"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={
          isZh ? "球员累计得分接管曲线" : "Player cumulative-points takeover curves"
        }
        onPointerLeave={() => setHover(null)}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
      >
        {/* Y-axis grid + labels */}
        {yTicks.map((v) => {
          const y = toY(v);
          return (
            <g key={`y${v}`}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth={0.3} />
              <text x={PAD.left - 4} y={y} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={8}>
                {v}
              </text>
            </g>
          );
        })}

        {/* Quarter boundary lines */}
        {quarterStarts.map((q) => (
          <g key={q.label}>
            <line
              x1={toX(q.index)}
              y1={PAD.top}
              x2={toX(q.index)}
              y2={PAD.top + PLOT_H}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            <text x={toX(q.index)} y={H - 8} textAnchor="middle" fill="var(--text-secondary)" fontSize={8}>
              {q.label}
            </text>
          </g>
        ))}

        {/* Hover guide line */}
        {hover != null && (
          <line x1={hoverX} y1={PAD.top} x2={hoverX} y2={PAD.top + PLOT_H} stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="2,2" />
        )}

        {/* Player lines — leader drawn last (on top) and thicker */}
        {series
          .slice()
          .sort((a, b) => (a.personId === leaderId ? 1 : 0) - (b.personId === leaderId ? 1 : 0))
          .map((s) => {
            const isLeader = s.personId === leaderId;
            const d = s.points
              .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
              .join(" ");
            return (
              <path
                key={s.personId}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={isLeader ? 2.6 : 1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={hover == null || isLeader ? 1 : 0.85}
              />
            );
          })}

        {/* Hover dots + end labels */}
        {series.map((s) => {
          const lastI = maxX;
          const endY = toY(s.points[lastI]);
          return (
            <g key={`end${s.personId}`}>
              {hover != null && (
                <circle cx={hoverX} cy={toY(s.points[hover])} r={3} fill={s.color} stroke="var(--bg-card)" strokeWidth={1.2} />
              )}
              <circle cx={toX(lastI)} cy={endY} r={s.personId === leaderId ? 3.6 : 2.6} fill={s.color} stroke="var(--bg-card)" strokeWidth={1.2} />
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-[10px] text-text-secondary text-center">
        {isZh
          ? "横轴为每次得分事件的时间顺序 · 悬停或点按查看当时各球员得分 · 最粗线为本场得分王"
          : "X-axis = chronological scoring events · hover or tap to read each player's points at that moment · thickest line is the game's top scorer"}
      </p>
    </div>
  );
});
