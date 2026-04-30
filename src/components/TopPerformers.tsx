"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Target, Users } from "lucide-react";

interface LeaderEntry {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  PTS: number;
  REB: number;
  AST: number;
}

type Category = "PTS" | "REB" | "AST";

const CATEGORIES: { key: Category; label: string; icon: typeof Trophy; statLabel: string }[] = [
  { key: "PTS", label: "Scorers", icon: Trophy, statLabel: "PPG" },
  { key: "REB", label: "Rebounders", icon: Target, statLabel: "RPG" },
  { key: "AST", label: "Assisters", icon: Users, statLabel: "APG" },
];

export default function TopPerformers() {
  const [leaders, setLeaders] = useState<Record<Category, LeaderEntry[]>>({
    PTS: [],
    REB: [],
    AST: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCategory(category: Category): Promise<LeaderEntry[]> {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: "2025-26",
          SeasonType: "Playoffs",
          StatCategory: category,
        }).toString();
        const res = await fetch(`/api/stats?${qs}`);
        if (!res.ok) return [];
        const data = await res.json();
        const rs = data.resultSet;
        if (!rs) return [];
        const headers: string[] = rs.headers;
        return rs.rowSet.slice(0, 3).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as LeaderEntry[];
      } catch {
        return [];
      }
    }

    (async () => {
      const [pts, reb, ast] = await Promise.all([
        fetchCategory("PTS"),
        fetchCategory("REB"),
        fetchCategory("AST"),
      ]);
      if (!cancelled) {
        setLeaders({ PTS: pts, REB: reb, AST: ast });
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-5 w-40 bg-bg-card rounded skeleton-shimmer mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-bg-card rounded-xl border border-border skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = leaders.PTS.length > 0 || leaders.REB.length > 0 || leaders.AST.length > 0;
  if (!hasData) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-3">
        <Trophy size={14} className="text-accent" />
        Top Performers
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CATEGORIES.map(({ key, label, icon: Icon, statLabel }) => {
          const entries = leaders[key];
          if (entries.length === 0) return null;
          return (
            <div key={key} className="bg-bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Icon size={14} className="text-accent" />
                <span className="text-xs font-medium text-text-secondary">{label}</span>
              </div>
              <div className="space-y-2.5">
                {entries.map((p, i) => (
                  <Link
                    key={p.PLAYER_ID}
                    href={`/player/${p.PLAYER_ID}`}
                    className="flex items-center gap-2.5 hover:bg-bg-hover rounded-lg p-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-secondary">
                        <Image
                          src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${p.PLAYER_ID}.png`}
                          alt={p.PLAYER}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover object-top"
                          unoptimized
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      <span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-accent text-[8px] font-bold text-white flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{p.PLAYER}</p>
                      <p className="text-[10px] text-text-secondary">{p.TEAM}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">{p[key].toFixed(1)}</p>
                      <p className="text-[9px] text-text-secondary">{statLabel}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
