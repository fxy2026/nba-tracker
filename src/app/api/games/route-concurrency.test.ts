import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NbaGame, ScheduleDate, ScheduleGame } from "@/lib/api";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({ schedule: vi.fn<() => Promise<ScheduleDate[]>>(), live: vi.fn<() => Promise<NbaGame[]>>(), sourceDate: "2026-10-04" }));
vi.mock("@/lib/api", async original => ({
  ...await original<typeof import("@/lib/api")>(),
  getFullSchedule: source.schedule, getTodayScoreboard: source.live,
  getScoreboardSourceDate: () => source.sourceDate,
}));
import { GET } from "./route";
const team = (abbr: string, score: number) => ({ teamId: 1, teamTricode: abbr, teamName: abbr, teamCity: abbr, teamSlug: "", score, wins: 0, losses: 0, seed: 0 });
const game: ScheduleGame = { gameId: "0022600001", gameCode: "20261004/LALBOS", gameStatus: 1, gameStatusText: "Scheduled", gameDateTimeUTC: "2026-10-04T19:00:00Z", homeTeam: team("BOS", 0), awayTeam: team("LAL", 0) };
const live: NbaGame = { ...game, gameEt: "2026-10-04T15:00:00", gameTimeUTC: game.gameDateTimeUTC, gameStatus: 2, gameStatusText: "Q2", homeTeam: { ...team("BOS", 44), periods: [{ period: 1, periodType: "REGULAR", score: 25 }] }, awayTeam: team("LAL", 39), gameLeaders: { homeLeaders: { personId: 1, name: "Test", teamTricode: "BOS", points: 15, rebounds: 3, assists: 2 } } };
const dates: ScheduleDate[] = [{ gameDate: "10/04/2026 00:00:00", games: [game] }];
const request = (date = "2026-10-04", tz = "America/New_York") => new NextRequest(`https://example.test/api/games?date=${date}&tz=${encodeURIComponent(tz)}`);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-04T20:00:00Z"));
  source.schedule.mockReset().mockResolvedValue(dates); source.live.mockReset().mockResolvedValue([live]);
  source.sourceDate = "2026-10-04";
});
afterEach(() => vi.useRealTimers());
it("starts both applicable sources before either resolves and preserves the live overlay", async () => {
  let resolveSchedule!: (value: ScheduleDate[]) => void, resolveLive!: (value: NbaGame[]) => void;
  source.schedule.mockReturnValue(new Promise(resolve => { resolveSchedule = resolve; }));
  source.live.mockReturnValue(new Promise(resolve => { resolveLive = resolve; }));
  let settled = false;
  const pending = GET(request()).then(response => { settled = true; return response; });
  expect(source.schedule).toHaveBeenCalledTimes(1); expect(source.live).toHaveBeenCalledTimes(1);
  resolveLive([live]); await Promise.resolve(); expect(settled).toBe(false);
  resolveSchedule(dates);
  const response = await pending, body = await response.json();
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=120");
  expect(body.data).toHaveLength(1);
  expect(body.data[0]).toMatchObject({ ...game, gameStatus: 2, gameStatusText: "Q2", homeTeam: live.homeTeam, awayTeam: live.awayTeam, gameLeaders: live.gameLeaders });
});
it("preserves scheduled rows on scoreboard failure", async () => {
  source.live.mockRejectedValue(new Error("offline"));
  const response = await GET(request()); expect((await response.json()).data).toEqual([game]);
});
it("still supplies unique live rows when the schedule has none", async () => {
  source.schedule.mockResolvedValue([]);
  const response = await GET(request()); const body = await response.json();
  expect(body.data).toHaveLength(1); expect(body.data[0]).toMatchObject({ gameId: live.gameId, gameStatus: 2 });
});
it("does not request a live overlay for dates outside both local-today and ET-today", async () => {
  const response = await GET(request("2026-10-01")); expect(response.status).toBe(200);
  expect(source.live).not.toHaveBeenCalled(); expect(source.schedule).toHaveBeenCalledTimes(1);
});
it("keeps ET-today overlay eligibility when the viewer has crossed midnight", async () => {
  await GET(request("2026-10-04", "Asia/Shanghai")); expect(source.live).toHaveBeenCalledTimes(1);
});
it("preserves failure status and handles an already started scoreboard rejection", async () => {
  source.schedule.mockRejectedValue(new Error("schedule unavailable")); source.live.mockRejectedValue(new Error("scoreboard unavailable"));
  const response = await GET(request()); expect(response.status).toBe(500); expect(response.headers.get("Cache-Control")).toBe("no-store");
});
