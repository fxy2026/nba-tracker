import 'server-only';
import type { ScheduleDate, ScheduleGame } from './api';
import { offsetCalendarDate } from './calendar-date';
import { fixtureDateInZone, type PlannedFixture } from './planned-fixtures';
import { getPlannedSeasonFixtures } from './planned-fixtures-server';
import { hasCanonicalSeasonCoverage, normalizeScheduleCoverage, type CanonicalScheduleCoverage } from './schedule-coverage';
import { homeDateUrl } from './date-navigation';
import { TEAM_META } from './teams';

export const SCHEDULE_TIME_ZONE = 'America/New_York';
export type ScheduleToolSource =
  | { mode: 'planned'; season: string; fixtures: readonly PlannedFixture[] }
  | { mode: 'canonical' | 'unavailable'; season: string; schedule: ScheduleDate[] };

export function scheduleDateET(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s00:00:00)?$/.exec(value);
  if (!match) return null;
  const [, month, day, year] = match;
  try { return offsetCalendarDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, 0); } catch { return null; }
}

function validUTC(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z');
}

/** Read-only consumer validation. No provider/cache changes or archive blending. */
export function selectScheduleToolSource(dates: ScheduleDate[], coverage: CanonicalScheduleCoverage | null, season: string): ScheduleToolSource {
  const safeDates = Array.isArray(dates) ? dates.filter(day => day && typeof day.gameDate === 'string' && Array.isArray(day.games)) : [];
  const canonical = hasCanonicalSeasonCoverage(safeDates, normalizeScheduleCoverage(coverage), season);
  const planned = getPlannedSeasonFixtures(season, safeDates, normalizeScheduleCoverage(coverage));
  if (planned) return { mode: 'planned', season, fixtures: planned };
  if (!canonical) return { mode: 'unavailable', season, schedule: [] };

  const unique = new Map<string, { date: string; game: ScheduleGame; signature: string }>();
  const conflicts = new Set<string>();
  for (const day of safeDates) {
    const date = scheduleDateET(day.gameDate);
    if (!date) continue;
    for (const game of day.games) {
      if (!game || !/^00[1-6]\d{7}$/.test(game.gameId) || game.gameId.slice(3, 5) !== season.slice(2, 4) || ![1, 2, 3].includes(game.gameStatus) || typeof game.gameStatusText !== 'string' || game.ifNecessary || /tbd|postpon|cancel/i.test(game.gameStatusText) || typeof game.gameDateTimeUTC !== 'string' || !validUTC(game.gameDateTimeUTC)) continue;
      // Heatmap includes official preseason/international and All-Star fixtures.
      // Competitive pairs stay bounded to known NBA teams; exhibitions never enter B2Bs.
      const exhibition = /^00[13]/.test(game.gameId);
      if (!game.homeTeam || !game.awayTeam || game.homeTeam.teamTricode === game.awayTeam.teamTricode || game.homeTeam.teamId === game.awayTeam.teamId || ![game.homeTeam, game.awayTeam].every(team => {
        const identity = typeof team.teamTricode === 'string' && (Object.hasOwn(TEAM_META, team.teamTricode)
          ? team.teamId === TEAM_META[team.teamTricode].teamId
          : exhibition && /^[A-Z0-9]{2,6}$/.test(team.teamTricode) && Number.isSafeInteger(team.teamId) && team.teamId > 0);
        return identity && Number.isInteger(team.score) && team.score >= 0;
      })) continue;
      // The grouped schedule date must agree with the explicit ET tipoff day.
      if (fixtureDateInZone(game.gameDateTimeUTC, SCHEDULE_TIME_ZONE) !== date || (game.gameStatus === 3 && !verifiedFinal(game))) continue;
      const signature = JSON.stringify([date, game.gameDateTimeUTC, game.gameStatus, game.homeTeam.teamTricode, game.awayTeam.teamTricode, game.homeTeam.score, game.awayTeam.score]);
      if (unique.has(game.gameId) && unique.get(game.gameId)!.signature !== signature) conflicts.add(game.gameId);
      unique.set(game.gameId, { date, game, signature });
    }
  }
  const byDate = new Map<string, ScheduleGame[]>();
  for (const [id, { date, game }] of unique) {
    if (conflicts.has(id)) continue;
    const games = byDate.get(date) ?? [];
    games.push(game); byDate.set(date, games);
  }
  const schedule = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, games]) => ({
    gameDate: `${date.slice(5, 7)}/${date.slice(8)}/${date.slice(0, 4)} 00:00:00`,
    games: games.sort((a, b) => a.gameDateTimeUTC.localeCompare(b.gameDateTimeUTC) || a.gameId.localeCompare(b.gameId)),
  }));
  return { mode: 'canonical', season, schedule };
}

export function verifiedFinal(game: ScheduleGame): boolean {
  return game.gameStatus === 3 && Number.isInteger(game.homeTeam.score) && Number.isInteger(game.awayTeam.score) && game.homeTeam.score >= 0 && game.awayTeam.score >= 0 && game.homeTeam.score !== game.awayTeam.score;
}

interface Appearance { key: string; date: string; opponent: string; href: string; won: boolean | null }
export interface BackToBackPair { team: string; teamId: number; nights: [Appearance, Appearance]; completed: boolean; upcoming: boolean }
export interface BackToBackTeam { team: string; teamId: number; total: number; completed: number; upcoming: number; unresolved: number; wins: number; verifiedGames: number }

export function buildBackToBacks(source: ScheduleToolSource, now = new Date()) {
  const today = fixtureDateInZone(now.toISOString(), SCHEDULE_TIME_ZONE);
  const appearances = new Map<string, Appearance[]>();
  const add = (team: string, appearance: Appearance) => {
    const list = appearances.get(team) ?? []; list.push(appearance); appearances.set(team, list);
  };
  if (source.mode === 'planned') {
    for (const fixture of source.fixtures) {
      for (const [team, opponent] of [[fixture.homeTricode, fixture.awayTricode], [fixture.awayTricode, fixture.homeTricode]]) {
        add(team, { key: fixture.key, date: fixture.dateET, opponent, href: homeDateUrl(fixture.dateET, SCHEDULE_TIME_ZONE), won: null });
      }
    }
  } else {
    for (const day of source.schedule) {
      const date = scheduleDateET(day.gameDate)!;
      for (const game of day.games) {
        // Keep regular season, playoffs, play-in and Cup; exclude exhibitions/all-star.
        if (!/^00[2456]/.test(game.gameId)) continue;
        for (const [team, opponent] of [[game.homeTeam, game.awayTeam], [game.awayTeam, game.homeTeam]]) {
          add(team.teamTricode, { key: game.gameId, date, opponent: opponent.teamTricode, href: `/game/${game.gameId}`, won: verifiedFinal(game) ? team.score > opponent.score : null });
        }
      }
    }
  }
  const pairs: BackToBackPair[] = [];
  const totals: BackToBackTeam[] = [];
  for (const meta of Object.values(TEAM_META)) {
    const apps = [...new Map((appearances.get(meta.tricode) ?? []).map(app => [app.key, app])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
    const teamPairs: BackToBackPair[] = [];
    const outcomes = new Map<string, boolean>();
    // Group dates so duplicate rows never hide a valid adjacent calendar date.
    const byDate = new Map<string, Appearance[]>();
    for (const app of apps) { const list = byDate.get(app.date) ?? []; list.push(app); byDate.set(app.date, list); }
    for (const [date, first] of byDate) {
      const second = byDate.get(offsetCalendarDate(date, 1));
      // More than one listed game for a team/day is ambiguous; do not invent pairs.
      if (first.length !== 1 || second?.length !== 1) continue;
      const nights: [Appearance, Appearance] = [first[0], second[0]];
      const completed = nights.every(night => night.won !== null);
      const pair = { team: meta.tricode, teamId: meta.teamId, nights, completed, upcoming: !completed && nights[1].date >= today };
      teamPairs.push(pair); pairs.push(pair);
      for (const night of nights) if (night.won !== null) outcomes.set(night.key, night.won);
    }
    const completed = teamPairs.filter(pair => pair.completed).length;
    const upcoming = teamPairs.filter(pair => pair.upcoming).length;
    totals.push({ team: meta.tricode, teamId: meta.teamId, total: teamPairs.length, completed, upcoming, unresolved: teamPairs.length - completed - upcoming, wins: [...outcomes.values()].filter(Boolean).length, verifiedGames: outcomes.size });
  }
  pairs.sort((a, b) => a.nights[0].date.localeCompare(b.nights[0].date) || a.team.localeCompare(b.team));
  const upcoming = pairs.filter(pair => pair.upcoming);
  return { pairs, totals, totalPairs: pairs.length, completedCount: pairs.filter(pair => pair.completed).length, upcomingCount: upcoming.length, unresolvedCount: pairs.filter(pair => !pair.completed && !pair.upcoming).length, visibleUpcoming: upcoming.slice(0, 15), today };
}
