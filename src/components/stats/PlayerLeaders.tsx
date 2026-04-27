"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const STATS_API = "/api/stats";
const CURRENT_SEASON = "2024-25";

interface LeaderRow {
  PLAYER_ID: number;
  RANK: number;
  PLAYER: string;
  TEAM: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  EFF: number;
}

const PLAYER_CATS = [
  { key: "PTS", label: "Points" },
  { key: "REB", label: "Rebs" },
  { key: "AST", label: "Assists" },
  { key: "STL", label: "Steals" },
  { key: "BLK", label: "Blocks" },
  { key: "FG_PCT", label: "FG%" },
  { key: "FG3_PCT", label: "3P%" },
  { key: "EFF", label: "Effect" },
  { key: "MIN", label: "Minutes" },
] as const;

function headshotUrl(id: number) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
}

export default function PlayerLeaders() {
  const [cat, setCat] = useState("PTS");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seasonType, setSeasonType] = useState("Regular Season");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        endpoint: "leagueleaders",
        LeagueID: "00",
        PerMode: "PerGame",
        Scope: "S",
        Season: CURRENT_SEASON,
        SeasonType: seasonType,
        StatCategory: cat,
      }).toString();
      const res = await fetch(`${STATS_API}?${qs}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const rs = data.resultSet;
      if (!rs) throw new Error("No data");
      const headers: string[] = rs.headers;
      const parsed = rs.rowSet.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      }) as unknown as LeaderRow[];
      setRows(parsed);
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
    setLoading(false);
  }, [cat, seasonType]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const fmtVal = (r: LeaderRow, key: string) => {
    const v = r[key as keyof LeaderRow] as number;
    if (key.includes("PCT")) return (v * 100).toFixed(1) + "%";
    return v.toFixed(1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap rounded-lg overflow-hidden border border-border">
          {PLAYER_CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${cat === c.key ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <select value={seasonType} onChange={(e) => setSeasonType(e.target.value)}
          className="bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary">
          <option value="Regular Season">Regular Season</option>
          <option value="Playoffs">Playoffs</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-danger py-20 text-sm">Failed to load: {error}</div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm stats-table">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-3 w-8">#</th>
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">GP</th>
                  <th className="text-center py-3 px-2 font-bold text-accent">{PLAYER_CATS.find((c) => c.key === cat)?.label}</th>
                  <th className="text-center py-3 px-2">PTS</th>
                  <th className="text-center py-3 px-2">REB</th>
                  <th className="text-center py-3 px-2">AST</th>
                  <th className="text-center py-3 px-2">STL</th>
                  <th className="text-center py-3 px-2">BLK</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={r.PLAYER_ID} className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${i < 3 ? "bg-accent/5" : ""}`}>
                    <td className="py-2.5 px-3 text-text-secondary font-medium">{r.RANK}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                          <Image src={headshotUrl(r.PLAYER_ID)} alt="" width={32} height={32}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <span className="font-medium text-text-primary whitespace-nowrap">{r.PLAYER}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-text-secondary">{r.TEAM}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.GP}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-accent">{fmtVal(r, cat)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.PTS.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.REB.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.AST.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.STL.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary">{r.BLK.toFixed(1)}</td>
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
