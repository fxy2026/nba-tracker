"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
}

interface GameLogRow {
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  PLUS_MINUS: number;
}

// Single component that fetches both career stats + game log in ONE API call
export default function PlayerStatsBundle({ playerId }: { playerId: number }) {
  const [seasons, setSeasons] = useState<SeasonRow[] | null>(null);
  const [games, setGames] = useState<GameLogRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/player?id=${playerId}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) {
          setSeasons(data.careerSeasons || []);
          setGames(data.recentGames || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-bg-secondary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recent Games */}
      {games && games.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Games (2024-25)</h3>
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
                    <td className={`text-center py-2 px-2 font-bold ${g.WL === "W" ? "text-success" : "text-danger"}`}>{g.WL}</td>
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
      )}

      {/* Career Stats */}
      {seasons && seasons.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Season-by-Season Stats</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="text-left py-2.5 px-3 sticky left-0 bg-bg-card">Season</th>
                  <th className="text-left py-2.5 px-2">Team</th>
                  <th className="text-center py-2.5 px-2">GP</th>
                  <th className="text-center py-2.5 px-2">MIN</th>
                  <th className="text-center py-2.5 px-2 text-accent font-bold">PTS</th>
                  <th className="text-center py-2.5 px-2">REB</th>
                  <th className="text-center py-2.5 px-2">AST</th>
                  <th className="text-center py-2.5 px-2">STL</th>
                  <th className="text-center py-2.5 px-2">BLK</th>
                  <th className="text-center py-2.5 px-2">FG%</th>
                  <th className="text-center py-2.5 px-2">3P%</th>
                  <th className="text-center py-2.5 px-2">FT%</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s, i) => (
                  <tr key={`${s.SEASON_ID}-${s.TEAM_ABBREVIATION}-${i}`} className="border-b border-border/30 hover:bg-bg-hover/50">
                    <td className="py-2 px-3 font-medium text-text-primary sticky left-0 bg-bg-card">{s.SEASON_ID}</td>
                    <td className="py-2 px-2 text-text-secondary">{s.TEAM_ABBREVIATION}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.GP}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.MIN?.toFixed(1)}</td>
                    <td className="text-center py-2 px-2 font-bold text-accent">{s.PTS?.toFixed(1)}</td>
                    <td className="text-center py-2 px-2">{s.REB?.toFixed(1)}</td>
                    <td className="text-center py-2 px-2">{s.AST?.toFixed(1)}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.STL?.toFixed(1)}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.BLK?.toFixed(1)}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.FG_PCT != null ? (s.FG_PCT * 100).toFixed(1) + "%" : "-"}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.FG3_PCT != null ? (s.FG3_PCT * 100).toFixed(1) + "%" : "-"}</td>
                    <td className="text-center py-2 px-2 text-text-secondary">{s.FT_PCT != null ? (s.FT_PCT * 100).toFixed(1) + "%" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
