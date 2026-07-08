import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

async function freshFetchStats() {
  vi.resetModules();
  const mod = await import("./statsProxy");
  return mod.fetchStats;
}

const URL_A = "https://stats.nba.com/stats/playerawards?PlayerID=2544";
const ok = () => new Response("{}", { status: 200 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const timeoutArgs = () => vi.mocked(AbortSignal.timeout).mock.calls.map((c) => c[0]);

describe("fetchStats", () => {
  it("returns the upstream response on success without arming the breaker", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockResolvedValue(ok());
    const res = await fetchStats(URL_A, { key: "playerawards" });
    expect(res?.ok).toBe(true);
    await fetchStats(URL_A, { key: "playerawards" });
    expect(timeoutArgs()).toEqual([8000, 8000]);
  });

  it("uses the caller's timeoutMs when the breaker is closed", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockResolvedValue(ok());
    await fetchStats(URL_A, { key: "shotchartdetail", timeoutMs: 20000 });
    expect(timeoutArgs()).toEqual([20000]);
  });

  it("arms the breaker on failure: next call within the TTL probes at 1500ms", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockRejectedValue(new Error("aborted"));
    expect(await fetchStats(URL_A, { key: "playerawards" })).toBeNull();
    expect(await fetchStats(URL_A, { key: "playerawards", timeoutMs: 6000 })).toBeNull();
    expect(timeoutArgs()).toEqual([8000, 1500]);
  });

  it("a successful open-breaker probe clears the breaker", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock
      .mockRejectedValueOnce(new Error("aborted"))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok());
    await fetchStats(URL_A, { key: "playerawards" });
    const probe = await fetchStats(URL_A, { key: "playerawards" });
    expect(probe?.ok).toBe(true);
    await fetchStats(URL_A, { key: "playerawards" });
    expect(timeoutArgs()).toEqual([8000, 1500, 8000]);
  });

  it("a failed open-breaker probe does NOT extend the deadline", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockRejectedValue(new Error("aborted"));
    await fetchStats(URL_A, { key: "playerawards" });
    vi.setSystemTime(14 * 60 * 1000);
    await fetchStats(URL_A, { key: "playerawards" });
    vi.setSystemTime(15 * 60 * 1000 + 1);
    await fetchStats(URL_A, { key: "playerawards" });
    expect(timeoutArgs()).toEqual([8000, 1500, 8000]);
  });

  it("breaker state is tracked per key", async () => {
    const fetchStats = await freshFetchStats();
    fetchMock.mockRejectedValueOnce(new Error("aborted")).mockResolvedValueOnce(ok());
    await fetchStats(URL_A, { key: "playerawards" });
    await fetchStats(URL_A, { key: "leaguedashteamstats" });
    expect(timeoutArgs()).toEqual([8000, 8000]);
  });
});
