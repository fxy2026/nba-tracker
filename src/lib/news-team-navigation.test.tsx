import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { TEAM_META } from "./teams";
import NewsFeed, { type NewsArticle } from "@/app/news/NewsFeed";
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
import NewsPage from "@/app/news/page";

function findFeed(node: ReactNode): { articles: NewsArticle[]; fetchedAt: number } | null {
  if (Array.isArray(node)) return node.map(findFeed).find(Boolean) ?? null;
  if (!isValidElement<{ children?: ReactNode; articles: NewsArticle[]; fetchedAt: number }>(node)) return null;
  return node.type === NewsFeed ? node.props : findFeed(node.props.children);
}
async function project(descriptions: string[]) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ articles: [{
    id: 1, headline: "Team news", categories: descriptions.map(description => ({ type: "team", description })),
  }] }) });
  vi.stubGlobal("fetch", fetchMock);
  const feed = findFeed(await NewsPage());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("news?limit=50"), expect.objectContaining({ next: { revalidate: 600 } }));
  expect(feed).not.toBeNull();
  return feed!;
}
afterEach(() => vi.unstubAllGlobals());

it.each(Object.values(TEAM_META))("projects canonical $tricode category without substring collision", async team => {
  const feed = await project([`${team.city} ${team.name}`]);
  expect(feed.articles[0].teams.map(t => t.tricode)).toEqual([team.tricode]);
});
it.each(["Charlotte Hornets", "hornets", "  cHaRlOtTe\t HORNETS  "])("Hornets category %s never routes to Brooklyn", async name => {
  const feed = await project([name]);
  const html = renderToStaticMarkup(createElement(NewsFeed, feed));
  expect(html).toContain('href="/team/CHA"');
  expect(html).not.toContain('href="/team/BKN"');
  expect(feed.articles[0].teams[0].label).toBe(name);
});
it.each(["Los Angeles", "Unknown Netsville", "Hornets Nets", "Lakers Clippers", "", "Springfield Isotopes"])("omits unknown or ambiguous category %s", async name => {
  expect((await project([name])).articles[0].teams).toEqual([]);
});
it("deduplicates same team while retaining distinct correct links and labels", async () => {
  const feed = await project(["Charlotte Hornets", "Hornets", "Brooklyn Nets", "Portland  Trail\tBlazers"]);
  expect(feed.articles[0].teams.map(t => t.tricode)).toEqual(["CHA", "BKN", "POR"]);
  const html = renderToStaticMarkup(createElement(NewsFeed, feed));
  expect(html).toMatch(/<a(?=[^>]*href="\/team\/CHA")(?=[^>]*title="Charlotte Hornets")[^>]*>/);
  expect(html).toMatch(/<a(?=[^>]*href="\/team\/BKN")(?=[^>]*title="Brooklyn Nets")[^>]*>/);
  expect(html.match(/href="\/team\/CHA"/g)).toHaveLength(1);
  expect(html).toContain('>CHA</button>');
  expect(html).toContain('>BKN</button>');
});
