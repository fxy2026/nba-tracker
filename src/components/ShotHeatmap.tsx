"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { aggregateZoneStats, getZoneColor, type ShotZone, type ZoneStats } from "@/lib/shot-zones";

interface Props {
  playerId: number;
  playerName: string;
  teamTricode: string;
}

interface ShotRow {
  x: number;
  y: number;
  shotDistance: number;
  shotResult: string;
}

// ---- Half-court SVG (basket at BOTTOM, halfcourt line at TOP — matches Hupu layout) ----
const W = 470, H = 440, PAD = 8;
// Court: 50ft wide × ~47ft visible
const CW = W - PAD * 2;
const CH = H - PAD * 2;
// Scale factors
const SX = CW / 50; // pixels per foot horizontal
const SY = CH / 47; // pixels per foot vertical
// Basket at bottom center, 5.25ft from baseline
const BX = W / 2;
const BY = H - PAD - 5.25 * SY; // basket Y (near bottom)
const BASELINE_Y = H - PAD; // very bottom

// Court-feet to SVG: dx = feet left/right from basket, dy = feet toward halfcourt (upward in SVG)
function toSvg(dxFt: number, dyFt: number): [number, number] {
  return [BX + dxFt * SX, BY - dyFt * SY];
}

// Polar: angle 0 = toward halfcourt (up), +90 = right, -90 = left
function polar(rFt: number, aDeg: number): [number, number] {
  const rad = (aDeg * Math.PI) / 180;
  return toSvg(rFt * Math.sin(rad), rFt * Math.cos(rad));
}

function arcStr(rFt: number, a1: number, a2: number, n = 30): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = polar(rFt, a1 + (a2 - a1) * (i / n));
    pts.push(`${x},${y}`);
  }
  return pts.join(" L ");
}

// ---- Court markings ----
function CourtLines() {
  const [pl] = toSvg(-8, 0);
  const [pr] = toSvg(8, 0);
  const [, ftY] = toSvg(0, 19 - 5.25);
  const raR = 4 * SX;
  const ftR = 6 * SX;
  const [c3l] = toSvg(-22, 0);
  const [c3r] = toSvg(22, 0);
  const [, cornerY] = toSvg(0, 14 - 5.25);

  return (
    <>
      <rect x={PAD} y={PAD} width={CW} height={CH} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      {/* Paint box */}
      <rect x={pl} y={ftY} width={pr - pl} height={BASELINE_Y - ftY} fill="none" stroke="#3a3a3a" strokeWidth="1.5" />
      {/* FT circle */}
      <circle cx={BX} cy={ftY} r={ftR} fill="none" stroke="#3a3a3a" strokeWidth="1" strokeDasharray="4,4" />
      {/* Restricted area */}
      <path d={`M ${toSvg(-4, 0).join(",")} A ${raR} ${4 * SY} 0 0 0 ${toSvg(4, 0).join(",")}`} fill="none" stroke="#3a3a3a" strokeWidth="1" />
      {/* Basket */}
      <circle cx={BX} cy={BY} r={4} fill="none" stroke="#928CEE" strokeWidth="1.5" />
      <line x1={BX - 12} y1={BY + 4} x2={BX + 12} y2={BY + 4} stroke="#555" strokeWidth="2" />
      {/* 3pt line: corners + arc */}
      <line x1={c3l} y1={BASELINE_Y} x2={c3l} y2={cornerY} stroke="#444" strokeWidth="1.5" />
      <line x1={c3r} y1={BASELINE_Y} x2={c3r} y2={cornerY} stroke="#444" strokeWidth="1.5" />
      <polyline points={arcStr(23.75, -90, 90)} fill="none" stroke="#444" strokeWidth="1.5" />
      {/* Half court line */}
      <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="#2a2a2a" strokeWidth="1.5" />
    </>
  );
}

// ---- Zone paths (10 zones, layered outer→inner) ----
// Constants in feet from basket
const CORNER_DEPTH = 14 - 5.25; // 8.75ft from basket
const CORNER_ARC_A = Math.acos(CORNER_DEPTH / 23.75) * (180 / Math.PI); // ~68.4°
const WING_ANGLE = 55; // divides center from left/right

const RENDER_ORDER: ShotZone[] = [
  // Outer (drawn first, behind)
  "Above Break 3 (Left)", "Above Break 3 (Center)", "Above Break 3 (Right)",
  "Corner 3 (Left)", "Corner 3 (Right)",
  // Mid
  "Mid-Range (Left)", "Mid-Range (Center)", "Mid-Range (Right)",
  // Inner (drawn last, on top)
  "Paint",
  "Restricted Area",
];

function zonePath(zone: ShotZone): string {
  const TOP = PAD;
  const [c3l] = toSvg(-22, 0);
  const [c3r] = toSvg(22, 0);
  const [, cornerY] = toSvg(0, CORNER_DEPTH);

  switch (zone) {
    case "Restricted Area":
      // Semicircle above basket (toward halfcourt)
      return `M ${polar(4, -90).join(",")} L ${arcStr(4, -90, 90)} Z`;

    case "Paint": {
      // Rectangle from baseline to FT line, 16ft wide
      const [pl] = toSvg(-8, 0);
      const [pr] = toSvg(8, 0);
      const [, ftY] = toSvg(0, 19 - 5.25);
      return `M ${pl},${BASELINE_Y} L ${pl},${ftY} L ${pr},${ftY} L ${pr},${BASELINE_Y} Z`;
    }

    case "Mid-Range (Left)": {
      // Left side wedge: from paint edge to 3pt arc, high angle
      // Bounded by: left sideline at paint height, corner 3 line, 3pt arc, radial line at WING_ANGLE
      const [pl] = toSvg(-8, 0);
      const [, ftY] = toSvg(0, 19 - 5.25);
      return [
        `M ${c3l},${BASELINE_Y}`,
        `L ${c3l},${cornerY}`,
        `L ${arcStr(23.75, -CORNER_ARC_A, -WING_ANGLE)}`,
        `L ${polar(14, -WING_ANGLE).join(",")}`,
        `L ${pl},${ftY}`,
        `L ${pl},${BASELINE_Y}`,
        "Z",
      ].join(" ");
    }
    case "Mid-Range (Right)": {
      const [pr] = toSvg(8, 0);
      const [, ftY] = toSvg(0, 19 - 5.25);
      return [
        `M ${pr},${BASELINE_Y}`,
        `L ${pr},${ftY}`,
        `L ${polar(14, WING_ANGLE).join(",")}`,
        `L ${arcStr(23.75, WING_ANGLE, CORNER_ARC_A)}`,
        `L ${c3r},${cornerY}`,
        `L ${c3r},${BASELINE_Y}`,
        "Z",
      ].join(" ");
    }
    case "Mid-Range (Center)": {
      // Arc sector between paint (~14ft) and 3pt arc, center angles
      const [pl] = toSvg(-8, 0);
      const [pr] = toSvg(8, 0);
      const [, ftY] = toSvg(0, 19 - 5.25);
      return [
        `M ${pl},${ftY}`,
        `L ${polar(14, -WING_ANGLE).join(",")}`,
        `L ${arcStr(23.75, -WING_ANGLE, WING_ANGLE)}`,
        `L ${polar(14, WING_ANGLE).join(",")}`,
        `L ${pr},${ftY}`,
        `L ${pr},${ftY}`,
        `L ${pl},${ftY}`,
        "Z",
      ].join(" ");
    }

    case "Corner 3 (Left)":
      return `M ${PAD},${BASELINE_Y} L ${PAD},${cornerY} L ${c3l},${cornerY} L ${c3l},${BASELINE_Y} Z`;
    case "Corner 3 (Right)":
      return `M ${c3r},${BASELINE_Y} L ${c3r},${cornerY} L ${W - PAD},${cornerY} L ${W - PAD},${BASELINE_Y} Z`;

    case "Above Break 3 (Left)": {
      const [ax, ay] = polar(23.75, -WING_ANGLE);
      return [
        `M ${PAD},${cornerY}`,
        `L ${arcStr(23.75, -90, -WING_ANGLE)}`,
        `L ${ax},${TOP}`,
        `L ${PAD},${TOP}`,
        "Z",
      ].join(" ");
    }
    case "Above Break 3 (Center)": {
      const [xl] = polar(23.75, -WING_ANGLE);
      const [xr] = polar(23.75, WING_ANGLE);
      return [
        `M ${arcStr(23.75, -WING_ANGLE, WING_ANGLE)}`,
        `L ${xr},${TOP}`,
        `L ${xl},${TOP}`,
        "Z",
      ].join(" ");
    }
    case "Above Break 3 (Right)": {
      const [ax, ay] = polar(23.75, WING_ANGLE);
      return [
        `M ${arcStr(23.75, WING_ANGLE, 90)}`,
        `L ${c3r},${cornerY}`,
        `L ${W - PAD},${cornerY}`,
        `L ${W - PAD},${TOP}`,
        `L ${ax},${TOP}`,
        "Z",
      ].join(" ");
    }
  }
}

// Zone label positions (feet from basket)
function zoneLabel(zone: ShotZone): [number, number] {
  switch (zone) {
    case "Restricted Area": return toSvg(0, 1.5);
    case "Paint": return toSvg(0, 10);
    case "Mid-Range (Left)": return toSvg(-14, 6);
    case "Mid-Range (Center)": return toSvg(0, 21);
    case "Mid-Range (Right)": return toSvg(14, 6);
    case "Corner 3 (Left)": return toSvg(-20, 2);
    case "Corner 3 (Right)": return toSvg(20, 2);
    case "Above Break 3 (Left)": return toSvg(-18, 28);
    case "Above Break 3 (Center)": return toSvg(0, 33);
    case "Above Break 3 (Right)": return toSvg(18, 28);
  }
}

// ---- Main component ----
export default function ShotHeatmap({ playerId, playerName, teamTricode }: Props) {
  const { t, locale } = useLocale();
  const [seasonType, setSeasonType] = useState<"regular" | "playoffs" | "all">("regular");
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoveredZone, setHoveredZone] = useState<ShotZone | null>(null);
  const [gamesInfo, setGamesInfo] = useState({ loaded: 0, total: 0 });

  const fetchShots = useCallback(async (st: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ playerId: String(playerId), team: teamTricode, seasonType: st });
      const res = await fetch(`/api/player-shots?${params}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setShots(data.shots || []);
      setGamesInfo({ loaded: data.gamesLoaded || 0, total: data.totalGames || 0 });
    } catch {
      setError(locale === "zh" ? "加载投篮数据失败" : "Failed to load shot data");
    } finally {
      setLoading(false);
    }
  }, [playerId, teamTricode, locale]);

  useEffect(() => { fetchShots(seasonType); }, [seasonType, fetchShots]);

  const zoneStats = useMemo(() => aggregateZoneStats(shots), [shots]);
  const statsMap = useMemo(() => {
    const m = new Map<ShotZone, ZoneStats>();
    for (const s of zoneStats) m.set(s.zone, s);
    return m;
  }, [zoneStats]);

  const leagueAvg = 46;
  const overallMade = shots.filter((s) => s.shotResult === "Made").length;
  const overallPct = shots.length > 0 ? (overallMade / shots.length) * 100 : 0;
  const hoveredStat = hoveredZone ? statsMap.get(hoveredZone) : null;

  const stLabel = (st: string) => {
    if (st === "regular") return locale === "zh" ? "常规赛" : "Regular";
    if (st === "playoffs") return locale === "zh" ? "季后赛" : "Playoffs";
    return locale === "zh" ? "全部" : "All";
  };

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {locale === "zh" ? "投篮热图" : "Shot Heatmap"}
      </h3>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["regular", "playoffs", "all"] as const).map((st) => (
            <button key={st} onClick={() => setSeasonType(st)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${seasonType === st ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary hover:text-text-primary"}`}>
              {stLabel(st)}
            </button>
          ))}
        </div>
        {shots.length > 0 && (
          <span className="text-xs text-text-secondary ml-auto">
            {overallMade}/{shots.length} FG ({overallPct.toFixed(1)}%)
            {gamesInfo.loaded > 0 && <span className="text-text-secondary/60 ml-1">· {gamesInfo.loaded}/{gamesInfo.total} {locale === "zh" ? "场" : "games"}</span>}
          </span>
        )}
      </div>

      {loading && <div className="h-64 flex items-center justify-center text-text-secondary text-sm">{locale === "zh" ? "加载中..." : "Loading..."}</div>}
      {error && <div className="h-32 flex items-center justify-center text-danger text-sm">{error}</div>}
      {!loading && !error && shots.length === 0 && <div className="h-32 flex items-center justify-center text-text-secondary text-sm">{locale === "zh" ? "该赛季无投篮数据" : "No shot data"}</div>}

      {!loading && shots.length > 0 && (
        <>
          <div className="flex items-center justify-center gap-3 mb-2 text-[10px] text-text-secondary">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(25, leagueAvg) }} />{t.shotHeatmap.belowAvg}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(leagueAvg, leagueAvg) }} />{t.shotHeatmap.avg}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(65, leagueAvg) }} />{t.shotHeatmap.aboveAvg}</span>
          </div>

          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 480 }}>
              <rect x="0" y="0" width={W} height={H} fill="#141414" rx="8" />

              {RENDER_ORDER.map((zone) => {
                const stat = statsMap.get(zone);
                const color = stat ? getZoneColor(stat.pct, leagueAvg) : "#1e1e1e";
                const opacity = stat ? (hoveredZone === zone ? 0.95 : 0.65) : 0.2;
                return (
                  <path key={zone} d={zonePath(zone)} fill={color} fillOpacity={opacity}
                    stroke={hoveredZone === zone ? "#fff" : "#333"} strokeWidth={hoveredZone === zone ? 2 : 0.5}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredZone(zone)} onMouseLeave={() => setHoveredZone(null)} />
                );
              })}

              <CourtLines />

              {RENDER_ORDER.map((zone) => {
                const stat = statsMap.get(zone);
                if (!stat) return null;
                const [lx, ly] = zoneLabel(zone);
                return (
                  <g key={`lbl-${zone}`} className="pointer-events-none">
                    <text x={lx} y={ly - 2} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{stat.pct.toFixed(1)}%</text>
                    <text x={lx} y={ly + 12} textAnchor="middle" fill="#bbb" fontSize="10">{stat.made}/{stat.total}</text>
                  </g>
                );
              })}
            </svg>

            {hoveredZone && hoveredStat && (
              <div className="absolute top-2 right-2 bg-bg-secondary/95 border border-border rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none z-10">
                <p className="font-bold text-text-primary">{hoveredZone}</p>
                <p className="text-accent text-lg font-bold">{hoveredStat.pct.toFixed(1)}%</p>
                <p className="text-text-secondary">{hoveredStat.made}/{hoveredStat.total} FG</p>
                <p className={`text-[10px] mt-1 ${hoveredStat.pct > leagueAvg ? "text-red-400" : hoveredStat.pct < leagueAvg - 5 ? "text-blue-400" : "text-orange-400"}`}>
                  {hoveredStat.pct > leagueAvg ? "+" : ""}{(hoveredStat.pct - leagueAvg).toFixed(1)}% vs {locale === "zh" ? "联盟均值" : "league avg"}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
