"use client";

import { memo } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

interface TickerGame {
  gameId: string;
  awayTricode: string;
  homeTricode: string;
  awayScore: number;
  homeScore: number;
  gameStatusText: string;
}

export default memo(function ScoreTicker({ games }: { games: TickerGame[] }) {
  const { t } = useLocale();
  if (games.length === 0) return null;

  return (
    <div className="glass-tile overflow-hidden mb-4">
      <div className="flex items-center gap-1.5 px-2.5 py-2 overflow-x-auto scrollbar-hide">
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-1 rounded-full bg-success/15 text-success font-bold mr-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          {t.liveScore.liveLabel}
        </span>
        {games.map((g) => {
          const awayLeading = g.awayScore > g.homeScore;
          const homeLeading = g.homeScore > g.awayScore;
          const isClose = Math.abs(g.awayScore - g.homeScore) <= 5 && g.awayScore + g.homeScore > 0;
          return (
            <Link
              key={g.gameId}
              href={`/game/${g.gameId}`}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary/60 hover:bg-bg-hover transition-colors text-xs cursor-pointer ${isClose ? "ring-1 ring-danger/40" : ""}`}
            >
              <span className={`font-semibold font-mono ${awayLeading ? "text-text-primary" : "text-text-secondary"}`}>{g.awayTricode}</span>
              <span className={`font-bold font-mono tabular-nums ${awayLeading ? "text-accent-amber" : "text-text-secondary"}`}>{g.awayScore}</span>
              <span className="text-text-secondary/40">–</span>
              <span className={`font-bold font-mono tabular-nums ${homeLeading ? "text-accent-amber" : "text-text-secondary"}`}>{g.homeScore}</span>
              <span className={`font-semibold font-mono ${homeLeading ? "text-text-primary" : "text-text-secondary"}`}>{g.homeTricode}</span>
              <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-text-secondary/70 ml-1">{g.gameStatusText.trim()}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});
