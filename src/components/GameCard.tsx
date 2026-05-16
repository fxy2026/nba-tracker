"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import type { ScheduleGame } from "@/lib/api";
import { getGameStatusDisplay } from "@/lib/api";
import TeamLogo from "./TeamLogo";
import GameCountdown from "./GameCountdown";
import { useLocale } from "@/components/LocaleProvider";

/** Hook: detect when a score changes and trigger a CSS class for 1.2s */
function useScoreFlash(score: number): boolean {
  const [flash, setFlash] = useState(false);
  const prev = useRef(score);
  useEffect(() => {
    if (prev.current !== score) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      prev.current = score;
      return () => clearTimeout(t);
    }
  }, [score]);
  return flash;
}

interface GameCardProps {
  game: ScheduleGame;
  hasReplay?: boolean;
}

export default memo(function GameCard({ game, hasReplay }: GameCardProps) {
  const { t } = useLocale();
  const status = getGameStatusDisplay(game.gameStatus, game.gameStatusText);
  const isLive = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const homeWon = isFinal && game.homeTeam.score > game.awayTeam.score;
  const awayWon = isFinal && game.awayTeam.score > game.homeTeam.score;
  // Live games only — flash when scores update
  const awayFlash = useScoreFlash(isLive ? game.awayTeam.score : 0);
  const homeFlash = useScoreFlash(isLive ? game.homeTeam.score : 0);
  const isPlayoffs = game.gameId.startsWith("004");
  const isScheduled = game.gameStatus === 1;

  // Determine playoff round from game ID
  let playoffRound = "";
  if (isPlayoffs && game.gameId.length >= 8) {
    const roundDigit = game.gameId.charAt(7);
    if (roundDigit === "1") playoffRound = "R1";
    else if (roundDigit === "2") playoffRound = t.gameCard.semis;
    else if (roundDigit === "3") playoffRound = t.gameCard.confFinals;
    else if (roundDigit === "4") playoffRound = t.gameCard.finals;
  }

  const ariaLabel = `${game.awayTeam.teamTricode} ${game.gameStatus > 1 ? game.awayTeam.score : ""} vs ${game.homeTeam.teamTricode} ${game.gameStatus > 1 ? game.homeTeam.score : ""} — ${status}`;

  return (
    <Link href={`/game/${game.gameId}`} className="block group" aria-label={ariaLabel}>
      <div className={`glass-tile p-4 ${isLive ? "border-success/60 border-l-2 border-l-success game-card-live" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {isPlayoffs && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                {playoffRound || t.common.playoffs}
              </span>
            )}
            {game.seriesText && (
              <span className="text-xs text-text-secondary">{game.seriesText}</span>
            )}
            {isScheduled && game.gameDateTimeUTC && (
              <>
                <GameCountdown gameTimeUTC={game.gameDateTimeUTC} />
                {(() => {
                  try {
                    const d = new Date(game.gameDateTimeUTC);
                    if (isNaN(d.getTime())) return null;
                    const hh = d.getUTCHours() + 8;
                    const mm = d.getUTCMinutes();
                    const adjustedH = ((hh % 24) + 24) % 24;
                    const timeStr = `${String(adjustedH).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
                    return (
                      <span className="text-[10px] text-text-secondary">{timeStr} {t.common.beijingTime}</span>
                    );
                  } catch { return null; }
                })()}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasReplay && (
              <span className="flex items-center gap-0.5 text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                <Play size={10} fill="currentColor" />
                {t.gameCard.replay}
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
              {isLive && game.gameStatusText.toLowerCase().includes("half") && (
                <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-accent-amber/15 text-accent-amber rounded">{t.gameCard.halftime}</span>
              )}
              {isLive && Math.abs(game.homeTeam.score - game.awayTeam.score) <= 5 && game.homeTeam.score + game.awayTeam.score > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-danger/15 text-danger rounded">{t.gameCard.close}</span>
              )}
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
                  <p className="text-xs text-text-secondary font-mono tabular-nums">
                    {game.awayTeam.wins}-{game.awayTeam.losses}
                    {game.awayTeam.seed > 0 && ` · #${game.awayTeam.seed}`}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xl font-bold font-mono tabular-nums flex items-center gap-1 transition-colors ${awayWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"} ${awayFlash ? "score-flash" : ""}`}>
              {game.gameStatus > 1 ? game.awayTeam.score : "-"}
              {awayWon && <span className="text-success text-xs">&#10003;</span>}
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
                  <p className="text-xs text-text-secondary font-mono tabular-nums">
                    {game.homeTeam.wins}-{game.homeTeam.losses}
                    {game.homeTeam.seed > 0 && ` · #${game.homeTeam.seed}`}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xl font-bold font-mono tabular-nums flex items-center gap-1 transition-colors ${homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"} ${homeFlash ? "score-flash" : ""}`}>
              {game.gameStatus > 1 ? game.homeTeam.score : "-"}
              {homeWon && <span className="text-success text-xs">&#10003;</span>}
            </span>
          </div>
        </div>

        {/* Point differential */}
        {isFinal && (
          <div className="mt-2 pt-2 border-t border-border/30 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary">
                {awayWon ? game.awayTeam.teamTricode : game.homeTeam.teamTricode} +{Math.abs(game.homeTeam.score - game.awayTeam.score)}
              </span>
              {game.homeTeam.score + game.awayTeam.score >= 240 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-accent/15 text-accent font-medium">{t.gameCard.highScore}</span>
              )}
              {Math.abs(game.homeTeam.score - game.awayTeam.score) <= 3 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-danger/15 text-danger font-medium">{t.gameCard.nailBiter}</span>
              )}
            </div>
            {isPlayoffs && game.seriesText && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                {game.seriesText}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
});
