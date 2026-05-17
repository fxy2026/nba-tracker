import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule } from "@/lib/api";

interface CalendarGame {
  gameId: string;
  homeTricode: string;
  awayTricode: string;
  gameStatus: number;
  homeScore: number;
  awayScore: number;
}

// Compute "YYYY-MM-DD" of a UTC instant in the given IANA timezone.
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
  const month = request.nextUrl.searchParams.get("month");
  const tzParam = request.nextUrl.searchParams.get("tz") || "America/New_York";
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  }

  // Validate timezone — Intl will throw on bad value
  let tz = tzParam;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    tz = "America/New_York";
  }

  try {
    const dates = await Promise.race([
      getFullSchedule(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);

    // Group all games of the season by local date (in tz). Then return only
    // those whose local date falls in the requested month.
    const buckets = new Map<string, CalendarGame[]>();
    for (const gd of dates) {
      for (const g of gd.games) {
        // gameDateTimeUTC is required for timezone-correct grouping. Skip
        // games that don't carry it — they remain on the API date instead.
        const utc = g.gameDateTimeUTC;
        if (!utc) continue;
        const localDate = dateInTz(utc, tz);
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

    return NextResponse.json({ data: monthGames }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
