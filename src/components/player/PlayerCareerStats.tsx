"use client";

import { useEffect, useState } from "react";

interface SeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  GS: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  TOV: number;
}

export default function PlayerCareerStats({ playerId }: { playerId: number }) {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "playercareerstats",
          PlayerID: String(playerId),
          PerMode: "PerGame",
        });
        const res = await fetch(`/api/stats?${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
        if (!rs) return;
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as SeasonRow[];
        if (!cancelled) setSeasons(parsed);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-bg-card rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (seasons.length === 0) return null;

  // Career highs
  const maxPTS = Math.max(...seasons.map((s) => s.PTS || 0));
  const maxREB = Math.max(...seasons.map((s) => s.REB || 0));
  const maxAST = Math.max(...seasons.map((s) => s.AST || 0));

  // Career averages
  const totalGP = seasons.reduce((s, r) => s + (r.GP || 0), 0);
  const avgPTS = totalGP > 0 ? seasons.reduce((s, r) => s + (r.PTS || 0) * (r.GP || 0), 0) / totalGP : 0;
  const avgREB = totalGP > 0 ? seasons.reduce((s, r) => s + (r.REB || 0) * (r.GP || 0), 0) / totalGP : 0;
  const avgAST = totalGP > 0 ? seasons.reduce((s, r) => s + (r.AST || 0) * (r.GP || 0), 0) / totalGP : 0;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Season-by-Season Stats</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-text-secondary">{seasons.length} seasons</span>
          <span className="text-text-secondary">{totalGP} GP</span>
          <span className="text-accent font-bold">{avgPTS.toFixed(1)} PPG</span>
          <span className="text-text-secondary">{avgREB.toFixed(1)} RPG</span>
          <span className="text-text-secondary">{avgAST.toFixed(1)} APG</span>
        </div>
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
                <td className={`text-center py-2 px-2 font-bold ${s.PTS === maxPTS && seasons.length > 1 ? "text-yellow-400" : "text-accent"}`}>
                  {s.PTS?.toFixed(1)}{s.PTS === maxPTS && seasons.length > 1 && <span className="text-[8px] ml-0.5">&#9733;</span>}
                </td>
                <td className={`text-center py-2 px-2 ${s.REB === maxREB && seasons.length > 1 ? "text-yellow-400 font-medium" : ""}`}>
                  {s.REB?.toFixed(1)}
                </td>
                <td className={`text-center py-2 px-2 ${s.AST === maxAST && seasons.length > 1 ? "text-yellow-400 font-medium" : ""}`}>
                  {s.AST?.toFixed(1)}
                </td>
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
  );
}
