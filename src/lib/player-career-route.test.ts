import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const row = {
  SEASON_ID: "2025-26", TEAM_ABBREVIATION: "LAL", GP: 70, MIN: 32, PTS: 25,
  REB: 8, AST: 7, STL: 1, BLK: 0, FG_PCT: .5, FG3_PCT: .35, FT_PCT: .8,
  FGA: 18, FG3A: 5, FTA: 6,
};
const nba = (rows: Record<string, unknown>[] = [row]) => ({
  resultSets: [{ name: "SeasonTotalsRegularSeason", headers: Object.keys(row), rowSet: rows.map(r => Object.keys(row).map(k => r[k])) }],
});
const labels = ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%", "FG", "3PT", "FT"];
const stats = ["70", "32", "25", "8", "7", "1", "0", "50", "35", "80", "9-18", "1.75-5", "4.8-6"];
const espn = (statistics: unknown[] = [{ season: { displayName: "2025-26" }, teamSlug: "los-angeles-lakers", stats }]) => ({ categories: [{ name: "regularSeason", labels, statistics }] });
const roster = { athletes: [{ id: "1966", fullName: "LeBron James" }] };
const ok = (payload: unknown) => ({ ok: true, json: async () => payload });
const request = (query = "id=2544&name=LeBron+James&team=LAL", signal?: AbortSignal) => new NextRequest(`http://localhost/api/player?${query}`, { signal });

function waitFor<T>(ms: number, value: T, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(value); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), ms);
    return controller.signal;
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("player career provider boundary", () => {
  it("preserves valid NBA data, known zero, nullable percentages, and successful cache headers", async () => {
    const data = { ...row, BLK: 0, FT_PCT: null, FTA: null };
    const fetcher = vi.fn().mockResolvedValue(ok(nba([data]))); vi.stubGlobal("fetch", fetcher);
    const { GET, maxDuration } = await import("@/app/api/player/route");
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ careerSeasons: [data], recentGames: null });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(maxDuration).toBe(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps a validated empty NBA history successful without trying ESPN", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(nba([]))); vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request());
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ careerSeasons: [], recentGames: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    null, {}, { resultSets: {} }, { resultSets: [{ name: "SeasonTotalsRegularSeason", rowSet: [] }] },
    { resultSets: [{ name: "SeasonTotalsRegularSeason", headers: [], rowSet: [] }] },
    { resultSets: [{ name: "SeasonTotalsRegularSeason", headers: Object.keys(row), rowSet: [[]] }] },
    nba([{ ...row, PTS: "25" }]), nba([{ ...row, PTS: null }]),
  ])("does not call malformed NBA data a successful empty history: %#", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(payload)));
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request("id=2544"));
    expect(res.status).toBe(503); expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ careerSeasons: null, recentGames: null });
  });

  it.each(["roster", "stats", "malformed-stats", "partial-stats", "body-json"])("does not cache a failed %s fallback", async (failure) => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce(failure === "roster" ? { ok: false, status: 403 } : ok(roster));
    if (failure === "stats") fetcher.mockResolvedValueOnce({ ok: false, status: 403 });
    if (failure === "malformed-stats") fetcher.mockResolvedValueOnce(ok({ categories: [] }));
    if (failure === "partial-stats") fetcher.mockResolvedValueOnce(ok(espn([{ season: { displayName: "2025-26" }, stats }, { season: { displayName: "2024-25" }, stats: [] }])));
    if (failure === "body-json") fetcher.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } });
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request());
    expect(res.status).toBe(503); expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ careerSeasons: null });
    expect(fetcher).toHaveBeenCalledTimes(failure === "roster" ? 2 : 3);
  });

  it("accepts a validated empty ESPN category", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(ok(roster)).mockResolvedValueOnce(ok(espn([])));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request());
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ careerSeasons: [], recentGames: null });
  });

  it("allows the existing fallback to finish at 12s, including a slow JSON body", async () => {
    const fetcher = vi.fn()
      .mockImplementationOnce((_url, { signal }) => waitFor(20000, ok(nba()), signal))
      .mockImplementationOnce((_url, { signal }) => waitFor(4500, ok(roster), signal))
      .mockImplementationOnce(async (_url, { signal }) => ({ ok: true, json: () => waitFor(3500, espn(), signal) }));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const pending = GET(request());
    const settled = vi.fn(); void pending.then(settled);
    await vi.advanceTimersByTimeAsync(10000); expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000); const res = await pending;
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ careerSeasons: [{ SEASON_ID: "2025-26", PTS: 25, BLK: 0 }] });
    expect(fetcher).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
  });

  it("applies the 14s total deadline to a stalled ESPN body and makes no further calls", async () => {
    const fetcher = vi.fn()
      .mockImplementationOnce((_url, { signal }) => waitFor(20000, ok(nba()), signal))
      .mockImplementationOnce((_url, { signal }) => waitFor(4900, ok(roster), signal))
      .mockImplementationOnce(async (_url, { signal }) => ({ ok: true, json: () => waitFor(20000, espn(), signal) }));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const pending = GET(request());
    await vi.advanceTimersByTimeAsync(14000); const res = await pending;
    expect(res.status).toBe(503); expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetcher).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
  });

  it("stops before fallback if the incoming request is cancelled during the NBA body", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url, { signal }) => ({ ok: true, json: () => waitFor(20000, nba(), signal) }));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const pending = GET(request(undefined, controller.signal));
    await vi.advanceTimersByTimeAsync(100); controller.abort();
    const res = await pending; expect(res.status).toBe(503); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("settles at 14s even when a body ignores cancellation, and rejects its late valid result", async () => {
    let finishBody!: (value: unknown) => void;
    let seen: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url, { signal }) => {
      seen = signal;
      return { ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) };
    });
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const pending = GET(request());
    const settled = vi.fn(); void pending.then(settled);
    await vi.advanceTimersByTimeAsync(13999); expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); const res = await pending;
    expect(res.status).toBe(503); expect(seen?.aborted).toBe(true);
    finishBody(nba()); await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
