import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayByPlay, type ShotAction } from "@/lib/api";

// Aggregate shot data for a player from play-by-play across multiple games
// Uses NBA CDN (free, no auth, no CORS issues)
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const teamTricode = request.nextUrl.searchParams.get("team");
  const seasonType = request.nextUrl.searchParams.get("seasonType") || "regular"; // "regular" | "playoffs" | "all"

  if (!playerId || !teamTricode) {
    return NextResponse.json({ error: "playerId and team required" }, { status: 400 });
  }

  const pid = parseInt(playerId, 10);
  if (isNaN(pid)) {
    return NextResponse.json({ error: "invalid playerId" }, { status: 400 });
  }

  try {
    const schedule = await getFullSchedule();

    // Find completed games for this team
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

    // Limit to most recent 30 games to keep response fast
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
      { shots: allShots, gamesLoaded: recentGames.length, totalGames: gameIds.length },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to aggregate shot data" }, { status: 500 });
  }
}
