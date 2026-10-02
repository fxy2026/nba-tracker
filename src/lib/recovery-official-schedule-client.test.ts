import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createOfficialRecoveryScheduleLoader, OFFICIAL_SCHEDULE_MAX_BYTES } from './recovery-official-schedule-client';
import { OFFICIAL_RECOVERY_SCHEDULE_URL } from './recovery-official-schedule';

const input = { mode: 'backfill', expectedSeason: '2026-27' };
const empty = JSON.stringify({ leagueSchedule: { seasonYear: '2026-27', gameDates: [] } });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T08:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('shares one in-flight fixed request and projects hash/time without returning the raw body', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; }));
  const loader = createOfficialRecoveryScheduleLoader({ fetcher });
  const first = loader.load(input), second = loader.load(input);
  expect(first).toBe(second); await Promise.resolve();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(OFFICIAL_RECOVERY_SCHEDULE_URL, expect.objectContaining({ cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' }, signal: expect.any(AbortSignal) }));
  resolve(new Response(empty));
  expect(await first).toEqual({ status: 'empty', season: '2026-27', games: [], source: {
    url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: createHash('sha256').update(empty).digest('hex'), observedAt: '2026-10-24T08:00:00.000Z',
  } });
  expect(await loader.load(input)).toEqual(await first); expect(fetcher).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it.each(['verify', 'diagnose', 'membership', 'restore', '', 'BACKFILL'])('mode %s performs zero requests', async mode => {
  const fetcher = vi.fn(); const loader = createOfficialRecoveryScheduleLoader({ fetcher });
  expect(await loader.load({ ...input, mode })).toEqual({ status: 'not-requested', reason: 'mode-excluded' });
  expect(fetcher).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('excluded mode does not consume the one allowed backfill request', async () => {
  const fetcher = vi.fn(async () => new Response(empty)); const loader = createOfficialRecoveryScheduleLoader({ fetcher });
  await loader.load({ ...input, mode: 'verify' }); await loader.load(input); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('invalid season makes no request, and another season cannot rebind an attempted loader', async () => {
  const fetcher = vi.fn(async () => new Response(empty)); const loader = createOfficialRecoveryScheduleLoader({ fetcher });
  expect((await loader.load({ ...input, expectedSeason: '2026-28' })).status).toBe('malformed'); expect(fetcher).not.toHaveBeenCalled();
  await loader.load(input); expect((await loader.load({ ...input, expectedSeason: '2025-26' })).status).toBe('malformed'); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([204, 301, 401, 403, 404, 429, 500])('HTTP%s is terminal with no retries, alternate URL, or error body exposure', async status => {
  const cancel = vi.fn(async () => {}), getReader = vi.fn(() => { throw Error('body must not be read'); });
  const fetcher = vi.fn(async () => ({ status, headers: new Headers(), body: { cancel, getReader } }) as unknown as Response);
  const loader = createOfficialRecoveryScheduleLoader({ fetcher });
  expect(await loader.load(input)).toEqual({ status: status === 404 ? 'missing' : 'unavailable', reason: 'http-status', httpStatus: status });
  await loader.load(input); expect(fetcher).toHaveBeenCalledTimes(1); expect(getReader).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('network failure remains unavailable and a repeated call does not retry', async () => {
  const fetcher = vi.fn(async () => { throw Error('raw private error URL'); }); const loader = createOfficialRecoveryScheduleLoader({ fetcher });
  const result = await loader.load(input); expect(result).toEqual({ status: 'unavailable', reason: 'request-failed' });
  await loader.load(input); expect(fetcher).toHaveBeenCalledTimes(1); expect(JSON.stringify(result)).not.toContain('raw private');
});
it.each([null, ''])('missing or empty body is distinct from a valid empty schedule', async body => {
  const loader = createOfficialRecoveryScheduleLoader({ fetcher: vi.fn(async () => new Response(body)) });
  expect((await loader.load(input)).status).toBe('missing');
});
it.each(['bad-json', '[]', '{"leagueSchedule":{"seasonYear":"2026-27"}}'])('malformed body cannot become successful empty', async body => {
  expect((await createOfficialRecoveryScheduleLoader({ fetcher: vi.fn(async () => new Response(body)) }).load(input)).status).toBe('malformed');
});
it('wrong-season official envelope is distinct from missing data', async () => {
  expect(await createOfficialRecoveryScheduleLoader({ fetcher: vi.fn(async () => new Response(empty.replace('2026-27', '2025-26'))) }).load(input)).toMatchObject({ status: 'wrong-season', returnedSeason: '2025-26' });
});
it.each([['86401', 'stale'], ['86400', 'empty'], ['invalid', 'empty'], ['-1', 'empty']])('uses only a valid present HTTP Age (%s)', async (age, status) => {
  expect((await createOfficialRecoveryScheduleLoader({ fetcher: vi.fn(async () => new Response(empty, { headers: { age } })) }).load(input)).status).toBe(status);
});
it('oversized content length is cancelled before body reading', async () => {
  const getReader = vi.fn(), cancel = vi.fn(async () => {});
  const fetcher = vi.fn(async () => ({ status: 200, headers: new Headers({ 'content-length': String(OFFICIAL_SCHEDULE_MAX_BYTES + 1) }), body: { getReader, cancel } }) as unknown as Response);
  expect(await createOfficialRecoveryScheduleLoader({ fetcher }).load(input)).toMatchObject({ status: 'malformed', reason: 'body-too-large' });
  expect(getReader).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled();
});
it('streamed decoded body limit works without trusting content length', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(OFFICIAL_SCHEDULE_MAX_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel });
  expect(await createOfficialRecoveryScheduleLoader({ fetcher: vi.fn(async () => new Response(body)) }).load(input)).toMatchObject({ status: 'malformed', reason: 'body-too-large' });
  expect(cancel).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('times out noncooperative headers and cancels a late response body', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; }));
  const loader = createOfficialRecoveryScheduleLoader({ fetcher }), pending = loader.load(input);
  await vi.advanceTimersByTimeAsync(8000);
  expect(await pending).toEqual({ status: 'unavailable', reason: 'deadline-exhausted' });
  const cancel = vi.fn(async () => {}); resolve({ body: { cancel } } as unknown as Response); await Promise.resolve();
  expect(cancel).toHaveBeenCalled(); await loader.load(input); expect(fetcher).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it('one deadline includes delayed headers plus a noncooperative body and cleans up the abort listener', async () => {
  let resolveRead!: (part: ReadableStreamReadResult<Uint8Array>) => void;
  const cancel = vi.fn(async () => {}), releaseLock = vi.fn();
  const read = vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(r => { resolveRead = r; }));
  const remove = vi.spyOn(AbortSignal.prototype, 'removeEventListener');
  const fetcher = vi.fn(async () => { await new Promise(r => setTimeout(r, 5000)); return { status: 200, headers: new Headers(), body: { getReader: () => ({ read, cancel, releaseLock }) } } as unknown as Response; });
  const loader = createOfficialRecoveryScheduleLoader({ fetcher }), pending = loader.load(input);
  await vi.advanceTimersByTimeAsync(7999); expect(cancel).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(await pending).toMatchObject({ status: 'unavailable', reason: 'deadline-exhausted' });
  resolveRead({ done: false, value: new TextEncoder().encode(empty) }); await Promise.resolve();
  expect(await loader.load(input)).toMatchObject({ status: 'unavailable' }); expect(cancel).toHaveBeenCalled(); expect(releaseLock).toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function)); expect(vi.getTimerCount()).toBe(0);
});
it('post-body injected-clock deadline fails closed even without an aborting transport', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(empty)); controller.close(); } });
  const fetcher = vi.fn(async () => { vi.setSystemTime(new Date('2026-10-24T08:00:08Z')); return new Response(body); });
  expect(await createOfficialRecoveryScheduleLoader({ fetcher }).load(input)).toMatchObject({ status: 'unavailable', reason: 'deadline-exhausted' });
});
