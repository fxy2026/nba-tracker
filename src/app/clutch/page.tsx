"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Target, Loader2 } from "lucide-react";

interface ClutchPlayer {
  PLAYER_ID: number;
  PLAYER_NAME: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  PTS: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
}

export default function ClutchPage() {
  const [players, setPlayers] = useState<ClutchPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          endpoint: "leaguedashplayerclutch",
          LeagueID: "00",
          Season: "2024-25",
          SeasonType: "Playoffs",
          ClutchTime: "Last 5 Minutes",
          AheadBehind: "Behind or Tied",
          PointDiff: "5",
          PerMode: "PerGame",
        });
        const res = await fetch(`/api/stats?${params}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const rs = data.resultSets?.[0];
        if (!rs) throw new Error("No data");
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as ClutchPlayer[];

        // Sort by PTS descending, take top 20
        parsed.sort((a, b) => b.PTS - a.PTS);
        if (!cancelled) setPlayers(parsed.slice(0, 20));
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Target size={24} className="text-accent" />
        <div>
          <h1 className="text-2xl font-bold">Clutch Leaders</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Last 5 minutes, within 5 points (Playoffs 2024-25)
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-text-secondary">Failed to load clutch data. The data may not be available yet.</p>
        </div>
      )}

      {!loading && !error && players.length === 0 && (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-text-secondary">No clutch data available for this season yet.</p>
        </div>
      )}

      {!loading && players.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-center py-3 px-2 w-10">#</th>
                  <th className="text-left py-3 px-3">Player</th>
                  <th className="text-center py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">GP</th>
                  <th className="text-center py-3 px-2 text-accent font-bold">PTS</th>
                  <th className="text-center py-3 px-2">FG%</th>
                  <th className="text-center py-3 px-2">3P%</th>
                  <th className="text-center py-3 px-2">FT%</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.PLAYER_ID} className="border-b border-border/30 hover:bg-bg-hover/50 transition-colors">
                    <td className="text-center py-2.5 px-2 text-text-secondary text-xs">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/player/${p.PLAYER_ID}`}
                        className="font-medium text-text-primary hover:text-accent transition-colors"
                      >
                        {p.PLAYER_NAME}
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <Link href={`/team/${p.TEAM_ABBREVIATION}`} className="text-text-secondary hover:text-accent transition-colors">
                        {p.TEAM_ABBREVIATION}
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">{p.GP}</td>
                    <td className="text-center py-2.5 px-2 font-bold text-accent">{p.PTS?.toFixed(1)}</td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">
                      {p.FG_PCT != null ? (p.FG_PCT * 100).toFixed(1) + "%" : "-"}
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">
                      {p.FG3_PCT != null ? (p.FG3_PCT * 100).toFixed(1) + "%" : "-"}
                    </td>
                    <td className="text-center py-2.5 px-2 text-text-secondary">
                      {p.FT_PCT != null ? (p.FT_PCT * 100).toFixed(1) + "%" : "-"}
                    </td>
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
