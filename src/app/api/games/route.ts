import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate, getTodayScoreboard, getFullSchedule, formatDate, type ScheduleGame } from "@/lib/api";

// "YYYY-MM-DD" of a UTC instant in the given IANA timezone.
function dateInTz(utcIso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcIso));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const tzParam = request.nextUrl.searchParams.get("tz");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  let tz: string | null = null;
  if (tzParam) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tzParam });
      tz = tzParam;
    } catch {
      tz = null;
    }
  }

  try {
    const etToday = formatDate(new Date());
    const localToday = tz ? dateInTz(new Date().toISOString(), tz) : etToday;
    const isToday = date === localToday;

    let games: ScheduleGame[];

    if (tz) {
      // Timezone-aware: scan full schedule, pick games whose UTC tipoff falls
      // on `date` in `tz`. This is what a Beijing user means by "today's games".
      const schedule = await getFullSchedule();
      const matched: ScheduleGame[] = [];
      for (const gd of schedule) {
        for (const g of gd.games) {
          if (!g.gameDateTimeUTC) continue;
          if (dateInTz(g.gameDateTimeUTC, tz) !== date) continue;
          if (g.ifNecessary === true && g.gameStatus === 1 && /tbd/i.test(g.gameStatusText || "")) continue;
          matched.push(g);
        }
      }
      games = matched;

      // For live games (currently playing in ET), upgrade scores from live scoreboard.
      if (isToday || date === etToday) {
        const liveGames = await getTodayScoreboard().catch(() => []);
        const liveById = new Map(liveGames.map((g) => [g.gameId, g]));
        games = games.map((g) => {
          const live = liveById.get(g.gameId);
          if (!live) return g;
          return {
            ...g,
            gameStatus: live.gameStatus,
            gameStatusText: live.gameStatusText,
            homeTeam: { ...g.homeTeam, score: live.homeTeam.score },
            awayTeam: { ...g.awayTeam, score: live.awayTeam.score },
          };
        });
      }
    } else if (isToday) {
      // ET path — original behavior
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

    const cacheControl = isToday
      ? "public, s-maxage=30, stale-while-revalidate=120"
      : date < localToday
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
