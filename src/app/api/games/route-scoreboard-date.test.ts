import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import archive from "@/data/schedule-2025-26.json";
import type { NbaGame, ScheduleDate, ScheduleGame } from "@/lib/nba-contracts";
import type { CanonicalScheduleCoverage } from "@/lib/schedule-coverage";

const source = vi.hoisted(() => ({
  schedule: vi.fn<() => Promise<ScheduleDate[]>>(),
  dated: vi.fn<() => Promise<ScheduleGame[]>>(),
  live: vi.fn<() => Promise<NbaGame[]>>(),
  sourceDate: "2026-02-28" as string | null,
  coverage: null as CanonicalScheduleCoverage | null,
  espn: vi.fn(),
}));
vi.mock("@/lib/api", async original => ({
  ...await original<typeof import("@/lib/api")>(),
  getFullSchedule: source.schedule, getGamesByDate: source.dated,
  getTodayScoreboard: source.live, getScoreboardSourceDate: () => source.sourceDate,
  getScheduleCoverage: () => source.coverage,
}));
vi.mock("@/lib/espn-scoreboard-server", async original => ({
  ...await original<typeof import("@/lib/espn-scoreboard-server")>(),
  getEspnDailyScoreboard: source.espn,
}));
import { GET } from "./route";

const currentDate = "2026-03-01";
const archivedDay = (prefix: string) => archive.dates.find(day => day.gameDate.startsWith(prefix))! as ScheduleDate;
const previous = archivedDay("02/28/2026");
const current = archivedDay("03/01/2026");
const scoreboard = (game: ScheduleGame): NbaGame => ({
  ...game, gameTimeUTC: game.gameDateTimeUTC, gameEt: "",
  homeTeam: { ...game.homeTeam, wins: game.homeTeam.wins ?? 0, losses: game.homeTeam.losses ?? 0, seed: game.homeTeam.seed ?? 0 },
  awayTeam: { ...game.awayTeam, wins: game.awayTeam.wins ?? 0, losses: game.awayTeam.losses ?? 0, seed: game.awayTeam.seed ?? 0 },
});
const request = (tz?: string) => new NextRequest(`https://example.test/api/games?date=${currentDate}${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`);
const readyEspn = { source: "espn", state: "ready", date: currentDate, timeZone: "America/New_York", games: [{ eventId: "401000001", key: "espn:401000001" }] };
const shortCache = "public, s-maxage=30, stale-while-revalidate=120";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-03-01T08:00:00Z"));
  source.schedule.mockReset().mockResolvedValue([previous, current]);
  source.dated.mockReset().mockResolvedValue([]);
  source.live.mockReset().mockResolvedValue(previous.games.map(scoreboard));
  source.sourceDate = "2026-02-28"; source.coverage = null;
  source.espn.mockReset().mockResolvedValue(readyEspn);
  // All provider access is mocked. No fixture test may collect live data.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external fetch"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe("unverified scoreboard day recovery", () => {
  it.each(["2026-02-28", "2026-03-02", null])("recovers the requested ET schedule instead of mapping a nonempty board dated %s", async sourceDate => {
    source.sourceDate = sourceDate;
    const response = await GET(request()); const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual(current.games);
    expect(body.data).toHaveLength(11);
    expect(body.data.map((game: ScheduleGame) => game.gameId)).not.toEqual(previous.games.map(game => game.gameId));
    expect(source.schedule).toHaveBeenCalledTimes(1);
    expect(source.live).toHaveBeenCalledTimes(1);
    expect(source.dated).not.toHaveBeenCalled();
    expect(source.espn).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe(shortCache);
  });

  it("agrees with the explicit ET path for the stale previous-day archive fixture", async () => {
    const unzoned = await (await GET(request())).json();
    const zoned = await (await GET(request("America/New_York"))).json();
    expect(unzoned.data).toEqual(zoned.data);
    expect(unzoned.data).toEqual(current.games);
  });

  it.each(["2026-02-28", "2026-03-02", null])("does not overwrite dated schedule scores from an unverified same-ID board (%s)", async sourceDate => {
    source.sourceDate = sourceDate;
    source.live.mockResolvedValue(current.games.map(scoreboard).map(game => ({ ...game, homeTeam: { ...game.homeTeam, score: 999 } })));
    expect((await (await GET(request())).json()).data).toEqual(current.games);
  });

  it.each(["2026-02-28", "2026-03-02", null])("allows ESPN when a nonempty board has source date %s but no requested schedule day", async sourceDate => {
    source.sourceDate = sourceDate; source.schedule.mockResolvedValue([previous]);
    // Real-looking requested-day timestamps do not establish full-day provenance.
    source.live.mockResolvedValue(current.games.map(scoreboard));
    const response = await GET(request());
    expect(await response.json()).toEqual({ data: [], espn: readyEspn });
    expect(source.espn).toHaveBeenCalledWith(currentDate, "America/New_York", [], expect.any(AbortSignal));
  });

  it.each(["empty", "failure"])("preserves dated schedule recovery after a scoreboard %s", async kind => {
    source.sourceDate = null;
    if (kind === "empty") source.live.mockResolvedValue([]);
    else source.live.mockRejectedValue(new Error("Scoreboard offline"));
    expect((await (await GET(request())).json()).data).toEqual(current.games);
    expect(source.espn).not.toHaveBeenCalled();
  });

  it("still reaches ESPN when the scoreboard and schedule both fail", async () => {
    source.sourceDate = null;
    source.live.mockRejectedValue(new Error("Scoreboard offline"));
    source.schedule.mockRejectedValue(new Error("Schedule offline"));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [], espn: readyEspn });
  });

  it("does not cache all-provider failure as a verified empty day", async () => {
    source.schedule.mockRejectedValue(new Error("Schedule offline"));
    source.espn.mockResolvedValue({ ...readyEspn, state: "unavailable", games: [] });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [], espn: { state: "unavailable", games: [] } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("verified ET day authority", () => {
  it("keeps the matching-source nonempty scoreboard fast path without loading the schedule", async () => {
    source.sourceDate = currentDate; source.live.mockResolvedValue(current.games.map(scoreboard));
    const response = await GET(request()); const body = await response.json();
    expect(body.data.map((game: ScheduleGame) => game.gameId)).toEqual(current.games.map(game => game.gameId));
    expect(source.schedule).not.toHaveBeenCalled(); expect(source.espn).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe(shortCache);
  });

  it("preserves a matching-source explicit empty scoreboard as authoritative", async () => {
    source.sourceDate = currentDate; source.live.mockResolvedValue([]);
    expect(await (await GET(request())).json()).toEqual({ data: [] });
    expect(source.schedule).not.toHaveBeenCalled(); expect(source.espn).not.toHaveBeenCalled();
  });

  it("uses a validated explicit-empty schedule date before ESPN", async () => {
    source.coverage = { source: "nba-schedule", season: "2025-26" };
    source.schedule.mockResolvedValue([{ gameDate: "03/01/2026 00:00:00", games: [] }]);
    expect(await (await GET(request())).json()).toEqual({ data: [] });
    expect(source.espn).not.toHaveBeenCalled();
  });

  it.each(["absent", "other-day", "unknown-coverage", "wrong-season"])("does not infer an empty day from %s schedule evidence", async evidence => {
    source.coverage = evidence === "unknown-coverage" ? null : { source: "nba-schedule", season: evidence === "wrong-season" ? "2026-27" : "2025-26" };
    source.schedule.mockResolvedValue(evidence === "absent" ? [] : [{ gameDate: evidence === "other-day" ? "02/28/2026 00:00:00" : "03/01/2026 00:00:00", games: [] }]);
    expect((await (await GET(request())).json()).espn).toEqual(readyEspn);
    expect(source.espn).toHaveBeenCalledWith(currentDate, "America/New_York", [], expect.any(AbortSignal));
  });
});
