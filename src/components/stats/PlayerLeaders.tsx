"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { AlertCircle } from "lucide-react";

import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import { playerHeadshotUrl as buildHeadshotUrl } from "@/lib/teamUrls";
const STATS_API = "/api/stats";

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
  return buildHeadshotUrl(id);
}

export default function PlayerLeaders() {
  const { t } = useLocale();
  const [cat, setCat] = useState("PTS");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seasonType, setSeasonType] = useState("Regular Season");

  const load = useCallback(async (signal?: AbortSignal) => {
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
      const res = await fetch(`${STATS_API}?${qs}`, { signal });
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
      if (signal?.aborted) return;
      setError(String(e));
      setRows([]);
    }
    setLoading(false);
  }, [cat, seasonType]);

  // load() internally calls setLoading(true) → intentional dep-change refetch.
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // topVal & label only depend on rows[0] + cat → compute once per render, not per row.
  const topVal = rows.length > 0 ? (rows[0][cat as keyof LeaderRow] as number) : 1;
  const isPctCat = cat.includes("PCT");
  const fmtVal = (r: LeaderRow) => {
    const v = r[cat as keyof LeaderRow] as number;
    return isPctCat ? (v * 100).toFixed(1) + "%" : v.toFixed(1);
  };

  return (
    <div>
      {/* Filter chips — glass tile pill bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="glass-tile flex flex-wrap overflow-hidden p-1">
          {PLAYER_CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${cat === c.key ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <select value={seasonType} onChange={(e) => setSeasonType(e.target.value)}
          className="glass-tile px-3 py-1.5 text-xs text-text-primary cursor-pointer">
          <option value="Regular Season">{t.statsPage.regularSeason}</option>
          <option value="Playoffs">{t.statsPage.playoffs}</option>
        </select>
      </div>

      {loading ? (
        // 25 rows ≈ the rendered table height; without this the footer below
        // gets shoved down ~1500px when the data lands and CLS spikes.
        <div className="space-y-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="glass-tile h-12 skeleton-shimmer" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title={t.statsPage.failedToLoad}
          description={String(error)}
          action={{ label: t.common.retry, onClick: () => load() }}
        />
      ) : (
        <div className="glass-tile overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm stats-table">
              <thead className="sticky top-0 z-10 bg-bg-card/95 backdrop-blur-md">
                <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
                  <th className="text-left py-3 px-3 w-12">Rank</th>
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Team</th>
                  <th className="text-center py-3 px-2">GP</th>
                  <th className="text-center py-3 px-2 font-bold text-accent-amber">{PLAYER_CATS.find((c) => c.key === cat)?.label}</th>
                  <th className="text-center py-3 px-2">PTS</th>
                  <th className="text-center py-3 px-2">REB</th>
                  <th className="text-center py-3 px-2">AST</th>
                  <th className="text-center py-3 px-2">STL</th>
                  <th className="text-center py-3 px-2">BLK</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => {
                  const curVal = r[cat as keyof LeaderRow] as number;
                  const barPct = topVal > 0 ? (curVal / topVal) * 100 : 0;
                  const isTop3 = i < 3;
                  const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                    : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                    : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                    : "";
                  const barColor = i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60";
                  return (
                  <tr key={r.PLAYER_ID} className={`border-b border-border/40 hover:bg-bg-hover/50 transition-colors ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}>
                    <td className="py-2.5 px-3">
                      {isTop3 ? (
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold font-mono tabular-nums ${medalBg}`}>
                          {r.RANK}
                        </span>
                      ) : (
                        <span className="text-text-secondary font-mono tabular-nums text-xs ml-1">{r.RANK}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-secondary shrink-0 ring-1 ring-border">
                          <Image src={headshotUrl(r.PLAYER_ID)} alt={r.PLAYER} width={32} height={32}
                            unoptimized
                            className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <span className="font-medium text-text-primary whitespace-nowrap">{r.PLAYER}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-text-secondary font-mono tabular-nums text-xs">{r.TEAM}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.GP}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold font-mono tabular-nums min-w-[48px] text-center ${isTop3 ? "text-text-primary" : "text-accent"}`}>{fmtVal(r)}</span>
                        <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[80px]">
                          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.PTS.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.REB.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.AST.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.STL.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-center text-text-secondary font-mono tabular-nums">{r.BLK.toFixed(1)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
