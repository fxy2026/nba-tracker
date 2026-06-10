"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Play } from "lucide-react";
import type { GameLeader, ScheduleGame } from "@/lib/api";
import { getGameStatusDisplay } from "@/lib/api";
import TeamLogo from "./TeamLogo";
import QuarterScores from "./QuarterScores";
import GameCountdown from "./GameCountdown";
import { useLocale } from "@/components/LocaleProvider";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isPlayoff } from "@/lib/games";

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

interface CategoryLeader {
  personId: number;
  name: string;
  value: number;
}

interface GameLeaders {
  pts?: CategoryLeader;
  ptsTied?: boolean;
}

// Game scoring leader from the data this card has. Today's games carry
// scoreboard gameLeaders (one featured player per team — normally each team's
// points leader), so the higher of the two IS the game's scoring leader. We
// deliberately do NOT surface REB/AST from this feed: the featured player is
// his team's top scorer, not necessarily its rebound/assist leader, so those
// values would mislabel a featured stat as a category leader. Past dates only
// know the schedule cache's game-high scorer(s).
function pickLeaders(game: ScheduleGame): GameLeaders {
  const featured = [game.gameLeaders?.homeLeaders, game.gameLeaders?.awayLeaders].filter(
    (l): l is GameLeader => !!l && l.personId > 0
  );
  if (featured.length > 0) {
    const top = featured.reduce((a, b) => (b.points > a.points ? b : a));
    const tied = featured.length > 1 && featured.some((l) => l !== top && l.points === top.points);
    return { pts: { personId: top.personId, name: top.name, value: top.points }, ptsTied: tied };
  }
  const scorers = (game.pointsLeaders || []).filter((l) => l.personId > 0);
  if (scorers.length > 0) {
    const top = scorers[0];
    return {
      pts: { personId: top.personId, name: `${top.firstName} ${top.lastName}`, value: top.points },
      ptsTied: scorers.length > 1,
    };
  }
  return {};
}

function LeaderItem({ label, leader, tiedText }: { label: string; leader: CategoryLeader; tiedText?: string }) {
  return (
    <span className="flex items-center gap-1 min-w-0">
      <span className="font-mono uppercase tracking-wider text-text-secondary/70">{label}</span>
      <Link
        href={`/player/${leader.personId}`}
        className="font-medium text-text-primary hover:text-accent transition-colors truncate"
      >
        {leader.name}
      </Link>
      <span className="font-mono tabular-nums font-bold text-accent">{leader.value}</span>
      {tiedText && <span className="text-text-secondary/60">({tiedText})</span>}
    </span>
  );
}

interface GameCardProps {
  game: ScheduleGame;
  hasReplay?: boolean;
}

export default memo(function GameCard({ game, hasReplay }: GameCardProps) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const status = getGameStatusDisplay(game.gameStatus, game.gameStatusText);
  const isLive = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const homeWon = isFinal && game.homeTeam.score > game.awayTeam.score;
  const awayWon = isFinal && game.awayTeam.score > game.homeTeam.score;
  // Live games only — flash when scores update
  const awayFlash = useScoreFlash(isLive ? game.awayTeam.score : 0);
  const homeFlash = useScoreFlash(isLive ? game.homeTeam.score : 0);
  // Finished games: line score + leaders peek, collapsed by default
  const [expanded, setExpanded] = useState(false);
  const isPlayoffs = isPlayoff(game.gameId);
  const isScheduled = game.gameStatus === 1;

  const hasPeriods =
    isFinal && (game.homeTeam.periods?.length ?? 0) > 0 && (game.awayTeam.periods?.length ?? 0) > 0;
  const leaders: GameLeaders = isFinal ? pickLeaders(game) : {};
  const hasLeaders = !!leaders.pts;
  const hasDetails = hasPeriods || hasLeaders;

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

  // Team colors for subtle side tinting on final games
  const awayColor = TEAM_META[game.awayTeam.teamTricode]?.primaryColor;
  const homeColor = TEAM_META[game.homeTeam.teamTricode]?.primaryColor;

  return (
    <div
      className={`glass-tile p-4 group relative overflow-hidden ${isLive ? "border-success/60 border-l-2 border-l-success game-card-live" : ""}`}
    >
      {/* Stretched link: the whole tile navigates to the game page, while
          interactive children (expand toggle, player links) sit above it at
          z-[2] — avoids invalid nested anchors. */}
      <Link href={`/game/${game.gameId}`} aria-label={ariaLabel} className="absolute inset-0 z-[1]" />
      {/* Decorative team-logo watermarks — 80×80 (down from 140×140) and
          CSS background-image. Smaller than the score text and 48px main
          logos, so the LCP candidate shifts away from these to actual
          content elements that paint immediately. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-4 -bottom-4 w-[80px] h-[80px] opacity-[0.05] group-hover:opacity-[0.10] transition-opacity bg-no-repeat bg-contain bg-center"
        style={{ backgroundImage: `url('${teamLogoUrl(game.awayTeam.teamId)}')` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-4 w-[80px] h-[80px] opacity-[0.05] group-hover:opacity-[0.10] transition-opacity bg-no-repeat bg-contain bg-center"
        style={{ backgroundImage: `url('${teamLogoUrl(game.homeTeam.teamId)}')` }}
      />
      {/* Final games: subtle winner-team-color side glow */}
      {isFinal && (awayWon || homeWon) && (
        <div
          className="absolute inset-y-0 w-16 opacity-30 pointer-events-none"
          style={{
            [awayWon ? "left" : "right"]: 0,
            background: `linear-gradient(${awayWon ? "to right" : "to left"}, ${awayWon ? awayColor : homeColor}33, transparent)`,
          }}
        />
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
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
      <div className="relative space-y-2">
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
            {hasDetails && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="relative z-[2] touch-target inline-flex items-center justify-center gap-0.5 px-2 text-[10px] text-text-secondary hover:text-accent transition-colors"
              >
                {hasPeriods
                  ? (isZh ? "节次·得分王" : "Quarters · Top scorer")
                  : (isZh ? "得分王" : "Top scorer")}
                <ChevronDown
                  size={10}
                  aria-hidden
                  className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
          {isPlayoffs && game.seriesText && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              {game.seriesText}
            </span>
          )}
        </div>
      )}

      {/* Expanded peek: compact line score + game leaders */}
      {isFinal && hasDetails && expanded && (
        <div className="relative z-[2] mt-2 pt-2 border-t border-border/30 space-y-1.5">
          {hasPeriods && (
            <QuarterScores
              compact
              homeTeam={{
                teamId: game.homeTeam.teamId,
                teamTricode: game.homeTeam.teamTricode,
                teamCity: game.homeTeam.teamCity,
                teamName: game.homeTeam.teamName,
                score: game.homeTeam.score,
                periods: game.homeTeam.periods ?? [],
              }}
              awayTeam={{
                teamId: game.awayTeam.teamId,
                teamTricode: game.awayTeam.teamTricode,
                teamCity: game.awayTeam.teamCity,
                teamName: game.awayTeam.teamName,
                score: game.awayTeam.score,
                periods: game.awayTeam.periods ?? [],
              }}
            />
          )}
          {hasLeaders && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]">
              {leaders.pts && (
                <LeaderItem
                  label={isZh ? "得分" : "PTS"}
                  leader={leaders.pts}
                  tiedText={leaders.ptsTied ? (isZh ? "并列" : "tied") : undefined}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
