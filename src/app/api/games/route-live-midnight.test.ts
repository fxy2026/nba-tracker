import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NbaGame, ScheduleDate, ScheduleGame } from "@/lib/nba-contracts";

vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({
  schedule: vi.fn<() => Promise<ScheduleDate[]>>(),
  dated: vi.fn<() => Promise<ScheduleGame[]>>(),
  live: vi.fn<() => Promise<NbaGame[]>>(),
  sourceDate: "2026-03-01" as string | null,
  espn: vi.fn(),
}));
vi.mock("@/lib/api", async original => ({
  ...await original<typeof import("@/lib/api")>(),
  getFullSchedule: source.schedule, getGamesByDate: source.dated,
  getTodayScoreboard: source.live, getScoreboardSourceDate: () => source.sourceDate,
  getScheduleCoverage: () => null,
}));
vi.mock("@/lib/espn-scoreboard-server", async original => ({
  ...await original<typeof import("@/lib/espn-scoreboard-server")>(), getEspnDailyScoreboard: source.espn,
}));
import { GET } from "./route";

const team = (abbr: string, score: number) => ({ teamId: 1, teamTricode: abbr, teamName: abbr, teamCity: abbr, teamSlug: "", score, wins: 0, losses: 0, seed: 0 });
const late: ScheduleGame = {
  gameId: "0022500888", gameCode: "20260301/SACLAL", gameStatus: 2, gameStatusText: "Q4",
  gameDateTimeUTC: "2026-03-02T02:30:00Z", homeTeam: team("LAL", 90), awayTeam: team("SAC", 88),
};
const live = (game: ScheduleGame = late, status = 2): NbaGame => ({
  ...game, gameTimeUTC: game.gameDateTimeUTC, gameEt: "2026-03-01T21:30:00", gameStatus: status,
  gameStatusText: status === 3 ? "Final" : "Q4 0:22",
  homeTeam: { ...team("LAL", 90), ...game.homeTeam, score: 91, periods: [{ period: 4, periodType: "REGULAR", score: 25 }] },
  awayTeam: { ...team("SAC", 88), ...game.awayTeam },
  gameLeaders: { homeLeaders: { personId: 1, name: "Test", teamTricode: "LAL", points: 25, rebounds: 3, assists: 2 } },
});
const request = (date = "2026-03-01", tz: string | undefined = "America/New_York") =>
  new NextRequest(`https://example.test/api/games?date=${date}${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`);
const shortCache = "public, s-maxage=30, stale-while-revalidate=120";
const historicCache = "public, s-maxage=3600, stale-while-revalidate=86400";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-03-02T05:10:00Z"));
  source.schedule.mockReset().mockResolvedValue([{ gameDate: "03/01/2026 00:00:00", games: [late] }]);
  source.dated.mockReset().mockResolvedValue([late]); source.live.mockReset().mockResolvedValue([live()]);
  source.sourceDate = "2026-03-01"; source.espn.mockReset().mockResolvedValue(undefined);
  // Every provider is mocked; an accidental external request fails the test.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external fetch"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("canonical games continuing after midnight", () => {
  it.each(["America/New_York", "US/Eastern", ""])("overlays yesterday's live rows and keeps the short cache (tz=%s)", async tz => {
    const response = await GET(request("2026-03-01", tz));
    expect(source.live).toHaveBeenCalledTimes(1);
    expect((await response.json()).data).toEqual([expect.objectContaining({
      gameId: late.gameId, gameStatus: 2, gameStatusText: "Q4 0:22", gameDateTimeUTC: late.gameDateTimeUTC,
      homeTeam: live().homeTeam, gameLeaders: live().gameLeaders,
    })]);
    expect(response.headers.get("Cache-Control")).toBe(shortCache);
    expect(source.espn).not.toHaveBeenCalled();
  });

  it.each(["America/New_York", ""])("changes to the historical cache after the overlay becomes final (tz=%s)", async tz => {
    source.live.mockResolvedValue([live(late, 3)]);
    const response = await GET(request("2026-03-01", tz));
    expect((await response.json()).data[0]).toMatchObject({ gameStatus: 3, gameStatusText: "Final", homeTeam: { score: 91 } });
    expect(response.headers.get("Cache-Control")).toBe(historicCache);
  });

  it("keeps a recent live row refreshable if the overlay fails", async () => {
    source.live.mockRejectedValue(new Error("Scoreboard offline"));
    const response = await GET(request());
    expect((await response.json()).data).toEqual([late]);
    expect(response.headers.get("Cache-Control")).toBe(shortCache);
  });

  it("keeps current local-day overlay behavior for Shanghai after ET midnight", async () => {
    const response = await GET(request("2026-03-02", "Asia/Shanghai"));
    expect((await response.json()).data[0].homeTeam.score).toBe(91);
    expect(response.headers.get("Cache-Control")).toBe(shortCache);
    expect(source.live).toHaveBeenCalledTimes(1);
  });

  it("does not mix neighboring ET dates, duplicate IDs, or malformed live-only rows into the selected day", async () => {
    const nextDay = { ...late, gameId: "0022500889", gameDateTimeUTC: "2026-03-02T05:05:00Z" };
    const extra = { ...late, gameId: "0022500887", gameDateTimeUTC: "2026-03-02T03:00:00Z" };
    source.schedule.mockResolvedValue([{ gameDate: "03/01/2026", games: [late] }, { gameDate: "03/02/2026", games: [nextDay] }]);
    source.live.mockResolvedValue([live(), live(nextDay), live(extra), live(extra), { ...live(), gameId: "espn:123" }, { ...live(), gameId: "0022500886", gameTimeUTC: "invalid" }]);
    const response = await GET(request()); const body = await response.json();
    expect(body.data.map((game: ScheduleGame) => game.gameId)).toEqual([late.gameId, extra.gameId]);
    expect(body.data[0].homeTeam.score).toBe(91);
    expect(body.data[0].gameDateTimeUTC).toBe(late.gameDateTimeUTC);
  });

  it.each([{ games: [] }, { games: [{ ...late, gameStatus: 3 }] }])("does not start an overlay for a historic final or empty selection", async ({ games }) => {
    source.schedule.mockResolvedValue([{ gameDate: "03/01/2026", games }]); source.dated.mockResolvedValue(games);
    const response = await GET(request());
    expect(source.live).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe(historicCache);
  });

  it("does not extend freshness indefinitely for old live-looking schedule rows", async () => {
    vi.setSystemTime(new Date("2026-03-03T05:10:00Z"));
    const response = await GET(request());
    expect((await response.json()).data).toEqual([late]);
    expect(source.live).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe(historicCache);
  });

  it("does not use another selected day's live schedule row to start an overlay", async () => {
    await GET(request("2026-02-28"));
    expect(source.live).not.toHaveBeenCalled();
  });

  it("does not promote yesterday's scoreboard source date into evidence for today's empty ET day", async () => {
    source.schedule.mockResolvedValue([]);
    const response = await GET(request("2026-03-02"));
    expect((await response.json()).data).toEqual([]);
    expect(source.espn).toHaveBeenCalledWith("2026-03-02", "America/New_York", [], expect.any(AbortSignal));
  });
});
