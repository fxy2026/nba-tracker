"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";

interface LeaderRow {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  EFF: number;
}

function mvpScore(p: LeaderRow): number {
  // Custom MVP formula: PTS*1.0 + REB*0.7 + AST*1.0 + STL*1.5 + BLK*1.2 + EFF*0.3 + GP*0.1
  return p.PTS * 1.0 + p.REB * 0.7 + p.AST * 1.0 + p.STL * 1.5 + p.BLK * 1.2 + p.EFF * 0.3 + p.GP * 0.1;
}

export default function MvpLadder() {
  const { t } = useLocale();
  const [players, setPlayers] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: CURRENT_SEASON,
          SeasonType: "Regular Season",
          StatCategory: "EFF",
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const rs = data.resultSet;
        if (!rs) throw new Error("No data");
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.slice(0, 50).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as LeaderRow[];
        if (!controller.signal.aborted) setPlayers(parsed);
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, []);

  const ranked = useMemo(() => {
    const scored: (LeaderRow & { _score: number })[] = [];
    for (const p of players) {
      if (p.GP < 40) continue;
      scored.push({ ...p, _score: mvpScore(p) });
    }
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 15);
  }, [players]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  if (ranked.length === 0) return <p className="text-center text-text-secondary py-12">No data available</p>;

  const topScore = ranked[0]._score;

  return (
    <div>
      <p className="text-xs text-text-secondary mb-4">
        {t.statsPage.mvpRankingNote}
        <span className="text-text-secondary/60 ml-1">{t.statsPage.minGpRequired}</span>
      </p>
      <div className="space-y-2">
        {ranked.map((p, i) => {
          const score = p._score;
          const barPct = (score / topScore) * 100;
          return (
            <Link
              key={p.PLAYER_ID}
              href={`/player/${p.PLAYER_ID}`}
              className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors group"
            >
              <span className={`text-lg font-bold w-8 text-center shrink-0 ${
                i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-text-secondary"
              }`}>
                {i + 1}
              </span>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-secondary shrink-0">
                <Image
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${p.PLAYER_ID}.png`}
                  alt={p.PLAYER}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover object-top"
                  unoptimized
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.PLAYER}</span>
                  <span className="text-[10px] text-text-secondary">{p.TEAM}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[200px]">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="text-[10px] text-accent font-bold font-mono tabular-nums">{score.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-secondary shrink-0">
                <span><span className="font-bold text-text-primary">{p.PTS.toFixed(1)}</span> PPG</span>
                <span>{p.REB.toFixed(1)} RPG</span>
                <span>{p.AST.toFixed(1)} APG</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
