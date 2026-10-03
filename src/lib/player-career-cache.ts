import { normalizePlayerCareerData, type PlayerCareerData } from "./player-career-data";

export const CAREER_CLIENT_TIMEOUT_MS = 18_000;
export const CAREER_SUCCESS_TTL_MS = 5 * 60_000;
export const CAREER_FAILURE_COOLDOWN_MS = 30_000;
export interface CareerLoadResult { data: PlayerCareerData | null; unavailable: boolean; stale: boolean; }
interface Entry { data: PlayerCareerData | null; expiresAt: number; retryAt: number; }

// Shared by both career panels. No background requests: refresh only on a
// consumer mount or explicit retry. A failed refresh preserves last good rows.
export function createPlayerCareerLoader(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, Entry>();
  const inflight = new Map<string, Promise<CareerLoadResult>>();
  const snapshot = (entry?: Entry): CareerLoadResult => ({
    data: entry?.data ?? null, unavailable: true, stale: !!entry?.data,
  });
  const listeners = new Map<string, Set<(result: CareerLoadResult) => void>>();
  const publish = (url: string, result: CareerLoadResult) => {
    for (const listener of listeners.get(url) ?? []) listener(result);
    return result;
  };
  function load(url: string, retry = false): Promise<CareerLoadResult> {
    const pending = inflight.get(url);
    if (pending) return pending;
    const entry = cache.get(url);
    if (entry && now() < entry.retryAt) return Promise.resolve(snapshot(entry));
    if (!retry && entry?.data && now() < entry.expiresAt) {
      return Promise.resolve({ data: entry.data, unavailable: false, stale: false });
    }
    const request = (async (): Promise<CareerLoadResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CAREER_CLIENT_TIMEOUT_MS);
      try {
        const res = await fetcher(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`player api ${res.status}`);
        const data = normalizePlayerCareerData(await res.json());
        if (controller.signal.aborted || !data) throw new Error("unavailable career data");
        // A complete career cannot silently lose previously observed seasons.
        // Providers can change team splits or correct stats within a season,
        // so compare season identities rather than row counts or GP totals.
        // Retain the entire last-good snapshot (including source metadata)
        // with the failure/stale state instead of mixing provider snapshots.
        // Entries remain scoped to this exact player/request URL; a first
        // successful empty response still means no available history.
        const seasons = new Set(data.careerSeasons.map(row => row.SEASON_ID));
        if (entry?.data?.careerSeasons.some(row => !seasons.has(row.SEASON_ID))) {
          throw new Error("incomplete career refresh");
        }
        cache.set(url, { data, expiresAt: now() + CAREER_SUCCESS_TTL_MS, retryAt: 0 });
        return publish(url, { data, unavailable: false, stale: false });
      } catch {
        cache.set(url, { data: entry?.data ?? null, expiresAt: 0, retryAt: now() + CAREER_FAILURE_COOLDOWN_MS });
        return publish(url, snapshot(entry));
      } finally {
        clearTimeout(timer);
        // Keep retained browser-session data bounded; in-flight work is separate.
        if (cache.size > 50) cache.delete(cache.keys().next().value!);
      }
    })();
    inflight.set(url, request);
    void request.finally(() => { if (inflight.get(url) === request) inflight.delete(url); });
    return request;
  }
  return Object.assign(load, {
    subscribe(url: string, listener: (result: CareerLoadResult) => void) {
      const group = listeners.get(url) ?? new Set();
      group.add(listener); listeners.set(url, group);
      return () => { group.delete(listener); if (!group.size) listeners.delete(url); };
    },
  });
}
