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
  "shotchartdetail",
]);

// shotchartdetail is slow (large payload) — give it more time
const TIMEOUT_MS: Record<string, number> = {
  shotchartdetail: 20000,
};
const DEFAULT_TIMEOUT = 8000;

// Draft combine anthro data for a past draft year never changes — long TTL
const REVALIDATE: Record<string, number> = {
  draftcombineplayeranthro: 86400,
};
const DEFAULT_REVALIDATE = 300;

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

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json(
        { error: `NBA API returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    if (Number.isInteger(limit) && limit > 0) {
      const rs = data.resultSet ?? data.resultSets?.[0];
      if (rs?.rowSet) rs.rowSet = rs.rowSet.slice(0, limit);
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}` },
    });
  } catch {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
