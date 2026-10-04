import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const player = { id: 101, first_name: "Arin", last_name: "Vale", team: { id: 11, abbreviation: "AAA" } };
const other = { ...player, id: 202, first_name: "Milo" };
const contract = (id = 101, extra = {}) => ({ player_id: id, season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000, ...extra });
const successCache = "public, s-maxage=86400, stale-while-revalidate=172800";
const failCache = "public, s-maxage=60";
const request = (name = "Arin Vale", team: string | null = "AAA") => new NextRequest(`http://salary.test/api/salary?${new URLSearchParams({ player: name, ...(team === null ? {} : { team }) })}`);
const response = (data: unknown, status = 200, headers = {}) => ({ ok: status < 400, status, headers: new Headers(headers), json: async () => data }) as Response;
let GET: typeof import("./route").GET;
let fetcher: ReturnType<typeof vi.fn>;
function fixtures(players: unknown = [player], contracts: unknown = [contract()]) {
  fetcher.mockResolvedValueOnce(response({ data: players })).mockResolvedValueOnce(response({ data: contracts }));
}
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  vi.stubEnv("BALLDONTLIE_API_KEY", "offline-test-dummy-key");
  fetcher = vi.fn().mockRejectedValue(new Error("Unexpected provider request; network is disabled in this test"));
  vi.stubGlobal("fetch", fetcher);
  ({ GET } = await import("./route"));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("salary route fail-closed provider boundary", () => {
  it("keeps provider, auth, two-request bound, five-row search, timeouts, revalidation and success caching", async () => {
    fixtures(); const result = await GET(request());
    expect(await result.json()).toEqual({ data: [{ season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000 }] });
    expect(result.headers.get("cache-control")).toBe(successCache);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://api.balldontlie.io/v1/players?search=Arin%20Vale&per_page=5",
      "https://api.balldontlie.io/v1/contracts/teams?team_id=11",
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toEqual({ headers: { Authorization: "offline-test-dummy-key" }, next: { revalidate: 86400 }, signal: expect.any(AbortSignal) });
    }
    expect(vi.getTimerCount()).toBe(0);
    expect((await import("./route")).maxDuration).toBe(10);
  });
  it.each(["AAA", null])("skips the wrong first name and returns the later exact identity with team %s", async team => {
    fixtures([other, player], [contract(202, { base_salary: 22_000_000 }), contract()]);
    expect((await (await GET(request("Arin Vale", team))).json()).data).toEqual([{ season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000 }]);
  });
  it.each([
    [other], [{ ...player, team: { id: 22, abbreviation: "BBB" } }],
    [player, { ...player, id: 202 }], [{ ...player, id: undefined }],
    [{ ...player, id: "101" }], [{ ...player, team: { id: "11", abbreviation: "AAA" } }],
    [player, { ...player, team: { id: 22, abbreviation: "AAA" } }],
    [{ ...player, last_name: "Vale Jr." }],
  ])("withholds contracts and never makes the team request for unverified search rows %#", async (...rows) => {
    fixtures(rows);
    expect(await (await GET(request())).json()).toEqual({ data: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("accepts coherent duplicate search rows while rejecting conflicting direct/nested contract IDs", async () => {
    fixtures([player, player], [contract(202, { player: { id: 101 } }), contract(101, { player: { id: 202 } }), contract(101, { player: { id: 101 } })]);
    expect((await (await GET(request())).json()).data).toEqual([{ season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000 }]);
  });
  it("rejects absent contract identity and string seasons; preserves unknown money and reported zero", async () => {
    fixtures([null, player], [
      null, { season: 2025, base_salary: 500 }, contract(101, { season: "2025" }),
      { player_id: 101, season: 2026, cap_hit: 0 },
      contract(101, { season: 2024, base_salary: false, cap_hit: "13000000" }),
      contract(101, { season: 2023, base_salary: -20, cap_hit: { invalid: true } }),
      contract(101, { season: 2022, base_salary: NaN, cap_hit: Infinity }),
    ]);
    expect((await (await GET(request())).json()).data).toEqual([
      { season: 2026, base_salary: null, cap_hit: 0 },
      { season: 2024, base_salary: null, cap_hit: null },
      { season: 2023, base_salary: null, cap_hit: null },
      { season: 2022, base_salary: null, cap_hit: null },
    ]);
  });
  it("keeps the 100-character provider query cap without treating the prefix as a full-name match", async () => {
    fixtures([player]); const name = `Arin Vale ${"x".repeat(150)}`;
    expect(await (await GET(request(name))).json()).toEqual({ data: [] });
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("search")).toBe(name.slice(0, 100));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not fetch without a name or configured key", async () => {
    expect(await (await GET(new NextRequest("http://salary.test/api/salary"))).json()).toEqual({ data: [] });
    vi.stubEnv("BALLDONTLIE_API_KEY", undefined);
    expect(await (await GET(request())).json()).toEqual({ data: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["search", "contracts"])("retains %s HTTP failure caching and Retry-After backoff", async stage => {
    if (stage === "contracts") fetcher.mockResolvedValueOnce(response({ data: [player] }));
    fetcher.mockResolvedValueOnce(response({}, 429, { "Retry-After": "120" }));
    const first = await GET(request()); expect(await first.json()).toEqual({ data: [] });
    expect(first.headers.get("cache-control")).toBe(failCache);
    if (stage === "contracts") fetcher.mockResolvedValueOnce(response({ data: [player] }));
    const second = await GET(request()); expect(await second.json()).toEqual({ data: [] });
    expect(second.headers.get("cache-control")).toBe(failCache);
    expect(fetcher).toHaveBeenCalledTimes(stage === "search" ? 1 : 3);
    await vi.advanceTimersByTimeAsync(120_000); fixtures();
    expect((await (await GET(request())).json()).data).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(stage === "search" ? 3 : 5);
  });
  it.each(["garbage", "0", "3601"])("keeps the one-minute fallback for invalid Retry-After %s", async value => {
    fetcher.mockResolvedValueOnce(response({}, 503, { "Retry-After": value }));
    await GET(request()); await vi.advanceTimersByTimeAsync(59_999); await GET(request());
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); fixtures();
    expect((await (await GET(request())).json()).data).toHaveLength(1);
  });
  it.each(["search", "contracts"])("retains the five-second %s request deadline and failure response", async stage => {
    if (stage === "contracts") fetcher.mockResolvedValueOnce(response({ data: [player] }));
    let signal: AbortSignal | undefined;
    fetcher.mockImplementationOnce((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    });
    const pending = GET(request()); await vi.advanceTimersByTimeAsync(4999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); const result = await pending;
    expect(signal?.aborted).toBe(true); expect(await result.json()).toEqual({ data: [] });
    expect(result.headers.get("cache-control")).toBe(failCache);
    expect(fetcher).toHaveBeenCalledTimes(stage === "search" ? 1 : 2);
  });
});
