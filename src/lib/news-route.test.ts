import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/news/route";

const fetchMock = vi.fn<typeof fetch>();
const cacheControl = "public, s-maxage=600, stale-while-revalidate=1200";
const request = (search = "") => new NextRequest(`http://local.test/api/news${search}`);
const article = (headline: string, description = "") => ({ headline, description });

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function expectUnavailable(result: Response) {
  expect(result.status).toBe(503);
  expect(result.ok).toBe(false);
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(await result.json()).toEqual({ data: [] });
  expect(fetchMock).toHaveBeenCalledTimes(1);
}

describe("news route failure contract", () => {
  it.each([429, 500, 503])("reports upstream HTTP %s as an uncacheable failure", async status => {
    fetchMock.mockResolvedValue(Response.json({ articles: [] }, { status }));
    await expectUnavailable(await GET(request()));
  });

  it("reports a rejected network request as an uncacheable failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Mock network failure"));
    await expectUnavailable(await GET(request()));
  });

  it("keeps the five-second abort deadline and does not retry automatically", async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    let settled = false;
    const pending = GET(request()).then(result => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expectUnavailable(await pending);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports invalid upstream JSON as an uncacheable failure", async () => {
    fetchMock.mockResolvedValue(new Response("not JSON"));
    await expectUnavailable(await GET(request()));
  });

  it.each([
    ["missing articles", {}],
    ["non-array articles", { articles: {} }],
    ["null articles", { articles: null }],
    ["null payload", null],
  ])("reports %s as an uncacheable failure", async (_label, body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expectUnavailable(await GET(request("?q=Celtics")));
  });
});

describe("news route successful response compatibility", () => {
  it.each([
    ["genuine empty feed", "", []],
    ["valid query with no matches", "?q=Lakers", [article("Celtics win")]],
  ])("keeps %s successful and cacheable", async (_label, search, articles) => {
    fetchMock.mockResolvedValue(Response.json({ articles }));
    const result = await GET(request(search));
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.headers.get("Cache-Control")).toBe(cacheControl);
    expect(await result.json()).toEqual({ data: [] });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves mapped item fields and category filtering", async () => {
    const published = "2026-10-04T12:00:00Z";
    fetchMock.mockResolvedValue(Response.json({ articles: [{
      headline: "Celtics win", description: "Game recap", published,
      links: { web: { href: "https://example.test/recap" } },
      images: [{ url: "https://example.test/recap.jpg" }],
      categories: [
        { type: "team", description: "Boston Celtics", teamId: 2, abbreviation: "BOS" },
        { type: "athlete", description: "Player" },
        { type: "topic", description: "NBA" },
        { type: "league", description: "Filtered out" },
      ],
    }, {}] }));
    const result = await GET(request());
    expect(result.headers.get("Cache-Control")).toBe(cacheControl);
    expect(await result.json()).toEqual({ data: [{
      headline: "Celtics win", description: "Game recap", link: "https://example.test/recap",
      published: new Date(published).toLocaleDateString("zh-CN", { month: "short", day: "numeric", year: "numeric" }),
      image: "https://example.test/recap.jpg",
      categories: [
        { type: "team", label: "Boston Celtics", teamId: 2, abbr: "BOS" },
        { type: "athlete", label: "Player" },
        { type: "topic", label: "NBA" },
      ],
    }, { headline: "", description: "", link: "", published: "", image: "", categories: [] }] });
  });

  it("preserves trimmed case-insensitive OR word matching and the five-item query cap", async () => {
    const matches = [article("JAMES scores"), article("NBA recap", "LeBron leads the win"),
      ...Array.from({ length: 6 }, (_, i) => article(`James report ${i}`))];
    fetchMock.mockResolvedValue(Response.json({ articles: [article("LA recap"), article("Unrelated"), ...matches] }));
    const result = await GET(request("?q=%20lEbRoN%20jAmEs%20LA%20&limit=50"));
    const body = await result.json();
    expect(body.data.map((item: { headline: string }) => item.headline)).toEqual(matches.slice(0, 5).map(item => item.headline));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe(cacheControl);
  });

  it.each([["", 30], ["?limit=0", 30], ["?limit=-1", 30], ["?limit=nope", 30],
    ["?limit=Infinity", 30], ["?limit=2.9", 2], ["?limit=100", 50], ["?q=%20%20&limit=7", 7]])(
    "preserves limit normalization and upstream fetch options for %s", async (search, limit) => {
      fetchMock.mockResolvedValue(Response.json({ articles: Array.from({ length: 60 }, (_, i) => article(`Report ${i}`)) }));
      const result = await GET(request(search));
      expect((await result.json()).data).toHaveLength(limit);
      expect(result.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=${limit}`,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, next: { revalidate: 600 }, signal: expect.any(AbortSignal) },
      );
    },
  );
});
