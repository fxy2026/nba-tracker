import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import projection from '@/data/schedule-projection-revision.json';
import archive from '@/data/schedule-2025-26.json';
const team = { teamId: 1610612738, teamTricode: 'BOS', teamName: 'Celtics', teamCity: 'Boston', teamSlug: '', score: 0, wins: 0, losses: 0 };
const game = { gameId: '0022600001', gameCode: '20261020/BOSDET', gameStatus: 1, gameStatusText: 'Scheduled', gameDateTimeUTC: '2026-10-20T19:00:00Z', homeTeam: { ...team, teamId: 1610612765, teamTricode: 'DET' }, awayTeam: team };
const payload = (games = [game], date = '10/20/2026 00:00:00') => ({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ gameDate: date, games }] } });
beforeEach(() => { vi.resetModules(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('canonical source coverage is atomic with cached schedule data', () => {
  it('treats bare empty seasons as unavailable and retains known source facts, while a covered empty day replaces obsolete schedules', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(payload()))
      .mockResolvedValueOnce(Response.json({ leagueSchedule: { seasonYear: '2026-27', gameDates: [] } }))
      .mockResolvedValueOnce(Response.json(payload([{ ...game, gameId: '0022600002', gameDateTimeUTC: '2026-10-21T19:00:00Z' }], '10/21/2026 00:00:00')));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./api');
    const first = await api.getRawScheduleDates();
    expect(first.dates.flatMap(day => day.games).find(g => g.gameId === game.gameId)).toBeDefined();
    const unavailable = await api.getRawScheduleDates();
    expect(unavailable.dates).toBe(first.dates); expect(unavailable.coverage).toEqual(first.coverage);
    const emptyDay = await api.getRawScheduleDates();
    expect(emptyDay.coverage).toEqual({ source: 'nba-schedule', season: '2026-27' });
    expect(emptyDay.dates.flatMap(day => day.games).find(g => g.gameId === game.gameId)).toBeUndefined();
    expect(emptyDay.dates.flatMap(day => day.games).filter(g => g.gameStatus === 3).length).toBeGreaterThan(1000);
    expect(api.getScheduleCoverage(first.dates)).toEqual(first.coverage);
  });
  it('unavailable cold sources never label the historical archive as current coverage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ leagueSchedule: { seasonYear: '2026-27', gameDates: [] } })));
    const api = await import('./api'); const result = await api.getRawScheduleDates();
    expect(result.coverage).toBeNull(); expect(result.seasonYear).toBe('2025');
    expect(result.dates.length).toBeGreaterThan(200);
  });
  it('keeps newer data and coverage when an older request resolves last', async () => {
    let resolveOld!: (response: Response) => void;
    const newer = { leagueSchedule: { seasonYear: '2027-28', gameDates: [{ gameDate: '10/20/2027 00:00:00', games: [{ ...game, gameId: '0022700001', gameDateTimeUTC: '2027-10-20T19:00:00Z' }] }] } };
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(Response.json(newer)));
    const api = await import('./api');
    const oldRequest = api.getRawScheduleDates(); const current = await api.getRawScheduleDates();
    resolveOld(Response.json(payload())); const oldResult = await oldRequest;
    expect(oldResult.dates).toBe(current.dates); expect(oldResult.coverage).toEqual({ source: 'nba-schedule', season: '2027-28' });
    expect(api.getScheduleCoverage(oldResult.dates)).toEqual(oldResult.coverage);
    expect(api.getScheduleSeasonYear()).toBe('2027');
  });
  it('carries exact coverage through a cold slim hit without fetching the official endpoint', async () => {
    const coverage = { source: 'nba-schedule', season: '2026-27' };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...projection, seasonYear: '2026', dates: archive.dates, coverage }));
    vi.stubGlobal('fetch', fetcher); const api = await import('./api');
    const dates = await api.getFullSchedule(); expect(api.getScheduleCoverage(dates)).toEqual(coverage);
    expect((await api.getCachedScheduleFeed()).coverage).toEqual(coverage); expect(fetcher).toHaveBeenCalledOnce();
    expect(projection.schema).toBe(4);
  });
  it('keeps moved games only at the new canonical date and never guesses IDs from PDF matchups', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(payload())).mockResolvedValueOnce(Response.json(payload([{ ...game, gameDateTimeUTC: '2026-10-22T23:00:00Z' }], '10/22/2026 00:00:00'))));
    const api = await import('./api'); await api.getRawScheduleDates(); const result = await api.getRawScheduleDates();
    const matches = result.dates.flatMap(day => day.games).filter(g => g.gameId === game.gameId);
    expect(matches).toHaveLength(1); expect(matches[0].gameDateTimeUTC).toBe('2026-10-22T23:00:00Z');
  });
});

it('retains the exact warm season and its completed facts after empty-date/minimal/mismatched responses', async () => {
  const complete = { ...game, gameId: '0022600003', gameStatus: 3, gameStatusText: 'Final', homeTeam: { ...game.homeTeam, score: 100 }, awayTeam: { ...game.awayTeam, score: 90 } };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(payload([game, complete])))
    .mockResolvedValueOnce(Response.json(payload([])))
    .mockResolvedValueOnce(Response.json({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ gameDate: '10/20/2026 00:00:00', games: [{ gameId: '0022600001', homeTeam: {}, awayTeam: {} }] }] } }))
    .mockResolvedValueOnce(Response.json(payload([{ ...game, gameId: '0022500001' }])));
  vi.stubGlobal('fetch', fetcher); const api = await import('./api');
  const first = await api.getRawScheduleDates();
  for (let i = 0; i < 3; i++) {
    const retained = await api.getRawScheduleDates();
    expect(retained.dates).toBe(first.dates); expect(retained.coverage).toEqual(first.coverage);
    expect(retained.dates.flatMap(day => day.games).filter(g => ['0022600001', '0022600003'].includes(g.gameId))).toHaveLength(2);
  }
});

it.each(['http', 'empty', 'empty-dates', 'malformed'])('throttles repeated warm visits after a %s refresh without relabeling data freshness', async kind => {
  vi.useFakeTimers();
  try {
    const ttl = 2 * 60 * 60 * 1000;
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const unavailable = () => kind === 'http' ? new Response('blocked', { status: 403 }) : Response.json(
      kind === 'empty' ? { leagueSchedule: { seasonYear: '2026-27', gameDates: [] } } : kind === 'empty-dates' ? payload([]) : {});
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(payload())).mockImplementation(async () => unavailable());
    vi.stubGlobal('fetch', fetcher); const api = await import('./api');
    const first = await api.getCachedScheduleFeed();
    vi.setSystemTime(Date.now() + ttl + 1);
    const warm = await api.getCachedScheduleFeed();
    await vi.advanceTimersByTimeAsync(0);
    expect(warm.dates).toBe(first.dates); expect(fetcher).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 6; i++) {
      expect((await api.getCachedScheduleFeed()).dates).toBe(first.dates);
      expect(await api.getFullSchedule()).toBe(first.dates);
    }
    await vi.advanceTimersByTimeAsync(0); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(api.getScheduleCoverage(first.dates)).toEqual(first.coverage);
    expect(api.getScheduleAge()).toBe(ttl + 1);
    await vi.advanceTimersByTimeAsync(ttl - 1);
    await api.getCachedScheduleFeed(); expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await api.getCachedScheduleFeed(); await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect((await api.getCachedScheduleFeed()).dates).toBe(first.dates);
    expect(api.getScheduleAge()).toBe(2 * ttl + 1);
    expect(api.getScheduleCoverage(first.dates)).toEqual(first.coverage);
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
