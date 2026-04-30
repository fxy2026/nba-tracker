import { NextRequest, NextResponse } from "next/server";
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { CURRENT_SEASON } from "@/lib/constants";

const NBA_STATS_BASE = "https://stats.nba.com/stats";
const NBA_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json",
};

async function fetchSafe(url: string, headers: HeadersInit, revalidate: number): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { headers, next: { revalidate }, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch { return null; }
}

// Try NBA Stats API (may be blocked on some hosts)
async function fetchFromNBAStats(playerId: string) {
  const [careerRes, gameLogRes] = await Promise.all([
    fetchSafe(`${NBA_STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`, NBA_HEADERS, 3600),
    fetchSafe(`${NBA_STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${CURRENT_SEASON}&SeasonType=Regular+Season`, NBA_HEADERS, 300),
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
