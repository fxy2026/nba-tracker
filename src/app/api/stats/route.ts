import { NextRequest, NextResponse } from "next/server";

const STATS_BASE = "https://stats.nba.com/stats";
const HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json",
};

// Proxy for stats.nba.com — avoids CORS issues
export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  // Build query string from remaining params
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "endpoint") params.set(k, v);
  });

  const url = `${STATS_BASE}/${endpoint}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 300 }, // cache 5 min
    });
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
    return NextResponse.json({ error: "Failed to fetch from NBA API" }, { status: 500 });
  }
}
