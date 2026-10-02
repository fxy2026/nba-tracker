import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import en from "@/locales/en";
import { searchResultHref } from "./search-result-navigation";
const runtime = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const i = runtime.cursor++; return [i in runtime.slots ? runtime.slots[i] : initial, (v: unknown) => { runtime.slots[i] = v; }]; },
  useEffect: () => {}, useRef: () => ({ current: null }),
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: en }) }));
import SearchInput from "@/components/SearchInput";
const base = { personId: 201939, firstName: "Stephen", lastName: "Curry", teamAbbr: "GSW", teamId: 1, teamName: "Warriors", teamCity: "Golden State", jersey: "30", position: "G", pts: 30, reb: 5, ast: 6 };
const rows = [base, { ...base, personId: 977, firstName: "Kobe", lastName: "Bryant", isLegend: true }, { ...base, isIconicSeason: true, iconicId: "201939-2015", season: "2015-16" }, { ...base, isIconicSeason: true, iconicId: "201939-2020", season: "2020-21" }];
function nodes(node: ReactNode): { type: unknown; key: string | null; props: Record<string, unknown> }[] {
  const found: { type: unknown; key: string | null; props: Record<string, unknown> }[] = [];
  Children.forEach(node, child => { if (isValidElement<Record<string, unknown>>(child)) { found.push(child); found.push(...nodes(child.props.children as ReactNode)); } }); return found;
}
beforeEach(() => { runtime.cursor = 0; runtime.slots = ["Curry", rows, false, true, false, [], 0]; vi.stubGlobal("window", { location: { href: "http://localhost/search", origin: "http://localhost" } }); });
afterEach(() => vi.unstubAllGlobals());

it("actual search result anchors preserve active, retired, and individual season destinations with distinct keys", () => {
  const tree = SearchInput({}); const destinations = nodes(tree).filter(n => typeof n.props.href === "string");
  expect(destinations.map(n => n.props.href)).toEqual(["/player/201939", "/legends/977", "/compare?p1=201939-2015", "/compare?p1=201939-2020"]);
  expect(new Set(destinations.map(n => n.key)).size).toBe(4);
  const html = renderToStaticMarkup(tree); expect(html).toContain("2015-16"); expect(html).toContain("curated season"); expect(html).toContain("Curated career averages");
});
it.each([0, 1, 2, 3])("actual Enter handler uses exactly the anchor destination for result %s", selected => {
  runtime.slots[6] = selected; const tree = SearchInput({}); const input = nodes(tree).find(n => n.type === "input")!;
  const preventDefault = vi.fn(); (input.props.onKeyDown as (e: unknown) => void)({ key: "Enter", preventDefault });
  expect(window.location.href).toBe(searchResultHref(rows[selected])); expect(preventDefault).toHaveBeenCalledTimes(1); expect(runtime.slots[3]).toBe(false);
});
it("actual anchor click closes results without replacing its source-aware href", () => {
  const link = nodes(SearchInput({})).find(n => n.props.href === "/legends/977")!;
  (link.props.onClick as () => void)(); expect(runtime.slots[3]).toBe(false); expect(link.props.href).toBe("/legends/977");
});
it("source priority preserves iconic seasons of retired players and rejects malformed composite IDs", () => {
  expect(searchResultHref({ personId: 977, isLegend: true, isIconicSeason: true, iconicId: "977-2005" })).toBe("/compare?p1=977-2005");
  expect(searchResultHref({ personId: 977, isIconicSeason: true, iconicId: "893-1995" })).toBe("/iconic-seasons");
  expect(searchResultHref({ personId: 977, isIconicSeason: true })).toBe("/iconic-seasons");
  expect(searchResultHref({ personId: 0 })).toBe("/search");
});
