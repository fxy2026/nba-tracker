import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import archive from "@/data/playerindex-2025-26.json";
import { playerIndexLabel, playerIndexStat } from "./player-index-provenance";

const payload = (season: unknown = "2026-27") => ({ ...archive, parameters: { ...archive.parameters, Season: season }, resultSets: [{ ...archive.resultSets[0], rowSet: [archive.resultSets[0].rowSet[0]] }] });
const response = (data: unknown) => ({ ok: true, json: async () => data });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T23:59:00Z")); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("player index provenance and bounded refresh", () => {
  it("deduplicates initial callers and keeps compatibility accessors", async () => {
    fetchMock.mockResolvedValue(response(payload()));
    const api = await import("./api");
    const [a, b, players, player] = await Promise.all([api.getPlayerIndexSnapshot(), api.getPlayerIndexSnapshot(), api.getPlayerIndex(), api.getPlayerInfo(1630173)]);
    expect(a).toBe(b); expect(players).toBe(a.players); expect(player).toBe(a.players[0]); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.provenance).toEqual({ source: "nba-cdn", season: "2026-27", stale: false, retrievedAt: "2026-09-30T23:59:00.000Z" });
    expect(fetchMock.mock.calls[0][1].next.revalidate).toBe(900);
  });
  it("expires successful data after six hours, including across season rollover", async () => {
    fetchMock.mockResolvedValueOnce(response(payload("2025-26"))).mockResolvedValueOnce(response(payload("2026-27")));
    const api = await import("./api"); const first = await api.getPlayerIndexSnapshot();
    vi.advanceTimersByTime(6 * 3600_000 - 1); expect(await api.getPlayerIndexSnapshot()).toBe(first);
    expect(first.provenance.season).toBe("2025-26");
    vi.advanceTimersByTime(1); expect((await api.getPlayerIndexSnapshot()).provenance.season).toBe("2026-27"); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["403", "network", "timeout", "json", "empty", "schema", "bad-stat"])("uses archive for %s, retries after cooldown and recovers", async kind => {
    if (kind === "network") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else if (kind === "timeout") fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    else if (kind === "403") fetchMock.mockResolvedValueOnce({ ok: false });
    else if (kind === "json") fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("bad json"); } });
    else if (kind === "bad-stat") { const p = payload(); p.resultSets[0].rowSet[0] = [...p.resultSets[0].rowSet[0]]; p.resultSets[0].rowSet[0][22] = "invalid"; fetchMock.mockResolvedValueOnce(response(p)); }
    else fetchMock.mockResolvedValueOnce(response(kind === "empty" ? { resultSets: [] } : { resultSets: [{ headers: [], rowSet: [[1]] }] }));
    fetchMock.mockResolvedValueOnce(response(payload()));
    const api = await import("./api"); const fallback = await api.getPlayerIndexSnapshot();
    expect(fallback.players).toHaveLength(587); expect(fallback.provenance).toEqual({ source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null });
    vi.advanceTimersByTime(15 * 60_000 - 1); await api.getPlayerIndex(); expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); const [a, b] = await Promise.all([api.getPlayerIndexSnapshot(), api.getPlayerIndexSnapshot()]);
    expect(a).toBe(b); expect(a.provenance.source).toBe("nba-cdn"); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("preserves validated live data and retrieval date on failed refresh, with cooldown", async () => {
    fetchMock.mockResolvedValueOnce(response(payload())).mockResolvedValueOnce(response({ broken: true })).mockResolvedValueOnce(response(payload("2027-28")));
    const api = await import("./api"); const first = await api.getPlayerIndexSnapshot();
    vi.advanceTimersByTime(6 * 3600_000); const stale = await api.getPlayerIndexSnapshot();
    expect(stale.players).toBe(first.players); expect(stale.provenance).toEqual({ ...first.provenance, stale: true });
    await api.getPlayerInfo(1630173); expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(15 * 60_000); expect((await api.getPlayerIndexSnapshot()).provenance.stale).toBe(false);
  });
  it.each([null, undefined, 2026, "invalid"])("never guesses season for %s", async season => {
    fetchMock.mockResolvedValue(response(payload(season))); const api = await import("./api");
    // undefined argument uses helper default, so explicitly remove Season.
    if (season === undefined) { const p = payload(); delete (p.parameters as { Season?: unknown }).Season; fetchMock.mockResolvedValue(response(p)); }
    expect((await api.getPlayerIndexSnapshot()).provenance.season).toBeNull();
  });
  it("keeps valid null source cells without inventing statistics or losing players", async () => {
    fetchMock.mockResolvedValue(response(archive)); const api = await import("./api"); const result = await api.getPlayerIndexSnapshot();
    expect(result.players).toHaveLength(587); expect(result.players.filter(p => p.pts === null)).toHaveLength(5);
    expect(playerIndexStat(null)).toBe("—"); expect(playerIndexStat(0)).toBe("0.0");
  });
  it("labels archive, stale upstream and unknown season in both languages", () => {
    const meta = { source: "bundled-archive" as const, season: "2025-26", stale: true, retrievedAt: null };
    expect(playerIndexLabel(meta, "en")).toBe("2025-26 · archived snapshot");
    expect(playerIndexLabel(meta, "zh")).toBe("2025-26 · 存档快照");
    expect(playerIndexLabel({ ...meta, source: "nba-cdn", season: null }, "en")).toContain("season unspecified");
    expect(playerIndexLabel({ ...meta, source: "nba-cdn" }, "zh")).toContain("刷新暂不可用");
  });
});
