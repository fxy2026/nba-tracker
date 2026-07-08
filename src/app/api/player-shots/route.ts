import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayByPlay, type ShotAction } from "@/lib/api";
import { isRegular as isRegularGame, isPlayoff as isPlayoffGame } from "@/lib/games";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";
import { CURRENT_SEASON } from "@/lib/constants";

// Aggregate shot data for a player across multiple games.
// Current season: schedule (CDN) → game IDs → CDN PBP
// Historical: stats.nba.com playergamelog (server-side, bypasses CORS) → CDN PBP
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const teamTricode = request.nextUrl.searchParams.get("team");
  const seasonType = request.nextUrl.searchParams.get("seasonType") || "regular";
  const season = request.nextUrl.searchParams.get("season"); // e.g. "2023-24" (historical only)

  if (!playerId || !teamTricode) {
    return NextResponse.json({ error: "playerId and team required" }, { status: 400 });
  }

  const pid = parseInt(playerId, 10);
  if (isNaN(pid)) {
    return NextResponse.json({ error: "invalid playerId" }, { status: 400 });
  }

  try {
    const gameIds = season
      ? await getGameIdsFromStatsNba(pid, season, seasonType)
      : await getGameIdsFromSchedule(teamTricode, seasonType);

    // Limit to most recent 30 games
    const totalGames = gameIds.length;
    const recentGames = gameIds.slice(-30);

    // The schedule path (no season param) filters gameStatus===3 and past
    // stats.nba.com seasons are finished, so those PBP entries can be pinned
    // as final. A stats.nba.com query for CURRENT_SEASON (career-arc TOT
    // players) can include games that aren't provably final — don't pin.
    const final = !season || season !== CURRENT_SEASON;

    // Fetch PBP for each game in parallel (batches of 5)
    const allShots: ShotAction[] = [];
    for (let i = 0; i < recentGames.length; i += 5) {
      const batch = recentGames.slice(i, i + 5);
      const results = await Promise.all(
        batch.map((gid) => getPlayByPlay(gid, { final }).catch(() => []))
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
    return NextResponse.json({ error: "Failed to aggregate shot data" }, { status: 500, headers: { "Cache-Control": "no-store" } });
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
      const isRegular = isRegularGame(g.gameId);
      const isPlayoff = isPlayoffGame(g.gameId);
      if (seasonType === "regular" && !isRegular) continue;
      if (seasonType === "playoffs" && !isPlayoff) continue;
      if (seasonType === "all" && !isRegular && !isPlayoff) continue;
      gameIds.push(g.gameId);
    }
  }
  return gameIds;
}

// Historical seasons: fetch game IDs from stats.nba.com playergamelog (server-side, no CORS).
async function getGameIdsFromStatsNba(playerId: number, season: string, seasonType: string): Promise<string[]> {
  const types = seasonType === "all"
    ? ["Regular Season", "Playoffs"]
    : [seasonType === "playoffs" ? "Playoffs" : "Regular Season"];

  const gameIds: string[] = [];
  for (const st of types) {
    const url = `${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${encodeURIComponent(season)}&SeasonType=${encodeURIComponent(st)}`;
    // stats.nba.com data is stable for past seasons — cache 24h
    const res = await fetchStats(url, { key: "playergamelog", revalidate: 86400 });
    if (!res?.ok) continue;
    try {
      const data = await res.json();
      const rs = data.resultSets?.[0];
      if (!rs?.rowSet) continue;
      const gi = rs.headers.indexOf("Game_ID");
      if (gi < 0) continue;
      for (const row of rs.rowSet) {
        if (row[gi]) gameIds.push(row[gi] as string);
      }
    } catch {
      // parse error — try next season type
    }
  }
  return gameIds;
}

