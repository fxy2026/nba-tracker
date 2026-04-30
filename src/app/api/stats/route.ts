import { NextRequest, NextResponse } from "next/server";

const STATS_BASE = "https://stats.nba.com/stats";
const HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json",
};

// Proxy for stats.nba.com — avoids CORS issues, adds timeout + security
const ALLOWED_ENDPOINTS = new Set([
  "leagueleaders", "playercareerstats", "playergamelog",
  "draftcombineplayeranthro", "commonplayerinfo",
]);

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  // Whitelist endpoints to prevent open proxy abuse
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: "endpoint not allowed" }, { status: 403 });
  }

  // Build query string from remaining params
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "endpoint") params.set(k, v);
  });

  const url = `${STATS_BASE}/${endpoint}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json(
        { error: `NBA API returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
