import Link from "next/link";
import { Play } from "lucide-react";
import type { ScheduleGame } from "@/lib/api";
import { getGameStatusDisplay } from "@/lib/api";
import TeamLogo from "./TeamLogo";
import GameCountdown from "./GameCountdown";

interface GameCardProps {
  game: ScheduleGame;
  hasReplay?: boolean;
}

export default function GameCard({ game, hasReplay }: GameCardProps) {
  const status = getGameStatusDisplay(game.gameStatus, game.gameStatusText);
  const isLive = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const homeWon = isFinal && game.homeTeam.score > game.awayTeam.score;
  const awayWon = isFinal && game.awayTeam.score > game.homeTeam.score;
  const isPlayoffs = game.gameId.startsWith("004");
  const isScheduled = game.gameStatus === 1;

  return (
    <Link href={`/game/${game.gameId}`} className="block group">
      <div className={`game-card bg-bg-card rounded-xl border hover:border-accent/50 transition-colors p-4 ${isLive ? "border-success/40 border-l-2 border-l-success" : "border-border"}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {isPlayoffs && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                Playoffs
              </span>
            )}
            {game.seriesText && (
              <span className="text-xs text-text-secondary">{game.seriesText}</span>
            )}
            {isScheduled && game.gameDateTimeUTC && (
              <GameCountdown gameTimeUTC={game.gameDateTimeUTC} />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasReplay && (
              <span className="flex items-center gap-0.5 text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                <Play size={10} fill="currentColor" />
                Replay
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isFinal
                  ? "bg-text-secondary/10 text-text-secondary"
                  : isLive
                  ? "bg-success/15 text-success"
                  : "text-text-secondary"
              }`}
            >
              {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-success live-pulse" />}
              {status}
            </span>
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-2">
          {/* Away */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TeamLogo teamId={game.awayTeam.teamId} tricode={game.awayTeam.teamTricode} size={32} />
              <div>
                <p className={`font-semibold text-sm ${awayWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"}`}>
                  {game.awayTeam.teamCity} {game.awayTeam.teamName}
                </p>
                {game.awayTeam.wins > 0 && (
                  <p className="text-xs text-text-secondary">
                    {game.awayTeam.wins}-{game.awayTeam.losses}
                    {game.awayTeam.seed > 0 && ` · #${game.awayTeam.seed}`}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xl font-bold tabular-nums ${awayWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"}`}>
              {game.gameStatus > 1 ? game.awayTeam.score : "-"}
            </span>
          </div>

          <div className="border-t border-border/50" />

          {/* Home */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TeamLogo teamId={game.homeTeam.teamId} tricode={game.homeTeam.teamTricode} size={32} />
              <div>
                <p className={`font-semibold text-sm ${homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"}`}>
                  {game.homeTeam.teamCity} {game.homeTeam.teamName}
                </p>
                {game.homeTeam.wins > 0 && (
                  <p className="text-xs text-text-secondary">
                    {game.homeTeam.wins}-{game.homeTeam.losses}
                    {game.homeTeam.seed > 0 && ` · #${game.homeTeam.seed}`}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xl font-bold tabular-nums ${homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"}`}>
              {game.gameStatus > 1 ? game.homeTeam.score : "-"}
            </span>
          </div>
        </div>

        {/* Point differential */}
        {isFinal && (
          <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-center">
            <span className="text-[10px] text-text-secondary">
              {awayWon ? game.awayTeam.teamTricode : game.homeTeam.teamTricode} +{Math.abs(game.homeTeam.score - game.awayTeam.score)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
