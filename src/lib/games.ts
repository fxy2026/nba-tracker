import type { ScheduleDate, ScheduleGame } from "@/lib/nba-contracts";
import archiveGameSeasons from "@/data/archive-game-seasons.json";

/** A merged schedule includes archived years. Scope season analytics by the
 * NBA game ID's start-year digits, not the calendar year (Jan-June belong to
 * the preceding start year). Keep the original archive untouched. */
export function scheduleForSeason(schedule: ScheduleDate[], season: string): ScheduleDate[] {
  if (!/^\d{4}-\d{2}$/.test(season)) return [];
  return scheduleForSeasonKey(schedule, season.slice(2, 4));
}

/** Canonical NBA IDs encode the start-year key. The small provenance map
 * preserves known synthetic archive IDs without guessing from arbitrary IDs,
 * dates, or adding the full archive to this shared client-side utility. */
export function gameSeasonKey(gameId: string): string | null {
  if (/^00[1-6]\d{7}$/.test(gameId)) return gameId.slice(3, 5);
  if (!Object.prototype.hasOwnProperty.call(archiveGameSeasons, gameId)) return null;
  const season = (archiveGameSeasons as Record<string, string>)[gameId];
  return season?.slice(2, 4) ?? null;
}

/** Game detail views follow the requested game's season, even in the archive. */
export function scheduleForGameSeason(schedule: ScheduleDate[], gameId: string): ScheduleDate[] {
  const year = gameSeasonKey(gameId);
  return year === null ? [] : scheduleForSeasonKey(schedule, year);
}

function scheduleForSeasonKey(schedule: ScheduleDate[], year: string): ScheduleDate[] {
  return schedule
    .map((date) => ({
      ...date,
      games: date.games.filter((game) =>
        gameSeasonKey(game.gameId) === year
      ),
    }))
    .filter((date) => date.games.length > 0);
}

// gameId prefix predicates — the NBA encodes game type in the leading digits.
// 001 = preseason, 002 = regular season, 003 = all-star, 004 = playoffs,
// 005 = play-in, 006 = NBA Cup final; 13/14/15/16 = Summer League slates.
export function isPreseason(gameId: string): boolean { return gameId.startsWith("001"); }
export function isRegular(gameId: string): boolean { return gameId.startsWith("002"); }
export function isAllStar(gameId: string): boolean { return gameId.startsWith("003"); }
export function isPlayoff(gameId: string): boolean { return gameId.startsWith("004"); }
export function isPlayIn(gameId: string): boolean { return gameId.startsWith("005"); }
export function isCup(gameId: string): boolean { return gameId.startsWith("006"); }
export function isSummerLeague(gameId: string): boolean {
  const p = gameId.slice(0, 2);
  return p === "13" || p === "14" || p === "15" || p === "16";
}
// Allowlist, not denylist: only games that count toward standings/form. Anything
// not explicitly regular/playoff/play-in (preseason, all-star, Cup, Summer League)
// is excluded, so unseen future prefixes never leak into counted consumers.
export function isCountedSeason(gameId: string): boolean {
  return isRegular(gameId) || isPlayoff(gameId) || isPlayIn(gameId);
}

export function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  return total > 0 ? wins / total : 0;
}

// Schedule dates use "MM/DD/YYYY hh:mm:ss" — normalize to "YYYY-MM-DD"
function isoFromScheduleDate(gameDate: string): string {
  const [month, day, year] = gameDate.split(" ")[0].split("/");
  return `${year}-${month}-${day}`;
}

/** Look a game up in the cached schedule by its gameId. */
export function findScheduleGame(schedule: ScheduleDate[], gameId: string): ScheduleGame | null {
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameId === gameId) return g;
    }
  }
  return null;
}

export interface SeriesGame {
  gameId: string;
  date: string; // YYYY-MM-DD
  homeTricode: string;
  awayTricode: string;
  homeScore: number;
  awayScore: number;
}

export interface SeasonSeries {
  /** Finished meetings, most recent first. */
  games: SeriesGame[];
  /** Wins keyed by tricode (both teams always present). */
  wins: Record<string, number>;
}

/** Season series between two teams (finished games, preseason excluded) — same
 *  filtering the /h2h page applies, packaged for reuse on game previews. */
export function getSeasonSeries(schedule: ScheduleDate[], t1: string, t2: string): SeasonSeries {
  const games: SeriesGame[] = [];
  const wins: Record<string, number> = { [t1]: 0, [t2]: 0 };
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (isPreseason(g.gameId)) continue;
      const ht = g.homeTeam.teamTricode;
      const at = g.awayTeam.teamTricode;
      const isMatch = (ht === t1 && at === t2) || (ht === t2 && at === t1);
      if (!isMatch) continue;
      games.push({
        gameId: g.gameId,
        date: isoFromScheduleDate(gd.gameDate),
        homeTricode: ht,
        awayTricode: at,
        homeScore: g.homeTeam.score,
        awayScore: g.awayTeam.score,
      });
      const winner = g.homeTeam.score > g.awayTeam.score ? ht : at;
      wins[winner] = (wins[winner] || 0) + 1;
    }
  }
  games.sort((a, b) => b.date.localeCompare(a.date));
  return { games, wins };
}

export interface TeamFormGame {
  gameId: string;
  date: string; // YYYY-MM-DD
  won: boolean;
  home: boolean;
  opponent: string; // tricode
  teamScore: number;
  oppScore: number;
}

/** Last N finished games for a team (exhibitions excluded), most recent first. */
export function getRecentForm(schedule: ScheduleDate[], tricode: string, n = 5): TeamFormGame[] {
  const results: (TeamFormGame & { utc: string })[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isCountedSeason(g.gameId)) continue;
      const isHome = g.homeTeam.teamTricode === tricode;
      const isAway = g.awayTeam.teamTricode === tricode;
      if (!isHome && !isAway) continue;
      const team = isHome ? g.homeTeam : g.awayTeam;
      const opp = isHome ? g.awayTeam : g.homeTeam;
      results.push({
        gameId: g.gameId,
        date: isoFromScheduleDate(gd.gameDate),
        won: team.score > opp.score,
        home: isHome,
        opponent: opp.teamTricode,
        teamScore: team.score,
        oppScore: opp.score,
        utc: g.gameDateTimeUTC,
      });
    }
  }
  results.sort((a, b) => b.utc.localeCompare(a.utc));
  return results.slice(0, n).map((r) => ({
    gameId: r.gameId,
    date: r.date,
    won: r.won,
    home: r.home,
    opponent: r.opponent,
    teamScore: r.teamScore,
    oppScore: r.oppScore,
  }));
}
