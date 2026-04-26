"use client";

import { useState } from "react";
import type { ShotAction } from "@/lib/api";

interface Props {
  shots: ShotAction[];
  homeTricode: string;
  awayTricode: string;
  players: { personId: number; nameI: string; teamTricode: string }[];
}

export default function ShotChart({ shots, homeTricode, awayTricode, players }: Props) {
  const [filter, setFilter] = useState<"all" | "home" | "away">("all");
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  const filtered = shots.filter((s) => {
    if (filter === "home" && s.teamTricode !== homeTricode) return false;
    if (filter === "away" && s.teamTricode !== awayTricode) return false;
    if (selectedPlayer && s.personId !== selectedPlayer) return false;
    return true;
  });

  const made = filtered.filter((s) => s.shotResult === "Made").length;
  const total = filtered.length;
  const pct = total > 0 ? ((made / total) * 100).toFixed(1) : "0";

  // Get unique players for filter
  const teamPlayers = players.filter((p) => {
    if (filter === "home") return p.teamTricode === homeTricode;
    if (filter === "away") return p.teamTricode === awayTricode;
    return true;
  });

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

  // Key positions in API percentage coordinates
  const basketPctX = 5.59;           // basket center from baseline
  const ftLinePctX = 19.15;          // free throw line = 19ft from baseline / 94 * 100
  const paintWidthPct = 32;          // paint is 16ft wide / 50ft * 100
  const ftCircleR = (6 / 50) * cw;  // 6ft radius in SVG
  const restrictedR = (4 / 50) * cw; // 4ft restricted arc
  const centerCircleR = (6 / 50) * cw;
  const rimR = 5;

  // 3-point line: 23.75ft from basket center, corner 3 at 22ft, corner extends 14ft from baseline
  const corner3PctY = 6.3;          // 3.15ft from sideline / 50 * 100
  const corner3ExtPctX = 14.89;     // 14ft from baseline / 94 * 100

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
              {f === "all" ? "All" : f === "home" ? homeTricode : awayTricode}
            </button>
          ))}
        </div>

        {filter !== "all" && (
          <select
            value={selectedPlayer || ""}
            onChange={(e) => setSelectedPlayer(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="">All Players</option>
            {teamPlayers.map((p) => (
              <option key={p.personId} value={p.personId}>{p.nameI}</option>
            ))}
          </select>
        )}

        <span className="text-xs text-text-secondary ml-auto">
          {made}/{total} FG ({pct}%)
        </span>
      </div>

      {/* Court SVG - vertical full court */}
      <div className="bg-bg-card rounded-xl border border-border p-2 overflow-hidden">
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
            const arcPeakY = toSvgY(basketPctX + 25.26); // 23.75ft/94*100 = 25.26%
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
            const arcPeakY = toSvgY(100 - basketPctX - 25.26);
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
              <g key={i}>
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
            2PT Made
          </span>
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#928CEE" /></svg>
            3PT Made
          </span>
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <svg width="12" height="12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="#ef4444" strokeWidth="1.5" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="#ef4444" strokeWidth="1.5" />
            </svg>
            Missed
          </span>
        </div>
      </div>
    </div>
  );
}
