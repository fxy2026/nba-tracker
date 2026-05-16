"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import type { ScheduleGame } from "@/lib/api";
import GameCard from "./GameCard";
import ScoreTicker from "./ScoreTicker";
import LiveScoreRefresher from "./LiveScoreRefresher";
import TodayStars from "./TodayStars";
import HomeExtra from "./HomeExtra";
import { formatDate } from "@/lib/api";
import { useLocale } from "@/components/LocaleProvider";

interface GamesListProps {
  selectedDate: string;
  initialGames?: ScheduleGame[];
  initialReplayIds?: string[];
}

export default function GamesList({ selectedDate, initialGames, initialReplayIds }: GamesListProps) {
  const { t } = useLocale();
  const today = formatDate(new Date());
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
        fetch(`/api/games?date=${date}`, { signal }),
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

  const dayInsights = useMemo(() => {
    if (final.length === 0) return null;
    const avgScore = (final.reduce((s, g) => s + g.homeTeam.score + g.awayTeam.score, 0) / final.length).toFixed(0);
    let blowouts = 0, thrillers = 0, homeWins = 0;
    for (const g of final) {
      const diff = Math.abs(g.homeTeam.score - g.awayTeam.score);
      if (diff >= 20) blowouts++;
      if (diff <= 5) thrillers++;
      if (g.homeTeam.score > g.awayTeam.score) homeWins++;
    }
    return { avgScore, blowouts, thrillers, homeWins, awayWins: final.length - homeWins };
  }, [final]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4 h-[180px]">
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

  if (error) {
    return (
      <div className="mt-6 bg-bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-text-secondary text-sm mb-3">{t.home.failedToLoad}</p>
        <button
          onClick={() => { setError(false); setLoading(true); fetchGames(selectedDate); }}
          className="text-xs px-4 py-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
        >
          {t.common.retry}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Live score ticker */}
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

      <LiveScoreRefresher hasLiveGames={hasLiveGames} />

      {/* Last updated */}
      {isToday && games.length > 0 && (
        <p className="text-[10px] text-text-secondary text-right mt-4">
          {t.common.updated}{new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })} ({t.common.beijing})
        </p>
      )}

      {/* Game of the Day */}
      {gameOfTheDay && (
        <Link href={`/game/${gameOfTheDay.gameId}`} className="block mt-6 mb-2 px-4 py-2.5 bg-accent/10 border border-accent/20 rounded-xl hover:bg-accent/15 transition-colors">
          <p className="text-sm text-center">
            <span className="text-accent font-bold">{t.home.gameOfTheDay}</span>
            <span className="text-text-primary font-medium">
              {gameOfTheDay.awayTeam.teamTricode} {gameOfTheDay.awayTeam.score} - {gameOfTheDay.homeTeam.score} {gameOfTheDay.homeTeam.teamTricode}
            </span>
            <span className="text-text-secondary ml-1">({t.home.margin}{gameOfTheDay.margin})</span>
          </p>
        </Link>
      )}

      {/* Games count */}
      {games.length > 0 ? (
        <div className="mt-6 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{games.length} {games.length !== 1 ? t.common.games : t.common.game}</span>
            {games.length >= 10 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{t.home.packedSlate}</span>
            )}
            {games.length > 0 && games.length <= 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 font-medium">{t.home.lightDay}</span>
            )}
            {liveNow.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">{liveNow.length}{t.home.liveCount}</span>
            )}
            {final.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-text-secondary/10 text-text-secondary">{final.length}{t.home.finalCount}</span>
            )}
          </div>
          {final.length > 0 && (() => {
            const totalPts = final.reduce((s, g) => s + g.homeTeam.score + g.awayTeam.score, 0);
            return (
              <p className="text-xs text-text-secondary mt-1">
                {t.home.totalPoints}<span className="font-bold text-accent">{totalPts}</span> {t.home.across} {final.length} {final.length !== 1 ? t.home.finishedGames : t.home.finishedGame}
              </p>
            );
          })()}
        </div>
      ) : null}

      {/* Game cards by status */}
      {games.length > 0 ? (
        <div className="space-y-6">
          {games.some((g) => g.gameId.startsWith("004")) && (
            <div className="bg-gradient-to-r from-accent/10 to-yellow-500/10 border border-accent/20 rounded-xl px-4 py-2 text-center">
              <span className="text-xs font-bold text-accent uppercase tracking-wide">{t.home.playoffGamesToday}</span>
            </div>
          )}
          {liveNow.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-success flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
                {t.home.liveNow}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveNow.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-text-secondary/50" />
                {t.common.upcoming}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </>
          )}
          {final.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-text-secondary/30" />
                {t.common.final}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {final.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </>
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
              <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 max-w-md text-center">
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
                <Link href={`/?date=${(() => { const d = new Date(); d.setDate(d.getDate() - 1); return formatDate(d); })()}`} className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.browseRecent}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.yesterdayResults}</span>
                </Link>
                <Link href="/standings" className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.checkStandings}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.conferenceRankings}</span>
                </Link>
                <Link href="/search" className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.findPlayer}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.findAnyPlayer}</span>
                </Link>
                <Link href="/injuries" className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">{t.home.injuryReport}</span>
                  <span className="text-[10px] text-text-secondary">{t.home.latestInjury}</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Day insights */}
      {dayInsights && (
        <div className="mt-6 bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">{t.home.dayInsights}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div>
              <p className="text-lg font-bold text-accent">{dayInsights.avgScore}</p>
              <p className="text-text-secondary">{t.home.avgTotalPts}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">{dayInsights.homeWins}-{dayInsights.awayWins}</p>
              <p className="text-text-secondary">{t.home.homeAway}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-500">{dayInsights.thrillers}</p>
              <p className="text-text-secondary">{t.home.thrillers}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-danger">{dayInsights.blowouts}</p>
              <p className="text-text-secondary">{t.home.blowouts}</p>
            </div>
          </div>
        </div>
      )}

      {isToday && <TodayStars />}
      <HomeExtra />
    </>
  );
}
