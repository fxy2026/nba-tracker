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
const nbaWithPlayerIds = (...playerIds: unknown[]) => ({ resultSets: [{
  name: "SeasonTotalsRegularSeason", headers: [...Object.keys(row), "PLAYER_ID"],
  rowSet: playerIds.map(id => [...Object.values(row), id]),
}] });
const labels = ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%", "FG", "3PT", "FT"];
const stats = ["70", "32", "25", "8", "7", "1", "0", "50", "35", "80", "9-18", "1.75-5", "4.8-6"];
const espn = (statistics: unknown[] = [{ season: { displayName: "2025-26" }, teamSlug: "los-angeles-lakers", stats }]) => ({ categories: [{ name: "regularSeason", labels, statistics }] });
const roster = { athletes: [{ id: "1966", fullName: "LeBron James" }] };
const ok = (payload: unknown) => ({ ok: true, json: async () => payload });
const retrievedAt = "2026-10-03T02:00:00.000Z";
const provenance = (source = "nba-stats", providerPlayerId = "2544", time = retrievedAt) => ({
  source, providerPlayerId, scope: "regular-season", retrievalKind: "api-response", retrievedAt: time,
});
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
  vi.setSystemTime(new Date(retrievedAt));
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
    expect(await res.json()).toEqual({ careerSeasons: [data], recentGames: null, provenance: provenance() });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(maxDuration).toBe(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps a validated empty NBA history successful without trying ESPN", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(nba([]))); vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request());
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ careerSeasons: [], recentGames: null, provenance: provenance() });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves matching optional NBA row identities before attributing the history", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(nbaWithPlayerIds(2544)));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ careerSeasons: [{ ...row, PLAYER_ID: 2544 }], recentGames: null, provenance: provenance() });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([1, null, undefined, "2544", NaN, 2544.5])("falls back rather than attributing an NBA row with invalid PLAYER_ID %j", async id => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(nbaWithPlayerIds(2544, id)))
      .mockResolvedValueOnce(ok(roster)).mockResolvedValueOnce(ok(espn()));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ careerSeasons: [{ SEASON_ID: "2025-26", PTS: 25 }], provenance: provenance("espn", "1966") });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("leaves an NBA identity conflict unavailable when fallback cannot be requested", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(nbaWithPlayerIds(1))));
    const { GET } = await import("@/app/api/player/route"); const res = await GET(request("id=2544"));
    expect(res.status).toBe(503);
    expect(await res.json()).not.toHaveProperty("provenance");
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
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ careerSeasons: [], recentGames: null, provenance: provenance("espn", "1966") });
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
    const result = await res.json();
    expect(result).toMatchObject({
      careerSeasons: [{ SEASON_ID: "2025-26", PTS: 25, BLK: 0 }],
      provenance: provenance("espn", "1966", "2026-10-03T02:00:12.000Z"),
    });
    expect(result).not.toHaveProperty("careerShooting");
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
it('returns career shooting rates from the same response without an extra request',async()=>{
 const summary={PLAYER_ID:2544,GP:70,FG_PCT:.467,FG3_PCT:.35,FT_PCT:.8,FGA:18,FG3A:5,FTA:6};const body=nba();body.resultSets.push({name:'CareerTotalsRegularSeason',headers:Object.keys(summary),rowSet:[Object.values(summary)]});const fetcher=vi.fn().mockResolvedValue(ok(body));vi.stubGlobal('fetch',fetcher);const{GET}=await import('@/app/api/player/route');const response=await GET(request());expect(await response.json()).toMatchObject({careerSeasons:[row],careerShooting:{source:'nba-career-totals',FG_PCT:.467,FG3_PCT:.35,FT_PCT:.8}});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('wrong-player optional career summary leaves valid seasons but no guessed rate',async()=>{
 const summary={PLAYER_ID:1,GP:70,FG_PCT:.467,FG3_PCT:.35,FT_PCT:.8,FGA:18,FG3A:5,FTA:6};const body=nba();body.resultSets.push({name:'CareerTotalsRegularSeason',headers:Object.keys(summary),rowSet:[Object.values(summary)]});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(ok(body)));const{GET}=await import('@/app/api/player/route');const response=await GET(request());expect(await response.json()).toEqual({careerSeasons:[row],recentGames:null,provenance:provenance()});
});

it("attributes only a validated NBA response, ignoring upstream provenance claims", async () => {
  const fetcher = vi.fn().mockResolvedValue(ok({ ...nba(), provenance: { source: "verified", retrievedAt: "2099-01-01" } }));
  vi.stubGlobal("fetch", fetcher);
  const { GET } = await import("@/app/api/player/route");
  const first = await GET(request());
  expect((await first.json()).provenance).toEqual(provenance());
  // The same body may be served by the framework's fetch cache. This clock
  // dates API retrieval only, not the body or the provider's last update.
  await vi.advanceTimersByTimeAsync(60_000);
  const second = await GET(request());
  expect((await second.json()).provenance).toEqual(provenance("nba-stats", "2544", "2026-10-03T02:01:00.000Z"));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining("PlayerID=2544"), expect.objectContaining({ next: { revalidate: 3600 } }));
});

it("does not attach a source or retrieval time to a failed response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  const { GET } = await import("@/app/api/player/route");
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty("provenance");
});
