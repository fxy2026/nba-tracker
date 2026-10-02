import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findESPNId, getESPNCareerStats } from "./espn";

const labels = ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%", "FG", "3PT", "FT"];
const stats = ["70", "32", "25", "8", "7", "1", "0", "50", "35", "80", "9-18", "0-0", "-"];
const body = (values: (string | null)[] = stats) => ({ categories: [{ name: "regularSeason", labels, statistics: [{ season: { displayName: "2025-26" }, teamSlug: "los-angeles-lakers", stats: values }] }] });
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("ESPN career fallback cancellation and safety", () => {
  it("preserves known zeros and keeps unknown shooting attempts null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body() }));
    const result = await getESPNCareerStats("1966");
    expect(result.careerSeasons?.[0]).toMatchObject({ BLK: 0, FGA: 18, FG3A: 0, FTA: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["", "  ", null, "--", "-"])("preserves a career row with missing percentage marker %j", async marker => {
    const values = stats.map((value, i) => i >= 7 && i <= 9 ? marker : value);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body(values) }));
    const result = await getESPNCareerStats("1966");
    expect(result.careerSeasons?.[0]).toMatchObject({ PTS: 25, BLK: 0, FG_PCT: null, FG3_PCT: null, FT_PCT: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps genuine zero percentages numeric", async () => {
    const values = stats.map((value, i) => i >= 7 && i <= 9 ? "0" : value);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body(values) }));
    expect((await getESPNCareerStats("1966")).careerSeasons?.[0]).toMatchObject({ FG_PCT: 0, FG3_PCT: 0, FT_PCT: 0 });
  });

  it.each(["junk", "50junk", "101", "-1", "0x10"])("rejects an invalid percentage %j without inventing a ratio", async invalid => {
    const values = stats.map((value, i) => i === 8 ? invalid : value);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body(values) }));
    expect(await getESPNCareerStats("1966")).toEqual({ careerSeasons: null, recentGames: null });
  });

  it.each([null, {}, { categories: [] }, { categories: [{ name: "postseason", labels, statistics: [] }] }, { categories: [{ name: "regularSeason", labels: [], statistics: [] }] }, body([]), body(stats.map((value, i) => i === 2 ? "25junk" : value))])("returns unavailable for malformed data %#", async payload => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    expect(await getESPNCareerStats("1966")).toEqual({ careerSeasons: null, recentGames: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["headers", "body"])("keeps its 5s timeout active during %s and cleans it up", async stage => {
    let seen: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, { signal }) => {
      seen = signal;
      const stalled = () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
      return stage === "headers" ? stalled() : Promise.resolve({ ok: true, json: stalled });
    }));
    const pending = getESPNCareerStats("1966");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ careerSeasons: null, recentGames: null });
    expect(seen?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates a caller deadline through body parsing and detaches its listener", async () => {
    const controller = new AbortController(); const remove = vi.spyOn(controller.signal, "removeEventListener");
    vi.stubGlobal("fetch", vi.fn(async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) })));
    const pending = findESPNId("LeBron James", "LAL", controller.signal);
    await vi.advanceTimersByTimeAsync(100); controller.abort();
    expect(await pending).toBeNull(); expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not fetch for an already aborted request or unsupported team", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const controller = new AbortController(); controller.abort();
    expect(await findESPNId("LeBron James", "LAL", controller.signal)).toBeNull();
    expect(await getESPNCareerStats("1966", controller.signal)).toEqual({ careerSeasons: null, recentGames: null });
    expect(await findESPNId("LeBron James", "TOT")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects valid JSON delivered after its timeout by a non-cooperative body", async () => {
    let finishBody!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) })));
    const pending = getESPNCareerStats("1966");
    await vi.advanceTimersByTimeAsync(5000); finishBody(body());
    expect(await pending).toEqual({ careerSeasons: null, recentGames: null });
    expect(vi.getTimerCount()).toBe(0);
  });
});
