"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { Star, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { TEAM_META } from "@/lib/teams";
import { localToday, localTz } from "@/lib/timezone";

interface StarPlayer {
  personId: number;
  name: string;
  teamTricode: string;
  teamId: number;
  pts: number;
  reb: number;
  ast: number;
  gameId: string;
}

export default function TodayStars() {
  const { t } = useLocale();
  const [stars, setStars] = useState<StarPlayer[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/games?date=${localToday()}&tz=${encodeURIComponent(localTz())}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const games = data.data || [];
        const finalGames = games.filter((g: { gameStatus: number }) => g.gameStatus === 3);
        if (finalGames.length === 0) return;

        const boxes = await Promise.all(
          finalGames.slice(0, 4).map(async (g: { gameId: string }) => {
            try {
              const r = await fetch(
                `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${g.gameId}.json`,
                { signal: controller.signal }
              );
              if (!r.ok) return null;
              return (await r.json()).game;
            } catch { return null; }
          })
        );

        const allStars: StarPlayer[] = [];
        for (const box of boxes) {
          if (!box) continue;
          // Track team alongside the best player so we don't need a follow-up .includes() lookup.
          let best = null;
          let bestPts = 0;
          let bestTeam = null;
          const scan = (players: { played: string; statistics?: { points?: number } }[] | undefined, team: { teamTricode: string }) => {
            if (!players) return;
            for (const p of players) {
              if (p.played !== "1") continue;
              const pts = p.statistics?.points || 0;
              if (pts > bestPts) { bestPts = pts; best = p; bestTeam = team; }
            }
          };
          scan(box.homeTeam?.players, box.homeTeam);
          scan(box.awayTeam?.players, box.awayTeam);
          if (best && bestTeam) {
            const b = best as { personId: number; nameI?: string; name?: string; statistics: { points: number; reboundsTotal: number; assists: number } };
            const team = bestTeam as { teamTricode: string; teamId: number };
            allStars.push({
              personId: b.personId,
              name: b.nameI || b.name || "",
              teamTricode: team.teamTricode,
              teamId: team.teamId,
              pts: b.statistics.points,
              reb: b.statistics.reboundsTotal,
              ast: b.statistics.assists,
              gameId: box.gameId,
            });
          }
        }

        if (!controller.signal.aborted && allStars.length > 0) {
          allStars.sort((a, b) => b.pts - a.pts);
          setStars(allStars.slice(0, 4));
        }
      } catch {
        // Aborted or network error — silent
      }
    })();
    return () => controller.abort();
  }, []);

  if (stars.length === 0) return null;

  const [hero, ...rest] = stars;
  const heroTeamColor = TEAM_META[hero.teamTricode]?.primaryColor || "#3B82F6";

  return (
    <section className="mt-10">
      {/* Editorial section header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ 01</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <Star size={14} className="text-accent-amber" fill="currentColor" />
            {t.todayStars.title}
          </h2>
        </div>
      </div>

      {/* Bento: hero #1 + grid of supporting stars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 auto-rows-[140px] sm:auto-rows-[156px]">
        {/* HERO #1 — featured 2-col span with team-color treatment */}
        <Link
          href={`/game/${hero.gameId}`}
          className="glass-tile glass-tile-featured col-span-2 row-span-1 p-4 sm:p-5 cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          style={{ ["--team-color" as string]: heroTeamColor }}
        >
          {/* Team color radial accent */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at top right, ${heroTeamColor}66 0%, transparent 60%)` }}
          />

          <div className="relative flex items-center justify-between">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-accent-amber flex items-center gap-1.5">
              <span>★</span> Top Scorer
            </p>
            <ArrowUpRight size={14} className="text-text-secondary/50 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>

          <div className="relative flex items-end gap-4">
            <PlayerHeadshot personId={hero.personId} name={hero.name} size={64} />
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-bold text-text-primary truncate group-hover:text-accent transition-colors leading-tight">
                {hero.name}
              </p>
              <p className="text-[11px] text-text-secondary font-mono mt-0.5">{hero.teamTricode}</p>
              <div className="flex items-baseline gap-3 mt-2 font-mono tabular-nums">
                <span className="text-3xl sm:text-4xl font-light text-accent-amber leading-none">{hero.pts}</span>
                <span className="text-[10px] text-text-secondary uppercase tracking-[0.15em]">pts</span>
                <span className="text-sm text-text-primary ml-2">{hero.reb}<span className="text-[9px] text-text-secondary ml-0.5">REB</span></span>
                <span className="text-sm text-text-primary">{hero.ast}<span className="text-[9px] text-text-secondary ml-0.5">AST</span></span>
              </div>
            </div>
            <StarBadge pts={hero.pts} reb={hero.reb} ast={hero.ast} t={t} />
          </div>
        </Link>

        {/* Supporting stars (1-col each) */}
        {rest.map((s, i) => {
          const teamColor = TEAM_META[s.teamTricode]?.primaryColor || "#3B82F6";
          return (
            <Link
              key={s.personId}
              href={`/game/${s.gameId}`}
              className="glass-tile col-span-1 row-span-1 p-3 sm:p-4 cursor-pointer group relative overflow-hidden flex flex-col justify-between bento-rise"
              style={{ ["--team-color" as string]: teamColor, animationDelay: `${(i + 1) * 60}ms` }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 60%)` }}
              />
              <div className="relative flex items-center gap-2.5">
                <PlayerHeadshot personId={s.personId} name={s.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate group-hover:text-accent transition-colors leading-tight">{s.name}</p>
                  <p className="text-[10px] text-text-secondary font-mono">{s.teamTricode}</p>
                </div>
              </div>
              <div className="relative">
                <div className="flex items-baseline gap-2 font-mono tabular-nums">
                  <span className="text-2xl font-light text-accent-amber leading-none">{s.pts}</span>
                  <span className="text-[9px] text-text-secondary uppercase tracking-[0.15em]">pts</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono tabular-nums text-text-secondary">
                  <span>{s.reb} <span className="text-[9px]">REB</span></span>
                  <span>{s.ast} <span className="text-[9px]">AST</span></span>
                  <StarBadge pts={s.pts} reb={s.reb} ast={s.ast} t={t} compact />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function StarBadge({ pts, reb, ast, t, compact = false }: {
  pts: number; reb: number; ast: number;
  t: { todayStars: { tripleDouble: string; doubleDouble: string; thirtyPts: string } };
  compact?: boolean;
}) {
  const doubles = [pts, reb, ast].filter((v) => v >= 10).length;
  const className = compact ? "ml-auto" : "shrink-0";
  if (doubles >= 3) {
    return <span className={`text-[9px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber font-bold ${className}`}>{t.todayStars.tripleDouble}</span>;
  }
  if (doubles >= 2) {
    return <span className={`text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold ${className}`}>{t.todayStars.doubleDouble}</span>;
  }
  if (pts >= 30) {
    return <span className={`text-[9px] px-1.5 py-0.5 rounded bg-danger/15 text-danger font-bold ${className}`}>{t.todayStars.thirtyPts}</span>;
  }
  return null;
}
