"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
  GP: number;
  MIN: number;
  FGM: number;
  FGA: number;
  FG_PCT: number;
  FG3M: number;
  FG3A: number;
  FG3_PCT: number;
  FTM: number;
  FTA: number;
  FT_PCT: number;
  OREB: number;
  DREB: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  PTS: number;
  EFF: number;
  // derived
  TS_PCT: number;
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
  { key: "STL", zh: "抢断", en: "Steals", get: (r) => r.STL },
  { key: "BLK", zh: "盖帽", en: "Blocks", get: (r) => r.BLK },
  { key: "TOV", zh: "失误", en: "Turnovers", get: (r) => r.TOV },
  { key: "MIN", zh: "出场时间", en: "Minutes", get: (r) => r.MIN },
  { key: "TS_PCT", zh: "真实命中率", en: "True Shooting %", pct: true, get: (r) => r.TS_PCT },
  { key: "FG_PCT", zh: "投篮命中率", en: "FG %", pct: true, get: (r) => r.FG_PCT },
  { key: "FG3_PCT", zh: "三分命中率", en: "3P %", pct: true, get: (r) => r.FG3_PCT },
  { key: "FT_PCT", zh: "罚球命中率", en: "FT %", pct: true, get: (r) => r.FT_PCT },
  { key: "FGA", zh: "出手数", en: "FG Attempts", get: (r) => r.FGA },
  { key: "FG3A", zh: "三分出手", en: "3P Attempts", get: (r) => r.FG3A },
  { key: "FG3M", zh: "三分命中", en: "3P Made", get: (r) => r.FG3M },
  { key: "FTA", zh: "罚球出手", en: "FT Attempts", get: (r) => r.FTA },
  { key: "OREB", zh: "前场篮板", en: "Off. Rebounds", get: (r) => r.OREB },
  { key: "DREB", zh: "后场篮板", en: "Def. Rebounds", get: (r) => r.DREB },
  { key: "EFF", zh: "效率值", en: "Efficiency", get: (r) => r.EFF },
  { key: "GP", zh: "出场数", en: "Games", get: (r) => r.GP },
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
  label, value, isZh, onChange,
}: { label: string; value: AxisKey; isZh: boolean; onChange: (k: AxisKey) => void }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-1.5">/ {label}</p>
      <div className="flex flex-wrap gap-1">
        {AXES.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onChange(a.key)}
            aria-pressed={value === a.key}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
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

export default function ScatterExplorer() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const router = useRouter();

  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [xKey, setXKey] = useState<AxisKey>("PTS");
  const [yKey, setYKey] = useState<AxisKey>("AST");
  const [minMpg, setMinMpg] = useState(15);

  // active hovered/tapped dot index into the *filtered* list
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
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
      setRows(parsed);
    } catch (e) {
      if (signal?.aborted) return;
      setError(String(e));
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const xMeta = AXIS_BY_KEY.get(xKey)!;
  const yMeta = AXIS_BY_KEY.get(yKey)!;

  // Filter by minutes threshold; require the player to have logged a game.
  const points = useMemo(
    () => rows.filter((r) => r.GP > 0 && r.MIN >= minMpg),
    [rows, minMpg]
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
  }, [xKey, yKey, minMpg]);

  // ── SVG geometry ────────────────────────────────────────────────────────
  const w = 640, h = 460;
  const pad = { top: 20, right: 24, bottom: 52, left: 56 };
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
    // ~26px capture radius in viewBox units
    setActiveIdx(bestD <= 26 * 26 ? best : null);
  }, [projected]);

  const active = activeIdx != null ? projected[activeIdx] : null;

  // Tooltip placement: flip to the left/below if near the right/top edge.
  const tip = active
    ? {
        left: active.cx > w * 0.62,
        below: active.cy < h * 0.22,
      }
    : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="glass-tile h-28 skeleton-shimmer" />
        <div className="glass-tile h-[460px] skeleton-shimmer" />
      </div>
    );
  }

  if (error || rows.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title={isZh ? "数据加载失败" : "Failed to load data"}
        description={
          isZh
            ? "无法获取全联盟球员数据，请稍后重试。"
            : "Could not fetch league-wide player data. Please try again."
        }
        action={{ label: isZh ? "重试" : "Retry", onClick: () => load() }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Axis pickers */}
      <div className="glass-tile p-4 flex flex-col sm:flex-row gap-5">
        <AxisPicker label={isZh ? "X 轴（横）" : "X axis"} value={xKey} isZh={isZh} onChange={setXKey} />
        <div className="hidden sm:block w-px bg-border self-stretch" />
        <AxisPicker label={isZh ? "Y 轴（纵）" : "Y axis"} value={yKey} isZh={isZh} onChange={setYKey} />
      </div>

      {/* Minutes threshold + summary */}
      <div className="glass-tile p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 shrink-0">
            / {isZh ? "出场时间下限" : "Min MPG"}
          </span>
          <div className="glass-tile flex overflow-hidden p-0.5">
            {MIN_THRESHOLDS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinMpg(m)}
                aria-pressed={minMpg === m}
                className={`px-2.5 py-1 text-[11px] font-mono tabular-nums rounded transition-all cursor-pointer ${
                  minMpg === m
                    ? "bg-accent text-white shadow-md"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                {m === 0 ? (isZh ? "全部" : "All") : `${m}+`}
              </button>
            ))}
          </div>
        </div>
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
              className="w-full touch-none select-none"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={
                isZh
                  ? `散点图：横轴 ${xMeta.zh}，纵轴 ${yMeta.zh}，共 ${points.length} 名球员`
                  : `Scatter plot of ${xMeta.en} versus ${yMeta.en}, ${points.length} players`
              }
              onPointerMove={handleMove}
              onPointerDown={handleMove}
              onPointerLeave={() => setActiveIdx(null)}
            >
              {/* Y grid + ticks */}
              {scales.y.ticks.map((tv) => {
                const yRange = scales.y.hi - scales.y.lo || 1;
                const cy = pad.top + plotH - ((tv - scales.y.lo) / yRange) * plotH;
                if (cy < pad.top - 0.5 || cy > pad.top + plotH + 0.5) return null;
                return (
                  <g key={`y${tv}`}>
                    <line x1={pad.left} y1={cy} x2={w - pad.right} y2={cy} stroke="var(--border)" strokeWidth={0.4} />
                    <text x={pad.left - 6} y={cy} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={8}>
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
                    <text x={cx} y={pad.top + plotH + 14} textAnchor="middle" fill="var(--text-secondary)" fontSize={8}>
                      {xMeta.pct ? (tv * 100).toFixed(0) : Number.isInteger(tv) ? tv : tv.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Axis frame */}
              <line x1={pad.left} y1={pad.top + plotH} x2={w - pad.right} y2={pad.top + plotH} stroke="var(--text-secondary)" strokeWidth={0.8} />
              <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="var(--text-secondary)" strokeWidth={0.8} />

              {/* Axis labels */}
              <text x={pad.left + plotW / 2} y={h - 6} textAnchor="middle" fill="var(--text-primary)" fontSize={10} fontWeight={600}>
                {isZh ? `${xMeta.zh}（${xMeta.en}）` : xMeta.en}
              </text>
              <text
                x={14}
                y={pad.top + plotH / 2}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize={10}
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
                    onClick={() => router.push(`/player/${p.r.PLAYER_ID}`)}
                  />
                );
              })}
            </svg>

            {/* Tooltip — HTML overlay positioned in % of the SVG box */}
            {active && tip && (
              <div
                className="absolute z-10 pointer-events-none"
                style={{
                  left: `${(active.cx / w) * 100}%`,
                  top: `${(active.cy / h) * 100}%`,
                  transform: `translate(${tip.left ? "-100%" : "0"}, ${tip.below ? "8px" : "calc(-100% - 8px)"}) translateX(${tip.left ? "-10px" : "10px"})`,
                }}
              >
                <div className="glass-tile px-3 py-2 shadow-xl min-w-[160px]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: TEAM_META[active.r.TEAM]?.primaryColor || "#64748B" }}
                    />
                    <span className="text-sm font-semibold text-text-primary truncate">{active.r.PLAYER}</span>
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mt-0.5">
                    {active.r.TEAM}
                    <span className="text-text-secondary/40 mx-1">·</span>
                    {active.r.GP} {isZh ? "场" : "GP"}
                    <span className="text-text-secondary/40 mx-1">·</span>
                    {active.r.MIN.toFixed(1)} {isZh ? "分钟" : "MPG"}
                  </p>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-text-secondary">{isZh ? xMeta.zh : xMeta.en}</span>
                      <span className="font-mono tabular-nums text-accent font-bold">{fmtVal(xMeta, active.xv)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-text-secondary">{isZh ? yMeta.zh : yMeta.en}</span>
                      <span className="font-mono tabular-nums text-success font-bold">{fmtVal(yMeta, active.yv)}</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-text-secondary/60 mt-1.5">
                    {isZh ? "点击圆点查看球员页" : "Tap dot for player page"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend / note */}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-text-secondary">
          <ScatterChart size={12} className="text-accent shrink-0" aria-hidden="true" />
          <span>
            {isZh
              ? "每个圆点为一名球员，颜色取自球队主色；悬停或点按高亮最近的点，点击跳转球员页。真实命中率 TS% = 得分 /（2 ×（出手 + 0.44 × 罚球出手））。"
              : "Each dot is a player, colored by team; hover or tap to highlight the nearest dot, click to open the player page. True Shooting % = PTS / (2 × (FGA + 0.44 × FTA))."}
          </span>
        </div>
      </div>
    </div>
  );
}
