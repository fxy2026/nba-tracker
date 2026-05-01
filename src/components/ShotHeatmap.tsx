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

// ============================================================
// Half-court SVG — basket at BOTTOM, halfcourt at TOP
// All zone boundaries are STRAIGHT LINES (no arc fills)
// The 3pt arc is drawn as a court marking line on top
// ============================================================
const W = 470, H = 450, PAD = 6;
const CW = W - PAD * 2;
const CH = H - PAD * 2;
const SX = CW / 50;  // px per foot horizontal (court is 50ft wide)
const SY = CH / 47;  // px per foot vertical (showing ~47ft of half court)
const BX = W / 2;
const BY = H - PAD - 5.25 * SY; // basket position
const BASELINE = H - PAD;
const HALFCOURT = PAD;

// feet-from-basket → SVG. dy>0 = toward halfcourt (up in SVG)
function sv(dxFt: number, dyFt: number): [number, number] {
  return [BX + dxFt * SX, BY - dyFt * SY];
}

// ---- Key positions in SVG coords ----
// Paint: 16ft wide (±8ft), 19ft from baseline to FT line
const PAINT_L = sv(-8, 0)[0];
const PAINT_R = sv(8, 0)[0];
const FT_Y = sv(0, 19 - 5.25)[1]; // FT line in SVG-Y

// Corner 3: sideline at ±22ft from center, extends 14ft from baseline
const C3L = sv(-22, 0)[0];
const C3R = sv(22, 0)[0];
const CORNER_Y = sv(0, 14 - 5.25)[1]; // where corner 3 ends

// 3pt arc intersection with corner line (angle where arc meets corner depth)
const CORNER_DEPTH_FT = 14 - 5.25; // 8.75ft from basket
const ARC_CORNER_A = Math.acos(CORNER_DEPTH_FT / 23.75) * (180 / Math.PI); // ≈68.4°

// Wing split angle — divides left/center/right for mid-range and above-break-3
// At this angle, the 3pt arc point X equals the paint edge X
// asin(8/23.75) ≈ 19.7°, but visually we want a wider center like Hupu → use ~40°
const WING_A = 40;

// 3pt arc point at WING_A angle
function arcPt(aDeg: number): [number, number] {
  const r = (aDeg * Math.PI) / 180;
  return sv(23.75 * Math.sin(r), 23.75 * Math.cos(r));
}

// ---- Court markings (lines only, no fills) ----
function CourtLines() {
  // 3pt arc polyline
  const arcPts: string[] = [];
  for (let a = -90; a <= 90; a += 2) {
    const [x, y] = arcPt(a);
    arcPts.push(`${x},${y}`);
  }

  return (
    <>
      {/* Court outline */}
      <rect x={PAD} y={HALFCOURT} width={CW} height={CH} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      {/* Paint */}
      <rect x={PAINT_L} y={FT_Y} width={PAINT_R - PAINT_L} height={BASELINE - FT_Y} fill="none" stroke="#3a3a3a" strokeWidth="1.5" />
      {/* FT circle */}
      <circle cx={BX} cy={FT_Y} r={6 * SX} fill="none" stroke="#3a3a3a" strokeWidth="1" strokeDasharray="4,4" />
      {/* Restricted area semicircle */}
      <path d={`M ${sv(-4, 0).join(",")} A ${4 * SX} ${4 * SY} 0 0 0 ${sv(4, 0).join(",")}`} fill="none" stroke="#3a3a3a" strokeWidth="1" />
      {/* Basket */}
      <circle cx={BX} cy={BY} r={4} fill="none" stroke="#928CEE" strokeWidth="1.5" />
      <line x1={BX - 12} y1={BY + 4} x2={BX + 12} y2={BY + 4} stroke="#555" strokeWidth="2" />
      {/* 3pt line */}
      <line x1={C3L} y1={BASELINE} x2={C3L} y2={CORNER_Y} stroke="#444" strokeWidth="1.5" />
      <line x1={C3R} y1={BASELINE} x2={C3R} y2={CORNER_Y} stroke="#444" strokeWidth="1.5" />
      <polyline points={arcPts.join(" ")} fill="none" stroke="#444" strokeWidth="1.5" />
    </>
  );
}

// ---- Zone boundary lines (straight lines from basket at WING_A angle) ----
// These lines divide mid-range and above-break-3 into left/center/right
// Extend from FT area to court edge
const WING_L = arcPt(-WING_A); // left wing point on 3pt arc
const WING_R = arcPt(WING_A);  // right wing point on 3pt arc

// Extend wing lines from 3pt arc to court boundary, clipped to court rect
function clipWingToCourtTop(aDeg: number): [number, number] {
  const rad = (aDeg * Math.PI) / 180;
  const sinA = Math.sin(rad), cosA = Math.cos(rad);
  // Distance to reach court top (y = HALFCOURT): BY - d*cosA*SY = HALFCOURT
  const dTop = (BY - HALFCOURT) / (cosA * SY);
  const xAtTop = BX + dTop * sinA * SX;
  // Distance to reach sideline: BX + d*sinA*SX = PAD (left) or W-PAD (right)
  const sideline = aDeg < 0 ? PAD : W - PAD;
  const dSide = (sideline - BX) / (sinA * SX);
  // Use whichever is closer
  if (dSide > 0 && dSide < dTop) {
    const yAtSide = BY - dSide * cosA * SY;
    return [sideline, yAtSide];
  }
  return [xAtTop, HALFCOURT];
}
const WING_L_EXT = clipWingToCourtTop(-WING_A);
const WING_R_EXT = clipWingToCourtTop(WING_A);

// Arc polyline between two angles at 3pt distance
function arc3pt(a1: number, a2: number, n = 30): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = arcPt(a1 + (a2 - a1) * (i / n));
    pts.push(`${x},${y}`);
  }
  return pts.join(" L ");
}

// Find where the wing line (from basket at angle aDeg) intersects the paint left/right edge
function wingPaintIntersection(aDeg: number): [number, number] {
  const rad = (aDeg * Math.PI) / 180;
  const sinA = Math.sin(rad), cosA = Math.cos(rad);
  const paintEdgeX = aDeg < 0 ? PAINT_L : PAINT_R;
  const d = (paintEdgeX - BX) / (sinA * SX);
  return [paintEdgeX, BY - d * cosA * SY];
}
const WING_PAINT_L = wingPaintIntersection(-WING_A);
const WING_PAINT_R = wingPaintIntersection(WING_A);

// ---- Zone paths (10 zones) ----
// Render order: outer→inner (later = on top = captures hover)
const RENDER_ORDER: ShotZone[] = [
  // Outermost first (background)
  "Above Break 3 (Left)", "Above Break 3 (Center)", "Above Break 3 (Right)",
  // Mid-range BEFORE corner 3 (corner 3 overlaps mid-range at baseline corners)
  "Mid-Range (Left)", "Mid-Range (Center)", "Mid-Range (Right)",
  "Corner 3 (Left)", "Corner 3 (Right)",
  // Innermost last (foreground)
  "Paint",
  "Restricted Area",
];

function zonePath(zone: ShotZone): string {
  switch (zone) {
    // ---- Restricted Area: semicircle ----
    case "Restricted Area": {
      const [lx, ly] = sv(-4, 0);
      const [rx, ry] = sv(4, 0);
      return `M ${lx},${ly} A ${4 * SX} ${4 * SY} 0 0 0 ${rx},${ry} Z`;
    }

    // ---- Paint: rectangle from baseline to FT line ----
    case "Paint":
      return `M ${PAINT_L},${BASELINE} L ${PAINT_L},${FT_Y} L ${PAINT_R},${FT_Y} L ${PAINT_R},${BASELINE} Z`;

    // ---- Mid-Range: bounded by paint edge (inner), 3PT ARC (outer), wing lines (sides) ----
    case "Mid-Range (Left)":
      // paint edge → along 3pt arc (from corner break to wing) → wing line to paint
      return [
        `M ${PAINT_L},${BASELINE}`,
        `L ${PAINT_L},${WING_PAINT_L[1]}`,
        `L ${arc3pt(-WING_A, -ARC_CORNER_A)}`,  // arc from wing to corner break
        `L ${C3L},${CORNER_Y}`,
        `L ${C3L},${BASELINE}`,
        "Z",
      ].join(" ");

    case "Mid-Range (Right)":
      return [
        `M ${PAINT_R},${BASELINE}`,
        `L ${C3R},${BASELINE}`,
        `L ${C3R},${CORNER_Y}`,
        `L ${arc3pt(ARC_CORNER_A, WING_A)}`,
        `L ${WING_PAINT_R.join(",")}`,
        `L ${PAINT_R},${BASELINE}`,
        "Z",
      ].join(" ");

    case "Mid-Range (Center)":
      // paint edge (wing intersection) → wing line to 3pt arc → ARC → wing line → paint edge
      return [
        `M ${WING_PAINT_L.join(",")}`,
        `L ${arc3pt(-WING_A, WING_A)}`,
        `L ${WING_PAINT_R.join(",")}`,
        `L ${PAINT_R},${FT_Y}`,
        `L ${PAINT_L},${FT_Y}`,
        "Z",
      ].join(" ");

    // ---- Corner 3: bounded by sideline, baseline, and 3pt arc ----
    case "Corner 3 (Left)":
      // sideline→baseline→corner line→up to arc break→follow arc down toward baseline→bridge to sideline
      return [
        `M ${PAD},${BASELINE}`,
        `L ${C3L},${BASELINE}`,
        `L ${C3L},${CORNER_Y}`,
        `L ${arc3pt(-ARC_CORNER_A, -90)}`,  // follow arc from corner break toward sideline
        `L ${PAD},${arcPt(-90)[1]}`,        // bridge to sideline at arc end height
        "Z",
      ].join(" ");

    case "Corner 3 (Right)":
      return [
        `M ${C3R},${BASELINE}`,
        `L ${W - PAD},${BASELINE}`,
        `L ${W - PAD},${arcPt(90)[1]}`,
        `L ${arc3pt(90, ARC_CORNER_A)}`,
        `L ${C3R},${CORNER_Y}`,
        "Z",
      ].join(" ");

    // ---- Above Break 3: bounded by 3PT ARC (inner) and court boundary (outer) ----
    case "Above Break 3 (Left)":
      // From sideline at arc-end height → arc from -90° to wing → wing line to court edge → court top → sideline
      return [
        `M ${PAD},${arcPt(-90)[1]}`,            // sideline at arc end height
        `L ${arc3pt(-90, -WING_A)}`,            // full arc from sideline to wing
        `L ${WING_L_EXT.join(",")}`,            // wing line to court edge
        `L ${PAD},${HALFCOURT}`,                // sideline at court top
        "Z",
      ].join(" ");

    case "Above Break 3 (Center)":
      return [
        `M ${WING_L_EXT.join(",")}`,
        `L ${arc3pt(-WING_A, WING_A)}`,
        `L ${WING_R_EXT.join(",")}`,
        `L ${WING_R_EXT[0]},${HALFCOURT}`,
        `L ${WING_L_EXT[0]},${HALFCOURT}`,
        "Z",
      ].join(" ");

    case "Above Break 3 (Right)":
      return [
        `M ${WING_R_EXT.join(",")}`,
        `L ${arc3pt(WING_A, 90)}`,
        `L ${W - PAD},${arcPt(90)[1]}`,
        `L ${W - PAD},${HALFCOURT}`,
        "Z",
      ].join(" ");
  }
}

// ---- Zone label positions ----
function zoneLabel(zone: ShotZone): [number, number] {
  switch (zone) {
    case "Restricted Area": return sv(0, 1.5);
    case "Paint": return sv(0, 10);
    case "Mid-Range (Left)": return sv(-14, 5);
    case "Mid-Range (Center)": return sv(0, 20);
    case "Mid-Range (Right)": return sv(14, 5);
    case "Corner 3 (Left)": return [PAD + (C3L - PAD) / 2, BASELINE - 30];
    case "Corner 3 (Right)": return [C3R + (W - PAD - C3R) / 2, BASELINE - 30];
    case "Above Break 3 (Left)": return sv(-17, 28);
    case "Above Break 3 (Center)": return sv(0, 32);
    case "Above Break 3 (Right)": return sv(17, 28);
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
                const opacity = stat ? (hoveredZone === zone ? 0.9 : 0.6) : 0.15;
                return (
                  <path key={zone} d={zonePath(zone)} fill={color} fillOpacity={opacity}
                    stroke={hoveredZone === zone ? "#fff" : "none"} strokeWidth={hoveredZone === zone ? 2 : 0}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredZone(zone)} onMouseLeave={() => setHoveredZone(null)} />
                );
              })}

              <CourtLines />

              {/* Zone divider lines (wing angles — from paint edge through 3pt arc to court boundary) */}
              <line x1={WING_PAINT_L[0]} y1={WING_PAINT_L[1]} x2={WING_L_EXT[0]} y2={WING_L_EXT[1]} stroke="#3a3a3a" strokeWidth="1" />
              <line x1={WING_PAINT_R[0]} y1={WING_PAINT_R[1]} x2={WING_R_EXT[0]} y2={WING_R_EXT[1]} stroke="#3a3a3a" strokeWidth="1" />

              {RENDER_ORDER.map((zone) => {
                const stat = statsMap.get(zone);
                if (!stat) return null;
                const [lx, ly] = zoneLabel(zone);
                return (
                  <g key={`lbl-${zone}`} className="pointer-events-none">
                    <text x={lx} y={ly - 2} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{stat.pct.toFixed(1)}%</text>
                    <text x={lx} y={ly + 12} textAnchor="middle" fill="#ccc" fontSize="10">{stat.made}/{stat.total}</text>
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
