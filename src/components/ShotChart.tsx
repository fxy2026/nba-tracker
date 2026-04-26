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

  // Court dimensions: NBA court is 94x50 feet
  // The API returns x/y as percentages (0-100)
  // x is horizontal (baseline to baseline), y is vertical (sideline to sideline)
  const courtWidth = 470;
  const courtHeight = 450;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["all", "away", "home"] as const).map((f) => (
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

      {/* Court SVG */}
      <div className="bg-bg-card rounded-xl border border-border p-2 overflow-hidden">
        <svg viewBox={`0 0 ${courtWidth} ${courtHeight}`} className="w-full" style={{ maxHeight: 480 }}>
          {/* Court background */}
          <rect x="0" y="0" width={courtWidth} height={courtHeight} fill="#1a1a1a" rx="8" />

          {/* Half court (we show one half) */}
          {/* Baseline */}
          <line x1="30" y1="420" x2="440" y2="420" stroke="#333" strokeWidth="1.5" />
          {/* Sidelines */}
          <line x1="30" y1="20" x2="30" y2="420" stroke="#333" strokeWidth="1.5" />
          <line x1="440" y1="20" x2="440" y2="420" stroke="#333" strokeWidth="1.5" />
          {/* Half court line */}
          <line x1="30" y1="20" x2="440" y2="20" stroke="#333" strokeWidth="1" />

          {/* Paint / key */}
          <rect x="155" y="340" width="160" height="80" fill="none" stroke="#333" strokeWidth="1.5" />

          {/* Free throw circle */}
          <circle cx="235" cy="340" r="55" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />

          {/* Basket */}
          <circle cx="235" cy="405" r="7" fill="none" stroke="#928CEE" strokeWidth="1.5" />
          {/* Backboard */}
          <line x1="213" y1="413" x2="257" y2="413" stroke="#555" strokeWidth="2" />

          {/* Restricted area */}
          <path d="M 210 420 A 25 25 0 0 1 260 420" fill="none" stroke="#333" strokeWidth="1" />

          {/* 3-point line */}
          <path d="M 60 420 L 60 310 Q 60 140 235 140 Q 410 140 410 310 L 410 420" fill="none" stroke="#444" strokeWidth="1.5" />

          {/* Shot dots */}
          {filtered.map((shot, i) => {
            // Convert API coordinates to court SVG coordinates
            // API: x is 0-100 (left to right), y is 0-100 (top to bottom)
            // We want: shots mapped to half court from basket perspective
            const svgX = 30 + (shot.x / 100) * 410;
            const svgY = 420 - (shot.y / 100) * 400;

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
