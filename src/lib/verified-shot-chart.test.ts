import { describe, expect, it } from "vitest";
import facts from "@/data/verified-shot-charts/0022500961.json";
import schedule from "@/data/schedule-2025-26.json";
import { getVerifiedShotChart, validateReviewedShotChart, type ShotChartGameIdentity } from "./verified-shot-chart-archive";
import { summarizeCourtShots } from "./court-shots";

const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === "0022500961")!;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

describe("reviewed official shot locations", () => {
  it("restores exactly 181 coordinate-bearing field goals and makes source coverage explicit", () => {
    const data = getVerifiedShotChart(game)!;
    expect(data).not.toBeNull();
    expect(data.coverage).toEqual({ mapped: 181, total: 181, complete: true });
    expect(data.source.url).toBe("https://www.nba.com/game/mem-vs-det-0022500961/game-charts");
    expect(summarizeCourtShots(data.shots)).toEqual({ made: 88, attempted: 181, twosMade: 61, twosAttempted: 105, threesMade: 27, threesAttempted: 76 });
    expect(new Set(data.shots.map(shot => shot.eventId)).size).toBe(181);
  });
  it("keeps exact source coordinates including negative values, zero and left/right sign", () => {
    const data = getVerifiedShotChart(game)!;
    for (let i = 0; i < data.shots.length; i++) {
      expect(data.shots[i].xFeet).toBe(facts.shots[i].xLegacy / 10);
      expect(data.shots[i].yFeet).toBe(facts.shots[i].yLegacy / 10);
    }
    expect(data.shots.filter(shot => shot.yFeet < 0)).toHaveLength(4);
    expect(data.shots[0]).toMatchObject({ eventId: 20, personId: 1641765, playerName: "Olivier-Maxence Prosper", teamTricode: "MEM", period: 1, clock: "PT11M11.00S", result: "Made", value: 2, xFeet: -1.6, yFeet: 1.1 });
  });
  it("uses explicit shotValue for the 15 threes whose source distance was zero", () => {
    const data = getVerifiedShotChart(game)!;
    expect(data.shots.find(shot => shot.eventId === 362)).toMatchObject({ value: 3, result: "Made", xFeet: -23.3, yFeet: 1.5 });
    expect(data.shots.find(shot => shot.eventId === 204)).toMatchObject({ value: 3, result: "Missed", xFeet: -23, yFeet: 2.9 });
    expect(JSON.stringify(data)).not.toContain("shotDistance");
  });
  it("reconciles each team's attempts/makes and threes", () => {
    const data = getVerifiedShotChart(game)!;
    expect(summarizeCourtShots(data.shots.filter(shot => shot.teamTricode === "MEM"))).toMatchObject({ made: 38, attempted: 89, threesMade: 15, threesAttempted: 41 });
    expect(summarizeCourtShots(data.shots.filter(shot => shot.teamTricode === "DET"))).toMatchObject({ made: 50, attempted: 92, threesMade: 12, threesAttempted: 35 });
    expect(data.shots.filter(shot => shot.personId === 1631105)).toHaveLength(15);
    expect(data.shots.filter(shot => shot.personId === 1631105 && shot.result === "Made")).toHaveLength(12);
  });
  it("accepts the equivalent live box identity only when all pinned fields agree", () => {
    const box: ShotChartGameIdentity = { gameId: game.gameId, gameStatus: 3, gameCode: game.gameCode, gameTimeUTC: game.gameDateTimeUTC, homeTeam: game.homeTeam, awayTeam: game.awayTeam };
    expect(getVerifiedShotChart(box)?.shots).toHaveLength(181);
    expect(getVerifiedShotChart({ ...box, gameTimeUTC: undefined })).toBeNull();
    expect(getVerifiedShotChart({ ...game, gameTimeUTC: "2026-03-14T23:30:00Z" })).toBeNull();
  });
  it("accepts matching current shooting totals or genuinely absent statistics", () => {
    expect(getVerifiedShotChart({ ...game, homeTeam: { ...game.homeTeam, statistics: {} } })).not.toBeNull();
    expect(getVerifiedShotChart({ ...game,
      homeTeam: { ...game.homeTeam, statistics: { fieldGoalsMade: 50, fieldGoalsAttempted: 92, threePointersMade: 12, threePointersAttempted: 35 } },
      awayTeam: { ...game.awayTeam, statistics: { fieldGoalsMade: 38, fieldGoalsAttempted: 89, threePointersMade: 15, threePointersAttempted: 41 } },
    })).not.toBeNull();
  });
  it.each(["homeTeam", "awayTeam"] as const)("rejects every defined shooting-total conflict in a current %s", side => {
    for (const key of ["fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted"] as const) {
      for (const value of [0, 999, null, "50", Number.NaN]) {
        expect(getVerifiedShotChart({ ...game, [side]: { ...game[side], statistics: { [key]: value } } })).toBeNull();
      }
    }
  });
  it.each(["id", "date", "code", "homeId", "awayTricode", "score", "status"])("withholds the archive for conflicting game %s", kind => {
    const altered = copy(game);
    if (kind === "id") altered.gameId = "0022500962";
    if (kind === "date") altered.gameDateTimeUTC = "2026-03-14T23:30:00Z";
    if (kind === "code") altered.gameCode = "20260313/DETMEM";
    if (kind === "homeId") altered.homeTeam.teamId = 1;
    if (kind === "awayTricode") altered.awayTeam.teamTricode = "LAL";
    if (kind === "score") altered.homeTeam.score = 127;
    if (kind === "status") altered.gameStatus = 2;
    expect(getVerifiedShotChart(altered)).toBeNull();
  });
  it.each(["coordinate", "missing", "duplicate", "result", "value", "player", "team", "period", "clock", "playerTotal", "identity", "extra"])("rejects changed factual evidence: %s", kind => {
    const altered = copy(facts);
    if (kind === "coordinate") altered.shots[0].xLegacy += 1;
    if (kind === "missing") altered.shots.pop();
    if (kind === "duplicate") altered.shots[1] = { ...altered.shots[0] };
    if (kind === "result") altered.shots[0].shotResult = "Missed";
    if (kind === "value") altered.shots[0].shotValue = 3;
    if (kind === "player") altered.shots[0].personId = 1631105;
    if (kind === "team") altered.shots[0].teamTricode = "DET";
    if (kind === "period") altered.shots[0].period = 2;
    if (kind === "clock") altered.shots[0].clock = "PT11M12.00S";
    if (kind === "playerTotal") altered.players[0].fieldGoalsAttempted += 1;
    if (kind === "identity") altered.game.gameId = "0022500962";
    if (kind === "extra") Object.assign(altered, { invented: true });
    expect(validateReviewedShotChart(altered, game)).toBeNull();
  });
  it("rejects malformed data and never returns raw evidence or mutable shared records", () => {
    for (const bad of [null, {}, [], "bad", { ...facts, shots: null }]) expect(validateReviewedShotChart(bad, game)).toBeNull();
    const data = getVerifiedShotChart(game)!;
    data.shots[0].xFeet = 999;
    expect(getVerifiedShotChart(game)!.shots[0].xFeet).toBe(-1.6);
    expect(Object.keys(data).sort()).toEqual(["away", "coordinateSystem", "coverage", "gameId", "home", "shots", "source"]);
    expect(JSON.stringify(data)).not.toContain("xLegacy");
    expect(JSON.stringify(data)).not.toContain("scoreHome");
  });
});
