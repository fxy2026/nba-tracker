import { describe, it, expect } from "vitest";
import { scheduleForSeason } from "./games";
import { computeStandingsRows } from "./standings-splits";
import type { ScheduleDate, ScheduleGame } from "./api";

function game(id: string, homeScore = 100, awayScore = 90): ScheduleGame {
  const team = { teamName: "", teamCity: "", teamSlug: "", wins: 0, losses: 0, seed: 0 };
  return {
    gameId: id, gameStatus: 3, gameStatusText: "Final", gameCode: "",
    gameDateTimeUTC: "2027-01-01T00:00:00Z",
    homeTeam: { ...team, teamId: 1610612738, teamTricode: "BOS", score: homeScore },
    awayTeam: { ...team, teamId: 1610612752, teamTricode: "NYK", score: awayScore },
  };
}
const merged: ScheduleDate[] = [
  { gameDate: "01/01/2026 00:00:00", games: [game("0022500001"), game("0022500002")] },
  { gameDate: "01/01/2027 00:00:00", games: [game("0022600001", 90, 100)] },
];

describe("season-scoped merged schedules", () => {
  it("excludes archived wins from new standings and keeps Jan games in their NBA season", () => {
    const scoped = scheduleForSeason(merged, "2026-27");
    const boston = computeStandingsRows(scoped).find((row) => row.tricode === "BOS");
    expect(boston).toMatchObject({ wins: 0, losses: 1, streak: "L1", ppg: 90 });
    expect(scoped.flatMap((date) => date.games).map((game) => game.gameId)).toEqual(["0022600001"]);
  });
  it("leaves archive data available and does not mutate the merged feed", () => {
    const before = structuredClone(merged);
    scheduleForSeason(merged, "2026-27");
    expect(merged).toEqual(before);
    const archived = computeStandingsRows(scheduleForSeason(merged, "2025-26"));
    expect(archived.find((row) => row.tricode === "BOS")).toMatchObject({ wins: 2, losses: 0 });
  });
  it("does not relabel old games as new when the live schedule is unavailable", () => {
    expect(scheduleForSeason([merged[0]], "2026-27")).toEqual([]);
  });
  it("retains NBA season game types and excludes summer league/invalid IDs", () => {
    const ids = ["0012600001", "0022600001", "0032600001", "0042600401", "0052600001", "0062600001"];
    const dates = [{ gameDate: "10/01/2026 00:00:00", games: [...ids, "1522600001", "00226", "0022500001"].map((id) => game(id)) }];
    expect(scheduleForSeason(dates, "2026-27")[0].games.map((game) => game.gameId)).toEqual(ids);
    expect(scheduleForSeason(dates, "invalid")).toEqual([]);
  });
});
