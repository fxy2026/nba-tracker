import type { ScheduleGame } from "./nba-contracts";
import { offsetCalendarDate } from "./calendar-date";
import { createZonedCalendarDate } from "./zoned-calendar-date";

// Extend live refresh across midnight only for this NBA slate or yesterday's.
// Calendar dates, rather than an elapsed-hour cutoff, also cover 23/25-hour DST
// days. Old schedule rows stuck at status 2 must not poll indefinitely.
export function hasRecentLiveGame(games: readonly Pick<ScheduleGame, "gameStatus" | "gameDateTimeUTC">[], now = new Date()): boolean {
  const live = games.filter(game => game.gameStatus === 2);
  if (live.length === 0) return false;
  const etDate = createZonedCalendarDate("America/New_York");
  const today = etDate(now.toISOString());
  const yesterday = offsetCalendarDate(today, -1);
  return live.some(game => {
    const tipoff = game.gameDateTimeUTC;
    if (!tipoff || !/(Z|[+-]\d{2}:\d{2})$/.test(tipoff)) return false;
    const instant = Date.parse(tipoff);
    if (!Number.isFinite(instant) || instant > now.getTime()) return false;
    const date = etDate(tipoff);
    return date === today || date === yesterday;
  });
}
