import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ schedule: [] as unknown[], live: [] as unknown[], sourceDate: null as string | null, coverage: null as unknown, espn: vi.fn() }));
vi.mock('@/lib/api', () => ({ getFullSchedule: async () => state.schedule, getGamesByDate: async () => [], getTodayScoreboard: async () => state.live, getScoreboardSourceDate: () => state.sourceDate, getScheduleCoverage: () => state.coverage, formatDate: () => '2026-10-05' }));
vi.mock('@/lib/espn-scoreboard-server', async original => ({ ...await original<typeof import('@/lib/espn-scoreboard-server')>(), getEspnDailyScoreboard: state.espn }));
import { GET } from './route';
const request = (date = '2026-10-05', tz = 'Asia/Shanghai') => new NextRequest(`https://example.test/api/games?date=${date}&tz=${tz}`);
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T05:19:00Z')); state.schedule = []; state.live = []; state.sourceDate = null; state.coverage = null; state.espn.mockReset().mockResolvedValue({ source: 'espn', state: 'ready', date: '2026-10-05', timeZone: 'Asia/Shanghai', games: [{ eventId: '401914127', key: 'espn:401914127' }] }); });
afterEach(() => vi.useRealTimers());
it('returns source-native fallback separately without polluting NBA game consumers', async () => {
  const body = await (await GET(request())).json(); expect(body.data).toEqual([]); expect(body.espn.games[0].eventId).toBe('401914127'); expect(body.espn.games[0]).not.toHaveProperty('gameId');
  expect(state.espn).toHaveBeenCalledWith('2026-10-05', 'Asia/Shanghai', [], expect.any(AbortSignal));
});
it('never queries ESPN when canonical games already exist, including preseason 001 IDs', async () => {
  const game = { gameId: '0012600010', gameDateTimeUTC: '2026-10-04T23:00:00Z', gameStatus: 3 };
  state.schedule = [{ gameDate: '10/04/2026 00:00:00', games: [game] }];
  const body = await (await GET(request())).json(); expect(body.data).toEqual([game]); expect(body.espn).toBeUndefined(); expect(state.espn).not.toHaveBeenCalled();
});
it('preserves explicit empty canonical days covering the entire local day', async () => {
  state.coverage = { source: 'nba-schedule', season: '2026-27' };
  state.schedule = ['10/04/2026', '10/05/2026'].map(date => ({ gameDate: `${date} 00:00:00`, games: [] }));
  const body = await (await GET(request())).json(); expect(body.espn).toBeUndefined(); expect(state.espn).not.toHaveBeenCalled();
});
it('preserves an empty current ET scoreboard, but only excludes its slice of a different-zone day', async () => {
  state.sourceDate = '2026-10-05';
  expect((await (await GET(request('2026-10-05', 'America/New_York'))).json()).espn).toBeUndefined(); expect(state.espn).not.toHaveBeenCalled();
  await GET(request()); expect(state.espn).toHaveBeenCalledWith('2026-10-05', 'Asia/Shanghai', ['2026-10-05'], expect.any(AbortSignal));
});
it('never caches provider failure as a normal empty day', async () => {
  state.espn.mockResolvedValue({ source: 'espn', state: 'unavailable', games: [] });
  const response = await GET(request()); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect((await response.json()).espn.state).toBe('unavailable');
});
it('does not let stale scoreboard provenance suppress today’s fallback', async () => {
  state.sourceDate = '2026-06-13'; await GET(request()); expect(state.espn).toHaveBeenCalledWith('2026-10-05', 'Asia/Shanghai', [], expect.any(AbortSignal));
});
it('uses the ET default for a current-date caller without tz', async () => {
  await GET(new NextRequest('https://example.test/api/games?date=2026-10-05')); expect(state.espn).toHaveBeenCalledWith('2026-10-05', 'America/New_York', [], expect.any(AbortSignal));
});

it('does not confuse a regular-only season schedule with preseason day coverage', async () => {
  state.coverage = { source: 'nba-schedule', season: '2026-27' };
  state.schedule = [{ gameDate: '10/20/2026 00:00:00', games: [{ gameId: '0022600001', gameDateTimeUTC: '2026-10-20T23:00:00Z', gameStatus: 1 }] }];
  const body = await (await GET(request())).json(); expect(body.espn).toBeDefined(); expect(state.espn).toHaveBeenCalledTimes(1);
});
it('does not let a partial empty schedule day erase the rest of a Shanghai day', async () => {
  state.coverage = { source: 'nba-schedule', season: '2026-27' };
  state.schedule = [{ gameDate: '10/05/2026 00:00:00', games: [] }];
  await GET(request()); expect(state.espn).toHaveBeenCalledWith('2026-10-05', 'Asia/Shanghai', ['2026-10-05'], expect.any(AbortSignal));
});

it('uses live-score cache lifetime for a game continuing after the local day ended', async () => {
  state.espn.mockResolvedValue({ source: 'espn', state: 'ready', games: [{ status: 'live' }] });
  const response = await GET(request('2026-10-04', 'America/New_York'));
  expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=120');
});
