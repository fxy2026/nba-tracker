"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import type { ScatterArchive } from "@/lib/scatter-archive";
import { AlertCircle, ScatterChart } from "lucide-react";

import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import { TEAM_META } from "@/lib/teams";

const STATS_API = "/api/stats";

// ── Player row parsed from the leagueleaders 25-column matrix ─────────────
interface PlayerRow {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  GP?: number;
  MIN?: number;
  FGM?: number;
  FGA?: number;
  FG_PCT?: number;
  FG3M?: number;
  FG3A?: number;
  FG3_PCT?: number;
  FTM?: number;
  FTA?: number;
  FT_PCT?: number;
  OREB?: number;
  DREB?: number;
  REB: number;
  AST: number;
  STL?: number;
  BLK?: number;
  TOV?: number;
  PTS: number;
  EFF?: number;
  // derived
  TS_PCT?: number;
}

// Numeric stat keys (and the derived TS%) — accessors avoid string indexing.
type AxisKey =
  | "PTS" | "REB" | "AST" | "STL" | "BLK" | "TOV" | "MIN"
  | "FG_PCT" | "FG3_PCT" | "FT_PCT" | "TS_PCT"
  | "FGA" | "FG3A" | "FTA" | "FG3M" | "OREB" | "DREB" | "EFF" | "GP";

interface AxisMeta {
  key: AxisKey;
  zh: string;
  en: string;
  /** percentage stats are stored 0..1 and displayed as XX.X% */
  pct?: boolean;
  get: (r: PlayerRow) => number;
}

const AXES: AxisMeta[] = [
  { key: "PTS", zh: "得分", en: "Points", get: (r) => r.PTS },
  { key: "REB", zh: "篮板", en: "Rebounds", get: (r) => r.REB },
  { key: "AST", zh: "助攻", en: "Assists", get: (r) => r.AST },
  { key: "STL", zh: "抢断", en: "Steals", get: (r) => r.STL! },
  { key: "BLK", zh: "盖帽", en: "Blocks", get: (r) => r.BLK! },
  { key: "TOV", zh: "失误", en: "Turnovers", get: (r) => r.TOV! },
  { key: "MIN", zh: "出场时间", en: "Minutes", get: (r) => r.MIN! },
  { key: "TS_PCT", zh: "真实命中率", en: "True Shooting %", pct: true, get: (r) => r.TS_PCT! },
  { key: "FG_PCT", zh: "投篮命中率", en: "FG %", pct: true, get: (r) => r.FG_PCT! },
  { key: "FG3_PCT", zh: "三分命中率", en: "3P %", pct: true, get: (r) => r.FG3_PCT! },
  { key: "FT_PCT", zh: "罚球命中率", en: "FT %", pct: true, get: (r) => r.FT_PCT! },
  { key: "FGA", zh: "出手数", en: "FG Attempts", get: (r) => r.FGA! },
  { key: "FG3A", zh: "三分出手", en: "3P Attempts", get: (r) => r.FG3A! },
  { key: "FG3M", zh: "三分命中", en: "3P Made", get: (r) => r.FG3M! },
  { key: "FTA", zh: "罚球出手", en: "FT Attempts", get: (r) => r.FTA! },
  { key: "OREB", zh: "前场篮板", en: "Off. Rebounds", get: (r) => r.OREB! },
  { key: "DREB", zh: "后场篮板", en: "Def. Rebounds", get: (r) => r.DREB! },
  { key: "EFF", zh: "效率值", en: "Efficiency", get: (r) => r.EFF! },
  { key: "GP", zh: "出场数", en: "Games", get: (r) => r.GP! },
];

const AXIS_BY_KEY = new Map(AXES.map((a) => [a.key, a]));

// Minutes-per-game thresholds to drop low-sample noise.
const MIN_THRESHOLDS = [0, 10, 15, 20, 25, 30] as const;

function fmtVal(meta: AxisMeta, v: number): string {
  if (meta.pct) return (v * 100).toFixed(1) + "%";
  return v.toFixed(1);
}

// Pill picker over the ~19 selectable axes. Module-level so it isn't recreated
// every render (and so React doesn't reset its subtree state).
function AxisPicker({
  label, value, isZh, onChange, axes,
}: { label: string; value: AxisKey; isZh: boolean; onChange: (k: AxisKey) => void; axes: AxisMeta[] }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-1.5">/ {label}</p>
      <div className="flex flex-wrap gap-1">
        {axes.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onChange(a.key)}
            aria-pressed={value === a.key}
            className={`min-h-11 min-w-11 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
              value === a.key
                ? "bg-accent text-white shadow-md"
                : "glass-tile text-text-secondary hover:text-text-primary"
            }`}
          >
            {isZh ? a.zh : a.en}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Nice" axis bounds + step for the tick grid. Pads the data range slightly so
// extreme dots aren't glued to the frame, then rounds to a readable increment.
function niceScale(min: number, max: number, pct = false): { lo: number; hi: number; ticks: number[] } {
  if (!isFinite(min) || !isFinite(max) || min === max) {
    const c = isFinite(min) ? min : 0;
    // A pct axis must stay bounded near [0,1] — a ±1 fallback would render a
    // single perfect-FT shooter on a 0–200% axis.
    if (pct) {
      const lo = Math.max(0, c - 0.05);
      const hi = Math.min(1, c + 0.05);
      return { lo, hi, ticks: [lo, (lo + hi) / 2, hi] };
    }
    return { lo: c - 1, hi: c + 1, ticks: [c - 1, c, c + 1] };
  }
  const span = max - min;
  const pad = span * 0.06;
  let lo = min - pad;
  let hi = max + pad;
  if (lo > 0 && lo < span * 0.25) lo = 0; // anchor to zero when close
  const rawStep = (hi - lo) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceStep = (norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5) * mag;
  lo = Math.floor(lo / niceStep) * niceStep;
  hi = Math.ceil(hi / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + niceStep * 0.5; t += niceStep) {
    ticks.push(Math.abs(t) < niceStep * 1e-6 ? 0 : t);
  }
  return { lo, hi, ticks };
}

export default function ScatterExplorer({ archive }: { archive: ScatterArchive }) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [archiveMode, setArchiveMode] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [xKey, setXKey] = useState<AxisKey>("PTS");
  const [yKey, setYKey] = useState<AxisKey>("AST");
  const [minMpg, setMinMpg] = useState(15);

  // active hovered/tapped dot index into the *filtered* list
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(640);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const signal = controller.signal;
    setLoading(true);
    // Keep the current-source failure visible while an archive retry is pending.

    try {
      // No limit → every qualified player in the league comes back in ONE fetch.
      const qs = new URLSearchParams({
        endpoint: "leagueleaders",
        LeagueID: "00",
        PerMode: "PerGame",
        Scope: "S",
        Season: CURRENT_SEASON,
        SeasonType: "Regular Season",
        StatCategory: "PTS",
      }).toString();
      const res = await fetch(`${STATS_API}?${qs}`, { signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const rs = data.resultSet ?? data.resultSets?.[0];
      if (!rs?.headers || !rs?.rowSet) throw new Error("No data");
      const headers: string[] = rs.headers;
      const parsed: PlayerRow[] = rs.rowSet.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        const num = (k: string) => {
          const v = obj[k];
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        const pts = num("PTS");
        const fga = num("FGA");
        const fta = num("FTA");
        // True Shooting % = PTS / (2 · (FGA + 0.44 · FTA)). Guard zero-attempt rows.
        const tsDen = 2 * (fga + 0.44 * fta);
        const ts = tsDen > 0 ? pts / tsDen : 0;
        return {
          PLAYER_ID: num("PLAYER_ID"),
          PLAYER: String(obj.PLAYER ?? ""),
          TEAM: String(obj.TEAM ?? ""),
          GP: num("GP"), MIN: num("MIN"),
          FGM: num("FGM"), FGA: fga, FG_PCT: num("FG_PCT"),
          FG3M: num("FG3M"), FG3A: num("FG3A"), FG3_PCT: num("FG3_PCT"),
          FTM: num("FTM"), FTA: fta, FT_PCT: num("FT_PCT"),
          OREB: num("OREB"), DREB: num("DREB"), REB: num("REB"),
          AST: num("AST"), STL: num("STL"), BLK: num("BLK"), TOV: num("TOV"),
          PTS: pts, EFF: num("EFF"), TS_PCT: ts,
        };
      });
      if (signal.aborted) return;
      if (parsed.length === 0) throw new Error("No data");
      setError("");
      setRows(parsed);
      setArchiveMode(false);
      setActiveIdx(null);
    } catch (e) {
      if (signal?.aborted) return;
      setError(String(e));
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  const axes = archiveMode ? AXES.slice(0, 3) : AXES;
  const xMeta = AXIS_BY_KEY.get(xKey)!;
  const yMeta = AXIS_BY_KEY.get(yKey)!;

  // Filter by minutes threshold; require the player to have logged a game.
  const points = useMemo<PlayerRow[]>(
    () => archiveMode ? archive.rows : rows.filter((r) => (r.GP ?? 0) > 0 && (r.MIN ?? 0) >= minMpg),
    [rows, minMpg, archiveMode, archive.rows]
  );

  const scales = useMemo(() => {
    if (points.length === 0) return null;
    const xs = points.map((r) => xMeta.get(r));
    const ys = points.map((r) => yMeta.get(r));
    return {
      x: niceScale(Math.min(...xs), Math.max(...xs), xMeta.pct),
      y: niceScale(Math.min(...ys), Math.max(...ys), yMeta.pct),
    };
  }, [points, xMeta, yMeta]);

  // Reset the hovered dot whenever the data being plotted changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(null);
  }, [xKey, yKey, minMpg, archiveMode]);

  // Keep mobile SVG units at CSS-pixel size so ticks stay readable. Desktop
  // retains its original 640 × 460 viewBox and point projection.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) setChartWidth(width);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [loading, archiveMode, rows.length, xKey, yKey, minMpg]);

  // ── SVG geometry ────────────────────────────────────────────────────────
  const mobileChart = chartWidth < 480;
  const w = mobileChart ? chartWidth : 640, h = mobileChart ? 320 : 460;
  const pad = mobileChart ? { top: 16, right: 16, bottom: 44, left: 44 } : { top: 20, right: 24, bottom: 52, left: 56 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const projected = useMemo(() => {
    if (!scales) return [];
    const { x: sx, y: sy } = scales;
    const xRange = sx.hi - sx.lo || 1;
    const yRange = sy.hi - sy.lo || 1;
    return points.map((r) => {
      const xv = xMeta.get(r);
      const yv = yMeta.get(r);
      const cx = pad.left + ((xv - sx.lo) / xRange) * plotW;
      const cy = pad.top + plotH - ((yv - sy.lo) / yRange) * plotH;
      return { r, cx, cy, xv, yv };
    });
  }, [points, scales, xMeta, yMeta, plotW, plotH, pad.left, pad.top]);

  // Map a pointer event to the nearest dot (within a sensible radius). Depends
  // on `projected`, so it's reattached whenever the plotted points change —
  // no stale closures, no ref-during-render.
  const handleMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || projected.length === 0) return;
    const rect = svg.getBoundingClientRect();
    // viewBox is 0..w / 0..h; scale client coords into that space.
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const py = ((e.clientY - rect.top) / rect.height) * h;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < projected.length; i++) {
      const dx = projected[i].cx - px;
      const dy = projected[i].cy - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    // Preserve the desktop radius and a 44px-diameter touch target on narrow screens.
    const captureRadius = Math.max(26, (22 / rect.width) * w);
    setActiveIdx(bestD <= captureRadius * captureRadius ? best : null);
  }, [projected, w, h]);

  const active = activeIdx != null ? projected[activeIdx] : null;

  if (loading && !archiveMode) {
    return (
      <div className="space-y-4">
        <div className="glass-tile h-28 skeleton-shimmer" />
        <div className="glass-tile h-[460px] skeleton-shimmer" />
      </div>
    );
  }

  const failure = (error || (!loading && rows.length === 0)) && (
    <EmptyState
      icon={AlertCircle}
      tone="danger"
      className="[&_button]:min-h-11"
      title={isZh ? "数据加载失败" : "Failed to load data"}
      description={isZh ? "无法获取全联盟球员数据，请稍后重试。" : "Could not fetch league-wide player data. Please try again."}
      action={archiveMode ? undefined : { label: isZh ? "重试" : "Retry", onClick: () => load() }}
    />
  );
  const archiveButton = !archiveMode && archive.rows.length > 0 && (
    <button type="button" className="min-h-11 px-4 py-2 rounded-lg glass-tile text-accent font-semibold" onClick={() => {
      setXKey("PTS"); setYKey("AST"); setActiveIdx(null); setArchiveMode(true);
    }}>
      {isZh ? `查看 ${archive.season} 存档` : `View ${archive.season} archive`}
    </button>
  );
  if (!archiveMode && (error || rows.length === 0)) {
    return <div className="space-y-4">{failure}{archiveButton}</div>;
  }

  return (
    <div className="space-y-5" onKeyDown={e => { if (e.key === "Escape") { setActiveIdx(null); svgRef.current?.focus(); } }}>
      {!archiveMode && failure}
      {archiveMode && <div className="glass-tile px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs" role="status">
        <span className="text-text-secondary">{error || rows.length === 0
          ? (isZh ? `${CURRENT_SEASON} 当前数据暂不可用` : `${CURRENT_SEASON} current data unavailable`)
          : (isZh ? `${CURRENT_SEASON} 当前数据可重试` : `${CURRENT_SEASON} current data can be refreshed`)}</span>
        <button type="button" disabled={loading} className="min-h-11 px-3 py-2 rounded-lg text-accent font-semibold disabled:opacity-50" onClick={() => load()}>{loading ? (isZh ? "正在重试当前数据…" : "Retrying current data…") : (isZh ? `重试 ${CURRENT_SEASON} 当前数据` : `Retry ${CURRENT_SEASON} current data`)}</button>
      </div>}
      <section className="glass-tile p-4 space-y-2 text-sm" aria-live="polite">
        <h2 className="font-semibold">{archiveMode
          ? (isZh ? `${archive.season} 存档索引场均数据` : `${archive.season} archived index averages`)
          : (isZh ? `${CURRENT_SEASON} 常规赛 · 当前数据` : `${CURRENT_SEASON} regular season · Current data`)}</h2>
        {archiveMode && <>
          <p className="text-text-secondary">{isZh
            ? `${archive.rows.length} / ${archive.total} 名索引球员可绘制 · ${archive.omitted} 名缺少数据 · 得分 / 篮板 / 助攻`
            : `${archive.rows.length} of ${archive.total} indexed players plotted · ${archive.omitted} missing stats · PTS / REB / AST`}</p>
          <details className="text-xs text-text-secondary">
            <summary className="min-h-11 flex items-center cursor-pointer text-accent">{isZh ? "数据来源与限制 ▾" : "Source and limitations ▾"}</summary>
            <div className="space-y-2 pb-2">
              <p>{isZh ? "缺少得分、篮板或助攻的球员未绘制。仅支持这三项指标。存档未提供出场数、分钟及投篮数据，不应用出场门槛。" : "Players missing points, rebounds or assists are omitted. Only these three metrics are available. No games/minutes qualification is applied; games, minutes and shooting data are unavailable."}</p>
              <p>{isZh ? "球队归属来自存档索引，并非当前名单；未知球队使用中性色。存档未注明更新时间或 PerMode；场均解释沿用现有索引约定。" : "Team attribution is from the archived index, not the current roster. Unknown teams use a neutral color. The source supplies no retrieval timestamp or explicit PerMode; averages follow the existing index convention."}</p>
            </div>
          </details>
        </>}
        {archiveButton}
      </section>
      {/* Axis pickers */}
      <div className="glass-tile p-4 flex flex-col sm:flex-row gap-5">
        <AxisPicker label={isZh ? "X 轴（横）" : "X axis"} value={xKey} isZh={isZh} onChange={setXKey} axes={axes} />
        <div className="hidden sm:block w-px bg-border self-stretch" />
        <AxisPicker label={isZh ? "Y 轴（纵）" : "Y axis"} value={yKey} isZh={isZh} onChange={setYKey} axes={axes} />
      </div>

      {/* Minutes threshold + summary */}
      <div className="glass-tile p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!archiveMode && <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 shrink-0">
            / {isZh ? "出场时间下限" : "Min MPG"}
          </span>
          <div className="glass-tile flex flex-wrap p-0.5">
            {MIN_THRESHOLDS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinMpg(m)}
                aria-pressed={minMpg === m}
                className={`min-h-11 min-w-11 px-2.5 py-1 text-[11px] font-mono tabular-nums rounded transition-all cursor-pointer ${
                  minMpg === m
                    ? "bg-accent text-white shadow-md"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                {m === 0 ? (isZh ? "全部" : "All") : `${m}+`}
              </button>
            ))}
          </div>
        </div>}
        <span className="text-[11px] text-text-secondary font-mono tabular-nums ml-auto">
          {isZh
            ? `${points.length} 名球员 · ${xMeta.zh} × ${yMeta.zh}`
            : `${points.length} players · ${xMeta.en} × ${yMeta.en}`}
        </span>
      </div>

      {/* Scatter plot */}
      <div className="glass-tile p-4">
        {points.length === 0 || !scales || xKey === yKey ? (
          <div className="py-16 text-center text-sm text-text-secondary">
            {xKey === yKey
              ? isZh
                ? "X 轴和 Y 轴选了同一项，所有点会落在一条直线上 —— 请选择两个不同的数据项。"
                : "X and Y are the same stat, so every dot falls on one line — pick two different stats."
              : isZh
              ? "当前出场时间下限下没有球员，调低门槛试试。"
              : "No players meet the current minutes threshold — try lowering it."}
          </div>
        ) : (
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${w} ${h}`}
              className="w-full touch-pan-y select-none"
              preserveAspectRatio="xMidYMid meet"
              role="group"
              tabIndex={0}
              onKeyDown={e => {
                if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter", " "].includes(e.key)) {
                  e.preventDefault();
                  const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
                  setActiveIdx(activeIdx === null ? 0 : e.key === "Enter" || e.key === " " ? activeIdx : (activeIdx + step + projected.length) % projected.length);
                }
              }}
              aria-label={
                isZh
                  ? `散点图：横轴 ${xMeta.zh}，纵轴 ${yMeta.zh}，共 ${points.length} 名球员`
                  : `Scatter plot of ${xMeta.en} versus ${yMeta.en}, ${points.length} players`
              }
              onPointerMove={handleMove}
              onPointerDown={handleMove}

            >
              {/* Y grid + ticks */}
              {scales.y.ticks.map((tv) => {
                const yRange = scales.y.hi - scales.y.lo || 1;
                const cy = pad.top + plotH - ((tv - scales.y.lo) / yRange) * plotH;
                if (cy < pad.top - 0.5 || cy > pad.top + plotH + 0.5) return null;
                return (
                  <g key={`y${tv}`}>
                    <line x1={pad.left} y1={cy} x2={w - pad.right} y2={cy} stroke="var(--border)" strokeWidth={0.4} />
                    <text x={pad.left - 6} y={cy} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={mobileChart ? 11 : 8}>
                      {yMeta.pct ? (tv * 100).toFixed(0) : Number.isInteger(tv) ? tv : tv.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              {/* X grid + ticks */}
              {scales.x.ticks.map((tv) => {
                const xRange = scales.x.hi - scales.x.lo || 1;
                const cx = pad.left + ((tv - scales.x.lo) / xRange) * plotW;
                if (cx < pad.left - 0.5 || cx > w - pad.right + 0.5) return null;
                return (
                  <g key={`x${tv}`}>
                    <line x1={cx} y1={pad.top} x2={cx} y2={pad.top + plotH} stroke="var(--border)" strokeWidth={0.4} />
                    <text x={cx} y={pad.top + plotH + 14} textAnchor="middle" fill="var(--text-secondary)" fontSize={mobileChart ? 11 : 8}>
                      {xMeta.pct ? (tv * 100).toFixed(0) : Number.isInteger(tv) ? tv : tv.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Axis frame */}
              <line x1={pad.left} y1={pad.top + plotH} x2={w - pad.right} y2={pad.top + plotH} stroke="var(--text-secondary)" strokeWidth={0.8} />
              <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="var(--text-secondary)" strokeWidth={0.8} />

              {/* Axis labels */}
              <text x={pad.left + plotW / 2} y={h - 6} textAnchor="middle" fill="var(--text-primary)" fontSize={mobileChart ? 12 : 10} fontWeight={600}>
                {isZh ? `${xMeta.zh}（${xMeta.en}）` : xMeta.en}
              </text>
              <text
                x={14}
                y={pad.top + plotH / 2}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize={mobileChart ? 12 : 10}
                fontWeight={600}
                transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
              >
                {isZh ? `${yMeta.zh}（${yMeta.en}）` : yMeta.en}
              </text>

              {/* Dots */}
              {projected.map((p, i) => {
                const color = TEAM_META[p.r.TEAM]?.primaryColor || "#64748B";
                const isActive = i === activeIdx;
                return (
                  <circle
                    key={p.r.PLAYER_ID}
                    cx={p.cx}
                    cy={p.cy}
                    r={isActive ? 6 : 3.6}
                    fill={color}
                    fillOpacity={isActive ? 1 : 0.78}
                    stroke={isActive ? "var(--text-primary)" : "var(--bg-card)"}
                    strokeWidth={isActive ? 1.4 : 0.6}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveIdx(i)}
                  />
                );
              })}
            </svg>

          </div>
        )}

        {active && <div className="glass-tile p-3 mt-3 text-sm space-y-2" aria-live="polite">
          <div className="flex items-start justify-between gap-2"><p className="font-semibold break-words">{active.r.PLAYER}</p><button type="button" className="min-h-11 min-w-11 shrink-0 text-text-secondary" onClick={() => { setActiveIdx(null); svgRef.current?.focus(); }}>{isZh ? "关闭" : "Close"}</button></div>
          <p>{active.r.TEAM || (isZh ? "未知球队" : "Unknown team")}{archiveMode ? (isZh ? " · 存档球队归属" : " · Archived team attribution") : ` · ${active.r.GP} GP · ${active.r.MIN?.toFixed(1)} MPG`}</p>
          <p>{isZh ? xMeta.zh : xMeta.en}: {fmtVal(xMeta, active.xv)} · {isZh ? yMeta.zh : yMeta.en}: {fmtVal(yMeta, active.yv)}</p>
          <Link prefetch={false} href={`/player/${active.r.PLAYER_ID}`} className="inline-flex items-center min-h-11 text-accent">{isZh ? "打开球员页" : "Open player page"}</Link>
        </div>}
        <div className="mt-3 flex items-start gap-2 text-[11px] text-text-secondary">
          <ScatterChart size={12} className="text-accent shrink-0" aria-hidden="true" />
          <span>{isZh ? "每个圆点为一名球员，颜色取自球队主色。点按查看详情，或聚焦图表后使用方向键选择球员；Esc 关闭详情。" : "Each dot is a player, colored by team. Tap for details, or focus the chart and use arrow keys to select a player; Escape closes details."}
            {!archiveMode && (isZh ? "真实命中率 TS% = 得分 /（2 ×（出手 + 0.44 × 罚球出手））。" : " True Shooting % = PTS / (2 × (FGA + 0.44 × FTA)).")}
          </span>
        </div>
      </div>
    </div>
  );
}
