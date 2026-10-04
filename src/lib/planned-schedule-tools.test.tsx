import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { ScheduleDate, ScheduleGame } from './api';
import { getTranslations } from '@/locales';
vi.mock('server-only', () => ({}));
const runtime = vi.hoisted(() => ({ schedule: [] as ScheduleDate[], coverage: null as unknown, locale: 'en' }));
vi.mock('@/lib/api', () => ({ getCurrentSeasonSchedule: vi.fn(async () => runtime.schedule), getScheduleCoverage: () => runtime.coverage, getScheduleAge: () => 3000 }));
vi.mock('@/lib/locale', () => ({ getLocale: async () => runtime.locale }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale as 'en' | 'zh') }) }));
import { buildBackToBacks, selectScheduleToolSource, scheduleDateET } from './schedule-tools-server';
import { buildPlannedScheduleHeatmap, buildScheduleHeatmap } from './schedule-heatmap';
import { getPlannedSeasonFixtures } from './planned-fixtures-server';
import { PLANNED_SOURCE_URL } from './planned-fixtures';
import { TEAM_META } from './teams';
import HeatmapPage from '@/app/schedule-heatmap/page';
import BackToBackPage from '@/app/back-to-back/page';
const now = new Date('2026-10-04T12:00:00Z');
const planned = () => selectScheduleToolSource([], null, '2026-27');
function day(date: string, index: number, status = 1, homeScore = 0, awayScore = 0, patch: Partial<ScheduleGame> = {}): ScheduleDate {
  const team = (code: string, score: number) => ({ teamId: TEAM_META[code].teamId, teamTricode: code, teamName: '', teamCity: '', teamSlug: '', score });
  const game = { gameId: `00226${String(index).padStart(5, '0')}`, gameDateTimeUTC: `${date}T23:00:00Z`, gameStatus: status, gameStatusText: status === 3 ? 'Final' : 'Scheduled', gameCode: '', homeTeam: team('BOS', homeScore), awayTeam: team('NYK', awayScore), ...patch };
  return { gameDate: `${date.slice(5, 7)}/${date.slice(8)}/${date.slice(0, 4)} 00:00:00`, games: [game] };
}
const canonical = (dates: ScheduleDate[]) => selectScheduleToolSource(dates, null, '2026-27');
const bos = (data: ReturnType<typeof buildBackToBacks>) => data.totals.find(team => team.team === 'BOS')!;
beforeEach(() => { runtime.schedule = []; runtime.coverage = null; runtime.locale = 'en'; vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('complete assigned snapshot, partial season', () => {
  it('reuses 1,200 fixture identities, 30×80 appearances, 156 ET dates and 426 pairs', () => {
    const source = planned(); expect(source.mode).toBe('planned');
    if (source.mode !== 'planned') throw new Error('Expected planned source');
    expect(source.fixtures).toBe(getPlannedSeasonFixtures('2026-27', [], null));
    expect(source.fixtures).toHaveLength(1200);
    const appearances = new Map<string, number>();
    for (const f of source.fixtures) { for (const code of [f.homeTricode, f.awayTricode]) appearances.set(code, (appearances.get(code) ?? 0) + 1); expect(f.officialGameId).toBeNull(); expect(f.scores).toBeNull(); expect(f).not.toHaveProperty('gameStatus'); }
    expect(appearances.size).toBe(30); expect([...appearances.values()].every(n => n === 80)).toBe(true);
    const heat = buildPlannedScheduleHeatmap(source.fixtures, now);
    expect(heat).toMatchObject({ totalGames: 1200, totalDays: 156, maxGames: 15, finishedGames: 0 });
    const assigned = [...heat.byMonth.values()].flat().filter(day => day.games > 0);
    expect(assigned[0].date).toBe('2026-10-20'); expect(assigned.at(-1)?.date).toBe('2027-04-11');
    const b2b = buildBackToBacks(source, now);
    expect(b2b).toMatchObject({ totalPairs: 426, upcomingCount: 426, completedCount: 0 }); expect(b2b.visibleUpcoming).toHaveLength(15);
    expect(b2b.pairs[0].nights.map(night => night.date)).toEqual(['2026-10-23', '2026-10-24']);
    expect(b2b.totals).toHaveLength(30); expect(b2b.totals.every(team => team.total >= 13 && team.total <= 16 && team.verifiedGames === 0)).toBe(true);
    expect(b2b.pairs.every(pair => pair.nights.every(night => night.href.startsWith('/?date=') && night.href.endsWith('&tz=America%2FNew_York') && night.won === null))).toBe(true);
  });
  it('does not invent results after planned dates pass or mutate frozen source', () => {
    const source = planned(); if (source.mode !== 'planned') throw new Error(); const before = JSON.stringify(source);
    const b2b = buildBackToBacks(source, new Date('2027-08-01T12:00:00Z'));
    expect(b2b).toMatchObject({ totalPairs: 426, completedCount: 0, upcomingCount: 0, unresolvedCount: 426 });
    expect(b2b.totals.every(team => team.verifiedGames === 0 && team.wins === 0 && team.completed === 0)).toBe(true);
    expect(buildPlannedScheduleHeatmap(source.fixtures, new Date('2027-08-01')).finishedGames).toBe(0);
    expect(JSON.stringify(source)).toBe(before);
    const shuffled = { ...source, fixtures: [...source.fixtures].reverse().concat(source.fixtures[0]) };
    expect(buildBackToBacks(shuffled, now)).toEqual(buildBackToBacks(source, now));
    expect(buildPlannedScheduleHeatmap(shuffled.fixtures, now)).toEqual(buildPlannedScheduleHeatmap(source.fixtures, now));
  });
});

describe('canonical precedence and consumer isolation', () => {
  it('suppresses the snapshot for valid canonical current data and covered-empty data', () => {
    const data = [day('2026-11-01', 1)]; const source = canonical(data);
    expect(source.mode).toBe('canonical'); if (source.mode !== 'planned') expect(buildScheduleHeatmap(source.schedule).totalGames).toBe(1);
    const empty = selectScheduleToolSource([], { source: 'nba-schedule', season: '2026-27' }, '2026-27');
    expect(empty).toEqual({ mode: 'canonical', season: '2026-27', schedule: [] }); expect(buildBackToBacks(empty).totalPairs).toBe(0);
  });
  it('never labels malformed, absent or archive-only inputs as canonical coverage', () => {
    const archive = day('2026-01-01', 1); archive.games[0].gameId = '0022500001';
    for (const data of [[], [archive], [{ gameDate: 'bad', games: [{ gameId: '0022600001' }] }] as ScheduleDate[]]) {
      expect(selectScheduleToolSource(data, null, '2026-27').mode).toBe('planned');
    }
    expect(selectScheduleToolSource([], { source: 'wrong', season: '2026-27' } as never, '2026-27').mode).toBe('planned');
    for (const season of ['2025-26', '2027-28', 'bad']) expect(selectScheduleToolSource([], null, season)).toEqual({ mode: 'unavailable', season, schedule: [] });
    expect(selectScheduleToolSource([archive], null, '2027-28').mode).toBe('unavailable');
  });
  it('dedupes IDs independently of order, excludes conflicts and leaves inputs unchanged', () => {
    const a = day('2026-11-01', 1), b = day('2026-11-02', 2); const data = [b, a, a, b]; const before = JSON.stringify(data);
    expect(buildBackToBacks(canonical(data), now)).toEqual(buildBackToBacks(canonical([a, b]), now)); expect(JSON.stringify(data)).toBe(before);
    const conflicting = day('2026-11-03', 1);
    expect(buildBackToBacks(canonical([a, b, conflicting]), now).totalPairs).toBe(0);
    expect(canonical([conflicting, b, a])).toEqual(canonical([a, b, conflicting]));
  });
  it('excludes malformed, conditional, TBD, postponed, canceled and wrong-season records consistently', () => {
    const good = day('2026-11-01', 1);
    const excluded = [day('2026-11-02', 2, 1, 0, 0, { ifNecessary: true }), day('2026-11-02', 3, 1, 0, 0, { gameStatusText: 'TBD' }), day('2026-11-02', 4, 1, 0, 0, { gameStatusText: 'Postponed' }), day('2026-11-02', 5, 1, 0, 0, { gameStatusText: 'Canceled' }), { ...day('2026-11-02', 6), gameDate: '02/30/2027' }, day('2026-11-02', 7, 1, 0, 0, { gameId: '0022500007' }), day('2026-11-02', 8, 1, 0, 0, { gameDateTimeUTC: 'bad' })];
    const source = canonical([good, ...excluded]); if (source.mode === 'planned') throw new Error();
    expect(buildScheduleHeatmap(source.schedule).totalGames).toBe(1); expect(buildBackToBacks(source).totalPairs).toBe(0);
    expect(scheduleDateET('11/01/2026 trailing')).toBeNull(); expect(scheduleDateET('2/29/2027')).toBeNull();
  });
  it('keeps heatmap preseason/Cup/playoff dates but excludes exhibitions/all-star from team B2Bs', () => {
    const data = [day('2026-11-01', 1, 1, 0, 0, { gameId: '0012600001' }), day('2026-11-02', 2, 1, 0, 0, { gameId: '0032600002' }), day('2026-11-03', 3, 1, 0, 0, { gameId: '0062600003' }), day('2026-11-04', 4, 1, 0, 0, { gameId: '0042600004' })];
    const source = canonical(data); if (source.mode === 'planned') throw new Error(); expect(buildScheduleHeatmap(source.schedule).totalGames).toBe(4); expect(buildBackToBacks(source, now).totalPairs).toBe(2);
  });
});

describe('ET pair and verified-outcome semantics', () => {
  it.each([['2026-10-31', '2026-11-01'], ['2027-03-13', '2027-03-14'], ['2026-12-31', '2027-01-01'], ['2027-02-28', '2027-03-01']])('recognizes consecutive ET dates %s → %s', (first, second) => {
    expect(buildBackToBacks(canonical([day(second, 2), day(first, 1)]), now).totalPairs).toBe(2);
  });
  it('includes first-night today, second-night today and in-progress pairs in full upcoming count', () => {
    const source = canonical([day('2026-11-01', 1, 3, 110, 100), day('2026-11-02', 2, 2)]);
    for (const instant of ['2026-11-01T12:00:00Z', '2026-11-02T23:00:00Z', '2026-11-03T04:30:00Z']) expect(buildBackToBacks(source, new Date(instant)).upcomingCount).toBe(2);
    const past = buildBackToBacks(source, new Date('2026-11-03T05:01:00Z'));
    expect(past).toMatchObject({ completedCount: 0, upcomingCount: 0, unresolvedCount: 2 }); expect(bos(past)).toMatchObject({ verifiedGames: 1, wins: 1, completed: 0 });
  });
  it('uses unique verified finals including a final first night, without double-counting overlapping games', () => {
    const source = canonical([day('2026-11-01', 1, 3, 110, 100), day('2026-11-02', 2, 3, 100, 110), day('2026-11-03', 3, 1)]);
    const b2b = buildBackToBacks(source, new Date('2026-11-03T12:00:00Z'));
    expect(bos(b2b)).toMatchObject({ total: 2, completed: 1, upcoming: 1, wins: 1, verifiedGames: 2 });
    expect(bos(buildBackToBacks(canonical([day('2026-11-01', 1, 3, 0, 0), day('2026-11-02', 2, 3, 100, 100)]), now))).toMatchObject({ completed: 0, verifiedGames: 0 });
  });
});

it.each(['en', 'zh'])('renders source, scope, ET dates and mobile hit areas in %s', async locale => {
  runtime.locale = locale;
  const heat = renderToStaticMarkup(await HeatmapPage()); const b2b = renderToStaticMarkup(await BackToBackPage());
  for (const html of [heat, b2b]) {
    expect(html).toContain(PLANNED_SOURCE_URL); expect(html).toContain('America/New_York');
    expect(html).toContain(locale === 'en' ? '80 assigned games per team' : '每队已分配 80 场');
    expect(html).toContain(locale === 'en' ? 'not complete 82-game season totals' : '不是完整 82 场赛季总数');
    expect(html).toContain(locale === 'en' ? 'subject to change' : '可能变更'); expect(html).not.toContain('/game/');
    expect(html.replace(/<[^>]+>/g, '')).not.toMatch(/verified final B2B games won|confirmed complete|已确认完成|已完 |0%|Cache loaded/);
  }
  expect(heat).toContain('1,200'); expect(heat).toContain('156'); expect(heat).toContain('grid-cols-7'); expect(heat).toContain('min-h-[52px]'); expect(heat).toContain('text-sm');
  expect(b2b).toContain(locale === 'en' ? '426 total · showing first 15' : '共 426 组 · 显示前 15 组');
  expect(b2b.match(/Night 1|第 1 场/g)).toHaveLength(15); expect(b2b).toContain('min-h-[44px]'); expect(b2b).toContain('grid-cols-1 sm:grid-cols-2');
  expect(b2b).toContain('date=2026-10-23&amp;tz=America%2FNew_York'); expect(b2b).toContain(locale === 'en' ? 'vs' : '对阵');
});
it('never renders planned outcome statistics after dates pass and does not use a past-season snapshot after rollover', async () => {
  vi.setSystemTime(new Date('2027-08-01T12:00:00Z'));
  const html = renderToStaticMarkup(await BackToBackPage()); expect(html).toContain('426 planned'); expect(html.replace(/<[^>]+>/g, '')).not.toMatch(/\d%|verified final B2B games won|confirmed complete/);
  vi.setSystemTime(new Date('2027-10-01T12:00:00Z'));
  expect(renderToStaticMarkup(await HeatmapPage())).toContain('No schedule data'); expect(renderToStaticMarkup(await BackToBackPage())).toContain('No B2Bs detected');
});
it('renders real canonical links, explicit denominator sample and no rate for no finals', async () => {
  runtime.schedule = [day('2026-11-01', 1, 3, 110, 100), day('2026-11-02', 2)];
  const html = renderToStaticMarkup(await BackToBackPage()); expect(html).toContain('/game/0022600001'); expect(html).toContain('1/1 verified final B2B games won (100%)'); expect(html).toContain('including a final first game whose second game is pending'); expect(html).not.toContain(PLANNED_SOURCE_URL);
  runtime.schedule = [day('2026-11-01', 1), day('2026-11-02', 2)]; expect(renderToStaticMarkup(await BackToBackPage()).replace(/<[^>]+>/g, '')).not.toMatch(/\d%|verified final B2B games won/);
});
it('does not ship the full snapshot to the client or alter provider behavior', () => {
  const server = readFileSync('src/lib/schedule-tools-server.ts', 'utf8'); expect(server).toContain("import 'server-only'"); expect(server).not.toMatch(/fetch\(|getFullSchedule|writeFile/);
  for (const path of ['src/app/schedule-heatmap/page.tsx', 'src/app/back-to-back/page.tsx']) { const page = readFileSync(path, 'utf8'); expect(page).not.toContain('use client'); expect(page).not.toContain('planned-fixtures-2026-27.json'); }
  expect(readFileSync('src/lib/api.ts', 'utf8')).not.toContain('planned-fixtures');
});
it('covered-empty, unavailable and current canonical rendering never blend in planned source labels', async () => {
  runtime.coverage = { source: 'nba-schedule', season: '2026-27' };
  for (const page of [HeatmapPage, BackToBackPage]) expect(renderToStaticMarkup(await page())).not.toContain(PLANNED_SOURCE_URL);
  runtime.coverage = null;
  runtime.schedule = [day('2026-11-01', 1), day('2026-11-02', 2)];
  for (const page of [HeatmapPage, BackToBackPage]) expect(renderToStaticMarkup(await page())).not.toContain(PLANNED_SOURCE_URL);
  runtime.schedule = [];
  const api = await import('@/lib/api');
  vi.mocked(api.getCurrentSeasonSchedule).mockRejectedValueOnce(new Error('unavailable'));
  expect(renderToStaticMarkup(await HeatmapPage())).toContain('1,200 planned fixtures');
  vi.mocked(api.getCurrentSeasonSchedule).mockRejectedValueOnce(new Error('unavailable'));
  expect(renderToStaticMarkup(await BackToBackPage())).toContain('426 planned team-specific pairs');
});
it('planned zero cells say no listed fixtures and retain accessible ET date links', async () => {
  const html = renderToStaticMarkup(await HeatmapPage());
  expect(html).toContain('A zero means no listed fixtures, not a confirmed empty date.');
  expect(html).toContain('2026-10-01 · 0 listed planned fixtures · America/New_York');
  expect(html).toContain('date=2026-10-01&amp;tz=America%2FNew_York');
});
it('rejects normalized invalid UTC dates and fractional scores without inventing results', () => {
  const first = day('2027-03-01', 1);
  for (const second of [day('2027-03-02', 2, 3, 100.5, 90), day('2027-03-02', 2, 1, 0, 0, { gameDateTimeUTC: '2027-02-30T23:00:00Z' })]) {
    const source = canonical([first, second]); if (source.mode === 'planned') throw new Error();
    expect(buildScheduleHeatmap(source.schedule).totalGames).toBe(1); expect(buildBackToBacks(source, now).totalPairs).toBe(0);
  }
});
it('preserves established canonical precedence even when a covered projection has malformed ET labels', () => {
  const source = canonical([{ ...day('2026-11-01', 1), gameDate: 'invalid' }]);
  expect(source).toEqual({ mode: 'canonical', season: '2026-27', schedule: [] });
});
it('rejects ET/UTC grouping conflicts and invalid finals from heatmap and pair counts', () => {
  const first = day('2026-11-01', 1);
  const invalid = [day('2026-11-02', 2, 1, 0, 0, { gameDateTimeUTC: '2026-11-02T02:00:00Z' }), day('2026-11-02', 3, 3, 0, 0), day('2026-11-02', 4, 3, 100, 100)];
  const source = canonical([first, ...invalid]); if (source.mode === 'planned') throw new Error();
  expect(buildScheduleHeatmap(source.schedule)).toMatchObject({ totalGames: 1, finishedGames: 0 }); expect(buildBackToBacks(source, now).totalPairs).toBe(0);
});
it('retains officially covered international preseason and All-Star heatmap fixtures, never NBA B2Bs', () => {
  const preseason = day('2026-10-01', 1, 1, 0, 0, { gameId: '0012600001' });
  preseason.games[0].awayTeam = { ...preseason.games[0].awayTeam, teamTricode: 'RMD', teamId: 12345 };
  const allStar = day('2026-10-02', 2, 1, 0, 0, { gameId: '0032600002' });
  allStar.games[0].homeTeam = { ...allStar.games[0].homeTeam, teamTricode: 'EAST', teamId: 12346 };
  allStar.games[0].awayTeam = { ...allStar.games[0].awayTeam, teamTricode: 'WEST', teamId: 12347 };
  const duplicateIdentity = { ...preseason, games: [{ ...preseason.games[0], awayTeam: { ...preseason.games[0].awayTeam, teamId: preseason.games[0].homeTeam.teamId } }] };
  const wrongNBAIdentity = { ...preseason, games: [{ ...preseason.games[0], homeTeam: { ...preseason.games[0].homeTeam, teamId: 12348 } }] };
  for (const row of [duplicateIdentity, wrongNBAIdentity]) {
    const invalid = selectScheduleToolSource([row], { source: 'nba-schedule', season: '2026-27' }, '2026-27');
    if (invalid.mode === 'planned') throw new Error(); expect(invalid.schedule).toEqual([]);
  }
  const source = selectScheduleToolSource([preseason, allStar], { source: 'nba-schedule', season: '2026-27' }, '2026-27');
  if (source.mode === 'planned') throw new Error();
  expect(buildScheduleHeatmap(source.schedule)).toMatchObject({ totalGames: 2, totalDays: 2, finishedGames: 0 }); expect(buildBackToBacks(source, now).totalPairs).toBe(0);
  const invalidCompetitive = { ...preseason, games: [{ ...preseason.games[0], gameId: '0022600001' }] };
  const excluded = selectScheduleToolSource([invalidCompetitive], { source: 'nba-schedule', season: '2026-27' }, '2026-27');
  if (excluded.mode === 'planned') throw new Error(); expect(buildScheduleHeatmap(excluded.schedule).totalGames).toBe(0);
});
