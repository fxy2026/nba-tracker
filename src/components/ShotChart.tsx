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
  // API: x = horizontal (0-100, left to right), y = vertical (0-100, top to bottom, full court)
  // Top basket at y≈0, bottom basket at y≈100
  const courtWidth = 370;
  const courtHeight = 700;

  // SVG drawing area with padding
  const pad = 20;
  const cw = courtWidth - pad * 2;  // 330 usable width
  const ch = courtHeight - pad * 2; // 660 usable height
  const cx = pad + cw / 2;          // center x = 185
  const midY = pad + ch / 2;        // center y = 350

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
          <line x1={pad} y1={midY} x2={pad + cw} y2={midY} stroke="#333" strokeWidth="1.5" />
          {/* Center circle */}
          <circle cx={cx} cy={midY} r={40} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />

          {/* === Top half (basket at top) === */}
          {/* Paint */}
          <rect x={cx - 60} y={pad} width={120} height={110} fill="none" stroke="#333" strokeWidth="1.5" />
          {/* Free throw circle */}
          <circle cx={cx} cy={pad + 110} r={40} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />
          {/* Basket */}
          <circle cx={cx} cy={pad + 25} r={7} fill="none" stroke="#928CEE" strokeWidth="1.5" />
          {/* Backboard */}
          <line x1={cx - 20} y1={pad + 17} x2={cx + 20} y2={pad + 17} stroke="#555" strokeWidth="2" />
          {/* Restricted area */}
          <path d={`M ${cx - 20} ${pad} A 22 22 0 0 0 ${cx + 20} ${pad}`} fill="none" stroke="#333" strokeWidth="1" />
          {/* 3-point line */}
          <path d={`M ${pad + 25} ${pad} L ${pad + 25} ${pad + 80} Q ${pad + 25} ${pad + 230} ${cx} ${pad + 230} Q ${pad + cw - 25} ${pad + 230} ${pad + cw - 25} ${pad + 80} L ${pad + cw - 25} ${pad}`} fill="none" stroke="#444" strokeWidth="1.5" />

          {/* === Bottom half (basket at bottom) === */}
          {/* Paint */}
          <rect x={cx - 60} y={pad + ch - 110} width={120} height={110} fill="none" stroke="#333" strokeWidth="1.5" />
          {/* Free throw circle */}
          <circle cx={cx} cy={pad + ch - 110} r={40} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />
          {/* Basket */}
          <circle cx={cx} cy={pad + ch - 25} r={7} fill="none" stroke="#928CEE" strokeWidth="1.5" />
          {/* Backboard */}
          <line x1={cx - 20} y1={pad + ch - 17} x2={cx + 20} y2={pad + ch - 17} stroke="#555" strokeWidth="2" />
          {/* Restricted area */}
          <path d={`M ${cx - 20} ${pad + ch} A 22 22 0 0 1 ${cx + 20} ${pad + ch}`} fill="none" stroke="#333" strokeWidth="1" />
          {/* 3-point line */}
          <path d={`M ${pad + 25} ${pad + ch} L ${pad + 25} ${pad + ch - 80} Q ${pad + 25} ${pad + ch - 230} ${cx} ${pad + ch - 230} Q ${pad + cw - 25} ${pad + ch - 230} ${pad + cw - 25} ${pad + ch - 80} L ${pad + cw - 25} ${pad + ch}`} fill="none" stroke="#444" strokeWidth="1.5" />

          {/* Shot dots */}
          {filtered.map((shot, i) => {
            // Direct mapping: API x,y (0-100) -> SVG coordinates
            const svgX = pad + (shot.x / 100) * cw;
            const svgY = pad + (shot.y / 100) * ch;

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
