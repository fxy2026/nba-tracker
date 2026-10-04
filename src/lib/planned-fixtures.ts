import { createZonedCalendarDate } from "./zoned-calendar-date";
import { offsetCalendarDate } from './calendar-date';
import { TEAM_META } from './teams';

// Client-safe contracts only. The complete snapshot is imported exclusively by the server loader.
export const PLANNED_SNAPSHOT_DATE = '2026-08-13';
export const PLANNED_SEASON = '2026-27';
export const PLANNED_SOURCE_URL = 'https://cdn.nba.com/manage/2026/08/2026-27-NBA-Regular-Season-Schedule-By-Date.pdf';
export interface PlannedFixture {
  key: string; // source-scoped identity; NEVER an NBA game ID
  officialGameId: null;
  currentStatus: null;
  scores: null;
  tipoffUTC: string;
  dateET: string;
  timeET: string;
  awayTricode: string;
  homeTricode: string;
  relationship: 'at' | 'vs';
  venue: { name: string; city: string } | null;
  sourceNumber: number;
  sourcePages: { byDate: number; awayTeam: number; homeTeam: number };
}
export type PlannedFixtureQuery = { timeZone: string; team?: string } & (
  { mode: 'day'; date: string } | { mode: 'month'; month: string } | { mode: 'upcoming'; from: string; limit: number }
);
export interface PlannedFixtureView {
  state: 'snapshot' | 'canonical' | 'outside-snapshot';
  snapshotDate: typeof PLANNED_SNAPSHOT_DATE;
  season: typeof PLANNED_SEASON;
  timeZone: string;
  fixtures: PlannedFixture[];
  nextAvailableDate: string | null;
}
export function validCalendarDate(value: string): boolean {
  try { offsetCalendarDate(value, 0); return true; } catch { return false; }
}
export function validTimeZone(value: string): boolean {
  if (!value || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}
export function parsePlannedFixtureQuery(params: URLSearchParams): PlannedFixtureQuery | null {
  const allowed = new Set(['date', 'month', 'from', 'limit', 'team', 'tz']);
  if ([...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1)) return null;
  const timeZone = params.get('tz') ?? 'America/New_York';
  const team = params.get('team') ?? undefined;
  if (!validTimeZone(timeZone) || (team !== undefined && !Object.hasOwn(TEAM_META, team))) return null;
  const selectors = ['date', 'month', 'from'].filter(key => params.has(key));
  if (selectors.length !== 1) return null;
  const base = { timeZone, ...(team ? { team } : {}) };
  if (selectors[0] === 'date') {
    const date = params.get('date')!;
    return validCalendarDate(date) && !params.has('limit') ? { ...base, mode: 'day', date } : null;
  }
  if (selectors[0] === 'month') {
    const month = params.get('month')!;
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && validCalendarDate(`${month}-01`) && !params.has('limit') ? { ...base, mode: 'month', month } : null;
  }
  const from = params.get('from')!;
  const rawLimit = params.get('limit') ?? '8';
  const limit = Number(rawLimit);
  return validCalendarDate(from) && /^\d{1,2}$/.test(rawLimit) && limit >= 1 && limit <= 20 ? { ...base, mode: 'upcoming', from, limit } : null;
}
export function fixtureDateInZone(utc: string, timeZone: string): string {
  return createZonedCalendarDate(timeZone)(utc);
}
/** Reject corrupt or wrongly scoped responses before putting them in a client view. */
export function normalizePlannedFixtureView(value: unknown, query: PlannedFixtureQuery): PlannedFixtureView | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as PlannedFixtureView;
  if (!['snapshot', 'canonical', 'outside-snapshot'].includes(v.state) || v.snapshotDate !== PLANNED_SNAPSHOT_DATE || v.season !== PLANNED_SEASON || v.timeZone !== query.timeZone || !Array.isArray(v.fixtures)) return null;
  const maximum = query.mode === 'upcoming' ? query.limit : query.mode === 'day' ? 15 : 250;
  const keys = new Set<string>();
  const localDate = createZonedCalendarDate(query.timeZone);
  if (v.fixtures.length > maximum || (v.state !== 'snapshot' && (v.fixtures.length || v.nextAvailableDate !== null))) return null;
  for (const f of v.fixtures) {
    if (!f || !['at', 'vs'].includes(f.relationship) || (f.venue !== null && (!f.venue || typeof f.venue.name !== 'string' || typeof f.venue.city !== 'string')) || f.officialGameId !== null || f.currentStatus !== null || f.scores !== null || !Number.isInteger(f.sourceNumber) || f.sourceNumber < 1 || f.sourceNumber > 1200 || f.key !== `nba-pdf:2026-08-13:by-date:${f.sourceNumber}` || keys.has(f.key) || !Object.hasOwn(TEAM_META, f.awayTricode) || !Object.hasOwn(TEAM_META, f.homeTricode) || f.homeTricode === f.awayTricode || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(f.tipoffUTC) || !Number.isFinite(Date.parse(f.tipoffUTC))) return null;
    const date = localDate(f.tipoffUTC);
    if ((query.mode === 'day' && date !== query.date) || (query.mode === 'month' && !date.startsWith(query.month + '-')) || (query.mode === 'upcoming' && date < query.from) || (query.team && f.awayTricode !== query.team && f.homeTricode !== query.team)) return null;
    keys.add(f.key);
  }
  if (v.nextAvailableDate !== null && (typeof v.nextAvailableDate !== 'string' || !validCalendarDate(v.nextAvailableDate))) return null;
  return v;
}
