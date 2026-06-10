"use client";

// Self-contained half-court shot-zone renderer for the Career Arc tool.
// Geometry mirrors src/components/ShotHeatmap.tsx (basket at BOTTOM, halfcourt
// at TOP, all zone boundaries straight lines with the 3pt arc drawn on top),
// but this is an independent renderer that takes a pre-aggregated ZoneStats[]
// and an overall make %, so the season scrubber can drive it directly without
// the sibling component's own season<select>/fetch machinery.

import { useMemo, useState } from "react";
import { getZoneColor, type ShotZone, type ZoneStats } from "@/lib/shot-zones";

// ---- Court constants (px) ----
const W = 470;
const H = 450;
const PAD = 6;
const CW = W - PAD * 2;
const CH = H - PAD * 2;
const SX = CW / 50; // px per foot horizontal (court 50ft wide)
const SY = CH / 47; // px per foot vertical (~47ft of half court)
const BX = W / 2;
const BY = H - PAD - 5.25 * SY; // basket position
const BASELINE = H - PAD;
const HALFCOURT = PAD;

// feet-from-basket → SVG. dy>0 = toward halfcourt (up in SVG)
function sv(dxFt: number, dyFt: number): [number, number] {
  return [BX + dxFt * SX, BY - dyFt * SY];
}

// 3pt arc point at a given angle (deg from straight-ahead)
function arcPt(aDeg: number): [number, number] {
  const r = (aDeg * Math.PI) / 180;
  return sv(23.75 * Math.sin(r), 23.75 * Math.cos(r));
}

// ---- Key positions ----
const PAINT_L = sv(-8, 0)[0];
const PAINT_R = sv(8, 0)[0];
const FT_Y = sv(0, 19 - 5.25)[1];

const CORNER_DEPTH_FT = 14 - 5.25; // 8.75ft from basket
const ARC_CORNER_A = Math.acos(CORNER_DEPTH_FT / 23.75) * (180 / Math.PI);
const [C3L] = arcPt(-ARC_CORNER_A);
const [C3R] = arcPt(ARC_CORNER_A);
const CORNER_Y = sv(0, CORNER_DEPTH_FT)[1];

const WING_A = 25;

function clipWingToCourtTop(aDeg: number): [number, number] {
  const rad = (aDeg * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const dTop = (BY - HALFCOURT) / (cosA * SY);
  const xAtTop = BX + dTop * sinA * SX;
  const sideline = aDeg < 0 ? PAD : W - PAD;
  const dSide = (sideline - BX) / (sinA * SX);
  if (dSide > 0 && dSide < dTop) {
    const yAtSide = BY - dSide * cosA * SY;
    return [sideline, yAtSide];
  }
  return [xAtTop, HALFCOURT];
}
const WING_L_EXT = clipWingToCourtTop(-WING_A);
const WING_R_EXT = clipWingToCourtTop(WING_A);

function arc3pt(a1: number, a2: number, n = 30): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = arcPt(a1 + (a2 - a1) * (i / n));
    pts.push(`${x},${y}`);
  }
  return pts.join(" L ");
}

function wingPaintIntersection(aDeg: number): [number, number] {
  const rad = (aDeg * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const paintEdgeX = aDeg < 0 ? PAINT_L : PAINT_R;
  const d = (paintEdgeX - BX) / (sinA * SX);
  return [paintEdgeX, BY - d * cosA * SY];
}
const WING_PAINT_L = wingPaintIntersection(-WING_A);
const WING_PAINT_R = wingPaintIntersection(WING_A);

// Render order: outer → inner (later = on top = captures hover)
const RENDER_ORDER: ShotZone[] = [
  "Above Break 3 (Left)", "Above Break 3 (Center)", "Above Break 3 (Right)",
  "Mid-Range (Left)", "Mid-Range (Center)", "Mid-Range (Right)",
  "Corner 3 (Left)", "Corner 3 (Right)",
  "Paint",
  "Restricted Area",
];

function zonePath(zone: ShotZone): string {
  switch (zone) {
    case "Restricted Area": {
      const [lx, ly] = sv(-4, 0);
      const [rx, ry] = sv(4, 0);
      return `M ${lx},${ly} A ${4 * SX} ${4 * SY} 0 0 1 ${rx},${ry} Z`;
    }
    case "Paint":
      return `M ${PAINT_L},${BASELINE} L ${PAINT_L},${FT_Y} L ${PAINT_R},${FT_Y} L ${PAINT_R},${BASELINE} Z`;
    case "Mid-Range (Left)":
      return [
        `M ${PAINT_L},${BASELINE}`,
        `L ${PAINT_L},${WING_PAINT_L[1]}`,
        `L ${arc3pt(-WING_A, -ARC_CORNER_A)}`,
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
      return [
        `M ${WING_PAINT_L.join(",")}`,
        `L ${arc3pt(-WING_A, WING_A)}`,
        `L ${WING_PAINT_R.join(",")}`,
        `L ${PAINT_R},${FT_Y}`,
        `L ${PAINT_L},${FT_Y}`,
        "Z",
      ].join(" ");
    case "Corner 3 (Left)":
      return `M ${PAD},${BASELINE} L ${PAD},${CORNER_Y} L ${C3L},${CORNER_Y} L ${C3L},${BASELINE} Z`;
    case "Corner 3 (Right)":
      return `M ${C3R},${BASELINE} L ${C3R},${CORNER_Y} L ${W - PAD},${CORNER_Y} L ${W - PAD},${BASELINE} Z`;
    case "Above Break 3 (Left)":
      return [
        `M ${PAD},${CORNER_Y}`,
        `L ${C3L},${CORNER_Y}`,
        `L ${arc3pt(-ARC_CORNER_A, -WING_A)}`,
        `L ${WING_L_EXT.join(",")}`,
        `L ${PAD},${HALFCOURT}`,
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
        `L ${arc3pt(WING_A, ARC_CORNER_A)}`,
        `L ${C3R},${CORNER_Y}`,
        `L ${W - PAD},${CORNER_Y}`,
        `L ${W - PAD},${HALFCOURT}`,
        "Z",
      ].join(" ");
  }
}

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

// Geometry is fully static — precompute paths & labels once at module load.
const ZONE_PATHS: Record<ShotZone, string> = RENDER_ORDER.reduce((acc, z) => {
  acc[z] = zonePath(z);
  return acc;
}, {} as Record<ShotZone, string>);
const ZONE_LABELS: Record<ShotZone, [number, number]> = RENDER_ORDER.reduce((acc, z) => {
  acc[z] = zoneLabel(z);
  return acc;
}, {} as Record<ShotZone, [number, number]>);

// Bilingual short zone names for the hover tooltip.
const ZONE_NAME_ZH: Record<ShotZone, string> = {
  "Restricted Area": "篮下",
  "Paint": "油漆区",
  "Mid-Range (Left)": "左侧中距离",
  "Mid-Range (Center)": "中路中距离",
  "Mid-Range (Right)": "右侧中距离",
  "Corner 3 (Left)": "左底角三分",
  "Corner 3 (Right)": "右底角三分",
  "Above Break 3 (Left)": "左侧弧顶三分",
  "Above Break 3 (Center)": "正面弧顶三分",
  "Above Break 3 (Right)": "右侧弧顶三分",
};

function CourtLines() {
  const ARC_A = Math.acos((14 - 5.25) / 23.75) * (180 / Math.PI);
  const arcPts: string[] = [];
  for (let a = -ARC_A; a <= ARC_A; a += 2) {
    const [x, y] = arcPt(a);
    arcPts.push(`${x},${y}`);
  }
  arcPts.push(`${arcPt(ARC_A).join(",")}`);
  const [arcLeftX, arcLeftY] = arcPt(-ARC_A);
  const [arcRightX, arcRightY] = arcPt(ARC_A);

  return (
    <>
      <rect x={PAD} y={HALFCOURT} width={CW} height={CH} fill="none" stroke="var(--court-line)" strokeWidth="1.5" />
      <rect x={PAINT_L} y={FT_Y} width={PAINT_R - PAINT_L} height={BASELINE - FT_Y} fill="none" stroke="var(--court-line)" strokeWidth="1.5" />
      <circle cx={BX} cy={FT_Y} r={6 * SX} fill="none" stroke="var(--court-line)" strokeWidth="1" strokeDasharray="4,4" />
      <path d={`M ${sv(-4, 0).join(",")} A ${4 * SX} ${4 * SY} 0 0 1 ${sv(4, 0).join(",")}`} fill="none" stroke="var(--court-line)" strokeWidth="1" />
      <circle cx={BX} cy={BY} r={4} fill="none" stroke="#928CEE" strokeWidth="1.5" />
      <line x1={BX - 12} y1={BY + 4} x2={BX + 12} y2={BY + 4} stroke="var(--court-line-strong)" strokeWidth="2" />
      <line x1={arcLeftX} y1={BASELINE} x2={arcLeftX} y2={arcLeftY} stroke="var(--court-line-strong)" strokeWidth="1.5" />
      <line x1={arcRightX} y1={BASELINE} x2={arcRightX} y2={arcRightY} stroke="var(--court-line-strong)" strokeWidth="1.5" />
      <polyline points={arcPts.join(" ")} fill="none" stroke="var(--court-line-strong)" strokeWidth="1.5" />
    </>
  );
}

interface Props {
  zoneStats: ZoneStats[];
  overallPct: number;
  leagueAvg: number;
  isZh: boolean;
  /** Label drawn into the aria text (e.g. the season string). */
  seasonLabel: string;
}

export default function CareerCourt({ zoneStats, overallPct, leagueAvg, isZh, seasonLabel }: Props) {
  const [hoveredZone, setHoveredZone] = useState<ShotZone | null>(null);

  const statsMap = useMemo(() => {
    const m = new Map<ShotZone, ZoneStats>();
    for (const s of zoneStats) m.set(s.zone, s);
    return m;
  }, [zoneStats]);

  const hoveredStat = hoveredZone ? statsMap.get(hoveredZone) : null;
  const zoneName = (z: ShotZone) => (isZh ? ZONE_NAME_ZH[z] : z);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 480 }}
        role="img"
        aria-label={
          isZh
            ? `${seasonLabel} 赛季投篮热区图，命中率 ${overallPct.toFixed(1)}%`
            : `Shot-zone heatmap for ${seasonLabel}, ${overallPct.toFixed(1)}% FG`
        }
      >
        <rect x="0" y="0" width={W} height={H} fill="var(--court-bg)" rx="8" />

        {RENDER_ORDER.map((zone) => {
          const stat = statsMap.get(zone);
          const isHover = hoveredZone === zone;
          const color = stat ? getZoneColor(stat.pct, leagueAvg) : "#1e1e1e";
          const opacity = stat ? (isHover ? 0.9 : 0.6) : 0.15;
          return (
            <path
              key={zone}
              d={ZONE_PATHS[zone]}
              fill={color}
              fillOpacity={opacity}
              stroke={isHover ? "#fff" : "none"}
              strokeWidth={isHover ? 2 : 0}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredZone(zone)}
              onMouseLeave={() => setHoveredZone(null)}
            />
          );
        })}

        <CourtLines />

        <line x1={WING_PAINT_L[0]} y1={WING_PAINT_L[1]} x2={WING_L_EXT[0]} y2={WING_L_EXT[1]} stroke="var(--court-line)" strokeWidth="1" />
        <line x1={WING_PAINT_R[0]} y1={WING_PAINT_R[1]} x2={WING_R_EXT[0]} y2={WING_R_EXT[1]} stroke="var(--court-line)" strokeWidth="1" />

        {RENDER_ORDER.map((zone) => {
          const stat = statsMap.get(zone);
          if (!stat) return null;
          const [lx, ly] = ZONE_LABELS[zone];
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
          <p className="font-bold text-text-primary">{zoneName(hoveredZone)}</p>
          <p className="text-accent text-lg font-bold">{hoveredStat.pct.toFixed(1)}%</p>
          <p className="text-text-secondary">{hoveredStat.made}/{hoveredStat.total} FG</p>
          <p className={`text-[10px] mt-1 ${hoveredStat.pct > leagueAvg ? "text-danger" : hoveredStat.pct < leagueAvg - 5 ? "text-accent" : "text-accent-amber"}`}>
            {hoveredStat.pct > leagueAvg ? "+" : ""}{(hoveredStat.pct - leagueAvg).toFixed(1)}% vs {isZh ? "联盟均值" : "league avg"}
          </p>
        </div>
      )}
    </div>
  );
}
