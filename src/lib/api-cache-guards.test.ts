import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Since the 2026-07 cdn.nba.com block, the schedule/player-index pipelines
// degrade to the baked 2025-26 archive instead of to empty — these tests pin
// both the merge behavior (live wins, archive fills) and the never-empty floor.

const goodSchedule = {
  leagueSchedule: {
    seasonYear: "2025-26",
    gameDates: [{ gameDate: "10/21/2025 00:00:00", games: [] }],
  },
};
const LIVE_DATE = "10/21/2025 00:00:00";

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

// The live fixture date also exists in the archive — the merged result must
// carry the live version (zero games) for it, proving live wins on conflict.
function liveWins(dates: { gameDate: string; games: unknown[] }[]) {
  return dates.some((d) => d.gameDate === LIVE_DATE && d.games.length === 0);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("schedule cache degradation guards", () => {
  it("degrades an empty live feed to the baked archive and caches it", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    const first = await api.getFullSchedule();
    expect(first.length).toBeGreaterThan(200);
    expect(api.getScheduleAge()).not.toBeNull();

    await api.getFullSchedule();
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("merges a non-empty schedule over the archive and serves it without refetching", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    await api.getFullSchedule();
    const again = await api.getFullSchedule();
    expect(again.length).toBeGreaterThan(200);
    expect(liveWins(again)).toBe(true);
    expect(api.getScheduleAge()).not.toBeNull();
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("background refresh keeps merged data when the new payload is empty", async () => {
    const cdn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(goodSchedule))
      .mockResolvedValueOnce(jsonResponse({ leagueSchedule: { gameDates: [] } }));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    await api.getFullSchedule();

    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow + 3 * 60 * 60 * 1000);
    const stale = await api.getFullSchedule();
    expect(liveWins(stale)).toBe(true);

    await vi.waitFor(() => expect(cdn).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    nowSpy.mockRestore();

    const after = await api.getFullSchedule();
    expect(liveWins(after)).toBe(true);
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

    const dates = await api.getFullSchedule();
    expect(liveWins(dates)).toBe(true);
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the CDN when the slim-route fetch throws", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn));
    const api = await loadApi();

    const dates = await api.getFullSchedule();
    expect(liveWins(dates)).toBe(true);
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the CDN when the slim route returns invalid JSON", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn, () =>
      ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } } as unknown as Response)
    ));
    const api = await loadApi();

    const dates = await api.getFullSchedule();
    expect(liveWins(dates)).toBe(true);
    expect(cdn).toHaveBeenCalledTimes(1);
  });

  it("treats a 200 slim response with empty dates as a miss instead of committing it", async () => {
    const cdn = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", scheduleFetch(cdn, () => jsonResponse({ seasonYear: "2025", dates: [] })));
    const api = await loadApi();

    const dates = await api.getFullSchedule();
    expect(liveWins(dates)).toBe(true);
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
    expect(liveWins(feed.dates)).toBe(true);
    expect(urls.some((u) => u.includes("/api/schedule-slim"))).toBe(false);
    expect(urls.some((u) => u.includes("scheduleLeagueV2"))).toBe(true);
  });
});

describe("player index degradation guards", () => {
  it("serves the baked snapshot when the live index is empty, then caches it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultSets: [{ rowSet: [] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const first = await api.getPlayerIndex();
    expect(first.length).toBeGreaterThan(500);
    await api.getPlayerIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves the baked snapshot when rowSet is missing instead of throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultSets: [{ headers: ["PERSON_ID"] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const players = await api.getPlayerIndex();
    expect(players.length).toBeGreaterThan(500);
  });

  it("serves the baked snapshot on a 200 empty body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const players = await api.getPlayerIndex();
    expect(players.length).toBeGreaterThan(500);
  });

  it("prefers a normal live payload over the snapshot and caches it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultSets: [{ rowSet: [goodPlayerRow] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const first = await api.getPlayerIndex();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ personId: 1629029, firstName: "Luka", lastName: "Doncic", teamAbbr: "LAL" });
    await api.getPlayerIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
