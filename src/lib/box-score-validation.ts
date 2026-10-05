import type { BoxScore } from "./nba-contracts";

const numericStats = [
  "points", "reboundsTotal", "reboundsOffensive", "reboundsDefensive", "assists",
  "steals", "blocks", "turnovers", "foulsPersonal", "fieldGoalsMade",
  "fieldGoalsAttempted", "fieldGoalsPercentage", "threePointersMade",
  "threePointersAttempted", "threePointersPercentage", "freeThrowsMade",
  "freeThrowsAttempted", "freeThrowsPercentage",
] as const;
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const strings = (v: Record<string, unknown>, keys: string[]) => keys.every((k) => typeof v[k] === "string");
const optionalStrings = (v: Record<string, unknown>, keys: string[]) => keys.every((k) => v[k] == null || typeof v[k] === "string");
const stats = (v: unknown) => object(v) && numericStats.every((k) => finite(v[k]));

// Fail closed at the upstream boundary. Never fill missing statistics with zero
// or pin a partial/error payload in the completed-game cache.
export function isValidBoxScore(value: unknown, gameId: string): value is BoxScore {
  if (!object(value) || value.gameId !== gameId || ![1, 2, 3].includes(value.gameStatus as number) ||
      !strings(value, ["gameCode", "gameStatusText", "gameTimeUTC"]) ||
      !object(value.arena) || !strings(value.arena, ["arenaName", "arenaCity"]) || !optionalStrings(value.arena, ["arenaState"])) return false;
  return [value.homeTeam, value.awayTeam].every((team) => {
    if (!object(team) || !finite(team.teamId) || team.teamId <= 0 || !finite(team.score) || team.score < 0 ||
        !strings(team, ["teamTricode", "teamName", "teamCity"]) || !stats(team.statistics) ||
        !Array.isArray(team.players) || !Array.isArray(team.periods)) return false;
    if (value.gameStatus === 3 && (team.players.length === 0 || team.periods.length === 0)) return false;
    return team.periods.every((p) => object(p) && finite(p.period) && finite(p.score) && typeof p.periodType === "string") &&
      team.players.every((p) => object(p) && finite(p.personId) &&
        strings(p, ["name", "nameI", "jerseyNum", "starter", "oncourt", "played"]) &&
        optionalStrings(p, ["position"]) && stats(p.statistics) && object(p.statistics) && typeof p.statistics.minutes === "string" && finite(p.statistics.plusMinusPoints));
  });
}
