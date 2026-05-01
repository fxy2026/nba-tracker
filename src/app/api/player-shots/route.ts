import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayByPlay, type ShotAction } from "@/lib/api";

// Aggregate shot data for a player across multiple games
// Current season: schedule (CDN) → game IDs → CDN PBP
// Historical: client sends game IDs (fetched from stats.nba.com browser-side) → CDN PBP
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const teamTricode = request.nextUrl.searchParams.get("team");
  const seasonType = request.nextUrl.searchParams.get("seasonType") || "regular";
  const gameIdsParam = request.nextUrl.searchParams.get("gameIds"); // comma-separated, from client

  if (!playerId || !teamTricode) {
    return NextResponse.json({ error: "playerId and team required" }, { status: 400 });
  }

  const pid = parseInt(playerId, 10);
  if (isNaN(pid)) {
    return NextResponse.json({ error: "invalid playerId" }, { status: 400 });
  }

  try {
    let gameIds: string[];

    if (gameIdsParam) {
      // Client provided game IDs (historical seasons, fetched client-side)
      gameIds = gameIdsParam.split(",").filter(Boolean);
    } else {
      // Current season: use schedule from CDN
      gameIds = await getGameIdsFromSchedule(teamTricode, seasonType);
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

