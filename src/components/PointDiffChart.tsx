"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

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

  // Chart dimensions
  const chartH = 220;
  const chartW = 100; // viewBox width as percent
  const padTop = 22;
  const padBottom = 22;
  const padLeft = 6;
  const padRight = 2;
  const innerH = chartH - padTop - padBottom;
  const innerW = chartW - padLeft - padRight;
  const midY = padTop + innerH / 2;

  const barWidth = innerW / last.length;
  const barGap = barWidth * 0.22;
  const barInnerW = barWidth - barGap * 2;

  const valueToY = (v: number) => midY - (v / yMax) * (innerH / 2);
  const indexToX = (i: number) => padLeft + i * barWidth + barWidth / 2;

  const avgY = valueToY(avg);

  // Gridlines at clean values
  const gridLines = [
    { value: yMax, y: padTop, major: false },
    { value: yMax / 2, y: midY - (innerH / 4), major: false },
    { value: 0, y: midY, major: true },
    { value: -yMax / 2, y: midY + (innerH / 4), major: false },
    { value: -yMax, y: padTop + innerH, major: false },
  ];

  // Trend path
  const trendPath = trend
    .map((t, i) => {
      if (t === null) return null;
      const x = indexToX(i);
      const y = valueToY(t);
      return `${i === 2 || trend[i - 1] === null ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="glass-tile p-5 mt-6 relative overflow-hidden">
      {/* Subtle team-color halo */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${teamColor}10, transparent)`,
        }}
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
      <div className="relative">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full block" preserveAspectRatio="none" style={{ height: chartH }}>
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
            <filter id="pdc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Gridlines + axis labels */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={g.y}
                x2={chartW - padRight}
                y2={g.y}
                stroke={g.major ? "var(--border-strong)" : "var(--border)"}
                strokeWidth={g.major ? "0.35" : "0.18"}
                strokeDasharray={g.major ? "none" : "0.5 1"}
                vectorEffect="non-scaling-stroke"
                opacity={g.major ? 0.6 : 0.4}
              />
              <text
                x={padLeft - 0.5}
                y={g.y - 0.6}
                fill="var(--text-secondary)"
                fontSize="2.2"
                opacity="0.55"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {g.value > 0 ? `+${g.value}` : g.value === 0 ? "0" : g.value}
              </text>
            </g>
          ))}

          {/* Average line in team color */}
          {Math.abs(avg) > 0.1 && (
            <g>
              <line
                x1={padLeft}
                y1={avgY}
                x2={chartW - padRight}
                y2={avgY}
                stroke={teamColor}
                strokeWidth="0.4"
                strokeDasharray="1.5 1.2"
                vectorEffect="non-scaling-stroke"
                opacity="0.75"
              />
              <text
                x={chartW - padRight - 0.5}
                y={avgY - 0.8}
                textAnchor="end"
                fill={teamColor}
                fontSize="2.2"
                fontFamily="var(--font-mono)"
                opacity="0.9"
                fontWeight="600"
              >
                avg {avg >= 0 ? "+" : ""}{avg.toFixed(1)}
              </text>
            </g>
          )}

          {/* Bars */}
          {diffs.map((d, i) => {
            const isHovered = hovered === i;
            const x = padLeft + i * barWidth + barGap;
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
                filter={isHovered ? "url(#pdc-glow)" : undefined}
                style={{ transition: "fill 150ms" }}
              />
            );
          })}

          {/* Rolling-3 trend line (drawn on top of bars) */}
          {trendPath && (
            <path
              d={trendPath}
              fill="none"
              stroke={teamColor}
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
              opacity="0.55"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover bar highlight (vertical guide) */}
          {hovered !== null && (
            <line
              x1={indexToX(hovered)}
              x2={indexToX(hovered)}
              y1={padTop}
              y2={chartH - padBottom}
              stroke={teamColor}
              strokeWidth="0.3"
              strokeDasharray="0.6 0.6"
              vectorEffect="non-scaling-stroke"
              opacity="0.4"
            />
          )}
        </svg>

        {/* Hover overlay — captures pointer for each bar slot */}
        <div className="absolute inset-0 flex" style={{ padding: `${padTop / chartH * 100}% ${padRight / chartW * 100}% ${padBottom / chartH * 100}% ${padLeft / chartW * 100}%` }}>
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

        {/* Tooltip */}
        {hovered !== null && last[hovered] && (() => {
          const g = last[hovered];
          const d = diffs[hovered];
          const leftPct = (hovered + 0.5) / last.length * 100;
          const isRight = leftPct > 50;
          return (
            <div
              className="absolute pointer-events-none z-10 glass-tile px-3 py-2 text-xs font-mono whitespace-nowrap shadow-2xl"
              style={{
                left: isRight ? "auto" : `${leftPct}%`,
                right: isRight ? `${100 - leftPct}%` : "auto",
                top: "12px",
                transform: isRight ? "translateX(-12px)" : "translateX(12px)",
              }}
            >
              <p className="text-[9px] uppercase tracking-[0.2em] text-text-secondary mb-1">
                {g.date.slice(5).replace("-", "/")} · {g.home ? "vs" : "@"} {g.opponent}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.won ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                  {g.won ? "W" : "L"}
                </span>
                <span className="text-base font-light tabular-nums text-text-primary">{g.score}</span>
                <span className={`text-base font-bold tabular-nums ${d >= 0 ? "text-success" : "text-danger"}`}>
                  ({d > 0 ? "+" : ""}{d})
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* W/L strip — thin pill row */}
      <div className="relative mt-4">
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
