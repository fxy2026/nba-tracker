import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";
const runtime = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale, t: runtime.locale === "zh" ? zh : en }) }));
import HomePlayerSearch from "@/components/HomePlayerSearch";

it.each(["en", "zh"])("home initially renders a visible, labelled search in %s without opening a menu or stealing focus", locale => {
  runtime.locale = locale;
  const html = renderToStaticMarkup(<HomePlayerSearch />);
  expect(html).toContain(locale === "zh" ? "搜索球员" : "Player search");
  expect(html).toContain(locale === "zh" ? "球员姓名 / NBA ID" : "Player name or NBA ID");
  expect(html).toContain('role="search"'); expect(html).toContain('role="combobox"');
  expect(html).toContain('aria-expanded="false"'); expect(html).not.toContain("autofocus");
  expect(html).not.toContain('role="listbox"'); expect(html).not.toContain('data-player-search-popup');
});
it("home search is in the initial shell before async offseason content and date/score controls", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const search = page.indexOf("<HomePlayerSearch />"); expect(search).toBeGreaterThan(-1);
  expect(search).toBeLessThan(page.indexOf("<OffseasonHero />")); expect(search).toBeLessThan(page.indexOf("<HomeClient"));
});
it("the client entry ships neither identity data, archive data nor biography, and no duplicate header control is added", () => {
  const home = readFileSync("src/components/HomePlayerSearch.tsx", "utf8");
  const search = readFileSync("src/components/SearchInput.tsx", "utf8");
  expect(home).toContain('<SearchInput variant="home" autoFocus={false} />');
  expect(search).toContain('import type { PlayerIdentity }'); expect(search).not.toMatch(/import .*from .*data\//);
  expect(search).toContain("prefetch={false}"); expect(search).not.toContain("historical-shot-archive");
});
it("popup stays within input width and scrolls separately without page layout changes", () => {
  const css = readFileSync("src/components/player-search.module.css", "utf8");
  expect(css).toContain("position:fixed");
  const search = readFileSync("src/components/SearchInput.tsx", "utf8");
  expect(search).toContain("positionSelectPopup"); expect(search).toContain("window.visualViewport");
  expect(css).toContain("max-height:320px"); expect(css).toContain("overscroll-behavior:contain");
  expect(css).toContain("min-height:56px"); expect(css).toContain("font-size:16px");
  // IDs disambiguate namesakes and must remain visible at narrow widths.
  expect(css).not.toContain(".id { display:none;");
});
