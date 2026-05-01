"use client";

import { memo } from "react";
import Link from "next/link";
import type { ScheduleGame } from "@/lib/api";
import TeamLogo from "./TeamLogo";
import { ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  games: ScheduleGame[];
}

export default memo(function RecentHighlights({ games }: Props) {
  const { t } = useLocale();
  return (
    <section>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        {t.recentHighlights.title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {games.map((game) => {
          const homeWon = game.homeTeam.score > game.awayTeam.score;
          const diff = Math.abs(game.homeTeam.score - game.awayTeam.score);
          const isClose = diff <= 5;
          const isBlowout = diff >= 20;

          // Parse date from gameCode
          const dateCode = game.gameCode.split("/")[0];
          const dateStr = `${dateCode.slice(4, 6)}/${dateCode.slice(6, 8)}`;

          return (
            <Link
              key={game.gameId}
              href={`/game/${game.gameId}`}
              className="game-card bg-bg-card rounded-xl border border-border hover:border-accent/40 transition-colors p-3 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">{dateStr}</span>
                <div className="flex items-center gap-1">
                  {isClose && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-danger/15 text-danger">
                      {t.recentHighlights.clutch}
                    </span>
                  )}
                  {isBlowout && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {t.recentHighlights.blowout}
                    </span>
                  )}
                  {game.gameId.startsWith("004") && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {t.recentHighlights.po}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TeamLogo teamId={game.awayTeam.teamId} tricode={game.awayTeam.teamTricode} size={20} />
                  <span className={`text-sm ${!homeWon ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                    {game.awayTeam.teamTricode}
                  </span>
                </div>
                <span className={`text-sm tabular-nums ${!homeWon ? "font-bold" : "text-text-secondary"}`}>
                  {game.awayTeam.score}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <TeamLogo teamId={game.homeTeam.teamId} tricode={game.homeTeam.teamTricode} size={20} />
                  <span className={`text-sm ${homeWon ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                    {game.homeTeam.teamTricode}
                  </span>
                </div>
                <span className={`text-sm tabular-nums ${homeWon ? "font-bold" : "text-text-secondary"}`}>
                  {game.homeTeam.score}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {homeWon ? game.homeTeam.teamTricode : game.awayTeam.teamTricode} {t.recentHighlights.winBy} {diff}
                </span>
                <div className="flex items-center gap-1.5">
                  {game.seriesText && (
                    <span className="text-[9px] text-text-secondary">{game.seriesText}</span>
                  )}
                  <ChevronRight size={12} className="text-text-secondary group-hover:text-accent transition-colors" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
});
