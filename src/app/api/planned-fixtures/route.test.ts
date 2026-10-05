vi.mock("@/lib/espn-scoreboard-server", async original => ({ ...await original<typeof import("@/lib/espn-scoreboard-server")>(), getEspnDailyScoreboard: vi.fn(async () => undefined) }));
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ coverage: null as unknown, schedule: [] as unknown[], sourceDate: null as string | null, live: [] as unknown[] }));
vi.mock('@/lib/api', () => ({
  getFullSchedule: vi.fn(async () => state.schedule), getScheduleCoverage: () => state.coverage,
  getTodayScoreboard: vi.fn(async () => state.live), getScoreboardSourceDate: () => state.sourceDate,
  getGamesByDate: vi.fn(async () => []), formatDate: () => '2026-10-20',
}));
import { GET } from './route';
import { GET as getGames } from '../games/route';
import { GET as getCalendar } from '../calendar/route';
import { getFullSchedule } from '@/lib/api';
import { NextRequest } from 'next/server';
beforeEach(() => { state.coverage = null; state.schedule = []; state.live = []; state.sourceDate = null; vi.clearAllMocks(); });
it.each(['date=2026-02-30', 'month=2026-13', 'date=2026-10-20&from=2026-10-20', 'from=2026-10-20&limit=21', 'date=2026-10-20&tz=wrong'])('rejects %s before canonical loading', async query => {
  const response = await GET(new Request(`https://test/api/planned-fixtures?${query}`)); expect(response.status).toBe(400); expect(getFullSchedule).not.toHaveBeenCalled(); expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('serves a bounded team slice separately with null live fields', async () => {
  const response = await GET(new Request('https://test/api/planned-fixtures?from=2026-10-03&tz=Asia/Shanghai&team=LAL&limit=8'));
  const result = await response.json(); expect(result.state).toBe('snapshot'); expect(result.fixtures).toHaveLength(8);
  expect(result.fixtures.every((f: Record<string, unknown>) => f.officialGameId === null && f.scores === null && f.currentStatus === null)).toBe(true);
  expect(JSON.stringify(result).length).toBeLessThan(6000);
});
it('preserves covered empty over the dated snapshot in context-aware APIs', async () => {
  state.coverage = { source: 'nba-schedule', season: '2026-27' };
  for (const response of [await getGames(new NextRequest('https://test/api/games?date=2026-10-20&tz=America/New_York')), await getCalendar(new NextRequest('https://test/api/calendar?month=2026-10&tz=Asia/Shanghai'))]) {
    const body = await response.json(); const planned = body.planned ?? body;
    expect(planned.state).toBe('canonical'); expect(planned.fixtures).toEqual([]);
  }
});
it('does not treat an ET empty scoreboard as full coverage of a Shanghai local day', async () => {
  state.sourceDate = '2026-10-20';
  // This local date includes late October 19 and early October 20 ET; only
  // sourceDate ET fixtures may be excluded, never the entire local date.
  const response = await getGames(new NextRequest('https://test/api/games?date=2026-10-20&tz=Asia/Shanghai'));
  const result = await response.json(); expect(result.planned.state).toBe('snapshot');
  expect(result.planned.nextAvailableDate).toBe('2026-10-22');
});
it('shows real scoreboard-only games and deduplicates by canonical ID', async () => {
  const live = { gameId: '0022600001', gameCode: '20261020/BOSDET', gameStatus: 2, gameStatusText: 'Q1', gameTimeUTC: '2026-10-20T04:30:00Z', homeTeam: { teamTricode: 'DET', score: 12 }, awayTeam: { teamTricode: 'BOS', score: 10 } };
  state.sourceDate = '2026-10-20'; state.live = [live, live];
  const response = await getGames(new NextRequest('https://test/api/games?date=2026-10-20&tz=Asia/Shanghai'));
  const body = await response.json(); expect(body.data).toHaveLength(1); expect(body.data[0].gameId).toBe(live.gameId); expect(body.data[0].homeTeam.score).toBe(12); expect(body.planned).toBeUndefined();
});
it('calendar and requested-day games use the same UTC grouping', async () => {
  const month = await (await getCalendar(new NextRequest('https://test/api/calendar?month=2026-10&tz=Asia/Shanghai'))).json();
  expect(month.data).toEqual([]); expect(month.planned.fixtures).toHaveLength(81);
  const day = await (await getGames(new NextRequest('https://test/api/games?date=2026-10-21&tz=Asia/Shanghai'))).json();
  expect(day.data).toEqual([]); expect(day.planned.fixtures.length).toBeGreaterThan(0);
  expect(month.planned.fixtures.filter((f: { tipoffUTC: string }) => new Date(f.tipoffUTC).getTime() >= Date.parse('2026-10-20T16:00:00Z') && new Date(f.tipoffUTC).getTime() < Date.parse('2026-10-21T16:00:00Z')).map((f: { key: string }) => f.key)).toEqual(day.planned.fixtures.map((f: { key: string }) => f.key));
});
it.each(['month=2026-00', 'month=2026-13', 'month=2026-10&tz=bad', 'month=2026-10&month=2026-11'])('calendar rejects invalid %s', async query => expect((await getCalendar(new NextRequest(`https://test/api/calendar?${query}`))).status).toBe(400));

it('local snapshot endpoint never loads canonical upstream data, even on cold requests', async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No upstream fetch allowed'); }));
  try {
    state.coverage = { source: 'nba-schedule', season: '2026-27' };
    const response = await GET(new Request('https://test/api/planned-fixtures?month=2026-10&tz=Asia/Shanghai'));
    expect((await response.json()).fixtures).toHaveLength(81);
    expect(getFullSchedule).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
