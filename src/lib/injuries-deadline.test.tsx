import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/injuries/route";
import InjuriesPage from "@/app/injuries/page";

const locale = vi.hoisted(() => ({ value: "en" as "en" | "zh" }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => locale.value }));

type Consumer = "route" | "page";
type Result = Response | ReactElement;
const consumers: Consumer[] = ["route", "page"];
const fetchMock = vi.fn<typeof fetch>();
const cacheControl = "public, s-maxage=1800, stale-while-revalidate=3600";
const feed = { injuries: [
  { id: "2", displayName: "Boston Celtics", injuries: [
    { id: "1", status: "Out", athlete: { displayName: "Home Player", position: { abbreviation: "C" } }, shortComment: "A reported injury" },
  ] },
  { id: "13", displayName: "Los Angeles Lakers", injuries: [
    { status: "Questionable", athlete: { displayName: "Away Player" } },
  ] },
] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function run(consumer: Consumer): Promise<Result> {
  return consumer === "route" ? GET() : InjuriesPage({ searchParams: Promise.resolve({}) });
}

async function expectUnavailable(consumer: Consumer, result: Result, status = 500) {
  if (consumer === "route") {
    const response = result as Response;
    expect(response.status).toBe(status);
    expect(response.ok).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: [] });
  } else {
    const html = renderToStaticMarkup(result as ReactElement);
    // Preserve the page's best-effort fallback and useful navigation.
    expect(html).toContain("No injury data available at this time.");
    expect(html).toContain('href="/news"');
    expect(html).toContain('href="/favorites"');
    expect(html).not.toContain("Home Player");
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  locale.value = "en";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  expect(vi.getTimerCount()).toBe(0);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(consumers)("injuries %s deadline", consumer => {
  it.each([
    ["headers", true], ["headers", false], ["body", true], ["body", false],
  ] as const)("bounds stalled %s at five seconds (respects abort: %s) and discards late data", async (stage, respectsAbort) => {
    const headers = deferred<Response>();
    const body = deferred<unknown>();
    const json = vi.fn(() => body.promise);
    const cancel = vi.fn(async () => {});
    const response = { ok: true, json, body: { cancel } } as unknown as Response;
    let signal!: AbortSignal;
    fetchMock.mockImplementation((_url, init) => {
      signal = init!.signal!;
      signal.addEventListener("abort", () => {
        if (respectsAbort) (stage === "headers" ? headers : body).reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
      return headers.promise;
    });
    let settled = false;
    const pending = run(consumer).then(result => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(1000);
    if (stage === "body") {
      headers.resolve(response);
      await vi.advanceTimersByTimeAsync(0);
      expect(json).toHaveBeenCalledOnce();
    }
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBe(false);
    expect(signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await expectUnavailable(consumer, await pending);
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    const readPayload = vi.fn(() => feed.injuries);
    const lateBody = Object.defineProperty({}, "injuries", { get: readPayload });
    headers.resolve(response);
    body.resolve(lateBody);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(readPayload).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledTimes(stage === "body" ? 1 : 0);
    expect(cancel).toHaveBeenCalledTimes(stage === "headers" && !respectsAbort ? 1 : 0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(["headers", "body"] as const)("handles a late %s rejection after returning the fallback", async stage => {
    const headers = deferred<Response>();
    const body = deferred<unknown>();
    fetchMock.mockReturnValue(stage === "headers" ? headers.promise : Promise.resolve({ ok: true, json: () => body.promise } as Response));
    const pending = run(consumer);
    await vi.advanceTimersByTimeAsync(5000);
    await expectUnavailable(consumer, await pending);
    (stage === "headers" ? headers : body).reject(new Error("Late transport failure"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(["network", "HTTP", "JSON", "shape"] as const)("cleans timers immediately after %s failure", async failure => {
    const cancel = vi.fn(async () => { throw new Error("Cancel failed"); });
    const json = vi.fn(async () => {
      if (failure === "JSON") throw new SyntaxError("Invalid JSON");
      return { injuries: {} };
    });
    fetchMock.mockImplementation(async () => {
      if (failure === "network") throw new TypeError("Network failed");
      return { ok: failure !== "HTTP", json, body: { cancel } } as unknown as Response;
    });
    await expectUnavailable(consumer, await run(consumer), failure === "HTTP" || failure === "shape" ? 502 : 500);
    expect(cancel).toHaveBeenCalledTimes(failure === "HTTP" ? 1 : 0);
    expect(json).toHaveBeenCalledTimes(failure === "JSON" || failure === "shape" ? 1 : 0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
  });

  it("preserves valid injuries arriving just before the deadline and the original fetch settings", async () => {
    const body = deferred<unknown>();
    fetchMock.mockResolvedValue({ ok: true, json: () => body.promise } as Response);
    const pending = run(consumer);
    await vi.advanceTimersByTimeAsync(4999);
    expect(vi.getTimerCount()).toBe(1);
    body.resolve(feed);
    const result = await pending;
    if (consumer === "route") {
      const response = result as Response;
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      expect(await response.json()).toEqual({ data: feed.injuries });
    } else {
      const html = renderToStaticMarkup(result as ReactElement);
      for (const text of ["Boston Celtics", "Los Angeles Lakers", "Home Player", "Away Player", "A reported injury", "Questionable"]) expect(html).toContain(text);
      expect(html).not.toContain("No injury data available at this time.");
    }
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, next: { revalidate: 1800 }, signal: expect.any(AbortSignal) },
    );
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
  });

  it("preserves a genuine empty feed as a successful result", async () => {
    fetchMock.mockResolvedValue(Response.json({ injuries: [] }));
    const result = await run(consumer);
    if (consumer === "route") {
      const response = result as Response;
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      expect(await response.json()).toEqual({ data: [] });
    } else {
      expect(renderToStaticMarkup(result as ReactElement)).toContain("No injury data available at this time.");
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});

it.each([null, {}, { injuries: null }, { injuries: [null] }, { injuries: [{ displayName: "Boston Celtics", injuries: [null] }] }])(
  "does not cache malformed injury data as an empty success: %j", async payload => {
    fetchMock.mockResolvedValue(Response.json(payload));
    await expectUnavailable("route", await GET(), 502);
  },
);

it("preserves the injury page's team filter", async () => {
  fetchMock.mockResolvedValue(Response.json(feed));
  const html = renderToStaticMarkup(await InjuriesPage({ searchParams: Promise.resolve({ team: "bOsToN" }) }));
  expect(html).toContain("Home Player");
  expect(html).not.toContain("Away Player");
  expect(html).toContain('href="/injuries?team=boston%20celtics"');
});

it("preserves the Chinese unavailable page after a network failure", async () => {
  locale.value = "zh";
  fetchMock.mockRejectedValue(new TypeError("Network failed"));
  const html = renderToStaticMarkup(await InjuriesPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("目前没有伤病数据。");
  expect(html).toContain('href="/news"');
});
