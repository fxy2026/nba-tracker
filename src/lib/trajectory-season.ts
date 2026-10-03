import type { ScheduleDate } from "./api";
import { currentSeason } from "./constants";
import { isRegular, scheduleForSeason } from "./games";
import { TEAM_META } from "./teams";

export const RECORDED_TRAJECTORY_SEASON = "2025-26";

export function trajectorySeason(value: string | string[] | undefined, current = currentSeason()) {
  const valid = typeof value === "string" && (value === current || value === RECORDED_TRAJECTORY_SEASON);
  const season = valid ? value : current;
  return { current, season, archive: season !== current, invalid: value !== undefined && !valid };
}

/** The chart and its coverage label share exactly the selected recorded finals. */
export function trajectoryFinals(schedule: ScheduleDate[], season: string): ScheduleDate[] {
  return scheduleForSeason(schedule, season).map(day => ({
    ...day,
    games: day.games.filter(game => game.gameStatus === 3 && isRegular(game.gameId)
      && TEAM_META[game.homeTeam.teamTricode] && TEAM_META[game.awayTeam.teamTricode]),
  })).filter(day => day.games.length > 0);
}

export function trajectoryCoverage(schedule: ScheduleDate[]) {
  const games = schedule.flatMap(day => day.games);
  const dates = games.map(game => game.gameDateTimeUTC.slice(0, 10)).sort();
  const counts = new Map<string, number>();
  for (const game of games) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      counts.set(team.teamTricode, (counts.get(team.teamTricode) ?? 0) + 1);
    }
  }
  const values = [...counts.values()];
  return { finals: games.length, teams: counts.size, first: dates[0], last: dates.at(-1),
    min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 };
}
