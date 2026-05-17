import { NextResponse } from "next/server";
import { getFullSchedule, formatDate, type ScheduleGame } from "@/lib/api";
import { isPlayoff } from "@/lib/games";

export async function GET() {
  let schedule;
  try {
    schedule = await Promise.race([
      getFullSchedule(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
  } catch {
    return NextResponse.json({ recent: [], playoffs: [] }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  }

  // Recent finished games (past 3 days in ET)
  const recentFinished: ScheduleGame[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const [year, month, day] = dateStr.split("-");
    const scheduleDate = `${month}/${day}/${year}`;
    const found = schedule.find((gd) => gd.gameDate.startsWith(scheduleDate));
    if (found) {
      recentFinished.push(
        ...found.games
          .filter((g) => g.gameStatus === 3)
          .map((g) => ({
            ...g,
            // Strip unnecessary fields to reduce payload
            homeTeam: { ...g.homeTeam, teamSlug: "" },
            awayTeam: { ...g.awayTeam, teamSlug: "" },
          }))
      );
    }
  }

  // Playoff games
  const playoffGames = schedule
    .flatMap((gd) => gd.games)
    .filter((g) => isPlayoff(g.gameId) && g.gameStatus === 3)
    .map((g) => ({
      gameId: g.gameId,
      gameStatus: g.gameStatus,
      homeTeam: {
        teamId: g.homeTeam.teamId,
        teamTricode: g.homeTeam.teamTricode,
        score: g.homeTeam.score,
        seed: g.homeTeam.seed,
        teamCity: g.homeTeam.teamCity,
        teamName: g.homeTeam.teamName,
      },
      awayTeam: {
        teamId: g.awayTeam.teamId,
        teamTricode: g.awayTeam.teamTricode,
        score: g.awayTeam.score,
        seed: g.awayTeam.seed,
        teamCity: g.awayTeam.teamCity,
        teamName: g.awayTeam.teamName,
      },
    }));

  return NextResponse.json({
    recent: recentFinished.slice(0, 6),
    playoffs: playoffGames,
  }, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
  });
}
