import React from "react";
import { PassThrough } from "node:stream";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OffseasonHero from "@/components/OffseasonHero";
import HomePage from "@/app/page";
import { NEXT_SEASON_START_ESTIMATE, PLAYOFFS_END } from "./constants";

vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("@/lib/api", () => ({ formatDate: () => "2026-10-06" }));
vi.mock("@/components/HomeGames", () => ({
  default: ({ afterGames }: { afterGames: React.ReactNode }) => <section>Selected games visible{afterGames}</section>,
  HomeGamesLoading: () => null,
}));
vi.mock("@/components/HomePlayerSearch", () => ({ default: () => <p>Player search visible</p> }));
vi.mock("@/components/BestOfNightCard", () => ({ default: () => <p>Best of night visible</p> }));
vi.mock("@/components/DailyIconicPick", () => ({ default: () => null }));

type Endpoint = "transactions" | "news";
const endpoints: Endpoint[] = ["transactions", "news"];
const bodies = {
  transactions: { transactions: [{ date: "2026-10-05", description: "A confirmed player move", team: { abbreviation: "BOS" } }] },
  news: { articles: [{ headline: "A confirmed league headline", links: { web: { href: "https://example.test/news" } }, published: "2026-10-05" }] },
};
const content = { transactions: "A confirmed player move", news: "A confirmed league headline" };
const unavailable = { transactions: "No transactions available", news: "No headlines available" };
const fetchMock = vi.fn<typeof fetch>();
const endpointFor = (url: Parameters<typeof fetch>[0]): Endpoint => String(url).includes("/transactions?") ? "transactions" : "news";
const response = (endpoint: Endpoint) => Response.json(bodies[endpoint]);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function expectStaticContent(html: string) {
  expect(html).toContain("2025-26");
  expect(html).toContain("Champions");
  expect(html).toContain("Est. tip-off");
  expect(html).toContain('href="/season/2025-26"');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(endpoints)("offseason %s request deadline", stalledEndpoint => {
  it.each(["headers", "body"] as const)("bounds stalled %s at five seconds and ignores late completion", async stage => {
    const headers = deferred<Response>();
    const body = deferred<unknown>();
    const lateJson = vi.fn(() => body.promise);
    const cancel = vi.fn(async () => {});
    const lateResponse = { ok: true, json: lateJson, body: { cancel } } as unknown as Response;
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((url, init) => {
      const endpoint = endpointFor(url);
      if (endpoint !== stalledEndpoint) return Promise.resolve(response(endpoint));
      signal = init?.signal;
      // Deliberately ignore abort: the deadline must also settle this transport.
      return stage === "headers" ? headers.promise : Promise.resolve(lateResponse);
    });
    let settled = false;
    const pending = OffseasonHero().then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2); // Both requests start in parallel.
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const hero = await pending;
    const html = renderToStaticMarkup(hero);
    expectStaticContent(html);
    expect(html).toContain(unavailable[stalledEndpoint]);
    expect(html).toContain(content[stalledEndpoint === "news" ? "transactions" : "news"]);
    expect(html).not.toContain(content[stalledEndpoint]);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    const readPayload = vi.fn(() => stalledEndpoint === "news" ? bodies.news.articles : bodies.transactions.transactions);
    const lateBody = Object.defineProperty({}, stalledEndpoint === "news" ? "articles" : "transactions", { get: readPayload });
    headers.resolve(lateResponse);
    body.resolve(lateBody);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(renderToStaticMarkup(hero)).toBe(html);
    expect(readPayload).not.toHaveBeenCalled();
    expect(lateJson).toHaveBeenCalledTimes(stage === "body" ? 1 : 0);
    expect(cancel).toHaveBeenCalledTimes(stage === "headers" ? 1 : 0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["http", "network", "json", "shape"] as const)("retains the other section and cleans timers after %s failure", async failure => {
    const cancel = vi.fn(async () => { throw new Error("cancel failed"); });
    const json = vi.fn(async () => { throw new SyntaxError("bad JSON"); });
    fetchMock.mockImplementation((url) => {
      const endpoint = endpointFor(url);
      if (endpoint !== stalledEndpoint) return Promise.resolve(response(endpoint));
      if (failure === "network") return Promise.reject(new TypeError("network failed"));
      if (failure === "shape") return Promise.resolve(Response.json({ articles: {}, transactions: {} }));
      return Promise.resolve({ ok: failure !== "http", json, body: { cancel } } as unknown as Response);
    });
    const html = renderToStaticMarkup(await OffseasonHero());
    expectStaticContent(html);
    expect(html).toContain(unavailable[stalledEndpoint]);
    expect(html).toContain(content[stalledEndpoint === "news" ? "transactions" : "news"]);
    expect(cancel).toHaveBeenCalledTimes(failure === "http" ? 1 : 0);
    expect(json).toHaveBeenCalledTimes(failure === "json" ? 1 : 0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    for (const [, init] of fetchMock.mock.calls) expect(init?.signal?.aborted).toBe(false);
  });
});

it("keeps both successful sections, shared transaction request, and no leftover deadlines", async () => {
  fetchMock.mockImplementation(url => Promise.resolve(response(endpointFor(url))));
  const html = renderToStaticMarkup(await OffseasonHero());
  expectStaticContent(html);
  for (const text of Object.values(content)) expect(html).toContain(text);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=150",
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=10",
  ]);
  for (const [, init] of fetchMock.mock.calls) expect(init).toMatchObject({
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    next: { revalidate: 1800 },
  });
  expect(vi.getTimerCount()).toBe(0);
});

it.each([PLAYOFFS_END, NEXT_SEASON_START_ESTIMATE, "2026-12-01T12:00:00Z"])("starts no requests outside offseason at %s", async date => {
  vi.setSystemTime(new Date(date));
  await expect(OffseasonHero()).resolves.toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("streams the homepage shell before both optional bodies reach their deadline", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) } as unknown as Response);
  const page = await HomePage({ searchParams: Promise.resolve({}) });
  const output = new PassThrough();
  const shell = deferred<void>();
  let html = "";
  let ended = false;
  const errors: unknown[] = [];
  output.on("data", chunk => { html += chunk.toString(); });
  const done = new Promise<void>((resolve, reject) => {
    output.on("end", () => { ended = true; resolve(); });
    output.on("error", reject);
  });
  const stream = renderToPipeableStream(page, {
    onShellReady() { stream.pipe(output); shell.resolve(); },
    onError(error) { errors.push(error); },
  });
  try {
    await shell.promise;
    expect(html).toContain("Selected games visible");
    expect(html).toContain("Player search visible");
    expect(html).toContain("Best of night visible");
    expect(html).not.toContain("Champions");
    expect(ended).toBe(false);
    await vi.advanceTimersByTimeAsync(4999);
    expect(ended).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expectStaticContent(html);
    for (const text of Object.values(unavailable)) expect(html).toContain(text);
    expect(errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) expect(init?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    stream.abort();
    output.destroy();
  }
});
