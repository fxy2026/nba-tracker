import type { ScheduleDate } from "./api";
import { trajectoryFinals } from "./trajectory-season";
import { validFinalScore } from "./team-rank";

/** Coverage and standings consume the same valid recorded regular-season finals.
 * Keep this stricter archive boundary local: other pages retain their contracts. */
export function standingsRecordedFinals(schedule: ScheduleDate[], season: string): ScheduleDate[] {
  return trajectoryFinals(schedule, season).map(day => ({
    ...day,
    games: day.games.filter(game => validFinalScore(game.homeTeam.score, game.awayTeam.score)),
  })).filter(day => day.games.length > 0);
}
