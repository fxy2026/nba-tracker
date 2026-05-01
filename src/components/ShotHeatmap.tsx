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

// ---------- NBA half-court SVG geometry ----------
// Uses real NBA dimensions: 50ft wide × 47ft visible
const W = 500, H = 470, PAD = 15;
const FT_X = (W - PAD * 2) / 50; // pixels per foot horizontally
const FT_Y = (H - PAD * 2) / 47; // pixels per foot vertically
// Basket at center, 5.25ft from baseline (top)
const BX = W / 2;
const BY = PAD + 5.25 * FT_Y;

// Convert (feet from basket center along court width, feet from basket towards halfcourt) → SVG
const ftToSvg = (dxFt: number, dyFt: number): [number, number] => [BX + dxFt * FT_X, BY + dyFt * FT_Y];

// Court markings SVG
function CourtMarkings() {
  const [rimL] = ftToSvg(-0.75, 0);
  const [rimR] = ftToSvg(0.75, 0);
  const [, rimY] = ftToSvg(0, 0);
  const paintW = 8 * FT_X; // 16ft total paint width → 8ft each side
  const paintH = 19 * FT_Y; // free throw line 19ft from basket
  const ftR = 6 * FT_X; // free throw circle radius

  // 3pt arc: 23.75ft from basket, corners at 22ft, corner extends 14ft from baseline
  const corner3Ft = 22;
  const cornerExtFt = 14;
  const arcR = 23.75 * FT_X;
  const [cornerL] = ftToSvg(-corner3Ft, 0);
  const [cornerR] = ftToSvg(corner3Ft, 0);
  const [, cornerEndY] = ftToSvg(0, cornerExtFt);
  // Arc from left corner to right corner
  const arcPts: string[] = [];
  for (let a = -90; a <= 90; a += 2) {
    const rad = (a * Math.PI) / 180;
    const [x, y] = ftToSvg(23.75 * Math.cos(rad), 23.75 * Math.sin(rad));
    arcPts.push(`${x},${y}`);
  }

  return (
    <>
      {/* Court outline */}
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      {/* Paint */}
      <rect x={BX - paintW} y={BY - 1} width={paintW * 2} height={paintH + 1} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      {/* Free throw circle */}
      <circle cx={BX} cy={BY + 19 * FT_Y} r={ftR} fill="none" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,4" />
      {/* Restricted area arc (4ft) */}
      <path d={`M ${BX - 4 * FT_X},${BY} A ${4 * FT_X} ${4 * FT_Y} 0 0 1 ${BX + 4 * FT_X},${BY}`} fill="none" stroke="#2a2a2a" strokeWidth="1" />
      {/* Basket / rim */}
      <circle cx={BX} cy={BY} r={4} fill="none" stroke="#928CEE" strokeWidth="1.5" />
      <line x1={rimL} y1={rimY - 3} x2={rimR} y2={rimY - 3} stroke="#555" strokeWidth="2" />
      {/* 3pt line — corners + arc */}
      <line x1={cornerL} y1={PAD} x2={cornerL} y2={cornerEndY} stroke="#333" strokeWidth="1.5" />
      <line x1={cornerR} y1={PAD} x2={cornerR} y2={cornerEndY} stroke="#333" strokeWidth="1.5" />
      <polyline points={arcPts.join(" ")} fill="none" stroke="#333" strokeWidth="1.5" />
      {/* Half court line */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#2a2a2a" strokeWidth="1.5" />
    </>
  );
}

// ---------- Zone geometry ----------
// Polar: 0° = toward halfcourt (SVG +Y), 90° = right sideline (SVG +X), -90° = left
function pt(rFt: number, aDeg: number): [number, number] {
  const rad = (aDeg * Math.PI) / 180;
  return ftToSvg(rFt * Math.sin(rad), rFt * Math.cos(rad));
}

function arcPts(rFt: number, a1: number, a2: number, n = 24): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = pt(rFt, a1 + (a2 - a1) * (i / n));
    pts.push(`${x},${y}`);
  }
  return pts.join(" L ");
}

// Annular sector: donut slice from inner radius to outer radius, angle a1 to a2
function annularSector(rInner: number, rOuter: number, a1: number, a2: number): string {
  const [ox1, oy1] = pt(rOuter, a1);
  return [
    `M ${ox1},${oy1}`,
    `L ${arcPts(rOuter, a1, a2)}`,   // outer arc forward
    `L ${arcPts(rInner, a2, a1)}`,   // inner arc backward
    "Z",
  ].join(" ");
}

// Constants
const T = 23.75; // 3pt distance
const C3 = 22;   // corner 3 distance
const LEFT = PAD, RIGHT = W - PAD, TOP = PAD, BOTTOM = H - PAD;
const BASELINE_Y = TOP; // baseline is at top of SVG
const [c3lx] = ftToSvg(-C3, 0);
const [c3rx] = ftToSvg(C3, 0);
// Corner 3 extends 14ft from BASELINE (not from basket). Basket is 5.25ft from baseline.
const [, cornerY] = ftToSvg(0, 14 - 5.25); // 14ft from baseline = 8.75ft from basket

// Angle boundaries for zone splits
const AM1 = 30, AM2 = 60; // mid-range splits
const A31 = 25, A32 = 45; // above-break-3 splits
// Angle where 3pt arc meets the corner break line (14ft from baseline = 8.75ft from basket)
const CORNER_ARC_ANGLE = Math.acos((14 - 5.25) / T) * (180 / Math.PI); // ≈ 68.4°

// RENDER ORDER: outer→inner (later drawn = on top = captures hover)
// 1. Above-break 3 + Corner 3 (outermost)
// 2. Mid-range (annular sectors from 14ft to 23.75ft arc)
// 3. Paint (simple rectangles, cover inner part of mid-range)
// 4. Restricted Area (semicircle, covers center of paint)
const RENDER_ORDER: ShotZone[] = [
  // Outer first
  "Above Break 3 (Left)", "Above Break 3 (Left Center)", "Above Break 3 (Center)",
  "Above Break 3 (Right Center)", "Above Break 3 (Right)",
  "Corner 3 (Left)", "Corner 3 (Right)",
  // Mid-range
  "Mid-Range (Left)", "Mid-Range (Left Center)", "Mid-Range (Center)",
  "Mid-Range (Right Center)", "Mid-Range (Right)",
  // Inner (on top)
  "Paint (Left)", "Paint (Right)",
  "Restricted Area",
];

function zonePath(zone: ShotZone): string {
  switch (zone) {
    // --- Restricted Area: semicircle below basket ---
    case "Restricted Area":
      return `M ${pt(4, -90).join(",")} L ${arcPts(4, -90, 90)} Z`;

    // --- Paint: rectangles from baseline to FT line (RA drawn on top handles cutout) ---
    case "Paint (Left)": {
      const [lx] = ftToSvg(-8, 0);
      const [, ftY] = ftToSvg(0, 19 - 5.25); // FT line is 19ft from baseline = 13.75ft from basket
      return `M ${lx},${BASELINE_Y} L ${lx},${ftY} L ${BX},${ftY} L ${BX},${BASELINE_Y} Z`;
    }
    case "Paint (Right)": {
      const [rx] = ftToSvg(8, 0);
      const [, ftY] = ftToSvg(0, 19 - 5.25);
      return `M ${BX},${BASELINE_Y} L ${BX},${ftY} L ${rx},${ftY} L ${rx},${BASELINE_Y} Z`;
    }

    // --- Mid-range: annular sectors from 14ft to 3pt arc ---
    case "Mid-Range (Center)":
      return annularSector(14, T, -AM1, AM1);
    case "Mid-Range (Left Center)":
      return annularSector(14, T, -AM2, -AM1);
    case "Mid-Range (Right Center)":
      return annularSector(14, T, AM1, AM2);
    case "Mid-Range (Left)":
      return annularSector(14, T, -CORNER_ARC_ANGLE, -AM2);
    case "Mid-Range (Right)":
      return annularSector(14, T, AM2, CORNER_ARC_ANGLE);

    // --- Corner 3: rectangles from sideline to 3pt corner line, baseline to corner break ---
    case "Corner 3 (Left)":
      return `M ${LEFT},${BASELINE_Y} L ${c3lx},${BASELINE_Y} L ${c3lx},${cornerY} L ${LEFT},${cornerY} Z`;
    case "Corner 3 (Right)":
      return `M ${c3rx},${BASELINE_Y} L ${RIGHT},${BASELINE_Y} L ${RIGHT},${cornerY} L ${c3rx},${cornerY} Z`;

    // --- Above-break 3: from 3pt arc outward to court boundary ---
    case "Above Break 3 (Left)": {
      const [ax] = pt(T, -A32);
      return [
        `M ${LEFT},${cornerY}`,
        `L ${arcPts(T, -CORNER_ARC_ANGLE, -A32)}`,
        `L ${ax},${BOTTOM}`,
        `L ${LEFT},${BOTTOM}`,
        "Z",
      ].join(" ");
    }
    case "Above Break 3 (Left Center)": {
      const [x1] = pt(T, -A32);
      const [x2] = pt(T, -A31);
      return [
        `M ${arcPts(T, -A32, -A31)}`,
        `L ${x2},${BOTTOM}`,
        `L ${x1},${BOTTOM}`,
        "Z",
      ].join(" ");
    }
    case "Above Break 3 (Center)": {
      const [xl] = pt(T, -A31);
      const [xr] = pt(T, A31);
      return [
        `M ${arcPts(T, -A31, A31)}`,
        `L ${xr},${BOTTOM}`,
        `L ${xl},${BOTTOM}`,
        "Z",
      ].join(" ");
    }
    case "Above Break 3 (Right Center)": {
      const [x1] = pt(T, A31);
      const [x2] = pt(T, A32);
      return [
        `M ${arcPts(T, A31, A32)}`,
        `L ${x2},${BOTTOM}`,
        `L ${x1},${BOTTOM}`,
        "Z",
      ].join(" ");
    }
    case "Above Break 3 (Right)": {
      const [ax] = pt(T, A32);
      return [
        `M ${ax},${BOTTOM}`,
        `L ${arcPts(T, A32, CORNER_ARC_ANGLE)}`,
        `L ${RIGHT},${cornerY}`,
        `L ${RIGHT},${BOTTOM}`,
        "Z",
      ].join(" ");
    }
  }
}

// Zone label positions
function zoneLabelPos(zone: ShotZone): [number, number] {
  const pos: Record<ShotZone, [number, number]> = {
    "Restricted Area": ftToSvg(0, 2),
    "Paint (Left)": ftToSvg(-4.5, 10),
    "Paint (Right)": ftToSvg(4.5, 10),
    "Mid-Range (Left)": ftToSvg(-16, 8),
    "Mid-Range (Left Center)": ftToSvg(-8, 20),
    "Mid-Range (Center)": ftToSvg(0, 21),
    "Mid-Range (Right Center)": ftToSvg(8, 20),
    "Mid-Range (Right)": ftToSvg(16, 8),
    "Corner 3 (Left)": ftToSvg(-19, 2),
    "Corner 3 (Right)": ftToSvg(19, 2),
    "Above Break 3 (Left)": ftToSvg(-20, 28),
    "Above Break 3 (Left Center)": ftToSvg(-13, 32),
    "Above Break 3 (Center)": ftToSvg(0, 35),
    "Above Break 3 (Right Center)": ftToSvg(13, 32),
    "Above Break 3 (Right)": ftToSvg(20, 28),
  };
  return pos[zone];
}

const ALL_ZONES = RENDER_ORDER;

// Short display name for zone
const SHORT_NAME: Record<ShotZone, string> = {
  "Restricted Area": "RA",
  "Paint (Left)": "Paint L",
  "Paint (Right)": "Paint R",
  "Mid-Range (Left)": "Mid L",
  "Mid-Range (Left Center)": "Mid LC",
  "Mid-Range (Center)": "Mid C",
  "Mid-Range (Right Center)": "Mid RC",
  "Mid-Range (Right)": "Mid R",
  "Corner 3 (Left)": "C3 L",
  "Corner 3 (Right)": "C3 R",
  "Above Break 3 (Left)": "AB3 L",
  "Above Break 3 (Left Center)": "AB3 LC",
  "Above Break 3 (Center)": "AB3 C",
  "Above Break 3 (Right Center)": "AB3 RC",
  "Above Break 3 (Right)": "AB3 R",
};

// ---------- Main component ----------
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
      const params = new URLSearchParams({
        playerId: String(playerId),
        team: teamTricode,
        seasonType: st,
      });
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

  useEffect(() => {
    fetchShots(seasonType);
  }, [seasonType, fetchShots]);

  const zoneStats = useMemo(() => aggregateZoneStats(shots), [shots]);
  const statsMap = useMemo(() => {
    const m = new Map<ShotZone, ZoneStats>();
    for (const s of zoneStats) m.set(s.zone, s);
    return m;
  }, [zoneStats]);

  const leagueAvg = 46; // NBA league average FG%
  const overallMade = shots.filter((s) => s.shotResult === "Made").length;
  const overallPct = shots.length > 0 ? (overallMade / shots.length) * 100 : 0;

  const hoveredStat = hoveredZone ? statsMap.get(hoveredZone) : null;

  const seasonTypeLabel = (st: string) => {
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

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["regular", "playoffs", "all"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSeasonType(st)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                seasonType === st ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              {seasonTypeLabel(st)}
            </button>
          ))}
        </div>
        {shots.length > 0 && (
          <span className="text-xs text-text-secondary ml-auto">
            {overallMade}/{shots.length} FG ({overallPct.toFixed(1)}%)
            {gamesInfo.loaded > 0 && (
              <span className="text-text-secondary/60 ml-1">
                · {gamesInfo.loaded}/{gamesInfo.total} {locale === "zh" ? "场" : "games"}
              </span>
            )}
          </span>
        )}
      </div>

      {loading && (
        <div className="h-64 flex items-center justify-center text-text-secondary text-sm">
          {locale === "zh" ? "加载中..." : "Loading..."}
        </div>
      )}

      {error && (
        <div className="h-32 flex items-center justify-center text-danger text-sm">{error}</div>
      )}

      {!loading && !error && shots.length === 0 && (
        <div className="h-32 flex items-center justify-center text-text-secondary text-sm">
          {locale === "zh" ? "该赛季无投篮数据" : "No shot data for this season"}
        </div>
      )}

      {!loading && shots.length > 0 && (
        <>
          {/* Legend */}
          <div className="flex items-center justify-center gap-3 mb-2 text-[10px] text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(25, leagueAvg) }} />
              {t.shotHeatmap.belowAvg}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(leagueAvg, leagueAvg) }} />
              {t.shotHeatmap.avg}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: getZoneColor(65, leagueAvg) }} />
              {t.shotHeatmap.aboveAvg}
            </span>
          </div>

          {/* Court heatmap */}
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 500 }}>
              <rect x="0" y="0" width={W} height={H} fill="#141414" rx="8" />

              {/* Zone fills */}
              {ALL_ZONES.map((zone) => {
                const stat = statsMap.get(zone);
                const color = stat ? getZoneColor(stat.pct, leagueAvg) : "#1e1e1e";
                const opacity = stat ? (hoveredZone === zone ? 0.95 : 0.65) : 0.2;
                return (
                  <path
                    key={zone}
                    d={zonePath(zone)}
                    fill={color}
                    fillOpacity={opacity}
                    stroke={hoveredZone === zone ? "#fff" : "#333"}
                    strokeWidth={hoveredZone === zone ? 2 : 0.5}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredZone(zone)}
                    onMouseLeave={() => setHoveredZone(null)}
                  />
                );
              })}

              <CourtMarkings />

              {/* Zone labels */}
              {ALL_ZONES.map((zone) => {
                const stat = statsMap.get(zone);
                if (!stat) return null;
                const [lx, ly] = zoneLabelPos(zone);
                return (
                  <g key={`lbl-${zone}`} className="pointer-events-none">
                    <text x={lx} y={ly - 2} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                      {stat.pct.toFixed(1)}%
                    </text>
                    <text x={lx} y={ly + 11} textAnchor="middle" fill="#bbb" fontSize="9">
                      {stat.made}/{stat.total}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover tooltip */}
            {hoveredZone && hoveredStat && (
              <div className="absolute top-2 right-2 bg-bg-secondary/95 border border-border rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none z-10">
                <p className="font-bold text-text-primary">{hoveredZone}</p>
                <p className="text-accent text-lg font-bold">{hoveredStat.pct.toFixed(1)}%</p>
                <p className="text-text-secondary">{hoveredStat.made}/{hoveredStat.total} FG</p>
                <p className={`text-[10px] mt-1 ${hoveredStat.pct > leagueAvg ? "text-red-400" : hoveredStat.pct < leagueAvg - 5 ? "text-blue-400" : "text-orange-400"}`}>
                  {hoveredStat.pct > leagueAvg ? `+${(hoveredStat.pct - leagueAvg).toFixed(1)}` : (hoveredStat.pct - leagueAvg).toFixed(1)}% vs {locale === "zh" ? "联盟均值" : "league avg"}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
