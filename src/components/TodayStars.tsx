"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { Star } from "lucide-react";

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
          const allPlayers = [...(box.homeTeam?.players || []), ...(box.awayTeam?.players || [])];
          let best = null;
          let bestPts = 0;
          for (const p of allPlayers) {
            if (p.played !== "1") continue;
            const pts = p.statistics?.points || 0;
            if (pts > bestPts) { bestPts = pts; best = p; }
          }
          if (best) {
            const team = box.homeTeam.players.includes(best) ? box.homeTeam : box.awayTeam;
            allStars.push({
              personId: best.personId,
              name: best.nameI || best.name,
              teamTricode: team.teamTricode,
              pts: best.statistics.points,
              reb: best.statistics.reboundsTotal,
              ast: best.statistics.assists,
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
        Today&apos;s Stars
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stars.map((s) => {
          const doubles = [s.pts, s.reb, s.ast].filter((v) => v >= 10).length;
          return (
            <Link key={s.personId} href={`/game/${s.gameId}`} className="bg-bg-card rounded-xl border border-border p-3 hover:border-accent/50 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <PlayerHeadshot personId={s.personId} name={s.name} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">{s.name}</p>
                  <p className="text-[10px] text-text-secondary">{s.teamTricode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-accent font-bold">{s.pts} PTS</span>
                <span className="text-text-secondary">{s.reb} REB</span>
                <span className="text-text-secondary">{s.ast} AST</span>
              </div>
              {doubles >= 3 ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500 font-bold mt-1 inline-block">Triple-Double!</span>
                : doubles >= 2 ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold mt-1 inline-block">Double-Double</span>
                : s.pts >= 30 ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/15 text-danger font-bold mt-1 inline-block">30+ PTS</span>
                : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
