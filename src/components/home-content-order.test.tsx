import { Children, isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

const state = vi.hoisted(() => ({ mounted: false, date: null as string | null, tz: null as string | null }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [typeof initial === "boolean" ? state.mounted : initial, vi.fn()],
  useEffect: () => {},
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => key === "tz" ? state.tz : state.date }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("@/lib/timezone", () => ({ localTz: () => "UTC", dateInTz: () => "2026-10-02" }));
vi.mock("@/lib/api", () => ({ formatDate: () => "2026-10-02", getTodayScoreboard: vi.fn(async () => []) }));
vi.mock("@/components/OffseasonHero", () => ({ default: async function OffseasonHero() { return null; } }));
vi.mock("@/components/BestOfNightCard", () => ({ default: () => null }));
vi.mock("@/components/DailyIconicPick", () => ({ default: () => null }));
import HomeClient from "./HomeClient";
import HomeGames from "./HomeGames";
import DateNav from "./DateNav";
import GamesList from "./GamesList";
import HomeExtra from "./HomeExtra";
import RecentlyViewed from "./RecentlyViewed";
import HomePlayerSearch from "./HomePlayerSearch";
import OffseasonHero from "./OffseasonHero";
import HomePage from "@/app/page";

const elements = (node: ReactElement<{ children?: ReactNode }>) => Children.toArray(node.props.children).filter(isValidElement);
beforeEach(() => { state.mounted = false; state.date = null; state.tz = null; });

it.each([
  [false, true, null],
  [false, false, "America/New_York"],
  [true, true, null],
  [true, false, "Asia/Shanghai"],
] as const)("keeps extras then one supplemental slot after games (mounted=%s, today=%s, tz=%s)", (mounted, initialIsToday, tz) => {
  state.mounted = mounted;
  state.tz = tz;
  const slot = <section data-testid="offseason">Supplemental content</section>;
  const tree = HomeClient({ initialDate: initialIsToday ? "2026-10-02" : "2026-10-27", initialIsToday, afterGames: slot });
  const children = elements(tree);
  const gameIndex = children.findIndex((child) => child.type === GamesList);
  expect(children[0].type).toBe(DateNav);
  expect(children[gameIndex + 1].type).toBe(HomeExtra);
  expect(children[gameIndex + 1].props).toEqual({});
  expect(children.filter((child) => child.type === HomeExtra)).toHaveLength(1);
  expect(children[gameIndex + 2].type).toBe("section");
  expect(children[gameIndex + 2].props).toEqual(slot.props);
  expect(children.filter((child) => child.type === "section")).toHaveLength(1);
  expect(children[gameIndex + 3].type).toBe(RecentlyViewed);
  expect(children[gameIndex + 4].type).toBe("div"); // League Pulse
});

it.each([undefined, null])("accepts an absent supplemental slot (%s)", (afterGames) => {
  const children = elements(HomeClient({ initialDate: "2026-10-02", initialIsToday: true, afterGames }));
  const gameIndex = children.findIndex((child) => child.type === GamesList);
  expect(children[gameIndex + 1].type).toBe(HomeExtra);
  expect(children[gameIndex + 2].type).toBe(RecentlyViewed);
});

it("composes one server hero inside its null-fallback Suspense after search", async () => {
  const page = await HomePage({ searchParams: Promise.resolve({ date: "2026-10-27" }) });
  const children = elements(page);
  const searchIndex = children.findIndex((child) => child.type === HomePlayerSearch);
  const boundary = children[searchIndex + 1] as ReactElement<{ children: ReactElement<Parameters<typeof HomeGames>[0]> }>;
  expect(boundary.type).toBe(Suspense);
  expect(boundary.props.children.type).toBe(HomeGames);
  const home = await HomeGames(boundary.props.children.props);
  expect(home.type).toBe(HomeClient);
  expect(children.some((child) => child.type === OffseasonHero)).toBe(false);
  const slot = home.props.afterGames as ReactElement<{ fallback: null; children: ReactElement }>;
  expect(slot.type).toBe(Suspense);
  expect(slot.props.fallback).toBeNull();
  expect(Children.count(slot.props.children)).toBe(1);
  expect(slot.props.children.type).toBe(OffseasonHero);
  expect(home.props.initialDate).toBe("2026-10-27");
  expect(home.props.initialGames).toBeUndefined();
  expect(home.props.initialIsToday).toBe(false);
});

it("omitted and null slots leave identical child output", () => {
  const props = { initialDate: "2026-10-02", initialIsToday: true };
  // Compare the complete element shape while ignoring fresh callback identities.
  expect(JSON.stringify(elements(HomeClient(props)))).toBe(JSON.stringify(elements(HomeClient({ ...props, afterGames: null }))));
});
