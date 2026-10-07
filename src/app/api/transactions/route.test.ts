import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const request = (limit?: string) => new NextRequest(`https://example.test/api/transactions${limit === undefined ? "" : `?limit=${encodeURIComponent(limit)}`}`);
const responseCacheControl = "no-store";
const unavailable = async (response: Response, status: number) => {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ transactions: [] });
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

it("aborts stalled response headers at five seconds and clears the timer", async () => {
  let signal!: AbortSignal;
  const fetch = vi.fn((_: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    signal = init.signal!;
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  const pending = GET(request());
  await vi.advanceTimersByTimeAsync(4999); expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await unavailable(await pending, 500);
  expect(signal.aborted).toBe(true); expect(fetch).toHaveBeenCalledOnce();
});

it("keeps the deadline active through a stalled JSON response body", async () => {
  let signal!: AbortSignal;
  vi.stubGlobal("fetch", vi.fn((_: string, init: RequestInit) => {
    signal = init.signal!;
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"transactions":'));
      signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
    } });
    return Promise.resolve(new Response(body));
  }));
  const pending = GET(request());
  await vi.advanceTimersByTimeAsync(4999); expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await unavailable(await pending, 500);
  expect(signal.aborted).toBe(true);
});

it("does not publish a late body as cacheable success after the deadline", async () => {
  let finish!: (payload: unknown) => void;
  const body = new Promise<unknown>(resolve => { finish = resolve; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => body }));
  const pending = GET(request());
  await vi.advanceTimersByTimeAsync(5000);
  finish({ transactions: [] });
  await unavailable(await pending, 500);
});

it.each([403, 429, 503])("returns uncached 502 for upstream HTTP %i and releases its body", async status => {
  const response = new Response("upstream unavailable", { status });
  const cancel = vi.spyOn(response.body!, "cancel");
  let signal!: AbortSignal;
  const fetch = vi.fn((_: string, init: RequestInit) => { signal = init.signal!; return Promise.resolve(response); });
  vi.stubGlobal("fetch", fetch);
  await unavailable(await GET(request()), 502);
  expect(cancel).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(6000); expect(signal.aborted).toBe(false);
});

it("clears the deadline after a rejected fetch", async () => {
  let signal!: AbortSignal;
  vi.stubGlobal("fetch", vi.fn((_: string, init: RequestInit) => { signal = init.signal!; return Promise.reject(new Error("Offline")); }));
  await unavailable(await GET(request()), 500);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(6000); expect(signal.aborted).toBe(false);
});

it("returns an uncached error and clears the deadline on invalid JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
  await unavailable(await GET(request()), 500);
});

it.each([null, [], {}, { transactions: null }, { transactions: {} }, { items: "unavailable" }])("does not cache a malformed envelope as an empty feed: %j", async data => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
  await unavailable(await GET(request()), 502);
});

it.each(["transactions", "items"])("preserves a successful empty %s array and its cache policy", async key => {
  let signal!: AbortSignal;
  vi.stubGlobal("fetch", vi.fn((_: string, init: RequestInit) => { signal = init.signal!; return Promise.resolve(Response.json({ [key]: [] })); }));
  const response = await GET(request());
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ transactions: [] });
  expect(response.headers.get("Cache-Control")).toBe(responseCacheControl); expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(6000); expect(signal.aborted).toBe(false);
});

it("preserves normalized transaction fields, player parsing and fallback defaults", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ transactions: [
    { date: "2026-10-05T18:00:00Z", team: { displayName: "Los Angeles Lakers", abbreviation: "LAL", logos: [{ href: "https://example.test/lal.png" }] }, athletes: [{ displayName: "Test Player" }], description: "Signed G Test Player.", type: { text: "Signing" } },
    { description: "Waived F Other Player." },
  ] }));
  vi.stubGlobal("fetch", fetch);
  const response = await GET(request("23"));
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe(responseCacheControl);
  expect(await response.json()).toEqual({ transactions: [
    { date: "2026-10-05T18:00:00Z", team: "Los Angeles Lakers", teamAbbr: "LAL", player: "Test Player", type: "Signing", description: "Signed G Test Player.", players: ["Test Player"], kind: "signed", teamLogo: "https://example.test/lal.png" },
    { date: "", team: "Unknown", teamAbbr: "", player: "", type: "Transaction", description: "Waived F Other Player.", players: ["Other Player"], kind: "waived", teamLogo: "" },
  ] });
  expect(fetch).toHaveBeenCalledWith(
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=23",
    expect.objectContaining({ next: { revalidate: 1800 }, signal: expect.any(AbortSignal) }),
  );
});

it.each([
  [undefined, 150], ["", 150], ["invalid", 150], ["0", 150], ["-5", 150], ["Infinity", 150],
  ["1", 1], ["0.5", 1], ["23.9", 23], ["500", 500], ["999999", 500],
] as const)("bounds requested limit %s to %i", async (limit, expected) => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ transactions: [] }));
  vi.stubGlobal("fetch", fetch);
  expect((await GET(request(limit))).status).toBe(200);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=${expected}`);
});
