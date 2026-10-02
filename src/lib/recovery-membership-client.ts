import { createHash } from 'node:crypto';
import { isMembershipRequest, MEMBERSHIP_REQUEST_LIMIT, type MembershipKind } from './recovery-membership-evidence';

export type MembershipResponse = { ok: true; body: unknown; retrievedAt: string; responseSha256: string } |
  { ok: false; reason: string; httpStatus?: number; code?: 'plan_required' };
/** Exact three-route diagnostic transport. No generic provider request method. */
export function createRecoveryMembershipClient(options: { apiKey: string; maxRequests: number; expiresAt: string; now?: () => number; fetcher?: typeof fetch }) {
  const now = options.now ?? Date.now, fetcher = options.fetcher ?? fetch, started = now();
  const midnight = Date.UTC(new Date(started).getUTCFullYear(), new Date(started).getUTCMonth(), new Date(started).getUTCDate() + 1);
  const expires = Date.parse(options.expiresAt);
  if (!Number.isSafeInteger(options.maxRequests) || options.maxRequests < 1 || options.maxRequests > MEMBERSHIP_REQUEST_LIMIT ||
    !Number.isFinite(expires) || expires <= started || expires > midnight) throw new Error('Invalid membership allowance');
  const deadline = Math.min(expires, started + 120_000), seen = new Set<string>();
  let requests = 0, stopped = false;
  return {
    get requestsMade() { return requests; },
    async get(kind: MembershipKind, id: string): Promise<MembershipResponse> {
      const path = `/v1/nba/games/${id}/${kind}`;
      const fail = (reason: string, httpStatus?: number): MembershipResponse => ({ ok: false, reason, ...(httpStatus === undefined ? {} : { httpStatus }) });
      if (!isMembershipRequest(kind, id)) return fail('invalid-diagnostic-target');
      if (!options.apiKey.trim()) return fail('not-configured');
      if (stopped || seen.has(path) || requests >= options.maxRequests || now() >= deadline) return fail('budget-or-deadline-exhausted');
      requests++; seen.add(path);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(8_000, deadline - now()));
      let abort = () => {};
      const aborted = new Promise<never>((_resolve, reject) => { abort = () => reject(new Error('deadline')); controller.signal.addEventListener('abort', abort, { once: true }); });
      try {
        const work = (async (): Promise<MembershipResponse> => {
          const response = await fetcher(`https://api.bigballsdata.com${path}`, { headers: { 'x-api-key': options.apiKey, Accept: 'application/json' }, redirect: 'error', signal: controller.signal });
          if (controller.signal.aborted || now() >= deadline) { stopped = true; return fail('deadline-exhausted'); }
          if (response.status !== 200) { stopped = true; return fail('provider-unavailable', response.status); }
          const length = response.headers.get('content-length');
          if (length && Number(length) > 100_000) { stopped = true; return fail('response-too-large'); }
          const text = await response.text();
          if (controller.signal.aborted || now() >= deadline) { stopped = true; return fail('deadline-exhausted'); }
          if (text.length > 100_000) { stopped = true; return fail('response-too-large'); }
          const body: unknown = JSON.parse(text);
          if (body && typeof body === 'object' && 'error' in body && body.error != null) {
            stopped = true;
            const code = typeof body.error === 'object' && 'code' in body.error && body.error.code === 'plan_required' ? 'plan_required' as const : undefined;
            return { ok: false, reason: 'provider-error-envelope', ...(code ? { code } : {}) };
          }
          if (response.headers.get('x-ratelimit-remaining') === '0') stopped = true;
          const responseSha256 = createHash('sha256').update(text).digest('hex');
          if (controller.signal.aborted || now() >= deadline) { stopped = true; return fail('deadline-exhausted'); }
          return { ok: true, body, retrievedAt: new Date(now()).toISOString(), responseSha256 };
        })();
        return await Promise.race([work, aborted]);
      } catch { stopped = true; return fail('provider-request-failed'); }
      finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); }
    },
  };
}
