import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const goodSchedule = {
  leagueSchedule: {
    seasonYear: "2025-26",
    gameDates: [{ gameDate: "10/21/2025 00:00:00", games: [] }],
  },
};

const goodPlayerRow: (string | number | null)[] = [
  1629029, "Doncic", "Luka", "luka-doncic", 1610612747, null, null,
  "Los Angeles", "Lakers", "LAL", "77", "F-G", "6-6", "230",
  "Real Madrid", "Slovenia", 2018, 1, 3, null, "2018", "2025",
  28.2, 8.3, 7.8,
];

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response;
}

function scheduleFetch(
  cdn: () => Response | Promise<Response>,
  slim?: () => Response | Promise<Response>
) {
  return vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes("/api/schedule-slim")) {
      if (slim) return slim();
      throw new Error("ECONNREFUSED");
    }
    return cdn();
  });
}

async function loadApi() {
  return import("./api");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("schedule cache poisoning guards", () => {
  it("does not commit the schedule cache when gameDates is empty", async () => {
    const cdn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    const first = await api.getFullSchedule();
    expect(first).toEqual([]);
    expect(api.getScheduleAge()).toBeNull();

    const second = await api.getFullSchedule();
    expect(second).toHaveLength(1);
    expect(cdn).toHaveBeenCalledTimes(2);
  });

  it("caches a non-empty schedule and serves it without refetching", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    await api.getFullSchedule();
    const again = await api.getFullSchedule();
    expect(again).toHaveLength(1);
    expect(api.getScheduleAge()).not.toBeNull();
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("background refresh keeps stale data when the new payload is empty", async () => {
    const cdn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(goodSchedule))
      .mockResolvedValueOnce(jsonResponse({ leagueSchedule: { gameDates: [] } }));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    await api.getFullSchedule();

    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow + 3 * 60 * 60 * 1000);
    const stale = await api.getFullSchedule();
    expect(stale).toHaveLength(1);

    await vi.waitFor(() => expect(cdn).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    nowSpy.mockRestore();

    const after = await api.getFullSchedule();
    expect(after).toHaveLength(1);
  });
});

describe("schedule slim-route consumer path", () => {
  const slimFeed = {
    seasonYear: "2025",
    dates: [{ gameDate: "10/21/2025 00:00:00", games: [] }],
  };

  it("populates the in-memory cache from a slim-route hit without touching the CDN", async () => {
    const cdn = vi.fn();
    vi.stubGlobal("fetch", scheduleFetch(cdn, () => jsonResponse(slimFeed)));
    const api = await loadApi();

    const dates = await api.getFullSchedule();
    expect(dates).toHaveLength(1);
    expect(api.getScheduleAge()).not.toBeNull();
    expect(api.getScheduleSeasonYear()).toBe("2025");
    expect(cdn).not.toHaveBeenCalled();
  });

  it("falls back to the CDN when the slim route responds non-200", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn, () =>
      ({ ok: false, status: 503, json: async () => ({}) } as unknown as Response)
    ));
    const api = await loadApi();

    expect(await api.getFullSchedule()).toHaveLength(1);
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the CDN when the slim-route fetch throws", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    expect(await api.getFullSchedule()).toHaveLength(1);
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the CDN when the slim route returns invalid JSON", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn, () =>
      ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } } as unknown as Response)
    ));
    const api = await loadApi();

    expect(await api.getFullSchedule()).toHaveLength(1);
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("treats a 200 slim response with empty dates as a miss instead of committing it", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn, () => jsonResponse({ seasonYear: "2025", dates: [] })));
    const api = await loadApi();

    expect(await api.getFullSchedule()).toHaveLength(1);
    expect(api.getScheduleAge()).not.toBeNull();
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("getCachedScheduleFeed serves the route from the CDN path only, never /api/schedule-slim", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
      urls.push(String(url));
      return jsonResponse(goodSchedule);
    }));
    const api = await loadApi();

    const feed = await api.getCachedScheduleFeed();
    expect(feed.seasonYear).toBe("2025");
    expect(feed.dates).toHaveLength(1);
    expect(urls.some((u) => u.includes("/api/schedule-slim"))).toBe(false);
    expect(urls.some((u) => u.includes("scheduleLeagueV2"))).toBe(true);
  });
});

describe("player index cache poisoning guards", () => {
  it("does not cache an empty player index", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [] }] }))
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    expect(await api.getPlayerIndex()).toEqual([]);
    const second = await api.getPlayerIndex();
    expect(second).toHaveLength(1);
    expect(second[0].personId).toBe(1629029);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns [] when rowSet is missing instead of throwing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ headers: ["PERSON_ID"] }] }))
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    await expect(api.getPlayerIndex()).resolves.toEqual([]);
    const second = await api.getPlayerIndex();
    expect(second).toHaveLength(1);
  });

  it("returns [] on a 200 empty body and refetches next call", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    expect(await api.getPlayerIndex()).toEqual([]);
    expect(await api.getPlayerIndex()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches a normal player index payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const first = await api.getPlayerIndex();
    expect(first[0]).toMatchObject({ personId: 1629029, firstName: "Luka", lastName: "Doncic", teamAbbr: "LAL" });
    await api.getPlayerIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
