"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GameLogRow {
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  PLUS_MINUS: number;
}

export default function PlayerGameLog({ playerId }: { playerId: number }) {
  const [games, setGames] = useState<GameLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "playergamelog",
          PlayerID: String(playerId),
          Season: "2025-26",
          SeasonType: "Regular Season",
        });
        const res = await fetch(`/api/stats?${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        const rs = data.resultSets?.[0];
        if (!rs) return;
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.slice(0, 10).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as GameLogRow[];
        if (!cancelled) setGames(parsed);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 bg-bg-card rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (games.length === 0) return null;

  const wins = games.filter((g) => g.WL === "W").length;
  const losses = games.length - wins;
  const avgPts = games.reduce((s, g) => s + (g.PTS || 0), 0) / games.length;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Games (2025-26)</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-success font-bold">{wins}W</span>
          <span className="text-danger font-bold">{losses}L</span>
          <span className="text-accent font-bold">{avgPts.toFixed(1)} PPG</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left py-2.5 px-3 sticky left-0 bg-bg-card">Date</th>
              <th className="text-left py-2.5 px-2">Matchup</th>
              <th className="text-center py-2.5 px-2">W/L</th>
              <th className="text-center py-2.5 px-2">MIN</th>
              <th className="text-center py-2.5 px-2 text-accent font-bold">PTS</th>
              <th className="text-center py-2.5 px-2">REB</th>
              <th className="text-center py-2.5 px-2">AST</th>
              <th className="text-center py-2.5 px-2">+/-</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.GAME_ID} className="border-b border-border/30 hover:bg-bg-hover/50">
                <td className="py-2 px-3 text-text-secondary sticky left-0 bg-bg-card whitespace-nowrap">
                  {g.GAME_DATE ? new Date(g.GAME_DATE).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                </td>
                <td className="py-2 px-2">
                  <Link href={`/game/${g.GAME_ID}`} className="text-text-primary hover:text-accent transition-colors whitespace-nowrap">
                    {g.MATCHUP}
                  </Link>
                </td>
                <td className={`text-center py-2 px-2 font-bold ${g.WL === "W" ? "text-success" : "text-danger"}`}>
                  {g.WL}
                </td>
                <td className="text-center py-2 px-2 text-text-secondary">{g.MIN}</td>
                <td className="text-center py-2 px-2 font-bold text-accent">{g.PTS}</td>
                <td className="text-center py-2 px-2">{g.REB}</td>
                <td className="text-center py-2 px-2">{g.AST}</td>
                <td className={`text-center py-2 px-2 ${g.PLUS_MINUS > 0 ? "text-success" : g.PLUS_MINUS < 0 ? "text-danger" : "text-text-secondary"}`}>
                  {g.PLUS_MINUS > 0 ? "+" : ""}{g.PLUS_MINUS}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
