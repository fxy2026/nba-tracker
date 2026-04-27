"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Flame } from "lucide-react";

interface LeaderRow {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  PTS: number;
}

export default function HotStreaks() {
  const [players, setPlayers] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      "/api/stats?endpoint=leagueleaders&LeagueID=00&PerMode=PerGame&Scope=S&Season=2024-25&SeasonType=Playoffs&StatCategory=PTS"
    )
      .then((r) => r.json())
      .then((data) => {
        const headers: string[] = data.resultSet?.headers || [];
        const rows: (string | number)[][] = data.resultSet?.rowSet || [];
        const playerIdx = headers.indexOf("PLAYER");
        const teamIdx = headers.indexOf("TEAM");
        const ptsIdx = headers.indexOf("PTS");
        const idIdx = headers.indexOf("PLAYER_ID");

        const mapped = rows.slice(0, 5).map((row) => ({
          PLAYER_ID: Number(row[idIdx]),
          PLAYER: String(row[playerIdx]),
          TEAM: String(row[teamIdx]),
          PTS: Number(row[ptsIdx]),
        }));
        setPlayers(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-5 w-40 bg-bg-card rounded mb-3 animate-pulse" />
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 w-48 bg-bg-card rounded-xl animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (players.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
        <Flame size={14} className="text-accent" />
        Playoff Hot Streaks
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {players.map((p) => (
          <div
            key={p.PLAYER_ID}
            className="flex items-center gap-2.5 px-3 py-2.5 bg-bg-card border border-border rounded-xl flex-shrink-0 hover:border-accent/40 transition-colors"
          >
            <Image
              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.PLAYER_ID}.png`}
              alt={p.PLAYER}
              width={32}
              height={32}
              className="rounded-full object-cover w-8 h-8"
              unoptimized
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary leading-tight">{p.PLAYER}</span>
              <span className="text-xs text-text-secondary">{p.TEAM}</span>
            </div>
            <span className="text-sm font-bold text-accent ml-2">{p.PTS.toFixed(1)}</span>
            <Flame size={12} className="text-orange-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
