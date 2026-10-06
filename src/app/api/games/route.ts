import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate, getTodayScoreboard, getFullSchedule, getScheduleCoverage, getScoreboardSourceDate, formatDate, type NbaGame, type ScheduleDate, type ScheduleGame } from "@/lib/api";

import { getEspnDailyScoreboard, localDayUtcWindow } from "@/lib/espn-scoreboard-server";
import { currentSeason } from "@/lib/constants";
import { getPlannedFixtureView } from "@/lib/planned-fixtures-server";
import { validCalendarDate, validTimeZone } from "@/lib/planned-fixtures";
import { getScheduleDayView, type ScheduleNavigation } from "@/lib/schedule-navigation";
import { hasRecentLiveGame } from "@/lib/live-game-relevance";

function overlayLiveGames(games: ScheduleGame[], liveGames: NbaGame[]): ScheduleGame[] {
  const liveById = new Map(liveGames.map(game => [game.gameId, game]));
  return games.map(game => {
    const live = liveById.get(game.gameId);
    if (!live) return game;
    return {
      ...game,
      gameStatus: live.gameStatus,
      gameStatusText: live.gameStatusText,
      homeTeam: { ...game.homeTeam, score: live.homeTeam.score, periods: live.homeTeam.periods },
      awayTeam: { ...game.awayTeam, score: live.awayTeam.score, periods: live.awayTeam.periods },
      gameLeaders: live.gameLeaders,
    };
  });
}

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
  if (!date || !validCalendarDate(date) || request.nextUrl.searchParams.getAll("date").length !== 1 || request.nextUrl.searchParams.getAll("tz").length > 1) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  if (tzParam !== null && !validTimeZone(tzParam)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  const tz = tzParam;

  try {
    const etToday = formatDate(new Date());
    const localToday = tz ? dateInTz(new Date().toISOString(), tz) : etToday;
    const isToday = date === localToday;

    let games: ScheduleGame[];
    let schedule: ScheduleDate[] = [];
    let canonicalDayAvailable = false;
    const canonicalDatesET: string[] = [];
    let navigation: ScheduleNavigation | undefined;

    if (tz) {
      // These sources are independent. Start the applicable live overlay now
      // rather than adding its deadline after the cold full-schedule chain.
      // Catch immediately so schedule failure cannot leave an unhandled reject.
      let liveGamesPending = isToday || date === etToday
        ? getTodayScoreboard().catch(() => [])
        : null;
      // Timezone-aware: scan full schedule, pick games whose UTC tipoff falls
      // on `date` in `tz`. This is what a Beijing user means by "today's games".
      schedule = await getFullSchedule();
      const view = getScheduleDayView(schedule, date, tz);
      games = view.games;
      navigation = view.navigation;

      // A selected slate can still be playing after ET/local midnight. Only
      // extend the overlay for recent live rows belonging to this local day.
      if (!liveGamesPending && hasRecentLiveGame(games)) {
        liveGamesPending = getTodayScoreboard().catch(() => []);
      }

      // For live games (currently playing in ET), upgrade scores from live scoreboard.
      if (liveGamesPending) {
        const liveGames = await liveGamesPending;
        const sourceDate = getScoreboardSourceDate(liveGames);
        if (sourceDate === etToday) canonicalDatesET.push(sourceDate);
        canonicalDayAvailable = sourceDate === date && new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone === 'America/New_York';
        games = overlayLiveGames(games, liveGames);
        // A live scoreboard can supply real rows when the full schedule is
        // unavailable. Filter by UTC in the selected zone and never duplicate IDs.
        const seen = new Set(games.map(game => game.gameId));
        for (const live of liveGames) {
          if (seen.has(live.gameId) || !/^\d{10}$/.test(live.gameId) || !live.gameTimeUTC || !Number.isFinite(Date.parse(live.gameTimeUTC)) || dateInTz(live.gameTimeUTC, tz) !== date) continue;
          games.push({ gameId: live.gameId, gameCode: live.gameCode, gameStatus: live.gameStatus, gameStatusText: live.gameStatusText,
            gameDateTimeUTC: live.gameTimeUTC, homeTeam: { ...live.homeTeam, teamSlug: "" }, awayTeam: { ...live.awayTeam, teamSlug: "" },
            seriesText: live.seriesText, gameLeaders: live.gameLeaders });
          seen.add(live.gameId);
        }
      }
    } else if (isToday) {
      // ET path — original behavior. Degrades to an empty scoreboard on a
      // transient CDN error instead of 500ing the endpoint (mirrors the tz path).
      const liveGames = await getTodayScoreboard().catch(() => []);
      canonicalDayAvailable = getScoreboardSourceDate(liveGames) === etToday;
      if (canonicalDayAvailable) canonicalDatesET.push(etToday);
      games = liveGames.map((g) => ({
        gameId: g.gameId,
        gameCode: g.gameCode,
        gameStatus: g.gameStatus,
        gameStatusText: g.gameStatusText,
        gameDateTimeUTC: g.gameTimeUTC,
        homeTeam: { ...g.homeTeam, teamSlug: "" },
        awayTeam: { ...g.awayTeam, teamSlug: "" },
        seriesText: g.seriesText,
        gameLeaders: g.gameLeaders,
      }));
    } else {
      games = await getGamesByDate(date);
      if (hasRecentLiveGame(games)) {
        games = overlayLiveGames(games, await getTodayScoreboard().catch(() => []));
      }
    }

    // Whole-season metadata (or one regular-season game) does not prove
    // preseason coverage. Only explicitly empty dated rows from the matching
    // validated NBA schedule establish additional empty ET days.
    const coverage = getScheduleCoverage(schedule);
    if (games.length === 0 && coverage?.season === currentSeason(new Date(`${date}T12:00:00Z`))) {
      const requiredDates = localDayUtcWindow(date, tz ?? "America/New_York").datesET;
      for (const day of schedule) {
        if (day.games.length !== 0) continue;
        const [month, dayOfMonth, year] = day.gameDate.slice(0, 10).split("/");
        const emptyDate = `${year}-${month}-${dayOfMonth}`;
        if (requiredDates.includes(emptyDate) && !canonicalDatesET.includes(emptyDate)) canonicalDatesET.push(emptyDate);
      }
      canonicalDayAvailable ||= requiredDates.length > 0 && requiredDates.every(key => canonicalDatesET.includes(key));
    }

    // Keep provider-native IDs out of `data`: all existing detail, stars, ticker,
    // analytics and box-score consumers treat those IDs as NBA identities.
    const espn = games.length === 0 && (tz || isToday) && !canonicalDayAvailable
      ? await getEspnDailyScoreboard(date, tz ?? "America/New_York", canonicalDatesET, request.signal)
      : undefined;

    const cacheControl = espn?.state === "unavailable" ? "no-store" : isToday || hasRecentLiveGame(games) || espn?.games.some(game => game.status === "live")
      ? "public, s-maxage=30, stale-while-revalidate=120"
      : date < localToday
      ? "public, s-maxage=3600, stale-while-revalidate=86400"
      : "public, s-maxage=300, stale-while-revalidate=3600";

    return NextResponse.json(
      { data: games, ...(espn ? { espn } : {}), ...(games.length === 0 && navigation ? { navigation } : {}), ...(games.length === 0 && tz ? { planned: getPlannedFixtureView({ mode: "day", date, timeZone: tz }, schedule, getScheduleCoverage(schedule), canonicalDayAvailable, canonicalDatesET) } : {}) },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
