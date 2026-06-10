import { NextRequest, NextResponse } from "next/server";

const STATS_BASE = "https://stats.nba.com/stats";
const HEADERS: HeadersInit = {
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

// Proxy for stats.nba.com — avoids CORS issues, adds timeout + security
const ALLOWED_ENDPOINTS = new Set([
  "leagueleaders", "playercareerstats", "playergamelog",
  "draftcombineplayeranthro", "commonplayerinfo",
  "shotchartdetail", "leaguedashteamstats", "playerawards",
]);

// Vercel kills functions at 10s by default — these upstreams are slower cold
export const maxDuration = 30;

// shotchartdetail is a genuinely large payload that's reachable but slow.
// playerawards/leaguedashteamstats are blackholed from Vercel IPs and never
// succeed in prod — keep their timeout short so the client fetch fails fast and
// the UI's fallback (static honor wall / schedule-only team boards) appears
// quickly instead of after a 20s hang.
const TIMEOUT_MS: Record<string, number> = {
  shotchartdetail: 20000,
  playerawards: 6000,
  leaguedashteamstats: 6000,
};
const DEFAULT_TIMEOUT = 8000;

// Draft combine anthro data for a past draft year never changes — long TTL
const REVALIDATE: Record<string, number> = {
  draftcombineplayeranthro: 86400,
  // league-wide team averages move slowly — hourly is plenty
  leaguedashteamstats: 3600,
  // career awards change at most a few times per year — daily is plenty
  playerawards: 86400,
};
const DEFAULT_REVALIDATE = 300;

// stats.nba.com blackholes some endpoints for datacenter IPs (request hangs
// until our abort). After a timeout, fail fast for 15 min instead of burning
// a 20s serverless invocation per visitor. Per warm instance — good enough.
const BLACKHOLED_UNTIL = new Map<string, number>();
const BLACKHOLE_TTL_MS = 15 * 60 * 1000;

function respond(data: unknown, limit: number, revalidate: number) {
  if (Number.isInteger(limit) && limit > 0) {
    const d = data as { resultSet?: { rowSet?: unknown[][] }; resultSets?: { rowSet?: unknown[][] }[] };
    const rs = d.resultSet ?? d.resultSets?.[0];
    if (rs?.rowSet) rs.rowSet = rs.rowSet.slice(0, limit);
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}` },
  });
}

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  // Whitelist endpoints to prevent open proxy abuse
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: "endpoint not allowed" }, { status: 403 });
  }

  // "limit" is ours, not stats.nba.com's — keep it out of the upstream URL
  // so it doesn't fragment the data-cache key per limit value.
  const limit = Number(request.nextUrl.searchParams.get("limit"));

  // Build query string from remaining params
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "endpoint" && k !== "limit") params.set(k, v);
  });

  const url = `${STATS_BASE}/${endpoint}?${params.toString()}`;
  const timeout = TIMEOUT_MS[endpoint] || DEFAULT_TIMEOUT;
  const revalidate = REVALIDATE[endpoint] ?? DEFAULT_REVALIDATE;

  // When the breaker is open we still attempt the fetch, but with a short
  // timeout: Next's data-cache hits return in milliseconds and succeed, while
  // upstream misses fail fast instead of being denied data that costs nothing.
  const blockedUntil = BLACKHOLED_UNTIL.get(endpoint);
  const breakerOpen = !!blockedUntil && Date.now() < blockedUntil;
  const fetchTimeout = breakerOpen ? 1500 : timeout;

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate },
      signal: AbortSignal.timeout(fetchTimeout),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `NBA API returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    BLACKHOLED_UNTIL.delete(endpoint);
    return respond(data, limit, revalidate);
  } catch {
    // Only a full-timeout failure arms/extends the breaker — the short probe
    // must leave the existing deadline so the breaker still half-opens on time.
    if (!breakerOpen) BLACKHOLED_UNTIL.set(endpoint, Date.now() + BLACKHOLE_TTL_MS);
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
