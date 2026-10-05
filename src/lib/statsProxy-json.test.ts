import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const url = "https://stats.nba.com/stats/playergamelog?PlayerID=2544";
const key = "playergamelog";
const fetcher = vi.fn();
let deadlines: AbortController[];

// Deterministically inject transport aborts without contacting an upstream or
// equating a selected timeout budget with a measured wall-clock latency.
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(0);
  deadlines = [];
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController();
    deadlines.push(controller);
    return controller.signal;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

const budgets = () => vi.mocked(AbortSignal.timeout).mock.calls.map(([ms]) => ms);
const expire = (index = deadlines.length - 1) => deadlines[index].abort(new DOMException("Timed out", "TimeoutError"));
const flush = () => vi.advanceTimersByTimeAsync(0);

function stalledHeaders(_url: string, { signal }: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
  });
}
function streamingBody(signal: AbortSignal) {
  let finish!: () => void;
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"rows":'));
      const onAbort = () => controller.error(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      finish = () => {
        signal.removeEventListener("abort", onAbort);
        controller.enqueue(new TextEncoder().encode("[1,2,3]}"));
        controller.close();
      };
    },
  }));
  return { response, finish };
}
const stalledBody = (_url: string, { signal }: RequestInit) => streamingBody(signal!).response;

describe("fetchStatsJson body-aware breaker accounting", () => {
  it("parses once and retains the exact URL, headers, cache options and custom budget", async () => {
    const { fetchStatsJson, STATS_HEADERS } = await import("./statsProxy");
    const response = Response.json({ rows: [1, 2, 3] });
    const json = vi.spyOn(response, "json");
    const clone = vi.spyOn(response, "clone");
    fetcher.mockResolvedValue(response);
    expect(await fetchStatsJson(url, { key, timeoutMs: 20000, revalidate: 86400 })).toEqual({
      ok: true, status: 200, data: { rows: [1, 2, 3] },
    });
    expect(json).toHaveBeenCalledTimes(1); expect(clone).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(url, {
      headers: STATS_HEADERS, next: { revalidate: 86400 }, signal: deadlines[0].signal,
    });
    expect(budgets()).toEqual([20000]);
  });

  it.each([["headers", stalledHeaders], ["body", stalledBody]] as const)("arms the breaker after a %s timeout", async (_stage, transport) => {
    const { fetchStatsJson } = await import("./statsProxy");
    fetcher.mockImplementation(transport);
    for (let i = 0; i < 2; i++) {
      const pending = fetchStatsJson(url, { key });
      await flush(); expire(); expect(await pending).toBeNull();
    }
    expect(budgets()).toEqual([8000, 1500]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("counts malformed JSON as a failed body and allows a complete probe to recover", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    fetcher.mockResolvedValueOnce(new Response("{broken"))
      .mockResolvedValueOnce(Response.json({ recovered: true }))
      .mockResolvedValueOnce(Response.json(null));
    expect(await fetchStatsJson(url, { key })).toBeNull();
    expect(await fetchStatsJson(url, { key })).toEqual({ ok: true, status: 200, data: { recovered: true } });
    expect(await fetchStatsJson(url, { key })).toEqual({ ok: true, status: 200, data: null });
    expect(budgets()).toEqual([8000, 1500, 8000]);
  });

  it("does not clear the breaker at probe headers or extend it on a failed probe body", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    fetcher.mockRejectedValueOnce(new Error("network unavailable")).mockImplementation(stalledBody);
    expect(await fetchStatsJson(url, { key })).toBeNull();
    vi.setSystemTime(14 * 60 * 1000);
    const firstProbe = fetchStatsJson(url, { key }); await flush();
    const secondProbe = fetchStatsJson(url, { key }); await flush();
    expect(budgets()).toEqual([8000, 1500, 1500]);
    expire(1); expire(2);
    expect(await firstProbe).toBeNull(); expect(await secondProbe).toBeNull();
    vi.setSystemTime(15 * 60 * 1000 + 1);
    const retry = fetchStatsJson(url, { key }); await flush(); expire(); expect(await retry).toBeNull();
    expect(budgets()).toEqual([8000, 1500, 1500, 8000]);
  });

  it("clears only after a complete probe body, and a concurrent failed probe does not rearm it", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    let finish!: () => void;
    fetcher.mockRejectedValueOnce(new Error("network unavailable"))
      .mockImplementationOnce((_url, { signal }) => {
        const stream = streamingBody(signal); finish = stream.finish; return stream.response;
      }).mockImplementationOnce(stalledBody).mockResolvedValueOnce(Response.json({ recovered: true }));
    await fetchStatsJson(url, { key });
    const recovery = fetchStatsJson(url, { key }); await flush();
    const otherProbe = fetchStatsJson(url, { key }); await flush();
    expect(budgets()).toEqual([8000, 1500, 1500]);
    finish(); expect(await recovery).toEqual({ ok: true, status: 200, data: { rows: [1, 2, 3] } });
    expire(2); expect(await otherProbe).toBeNull();
    expect((await fetchStatsJson(url, { key }))?.ok).toBe(true);
    expect(budgets()).toEqual([8000, 1500, 1500, 8000]);
  });

  it.each([["headers", stalledHeaders], ["body", stalledBody]] as const)("does not arm the breaker for caller cancellation during %s", async (_stage, transport) => {
    const { fetchStatsJson } = await import("./statsProxy");
    const caller = new AbortController();
    fetcher.mockImplementationOnce(transport).mockResolvedValueOnce(Response.json({}));
    const pending = fetchStatsJson(url, { key, signal: caller.signal }); await flush();
    caller.abort(); expect(await pending).toBeNull();
    expect((await fetchStatsJson(url, { key }))?.ok).toBe(true);
    expect(budgets()).toEqual([8000, 8000]);
  });

  it("skips already cancelled requests without changing an existing breaker", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    fetcher.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({}));
    await fetchStatsJson(url, { key });
    const caller = new AbortController(); caller.abort();
    expect(await fetchStatsJson(url, { key, signal: caller.signal })).toBeNull();
    await fetchStatsJson(url, { key });
    expect(budgets()).toEqual([8000, 1500]); expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(["caller", "timeout"])("ignores a body that resolves after its %s signal, including breaker accounting", async reason => {
    const { fetchStatsJson } = await import("./statsProxy");
    let finish!: (value: unknown) => void;
    const caller = new AbortController();
    fetcher.mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) })
      .mockResolvedValueOnce(Response.json({}));
    const pending = fetchStatsJson(url, { key, signal: caller.signal }); await flush();
    if (reason === "caller") caller.abort(); else expire();
    finish({ tooLate: true }); expect(await pending).toBeNull();
    await fetchStatsJson(url, { key });
    expect(budgets()).toEqual([8000, reason === "caller" ? 8000 : 1500]);
  });

  it("does not clear an open breaker after cancellation of a non-cooperative probe body", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    const caller = new AbortController();
    let finish!: (value: unknown) => void;
    fetcher.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) })
      .mockResolvedValueOnce(Response.json({}));
    await fetchStatsJson(url, { key });
    const probe = fetchStatsJson(url, { key, signal: caller.signal }); await flush();
    caller.abort(); finish({}); expect(await probe).toBeNull();
    await fetchStatsJson(url, { key });
    expect(budgets()).toEqual([8000, 1500, 1500]);
  });

  it.each([403, 429, 500])("preserves HTTP %s without reading its body, including successful transport recovery", async status => {
    const { fetchStatsJson } = await import("./statsProxy");
    const response = new Response("not JSON", { status });
    const json = vi.spyOn(response, "json");
    fetcher.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response).mockResolvedValueOnce(Response.json({}));
    await fetchStatsJson(url, { key });
    expect(await fetchStatsJson(url, { key })).toEqual({ ok: false, status });
    expect(json).not.toHaveBeenCalled(); expect(response.bodyUsed).toBe(false);
    await fetchStatsJson(url, { key });
    expect(budgets()).toEqual([8000, 1500, 8000]);
  });

  it("returns a non-OK status immediately even if its body never completes", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("upstream error")); },
    }), { status: 503 });
    fetcher.mockResolvedValue(response);
    expect(await fetchStatsJson(url, { key })).toEqual({ ok: false, status: 503 });
    expect(response.bodyUsed).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not extend the original expiry when a short probe returns malformed JSON", async () => {
    const { fetchStatsJson } = await import("./statsProxy");
    fetcher.mockImplementation(() => new Response("{bad JSON"));
    expect(await fetchStatsJson(url, { key })).toBeNull();
    vi.setSystemTime(14 * 60 * 1000);
    expect(await fetchStatsJson(url, { key })).toBeNull();
    vi.setSystemTime(15 * 60 * 1000 + 1);
    expect(await fetchStatsJson(url, { key })).toBeNull();
    expect(budgets()).toEqual([8000, 1500, 8000]);
  });

  it("shares per-key state with raw callers without consuming arbitrary responses", async () => {
    const { fetchStats, fetchStatsJson } = await import("./statsProxy");
    const response = new Response("plain text");
    fetcher.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(response);
    await fetchStats(url, { key });
    await fetchStatsJson(url, { key: "other" });
    await fetchStatsJson(url, { key });
    expect(await fetchStats(url, { key })).toBe(response);
    expect(response.bodyUsed).toBe(false);
    expect(budgets()).toEqual([8000, 8000, 1500, 8000]);
  });
});
