import { afterEach, describe, expect, it, vi } from "vitest";
import { trajectorySeason, trajectoryFinals, trajectoryCoverage } from "./trajectory-season";
import { computeTrajectories } from "./team-trajectory";
import type { ScheduleDate } from "./api";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("bounded trajectory season", () => {
  it.each([undefined, "", "2024-25", "2026-26", ["2025-26"], ["2025-26", "2026-27"]])("falls back honestly for %j", value => {
    expect(trajectorySeason(value, "2026-27")).toEqual({ current: "2026-27", season: "2026-27", archive: false, invalid: value !== undefined });
  });
  it("accepts only the named archive and dynamic current season", () => {
    expect(trajectorySeason("2025-26", "2026-27").archive).toBe(true);
    expect(trajectorySeason("2026-27", "2026-27").invalid).toBe(false);
    expect(trajectorySeason("2025-26", "2025-26")).toEqual({ current: "2025-26", season: "2025-26", archive: false, invalid: false });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2027-09-30T23:59:59Z"));
    expect(trajectorySeason(undefined).season).toBe("2026-27");
    vi.setSystemTime(new Date("2027-10-01T00:00:00Z"));
    expect(trajectorySeason(undefined).season).toBe("2027-28");
    expect(trajectorySeason("2026-27").invalid).toBe(true);
    expect(trajectorySeason("2025-26").archive).toBe(true);
  });
  it("reads exact cleaned archive without fetching or changing cache state", async () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected upstream request"); }); vi.stubGlobal("fetch", fetch);
    const api = await import("./api"); const age = api.getScheduleAge();
    const raw = api.getRecorded2025SeasonSchedule(); const before = JSON.stringify(raw);
    const finals = trajectoryFinals(raw, "2025-26");
    expect(trajectoryCoverage(finals)).toEqual({ finals: 1230, teams: 30, min: 82, max: 82, first: "2025-10-21", last: "2026-04-13" });
    const games = finals.flatMap(day => day.games);
    expect(new Set(games.map(game => game.gameId)).size).toBe(1230);
    expect(raw.flatMap(day => day.games).every(game => !game.gameLeaders && !game.pointsLeaders)).toBe(true);
    expect(computeTrajectories(finals).every(team => team.points.length === 82)).toBe(true);
    const sample = games[0];
    const mixed: ScheduleDate[] = [...raw, { gameDate: "10/21/2026", games: [
      { ...sample, gameId: "0022600001" }, { ...sample, gameId: "0022509998", gameStatus: 1 },
      { ...sample, gameId: "0022509997", gameStatus: 2 }, { ...sample, gameId: "0012509999" },
      { ...sample, gameId: "0062509999" }, { ...sample, gameId: "0042509999" },
      { ...sample, gameId: "0052509999" }, { ...sample, gameId: "0022509996", awayTeam: { ...sample.awayTeam, teamTricode: "EXH" } },
    ] }];
    expect(trajectoryFinals(mixed, "2025-26")).toEqual(finals);
    expect(JSON.stringify(raw)).toBe(before); expect(api.getScheduleAge()).toBe(age); expect(fetch).not.toHaveBeenCalled();
  });
});

it("keeps recorded trajectories independent of a warm live cache", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
  const api = await import("./api");
  const before = api.getRecorded2025SeasonSchedule();
  const original = JSON.stringify(before);
  const first = before[0];
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ leagueSchedule: {
    seasonYear: "2025-26", gameDates: [{ ...first, games: first.games.map(game => ({
      ...game, homeTeam: { ...game.homeTeam, score: game.homeTeam.score + 20 },
    })) }],
  } }) });
  vi.stubGlobal("fetch", fetch);
  const live = await api.getRawScheduleDates();
  expect(live.dates.find(day => day.gameDate === first.gameDate)?.games[0].homeTeam.score).toBe(first.games[0].homeTeam.score + 20);
  fetch.mockClear(); const age = api.getScheduleAge();
  expect(JSON.stringify(api.getRecorded2025SeasonSchedule())).toBe(original);
  expect(api.getScheduleAge()).toBe(age); expect(fetch).not.toHaveBeenCalled();
});
