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
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-4">
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide">
        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium mr-1 animate-pulse">
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
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors text-xs ${isClose ? "ring-1 ring-danger/30" : ""}`}
            >
              <span className={`font-medium ${awayLeading ? "text-text-primary" : "text-text-secondary"}`}>{g.awayTricode}</span>
              <span className={`font-bold tabular-nums ${awayLeading ? "text-accent" : "text-text-secondary"}`}>{g.awayScore}</span>
              <span className="text-text-secondary">-</span>
              <span className={`font-bold tabular-nums ${homeLeading ? "text-accent" : "text-text-secondary"}`}>{g.homeScore}</span>
              <span className={`font-medium ${homeLeading ? "text-text-primary" : "text-text-secondary"}`}>{g.homeTricode}</span>
              <span className="text-[9px] text-text-secondary ml-0.5">{g.gameStatusText.trim()}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});
