import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const goodSchedule = {
  leagueSchedule: {
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    const first = await api.getFullSchedule();
    expect(first).toEqual([]);
    expect(api.getScheduleAge()).toBeNull();

    const second = await api.getFullSchedule();
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches a non-empty schedule and serves it without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(goodSchedule));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    await api.getFullSchedule();
    const again = await api.getFullSchedule();
    expect(again).toHaveLength(1);
    expect(api.getScheduleAge()).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("background refresh keeps stale data when the new payload is empty", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(goodSchedule))
      .mockResolvedValueOnce(jsonResponse({ leagueSchedule: { gameDates: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await loadApi();

    await api.getFullSchedule();

    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow + 3 * 60 * 60 * 1000);
    const stale = await api.getFullSchedule();
    expect(stale).toHaveLength(1);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    nowSpy.mockRestore();

    const after = await api.getFullSchedule();
    expect(after).toHaveLength(1);
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
