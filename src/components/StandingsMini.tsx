"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEAM_META } from "@/lib/teams";
import { useLocale } from "@/components/LocaleProvider";

interface TeamRecord {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  wins: number;
  losses: number;
}

function ConferenceColumn({ title, teams }: { title: string; teams: TeamRecord[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-text-secondary font-semibold mb-1">{title}</p>
      {teams.map((t, i) => {
        const pct = t.wins + t.losses > 0 ? (t.wins / (t.wins + t.losses)) : 0;
        return (
          <div key={t.tricode} className="flex items-center gap-1.5 py-0.5 text-xs">
            <span className={`w-3 text-right font-mono tabular-nums ${i < 3 ? "text-accent-amber font-bold" : "text-text-secondary"}`}>{i + 1}</span>
            <Link href={`/team/${t.tricode}`} className="font-semibold text-text-primary hover:text-accent transition-colors">
              {t.tricode}
            </Link>
            <span className="text-text-secondary ml-auto font-mono tabular-nums">{t.wins}-{t.losses}</span>
            <span className="text-text-secondary/60 font-mono tabular-nums w-8 text-right text-[10px]">{(pct * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StandingsMini() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [east, setEast] = useState<TeamRecord[]>([]);
  const [west, setWest] = useState<TeamRecord[]>([]);
  const [archivedSeason, setArchivedSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/standings", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const teams: TeamRecord[] = json.data || [];
        if (json.archived && json.season) setArchivedSeason(String(json.season));
        const eastBuf: TeamRecord[] = [];
        const westBuf: TeamRecord[] = [];
        for (const t of teams) {
          const conf = TEAM_META[t.tricode]?.conference;
          if (conf === "East" && eastBuf.length < 6) eastBuf.push(t);
          else if (conf === "West" && westBuf.length < 6) westBuf.push(t);
          if (eastBuf.length === 6 && westBuf.length === 6) break;
        }
        setEast(eastBuf);
        setWest(westBuf);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Structural skeleton — must mirror the loaded layout's height (~170px)
  // or the row jumps when data lands. CLS budget on this tile alone was 0.2+.
  if (loading) {
    return (
      <div className="glass-tile p-4 h-full">
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col}>
              <div className="skeleton-shimmer h-3 w-12 rounded mb-1.5" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5">
                  <div className="skeleton-shimmer w-3 h-3 rounded" />
                  <div className="skeleton-shimmer w-8 h-3 rounded" />
                  <div className="skeleton-shimmer h-3 ml-auto w-10 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="skeleton-shimmer h-2.5 w-24 rounded mx-auto mt-2.5" />
      </div>
    );
  }

  if (east.length === 0 && west.length === 0) return null;

  return (
    <div className="glass-tile p-4 h-full">
      {archivedSeason && (
        <p className="mb-2 text-center">
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">
            {archivedSeason} {isZh ? "赛季最终" : "Final"}
          </span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <ConferenceColumn title={t.standingsMini.east} teams={east} />
        <ConferenceColumn title={t.standingsMini.west} teams={west} />
      </div>
      <Link href="/stats" className="block text-center text-[10px] text-accent hover:underline mt-2">
        {t.standingsMini.fullStandings}
      </Link>
    </div>
  );
}
