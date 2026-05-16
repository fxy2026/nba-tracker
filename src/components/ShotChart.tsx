"use client";

import { useState, useMemo, memo } from "react";
import type { ShotAction } from "@/lib/api";
import {
  BASKET_PCT_X,
  FT_LINE_PCT_X,
  PAINT_WIDTH_PCT,
  CORNER_3_PCT_Y,
  CORNER_3_EXT_PCT_X,
  THREE_PT_ARC_PCT,
  FT_CIRCLE_FT,
  RESTRICTED_AREA_FT,
  COURT_WIDTH_FT,
} from "@/lib/court";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  shots: ShotAction[];
  homeTricode: string;
  awayTricode: string;
  players: { personId: number; nameI: string; teamTricode: string }[];
}

export default memo(function ShotChart({ shots, homeTricode, awayTricode, players }: Props) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<"all" | "home" | "away">("all");
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  const { filtered, made, total, pct, twosMade, twosTotal, threesMade, threesTotal } = useMemo(() => {
    const f: ShotAction[] = [];
    let m = 0, twosM = 0, twosT = 0, threesM = 0, threesT = 0;
    for (const s of shots) {
      if (s.actionType === "freethrow") continue;
      if (filter === "home" && s.teamTricode !== homeTricode) continue;
      if (filter === "away" && s.teamTricode !== awayTricode) continue;
      if (selectedPlayer && s.personId !== selectedPlayer) continue;
      f.push(s);
      const isMade = s.shotResult === "Made";
      const is3 = s.shotDistance > 22 || !!s.subType?.toLowerCase().includes("3pt");
      if (isMade) m++;
      if (is3) { threesT++; if (isMade) threesM++; }
      else { twosT++; if (isMade) twosM++; }
    }
    const t = f.length;
    return {
      filtered: f, made: m, total: t,
      pct: t > 0 ? ((m / t) * 100).toFixed(1) : "0",
      twosMade: twosM, twosTotal: twosT, threesMade: threesM, threesTotal: threesT,
    };
  }, [shots, filter, selectedPlayer, homeTricode, awayTricode]);

  // Get unique players for filter
  const teamPlayers = useMemo(() => players.filter((p) => {
    if (filter === "home") return p.teamTricode === homeTricode;
    if (filter === "away") return p.teamTricode === awayTricode;
    return true;
  }), [players, filter, homeTricode, awayTricode]);

  // Vertical full-court layout matching API coordinate system
  // API: x = court length 0-100 (maps to 94ft), y = court width 0-100 (maps to 50ft)
  // Baskets at (x≈5.59, y=50) and (x≈94.41, y=50)
  // SVG: x→horizontal (y data), y→vertical (x data)
  const courtWidth = 370;
  const courtHeight = 700;

  const pad = 20;
  const cw = courtWidth - pad * 2;  // 330 usable width
  const ch = courtHeight - pad * 2; // 660 usable height
  const svgCx = pad + cw / 2;       // court center x in SVG
  const svgMidY = pad + ch / 2;     // court center y in SVG

  // Helper: convert API percentage coords to SVG coords
  // courtPctX (0-100) along 94ft length -> SVG Y axis
  // courtPctY (0-100) along 50ft width  -> SVG X axis
  const toSvgX = (pctY: number) => pad + (pctY / 100) * cw;
  const toSvgY = (pctX: number) => pad + (pctX / 100) * ch;

  // Key positions in API percentage coordinates (sourced from lib/court)
  const basketPctX = BASKET_PCT_X;
  const ftLinePctX = FT_LINE_PCT_X;
  const paintWidthPct = PAINT_WIDTH_PCT;
  const ftCircleR = (FT_CIRCLE_FT / COURT_WIDTH_FT) * cw;
  const restrictedR = (RESTRICTED_AREA_FT / COURT_WIDTH_FT) * cw;
  const centerCircleR = (FT_CIRCLE_FT / COURT_WIDTH_FT) * cw;
  const rimR = 5;

  const corner3PctY = CORNER_3_PCT_Y;
  const corner3ExtPctX = CORNER_3_EXT_PCT_X;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["all", "home", "away"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSelectedPlayer(null); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              {f === "all" ? t.shotChartComp.all : f === "home" ? homeTricode : awayTricode}
            </button>
          ))}
        </div>

        {filter !== "all" && (
          <select
            value={selectedPlayer || ""}
            onChange={(e) => setSelectedPlayer(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="">{t.shotChartComp.allPlayers}</option>
            {teamPlayers.map((p) => (
              <option key={p.personId} value={p.personId}>{p.nameI}</option>
            ))}
          </select>
        )}

        <span className="text-xs text-text-secondary ml-auto flex items-center gap-2">
          <span>{made}/{total} {t.shotChartComp.fg} ({pct}%)</span>
          {total > 0 && (
            <>
              <span className="text-accent">{t.shotChartComp.twoPoint} {twosMade}/{twosTotal}</span>
              <span className="text-success">{t.shotChartComp.threePoint} {threesMade}/{threesTotal}</span>
            </>
          )}
        </span>
      </div>

      {/* Court SVG - vertical full court */}
      <div className="glass-tile p-2 overflow-hidden">
        <svg viewBox={`0 0 ${courtWidth} ${courtHeight}`} className="w-full" style={{ maxHeight: 600 }}>
          {/* Court background */}
          <rect x="0" y="0" width={courtWidth} height={courtHeight} fill="#1a1a1a" rx="8" />

          {/* Court outline */}
          <rect x={pad} y={pad} width={cw} height={ch} fill="none" stroke="#333" strokeWidth="1.5" />
          {/* Half court line */}
          <line x1={pad} y1={svgMidY} x2={pad + cw} y2={svgMidY} stroke="#333" strokeWidth="1.5" />
          {/* Center circle */}
          <circle cx={svgCx} cy={svgMidY} r={centerCircleR} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />

          {/* === Top half (basket near top) === */}
          {(() => {
            const basketY = toSvgY(basketPctX);
            const ftLineY = toSvgY(ftLinePctX);
            const paintHalfW = (paintWidthPct / 100) * cw / 2;
            const corner3X1 = toSvgX(corner3PctY);
            const corner3X2 = toSvgX(100 - corner3PctY);
            const corner3Y = toSvgY(corner3ExtPctX);
            const arcPeakY = toSvgY(basketPctX + THREE_PT_ARC_PCT);
            return (
              <>
                <rect x={svgCx - paintHalfW} y={pad} width={paintHalfW * 2} height={ftLineY - pad} fill="none" stroke="#333" strokeWidth="1.5" />
                <circle cx={svgCx} cy={ftLineY} r={ftCircleR} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />
                <circle cx={svgCx} cy={basketY} r={rimR} fill="none" stroke="#928CEE" strokeWidth="1.5" />
                <line x1={svgCx - 15} y1={basketY - 5} x2={svgCx + 15} y2={basketY - 5} stroke="#555" strokeWidth="2" />
                <circle cx={svgCx} cy={basketY} r={restrictedR} fill="none" stroke="#333" strokeWidth="1" />
                <path d={`M ${corner3X1} ${pad} L ${corner3X1} ${corner3Y} Q ${corner3X1} ${arcPeakY} ${svgCx} ${arcPeakY} Q ${corner3X2} ${arcPeakY} ${corner3X2} ${corner3Y} L ${corner3X2} ${pad}`} fill="none" stroke="#444" strokeWidth="1.5" />
              </>
            );
          })()}

          {/* === Bottom half (basket near bottom) === */}
          {(() => {
            const basketY = toSvgY(100 - basketPctX);
            const ftLineY = toSvgY(100 - ftLinePctX);
            const paintHalfW = (paintWidthPct / 100) * cw / 2;
            const corner3X1 = toSvgX(corner3PctY);
            const corner3X2 = toSvgX(100 - corner3PctY);
            const corner3Y = toSvgY(100 - corner3ExtPctX);
            const arcPeakY = toSvgY(100 - basketPctX - THREE_PT_ARC_PCT);
            return (
              <>
                <rect x={svgCx - paintHalfW} y={ftLineY} width={paintHalfW * 2} height={pad + ch - ftLineY} fill="none" stroke="#333" strokeWidth="1.5" />
                <circle cx={svgCx} cy={ftLineY} r={ftCircleR} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />
                <circle cx={svgCx} cy={basketY} r={rimR} fill="none" stroke="#928CEE" strokeWidth="1.5" />
                <line x1={svgCx - 15} y1={basketY + 5} x2={svgCx + 15} y2={basketY + 5} stroke="#555" strokeWidth="2" />
                <circle cx={svgCx} cy={basketY} r={restrictedR} fill="none" stroke="#333" strokeWidth="1" />
                <path d={`M ${corner3X1} ${pad + ch} L ${corner3X1} ${corner3Y} Q ${corner3X1} ${arcPeakY} ${svgCx} ${arcPeakY} Q ${corner3X2} ${arcPeakY} ${corner3X2} ${corner3Y} L ${corner3X2} ${pad + ch}`} fill="none" stroke="#444" strokeWidth="1.5" />
              </>
            );
          })()}

          {/* Shot dots */}
          {filtered.map((shot, i) => {
            const svgX = toSvgX(shot.y);
            const svgY = toSvgY(shot.x);

            const isMade = shot.shotResult === "Made";
            const is3pt = shot.actionType === "3pt";

            return (
              <g key={`${shot.personId}-${shot.period}-${i}`}>
                {isMade ? (
                  <circle
                    cx={svgX}
                    cy={svgY}
                    r={is3pt ? 5 : 4}
                    fill={is3pt ? "#928CEE" : "#22c55e"}
                    fillOpacity={0.8}
                  />
                ) : (
                  <g transform={`translate(${svgX}, ${svgY})`}>
                    <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ef4444" strokeWidth="1.5" strokeOpacity={0.6} />
                    <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ef4444" strokeWidth="1.5" strokeOpacity={0.6} />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 pb-1">
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#22c55e" /></svg>
            {t.shotChartComp.twoPtMade}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#928CEE" /></svg>
            {t.shotChartComp.threePtMade}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <svg width="12" height="12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="#ef4444" strokeWidth="1.5" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="#ef4444" strokeWidth="1.5" />
            </svg>
            {t.shotChartComp.missed}
          </span>
        </div>
      </div>

      {/* Shot Zone Breakdown */}
      {filtered.length > 0 && (() => {
        const buckets = [
          { name: t.shotChartComp.restrictedArea, made: 0, total: 0 },
          { name: t.shotChartComp.paintNonRa, made: 0, total: 0 },
          { name: t.shotChartComp.midRange, made: 0, total: 0 },
          { name: "3-Point", made: 0, total: 0 },
        ];
        for (const s of filtered) {
          const is3 = s.shotDistance > 22 || !!s.subType?.toLowerCase().includes("3pt");
          let idx: number;
          if (is3) idx = 3;
          else if (s.shotDistance <= 4) idx = 0;
          else if (s.shotDistance <= 14) idx = 1;
          else idx = 2;
          buckets[idx].total++;
          if (s.shotResult === "Made") buckets[idx].made++;
        }
        const zoneStats = buckets
          .filter((z) => z.total > 0)
          .map((z) => ({ ...z, pct: (z.made / z.total) * 100 }));
        if (zoneStats.length === 0) return null;
        return (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {zoneStats.map((z) => (
              <div key={z.name} className="bg-bg-secondary rounded-lg p-2 text-center">
                <p className="text-[10px] text-text-secondary uppercase">{z.name}</p>
                <p className="text-sm font-bold mt-0.5">
                  <span className={z.pct >= 50 ? "text-success" : z.pct >= 35 ? "text-accent" : "text-danger"}>{z.pct.toFixed(1)}%</span>
                </p>
                <p className="text-[10px] text-text-secondary">{z.made}/{z.total}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
});
