"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";

interface LeaderEntry {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  PTS: number;
  REB: number;
  AST: number;
}

export default function TodayHighlights() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: "2025-26",
          SeasonType: "Playoffs",
          StatCategory: "PTS",
        }).toString();
        const res = await fetch(`/api/stats?${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        const rs = data.resultSet;
        if (!rs) return;
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.slice(0, 5).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as LeaderEntry[];
        if (!cancelled) setLeaders(parsed);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (leaders.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-3">
        <Flame size={14} className="text-accent" />
        Scoring Leaders
        <TrendingUp size={12} className="text-text-secondary" />
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {leaders.map((p, i) => (
          <Link
            key={p.PLAYER_ID}
            href={`/player/${p.PLAYER_ID}`}
            className="flex items-center gap-2.5 bg-bg-card border border-border rounded-xl px-3 py-2.5 shrink-0 hover:border-accent/50 transition-colors"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-secondary">
                <Image
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${p.PLAYER_ID}.png`}
                  alt={p.PLAYER}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              {i < 3 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center">
                  {i + 1}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary whitespace-nowrap">{p.PLAYER}</p>
              <p className="text-[10px] text-text-secondary">{p.TEAM}</p>
            </div>
            <div className="text-right ml-2">
              <p className="text-sm font-bold text-accent">{p.PTS.toFixed(1)}</p>
              <p className="text-[10px] text-text-secondary">PPG</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
