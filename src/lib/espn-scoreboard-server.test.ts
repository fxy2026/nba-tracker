import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { getEspnDailyScoreboard, localDayUtcWindow, parseEspnScoreboard } from './espn-scoreboard-server';
import { normalizeEspnScoreboardView, validEspnGameUrl } from './espn-scoreboard';

function event(id = '401914127', date = '2026-10-04T23:00Z', status = 'final') {
  return {
    id, date, season: { year: 2027, type: 1, slug: 'preseason' },
    status: { type: { name: status === 'final' ? 'STATUS_FINAL' : status === 'live' ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED', state: status === 'final' ? 'post' : status === 'live' ? 'in' : 'pre', completed: status === 'final', shortDetail: status === 'final' ? 'Final' : 'Q2 4:25' } },
    competitions: [{ id, competitors: [
      { id: '7', homeAway: 'home', score: '97', team: { id: '7', displayName: 'Denver Nuggets', abbreviation: 'DEN' } },
      { id: '26', homeAway: 'away', score: '109', team: { id: '26', displayName: 'Utah Jazz', abbreviation: 'UTAH' } },
    ] }],
    links: [{ rel: ['summary', 'desktop', 'event'], href: `https://www.espn.com/nba/game/_/gameId/${id}/jazz-nuggets` }],
  };
}
beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const response = (events: unknown[]) => new Response(JSON.stringify({ events }));

describe('local-day interval and ET coverage', () => {
  it.each([
    ['2026-10-05', 'Asia/Shanghai', '2026-10-04T16:00:00.000Z', '2026-10-05T16:00:00.000Z', ['2026-10-04', '2026-10-05']],
    ['2026-03-08', 'America/New_York', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', ['2026-03-08']],
    ['2026-11-01', 'America/New_York', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', ['2026-11-01']],
    ['2026-10-05', 'Pacific/Kiritimati', '2026-10-04T10:00:00.000Z', '2026-10-05T10:00:00.000Z', ['2026-10-04', '2026-10-05']],
    ['2026-10-05', 'Pacific/Pago_Pago', '2026-10-05T11:00:00.000Z', '2026-10-06T11:00:00.000Z', ['2026-10-05', '2026-10-06']],
  ])('%s in %s', (date, zone, start, end, dates) => {
    const window = localDayUtcWindow(date, zone); expect(new Date(window.start).toISOString()).toBe(start); expect(new Date(window.end).toISOString()).toBe(end); expect(window.datesET).toEqual(dates);
  });
  it('handles a skipped calendar date without inventing an interval', () => {
    const window = localDayUtcWindow('2011-12-30', 'Pacific/Apia'); expect(window.start).toBe(window.end); expect(window.datesET).toEqual([]);
  });
  it.each([['2026-02-30', 'UTC'], ['2026-10-05', 'invalid'], ['0000-01-01', 'UTC']])('rejects invalid %s %s', (date, zone) => expect(() => localDayUtcWindow(date, zone)).toThrow());
});

describe('provider-native validation', () => {
  it('preserves ESPN IDs and explicit preseason while deduplicating identical rows', () => {
    const game = parseEspnScoreboard({ events: [event(), event()] }, '2026-10-04')!;
    expect(game).toHaveLength(1); expect(game[0]).toMatchObject({ source: 'espn', eventId: '401914127', key: 'espn:401914127', seasonType: 1, seasonYear: 2027, status: 'final', away: { tricode: 'UTA', score: 109 }, home: { tricode: 'DEN', score: 97 } });
    expect(game[0]).not.toHaveProperty('gameId');
  });
  it('never fabricates zero scores for scheduled games', () => {
    const games = parseEspnScoreboard({ events: [event('12', '2026-10-04T23:00Z', 'scheduled')] }, '2026-10-04')!;
    expect(games[0].home.score).toBeNull(); expect(games[0].away.score).toBeNull();
  });
  it('retains international opponent names without assigning an NBA team ID', () => {
    const e = event(); e.competitions[0].competitors[1].id = '999'; e.competitions[0].competitors[1].team = { id: '999', displayName: 'International Club', abbreviation: 'INT' };
    expect(parseEspnScoreboard({ events: [e] }, '2026-10-04')![0].away).toMatchObject({ id: '999', name: 'International Club', tricode: null });
  });
  it('rejects conflicting duplicates, wrong-day stale responses and partial schemas', () => {
    const changed = event(); changed.competitions[0].competitors[0].score = '98';
    expect(parseEspnScoreboard({ events: [event(), changed] }, '2026-10-04')).toBeNull();
    expect(parseEspnScoreboard({ events: [event()] }, '2026-10-05')).toBeNull();
    for (const body of [{}, { events: null }, { events: [{}] }, { events: [event(), {}] }]) expect(parseEspnScoreboard(body, '2026-10-04')).toBeNull();
  });
  it.each(['https://evil.test/nba/game/_/gameId/401914127', 'https://www.espn.com.evil.test/nba/game/_/gameId/401914127', 'javascript:alert(1)', 'https://www.espn.com/nba/game/_/gameId/401914128', 'https://www.espn.com/nba/game/_/gameId/401914127?redirect=evil'])('rejects unverified source URL %s', url => expect(validEspnGameUrl(url, '401914127')).toBe(false));
  it('drops an unsafe link while preserving valid score facts', () => {
    const e = event(); e.links[0].href = 'https://evil.test'; expect(parseEspnScoreboard({ events: [e] }, '2026-10-04')![0].sourceUrl).toBeNull();
  });
});

describe('bounded daily requests', () => {
  it('queries intersecting ET days concurrently, filters UTC instants, and omits next-day games', async () => {
    vi.mocked(fetch).mockImplementation(async url => String(url).includes('20261004') ? response([event()]) : response([event('401898388', '2026-10-05T23:00Z', 'scheduled')]));
    const view = await getEspnDailyScoreboard('2026-10-05', 'Asia/Shanghai');
    expect(view.state).toBe('ready'); expect(view.games.map(game => game.eventId)).toEqual(['401914127']); expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(fetch).mock.calls) expect(call[1]).toMatchObject({ cache: 'no-store', redirect: 'error' });
    expect(normalizeEspnScoreboardView(view, '2026-10-05', 'Asia/Shanghai')).toEqual(view);
    expect(normalizeEspnScoreboardView(view, '2026-10-06', 'Asia/Shanghai')).toBeNull();
  });
  it('excludes precisely a verified NBA ET day, without erasing the other part of a local day', async () => {
    vi.mocked(fetch).mockResolvedValue(response([event()]));
    const view = await getEspnDailyScoreboard('2026-10-05', 'Asia/Shanghai', ['2026-10-05']);
    expect(view.games).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(1); expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('dates=20261004');
  });
  it('distinguishes valid empty from failed/incomplete responses', async () => {
    vi.mocked(fetch).mockImplementation(async () => response([]));
    expect((await getEspnDailyScoreboard('2026-10-05', 'Asia/Shanghai')).state).toBe('ready');
    vi.mocked(fetch).mockImplementation(async url => String(url).includes('20261004') ? response([event()]) : new Response('{}', { status: 503 }));
    expect(await getEspnDailyScoreboard('2026-10-05', 'Asia/Shanghai')).toMatchObject({ state: 'unavailable', games: [] });
    vi.mocked(fetch).mockImplementation(async () => new Response('{bad json'));
    expect((await getEspnDailyScoreboard('2026-10-05', 'America/New_York')).state).toBe('unavailable');
  });
  it('has a five-second shared deadline covering response body consumption', async () => {
    vi.useFakeTimers(); let requestedSignal!: AbortSignal;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      requestedSignal = init!.signal as AbortSignal;
      return new Response(new ReadableStream({ start(controller) { requestedSignal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true }); } }));
    });
    const pending = getEspnDailyScoreboard('2026-10-05', 'America/New_York');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ state: 'unavailable', games: [] }); expect(requestedSignal.aborted).toBe(true);
  });
  it('does no work for pre-aborted requests, and bounds payload size', async () => {
    const controller = new AbortController(); controller.abort();
    expect((await getEspnDailyScoreboard('2026-10-05', 'UTC', [], controller.signal)).state).toBe('unavailable'); expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1)));
    expect((await getEspnDailyScoreboard('2026-10-05', 'America/New_York')).state).toBe('unavailable');
  });
});
