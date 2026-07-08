import { NextRequest, NextResponse } from "next/server";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

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
  const revalidate = REVALIDATE[endpoint] ?? DEFAULT_REVALIDATE;

  const res = await fetchStats(url, {
    key: endpoint,
    timeoutMs: TIMEOUT_MS[endpoint] || DEFAULT_TIMEOUT,
    revalidate,
  });
  if (!res) {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `NBA API returned ${res.status}` },
      { status: res.status }
    );
  }
  try {
    return respond(await res.json(), limit, revalidate);
  } catch {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
