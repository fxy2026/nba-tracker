import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

const { locale } = vi.hoisted(() => ({ locale: vi.fn() }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
// Keep the actual server page tree and links; isolate its unrelated interactive
// input so these fixtures do not mount effects, request data, or need a browser.
vi.mock("@/components/SearchInput", () => ({ default: ({ initialQuery }: { initialQuery: string }) => createElement("input", { "data-search-query": initialQuery, readOnly: true, value: initialQuery }) }));
import SearchPage from "@/app/search/page";

beforeEach(() => {
  locale.mockResolvedValue("en");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Search discovery must not introduce data requests"); }));
});
afterEach(() => { vi.unstubAllGlobals(); });

it.each(["en", "zh"] as const)("position chips use existing exact directory filters in %s", async language => {
  locale.mockResolvedValue(language);
  const html = renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({}) }));
  const t = getTranslations(language);
  for (const [position, label] of [["G", t.searchPage.guard], ["F", t.searchPage.forward], ["C", t.searchPage.center]]) {
    expect(html).toContain(`href="/by-position?pos=${position}"`);
    expect(html).toContain(`>${label}</a>`);
  }
  for (const broken of ["Guard", "Forward", "Center"]) expect(html).not.toContain(`/search?q=${broken}`);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["en", "zh"] as const)("popular-player discovery preserves all eight destinations without stale team labels in %s", async language => {
  locale.mockResolvedValue(language);
  const html = renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({}) }));
  for (const [id, name] of [[2544, "LeBron James"], [201142, "Kevin Durant"], [201939, "Stephen Curry"], [203507, "Giannis Antetokounmpo"], [203954, "Joel Embiid"], [1629029, "Luka Doncic"], [1628983, "Shai Gilgeous-Alexander"], [203999, "Nikola Jokic"]]) {
    expect(html).toContain(`href="/player/${id}"`); expect(html).toContain(name);
  }
  expect(html).not.toContain(">PHX<"); expect(html).not.toContain(">DAL<");
  expect(html).not.toContain(">HOU<"); expect(html).not.toContain(">LAL<");
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps team-name quick searches and existing query input behavior", async () => {
  const html = renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({ q: "Kyrie Irving" }) }));
  for (const name of ["Lakers", "Celtics", "Warriors", "Nuggets"]) expect(html).toContain(`href="/search?q=${name}"`);
  expect(html).toContain('data-search-query="Kyrie Irving"');
  expect(html).not.toContain('href="/player/201142"');
  expect(html).toContain('href="/by-position?pos=G"');
  expect(fetch).not.toHaveBeenCalled();
});
