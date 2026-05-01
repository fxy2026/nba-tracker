"use client";

import { useMemo } from "react";
import type { ShotAction } from "@/lib/api";
import { aggregateZoneStats, getZoneColor, type ShotZone, type ZoneStats } from "@/lib/shot-zones";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  shots: ShotAction[];
  leagueAvg?: number; // overall FG%, default 46
}

// Half-court SVG dimensions
const W = 500, H = 470, PAD = 10;
// Court: 50ft wide × 47ft deep (half court to just past 3pt line)
const COURT_W = W - PAD * 2;
const COURT_H = H - PAD * 2;
// Basket position in SVG coords (centered, 5.25ft from baseline)
const BX = W / 2;
const BY = PAD + (5.25 / 47) * COURT_H;
// Scale: 1ft in SVG pixels
const FT = COURT_W / 50;

// Convert polar (distance in ft, angle in degrees) to SVG coords
// angle: 0 = straight down court, 90 = sideline right, -90 = sideline left
function polar(dist: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [BX + dist * FT * Math.sin(rad), BY + dist * FT * Math.cos(rad)];
}

// Zone SVG path definitions — each zone is a closed polygon/arc
// These approximate NBA's official zone boundaries on a half court
function getZonePath(zone: ShotZone): string {
  const r4 = 4 * FT;       // restricted area radius
  const r14 = 14 * FT;     // paint radius
  const r22 = 22 * FT;     // corner 3 distance
  const r24 = 23.75 * FT;  // 3pt arc distance

  // Paint width: 16ft total = 8ft each side
  const paintL = BX - 8 * FT;
  const paintR = BX + 8 * FT;
  const paintBottom = BY + 19 * FT; // free throw line is 19ft from basket

  // Corner 3: extends 14ft from baseline
  const corner3Y = PAD + (14 / 47) * COURT_H;
  // Sideline 3pt: 3ft from sideline → 22ft from basket center at corners
  const sidelineL = PAD + ((25 - 22) / 50) * COURT_W;
  const sidelineR = PAD + ((25 + 22) / 50) * COURT_W;

  // Helper: arc from angle1 to angle2 at given radius
  const arc = (r: number, a1: number, a2: number, steps = 20) => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = a1 + (a2 - a1) * (i / steps);
      const [x, y] = polar(r / FT, a);
      pts.push(`${x},${y}`);
    }
    return pts.join(" L ");
  };

  switch (zone) {
    case "Restricted Area":
      return `M ${BX - r4},${BY} A ${r4} ${r4} 0 1 1 ${BX + r4},${BY} A ${r4} ${r4} 0 1 1 ${BX - r4},${BY} Z`;

    case "Paint (Left)":
      return `M ${paintL},${BY} L ${paintL},${paintBottom} L ${BX},${paintBottom} L ${BX},${BY} A ${r4} ${r4} 0 0 0 ${BX - r4},${BY} L ${paintL},${BY} Z`;

    case "Paint (Right)":
      return `M ${BX},${BY} L ${BX},${paintBottom} L ${paintR},${paintBottom} L ${paintR},${BY} L ${BX + r4},${BY} A ${r4} ${r4} 0 0 0 ${BX},${BY} Z`;

    case "Mid-Range (Left)": {
      const [x1, y1] = polar(14, -60);
      const [x2, y2] = polar(23.75, -60);
      return `M ${paintL},${BY} L ${paintL},${paintBottom} L ${x1} ${y1} L ${arc(r14, -60, -90)} L ${arc(r24, -90, -60)} L ${x2} ${y2} L ${paintL},${BY} Z`;
    }
    case "Mid-Range (Right)": {
      const [x1, y1] = polar(14, 60);
      const [x2, y2] = polar(23.75, 60);
      return `M ${paintR},${BY} L ${paintR},${paintBottom} L ${x1} ${y1} L ${arc(r14, 60, 90)} L ${arc(r24, 90, 60)} L ${x2} ${y2} L ${paintR},${BY} Z`;
    }

    case "Mid-Range (Left Center)": {
      return `M ${BX},${paintBottom} L ${paintL},${paintBottom} L ${arc(r14, -60, -30)} L ${arc(r24, -30, -60)} Z`;
    }
    case "Mid-Range (Right Center)": {
      return `M ${BX},${paintBottom} L ${paintR},${paintBottom} L ${arc(r14, 60, 30)} L ${arc(r24, 30, 60)} Z`;
    }
    case "Mid-Range (Center)": {
      return `M ${BX},${paintBottom} L ${arc(r14, -30, 30)} L ${arc(r24, 30, -30)} Z`;
    }

    case "Corner 3 (Left)":
      return `M ${PAD},${PAD} L ${sidelineL},${PAD} L ${sidelineL},${corner3Y} L ${PAD},${corner3Y} Z`;

    case "Corner 3 (Right)":
      return `M ${sidelineR},${PAD} L ${W - PAD},${PAD} L ${W - PAD},${corner3Y} L ${sidelineR},${corner3Y} Z`;

    case "Above Break 3 (Left)": {
      return `M ${sidelineL},${corner3Y} L ${PAD},${corner3Y} L ${PAD},${H - PAD} L ${BX - r24 * Math.sin(Math.PI / 4)},${H - PAD} L ${arc(r24, -45, -60)} L ${sidelineL},${corner3Y} Z`;
    }
    case "Above Break 3 (Left Center)": {
      const [x1, y1] = polar(23.75, -25);
      const [x2, y2] = polar(23.75, -45);
      return `M ${x1},${y1} L ${arc(r24, -25, -45)} L ${x2},${y2} L ${BX - r24 * Math.sin(Math.PI / 4)},${H - PAD} L ${x1},${H - PAD} Z`;
    }
    case "Above Break 3 (Center)": {
      const [x1, y1] = polar(23.75, -25);
      const [x2, y2] = polar(23.75, 25);
      return `M ${x1},${y1} L ${arc(r24, -25, 25)} L ${x2},${y2} L ${x2},${H - PAD} L ${x1},${H - PAD} Z`;
    }
    case "Above Break 3 (Right Center)": {
      const [x1, y1] = polar(23.75, 25);
      const [x2, y2] = polar(23.75, 45);
      return `M ${x1},${y1} L ${arc(r24, 25, 45)} L ${x2},${y2} L ${BX + r24 * Math.sin(Math.PI / 4)},${H - PAD} L ${x1},${H - PAD} Z`;
    }
    case "Above Break 3 (Right)": {
      return `M ${sidelineR},${corner3Y} L ${sidelineR},${corner3Y} L ${arc(r24, 60, 45)} L ${BX + r24 * Math.sin(Math.PI / 4)},${H - PAD} L ${W - PAD},${H - PAD} L ${W - PAD},${corner3Y} Z`;
    }
  }
}

// Zone label positions (SVG x,y) for text rendering
function getZoneLabelPos(zone: ShotZone): [number, number] {
  switch (zone) {
    case "Restricted Area": return [BX, BY + 2 * FT];
    case "Paint (Left)": return [BX - 4.5 * FT, BY + 10 * FT];
    case "Paint (Right)": return [BX + 4.5 * FT, BY + 10 * FT];
    case "Mid-Range (Left)": return [BX - 14 * FT, BY + 10 * FT];
    case "Mid-Range (Left Center)": return [BX - 8 * FT, BY + 18 * FT];
    case "Mid-Range (Center)": return [BX, BY + 20 * FT];
    case "Mid-Range (Right Center)": return [BX + 8 * FT, BY + 18 * FT];
    case "Mid-Range (Right)": return [BX + 14 * FT, BY + 10 * FT];
    case "Corner 3 (Left)": return [PAD + 3 * FT, BY + 4 * FT];
    case "Corner 3 (Right)": return [W - PAD - 3 * FT, BY + 4 * FT];
    case "Above Break 3 (Left)": return [PAD + 4 * FT, BY + 25 * FT];
    case "Above Break 3 (Left Center)": return [BX - 14 * FT, BY + 28 * FT];
    case "Above Break 3 (Center)": return [BX, BY + 30 * FT];
    case "Above Break 3 (Right Center)": return [BX + 14 * FT, BY + 28 * FT];
    case "Above Break 3 (Right)": return [W - PAD - 4 * FT, BY + 25 * FT];
  }
}

const ALL_ZONES: ShotZone[] = [
  "Restricted Area",
  "Paint (Left)", "Paint (Right)",
  "Mid-Range (Left)", "Mid-Range (Left Center)", "Mid-Range (Center)", "Mid-Range (Right Center)", "Mid-Range (Right)",
  "Corner 3 (Left)", "Corner 3 (Right)",
  "Above Break 3 (Left)", "Above Break 3 (Left Center)", "Above Break 3 (Center)", "Above Break 3 (Right Center)", "Above Break 3 (Right)",
];

export default function ShotHeatmap({ shots, leagueAvg = 46 }: Props) {
  const { t } = useLocale();

  const { zoneStats, overallPct } = useMemo(() => {
    const fieldGoals = shots.filter((s) => s.actionType !== "freethrow");
    const stats = aggregateZoneStats(fieldGoals);
    const made = fieldGoals.filter((s) => s.shotResult === "Made").length;
    const total = fieldGoals.length;
    return {
      zoneStats: stats,
      overallPct: total > 0 ? (made / total) * 100 : 0,
    };
  }, [shots]);

  const statsMap = useMemo(() => {
    const m = new Map<ShotZone, ZoneStats>();
    for (const s of zoneStats) m.set(s.zone, s);
    return m;
  }, [zoneStats]);

  if (shots.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t.shotChartComp.all} {t.shotChartComp.fg}: {overallPct.toFixed(1)}%
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-text-secondary">
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
      </div>

      <div className="bg-bg-card rounded-xl border border-border p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Court background */}
          <rect x="0" y="0" width={W} height={H} fill="#1a1a1a" rx="8" />

          {/* Zone fills */}
          {ALL_ZONES.map((zone) => {
            const stat = statsMap.get(zone);
            const color = stat ? getZoneColor(stat.pct, leagueAvg) : "#222";
            const opacity = stat ? 0.7 : 0.15;
            return (
              <path
                key={zone}
                d={getZonePath(zone)}
                fill={color}
                fillOpacity={opacity}
                stroke="#333"
                strokeWidth="1"
              />
            );
          })}

          {/* Basket */}
          <circle cx={BX} cy={BY} r={4} fill="none" stroke="#928CEE" strokeWidth="1.5" />
          <line x1={BX - 12} y1={BY - 4} x2={BX + 12} y2={BY - 4} stroke="#555" strokeWidth="2" />

          {/* Zone labels: pct% and made/total */}
          {ALL_ZONES.map((zone) => {
            const stat = statsMap.get(zone);
            if (!stat) return null;
            const [lx, ly] = getZoneLabelPos(zone);
            return (
              <g key={`label-${zone}`}>
                <text x={lx} y={ly} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
                  {stat.pct.toFixed(1)}%
                </text>
                <text x={lx} y={ly + 14} textAnchor="middle" fill="#aaa" fontSize="10">
                  {stat.made}/{stat.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Zone breakdown table */}
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {zoneStats
          .sort((a, b) => b.total - a.total)
          .map((z) => (
            <div key={z.zone} className="bg-bg-secondary rounded-lg p-2 text-center">
              <p className="text-[9px] text-text-secondary leading-tight truncate" title={z.zone}>
                {z.zone.replace("Above Break 3", "AB3").replace("Mid-Range", "Mid").replace("Corner 3", "C3")}
              </p>
              <p className="text-sm font-bold mt-0.5">
                <span style={{ color: getZoneColor(z.pct, leagueAvg) }}>{z.pct.toFixed(1)}%</span>
              </p>
              <p className="text-[10px] text-text-secondary">{z.made}/{z.total}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
