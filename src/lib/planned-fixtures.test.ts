import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
import snapshot from '@/data/planned-fixtures-2026-27.json';
import { getPlannedFixtureView, PLANNED_FIXTURE_PROVENANCE } from './planned-fixtures-server';
import { fixtureDateInZone, normalizePlannedFixtureView, parsePlannedFixtureQuery, type PlannedFixtureQuery } from './planned-fixtures';
import { coverageFromOfficialSchedule, hasCanonicalSeasonCoverage } from './schedule-coverage';
import { TEAM_META } from './teams';
import type { ScheduleDate } from './api';
const monthQuery = (month: string, timeZone = 'America/New_York'): PlannedFixtureQuery => ({ mode: 'month', month, timeZone });
const view = (query: PlannedFixtureQuery) => getPlannedFixtureView(query, [], null);
const canonicalGame = { gameId: '0022600001', gameStatus: 1, gameStatusText: 'Scheduled', gameDateTimeUTC: '2026-10-22T23:00:00Z', homeTeam: { teamTricode: 'DET', teamId: 1610612765, score: 0 }, awayTeam: { teamTricode: 'BOS', teamId: 1610612738, score: 0 } };

describe('verified snapshot integrity', () => {
  it('contains exactly 1200 unique references, 30×80 appearances and no invented slots', () => {
    expect(snapshot.rows).toHaveLength(1200);
    expect([...new Set(snapshot.rows.map(row => row[0]))].sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 1200 }, (_, i) => i + 1));
    const appearances: Record<string, number[]> = {};
    const teamDays = new Set<string>();
    for (const row of snapshot.rows) {
      const [ref, utc, date, time, away, home, page, awayPage, homePage] = row;
      expect(away).not.toBe(home);
      for (const [side, code] of [away, home].entries()) {
        expect(TEAM_META[String(code)]).toBeDefined();
        appearances[String(code)] ??= [0, 0]; appearances[String(code)][side]++;
        const key = `${date}:${code}`; expect(teamDays.has(key)).toBe(false); teamDays.add(key);
      }
      expect(Number(page)).toBeGreaterThan(0); expect(Number(page)).toBeLessThanOrEqual(23);
      for (const p of [awayPage, homePage]) { expect(Number(p)).toBeGreaterThan(0); expect(Number(p)).toBeLessThanOrEqual(30); }
      expect(fixtureDateInZone(String(utc), 'America/New_York')).toBe(date);
      expect(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(String(utc)))).toBe(time);
      expect(ref).not.toBeNull();
    }
    expect(Object.keys(appearances)).toHaveLength(30);
    expect(Object.values(appearances).every(counts => counts[0] === 40 && counts[1] === 40)).toBe(true);
    expect(snapshot.metadata.unassignedTeamAppearances).toBe(60);
  });
  it('retains only compact public provenance, exact hashes, both page references and isolated Cup conflicts', () => {
    expect(PLANNED_FIXTURE_PROVENANCE.snapshotDate).toBe('2026-08-13');
    expect(PLANNED_FIXTURE_PROVENANCE.sources.map(source => source.sha256)).toEqual(['5e82e37ef1b19e226dee57be69958b95b5694516280d3034aa7c1d64292b3570', '10a2b81388dcf79011b5405c43966446f5c3e4c35a0034f115c4cf124379bec3']);
    expect(snapshot.rows.filter(row => row[11] === true)).toHaveLength(59);
    expect(snapshot.rows.filter(row => row[11] === null).map(row => row[0]).sort()).toEqual([208, 50]);
    expect(snapshot.metadata.cupConflicts).toHaveLength(2);
    expect(snapshot.rows.filter(row => row[12] !== null)).toHaveLength(6);
    const raw = readFileSync('src/data/planned-fixtures-2026-27.json', 'utf8');
    expect(Buffer.byteLength(raw)).toBeLessThan(125000);
    expect(raw).not.toMatch(/MSIP|Author|ETag|\/workspace\/|extracted_line|retrieved|http_last_modified/);
  });
  it.each([
    ['America/New_York', [88, 215, 172, 236, 169, 232, 88]],
    ['Asia/Shanghai', [81, 215, 170, 237, 168, 231, 98]],
  ])('round-trips the complete 1200-fixture month partition in %s', (timeZone, expected) => {
    const months = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'];
    const results = months.map(month => view(monthQuery(month, timeZone)));
    expect(results.map(result => result.fixtures.length)).toEqual(expected);
    const all = results.flatMap(result => result.fixtures);
    expect(all).toHaveLength(1200); expect(new Set(all.map(f => f.key)).size).toBe(1200);
    expect(all.every(f => f.officialGameId === null && f.currentStatus === null && f.scores === null)).toBe(true);
    for (let i = 0; i < results.length; i++) expect(normalizePlannedFixtureView(results[i], monthQuery(months[i], timeZone))).toEqual(results[i]);
  });
  it.each([[147, '2026-10-31T19:00:00Z'], [154, '2026-11-01T20:30:00Z'], [968, '2027-03-13T20:00:00Z'], [976, '2027-03-14T16:00:00Z']])('uses the correct seasonal ET offset for source %s', (ref, utc) => expect(snapshot.rows.find(row => row[0] === ref)?.[1]).toBe(utc));
  it('returns a timezone-correct next published date without inventing preseason', () => {
    for (const [timeZone, next] of [['America/New_York', '2026-10-20'], ['Asia/Shanghai', '2026-10-21']]) {
      const result = view({ mode: 'day', date: '2026-10-03', timeZone });
      expect(result.fixtures).toEqual([]); expect(result.nextAvailableDate).toBe(next);
    }
  });
});

describe('source precedence and isolation', () => {
  it('keeps unavailable/malformed/empty-whole-season distinct from a covered empty day', () => {
    for (const data of [{}, { leagueSchedule: {} }, { leagueSchedule: { seasonYear: '2026-27', gameDates: [] } }, { leagueSchedule: { seasonYear: '2026-27', gameDates: [{ gameDate: '02/30/2027 00:00:00', games: [] }] } }]) expect(coverageFromOfficialSchedule(data)).toBeNull();
    const coverage = coverageFromOfficialSchedule({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ gameDate: '10/22/2026 00:00:00', games: [canonicalGame] }] } });
    expect(coverage).toEqual({ source: 'nba-schedule', season: '2026-27' });
    expect(view(monthQuery('2026-10')).fixtures.length).toBe(88);
    expect(getPlannedFixtureView(monthQuery('2026-10'), [], coverage)).toMatchObject({ state: 'canonical', fixtures: [], nextAvailableDate: null });
  });
  it('always defers to canonical season data, including empty selected dates and legacy projected records', () => {
    const dates = [{ gameDate: '', games: [canonicalGame] }] as unknown as ScheduleDate[];
    expect(hasCanonicalSeasonCoverage(dates, null, '2026-27')).toBe(true);
    expect(getPlannedFixtureView(monthQuery('2027-03'), dates, null).state).toBe('canonical');
    expect(getPlannedFixtureView(monthQuery('2026-10'), [], null, true).state).toBe('canonical');
  });
  it('does not contaminate ScheduleGame, analytics, live status or completed records', () => {
    const all = view(monthQuery('2026-10')).fixtures;
    for (const f of all) { expect(f).not.toHaveProperty('gameId'); expect(f).not.toHaveProperty('gameStatus'); expect(f).not.toHaveProperty('homeScore'); expect(f).not.toHaveProperty('awayScore'); }
    const api = readFileSync('src/lib/api.ts', 'utf8'); expect(api).not.toContain('planned-fixtures');
    const loader = readFileSync('src/lib/planned-fixtures-server.ts', 'utf8'); expect(loader).toContain("import 'server-only'");
    const ui = readFileSync('src/components/PlannedFixtures.tsx', 'utf8'); expect(ui).not.toMatch(/href=\{?`?\/game\//); expect(ui).not.toContain('cupGroupPlay');
  });
  it('bounds upcoming results and never generates rows beyond assigned coverage', () => {
    const query = { mode: 'upcoming', from: '2026-10-03', timeZone: 'Asia/Shanghai', team: 'LAL', limit: 8 } as const;
    const result = view(query); expect(result.fixtures).toHaveLength(8);
    expect(result.fixtures.every(f => f.awayTricode === 'LAL' || f.homeTricode === 'LAL')).toBe(true);
    expect(view({ ...query, from: '2027-04-13' }).state).toBe('outside-snapshot');
    expect(view({ ...query, from: '2025-10-20' }).state).toBe('outside-snapshot');
  });
});

describe('strict query and client boundary', () => {
  it.each(['', 'date=2026-02-30', 'month=2026-00', 'month=2026-13', 'date=2026-10-20&month=2026-10', 'date=2026-10-20&date=2026-10-21', 'date=2026-10-20&tz=bad', 'from=2026-10-03&limit=1200', 'from=2026-10-03&limit=0', 'from=2026-10-03&limit=1.5', 'from=2026-10-03&team=__proto__', 'date=2026-10-20&limit=1', 'month=2026-10&all=true', 'from=2026-10-03&tz=UTC&tz=Asia/Shanghai'])('rejects invalid/ambiguous query %s', query => expect(parsePlannedFixtureQuery(new URLSearchParams(query))).toBeNull());
  it('rejects synthetic IDs, scores, statuses, wrong-zone, wrong-date and duplicated responses', () => {
    const query = monthQuery('2026-10'); const valid = view(query);
    for (const patch of [{ officialGameId: '1' }, { scores: { home: 0 } }, { currentStatus: 1 }, { key: '1' }]) expect(normalizePlannedFixtureView({ ...valid, fixtures: [{ ...valid.fixtures[0], ...patch }] }, query)).toBeNull();
    expect(normalizePlannedFixtureView(valid, monthQuery('2026-11'))).toBeNull();
    expect(normalizePlannedFixtureView({ ...valid, timeZone: 'UTC' }, query)).toBeNull();
    expect(normalizePlannedFixtureView({ ...valid, fixtures: [valid.fixtures[0], valid.fixtures[0]] }, query)).toBeNull();
  });
});

it('sorts shuffled source rows by UTC before upcoming limits and next-date navigation', async () => {
  vi.resetModules();
  vi.doMock('@/data/planned-fixtures-2026-27.json', () => ({ default: { ...snapshot, rows: [...snapshot.rows].reverse() } }));
  try {
    const shuffled = await import('./planned-fixtures-server');
    const query = { mode: 'upcoming', from: '2026-11-01', timeZone: 'America/New_York', team: 'HOU', limit: 20 } as const;
    const result = shuffled.getPlannedFixtureView(query, [], null);
    const expected = snapshot.rows.filter(row => String(row[2]) >= query.from && (row[4] === 'HOU' || row[5] === 'HOU'))
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]))).slice(0, 20).map(row => row[0]);
    expect(result.fixtures.map(f => f.sourceNumber)).toEqual(expected);
    expect(result.fixtures.findIndex(f => f.sourceNumber === 208)).toBeLessThan(result.fixtures.findIndex(f => f.sourceNumber === 50));
    expect(shuffled.getPlannedFixtureView({ mode: 'day', date: '2026-10-03', timeZone: 'Asia/Shanghai' }, [], null).nextAvailableDate).toBe('2026-10-21');
  } finally { vi.doUnmock('@/data/planned-fixtures-2026-27.json'); vi.resetModules(); }
});

it('rejects empty date lists, minimal game objects and mismatched-season games as season evidence', () => {
  for (const games of [[], [{ gameId: '0022600001', homeTeam: {}, awayTeam: {} }], [{ ...canonicalGame, gameId: '0022500001' }]]) {
    const envelope = { leagueSchedule: { seasonYear: '2026-27', gameDates: [{ gameDate: '10/20/2026 00:00:00', games }] } };
    expect(coverageFromOfficialSchedule(envelope)).toBeNull();
  }
});
