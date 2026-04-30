import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate, getTodayScoreboard, formatDate } from "@/lib/api";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const today = formatDate(new Date());
    const isToday = date === today;

    let games;
    if (isToday) {
      // Use live scoreboard for today — real-time scores
      const liveGames = await getTodayScoreboard();
      games = liveGames.map((g) => ({
        gameId: g.gameId,
        gameCode: g.gameCode,
        gameStatus: g.gameStatus,
        gameStatusText: g.gameStatusText,
        gameDateTimeUTC: g.gameTimeUTC,
        homeTeam: { ...g.homeTeam, teamSlug: "", wins: g.homeTeam.wins || 0, losses: g.homeTeam.losses || 0, seed: g.homeTeam.seed || 0 },
        awayTeam: { ...g.awayTeam, teamSlug: "", wins: g.awayTeam.wins || 0, losses: g.awayTeam.losses || 0, seed: g.awayTeam.seed || 0 },
        seriesText: g.seriesText,
      }));
    } else {
      games = await getGamesByDate(date);
    }

    // Smart caching: today = short (live), past = long, future = medium
    const cacheControl = isToday
      ? "public, s-maxage=30, stale-while-revalidate=120"
      : date < today
      ? "public, s-maxage=3600, stale-while-revalidate=86400"
      : "public, s-maxage=300, stale-while-revalidate=3600";

    return NextResponse.json(
      { data: games },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
