"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export interface PointDiffGame {
  gameId: string;
  opponent: string;
  opponentId: number;
  home: boolean;
  won: boolean;
  score: string; // "scored-allowed"
  date: string;  // YYYY-MM-DD
}

interface Props {
  games: PointDiffGame[]; // most recent first
  title: string;
  teamColor?: string;
  count?: number;
}

export default function PointDiffChart({ games, title, teamColor = "#3B82F6", count = 15 }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const last = games.slice(0, count).slice().reverse(); // chronological for display
  const [hovered, setHovered] = useState<number | null>(null);

  const diffs = last.map((g) => {
    const [scored, allowed] = g.score.split("-").map(Number);
    return scored - allowed;
  });

  if (diffs.length === 0) return null;

  const maxAbs = Math.max(...diffs.map(Math.abs), 10);
  const yMax = Math.ceil(maxAbs / 5) * 5;

  const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const best = Math.max(...diffs);
  const worst = Math.min(...diffs);
  const wins = last.filter((g) => g.won).length;
  const losses = last.length - wins;

  // 3-game rolling average for trend line
  const trend: (number | null)[] = diffs.map((_, i) => {
    if (i < 2) return null;
    const window = diffs.slice(Math.max(0, i - 2), i + 1);
    return window.reduce((s, d) => s + d, 0) / window.length;
  });

  // Chart geometry — use HTML container with explicit dimensions; SVG only for bars/lines.
  const chartHeight = 220; // px
  const yAxisWidth = 36;   // px, reserved for y-axis labels
  // SVG inner uses a unit-less coordinate system that matches percentage layout
  // Bars positioned 0..100 horizontally, value -yMax..+yMax vertically
  const innerH = 100; // SVG viewBox height
  const midY = innerH / 2;
  const valueToY = (v: number) => midY - (v / yMax) * (innerH / 2);
  const barWidth = 100 / last.length;
  const barGap = barWidth * 0.22;
  const barInnerW = barWidth - barGap * 2;
  const indexToX = (i: number) => i * barWidth + barWidth / 2;

  // Y-axis label values (top to bottom)
  const yLabels = [yMax, Math.round(yMax / 2), 0, -Math.round(yMax / 2), -yMax];

  // Trend path in viewBox coords
  const trendPath = trend
    .map((t, i) => {
      if (t === null) return null;
      const x = indexToX(i);
      const y = valueToY(t);
      return `${i === 2 || trend[i - 1] === null ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");

  // Avg position as percent of chart height
  const avgPct = ((midY - valueToY(avg)) / innerH + 0.5);
  // Simpler: directly compute pct
  const avgTopPct = (valueToY(avg) / innerH) * 100;
  void avgPct;

  return (
    <div className="glass-tile p-5 mt-6 relative overflow-hidden">
      {/* Subtle team-color halo */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${teamColor}10, transparent)` }}
      />

      {/* Header strip */}
      <div className="relative flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Form</p>
          <h3 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-0.5">
            <Activity size={15} style={{ color: teamColor }} />
            {title}
          </h3>
        </div>
        <div className="flex items-stretch gap-0 divide-x divide-border/60 rounded-xl glass-tile px-1">
          {[
            { label: "AVG", value: `${avg >= 0 ? "+" : ""}${avg.toFixed(1)}`, color: avg >= 0 ? "text-success" : "text-danger" },
            { label: "BEST", value: `+${best}`, color: "text-success" },
            { label: "WORST", value: `${worst}`, color: "text-danger" },
            { label: "W-L", value: `${wins}-${losses}`, color: "text-text-primary" },
          ].map((s) => (
            <div key={s.label} className="px-3 py-1.5 text-right">
              <p className="text-[8px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">{s.label}</p>
              <p className={`text-sm tabular-nums font-light font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: chartHeight, paddingLeft: yAxisWidth }}>
        {/* Y-axis labels (HTML, not SVG, so they don't get distorted) */}
        <div className="absolute left-0 inset-y-0 flex flex-col justify-between text-[10px] font-mono tabular-nums text-text-secondary/70 pointer-events-none" style={{ width: yAxisWidth - 6 }}>
          {yLabels.map((v, i) => (
            <div key={i} className="text-right pr-1.5 leading-none" style={{ marginTop: i === 0 ? 0 : i === yLabels.length - 1 ? 0 : "-0.5em" }}>
              {v > 0 ? `+${v}` : v}
            </div>
          ))}
        </div>

        {/* Chart inner — relative for absolute children */}
        <div className="relative h-full w-full">
          {/* SVG: gridlines, bars, trend line */}
          <svg
            viewBox={`0 0 100 ${innerH}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full block"
            role="img"
            aria-label={isZh
              ? `近 ${last.length} 场净胜分趋势，平均 ${avg >= 0 ? "+" : ""}${avg.toFixed(1)}，战绩 ${wins}-${losses}`
              : `Last ${last.length} games point differential trend, average ${avg >= 0 ? "+" : ""}${avg.toFixed(1)}, record ${wins}-${losses}`}
          >
            <defs>
              <linearGradient id="pdc-pos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="pdc-pos-h" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6EE7B7" stopOpacity="1" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="pdc-neg" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#F87171" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="pdc-neg-h" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#FCA5A5" stopOpacity="1" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.55" />
              </linearGradient>
            </defs>

            {/* Gridlines (lines only — labels are HTML above) */}
            {yLabels.map((v, i) => {
              const y = (i / (yLabels.length - 1)) * innerH;
              const major = v === 0;
              return (
                <line
                  key={i}
                  x1={0}
                  y1={y}
                  x2={100}
                  y2={y}
                  stroke={major ? "var(--border-strong)" : "var(--border)"}
                  strokeWidth={major ? "1" : "0.5"}
                  strokeDasharray={major ? "none" : "2 2"}
                  vectorEffect="non-scaling-stroke"
                  opacity={major ? 0.6 : 0.35}
                />
              );
            })}

            {/* Avg line */}
            {Math.abs(avg) > 0.1 && (
              <line
                x1={0}
                y1={valueToY(avg)}
                x2={100}
                y2={valueToY(avg)}
                stroke={teamColor}
                strokeWidth="1.2"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                opacity="0.75"
              />
            )}

            {/* Bars */}
            {diffs.map((d, i) => {
              const isHovered = hovered === i;
              const x = i * barWidth + barGap;
              const barTop = d >= 0 ? valueToY(d) : midY;
              const barBottom = d >= 0 ? midY : valueToY(d);
              const barH = barBottom - barTop;
              const grad = d >= 0
                ? (isHovered ? "url(#pdc-pos-h)" : "url(#pdc-pos)")
                : (isHovered ? "url(#pdc-neg-h)" : "url(#pdc-neg)");
              return (
                <rect
                  key={i}
                  x={x}
                  y={barTop}
                  width={barInnerW}
                  height={Math.max(barH, 0.6)}
                  rx={0.7}
                  fill={grad}
                  style={{ transition: "fill 150ms" }}
                />
              );
            })}

            {/* Trend line */}
            {trendPath && (
              <path
                d={trendPath}
                fill="none"
                stroke={teamColor}
                strokeWidth="1.3"
                vectorEffect="non-scaling-stroke"
                opacity="0.55"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hover vertical guide */}
            {hovered !== null && (
              <line
                x1={indexToX(hovered)}
                x2={indexToX(hovered)}
                y1={0}
                y2={innerH}
                stroke={teamColor}
                strokeWidth="0.8"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
                opacity="0.45"
              />
            )}
          </svg>

          {/* Avg label (HTML so it doesn't distort) */}
          {Math.abs(avg) > 0.1 && (
            <div
              className="absolute right-0 text-[10px] font-mono font-bold tabular-nums pointer-events-none px-1 rounded"
              style={{
                top: `${avgTopPct}%`,
                transform: "translateY(-115%)",
                color: teamColor,
                background: "var(--bg-card)",
              }}
            >
              avg {avg >= 0 ? "+" : ""}{avg.toFixed(1)}
            </div>
          )}

          {/* Hover overlay — captures pointer for each bar slot */}
          <div className="absolute inset-0 flex">
            {last.map((g, i) => (
              <Link
                key={i}
                href={`/game/${g.gameId}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className="flex-1 cursor-pointer"
                aria-label={`${g.won ? "W" : "L"} ${g.home ? "vs" : "@"} ${g.opponent} ${g.score}`}
              />
            ))}
          </div>

          {/* Tooltip — anchored at top-center of the chart, never overflows.
              The vertical guide line shows which bar is being hovered. */}
          {hovered !== null && last[hovered] && (() => {
            const g = last[hovered];
            const d = diffs[hovered];
            return (
              <div
                className="absolute pointer-events-none z-10 glass-tile px-3 py-1.5 text-xs font-mono shadow-2xl flex items-center gap-2 whitespace-nowrap"
                style={{ top: "6px", left: "50%", transform: "translateX(-50%)", maxWidth: "calc(100% - 16px)" }}
              >
                <span className="text-[9px] uppercase tracking-[0.18em] text-text-secondary">
                  {g.date.slice(5).replace("-", "/")}
                </span>
                <span className="text-text-secondary/40">·</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.won ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                  {g.won ? "W" : "L"}
                </span>
                <span className="text-text-secondary text-[10px]">{g.home ? "vs" : "@"} {g.opponent}</span>
                <span className="text-sm tabular-nums text-text-primary">{g.score}</span>
                <span className={`text-sm font-bold tabular-nums ${d >= 0 ? "text-success" : "text-danger"}`}>
                  ({d > 0 ? "+" : ""}{d})
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* W/L strip — thin pill row */}
      <div className="relative mt-4" style={{ paddingLeft: yAxisWidth }}>
        <div className="flex gap-px">
          {last.map((g, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 ${g.won ? "bg-success/80" : "bg-danger/80"} ${i === 0 ? "rounded-l-full" : ""} ${i === last.length - 1 ? "rounded-r-full" : ""} transition-opacity ${hovered === i ? "opacity-100" : "opacity-70"}`}
              title={`${g.won ? "W" : "L"} ${g.home ? "vs" : "@"} ${g.opponent}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] font-mono tabular-nums text-text-secondary/60 mt-1.5">
          <span>{last[0]?.date.slice(5).replace("-", "/")}</span>
          <span className="text-text-secondary/40">{last.length} games</span>
          <span>{last[last.length - 1]?.date.slice(5).replace("-", "/")}</span>
        </div>
      </div>
    </div>
  );
}
