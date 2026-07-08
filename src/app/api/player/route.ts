import { NextRequest, NextResponse } from "next/server";
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { CURRENT_SEASON } from "@/lib/constants";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

// Map a stats.nba.com resultSet (parallel arrays: headers + rowSet) into objects.
function parseResultSet(rs: { headers: string[]; rowSet: unknown[][] } | undefined, limit?: number): Record<string, unknown>[] | null {
  if (!rs?.rowSet) return null;
  const { headers, rowSet } = rs;
  const rows = limit ? rowSet.slice(0, limit) : rowSet;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    return obj;
  });
}

// Try NBA Stats API (may be blocked on some hosts)
async function fetchFromNBAStats(playerId: string) {
  const [careerRes, gameLogRes] = await Promise.all([
    fetchStats(`${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`, { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600 }),
    fetchStats(`${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${CURRENT_SEASON}&SeasonType=Regular+Season`, { key: "playergamelog", timeoutMs: 4000, revalidate: 300 }),
  ]);

  // Use `unknown[]` so the ESPN fallback in the caller can substitute its own shape.
  let careerSeasons: unknown[] | null = null;
  let recentGames: unknown[] | null = null;

  if (careerRes?.ok) {
    try {
      const data = await careerRes.json();
      const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
      careerSeasons = parseResultSet(rs);
    } catch { /* ignore */ }
  }

  if (gameLogRes?.ok) {
    try {
      const data = await gameLogRes.json();
      recentGames = parseResultSet(data.resultSets?.[0], 10);
    } catch { /* ignore */ }
  }

  return { careerSeasons, recentGames };
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  const playerName = request.nextUrl.searchParams.get("name");
  const teamTricode = request.nextUrl.searchParams.get("team");
  if (!playerId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // 1) Try NBA Stats API first (fast when not blocked)
  let result = await fetchFromNBAStats(playerId);

  // 2) If NBA Stats failed, fallback to ESPN
  if (!result.careerSeasons && playerName && teamTricode) {
    try {
      const espnId = await findESPNId(playerName, teamTricode);
      if (espnId) {
        const espnResult = await getESPNCareerStats(espnId);
        if (espnResult.careerSeasons.length > 0) {
          result = { careerSeasons: espnResult.careerSeasons, recentGames: result.recentGames };
        }
      }
    } catch { /* ESPN also failed */ }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
