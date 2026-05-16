"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { Star } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface StarPlayer {
  personId: number;
  name: string;
  teamTricode: string;
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
        const res = await fetch("/api/games", { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const games = data.games || [];
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
            const team = bestTeam as { teamTricode: string };
            allStars.push({
              personId: b.personId,
              name: b.nameI || b.name || "",
              teamTricode: team.teamTricode,
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

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Star size={14} className="text-accent" />
        {t.todayStars.title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stars.map((s) => {
          const doubles = [s.pts, s.reb, s.ast].filter((v) => v >= 10).length;
          return (
            <Link key={s.personId} href={`/game/${s.gameId}`} className="glass-tile block p-3 cursor-pointer group">
              <div className="flex items-center gap-2 mb-2">
                <PlayerHeadshot personId={s.personId} name={s.name} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">{s.name}</p>
                  <p className="text-[10px] text-text-secondary">{s.teamTricode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-accent-amber font-bold">{s.pts}<span className="text-[10px] text-text-secondary ml-0.5 font-sans font-medium">PTS</span></span>
                <span className="text-text-secondary">{s.reb}<span className="text-[10px] ml-0.5 font-sans">REB</span></span>
                <span className="text-text-secondary">{s.ast}<span className="text-[10px] ml-0.5 font-sans">AST</span></span>
              </div>
              {doubles >= 3 ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber font-bold mt-1 inline-block">{t.todayStars.tripleDouble}</span>
                : doubles >= 2 ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold mt-1 inline-block">{t.todayStars.doubleDouble}</span>
                : s.pts >= 30 ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/15 text-danger font-bold mt-1 inline-block">{t.todayStars.thirtyPts}</span>
                : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
