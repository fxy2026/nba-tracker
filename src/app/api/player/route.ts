import { NextRequest, NextResponse } from "next/server";
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";

// Worst case is serial: a 4s stats.nba.com timeout, then the ESPN fallback
// chain (5s roster lookup + 5s stats) — Vercel's 10s default kills that.
export const maxDuration = 15;

// Map a stats.nba.com resultSet (parallel arrays: headers + rowSet) into objects.
function parseResultSet(rs: { headers: string[]; rowSet: unknown[][] } | undefined): Record<string, unknown>[] | null {
  if (!rs?.rowSet) return null;
  const { headers, rowSet } = rs;
  return rowSet.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    return obj;
  });
}

// Try NBA Stats API (may be blocked on some hosts)
async function fetchCareerSeasons(playerId: string): Promise<unknown[] | null> {
  const res = await fetchStats(
    `${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`,
    { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600 },
  );
  if (!res?.ok) return null;
  try {
    const data = await res.json();
    const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
    return parseResultSet(rs);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  const playerName = request.nextUrl.searchParams.get("name");
  const teamTricode = request.nextUrl.searchParams.get("team");
  if (!playerId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!/^\d+$/.test(playerId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // 1) Try NBA Stats API first (fast when not blocked)
  let careerSeasons: unknown[] | null = await fetchCareerSeasons(playerId);

  // 2) If NBA Stats failed, fallback to ESPN
  if (!careerSeasons && playerName && teamTricode) {
    try {
      const espnId = await findESPNId(playerName, teamTricode);
      if (espnId) {
        const espnResult = await getESPNCareerStats(espnId);
        if (espnResult.careerSeasons.length > 0) {
          careerSeasons = espnResult.careerSeasons;
        }
      }
    } catch { /* ESPN also failed */ }
  }

  // recentGames stays in the response shape for existing consumers but is
  // always null: playergamelog is blackholed from Vercel and never succeeded
  // in prod, so clients already render their no-recent-games fallback.
  return NextResponse.json({ careerSeasons, recentGames: null }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
