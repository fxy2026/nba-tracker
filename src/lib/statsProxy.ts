export const STATS_BASE = "https://stats.nba.com/stats";

export const STATS_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

// stats.nba.com blackholes some endpoints for datacenter IPs (the request
// hangs until our abort). After a timeout, fail fast for 15 min instead of
// burning a full-timeout serverless invocation per visitor. Per warm
// instance — good enough.
const BLACKHOLED_UNTIL = new Map<string, number>();
const BLACKHOLE_TTL_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 1500;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_REVALIDATE = 300;

export async function fetchStats(
  url: string,
  opts: { key: string; timeoutMs?: number; revalidate?: number },
): Promise<Response | null> {
  const { key, timeoutMs = DEFAULT_TIMEOUT_MS, revalidate = DEFAULT_REVALIDATE } = opts;

  // When the breaker is open we still attempt the fetch, but with a short
  // timeout: Next's data-cache hits return in milliseconds and succeed, while
  // upstream misses fail fast instead of being denied cheap cached responses.
  const blockedUntil = BLACKHOLED_UNTIL.get(key);
  const breakerOpen = !!blockedUntil && Date.now() < blockedUntil;
  const fetchTimeout = breakerOpen ? PROBE_TIMEOUT_MS : timeoutMs;

  try {
    const res = await fetch(url, {
      headers: STATS_HEADERS,
      next: { revalidate },
      signal: AbortSignal.timeout(fetchTimeout),
    });
    BLACKHOLED_UNTIL.delete(key);
    return res;
  } catch {
    // Only a full-timeout failure arms/extends the breaker — the short probe
    // must leave the existing deadline so the breaker still half-opens on time.
    if (!breakerOpen) BLACKHOLED_UNTIL.set(key, Date.now() + BLACKHOLE_TTL_MS);
    return null;
  }
}
