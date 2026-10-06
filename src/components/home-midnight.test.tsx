import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
import type { ScheduleDate, ScheduleGame } from "@/lib/nba-contracts";
import archive from "@/data/schedule-2025-26.json";

type Effect = { deps: unknown[]; cleanup?: () => void };
type Owner = { slots: unknown[]; mounted: boolean };
// Real HomeClient -> DateNav/GamesList lifecycles with fake clock and browser
// events. Child widgets/router are boundaries; this is not a browser test.
const runtime = vi.hoisted(() => ({
  owners: new Map<string, Owner>(), owner: null as Owner | null, index: 0,
  effects: [] as (() => void)[], dirty: false, lateSetters: 0,
  search: new URLSearchParams(), zone: "Asia/Shanghai", push: vi.fn(),
}));
vi.mock("react", async original => {
  const slot = () => ({ owner: runtime.owner!, index: runtime.index++ });
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (make: () => unknown, deps: unknown[]) => {
    const { owner, index } = slot(), old = owner.slots[index] as { deps: unknown[]; value: unknown } | undefined;
    if (!old || !same(old.deps, deps)) owner.slots[index] = { deps, value: make() };
    return (owner.slots[index] as { value: unknown }).value;
  };
  return {
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
      const { owner, index } = slot();
      if (!(index in owner.slots)) owner.slots[index] = typeof initial === "function" ? initial() : initial;
      return [owner.slots[index], (value: unknown) => {
        if (!owner.mounted) { runtime.lateSetters++; return; }
        const next = typeof value === "function" ? value(owner.slots[index]) : value;
        if (!Object.is(next, owner.slots[index])) { owner.slots[index] = next; runtime.dirty = true; }
      }];
    },
    useRef: (initial: unknown) => {
      const { owner, index } = slot();
      return owner.slots[index] ?? (owner.slots[index] = { current: initial });
    },
    useMemo: memo, useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useEffect: (run: () => void | (() => void), deps: unknown[]) => {
      const { owner, index } = slot(), old = owner.slots[index] as Effect | undefined;
      if (!old || !same(old.deps, deps)) {
        const effect: Effect = { deps }; owner.slots[index] = effect;
        runtime.effects.push(() => { old?.cleanup?.(); effect.cleanup = run() || undefined; });
      }
    },
  };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => runtime.search, useRouter: () => ({ push: runtime.push }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("@/lib/timezone", async original => ({ ...await original<typeof import("@/lib/timezone")>(), localTz: () => runtime.zone }));
import HomeClient from "./HomeClient";
import GamesList from "./GamesList";
import DateNav from "./DateNav";
import GameCard from "./GameCard";
import { getScheduleDayView } from "@/lib/schedule-navigation";

const components = [HomeClient, GamesList, DateNav];
type Node = ReactElement<Record<string, unknown>>;
let props: Parameters<typeof HomeClient>[0], view: Node[], live: Set<string>;
let browser: EventTarget, page: EventTarget & { visibilityState: string };
let calls: { url: string; signal: AbortSignal; resolve: (response: Response) => void }[];
function cleanup(owner: Owner) {
  owner.mounted = false;
  owner.slots.forEach(slot => (slot as Effect | undefined)?.cleanup?.());
}
function resolve(node: ReactNode, path: string) {
  if (Array.isArray(node)) { node.forEach((child, i) => resolve(child, `${path}.${i}`)); return; }
  if (!isValidElement<Record<string, unknown>>(node)) return;
  view.push(node);
  if (components.some(component => node.type === component)) {
    const component = node.type as (props: Record<string, unknown>) => ReactNode;
    const key = `${path}:${component.name}:${node.key ?? ""}`;
    live.add(key);
    let owner = runtime.owners.get(key);
    if (!owner) { owner = { slots: [], mounted: true }; runtime.owners.set(key, owner); }
    runtime.owner = owner; runtime.index = 0;
    resolve(component(node.props), `${key}.child`);
  } else resolve(node.props.children as ReactNode, `${path}.child`);
}
function render(commit = true) {
  runtime.dirty = true;
  for (let i = 0; runtime.dirty; i++) {
    if (i > 20) throw new Error("Effects failed to settle");
    runtime.dirty = false; view = []; live = new Set();
    resolve(<HomeClient {...props} />, "root");
    for (const [key, owner] of runtime.owners) if (!live.has(key)) { cleanup(owner); runtime.owners.delete(key); }
    if (!commit) return;
    runtime.effects.splice(0).forEach(run => run());
  }
}
function unmount() { runtime.owners.forEach(cleanup); runtime.owners.clear(); }
const games = () => view.find(node => node.type === GamesList)!.props;
const todayButton = () => view.find(node => node.type === "button" && node.props.children === "Today")!.props;
const cards = () => view.filter(node => node.type === GameCard).map(node => (node.props.game as ScheduleGame).gameId);
function navigate(query: string) { runtime.search = new URLSearchParams(query); render(); }
function clickDate(date: string) {
  (view.find(node => node.type === DateNav)!.props.onDateChange as (date: string) => void)(date); render();
}
async function reply(index: number, data: ScheduleGame[]) {
  calls[index].resolve(new Response(JSON.stringify({ data })));
  for (let i = 0; i < 16; i++) await Promise.resolve();
  render();
}
beforeEach(() => {
  runtime.owners = new Map(); runtime.effects = []; runtime.dirty = false; runtime.lateSetters = 0;
  runtime.search = new URLSearchParams(); runtime.zone = "Asia/Shanghai"; runtime.push.mockReset();
  props = { initialDate: "2025-12-25", initialIsToday: true }; calls = []; view = [];
  vi.useFakeTimers(); vi.setSystemTime(new Date("2025-12-25T15:59:59Z"));
  browser = new EventTarget(); page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", page);
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => new Promise<Response>(resolve => {
    calls.push({ url, signal: init.signal as AbortSignal, resolve });
  })));
});
afterEach(() => { unmount(); expect(runtime.lateSetters).toBe(0); expect(vi.getTimerCount()).toBe(0); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("advances bare Home at Shanghai midnight from a legitimate empty day to five Christmas games", async () => {
  const schedule = archive.dates as ScheduleDate[];
  props.initialGames = schedule.find(day => day.gameDate.startsWith("12/25/2025"))!.games;
  render(false); expect(cards()).toHaveLength(5); expect(calls).toHaveLength(0);
  expect(games().readyToFetch).toBe(false); expect(todayButton().disabled).toBe(true);
  render();
  expect(calls).toHaveLength(1); expect(calls[0].url).toContain("date=2025-12-25&tz=Asia%2FShanghai");
  await reply(0, getScheduleDayView(schedule, "2025-12-25", runtime.zone).games);
  expect(cards()).toEqual([]);
  vi.advanceTimersByTime(1000); render();
  expect(games().selectedDate).toBe("2025-12-26"); expect(games().isToday).toBe(true);
  expect(todayButton().disabled).toBe(true);
  expect(calls).toHaveLength(2); expect(calls[1].url).toContain("date=2025-12-26&tz=Asia%2FShanghai");
  const nextDay = getScheduleDayView(schedule, "2025-12-26", runtime.zone).games;
  await reply(1, nextDay); expect(cards()).toEqual(nextDay.map(game => game.gameId)); expect(cards()).toHaveLength(5);
  expect(runtime.push).not.toHaveBeenCalled(); expect(runtime.search.toString()).toBe("");
});

it.each(["2025-12-24", "2025-12-25"])("pins explicit date %s through midnight while updating Today navigation", date => {
  navigate(`date=${date}`); vi.advanceTimersByTime(1000); render();
  expect(games().selectedDate).toBe(date); expect(games().isToday).toBe(false); expect(calls).toHaveLength(1);
  expect(todayButton().disabled).toBe(false); (todayButton().onClick as () => void)(); render();
  expect(games().selectedDate).toBe("2025-12-26");
  expect(runtime.push).toHaveBeenLastCalledWith("/?date=2025-12-26", { scroll: false });
  navigate("date=2025-12-26"); vi.advanceTimersByTime(24 * 60 * 60 * 1000); render();
  expect(games().selectedDate).toBe("2025-12-26"); expect(games().isToday).toBe(false);
  expect(todayButton().disabled).toBe(false);
});

it.each(["date=invalid", "date=2025-02-30", "tz=America%2FNew_York"])("retains undated/invalid-date fallback semantics without rewriting %s", query => {
  runtime.zone = "Pacific/Kiritimati";
  if (query.startsWith("tz=")) vi.setSystemTime(new Date("2025-12-26T04:59:59Z"));
  else { runtime.zone = "Asia/Shanghai"; }
  navigate(query); vi.advanceTimersByTime(1000); render();
  expect(games().selectedDate).toBe("2025-12-26"); expect(games().isToday).toBe(true);
  expect(calls).toHaveLength(2); expect(runtime.search.toString()).toBe(query); expect(runtime.push).not.toHaveBeenCalled();
});

it("resumes following Today on Back to bare Home and restores the pinned date on Forward", () => {
  render(); clickDate("2025-12-24"); navigate("date=2025-12-24");
  vi.advanceTimersByTime(1000); render(); expect(games().selectedDate).toBe("2025-12-24");
  navigate(""); expect(games().selectedDate).toBe("2025-12-26"); expect(games().isToday).toBe(true);
  navigate("date=2025-12-24"); expect(games().selectedDate).toBe("2025-12-24");
  navigate(""); vi.advanceTimersByTime(24 * 60 * 60 * 1000); render();
  expect(games().selectedDate).toBe("2025-12-27"); expect(runtime.push).not.toHaveBeenCalled();
});

it.each(["day chip", "yesterday results"])("does not overwrite a %s click while the date URL is still pending", action => {
  render();
  if (action === "day chip") clickDate("2025-12-24");
  else {
    const yesterday = view.find(node => node.type === "button" && Array.isArray(node.props.children) && node.props.children.includes(getTranslations("en").home.yesterdayResults))!;
    (yesterday.props.onClick as () => void)(); render();
  }
  expect(runtime.search.get("date")).toBeNull(); expect(games().selectedDate).toBe("2025-12-24");
  vi.advanceTimersByTime(1000); render(); expect(games().selectedDate).toBe("2025-12-24");
  navigate("date=2025-12-24"); expect(games().selectedDate).toBe("2025-12-24");
});

it.each([null, "2025-12-24"])("catches up on mobile visibility resume without changing an explicit date (%s)", date => {
  if (date) runtime.search.set("date", date);
  render(); page.visibilityState = "hidden"; page.dispatchEvent(new Event("visibilitychange"));
  vi.setSystemTime(new Date("2025-12-28T03:00:00Z"));
  page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange")); render();
  expect(games().selectedDate).toBe(date ?? "2025-12-28"); expect(games().isToday).toBe(!date);
  expect(calls).toHaveLength(date ? 1 : 2);
  for (const event of ["focus", "pageshow", "online"]) browser.dispatchEvent(new Event(event));
  render(); expect(calls).toHaveLength(date ? 1 : 2); expect(vi.getTimerCount()).toBe(1);
});

it.each([
  ["2026-03-08T05:00:00Z", "2026-03-09", 23],
  ["2026-11-01T04:00:00Z", "2026-11-02", 25],
] as const)("rolls exactly at ET midnight across the DST day starting %s", (now, next, hours) => {
  runtime.zone = "America/New_York"; vi.setSystemTime(new Date(now)); render();
  const current = games().selectedDate;
  vi.advanceTimersByTime(hours * 60 * 60 * 1000 - 1); render();
  expect(games().selectedDate).toBe(current); expect(calls).toHaveLength(1);
  vi.advanceTimersByTime(1); render(); expect(games().selectedDate).toBe(next); expect(calls).toHaveLength(2);
  expect(todayButton().disabled).toBe(true);
});

it("aborts a superseded day request and ignores its late result after midnight", async () => {
  render(); vi.advanceTimersByTime(1000); render(); expect(calls[0].signal.aborted).toBe(true);
  const schedule = archive.dates as ScheduleDate[], expected = getScheduleDayView(schedule, "2025-12-26", runtime.zone).games;
  await reply(1, expected); await reply(0, []);
  expect(cards()).toEqual(expected.map(game => game.gameId)); expect(games().selectedDate).toBe("2025-12-26");
});

it.each([false, true])("uses the resumed browser timezone while retaining explicit timezone preference=%s", explicit => {
  if (explicit) runtime.search.set("tz", "America/New_York");
  render(); runtime.zone = "Pacific/Kiritimati"; browser.dispatchEvent(new Event("pageshow")); render();
  expect(games().selectedDate).toBe(explicit ? "2025-12-25" : "2025-12-26");
  expect(games().timeZone).toBe(explicit ? "America/New_York" : undefined);
  expect(calls).toHaveLength(explicit ? 1 : 2);
  expect(calls.at(-1)!.url).toContain(explicit ? "tz=America%2FNew_York" : "tz=Pacific%2FKiritimati");
});

it("refreshes the timezone caption and score scope even when a resumed zone has the same date", () => {
  render(); const previousDate = games().selectedDate;
  runtime.zone = "America/New_York"; browser.dispatchEvent(new Event("focus")); render();
  expect(games().selectedDate).toBe(previousDate); expect(calls).toHaveLength(2);
  expect(calls.at(-1)!.url).toContain("tz=America%2FNew_York");
  expect(view.some(node => node.type === "span" && node.props.children === `${getTranslations("en").dateNav.localTimeZone} EST`)).toBe(true);
});

it("replaces the old zone timer on navigation and removes all work on unmount", () => {
  render(); navigate("tz=America%2FNew_York"); expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(1000); render(); expect(games().selectedDate).toBe("2025-12-25"); expect(calls).toHaveLength(2);
  const count = calls.length; unmount(); expect(vi.getTimerCount()).toBe(0);
  page.dispatchEvent(new Event("visibilitychange")); browser.dispatchEvent(new Event("pageshow"));
  vi.advanceTimersByTime(48 * 60 * 60 * 1000);
  expect(calls).toHaveLength(count); expect(runtime.lateSetters).toBe(0);
});
