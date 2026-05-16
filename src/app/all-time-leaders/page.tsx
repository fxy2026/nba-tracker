"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

interface PlayerInfo {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  teamCity: string;
  teamName: string;
  fromYear: string;
  toYear: string;
  position: string;
  pts: number;
  reb: number;
  ast: number;
}

type Category = "pts" | "reb" | "ast" | "tenure";

const CATEGORIES: { key: Category; label: string; description: string; fmt: (v: number) => string }[] = [
  { key: "pts", label: "Career PPG", description: "Highest scoring average across career", fmt: (v) => v.toFixed(1) },
  { key: "reb", label: "Career RPG", description: "Best rebounding averages all time", fmt: (v) => v.toFixed(1) },
  { key: "ast", label: "Career APG", description: "Most assists per game in NBA history", fmt: (v) => v.toFixed(1) },
  { key: "tenure", label: "Longest Careers", description: "Most seasons played", fmt: (v) => `${v} years` },
];

export default function AllTimeLeadersPage() {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("pts");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/player-index", { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          if (!controller.signal.aborted) setPlayers(json.data || []);
        }
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, []);

  const ranked = useMemo(() => {
    if (players.length === 0) return [];
    const scored = players
      .filter((p) => {
        if (!p.fromYear || !p.toYear) return false;
        if (category === "tenure") return true;
        return p[category] > 0;
      })
      .map((p) => {
        const seasons = Math.max(1, parseInt(p.toYear) - parseInt(p.fromYear) + 1);
        const value = category === "tenure" ? seasons : p[category];
        return { ...p, _value: value, _seasons: seasons };
      });
    scored.sort((a, b) => b._value - a._value);
    return scored.slice(0, 25);
  }, [players, category]);

  const topValue = ranked[0]?._value || 1;
  const activeCat = CATEGORIES.find((c) => c.key === category)!;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="History"
        icon={Crown}
        title="All-Time Leaders"
        subtitle="Career averages across all NBA players in the index · adjusted by category"
      />

      {/* Category selector */}
      <div className="glass-tile flex flex-wrap overflow-hidden p-1 mb-6 w-fit">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              category === c.key
                ? "bg-accent text-white shadow-md"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Category header */}
      <div className="glass-tile p-4 mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-accent-amber/15 flex items-center justify-center">
          <Crown size={20} className="text-accent-amber" />
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {activeCat.label}</p>
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">{activeCat.label} Leaders</h2>
          <p className="text-xs text-text-secondary mt-0.5">{activeCat.description}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass-tile h-16 skeleton-shimmer" />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={Crown}
          title="No data available"
          description="Could not load player career data."
        />
      ) : (
        <div className="space-y-2">
          {ranked.map((p, i) => {
            const isTop3 = i < 3;
            const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
              : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
              : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
              : "bg-bg-hover text-text-secondary";
            const pct = topValue > 0 ? (p._value / topValue) * 100 : 0;
            const barColor = i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60";

            return (
              <Link
                key={p.personId}
                href={`/player/${p.personId}`}
                className={`glass-tile flex items-center gap-3 p-3 group cursor-pointer ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}
              >
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                  {i + 1}
                </span>
                <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                    {p.teamAbbr || "—"} · {p.fromYear}-{p.toYear} · <span className="tabular-nums">{p._seasons}</span> yrs
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end shrink-0 min-w-[140px]">
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-base font-light font-mono tabular-nums ${isTop3 ? "text-text-primary" : "text-accent-amber"} min-w-[50px] text-right`}>
                      {activeCat.fmt(p._value)}
                    </span>
                  </div>
                </div>
                <div className="flex sm:hidden flex-col items-end shrink-0">
                  <span className={`text-base font-light font-mono tabular-nums ${isTop3 ? "text-text-primary" : "text-accent-amber"}`}>
                    {activeCat.fmt(p._value)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ Note</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Career averages from the NBA player index. Includes both active and retired players. PPG/RPG/APG are
          career per-game averages, not totals — to rank by counting stats, see{" "}
          <Link href="/milestones" className="text-accent hover:underline">milestones</Link>.
        </p>
      </div>
    </div>
  );
}
