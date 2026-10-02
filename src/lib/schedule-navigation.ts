import type { ScheduleDate, ScheduleGame } from "./api";

export interface ScheduleNavigation {
  availableFrom: string | null;
  availableThrough: string | null;
  latestFinalDate: string | null;
  nextScheduledDate: string | null;
}

// Reuse the schedule already fetched by /api/games. Calendar dates are derived
// with one formatter, independent of the server's timezone or archive IDs.
export function getScheduleDayView(schedule: ScheduleDate[], date: string, tz: string, now = Date.now()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const games: ScheduleGame[] = [];
  const navigation: ScheduleNavigation = { availableFrom: null, availableThrough: null, latestFinalDate: null, nextScheduledDate: null };
  const seen = new Set<string>();
  let latestFinal = -Infinity;
  let nextScheduled = Infinity;
  for (const day of schedule) {
    for (const game of day.games) {
      if (seen.has(game.gameId) || !game.gameDateTimeUTC || !/(Z|[+-]\d{2}:\d{2})$/.test(game.gameDateTimeUTC)) continue;
      const instant = Date.parse(game.gameDateTimeUTC);
      if (!Number.isFinite(instant)) continue;
      if (game.ifNecessary === true && game.gameStatus === 1 && /tbd/i.test(game.gameStatusText || "")) continue;
      seen.add(game.gameId);
      const parts = formatter.formatToParts(new Date(instant));
      const localDate = ["year", "month", "day"].map((part) => parts.find((p) => p.type === part)!.value).join("-");
      if (localDate === date) games.push(game);
      if (!navigation.availableFrom || localDate < navigation.availableFrom) navigation.availableFrom = localDate;
      if (!navigation.availableThrough || localDate > navigation.availableThrough) navigation.availableThrough = localDate;
      if (game.gameStatus === 3 && instant <= now && instant > latestFinal) {
        latestFinal = instant;
        navigation.latestFinalDate = localDate;
      }
      if (game.gameStatus === 1 && instant >= now && instant < nextScheduled && !game.ifNecessary && !/tbd/i.test(game.gameStatusText || "")) {
        nextScheduled = instant;
        navigation.nextScheduledDate = localDate;
      }
    }
  }
  return { games, navigation };
}

export function selectedDateFromUrl(explicitDate: string | null, localToday: string): string {
  if (!explicitDate || !/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) return localToday;
  const parsed = new Date(`${explicitDate}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === explicitDate ? explicitDate : localToday;
}
