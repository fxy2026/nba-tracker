import { NextRequest, NextResponse } from "next/server";
import { getPlannedFixtureView } from "@/lib/planned-fixtures-server";
import { validCalendarDate, validTimeZone } from "@/lib/planned-fixtures";
import { getFullSchedule, getScheduleCoverage } from "@/lib/api";
import { createZonedCalendarDate } from "@/lib/zoned-calendar-date";

interface CalendarGame {
  gameId: string;
  homeTricode: string;
  awayTricode: string;
  gameStatus: number;
  homeScore: number;
  awayScore: number;
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  const tzParam = request.nextUrl.searchParams.get("tz") || "America/New_York";
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !validCalendarDate(`${month}-01`) || request.nextUrl.searchParams.getAll("month").length !== 1 || request.nextUrl.searchParams.getAll("tz").length > 1) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  }

  if (!validTimeZone(tzParam)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  const tz = tzParam;

  try {
    const dates = await Promise.race([
      getFullSchedule(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);

    // Group all games of the season by local date (in tz). Then return only
    // those whose local date falls in the requested month.
    const buckets = new Map<string, CalendarGame[]>();
    const dateInZone = createZonedCalendarDate(tz);
    for (const gd of dates) {
      for (const g of gd.games) {
        // gameDateTimeUTC is required for timezone-correct grouping. Skip
        // games that don't carry it — they remain on the API date instead.
        const utc = g.gameDateTimeUTC;
        if (!utc) continue;
        const localDate = dateInZone(utc);
        if (!localDate.startsWith(month)) continue;
        const bucket = buckets.get(localDate);
        const entry: CalendarGame = {
          gameId: g.gameId,
          homeTricode: g.homeTeam.teamTricode,
          awayTricode: g.awayTeam.teamTricode,
          gameStatus: g.gameStatus,
          homeScore: g.homeTeam.score,
          awayScore: g.awayTeam.score,
        };
        if (bucket) bucket.push(entry);
        else buckets.set(localDate, [entry]);
      }
    }

    const monthGames = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, games]) => ({ date, gameCount: games.length, games }));

    return NextResponse.json({ data: monthGames, planned: getPlannedFixtureView({ mode: "month", month, timeZone: tz }, dates, getScheduleCoverage(dates)) }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
