import { parseShotGameDate, orderUniqueShotGames, type DatedShotGame } from "@/lib/player-shot-game-order";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSeasonSchedule, getPlayByPlaySnapshot, type ShotAction } from "@/lib/api";
import { isRegular as isRegularGame, isPlayoff as isPlayoffGame } from "@/lib/games";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";
import { CURRENT_SEASON } from "@/lib/constants";

// Aggregate shot data for a player across multiple games.
// Current season: schedule (CDN) → game IDs → CDN PBP
// Historical: stats.nba.com playergamelog (server-side, bypasses CORS) → CDN PBP
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const teamTricode = request.nextUrl.searchParams.get("team");
  const seasonType = request.nextUrl.searchParams.get("seasonType") ?? "regular";
  const season = request.nextUrl.searchParams.get("season"); // explicit season also supports current-season TOT players

  if (!playerId || !teamTricode) {
    return NextResponse.json({ error: "playerId and team required" }, { status: 400 });
  }

  const pid = Number(playerId);
  if (!/^\d+$/.test(playerId) || !Number.isSafeInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid playerId" }, { status: 400 });
  }
  if (!["regular", "playoffs", "all"].includes(seasonType)) {
    return NextResponse.json({ error: "invalid seasonType" }, { status: 400 });
  }
  if (season !== null && (!/^\d{4}-\d{2}$/.test(season)
    || season.slice(5) !== String((Number(season.slice(0, 4)) + 1) % 100).padStart(2, "0"))) {
    return NextResponse.json({ error: "invalid season" }, { status: 400 });
  }

  try {
    const gameIds = season !== null
      ? await getGameIdsFromStatsNba(pid, season, seasonType)
      : await getGameIdsFromSchedule(teamTricode, seasonType);
    if (gameIds === null) {
      return NextResponse.json({ error: "Player game log unavailable" }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }

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
        batch.map((gid) => getPlayByPlaySnapshot(gid, { final }).catch(() => ({ shots: [], available: false, stale: false })))
      );
      if (results.some(result => !result.available || result.stale)) {
        return NextResponse.json({ error: "Player shot data unavailable" }, {
          status: 503, headers: { "Cache-Control": "no-store" },
        });
      }
      for (const result of results) {
        for (const s of result.shots) {
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
async function getGameIdsFromSchedule(teamTricode: string, seasonType: string): Promise<string[] | null> {
  const schedule = await getCurrentSeasonSchedule();
  const games: DatedShotGame[] = [];
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
      const date = parseShotGameDate(gd.gameDate);
      if (!date) return null;
      games.push({ gameId: g.gameId, date });
    }
  }
  return orderUniqueShotGames(games);
}

// Historical seasons: fetch game IDs from stats.nba.com playergamelog (server-side, no CORS).
async function getGameIdsFromStatsNba(playerId: number, season: string, seasonType: string): Promise<string[] | null> {
  const types = seasonType === "all"
    ? ["Regular Season", "Playoffs"]
    : [seasonType === "playoffs" ? "Playoffs" : "Regular Season"];

  const games: DatedShotGame[] = [];
  for (const st of types) {
    const url = `${STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${encodeURIComponent(season)}&SeasonType=${encodeURIComponent(st)}`;
    // stats.nba.com data is stable for past seasons — cache 24h
    try {
      const res = await fetchStats(url, { key: "playergamelog", revalidate: 86400 });
      if (!res?.ok) return null;
      const data = await res.json();
      const rs = Array.isArray(data?.resultSets) ? data.resultSets[0] : null;
      if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)
        || !rs.headers.every((header: unknown) => typeof header === "string")
        || new Set(rs.headers).size !== rs.headers.length) return null;
      const gi = rs.headers.indexOf("Game_ID") >= 0 ? rs.headers.indexOf("Game_ID") : rs.headers.indexOf("GAME_ID");
      const di = rs.headers.indexOf("GAME_DATE");
      if (gi < 0 || di < 0) return null;
      for (const row of rs.rowSet) {
        if (!Array.isArray(row) || row.length < rs.headers.length
          || typeof row[gi] !== "string" || !/^\d{10}$/.test(row[gi])) return null;
        const date = parseShotGameDate(row[di]);
        if (!date) return null;
        games.push({ gameId: row[gi], date });
      }
    } catch {
      return null;
    }
  }
  return orderUniqueShotGames(games);
}
