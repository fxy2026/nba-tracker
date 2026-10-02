import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const payload = { leagueSchedule: { seasonYear: "2026-27", gameDates: [
  { gameDate: "10/21/2026 00:00:00", games: [] },
] } };
const good = () => Response.json(payload);

function stalled(signal: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("raw schedule's end-to-end download deadline", () => {
  it("aborts stalled response headers once at eight seconds, without retrying", async () => {
    let signal!: AbortSignal;
    const fetch = vi.fn((_: string, init: RequestInit) => stalled(signal = init.signal!));
    vi.stubGlobal("fetch", fetch);
    const { getRawScheduleDates } = await import("./api");
    const result = getRawScheduleDates();
    const rejected = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(7999); expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await rejected;
    expect(signal.aborted).toBe(true); expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the same deadline active while reading a stalled response body", async () => {
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_: string, init: RequestInit) => {
      signal = init.signal!;
      const body = new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode('{"leagueSchedule":'));
        signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
      } });
      return Promise.resolve(new Response(body));
    }));
    const { getRawScheduleDates } = await import("./api");
    const result = getRawScheduleDates();
    const rejected = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(8000); await rejected;
    expect(signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("clears its deadline after successful body parsing", async () => {
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_: string, init: RequestInit) => { signal = init.signal!; return Promise.resolve(good()); }));
    const { getRawScheduleDates } = await import("./api");
    expect((await getRawScheduleDates()).seasonYear).toBe("2026");
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(9000); expect(signal.aborted).toBe(false);
  });
  it("retries a transient 503 within the same budget and releases its body", async () => {
    const first = new Response("busy", { status: 503 });
    const cancel = vi.spyOn(first.body!, "cancel");
    const fetch = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(good());
    vi.stubGlobal("fetch", fetch);
    const { getRawScheduleDates } = await import("./api");
    const result = getRawScheduleDates();
    await vi.advanceTimersByTimeAsync(200); await result;
    expect(fetch).toHaveBeenCalledTimes(2); expect(cancel).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].signal).toBe(fetch.mock.calls[1][1].signal);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([403, 429])("does not retry HTTP %i and cleans up", async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response("denied", { status }));
    vi.stubGlobal("fetch", fetch);
    const { getRawScheduleDates } = await import("./api");
    await expect(getRawScheduleDates()).rejects.toThrow(`HTTP ${status}`);
    expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("does not retry an upstream abort error", async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    vi.stubGlobal("fetch", fetch);
    const { getRawScheduleDates } = await import("./api");
    await expect(getRawScheduleDates()).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels retry backoff when the overall deadline expires", async () => {
    const fetch = vi.fn(() => new Promise<Response>((resolve) => {
      setTimeout(() => resolve(new Response("busy", { status: 503 })), 7900);
    }));
    vi.stubGlobal("fetch", fetch);
    const { getRawScheduleDates } = await import("./api");
    const result = getRawScheduleDates();
    const rejected = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(8000); await rejected;
    expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("clears deadline on invalid JSON without retrying the body", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not JSON")); vi.stubGlobal("fetch", fetch);
    const { getRawScheduleDates } = await import("./api");
    await expect(getRawScheduleDates()).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves baked archive fallback when a cold schedule request times out", async () => {
    vi.stubGlobal("fetch", vi.fn((_: string, init: RequestInit) => stalled(init.signal!)));
    const { getCachedScheduleFeed } = await import("./api");
    const result = getCachedScheduleFeed();
    await vi.advanceTimersByTimeAsync(8000);
    const feed = await result;
    expect(feed.dates.length).toBeGreaterThan(200); expect(feed.seasonYear).toBe("2025");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps warm stale data when background refresh times out", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(good()).mockImplementation((_: string, init: RequestInit) => stalled(init.signal!));
    vi.stubGlobal("fetch", fetch);
    const { getCachedScheduleFeed } = await import("./api");
    const before = await getCachedScheduleFeed();
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000);
    expect(await getCachedScheduleFeed()).toEqual(before);
    await vi.advanceTimersByTimeAsync(8000);
    // The timed-out attempt never replaces the warm cache with the archive.
    expect(await getCachedScheduleFeed()).toEqual(before);
    // A new background attempt may start because the retained cache is stale.
    await vi.advanceTimersByTimeAsync(8000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
