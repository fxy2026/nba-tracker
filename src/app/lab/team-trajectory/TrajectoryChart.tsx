"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { TeamTrajectory, TrajectoryPoint } from "@/lib/team-trajectory";

type MetricKey = "winPct" | "pointDiff";
type ConfFilter = "all" | "East" | "West";

interface Props {
  trajectories: TeamTrajectory[];
  /** Highest game count reached league-wide — sets the x-domain. */
  maxGames: number;
}

const METRICS: readonly { key: MetricKey; zh: string; en: string }[] = [
  { key: "winPct", zh: "胜率", en: "Win %" },
  { key: "pointDiff", zh: "净胜分(累计)", en: "Cumulative Diff" },
];

const CONFS: readonly { key: ConfFilter; zh: string; en: string }[] = [
  { key: "all", zh: "全", en: "All" },
  { key: "East", zh: "东", en: "East" },
  { key: "West", zh: "西", en: "West" },
];

// Hovered-point payload for the tooltip overlay.
interface Hover {
  tri: string;
  cx: number;
  cy: number;
  game: number;
  wins: number;
  losses: number;
  metricLabel: string;
}

function metricValue(p: { winPct: number; pointDiff: number }, key: MetricKey): number {
  return key === "winPct" ? p.winPct : p.pointDiff;
}

export default memo(function TrajectoryChart({ trajectories, maxGames }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  const [metric, setMetric] = useState<MetricKey>("winPct");
  const [conf, setConf] = useState<ConfFilter>("all");
  // Tricode of the line the user clicked to spotlight; null = none highlighted.
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const m = METRICS.find((x) => x.key === metric)!;

  // Teams shown for the active conference filter, keeping only those with data.
  const visible = useMemo(
    () =>
      trajectories.filter(
        (t) => (conf === "all" || t.conference === conf) && t.points.length > 0
      ),
    [trajectories, conf]
  );

  // Spotlight only applies when the selected team is in the current filter —
  // otherwise switching conference would dim every line to 0.12 with nothing lit.
  const effectiveSelected = useMemo(
    () => (selected && visible.some((t) => t.tricode === selected) ? selected : null),
    [selected, visible]
  );

  // A stale hover marker (cx/cy computed for the old metric/domain) must clear
  // when the plotted data changes, or it floats at a position with no line.
  useEffect(() => {
    setHover(null);
  }, [metric, conf, selected]);

  // SVG geometry — viewBox scales to container width; pad leaves room for axes.
  const w = 720;
  const h = 320;
  const pad = { top: 16, right: 16, bottom: 30, left: 42 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const xMax = Math.max(maxGames, 1);

  // Y-domain from the active metric across all visible teams. Win% is fixed
  // 0..1; point-diff is symmetric around 0 so positive/negative read clearly.
  const { yMin, yMax } = useMemo(() => {
    if (metric === "winPct") return { yMin: 0, yMax: 1 };
    let max = 0;
    for (const t of visible) {
      for (const p of t.points) {
        const v = Math.abs(p.pointDiff);
        if (v > max) max = v;
      }
    }
    const bound = Math.max(Math.ceil(max / 25) * 25, 25);
    return { yMin: -bound, yMax: bound };
  }, [visible, metric]);

  const toX = (game: number) => pad.left + (game / xMax) * plotW;
  const toY = (v: number) =>
    pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Pre-build one path per visible team for the active metric.
  const lines = useMemo(
    () =>
      visible.map((t) => {
        const d = t.points
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"}${toX(p.game).toFixed(1)},${toY(
                metricValue(p, metric)
              ).toFixed(1)}`
          )
          .join(" ");
        return { tri: t.tricode, team: t, d };
      }),
    // toX/toY close over yMin/yMax/xMax which all derive from these deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, metric, yMin, yMax, xMax]
  );

  const fmtMetric = (v: number) =>
    metric === "winPct" ? `${(v * 100).toFixed(1)}%` : `${v >= 0 ? "+" : ""}${v}`;

  // Y-axis ticks: win% at .25 cadence, point-diff at the zero line + bounds.
  const yTicks =
    metric === "winPct"
      ? [0, 0.25, 0.5, 0.75, 1]
      : [yMin, yMin / 2, 0, yMax / 2, yMax];

  const fmtTick = (v: number) =>
    metric === "winPct" ? `${Math.round(v * 100)}%` : `${v >= 0 ? "+" : ""}${Math.round(v)}`;

  // X-axis ticks every ~10 games up to the league max.
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let g = 10; g <= xMax; g += 10) ticks.push(g);
    if (xMax > 0 && (ticks.length === 0 || ticks[ticks.length - 1] !== xMax))
      ticks.push(xMax);
    return ticks;
  }, [xMax]);

  const pillBase =
    "px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer";

  if (visible.length === 0) {
    return (
      <div className="glass-tile p-6 text-center">
        <p className="text-sm text-text-secondary">
          {isZh
            ? "暂无已结束的常规赛比赛可绘制轨迹。"
            : "No finished regular-season games to chart yet."}
        </p>
      </div>
    );
  }

  // Tiny per-point targets can't be tapped, so hover is driven from the parent
  // <svg>: map the pointer into viewBox space and snap to the spotlighted team's
  // nearest point. Covers mouse + touch (pointer events fire for both).
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (effectiveSelected === null) return;
    const team = visible.find((t) => t.tricode === effectiveSelected);
    if (!team || team.points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const py = ((e.clientY - rect.top) / rect.height) * h;
    let best: TrajectoryPoint | null = null;
    let bestCx = 0;
    let bestCy = 0;
    let bestD = Infinity;
    for (const p of team.points) {
      const cx = toX(p.game);
      const cy = toY(metricValue(p, metric));
      const dx = cx - px;
      const dy = cy - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
        bestCx = cx;
        bestCy = cy;
      }
    }
    // ~40px capture radius in viewBox units keeps taps off the line quiet.
    if (best && bestD <= 40 * 40) {
      setHover({
        tri: effectiveSelected,
        cx: bestCx,
        cy: bestCy,
        game: best.game,
        wins: best.wins,
        losses: best.losses,
        metricLabel: fmtMetric(metricValue(best, metric)),
      });
    } else {
      setHover(null);
    }
  };

  return (
    <div className="glass-tile p-4 sm:p-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Metric toggle pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/70 mr-1">
            {isZh ? "指标" : "Metric"}
          </span>
          {METRICS.map((mt) => (
            <button
              key={mt.key}
              onClick={() => setMetric(mt.key)}
              aria-pressed={metric === mt.key}
              className={`${pillBase} ${
                metric === mt.key
                  ? "bg-accent text-white shadow-md"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {isZh ? mt.zh : mt.en}
            </button>
          ))}
        </div>
        {/* Conference filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/70 mr-1">
            {isZh ? "分区" : "Conference"}
          </span>
          {CONFS.map((c) => (
            <button
              key={c.key}
              onClick={() => setConf(c.key)}
              aria-pressed={conf === c.key}
              className={`${pillBase} ${
                conf === c.key
                  ? "bg-accent-amber text-white shadow-md"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {isZh ? c.zh : c.en}
            </button>
          ))}
          {effectiveSelected && (
            <button
              onClick={() => setSelected(null)}
              className="ml-auto text-[11px] text-text-secondary hover:text-accent transition-colors cursor-pointer underline underline-offset-2"
            >
              {isZh ? "清除高亮" : "Clear highlight"}
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full touch-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={
            isZh
              ? `球队赛季轨迹图 — ${visible.length} 支球队的逐场${m.zh}`
              : `Team season trajectory chart — per-game ${m.en} for ${visible.length} teams`
          }
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHover(null)}
        >
          {/* Y-axis gridlines + labels */}
          {yTicks.map((v, i) => {
            const y = toY(v);
            const isZero = metric === "pointDiff" && Math.abs(v) < 0.001;
            return (
              <g key={`y-${i}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={w - pad.right}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={isZero ? 0.8 : 0.3}
                  strokeDasharray={isZero ? undefined : "2,3"}
                />
                <text
                  x={pad.left - 5}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill="var(--text-secondary)"
                  fontSize={9}
                >
                  {fmtTick(v)}
                </text>
              </g>
            );
          })}
          {/* X-axis ticks + labels */}
          {xTicks.map((g) => (
            <g key={`x-${g}`}>
              <line
                x1={toX(g)}
                y1={pad.top}
                x2={toX(g)}
                y2={pad.top + plotH}
                stroke="var(--border)"
                strokeWidth={0.3}
                strokeDasharray="2,3"
              />
              <text
                x={toX(g)}
                y={h - 8}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize={9}
              >
                {g}
              </text>
            </g>
          ))}
          {/* Team lines — faint by default; spotlight the selected team and
              fade the rest when one is picked. */}
          {lines.map(({ tri, team, d }) => {
            const isSel = effectiveSelected === tri;
            const dim = effectiveSelected !== null && !isSel;
            return (
              <path
                key={tri}
                d={d}
                fill="none"
                stroke={team.primaryColor}
                strokeWidth={isSel ? 2.4 : 1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dim ? 0.12 : effectiveSelected === null ? 0.5 : 1}
                style={{ transition: "opacity 0.15s, stroke-width 0.15s" }}
              />
            );
          })}

          {/* End-of-line marker so single-game (one-point) series stay visible
              and the latest standing reads at a glance. */}
          {lines.map(({ tri, team }) => {
            const last = team.points.at(-1);
            if (!last) return null;
            const isSel = effectiveSelected === tri;
            const dim = effectiveSelected !== null && !isSel;
            return (
              <circle
                key={`end-${tri}`}
                cx={toX(last.game)}
                cy={toY(metricValue(last, metric))}
                r={isSel ? 3 : 2}
                fill={team.primaryColor}
                opacity={dim ? 0.12 : effectiveSelected === null ? 0.5 : 1}
                style={{ transition: "opacity 0.15s" }}
              />
            );
          })}

          {/* Hover marker + value dot */}
          {hover && (
            <circle
              cx={hover.cx}
              cy={hover.cy}
              r={3.5}
              fill="var(--accent-amber)"
              stroke="var(--bg-card)"
              strokeWidth={1.5}
            />
          )}
        </svg>

        {/* HTML tooltip positioned over the SVG via percentage coords so it
            tracks the scaled viewBox on every screen size. */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-bg-card px-2.5 py-1.5 shadow-lg"
            style={{
              left: `${(hover.cx / w) * 100}%`,
              top: `${(hover.cy / h) * 100}%`,
              marginTop: -8,
            }}
          >
            <p className="text-[11px] font-bold font-mono text-text-primary leading-tight">
              {hover.tri}
            </p>
            <p className="text-[10px] text-text-secondary leading-tight whitespace-nowrap">
              {isZh ? "第" : "Game"} {hover.game}
              {isZh ? "场" : ""} · {hover.wins}-{hover.losses} ·{" "}
              <span className="text-accent-amber font-semibold">{hover.metricLabel}</span>
            </p>
          </div>
        )}
      </div>

      {/* Axis caption */}
      <p className="mt-1 text-center text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">
        {isZh ? "横轴：比赛场次" : "X-axis: game number"}
      </p>

      {/* Legend — click a team to spotlight its line, others fade. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {visible.map((t) => {
          const isSel = effectiveSelected === t.tricode;
          const last = t.points.at(-1);
          return (
            <button
              key={t.tricode}
              onClick={() => setSelected(isSel ? null : t.tricode)}
              aria-pressed={isSel}
              title={
                last
                  ? `${t.city} ${t.name} · ${last.wins}-${last.losses}`
                  : `${t.city} ${t.name}`
              }
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-mono font-medium transition-all cursor-pointer ${
                isSel
                  ? "bg-bg-hover text-text-primary ring-1 ring-accent"
                  : effectiveSelected !== null
                  ? "text-text-secondary/50 hover:text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: t.primaryColor }}
              />
              {t.tricode}
            </button>
          );
        })}
      </div>
    </div>
  );
});
