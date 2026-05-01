import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayByPlay, type ShotAction } from "@/lib/api";

const STATS_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

// Aggregate shot data for a player across multiple games
// Current season: uses schedule + CDN PBP
// Historical seasons: uses playergamelog (stats.nba.com) + CDN PBP
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const teamTricode = request.nextUrl.searchParams.get("team");
  const seasonType = request.nextUrl.searchParams.get("seasonType") || "regular";
  const season = request.nextUrl.searchParams.get("season"); // e.g. "2023-24", null = current

  if (!playerId || !teamTricode) {
    return NextResponse.json({ error: "playerId and team required" }, { status: 400 });
  }

  const pid = parseInt(playerId, 10);
  if (isNaN(pid)) {
    return NextResponse.json({ error: "invalid playerId" }, { status: 400 });
  }

  try {
    let gameIds: string[];

    if (!season) {
      // Current season: use schedule from CDN
      gameIds = await getGameIdsFromSchedule(teamTricode, seasonType);
    } else {
      // Historical: use playergamelog from stats.nba.com
      gameIds = await getGameIdsFromGameLog(pid, season, seasonType);
    }

    // Limit to most recent 30 games
    const totalGames = gameIds.length;
    const recentGames = gameIds.slice(-30);

    // Fetch PBP for each game in parallel (batches of 5)
    const allShots: ShotAction[] = [];
    for (let i = 0; i < recentGames.length; i += 5) {
      const batch = recentGames.slice(i, i + 5);
      const results = await Promise.all(
        batch.map((gid) => getPlayByPlay(gid).catch(() => []))
      );
      for (const shots of results) {
        for (const s of shots) {
          if (s.personId === pid && s.actionType !== "freethrow") {
            allShots.push(s);
          }
        }
      }
    }

    return NextResponse.json(
      { shots: allShots, gamesLoaded: recentGames.length, totalGames },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to aggregate shot data" }, { status: 500 });
  }
}

// Get game IDs from current season schedule (CDN)
async function getGameIdsFromSchedule(teamTricode: string, seasonType: string): Promise<string[]> {
  const schedule = await getFullSchedule();
  const gameIds: string[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      const isTeamGame = g.homeTeam.teamTricode === teamTricode || g.awayTeam.teamTricode === teamTricode;
      if (!isTeamGame) continue;
      const isRegular = g.gameId.startsWith("002");
      const isPlayoff = g.gameId.startsWith("004");
      if (seasonType === "regular" && !isRegular) continue;
      if (seasonType === "playoffs" && !isPlayoff) continue;
      if (seasonType === "all" && !isRegular && !isPlayoff) continue;
      gameIds.push(g.gameId);
    }
  }
  return gameIds;
}

// Get game IDs from stats.nba.com playergamelog (historical seasons)
async function getGameIdsFromGameLog(playerId: number, season: string, seasonType: string): Promise<string[]> {
  const types = seasonType === "all"
    ? ["Regular+Season", "Playoffs"]
    : [seasonType === "regular" ? "Regular+Season" : "Playoffs"];

  const gameIds: string[] = [];
  for (const st of types) {
    try {
      const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerId}&Season=${season}&SeasonType=${st}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { headers: STATS_HEADERS, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const rs = data.resultSets?.[0];
      if (!rs?.rowSet) continue;
      const gi = rs.headers.indexOf("Game_ID");
      for (const row of rs.rowSet) {
        gameIds.push(row[gi] as string);
      }
    } catch { /* timeout or network error */ }
  }
  return gameIds;
}
