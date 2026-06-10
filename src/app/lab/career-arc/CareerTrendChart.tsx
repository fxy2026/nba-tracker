"use client";

// Per-season career stat trend — hand-rolled SVG (no chart lib), following the
// idiom in src/components/ScoringFlow.tsx and the existing
// src/components/player/PlayerCareerChart.tsx (referenced, not edited). Adds:
//  • a metric toggle (PPG / RPG / APG / FG% / MIN)
//  • a highlighted PEAK season
//  • a ring marker on whichever season the parent scrubber has selected, and
//    click-to-jump so the chart drives the scrubber too (two-way link).

import { memo, useMemo } from "react";
import type { CareerSeason } from "./types";

export type MetricKey = "PTS" | "REB" | "AST" | "FG_PCT" | "MIN";

const METRICS: readonly { key: MetricKey; zh: string; en: string; pct: boolean }[] = [
  { key: "PTS", zh: "得分", en: "PPG", pct: false },
  { key: "REB", zh: "篮板", en: "RPG", pct: false },
  { key: "AST", zh: "助攻", en: "APG", pct: false },
  { key: "FG_PCT", zh: "命中率", en: "FG%", pct: true },
  { key: "MIN", zh: "时间", en: "MIN", pct: false },
];

interface Props {
  seasons: CareerSeason[];
  metric: MetricKey;
  onMetricChange: (m: MetricKey) => void;
  /** Index (into `seasons`) the scrubber currently has selected. */
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  isZh: boolean;
}

export default memo(function CareerTrendChart({
  seasons,
  metric,
  onMetricChange,
  selectedIndex,
  onSelectIndex,
  isZh,
}: Props) {
  const m = METRICS.find((x) => x.key === metric)!;

  // Keep every season on the x-axis (the scrubber indexes the same array), but
  // null out points where this metric is missing so the line skips them.
  const values = useMemo(
    () => seasons.map((s) => {
      const v = s[metric];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }),
    [seasons, metric]
  );

  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);

  const fmtValue = (v: number) => (m.pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(1));
  const fmtTick = (v: number) =>
    m.pct ? `${Math.round(v * 100)}%` : v >= 10 ? String(Math.round(v)) : v.toFixed(1);

  const pillButtons = METRICS.map((mt) => (
    <button
      key={mt.key}
      onClick={() => onMetricChange(mt.key)}
      aria-pressed={metric === mt.key}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
        metric === mt.key
          ? "bg-accent text-white shadow-md"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
      }`}
    >
      {isZh ? mt.zh : mt.en}
    </button>
  ));

  // Peak season for this metric (the valid point with the highest value).
  let peak: { v: number; i: number } | null = null;
  for (const p of valid) {
    if (!peak || p.v > peak.v) peak = p;
  }

  if (valid.length < 2) {
    return (
      <div className="glass-tile overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{isZh ? "生涯走势" : "Career Trend"}</h3>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-1 mb-3">{pillButtons}</div>
          <p className="text-xs text-text-secondary text-center py-8">
            {isZh ? "该项数据不足以绘制曲线" : "Not enough data to chart this stat"}
          </p>
        </div>
      </div>
    );
  }

  const w = 600;
  const h = 200;
  const pad = { top: 16, right: 14, bottom: 28, left: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxV = Math.max(...valid.map((p) => p.v));
  const domainMax = Math.max(maxV * 1.08, m.pct ? 0.05 : 1);
  const n = seasons.length;
  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => pad.left + i * xStep;
  const y = (v: number) => pad.top + plotH - (v / domainMax) * plotH;

  // Build the line over only the valid points (skips missing seasons).
  const linePath = valid
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(" ");
  const first = valid[0];
  const lastP = valid[valid.length - 1];
  const areaPath = `${linePath} L${x(lastP.i).toFixed(1)},${pad.top + plotH} L${x(first.i).toFixed(1)},${pad.top + plotH} Z`;

  const labelStep = Math.max(1, Math.ceil(n / 8));
  const showLabel = (i: number) => i === n - 1 || i === selectedIndex || (i % labelStep === 0 && n - 1 - i >= labelStep);

  const selValue = values[selectedIndex];

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{isZh ? "生涯走势" : "Career Trend"}</h3>
        {peak && (
          <span className="text-[10px] text-text-secondary whitespace-nowrap">
            {isZh ? "峰值" : "Peak"}{" "}
            <span className="text-accent-amber font-bold">{fmtValue(peak.v)}</span> · {seasons[peak.i].SEASON_ID}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-3">{pillButtons}</div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={
            isZh
              ? `生涯逐赛季${m.zh}曲线，共 ${n} 个赛季`
              : `Career ${m.en} by season, ${n} seasons`
          }
        >
          {/* Y-axis gridlines */}
          {[0, domainMax / 2, domainMax].map((v, i) => (
            <g key={i}>
              <line x1={pad.left} y1={y(v)} x2={w - pad.right} y2={y(v)} stroke="var(--border)" strokeWidth={0.5} />
              <text x={pad.left - 4} y={y(v)} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={9}>
                {fmtTick(v)}
              </text>
            </g>
          ))}

          {/* Selected-season guide line */}
          {n > 1 && (
            <line
              x1={x(selectedIndex)}
              y1={pad.top}
              x2={x(selectedIndex)}
              y2={pad.top + plotH}
              stroke="var(--accent-amber)"
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.7}
            />
          )}

          {/* Area + line */}
          <path d={areaPath} fill="var(--accent)" fillOpacity={0.08} />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots — peak highlighted, selected season ringed; click jumps the scrubber */}
          {valid.map((p) => {
            const isPeak = peak ? p.i === peak.i : false;
            const isSel = p.i === selectedIndex;
            return (
              <g key={p.i}>
                {isSel && (
                  <circle cx={x(p.i)} cy={y(p.v)} r={7} fill="none" stroke="var(--accent-amber)" strokeWidth={1.5} />
                )}
                <circle
                  cx={x(p.i)}
                  cy={y(p.v)}
                  r={isPeak ? 4.5 : 3.2}
                  fill={isPeak ? "var(--accent-amber)" : "var(--accent)"}
                  stroke="var(--bg-card)"
                  strokeWidth={1.5}
                  className="cursor-pointer"
                  onClick={() => onSelectIndex(p.i)}
                >
                  <title>{`${seasons[p.i].SEASON_ID} (${seasons[p.i].TEAM_ABBREVIATION}) · ${fmtValue(p.v)} ${isZh ? m.zh : m.en}`}</title>
                </circle>
              </g>
            );
          })}

          {/* Invisible wide hit targets so empty seasons are still clickable */}
          {seasons.map((s, i) => (
            <rect
              key={`hit-${i}`}
              x={x(i) - xStep / 2}
              y={pad.top}
              width={Math.max(xStep, 8)}
              height={plotH}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSelectIndex(i)}
            >
              <title>{`${s.SEASON_ID} (${s.TEAM_ABBREVIATION})`}</title>
            </rect>
          ))}

          {/* X-axis season labels */}
          {seasons.map((s, i) =>
            showLabel(i) ? (
              <text
                key={`label-${i}`}
                x={x(i)}
                y={h - 8}
                textAnchor="middle"
                fill={i === selectedIndex ? "var(--accent-amber)" : "var(--text-secondary)"}
                fontSize={8}
                fontWeight={i === selectedIndex ? 700 : 400}
              >
                {s.SEASON_ID}
              </text>
            ) : null
          )}
        </svg>

        {selValue !== null && selValue !== undefined && (
          <p className="text-[11px] text-text-secondary mt-1 text-center">
            {seasons[selectedIndex].SEASON_ID} · {seasons[selectedIndex].TEAM_ABBREVIATION} ·{" "}
            <span className="text-accent-amber font-bold">{fmtValue(selValue)}</span> {isZh ? m.zh : m.en}
          </p>
        )}
      </div>
    </div>
  );
});
