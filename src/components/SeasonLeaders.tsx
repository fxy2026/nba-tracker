"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LeaderEntry {
  rank: number;
  player: string;
  value: number;
}

interface CategoryData {
  label: string;
  leaders: LeaderEntry[];
}

export default function SeasonLeaders() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = "/api/stats?endpoint=leagueleaders&LeagueID=00&PerMode=PerGame&Scope=S&Season=2024-25&SeasonType=Playoffs";
    const cats = [
      { param: "PTS", label: "Scoring" },
      { param: "REB", label: "Rebounds" },
      { param: "AST", label: "Assists" },
    ];

    Promise.all(
      cats.map((c) =>
        fetch(`${base}&StatCategory=${c.param}`)
          .then((r) => r.json())
          .then((data) => {
            const headers: string[] = data.resultSet?.headers || [];
            const rows: (string | number)[][] = data.resultSet?.rowSet || [];
            const playerIdx = headers.indexOf("PLAYER");
            const statIdx = headers.indexOf(c.param);

            const leaders = rows.slice(0, 5).map((row, i) => ({
              rank: i + 1,
              player: String(row[playerIdx]),
              value: Number(row[statIdx]),
            }));
            return { label: c.label, leaders };
          })
          .catch(() => ({ label: c.label, leaders: [] }))
      )
    )
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-5 w-40 bg-bg-card rounded mb-3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.every((c) => c.leaders.length === 0)) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-text-secondary mb-3">Playoff Leaders</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.label} className="bg-bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-accent mb-3 uppercase tracking-wide">{cat.label}</h3>
            <div className="space-y-2">
              {cat.leaders.map((entry) => (
                <div key={entry.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary w-4 text-right">{entry.rank}</span>
                    <span className="text-sm text-text-primary">{entry.player}</span>
                  </div>
                  <span className="text-sm font-bold text-text-primary">{entry.value.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-right">
        <Link href="/stats" className="text-xs text-accent hover:text-accent-hover transition-colors">
          View all &rarr;
        </Link>
      </div>
    </div>
  );
}
