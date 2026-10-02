import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import archive from "@/data/schedule-2025-26.json";

const id = "0022500961";
function validGame(status = 3) {
  const statistics = {
    minutes: "PT30M00.00S", points: 30, reboundsTotal: 10, reboundsOffensive: 2,
    reboundsDefensive: 8, assists: 3, steals: 1, blocks: 1, turnovers: 2,
    foulsPersonal: 2, fieldGoalsMade: 10, fieldGoalsAttempted: 20, fieldGoalsPercentage: .5,
    threePointersMade: 2, threePointersAttempted: 5, threePointersPercentage: .4,
    freeThrowsMade: 8, freeThrowsAttempted: 10, freeThrowsPercentage: .8, plusMinusPoints: 16,
  };
  const team = {
    teamId: 1610612765, teamTricode: "DET", teamName: "Pistons", teamCity: "Detroit", score: 126,
    statistics, periods: [{ period: 1, periodType: "REGULAR", score: 30 }],
    players: [{ personId: 1631105, name: "Jalen Duren", nameI: "J. Duren", position: "C", jerseyNum: "0", starter: "1", oncourt: "0", played: "1", statistics }],
  };
  return { gameId: id, gameCode: "20260313/MEMDET", gameStatus: status, gameStatusText: "Final", gameTimeUTC: "2026-03-13T23:30:00Z", arena: { arenaName: "Little Caesars Arena", arenaCity: "Detroit", arenaState: "MI" }, homeTeam: team, awayTeam: { ...structuredClone(team), teamId: 1610612763, teamTricode: "MEM", score: 110 } };
}
const response = (game: unknown) => ({ ok: true, json: async () => ({ game }) });
beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("box score safety boundary", () => {
  it("preserves a valid final payload exactly and pins it without a second request", async () => {
    const game = validGame();
    const fetcher = vi.fn().mockResolvedValue(response(game)); vi.stubGlobal("fetch", fetcher);
    const { getBoxScore } = await import("./api");
    expect(await getBoxScore(id)).toBe(game);
    expect(await getBoxScore(id)).toBe(game);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("accepts DNP players and omitted optional presentation metadata without inventing stats", async () => {
    const game = validGame();
    const dnp = structuredClone(game.homeTeam.players[0]);
    dnp.played = "0"; dnp.starter = "0";
    for (const key of Object.keys(dnp.statistics)) {
      if (key !== "minutes") Reflect.set(dnp.statistics, key, 0);
    }
    dnp.statistics.minutes = "PT00M00.00S";
    Reflect.deleteProperty(dnp, "position");
    Reflect.deleteProperty(game.arena, "arenaState");
    game.homeTeam.players.push(dnp);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(game)));
    const { getBoxScore } = await import("./api");
    expect(await getBoxScore(id)).toBe(game);
    expect(dnp).not.toHaveProperty("position");
  });
  it.each(["403", "network", "timeout", "json", "null", "wrong-id", "missing-team", "missing-stat", "missing-players", "nan"])("returns unavailable for %s without throwing or caching bad data", async (failure) => {
    const game = validGame();
    let result: unknown = response(game);
    if (failure === "403") result = { ok: false, status: 403 };
    if (failure === "json") result = { ok: true, json: async () => { throw new SyntaxError("bad JSON"); } };
    if (failure === "null") result = response(null);
    if (failure === "wrong-id") game.gameId = "0022500962";
    if (failure === "missing-team") result = response({ ...game, homeTeam: null });
    if (failure === "missing-stat") result = response({ ...game, homeTeam: { ...game.homeTeam, statistics: {} } });
    if (failure === "missing-players") game.homeTeam.players = [];
    if (failure === "nan") game.homeTeam.score = NaN;
    const fetcher = vi.fn();
    if (failure === "network" || failure === "timeout") fetcher.mockRejectedValueOnce(new DOMException(failure, failure === "timeout" ? "TimeoutError" : "NetworkError"));
    else fetcher.mockResolvedValueOnce(result);
    const good = validGame(); fetcher.mockResolvedValueOnce(response(good)); vi.stubGlobal("fetch", fetcher);
    const { getBoxScore } = await import("./api");
    await expect(getBoxScore(id)).resolves.toBeNull();
    expect(await getBoxScore(id)).toBe(good);
  });
  it.each(["response", "body"])("handles an abort while the %s is stalled", async (stage) => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const stalled = () => new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      started();
    });
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      expect(options.signal).toBe(controller.signal);
      if (stage === "response") return stalled();
      return { ok: true, json: stalled };
    }));
    const { getBoxScore } = await import("./api");
    const pending = getBoxScore(id);
    await ready;
    controller.abort(new DOMException("deadline", "TimeoutError"));
    await expect(pending).resolves.toBeNull();
    expect(timeout).toHaveBeenCalledWith(8000);
  });
  it("retains verified live cache when a refresh is malformed or rejects", async () => {
    const game = validGame(2);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(game)).mockResolvedValueOnce(response({})).mockRejectedValueOnce(new Error("offline")));
    const { getBoxScore } = await import("./api");
    expect(await getBoxScore(id)).toBe(game);
    expect(await getBoxScore(id)).toBe(game);
    expect(await getBoxScore(id)).toBe(game);
  });
  it("deduplicates a failed concurrent request then permits recovery", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
    const { getBoxScore } = await import("./api");
    expect(await Promise.all([getBoxScore(id), getBoxScore(id)])).toEqual([null, null]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await getBoxScore(id); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("reconstructed archive leader provenance", () => {
  it("omits the unverified Green 6 leader while preserving final totals and source immutability", async () => {
    const source = archive.dates.flatMap((d) => d.games).find((g) => g.gameId === id)!;
    expect(source.pointsLeaders?.[0].points).toBe(6);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const { getCachedScheduleFeed } = await import("./api");
    const result = (await getCachedScheduleFeed()).dates.flatMap((d) => d.games).find((g) => g.gameId === id)!;
    expect(result.pointsLeaders).toBeUndefined(); expect(result.gameLeaders).toBeUndefined();
    expect([result.awayTeam.score, result.homeTeam.score]).toEqual([110, 126]);
    expect(source.pointsLeaders?.[0].points).toBe(6);
  });
  it("preserves live final leaders even for an archived game ID", async () => {
    const source = archive.dates.find((d) => d.games.some((g) => g.gameId === id))!;
    const game = structuredClone(source.games.find((g) => g.gameId === id)!);
    game.pointsLeaders = [{ personId: 1631105, firstName: "Jalen", lastName: "Duren", teamId: 1610612765, teamTricode: "DET", points: 30 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ leagueSchedule: { seasonYear: "2025-26", gameDates: [{ gameDate: source.gameDate, games: [game] }] } }) }));
    const { getCachedScheduleFeed } = await import("./api");
    const result = (await getCachedScheduleFeed()).dates.flatMap((d) => d.games).find((g) => g.gameId === id)!;
    expect(result.pointsLeaders?.[0].points).toBe(30);
  });
});
