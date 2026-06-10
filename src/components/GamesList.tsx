"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ScheduleGame } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isPlayoff } from "@/lib/games";
import { localTz, localToday } from "@/lib/timezone";
import GameCard from "./GameCard";
import ScoreTicker from "./ScoreTicker";
import LiveScoreRefresher from "./LiveScoreRefresher";
import TodayStars from "./TodayStars";
import HomeExtra from "./HomeExtra";
import EmptyState from "./EmptyState";
import { AlertCircle } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface GamesListProps {
  selectedDate: string;
  initialGames?: ScheduleGame[];
  initialReplayIds?: string[];
}

export default function GamesList({ selectedDate, initialGames, initialReplayIds }: GamesListProps) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const today = localToday();
  const isToday = selectedDate === today;
  const [games, setGames] = useState<ScheduleGame[]>(initialGames || []);
  const [replayIds, setReplayIds] = useState<string[]>(initialReplayIds || []);
  const [loading, setLoading] = useState(!initialGames);
  const [error, setError] = useState(false);
  const initialFetchDone = useRef(!!initialGames);

  const fetchGames = useCallback(async (date: string, signal?: AbortSignal) => {
    setError(false);
    try {
      const [gamesRes, replayRes] = await Promise.all([
        fetch(`/api/games?date=${date}&tz=${encodeURIComponent(localTz())}`, { signal }),
        fetch("/api/replay?action=ids", { signal }).catch(() => null),
      ]);
      if (signal?.aborted) return;
      const gamesJson = await gamesRes.json();
      const rawGames: ScheduleGame[] = gamesJson.data || [];
      rawGames.sort((a, b) => {
        const order = (s: number) => s === 2 ? 0 : s === 1 ? 1 : 2;
        return order(a.gameStatus) - order(b.gameStatus);
      });
      setGames(rawGames);

      if (replayRes?.ok) {
        const rJson = await replayRes.json();
        setReplayIds(rJson.ids || []);
      }
    } catch {
      if (!signal?.aborted) setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialFetchDone.current) {
      initialFetchDone.current = false;
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetchGames(selectedDate, controller.signal);
    return () => controller.abort();
  }, [selectedDate, fetchGames]);

  const refreshGames = useCallback(() => {
    fetchGames(selectedDate);
  }, [fetchGames, selectedDate]);

  const replaySet = useMemo(() => new Set(replayIds), [replayIds]);
  const { liveNow, upcoming, final } = useMemo(() => ({
    liveNow: games.filter((g) => g.gameStatus === 2),
    upcoming: games.filter((g) => g.gameStatus === 1),
    final: games.filter((g) => g.gameStatus === 3),
  }), [games]);
  const hasLiveGames = isToday && liveNow.length > 0;

  const gameOfTheDay = useMemo(() => {
    if (final.length === 0) return null;
    const closest = final.reduce((best, g) => {
      const diff = Math.abs(g.homeTeam.score - g.awayTeam.score);
      const bestDiff = Math.abs(best.homeTeam.score - best.awayTeam.score);
      return diff < bestDiff ? g : best;
    });
    const margin = Math.abs(closest.homeTeam.score - closest.awayTeam.score);
    if (margin > 20) return null;
    return { ...closest, margin };
  }, [final]);

  // Date breakdown for hero display — must run before any early return (rules-of-hooks)
  const dateObj = useMemo(() => new Date(selectedDate + "T12:00:00"), [selectedDate]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-tile p-4 h-[180px]">
              <div className="skeleton-shimmer h-4 w-16 rounded mb-3" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer w-8 h-8 rounded-full" />
                    <div className="skeleton-shimmer h-4 w-32 rounded" />
                  </div>
                  <div className="skeleton-shimmer h-6 w-8 rounded" />
                </div>
                <div className="border-t border-border/50" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer w-8 h-8 rounded-full" />
                    <div className="skeleton-shimmer h-4 w-32 rounded" />
                  </div>
                  <div className="skeleton-shimmer h-6 w-8 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full-screen error only when we have nothing to show. If a refresh fails
  // after we already rendered games, fall through and show a soft banner —
  // stale data beats wiping the UI.
  if (error && games.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title={t.home.failedToLoad}
          description="Network may be slow or the data source is temporarily unavailable."
          action={{ label: t.common.retry, onClick: () => { setError(false); setLoading(true); fetchGames(selectedDate); } }}
        />
      </div>
    );
  }

  // Compact editorial summary line — no padding tiles
  const monthShort = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dayNum = dateObj.getDate();

  return (
    <>
      {error && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{t.home.refreshFailed}</span>
          <button
            onClick={() => { setError(false); fetchGames(selectedDate); }}
            className="font-medium underline decoration-dashed hover:no-underline"
          >
            {t.common.retry}
          </button>
        </div>
      )}
      <LiveScoreRefresher hasLiveGames={hasLiveGames} onRefresh={refreshGames} />

      {/* Live score ticker (only when live games — high-signal real-time element) */}
      {hasLiveGames && (
        <ScoreTicker
          games={liveNow.map((g) => ({
            gameId: g.gameId,
            awayTricode: g.awayTeam.teamTricode,
            homeTricode: g.homeTeam.teamTricode,
            awayScore: g.awayTeam.score,
            homeScore: g.homeTeam.score,
            gameStatusText: g.gameStatusText,
          }))}
        />
      )}

      {/* Editorial status line — minimal, only when games exist */}
      {games.length > 0 && (
        <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-text-secondary">
          <span>{weekday} {monthShort} {dayNum}</span>
          <span className="h-px flex-1 bg-border" />
          <span>
            <span className="text-text-primary font-semibold tabular-nums">{games.length}</span> games
          </span>
          {hasLiveGames && (
            <span className="flex items-center gap-1.5 text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              <span className="font-bold tabular-nums">{liveNow.length}</span> live
            </span>
          )}
        </div>
      )}

      {/* ─── Game of the Day featured tile ─────────────────── */}
      {gameOfTheDay && (
        <Link
          href={`/game/${gameOfTheDay.gameId}`}
          className="glass-tile glass-tile-featured block mt-5 cursor-pointer relative overflow-hidden group"
        >
          {/* Decorative watermark logos — 160×160 (down from 280×280) keeps
              the featured-tile "wow" effect without making the watermark the
              LCP candidate. CSS background-image, opacity-0.08, two corners. */}
          <div
            aria-hidden
            className="absolute -left-8 top-1/2 -translate-y-1/2 w-[160px] h-[160px] opacity-[0.08] group-hover:opacity-[0.14] transition-opacity pointer-events-none bg-no-repeat bg-contain bg-center"
            style={{ backgroundImage: `url('${teamLogoUrl(gameOfTheDay.awayTeam.teamId)}')` }}
          />
          <div
            aria-hidden
            className="absolute -right-8 top-1/2 -translate-y-1/2 w-[160px] h-[160px] opacity-[0.08] group-hover:opacity-[0.14] transition-opacity pointer-events-none bg-no-repeat bg-contain bg-center"
            style={{ backgroundImage: `url('${teamLogoUrl(gameOfTheDay.homeTeam.teamId)}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-accent-amber/10 pointer-events-none" />

          <div className="relative p-5 sm:p-6 flex items-center gap-4 sm:gap-6">
            {/* Away team */}
            <div className="flex-1 flex items-center gap-3">
              <Image
                src={teamLogoUrl(gameOfTheDay.awayTeam.teamId)}
                alt={gameOfTheDay.awayTeam.teamTricode}
                width={48}
                height={48}
                unoptimized
                className="shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary truncate">Away</p>
                <p className="text-sm font-bold text-text-primary truncate">{gameOfTheDay.awayTeam.teamTricode}</p>
              </div>
            </div>

            {/* Center: Score + label */}
            <div className="text-center shrink-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-accent-amber mb-1 flex items-center justify-center gap-1">
                <span>★</span> {t.home.gameOfTheDay} <span>★</span>
              </p>
              <p className="text-3xl sm:text-4xl font-light font-mono tabular-nums leading-none tracking-tight text-text-primary">
                {gameOfTheDay.awayTeam.score}
                <span className="text-text-secondary/40 mx-2 font-extralight">–</span>
                {gameOfTheDay.homeTeam.score}
              </p>
              <p className="text-[10px] font-mono tabular-nums text-text-secondary mt-1.5">
                <span className="text-accent-amber font-bold">{gameOfTheDay.margin}</span> pt margin
              </p>
            </div>

            {/* Home team */}
            <div className="flex-1 flex items-center gap-3 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary truncate">Home</p>
                <p className="text-sm font-bold text-text-primary truncate">{gameOfTheDay.homeTeam.teamTricode}</p>
              </div>
              <Image
                src={teamLogoUrl(gameOfTheDay.homeTeam.teamId)}
                alt={gameOfTheDay.homeTeam.teamTricode}
                width={48}
                height={48}
                unoptimized
                className="shrink-0"
              />
            </div>
          </div>
        </Link>
      )}

      {/* Game cards by status — each group is its own section divider */}
      {games.length > 0 ? (
        <div className="space-y-6 mt-6">
          {games.some((g) => isPlayoff(g.gameId)) && (
            <div className="glass-tile glass-tile-featured px-4 py-2 text-center">
              <span className="text-xs font-bold text-accent-amber uppercase tracking-[0.25em]">★ {t.home.playoffGamesToday}</span>
            </div>
          )}

          {liveNow.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-success flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  {t.home.liveNow}
                </h2>
                <span className="h-px flex-1 bg-success/30" />
                <span className="text-[10px] font-mono tabular-nums text-success/80">
                  {liveNow.length} {isZh ? "场比赛" : liveNow.length === 1 ? "game" : "games"}
                  {isToday && <span className="text-text-secondary/60 ml-2">· {isZh ? "自动刷新" : "auto"}</span>}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveNow.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
                  {t.common.upcoming}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-mono tabular-nums text-text-secondary/70">
                  {upcoming.length} {isZh ? "场比赛" : upcoming.length === 1 ? "game" : "games"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </div>
          )}

          {final.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-secondary/50" />
                  {t.common.final}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-mono tabular-nums text-text-secondary/70">
                  {final.length} {isZh ? "场比赛" : final.length === 1 ? "game" : "games"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {final.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <svg viewBox="0 0 80 80" className="w-16 h-16 mb-4 opacity-20">
            <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="40" y1="10" x2="40" y2="70" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10,40 Q40,15 70,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10,40 Q40,65 70,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p className="text-lg font-medium text-text-primary">{selectedDate} — {t.home.noGames}</p>
          <p className="text-sm mt-1 mb-4">{t.home.noGamesHint}</p>
          {(() => {
            const facts = [
              "Wilt Chamberlain scored 100 points in a single game on March 2, 1962.",
              "The NBA three-point line was introduced in the 1979-80 season.",
              "Kareem Abdul-Jabbar holds the all-time regular season scoring record with 38,387 points (surpassed by LeBron in 2023).",
              "The longest NBA game lasted 6 overtimes — Indianapolis vs Rochester in 1951.",
              "The NBA has had 30 teams since the 2004-05 season.",
              "Michael Jordan has 6 NBA Finals MVP awards — the most in history.",
              "The shot clock was introduced in 1954 to speed up the game.",
              "Tim Duncan was drafted #1 overall in 1997 and won 5 championships with the Spurs.",
            ];
            const idx = new Date(selectedDate).getDate() % facts.length;
            return (
              <div className="glass-tile p-4 mb-4 max-w-md text-center">
                <p className="text-[10px] text-text-secondary uppercase font-medium mb-1">{t.home.funFact}</p>
                <p className="text-xs text-text-primary">{facts[idx]}</p>
              </div>
            );
          })()}
          <div className="flex items-center gap-3 text-xs">
            <Link href="/standings" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">{t.home.rankings}</Link>
            <Link href="/search" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">{t.home.searchPlayers}</Link>
            <Link href="/injuries" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">{t.home.injuryReport}</Link>
          </div>
          {isToday && (
            <div className="mt-6 w-full max-w-lg">
              <p className="text-xs text-text-secondary uppercase font-medium mb-3 text-center">{t.home.noGamesToday}</p>
              <div className="grid grid-cols-2 gap-3">
                <Link href={`/?date=${(() => {
                  const d = new Date(); d.setDate(d.getDate() - 1);
                  return new Intl.DateTimeFormat("en-CA", {
                    timeZone: localTz(),
                    year: "numeric", month: "2-digit", day: "2-digit",
                  }).format(d);
                })()}`} className="flex flex-col items-center gap-1.5 p-4 glass-tile hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.browseRecent}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.yesterdayResults}</span>
                </Link>
                <Link href="/standings" className="flex flex-col items-center gap-1.5 p-4 glass-tile hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.checkStandings}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.conferenceRankings}</span>
                </Link>
                <Link href="/search" className="flex flex-col items-center gap-1.5 p-4 glass-tile hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.findPlayer}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.findAnyPlayer}</span>
                </Link>
                <Link href="/injuries" className="flex flex-col items-center gap-1.5 p-4 glass-tile hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.injuryReport}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.latestInjury}</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {isToday && <TodayStars />}
      <HomeExtra />
    </>
  );
}
