import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import en from "@/locales/en";
import { searchResultHref } from "./search-result-navigation";
const runtime = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const i = runtime.cursor++; return [i in runtime.slots ? runtime.slots[i] : initial, (v: unknown) => { runtime.slots[i] = v; }]; },
  useEffect: () => {}, useLayoutEffect: () => {}, useRef: (initial: unknown) => ({ current: initial }), useId: () => "search-test",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: (href: string) => { window.location.href = href; } }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: en }) }));
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode) => node }));
import SearchInput from "@/components/SearchInput";
const base = { id: 201939, name: "Stephen Curry", aliases: [], sources: ["player-index"], href: "/player/201939", teamAbbr: "GSW", teamLabel: "Golden State Warriors", position: "G", indexProvenance: null, shotCoverage: null };
const rows = [base, { ...base, id: 977, name: "Kobe Bryant" }, { ...base, id: 121, name: "Patrick Ewing" }, { ...base, id: 201607, name: "Patrick Ewing" }];
function nodes(node: ReactNode): { type: unknown; key: string | null; props: Record<string, unknown> }[] {
  const found: { type: unknown; key: string | null; props: Record<string, unknown> }[] = [];
  Children.forEach(node, child => { if (isValidElement<Record<string, unknown>>(child)) { found.push(child); found.push(...nodes(child.props.children as ReactNode)); } }); return found;
}
beforeEach(() => { vi.stubGlobal("document", { body: {} }); runtime.cursor = 0; runtime.slots = ["Curry", rows, false, true, false, [], 0, false, 0]; vi.stubGlobal("window", { location: { href: "http://localhost/search", origin: "http://localhost" } }); });
afterEach(() => vi.unstubAllGlobals());

it("all player anchors use canonical identities, including distinct players sharing a name", () => {
  const tree = SearchInput({}); const destinations = nodes(tree).filter(n => typeof n.props.href === "string");
  expect(destinations.map(n => n.props.href)).toEqual(["/player/201939", "/player/977", "/player/121", "/player/201607"]);
  expect(new Set(destinations.map(n => n.key)).size).toBe(4);
  for (const link of destinations) expect(link.props.prefetch).toBe(false);
  const html = renderToStaticMarkup(tree); expect(html).toContain("ID 121"); expect(html).toContain("ID 201607");
  expect(html).toContain('role="combobox"'); expect(html).toContain('role="listbox"'); expect(html).toContain('aria-activedescendant="search-test-players-201939"');
});
it.each([0, 1, 2, 3])("Enter opens exactly the anchor destination for result %s", selected => {
  runtime.slots[6] = selected; const tree = SearchInput({}); const input = nodes(tree).find(n => n.type === "input")!;
  const preventDefault = vi.fn(); (input.props.onKeyDown as (e: unknown) => void)({ key: "Enter", preventDefault });
  expect(window.location.href).toBe(`/player/${rows[selected].id}`); expect(preventDefault).toHaveBeenCalledTimes(1); expect(runtime.slots[3]).toBe(false);
});
it("click closes results and never trusts a different href from the server payload", () => {
  const link = nodes(SearchInput({})).find(n => n.props.href === "/player/977")!;
  (link.props.onClick as () => void)(); expect(runtime.slots[3]).toBe(false); expect(link.props.href).toBe("/player/977");
});
it("legacy curated season comparisons keep their exact season while player links are canonical", () => {
  expect(searchResultHref({ personId: 977, isLegend: true })).toBe("/player/977");
  expect(searchResultHref({ personId: 977, isLegend: true, isIconicSeason: true, iconicId: "977-2005" })).toBe("/compare?p1=977-2005");
  expect(searchResultHref({ personId: 977, isIconicSeason: true, iconicId: "893-1995" })).toBe("/iconic-seasons");
  expect(searchResultHref({ personId: 977, isIconicSeason: true })).toBe("/iconic-seasons");
  expect(searchResultHref({ personId: 0 })).toBe("/search");
});
