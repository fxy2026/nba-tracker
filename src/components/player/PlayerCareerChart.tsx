"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocale } from "@/components/LocaleProvider";

// Structural subset of the career rows PlayerStatsBundle fetches — both the
// stats.nba.com and ESPN-fallback shapes satisfy it.
export interface CareerChartSeason {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number | null;
  MIN: number | null;
  PTS: number | null;
  REB: number | null;
  AST: number | null;
  FG_PCT: number | null;
}

type MetricKey = "PTS" | "REB" | "AST" | "FG_PCT" | "MIN";

const METRICS: readonly { key: MetricKey; zh: string; en: string; pct: boolean }[] = [
  { key: "PTS", zh: "得分", en: "PPG", pct: false },
  { key: "REB", zh: "篮板", en: "RPG", pct: false },
  { key: "AST", zh: "助攻", en: "APG", pct: false },
  { key: "FG_PCT", zh: "命中率", en: "FG%", pct: true },
  { key: "MIN", zh: "时间", en: "MIN", pct: false },
];

// Traded seasons produce one row per team plus a combined "TOT" row — keep one
// point per season (prefer TOT, else the longest stint) so the x-axis is clean.
function dedupeSeasons(rows: CareerChartSeason[]): CareerChartSeason[] {
  const bySeason = new Map<string, CareerChartSeason>();
  const order: string[] = [];
  for (const r of rows) {
    if (!r.SEASON_ID) continue;
    const prev = bySeason.get(r.SEASON_ID);
    if (!prev) {
      bySeason.set(r.SEASON_ID, r);
      order.push(r.SEASON_ID);
    } else if (
      r.TEAM_ABBREVIATION === "TOT" ||
      (prev.TEAM_ABBREVIATION !== "TOT" && (r.GP ?? 0) > (prev.GP ?? 0))
    ) {
      bySeason.set(r.SEASON_ID, r);
    }
  }
  return order.map((s) => bySeason.get(s)!);
}

interface Props {
  seasons: CareerChartSeason[];
  /** Rendered at the right of the tile header (e.g. the table/chart toggle). */
  headerExtra?: ReactNode;
}

export default function PlayerCareerChart({ seasons, headerExtra }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [metric, setMetric] = useState<MetricKey>("PTS");

  const deduped = useMemo(() => dedupeSeasons(seasons), [seasons]);
  const m = METRICS.find((x) => x.key === metric)!;

  const points = useMemo(
    () =>
      deduped
        .map((s) => ({ season: s.SEASON_ID, team: s.TEAM_ABBREVIATION, value: s[metric] }))
        .filter(
          (p): p is { season: string; team: string; value: number } =>
            typeof p.value === "number" && Number.isFinite(p.value)
        ),
    [deduped, metric]
  );

  const fmtValue = (v: number) => (m.pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(1));
  const fmtTick = (v: number) =>
    m.pct ? `${Math.round(v * 100)}%` : v >= 10 ? String(Math.round(v)) : v.toFixed(1);

  const header = (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{isZh ? "生涯走势" : "Career Trend"}</h3>
      {headerExtra}
    </div>
  );

  const pillButtons = METRICS.map((mt) => (
    <button
      key={mt.key}
      onClick={() => setMetric(mt.key)}
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

  if (points.length < 2) {
    return (
      <div className="glass-tile overflow-hidden">
        {header}
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
  const h = 190;
  const pad = { top: 16, right: 12, bottom: 26, left: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxV = Math.max(...points.map((p) => p.value));
  const domainMax = Math.max(maxV * 1.08, m.pct ? 0.05 : 1);
  const xStep = plotW / (points.length - 1);
  const x = (i: number) => pad.left + i * xStep;
  const y = (v: number) => pad.top + plotH - (v / domainMax) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${pad.top + plotH} L${pad.left},${pad.top + plotH} Z`;

  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].value > points[peakIdx].value) peakIdx = i;
  }
  const peak = points[peakIdx];

  // Skip-label logic: at most ~8 x-axis labels; the last season always shows,
  // and the regular cadence skips its final slot if it would crowd the last.
  const n = points.length;
  const labelStep = Math.max(1, Math.ceil(n / 8));
  const showLabel = (i: number) => i === n - 1 || (i % labelStep === 0 && n - 1 - i >= labelStep);

  return (
    <div className="glass-tile overflow-hidden">
      {header}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {pillButtons}
          <span className="ml-auto text-[10px] text-text-secondary whitespace-nowrap">
            {isZh ? "峰值" : "Peak"}{" "}
            <span className="text-accent-amber font-bold">{fmtValue(peak.value)}</span> · {peak.season}
          </span>
        </div>
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
          {/* Area fill */}
          <path d={areaPath} fill="var(--accent)" fillOpacity={0.08} />
          {/* Line */}
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots with native tooltips; peak season highlighted */}
          {points.map((p, i) => (
            <circle
              key={`${p.season}-${i}`}
              cx={x(i)}
              cy={y(p.value)}
              r={i === peakIdx ? 4 : 3}
              fill={i === peakIdx ? "var(--accent-amber)" : "var(--accent)"}
              stroke="var(--bg-card)"
              strokeWidth={1.5}
            >
              <title>{`${p.season} (${p.team}) · ${fmtValue(p.value)} ${isZh ? m.zh : m.en}`}</title>
            </circle>
          ))}
          {/* X-axis season labels */}
          {points.map((p, i) =>
            showLabel(i) ? (
              <text key={`label-${p.season}-${i}`} x={x(i)} y={h - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize={8}>
                {p.season}
              </text>
            ) : null
          )}
        </svg>
      </div>
    </div>
  );
}
