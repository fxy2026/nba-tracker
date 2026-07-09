"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import { playerHeadshotUrl } from "@/lib/teamUrls";

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
          limit: "50",
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

  if (ranked.length === 0) return (
    <EmptyState
      icon={Trophy}
      title={t.statsPage.noMvpTitle}
      description={t.statsPage.noMvpDesc}
    />
  );

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
          const isTop3 = i < 3;
          const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
            : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
            : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
            : "bg-bg-hover text-text-secondary";
          const barColor = i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60";
          return (
            <Link
              key={p.PLAYER_ID}
              href={`/player/${p.PLAYER_ID}`}
              className={`flex items-center gap-3 glass-tile p-3 hover:border-accent/40 transition-all group cursor-pointer ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}
            >
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                {i + 1}
              </span>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-secondary shrink-0 ring-1 ring-border">
                <Image
                  src={playerHeadshotUrl(p.PLAYER_ID, "260x190")}
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
                  <span className="text-[10px] text-text-secondary font-mono">{p.TEAM}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[200px]">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold font-mono tabular-nums ${isTop3 ? "text-text-primary" : "text-accent"}`}>{score.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-secondary shrink-0 font-mono tabular-nums">
                <span><span className="font-bold text-text-primary">{p.PTS.toFixed(1)}</span> <span className="text-[9px]">PPG</span></span>
                <span>{p.REB.toFixed(1)} <span className="text-[9px]">RPG</span></span>
                <span>{p.AST.toFixed(1)} <span className="text-[9px]">APG</span></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
