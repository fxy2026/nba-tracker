import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule } from "@/lib/api";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  }

  try {
    const [year, monthNum] = month.split("-");
    const dates = await Promise.race([
      getFullSchedule(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);

    // Filter games for the requested month
    // Schedule dates use format "MM/DD/YYYY 00:00:00"
    const monthGames: { date: string; gameCount: number; games: { gameId: string; homeTricode: string; awayTricode: string; gameStatus: number; homeScore: number; awayScore: number }[] }[] = [];

    for (const gd of dates) {
      const datePart = gd.gameDate.split(" ")[0]; // "04/25/2026"
      const [m, d, y] = datePart.split("/");
      if (y === year && m === monthNum) {
        monthGames.push({
          date: `${y}-${m}-${d}`,
          gameCount: gd.games.length,
          games: gd.games.map((g) => ({
            gameId: g.gameId,
            homeTricode: g.homeTeam.teamTricode,
            awayTricode: g.awayTeam.teamTricode,
            gameStatus: g.gameStatus,
            homeScore: g.homeTeam.score,
            awayScore: g.awayTeam.score,
          })),
        });
      }
    }

    return NextResponse.json({ data: monthGames }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
