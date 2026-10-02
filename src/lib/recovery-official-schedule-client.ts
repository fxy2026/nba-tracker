import { createHash } from 'node:crypto';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, OFFICIAL_SCHEDULE_MAX_AGE_MS, officialScheduleSeasonYear,
  projectOfficialRecoverySchedule, type OfficialScheduleResult } from './recovery-official-schedule';

export const OFFICIAL_SCHEDULE_TIMEOUT_MS = 8_000;
export const OFFICIAL_SCHEDULE_MAX_BYTES = 16 * 1024 * 1024;

/** Create once per backfill run. Every eligible caller shares one request and
 * its result; other modes cannot consume a request or reset a failed attempt. */
export function createOfficialRecoveryScheduleLoader(options: { fetcher?: typeof fetch; now?: () => number } = {}) {
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now;
  let attempt: { season: string; result: Promise<OfficialScheduleResult> } | null = null;
  async function request(expectedSeason: string): Promise<OfficialScheduleResult> {
    const started = now();
    if (!Number.isFinite(started) || !Number.isFinite(new Date(started).getTime())) return { status: 'malformed', reason: 'invalid-clock' };
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let bodyComplete = false;
    const cancel = () => { try { void reader?.cancel().catch(() => {}); } catch { /* No upstream text is exposed. */ } };
    let onAbort = () => {};
    const aborted = new Promise<OfficialScheduleResult>(resolve => {
      onAbort = () => { cancel(); resolve({ status: 'unavailable', reason: 'deadline-exhausted' }); };
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => controller.abort(), OFFICIAL_SCHEDULE_TIMEOUT_MS);
    const expired = () => controller.signal.aborted || !Number.isFinite(now()) || now() < started || now() - started >= OFFICIAL_SCHEDULE_TIMEOUT_MS;
    try {
      const work = (async (): Promise<OfficialScheduleResult> => {
        const response = await fetcher(OFFICIAL_RECOVERY_SCHEDULE_URL, {
          headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: controller.signal,
        });
        if (expired()) { void response.body?.cancel().catch(() => {}); return { status: 'unavailable', reason: 'deadline-exhausted' }; }
        if (response.status !== 200) {
          void response.body?.cancel().catch(() => {});
          return { status: response.status === 404 ? 'missing' : 'unavailable', reason: 'http-status', httpStatus: response.status };
        }
        const declared = response.headers.get('content-length');
        if (declared && /^\d+$/.test(declared) && Number(declared) > OFFICIAL_SCHEDULE_MAX_BYTES) {
          void response.body?.cancel().catch(() => {}); return { status: 'malformed', reason: 'body-too-large' };
        }
        const age = response.headers.get('age');
        if (age && /^\d+$/.test(age) && Number.isSafeInteger(Number(age)) && Number(age) * 1000 > OFFICIAL_SCHEDULE_MAX_AGE_MS) {
          void response.body?.cancel().catch(() => {}); return { status: 'stale', reason: 'http-age-expired' };
        }
        if (!response.body) return { status: 'missing', reason: 'missing-body' };
        reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        while (true) {
          const part = await reader.read();
          if (expired()) return { status: 'unavailable', reason: 'deadline-exhausted' };
          if (part.done) { bodyComplete = true; break; }
          bytes += part.value.byteLength;
          if (bytes > OFFICIAL_SCHEDULE_MAX_BYTES) return { status: 'malformed', reason: 'body-too-large' };
          chunks.push(part.value);
        }
        if (bytes === 0) return { status: 'missing', reason: 'empty-body' };
        const body = Buffer.concat(chunks, bytes);
        let raw: unknown;
        try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
        catch { return { status: 'malformed', reason: 'invalid-json' }; }
        if (expired()) return { status: 'unavailable', reason: 'deadline-exhausted' };
        const observedAt = new Date(now()).toISOString();
        const result = projectOfficialRecoverySchedule(raw, { expectedSeason, now: observedAt,
          source: { url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: createHash('sha256').update(body).digest('hex'), observedAt } });
        return expired() ? { status: 'unavailable', reason: 'deadline-exhausted' } : result;
      })();
      return await Promise.race([work, aborted]);
    } catch { return { status: 'unavailable', reason: 'request-failed' }; }
    finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort);
      if (!bodyComplete) cancel();
      try { reader?.releaseLock(); } catch { /* A noncooperative read may still be settling. */ }
    }
  }
  return {
    load(input: { mode: string; expectedSeason: string }): Promise<OfficialScheduleResult> {
      if (input.mode !== 'backfill') return Promise.resolve({ status: 'not-requested', reason: 'mode-excluded' });
      if (officialScheduleSeasonYear(input.expectedSeason) === null) return Promise.resolve({ status: 'malformed', reason: 'invalid-expected-season' });
      if (attempt) return attempt.season === input.expectedSeason ? attempt.result : Promise.resolve({ status: 'malformed', reason: 'loader-season-already-bound' });
      // Defer execution until after binding the shared promise, including for
      // unusual synchronously reentrant test transports.
      const result = Promise.resolve().then(() => request(input.expectedSeason));
      attempt = { season: input.expectedSeason, result };
      return result;
    },
  };
}
