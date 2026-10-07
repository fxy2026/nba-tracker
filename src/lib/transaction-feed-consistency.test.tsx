import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OffseasonHero from "@/components/OffseasonHero";
import { GET } from "@/app/api/transactions/route";

vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));

const upstream = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions";
const move = (description: string, day: number, abbreviation = "OKC") => ({
  date: `2026-10-0${day}T18:00:00Z`,
  description,
  team: { displayName: "Fixture team", abbreviation },
});
// Synthetic snapshots deliberately differ by request URL. This reproduces the
// split-feed mechanism without claiming which production cache was stale.
const shortSnapshot = [move("Waived G Latest Guard.", 6)];
const fullSnapshot = Array.from({ length: 6 }, (_, i) => move(`Signed F Fixture Player ${i}.`, 5, i ? "BOS" : "OKC"));
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  fetchMock.mockReset();
  fetchMock.mockImplementation(url => {
    if (String(url).includes("/news?")) return Promise.resolve(Response.json({ articles: [] }));
    const transactions = String(url) === `${upstream}?limit=20` ? shortSnapshot : fullSnapshot;
    return Promise.resolve(Response.json({ transactions }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(["", "?limit=150"])("keeps home moves in the default timeline for %s despite independently populated upstream keys", async query => {
  const hero = renderToStaticMarkup(await OffseasonHero());
  const response = await GET(new NextRequest(`https://example.test/api/transactions${query}`));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.transactions).toHaveLength(6);
  for (const row of body.transactions.slice(0, 5)) expect(hero).toContain(row.description);
  expect(hero).not.toContain(fullSnapshot[5].description);
  expect(hero).not.toContain(shortSnapshot[0].description);
  expect(body.transactions.map((row: { teamAbbr: string }) => row.teamAbbr)).toContain("OKC");
});

it("uses the same persistent upstream cache key while keeping news separate", async () => {
  await OffseasonHero();
  await GET(new NextRequest("https://example.test/api/transactions?limit=150"));
  const transactionCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith(upstream));
  expect(transactionCalls).toHaveLength(2);
  const cacheKeys = transactionCalls.map(([url, init]) => {
    const options = { ...init };
    // Next's persistent fetch key excludes each caller's deadline signal.
    delete options.signal;
    return { url, ...options };
  });
  expect(cacheKeys[0]).toEqual(cacheKeys[1]);
  expect(cacheKeys[0]).toMatchObject({ url: `${upstream}?limit=150`, next: { revalidate: 1800 } });
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/news?"))).toHaveLength(1);
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/news?limit=10"))).toBe(true);
});

it("does not layer a second timeline response cache over the shared upstream snapshot", async () => {
  const response = await GET(new NextRequest("https://example.test/api/transactions?limit=150"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 1800 } });
});

it("lets the timeline see a shared upstream refresh even when its earlier response was recent", async () => {
  let sharedSnapshot = fullSnapshot;
  fetchMock.mockImplementation(url => Promise.resolve(Response.json(
    String(url).includes("/news?") ? { articles: [] } : { transactions: sharedSnapshot },
  )));
  // Model only the response Cache-Control contract, independently of the
  // upstream data cache. A request near the upstream expiry must not restart
  // another 30-minute freshness window for the same old data.
  let cachedResponse: { response: Response; expires: number } | undefined;
  const readTimeline = async () => {
    if (cachedResponse && cachedResponse.expires > Date.now()) return cachedResponse.response.clone();
    const response = await GET(new NextRequest("https://example.test/api/transactions?limit=150"));
    const maxAge = /\bs-maxage=(\d+)/.exec(response.headers.get("Cache-Control") ?? "");
    if (maxAge) cachedResponse = { response: response.clone(), expires: Date.now() + Number(maxAge[1]) * 1000 };
    return response;
  };
  vi.setSystemTime(new Date("2026-10-07T12:29:50Z"));
  expect((await (await readTimeline()).json()).transactions[0].description).toBe(fullSnapshot[0].description);
  vi.setSystemTime(new Date("2026-10-07T12:30:10Z"));
  sharedSnapshot = shortSnapshot;
  const hero = renderToStaticMarkup(await OffseasonHero());
  const timeline = await (await readTimeline()).json();
  expect(hero).toContain(shortSnapshot[0].description);
  expect(timeline.transactions[0].description).toBe(shortSnapshot[0].description);
});
