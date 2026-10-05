import type { ScheduleDate } from './nba-contracts';
import { TEAM_META } from './teams';

/** Coverage belongs to a particular immutable schedule array, never a cache-load timestamp. */
export interface CanonicalScheduleCoverage {
  source: 'nba-schedule';
  season: string;
}
export function normalizeScheduleCoverage(value: unknown): CanonicalScheduleCoverage | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.source !== 'nba-schedule' || typeof v.season !== 'string' || !/^20\d{2}-\d{2}$/.test(v.season)) return null;
  const year = Number(v.season.slice(0, 4));
  return v.season === `${year}-${String((year + 1) % 100).padStart(2, '0')}` ? { source: 'nba-schedule', season: v.season } : null;
}
/** Enough structure to preserve the existing schedule projection, without yet
 * asserting whole-season availability. Empty dated rows alone do not prove that. */
export function validOfficialScheduleEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const league = (value as Record<string, unknown>).leagueSchedule;
  if (!league || typeof league !== 'object') return false;
  const { seasonYear, gameDates } = league as Record<string, unknown>;
  if (!normalizeScheduleCoverage({ source: 'nba-schedule', season: seasonYear }) || !Array.isArray(gameDates) || !gameDates.every(day => {
    if (!day || typeof day !== 'object' || typeof day.gameDate !== 'string' || !/^\d{2}\/\d{2}\/\d{4} 00:00:00$/.test(day.gameDate) || !Array.isArray(day.games)) return false;
    const [month, date, year] = day.gameDate.slice(0, 10).split('/');
    const iso = `${year}-${month}-${date}`;
    if (!Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) return false;
    return day.games.every((game: Record<string, unknown>) => game && typeof game.gameId === 'string' && /^\d{10}$/.test(game.gameId) && game.homeTeam && game.awayTeam);
  })) return false;
  return true;
}
function canonicalGameForSeason(value: unknown, season: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const game = value as Record<string, unknown>;
  if (typeof game.gameId !== 'string' || !/^00[1-6]\d{7}$/.test(game.gameId) || game.gameId.slice(3, 5) !== season.slice(2, 4) || ![1, 2, 3].includes(game.gameStatus as number) || typeof game.gameStatusText !== 'string' || typeof game.gameDateTimeUTC !== 'string' || !/Z$/.test(game.gameDateTimeUTC) || !Number.isFinite(Date.parse(game.gameDateTimeUTC))) return false;
  const home = game.homeTeam as Record<string, unknown> | null;
  const away = game.awayTeam as Record<string, unknown> | null;
  return !!home && !!away && home.teamTricode !== away.teamTricode && [home, away].every(team =>
    typeof team.teamTricode === 'string' && Object.hasOwn(TEAM_META, team.teamTricode) && team.teamId === TEAM_META[team.teamTricode].teamId && typeof team.score === 'number' && Number.isFinite(team.score) && team.score >= 0);
}
/** Empty/malformed whole-season responses (including a list of empty days) do
 * not prove season coverage. Require actual canonical games in the stated season. */
export function coverageFromOfficialSchedule(value: unknown): CanonicalScheduleCoverage | null {
  if (!validOfficialScheduleEnvelope(value)) return null;
  const league = (value as { leagueSchedule: { seasonYear: string; gameDates: ScheduleDate[] } }).leagueSchedule;
  const coverage = normalizeScheduleCoverage({ source: 'nba-schedule', season: league.seasonYear })!;
  return league.gameDates.some(day => day.games.some(game => canonicalGameForSeason(game, coverage.season))) ? coverage : null;
}
/** Current canonical season facts win even without legacy projection metadata.
 * A minimal object containing only an ID is not enough to claim that coverage. */
export function hasCanonicalSeasonCoverage(dates: ScheduleDate[], coverage: CanonicalScheduleCoverage | null, season: string): boolean {
  if (coverage?.season === season) return true;
  return dates.some(day => day.games.some(game => canonicalGameForSeason(game, season)));
}
