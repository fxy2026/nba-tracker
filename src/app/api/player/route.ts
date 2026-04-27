import { NextRequest, NextResponse } from "next/server";

const STATS_BASE = "https://stats.nba.com/stats";
const HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json",
};

// Combined player data endpoint — fetches career stats + game log in ONE request
// Eliminates client-side waterfall of multiple API calls
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  if (!playerId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Fetch career stats and game log in parallel
  const [careerRes, gameLogRes] = await Promise.all([
    fetch(`${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`, {
      headers: HEADERS,
      next: { revalidate: 3600 },
    }).catch(() => null),
    fetch(`${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=2024-25&SeasonType=Regular+Season`, {
      headers: HEADERS,
      next: { revalidate: 300 },
    }).catch(() => null),
  ]);

  let careerSeasons = null;
  let recentGames = null;

  if (careerRes?.ok) {
    try {
      const data = await careerRes.json();
      const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
      if (rs) {
        const headers: string[] = rs.headers;
        careerSeasons = rs.rowSet.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        });
      }
    } catch { /* ignore */ }
  }

  if (gameLogRes?.ok) {
    try {
      const data = await gameLogRes.json();
      const rs = data.resultSets?.[0];
      if (rs) {
        const headers: string[] = rs.headers;
        recentGames = rs.rowSet.slice(0, 10).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        });
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    careerSeasons,
    recentGames,
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
