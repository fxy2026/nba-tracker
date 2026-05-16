"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

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
  // Round up to nearest 5 for clean axis
  const yMax = Math.ceil(maxAbs / 5) * 5;

  const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const best = Math.max(...diffs);
  const worst = Math.min(...diffs);

  const wins = last.filter((g) => g.won).length;
  const losses = last.length - wins;

  const chartH = 180;
  const chartW = 100; // viewBox width, used as %
  const padTop = 18;
  const padBottom = 18;
  const innerH = chartH - padTop - padBottom;
  const midY = padTop + innerH / 2;

  const barWidth = chartW / last.length;
  const barGap = barWidth * 0.18;
  const barInnerW = barWidth - barGap * 2;

  // Average line as percentage of innerH
  const avgY = midY - (avg / yMax) * (innerH / 2);

  // Gridlines at ±yMax/2 and 0
  const gridLines = [
    { value: yMax, y: padTop },
    { value: yMax / 2, y: midY - (innerH / 4) },
    { value: 0, y: midY },
    { value: -yMax / 2, y: midY + (innerH / 4) },
    { value: -yMax, y: padTop + innerH },
  ];

  return (
    <div className="glass-tile p-4 mt-6 relative overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Form</p>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-0.5">
            <Activity size={14} className="text-accent" />
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div className="text-right">
            <p className="text-[8px] uppercase tracking-[0.2em] text-text-secondary/60">Avg</p>
            <p className={`text-base tabular-nums font-light ${avg >= 0 ? "text-success" : "text-danger"}`}>
              {avg >= 0 ? "+" : ""}{avg.toFixed(1)}
            </p>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="text-right">
            <p className="text-[8px] uppercase tracking-[0.2em] text-text-secondary/60">Best</p>
            <p className="text-base tabular-nums font-light text-success">+{best}</p>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="text-right">
            <p className="text-[8px] uppercase tracking-[0.2em] text-text-secondary/60">Worst</p>
            <p className="text-base tabular-nums font-light text-danger">{worst}</p>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="text-right">
            <p className="text-[8px] uppercase tracking-[0.2em] text-text-secondary/60">Record</p>
            <p className="text-base tabular-nums font-light text-text-primary">{wins}-{losses}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Chart SVG */}
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="none" style={{ height: chartH }}>
          <defs>
            <linearGradient id="bar-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="bar-pos-hover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ADE80" stopOpacity="1" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="bar-neg" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#DC2626" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="bar-neg-hover" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#F87171" stopOpacity="1" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={g.y}
                x2={chartW}
                y2={g.y}
                stroke={g.value === 0 ? "var(--border-strong)" : "var(--border)"}
                strokeWidth={g.value === 0 ? "0.3" : "0.15"}
                strokeDasharray={g.value === 0 ? "none" : "0.6 0.6"}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={0.5}
                y={g.y - 0.5}
                fill="var(--text-secondary)"
                fontSize="2.4"
                opacity="0.55"
                fontFamily="var(--font-mono)"
              >
                {g.value > 0 ? `+${g.value}` : g.value === 0 ? "0" : g.value}
              </text>
            </g>
          ))}

          {/* Average dashed line */}
          {Math.abs(avg) > 0.1 && (
            <g>
              <line
                x1={0}
                y1={avgY}
                x2={chartW}
                y2={avgY}
                stroke={teamColor}
                strokeWidth="0.4"
                strokeDasharray="1 1"
                vectorEffect="non-scaling-stroke"
                opacity="0.7"
              />
              <text
                x={chartW - 0.5}
                y={avgY - 0.8}
                textAnchor="end"
                fill={teamColor}
                fontSize="2.4"
                fontFamily="var(--font-mono)"
                opacity="0.85"
              >
                avg {avg >= 0 ? "+" : ""}{avg.toFixed(1)}
              </text>
            </g>
          )}

          {/* Bars */}
          {diffs.map((d, i) => {
            const isHovered = hovered === i;
            const barH = (Math.abs(d) / yMax) * (innerH / 2);
            const x = i * barWidth + barGap;
            const y = d >= 0 ? midY - barH : midY;
            const grad = d >= 0
              ? (isHovered ? "url(#bar-pos-hover)" : "url(#bar-pos)")
              : (isHovered ? "url(#bar-neg-hover)" : "url(#bar-neg)");
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barInnerW}
                  height={Math.max(barH, 0.6)}
                  rx={0.6}
                  fill={grad}
                  style={{ transition: "fill 150ms" }}
                />
                {/* Value above bar */}
                <text
                  x={x + barInnerW / 2}
                  y={d >= 0 ? y - 1.2 : y + barH + 3}
                  textAnchor="middle"
                  fill={d >= 0 ? "var(--success)" : "var(--danger)"}
                  fontSize="2.6"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                  opacity={isHovered ? 1 : 0.85}
                >
                  {d > 0 ? `+${d}` : d}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover overlay — captures pointer events outside the SVG for accuracy */}
        <div className="absolute inset-0 flex">
          {last.map((g, i) => (
            <Link
              key={i}
              href={`/game/${g.gameId}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="flex-1 group cursor-pointer relative"
              aria-label={`${g.won ? "W" : "L"} ${g.home ? "vs" : "@"} ${g.opponent} ${g.score}`}
            >
              <div className="absolute inset-0 hover:bg-accent/[0.04] transition-colors" />
            </Link>
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
              className="absolute pointer-events-none z-10 glass-tile p-2 text-xs font-mono whitespace-nowrap"
              style={{
                left: isRight ? "auto" : `${leftPct}%`,
                right: isRight ? `${100 - leftPct}%` : "auto",
                top: "-8px",
                transform: isRight ? "translateX(8px) translateY(-100%)" : "translateX(-8px) translateY(-100%)",
              }}
            >
              <p className="text-[10px] text-text-secondary mb-0.5">{g.date.slice(5)} · {g.home ? "vs" : "@"} {g.opponent}</p>
              <p className="text-sm font-bold tabular-nums">
                <span className={g.won ? "text-success" : "text-danger"}>{g.won ? "W" : "L"}</span>
                <span className="mx-1.5 text-text-primary">{g.score}</span>
                <span className={d >= 0 ? "text-success" : "text-danger"}>
                  ({d > 0 ? "+" : ""}{d})
                </span>
              </p>
            </div>
          );
        })()}
      </div>

      {/* Bottom dates + W/L strip */}
      <div className="mt-3">
        <div className="flex gap-0">
          {last.map((g, i) => (
            <div
              key={i}
              className={`flex-1 h-1 ${g.won ? "bg-success/70" : "bg-danger/70"} ${i === 0 ? "rounded-l-full" : ""} ${i === last.length - 1 ? "rounded-r-full" : ""} ${i > 0 ? "ml-px" : ""}`}
              title={`${g.won ? "W" : "L"} ${g.home ? "vs" : "@"} ${g.opponent}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] font-mono tabular-nums text-text-secondary/60 mt-1.5">
          <span className="flex items-center gap-1">
            <TrendingDown size={9} />
            {last[0]?.date.slice(5)}
          </span>
          <span className="flex items-center gap-1">
            {last[last.length - 1]?.date.slice(5)}
            <TrendingUp size={9} />
          </span>
        </div>
      </div>
    </div>
  );
}
