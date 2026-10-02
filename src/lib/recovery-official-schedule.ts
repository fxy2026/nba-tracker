import { TEAM_META } from './teams';

export const OFFICIAL_RECOVERY_SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
export const OFFICIAL_SCHEDULE_MAX_AGE_MS = 86_400_000;
export interface OfficialScheduleSource {
  url: typeof OFFICIAL_RECOVERY_SCHEDULE_URL;
  sha256: string;
  /** Time the bytes were observed, not an upstream publication timestamp. */
  observedAt: string;
}
export interface OfficialFinishedGame {
  nbaGameId: string;
  season: string;
  phase: 'regular' | 'playoffs' | 'play-in';
  gameCode: string;
  gameDate: string;
  gameDateTimeUTC: string;
  utcDate: string;
  lookupDates: string[];
  home: { teamId: number; tricode: string; score: number };
  away: { teamId: number; tricode: string; score: number };
}
export type OfficialScheduleFailureStatus = 'missing' | 'unavailable' | 'malformed' | 'stale' | 'wrong-season';
export type OfficialScheduleResult =
  | { status: 'ready' | 'empty'; season: string; games: OfficialFinishedGame[]; source: OfficialScheduleSource }
  | { status: OfficialScheduleFailureStatus; reason: string; source?: OfficialScheduleSource; returnedSeason?: string; httpStatus?: number }
  | { status: 'not-requested'; reason: 'mode-excluded' };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  && Reflect.ownKeys(v).every(k => typeof k === 'string' && 'value' in Object.getOwnPropertyDescriptor(v, k)!);
function array(v: unknown, max: number): v is unknown[] {
  return Array.isArray(v) && Object.getPrototypeOf(v) === Array.prototype && v.length <= max
    && Reflect.ownKeys(v).length === v.length + 1
    && Array.from({ length: v.length }, (_, i) => Object.getOwnPropertyDescriptor(v, String(i))).every(d => !!d && 'value' in d);
}
export function officialScheduleSeasonYear(season: unknown): number | null {
  if (typeof season !== 'string' || !/^20\d{2}-\d{2}$/.test(season)) return null;
  const year = Number(season.slice(0, 4));
  return year <= 2098 && season.slice(5) === String((year + 1) % 100).padStart(2, '0') ? year : null;
}
function timestamp(v: unknown): number | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)) return null;
  const n = Date.parse(v);
  return Number.isFinite(n) && new Date(n).toISOString().replace('.000Z', 'Z') === v.replace('.000Z', 'Z') ? n : null;
}
function calendarDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
function team(v: unknown): OfficialFinishedGame['home'] | null {
  if (!object(v) || typeof v.teamTricode !== 'string' || !Object.hasOwn(TEAM_META, v.teamTricode)
    || v.teamId !== TEAM_META[v.teamTricode].teamId || typeof v.score !== 'number' || !Number.isSafeInteger(v.score) || v.score < 0) return null;
  return { teamId: v.teamId as number, tricode: v.teamTricode, score: v.score };
}
function phase(id: string): OfficialFinishedGame['phase'] | null {
  if (id.startsWith('002')) return Number(id.slice(5)) > 0 ? 'regular' : null;
  if (id.startsWith('005')) return /^005\d{2}00(?:1[0-3]|2[01])1$/.test(id) ? 'play-in' : null;
  if (!/^004\d{2}00[1-4][0-7][1-7]$/.test(id)) return null;
  return Number(id[8]) < 2 ** (4 - Number(id[7])) ? 'playoffs' : null;
}

/** Pure identity projection. Missing/invalid finals never become a successful
 * empty feed; excluded phases and unfinished/future games cannot be targets.
 * No archive fallback or inference of provider membership/availability. */
export function projectOfficialRecoverySchedule(raw: unknown, context: {
  expectedSeason: string; now: string; source: OfficialScheduleSource;
}): OfficialScheduleResult {
  const fail = (status: OfficialScheduleFailureStatus, reason: string): OfficialScheduleResult => ({ status, reason });
  try {
    const year = officialScheduleSeasonYear(context.expectedSeason), now = timestamp(context.now);
    if (!object(context.source) || context.source.url !== OFFICIAL_RECOVERY_SCHEDULE_URL
      || typeof context.source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(context.source.sha256)) return fail('malformed', 'invalid-source-context');
    const observed = timestamp(context.source.observedAt);
    if (year === null || now === null || observed === null || observed > now) return fail('malformed', 'invalid-observation-context');
    const source: OfficialScheduleSource = { url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: context.source.sha256, observedAt: context.source.observedAt };
    if (now - observed > OFFICIAL_SCHEDULE_MAX_AGE_MS) return { status: 'stale', reason: 'observation-expired', source };
    if (raw == null) return { status: 'missing', reason: 'missing-envelope', source };
    if (!object(raw)) return { status: 'malformed', reason: 'invalid-envelope', source };
    if (raw.leagueSchedule == null) return { status: 'missing', reason: 'missing-league-schedule', source };
    if (!object(raw.leagueSchedule)) return { status: 'malformed', reason: 'invalid-league-schedule', source };
    const schedule = raw.leagueSchedule;
    if (officialScheduleSeasonYear(schedule.seasonYear) === null) return { status: 'malformed', reason: 'invalid-season-binding', source };
    if (schedule.seasonYear !== context.expectedSeason) return { status: 'wrong-season', reason: 'season-binding-mismatch', returnedSeason: schedule.seasonYear as string, source };
    if (!array(schedule.gameDates, 400)) return { status: 'malformed', reason: 'invalid-date-array', source };
    const games: OfficialFinishedGame[] = [], seen = new Set<string>(), identities = new Set<string>(), codes = new Set<string>();
    let total = 0;
    for (const day of schedule.gameDates) {
      if (!object(day) || !array(day.games, 100)) return { status: 'malformed', reason: 'invalid-day-games', source };
      total += day.games.length;
      if (total > 2_000) return { status: 'malformed', reason: 'too-many-games', source };
      for (const game of day.games) {
        if (!object(game) || typeof game.gameId !== 'string' || !/^00[1-6]\d{7}$/.test(game.gameId)) return { status: 'malformed', reason: 'invalid-game-id', source };
        if (game.gameId.slice(3, 5) !== context.expectedSeason.slice(2, 4)) return { status: 'wrong-season', reason: 'game-id-season-mismatch', source };
        if (seen.has(game.gameId)) return { status: 'malformed', reason: 'duplicate-game-id', source };
        seen.add(game.gameId);
        if (/^00[136]/.test(game.gameId)) continue;
        if (![1, 2, 3].includes(game.gameStatus as number)) return { status: 'malformed', reason: 'invalid-game-status', source };
        if (game.gameStatus !== 3) continue;
        const gamePhase = phase(game.gameId), tipoff = timestamp(game.gameDateTimeUTC);
        if (!gamePhase || tipoff === null || typeof game.gameCode !== 'string' || !/^\d{8}\/[A-Z]{6}$/.test(game.gameCode)) return { status: 'malformed', reason: 'invalid-final-identity', source };
        const stamp = game.gameCode.slice(0, 8), gameDate = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
        const utcDate = (game.gameDateTimeUTC as string).slice(0, 10);
        if (!calendarDate(gameDate) || ![year, year + 1].includes(Number(gameDate.slice(0, 4)))
          || ![year, year + 1].includes(Number(utcDate.slice(0, 4))) || Math.abs(Date.parse(utcDate) - Date.parse(gameDate)) > 86_400_000) return { status: 'malformed', reason: 'invalid-final-date', source };
        if (tipoff > now) continue;
        const home = team(game.homeTeam), away = team(game.awayTeam);
        if (!home || !away || home.teamId === away.teamId || home.score === away.score
          || game.gameCode.slice(9) !== `${away.tricode}${home.tricode}`) return { status: 'malformed', reason: 'invalid-final-teams-or-scores', source };
        const lookupDates = [...new Set([gameDate, utcDate])];
        // Reject competing official identities and ambiguous provider lookup
        // tuples, while preserving distinct games on consecutive dates.
        const keys = lookupDates.map(date => `${date}|${home.tricode}|${away.tricode}|${home.score}|${away.score}`);
        if (codes.has(game.gameCode) || keys.some(key => identities.has(key))) return { status: 'malformed', reason: 'conflicting-game-identity', source };
        codes.add(game.gameCode);
        keys.forEach(key => identities.add(key));
        games.push({ nbaGameId: game.gameId, season: context.expectedSeason, phase: gamePhase, gameCode: game.gameCode,
          gameDate, gameDateTimeUTC: game.gameDateTimeUTC as string, utcDate, lookupDates, home, away });
      }
    }
    return { status: games.length ? 'ready' : 'empty', season: context.expectedSeason, games, source };
  } catch { return fail('malformed', 'invalid-json-data'); }
}
