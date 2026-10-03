import 'server-only';
import snapshot from '@/data/planned-fixtures-2026-27.json';
import type { ScheduleDate } from './api';
import { hasCanonicalSeasonCoverage, type CanonicalScheduleCoverage } from './schedule-coverage';
import { fixtureDateInZone, PLANNED_SEASON, PLANNED_SNAPSHOT_DATE, type PlannedFixture, type PlannedFixtureQuery, type PlannedFixtureView } from './planned-fixtures';

// Array encoding keeps the verified facts small (~120 KB), without raw PDF metadata.
// [source number, UTC, ET date, ET time, away, home, date page, away page,
//  home page, local clock text, source relationship, reconciled Cup flag, venue note]
type Row = [number, string, string, string, string, string, number, number, number, string, 'at' | 'vs', boolean | null, [string, string] | null];
export const PLANNED_FIXTURE_PROVENANCE = snapshot.metadata;
const fixtures: readonly PlannedFixture[] = Object.freeze((snapshot.rows as Row[]).map(row => Object.freeze({
  key: `nba-pdf:2026-08-13:by-date:${row[0]}`, officialGameId: null, currentStatus: null, scores: null,
  sourceNumber: row[0], tipoffUTC: row[1], dateET: row[2], timeET: row[3], awayTricode: row[4], homeTricode: row[5],
  relationship: row[10], venue: row[12] ? Object.freeze({ name: row[12][0], city: row[12][1] }) : null,
  sourcePages: Object.freeze({ byDate: row[6], awayTeam: row[7], homeTeam: row[8] }),
})).sort((a, b) => a.tipoffUTC.localeCompare(b.tipoffUTC)));

export function getPlannedFixtureView(query: PlannedFixtureQuery, dates: ScheduleDate[], coverage: CanonicalScheduleCoverage | null, canonicalDayAvailable = false, canonicalDatesET: string[] = []): PlannedFixtureView {
  const base: Omit<PlannedFixtureView, 'state'> = { snapshotDate: PLANNED_SNAPSHOT_DATE, season: PLANNED_SEASON, timeZone: query.timeZone, fixtures: [], nextAvailableDate: null };
  if (canonicalDayAvailable || hasCanonicalSeasonCoverage(dates, coverage, PLANNED_SEASON)) return { ...base, state: 'canonical' };
  const start = query.mode === 'day' ? query.date : query.mode === 'month' ? `${query.month}-01` : query.from;
  // October can lead users to opening night. This snapshot says nothing about
  // preseason, dates after the regular season, or a subsequent season.
  if (start < '2026-10-01' || start > '2027-04-12') return { ...base, state: 'outside-snapshot' };
  const scoped = fixtures.filter(f => !canonicalDatesET.includes(f.dateET) && (!query.team || f.awayTricode === query.team || f.homeTricode === query.team))
    .map(f => ({ fixture: f, date: fixtureDateInZone(f.tipoffUTC, query.timeZone) }));
  const selected = scoped.filter(({ date }) => query.mode === 'day' ? date === query.date : query.mode === 'month' ? date.startsWith(query.month + '-') : date >= query.from);
  const limited = query.mode === 'upcoming' ? selected.slice(0, query.limit) : selected;
  const nextAvailableDate = limited.length === 0 ? scoped.find(({ date }) => date > start)?.date ?? null : null;
  return { ...base, state: 'snapshot', fixtures: limited.map(({ fixture }) => fixture), nextAvailableDate };
}
