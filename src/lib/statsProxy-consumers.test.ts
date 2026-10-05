import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import lebron from "@/data/player-career-archives/2544-2026-10-03.json";

// Exercise the actual stats helper and each JSON-consuming route; only the
// unrelated archive/ESPN/PBP providers are replaced with local fixtures.
const providers = vi.hoisted(() => ({ archive: vi.fn(), find: vi.fn(), career: vi.fn(), schedule: vi.fn(), pbp: vi.fn() }));
vi.mock("@/lib/player-career-archive", () => ({ getReviewedCareerArchive: providers.archive }));
vi.mock("@/lib/espn", () => ({ findESPNId: providers.find, getESPNCareerStats: providers.career }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule: providers.schedule, getPlayByPlaySnapshot: providers.pbp }));

const fetcher = vi.fn();
let deadlines: AbortController[];
const now = "2026-10-05T00:00:00.000Z";
const careerHeaders = ["SEASON_ID", "TEAM_ABBREVIATION", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT"];
const emptyCareer = { resultSets: [{ name: "SeasonTotalsRegularSeason", headers: careerHeaders, rowSet: [] }] };
const emptyLog = { resultSets: [{ headers: ["Game_ID", "GAME_DATE"], rowSet: [] }] };
const consumers = [
  {
    name: "stats", path: "/api/stats?endpoint=leagueleaders&Season=2025-26", timeout: 8000, revalidate: 300, failure: 504, cache: 300,
    payload: { resultSets: [{ headers: ["PTS"], rowSet: [[25]] }] },
    load: () => import("@/app/api/stats/route"),
  },
  {
    name: "matchups", path: "/api/matchups?gameId=0022500001", timeout: 20000, revalidate: 900, failure: 504, cache: 300,
    payload: { boxScoreMatchups: { homeTeam: { players: [] }, awayTeam: { players: [] } } },
    load: () => import("@/app/api/matchups/route"),
  },
  {
    name: "player", path: "/api/player?id=1", timeout: 4000, revalidate: 3600, failure: 503, cache: 300,
    payload: emptyCareer,
    load: () => import("@/app/api/player/route"),
  },
  {
    name: "player-shots", path: "/api/player-shots?playerId=1&team=LAL&season=2025-26", timeout: 8000, revalidate: 86400, failure: 503, cache: 600,
    payload: emptyLog,
    load: () => import("@/app/api/player-shots/route"),
  },
];
const request = (path: string, signal?: AbortSignal) => new NextRequest(`http://localhost${path}`, { signal });
const budgets = () => vi.mocked(AbortSignal.timeout).mock.calls.map(([ms]) => ms);
const flush = () => vi.advanceTimersByTimeAsync(0);
const expire = () => deadlines.at(-1)!.abort(new DOMException("Timed out", "TimeoutError"));
function stallHeaders(_url: string, { signal }: RequestInit) {
  return new Promise<Response>((_resolve, reject) => signal!.addEventListener("abort", () => reject(signal!.reason), { once: true }));
}
function stallBody(_url: string, { signal }: RequestInit) {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"resultSets":'));
      signal!.addEventListener("abort", () => controller.error(signal!.reason), { once: true });
    },
  }));
}
function expectFailure(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe(status === 503 ? "no-store" : null);
}

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(now);
  for (const mock of Object.values(providers)) mock.mockReset().mockResolvedValue(null);
  fetcher.mockReset(); vi.stubGlobal("fetch", fetcher); deadlines = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController(); deadlines.push(controller); return controller.signal;
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.each(consumers)("$name JSON consumer", consumer => {
  it.each([["headers", stallHeaders], ["body", stallBody]] as const)("uses short probes after %s timeouts, retaining route errors and fetch options", async (_stage, transport) => {
    const { GET } = await consumer.load();
    fetcher.mockImplementation(transport);
    for (let i = 0; i < 2; i++) {
      const pending = GET(request(consumer.path)); await flush(); expire();
      const response = await pending; expectFailure(response, consumer.failure);
      expect(await response.json()).toHaveProperty("error");
    }
    expect(budgets()).toEqual([consumer.timeout, 1500]); expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls) expect(options.next).toEqual({ revalidate: consumer.revalidate });
    for (const [name, provider] of Object.entries(providers)) if (name !== "archive") expect(provider).not.toHaveBeenCalled();
  });

  it("uses short probes after malformed JSON without publishing failed data", async () => {
    const { GET } = await consumer.load();
    fetcher.mockImplementation(() => new Response("{bad JSON"));
    expectFailure(await GET(request(consumer.path)), consumer.failure);
    expectFailure(await GET(request(consumer.path)), consumer.failure);
    expect(budgets()).toEqual([consumer.timeout, 1500]); expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("preserves non-OK HTTP behavior and leaves the error body unread", async () => {
    const { GET } = await consumer.load();
    const upstream = new Response("not JSON", { status: 429 });
    const json = vi.spyOn(upstream, "json"); fetcher.mockResolvedValue(upstream);
    const response = await GET(request(consumer.path));
    const directProxy = consumer.name === "stats" || consumer.name === "matchups";
    expectFailure(response, directProxy ? 429 : 503);
    if (directProxy) expect(await response.json()).toEqual({ error: "NBA API returned 429" });
    expect(json).not.toHaveBeenCalled(); expect(upstream.bodyUsed).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("recovers through complete JSON and preserves successful bodies, headers and budgets", async () => {
    const { GET } = await consumer.load();
    fetcher.mockImplementationOnce(stallBody).mockImplementation(() => Response.json(consumer.payload));
    const failed = GET(request(consumer.path)); await flush(); expire(); expectFailure(await failed, consumer.failure);
    const recovered = await GET(request(consumer.path)); const repeated = await GET(request(consumer.path));
    expect(recovered.status).toBe(200); expect(repeated.status).toBe(200);
    expect(recovered.headers.get("Cache-Control")).toBe(`public, s-maxage=${consumer.cache}, stale-while-revalidate=${consumer.cache * 2}`);
    const expected = consumer.name === "stats" ? consumer.payload
      : consumer.name === "matchups" ? { gameId: "0022500001", players: {} }
      : consumer.name === "player-shots" ? { shots: [], gamesLoaded: 0, totalGames: 0 }
      : { careerSeasons: [], recentGames: null, provenance: { source: "nba-stats", providerPlayerId: "1", scope: "regular-season", retrievalKind: "api-response", retrievedAt: now } };
    expect(await recovered.json()).toEqual(expected); expect(await repeated.json()).toEqual(expected);
    expect(budgets()).toEqual([consumer.timeout, 1500, consumer.timeout]); expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("unchanged consumer-specific contracts", () => {
  it.each([
    ["shotchartdetail", 20000, 300], ["playerawards", 6000, 86400],
    ["leaguedashteamstats", 6000, 3600], ["draftcombineplayeranthro", 8000, 86400],
  ] as const)("retains the %s budget, TTL and local limit projection", async (endpoint, timeout, revalidate) => {
    const { GET } = await import("@/app/api/stats/route");
    fetcher.mockImplementation(() => Response.json({ resultSet: { headers: ["PTS"], rowSet: [[1], [2], [3]] } }));
    const response = await GET(request(`/api/stats?endpoint=${endpoint}&Season=2025-26&limit=2`));
    expect(await response.json()).toEqual({ resultSet: { headers: ["PTS"], rowSet: [[1], [2]] } });
    expect(response.headers.get("Cache-Control")).toBe(`public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`);
    expect(budgets()).toEqual([timeout]); expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(`https://stats.nba.com/stats/${endpoint}?Season=2025-26`);
    expect(options.next).toEqual({ revalidate });
  });

  it("keeps malformed matchup shapes at 502, without treating complete JSON as a transport failure", async () => {
    const { GET } = await import("@/app/api/matchups/route");
    fetcher.mockImplementation(() => Response.json({ wrong: "shape" }));
    for (let i = 0; i < 2; i++) {
      const response = await GET(request("/api/matchups?gameId=0022500001"));
      expect(response.status).toBe(502); expect(await response.json()).toEqual({ error: "unexpected upstream shape" });
      expect(response.headers.get("Cache-Control")).toBeNull();
    }
    expect(budgets()).toEqual([20000, 20000]);
  });

  it("keeps rich matchup slimming and its daily cache header", async () => {
    const { GET } = await import("@/app/api/matchups/route");
    fetcher.mockResolvedValue(Response.json({ boxScoreMatchups: { homeTeam: { players: [{ personId: 1, matchups: [
      { personId: 2, nameI: "A. Defender", statistics: { partialPossessions: 2.34, matchupMinutes: "1:23", playerPoints: 4, matchupFieldGoalsMade: 2, matchupFieldGoalsAttempted: 3 } },
    ] }] } } }));
    const response = await GET(request("/api/matchups?gameId=0022500001"));
    expect(await response.json()).toEqual({ gameId: "0022500001", players: { "1": [{ personId: 2, name: "A. Defender", minutes: "1:23", possessions: 2.3, points: 4, fgm: 2, fga: 3 }] } });
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=86400, stale-while-revalidate=172800");
  });

  it("leaves caller cancellation uncounted and does not start the player's ESPN fallback", async () => {
    const { GET } = await import("@/app/api/player/route");
    const caller = new AbortController();
    fetcher.mockImplementationOnce(stallBody).mockResolvedValueOnce(Response.json(emptyCareer));
    const pending = GET(request("/api/player?id=1&name=Player&team=LAL", caller.signal)); await flush();
    caller.abort(); expectFailure(await pending, 503);
    const recovered = await GET(request("/api/player?id=1")); expect(recovered.status).toBe(200);
    expect(budgets()).toEqual([4000, 4000]); expect(providers.find).not.toHaveBeenCalled();
    expect(providers.career).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("retains ESPN fallback after an NBA body timeout without adding requests", async () => {
    const { GET } = await import("@/app/api/player/route");
    providers.find.mockResolvedValue("42"); providers.career.mockResolvedValue({ careerSeasons: [] });
    fetcher.mockImplementation(stallBody);
    const pending = GET(request("/api/player?id=1&name=Player&team=LAL")); await flush(); expire();
    const response = await pending;
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ careerSeasons: [], provenance: { source: "espn", providerPlayerId: "42" } });
    expect(providers.find).toHaveBeenCalledExactlyOnceWith("Player", "LAL", expect.any(AbortSignal));
    expect(providers.career).toHaveBeenCalledExactlyOnceWith("42", expect.any(AbortSignal));
    expect(fetcher).toHaveBeenCalledTimes(1); expect(budgets()).toEqual([4000]); expect(vi.getTimerCount()).toBe(0);
  });

  it("retains the reviewed player archive after malformed JSON without adding fallback calls", async () => {
    const { GET } = await import("@/app/api/player/route");
    providers.archive.mockResolvedValue({ playerName: "LeBron James", data: lebron.data });
    fetcher.mockImplementation(() => new Response("{bad"));
    const response = await GET(request("/api/player?id=2544"));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ...lebron.data, recentGames: null });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(providers.find).not.toHaveBeenCalled();
    expect(providers.career).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("shares the playergamelog breaker across stats and player-shots", async () => {
    const stats = await import("@/app/api/stats/route");
    const shots = await import("@/app/api/player-shots/route");
    fetcher.mockImplementationOnce(stallBody).mockResolvedValueOnce(Response.json(emptyLog));
    const failed = stats.GET(request("/api/stats?endpoint=playergamelog&PlayerID=1")); await flush(); expire();
    expectFailure(await failed, 504);
    expect((await shots.GET(request("/api/player-shots?playerId=1&team=LAL&season=2025-26"))).status).toBe(200);
    expect(budgets()).toEqual([8000, 1500]);
    expect(fetcher.mock.calls.map(([, options]) => options.next.revalidate)).toEqual([300, 86400]);
    expect(providers.pbp).not.toHaveBeenCalled();
  });
});
