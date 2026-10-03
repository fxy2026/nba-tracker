import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import lebron from "@/data/player-career-archives/2544-2026-10-03.json";
import jokic from "@/data/player-career-archives/203999-2026-10-03.json";
import curry from "@/data/player-career-archives/201939-2026-10-03.json";
import giannis from "@/data/player-career-archives/203507-2026-10-03.json";
import { getReviewedCareerArchive } from "./player-career-archive";
const providers = vi.hoisted(() => ({ nba: vi.fn(), roster: vi.fn(), espn: vi.fn() }));
vi.mock("@/lib/statsProxy", () => ({ STATS_BASE: "https://stats.nba.com/stats", fetchStats: providers.nba }));
vi.mock("@/lib/espn", () => ({ findESPNId: providers.roster, getESPNCareerStats: providers.espn }));
import { GET } from "@/app/api/player/route";
const now = "2026-10-03T04:00:00.000Z";
const request = (id = "2544", extra = "", signal?: AbortSignal) => new NextRequest(`http://localhost/api/player?id=${id}${extra}`, { signal });
const nba = (rows = lebron.data.careerSeasons, id = 2544) => {
  const headers = [...Object.keys(lebron.data.careerSeasons[0]), "PLAYER_ID"];
  return { ok: true, json: async () => ({ resultSets: [{ name: "SeasonTotalsRegularSeason", headers,
    rowSet: rows.map(row => [...headers.slice(0, -1).map(k => (row as Record<string, unknown>)[k]), id]) }] }) };
};
beforeEach(async () => {
  await Promise.all(["2544", "203999", "201939", "203507"].map(getReviewedCareerArchive));
  vi.useFakeTimers(); vi.setSystemTime(now);
  providers.nba.mockReset().mockResolvedValue(null);
  providers.roster.mockReset().mockResolvedValue(null);
  providers.espn.mockReset().mockResolvedValue(null);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("reviewed dated fallback after the bounded live chain", () => {
  it.each([["2544", lebron], ["203999", jokic], ["201939", curry], ["203507", giannis]] as const)("returns %s archive on provider failure without adding calls or updating capture time", async (id, record) => {
    const res = await GET(request(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...record.data, recentGames: null });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(providers.nba).toHaveBeenCalledTimes(1);
    expect(providers.roster).not.toHaveBeenCalled(); expect(providers.espn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe.each([["201939", curry, "GSW", "3975"], ["203507", giannis, "MIL", "3032977"]] as const)("newly reviewed player %s", (id, record, team, espnId) => {
    it.each(["truncated", "empty", "older-games", "wrong-player"])("retains complete archived coverage for %s live data", async scenario => {
      const rows = scenario === "empty" ? [] : scenario === "truncated" ? record.data.careerSeasons.slice(1)
        : record.data.careerSeasons.map((row, index) => scenario === "older-games" && index === 0 ? { ...row, GP: row.GP - 1 } : row);
      providers.nba.mockResolvedValue(nba(rows, scenario === "wrong-player" ? 2544 : Number(id)));
      const res = await GET(request(id));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ...record.data, recentGames: null });
      expect(providers.nba).toHaveBeenCalledTimes(1);
      expect(providers.roster).not.toHaveBeenCalled(); expect(providers.espn).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("allows complete live NBA history to replace the archive wholesale", async () => {
      const updated = record.data.careerSeasons.map(row => ({ ...row, PTS: row.PTS + .1 }));
      providers.nba.mockResolvedValue(nba(updated, Number(id)));
      const res = await GET(request(id)); const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.careerSeasons).toEqual(updated.map(row => ({ ...row, PLAYER_ID: Number(id) })));
      expect(body.provenance).toEqual({ source: "nba-stats", providerPlayerId: id, scope: "regular-season", retrievalKind: "api-response", retrievedAt: now });
      expect(body).not.toHaveProperty("stale"); expect(body).not.toHaveProperty("careerAverage"); expect(body).not.toHaveProperty("careerShooting");
      expect(providers.nba).toHaveBeenCalledTimes(1); expect(providers.roster).not.toHaveBeenCalled();
    });

    it("uses the reviewed canonical name and accepts complete ESPN coverage", async () => {
      providers.nba.mockResolvedValue(nba([], Number(id)));
      providers.roster.mockResolvedValue(espnId);
      providers.espn.mockResolvedValue({ careerSeasons: record.data.careerSeasons });
      const res = await GET(request(id, `&name=Unrelated+Player&team=${team}`)); const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.careerSeasons).toEqual(record.data.careerSeasons);
      expect(body.provenance).toEqual({ source: "espn", providerPlayerId: espnId, scope: "regular-season", retrievalKind: "api-response", retrievedAt: now });
      expect(body).not.toHaveProperty("stale"); expect(body).not.toHaveProperty("careerAverage"); expect(body).not.toHaveProperty("careerShooting");
      expect(providers.roster).toHaveBeenCalledWith(record.player.name, team, expect.any(AbortSignal));
      expect(providers.nba).toHaveBeenCalledTimes(1); expect(providers.roster).toHaveBeenCalledTimes(1); expect(providers.espn).toHaveBeenCalledTimes(1);
    });

    it("does not enable ESPN requests when only the archive supplies the name", async () => {
      const res = await GET(request(id, `&team=${team}`));
      expect(await res.json()).toEqual({ ...record.data, recentGames: null });
      expect(providers.nba).toHaveBeenCalledTimes(1);
      expect(providers.roster).not.toHaveBeenCalled(); expect(providers.espn).not.toHaveBeenCalled();
    });
  });

  it("prefers complete live NBA history and keeps archived aggregates out of it", async () => {
    const updated = lebron.data.careerSeasons.map(row => ({ ...row, PTS: row.PTS + .1 }));
    providers.nba.mockResolvedValue(nba(updated));
    const res = await GET(request()); const body = await res.json();
    expect(body.provenance).toEqual({ source: "nba-stats", providerPlayerId: "2544", scope: "regular-season", retrievalKind: "api-response", retrievedAt: now });
    expect(body.careerSeasons[0].PTS).toBe(updated[0].PTS);
    expect(body).not.toHaveProperty("stale"); expect(body).not.toHaveProperty("careerAverage"); expect(body).not.toHaveProperty("careerShooting");
    expect(providers.nba).toHaveBeenCalledTimes(1); expect(providers.roster).not.toHaveBeenCalled();
  });

  it.each(["truncated", "empty", "older-games", "wrong-player"])("does not replace known history with %s live data", async scenario => {
    const rows = scenario === "empty" ? [] : scenario === "truncated" ? lebron.data.careerSeasons.slice(1)
      : lebron.data.careerSeasons.map((row, i) => scenario === "older-games" && i === 22 ? { ...row, GP: 59 } : row);
    providers.nba.mockResolvedValue(nba(rows, scenario === "wrong-player" ? 203999 : 2544));
    const res = await GET(request());
    expect(await res.json()).toEqual({ ...lebron.data, recentGames: null });
    expect(providers.nba).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing ESPN chain and prefers a complete valid ESPN response", async () => {
    providers.nba.mockResolvedValue(nba([]));
    providers.roster.mockResolvedValue("1966");
    providers.espn.mockResolvedValue({ careerSeasons: lebron.data.careerSeasons });
    const res = await GET(request("2544", "&name=Unrelated+Player&team=LAL")); const body = await res.json();
    expect(body.provenance).toMatchObject({ source: "espn", providerPlayerId: "1966", retrievedAt: now });
    expect(body).not.toHaveProperty("stale"); expect(body).not.toHaveProperty("careerAverage");
    // Known archives use their canonical identity, never user-supplied name.
    expect(providers.roster).toHaveBeenCalledWith("LeBron James", "LAL", expect.any(AbortSignal));
    expect(providers.nba).toHaveBeenCalledTimes(1); expect(providers.roster).toHaveBeenCalledTimes(1); expect(providers.espn).toHaveBeenCalledTimes(1);
  });

  it("rejects partial ESPN history and serves a single unmixed archive", async () => {
    providers.roster.mockResolvedValue("1966");
    providers.espn.mockResolvedValue({ careerSeasons: lebron.data.careerSeasons.slice(-1) });
    const res = await GET(request("2544", "&name=LeBron+James&team=LAL"));
    expect(await res.json()).toEqual({ ...lebron.data, recentGames: null });
    expect(providers.nba).toHaveBeenCalledTimes(1); expect(providers.roster).toHaveBeenCalledTimes(1); expect(providers.espn).toHaveBeenCalledTimes(1);
  });

  it("serves the fixed capture at 14s when a provider body ignores cancellation", async () => {
    let finishBody!: (body: unknown) => void;
    providers.nba.mockResolvedValue({ ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) });
    const pending = GET(request());
    await vi.waitFor(() => expect(providers.nba).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(14000);
    const res = await pending;
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ ...lebron.data, recentGames: null });
    expect(providers.nba.mock.calls[0][1].signal.aborted).toBe(true);
    finishBody(await nba().json()); await vi.advanceTimersByTimeAsync(0);
    expect(providers.roster).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("respects visitor cancellation rather than serving a snapshot as a late success", async () => {
    const controller = new AbortController();
    providers.nba.mockImplementation((_url, { signal }) => new Promise(resolve => signal.addEventListener("abort", () => resolve(null), { once: true })));
    const pending = GET(request("2544", "", controller.signal));
    await vi.waitFor(() => expect(providers.nba).toHaveBeenCalledTimes(1));
    controller.abort(); const res = await pending;
    expect(res.status).toBe(503); expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).not.toHaveProperty("provenance"); expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps valid-empty success and unavailable 503 behavior for unarchived IDs", async () => {
    expect(await getReviewedCareerArchive("1")).toBeNull();
    providers.nba.mockResolvedValueOnce(nba([], 1));
    const empty = await GET(request("1"));
    expect(empty.status).toBe(200); expect((await empty.json()).careerSeasons).toEqual([]);
    const unavailable = await GET(request("1"));
    expect(unavailable.status).toBe(503); expect(await unavailable.json()).not.toHaveProperty("provenance");
  });
});

it('does not enable ESPN calls merely because a local archive supplies a missing name', async () => {
  const res = await GET(request('2544', '&team=LAL'));
  expect((await res.json()).stale).toBe(true);
  expect(providers.nba).toHaveBeenCalledTimes(1); expect(providers.roster).not.toHaveBeenCalled(); expect(providers.espn).not.toHaveBeenCalled();
});
it('uses the archive if a source throws rather than converting the whole endpoint to an error', async () => {
  providers.nba.mockRejectedValue(new Error('network unavailable'));
  const res = await GET(request());
  expect(res.status).toBe(200); expect(await res.json()).toEqual({ ...lebron.data, recentGames: null });
});
