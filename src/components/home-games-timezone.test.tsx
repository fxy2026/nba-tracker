import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
import type { NbaGame, ScheduleDate, ScheduleGame } from "@/lib/nba-contracts";
import archive from "@/data/schedule-2025-26.json";

type Frame = { index: number; slots: unknown[]; effects: (() => void)[] };
type Effect = { deps: unknown[]; cleanup?: () => void };
// Run the real server seed -> HomeClient -> keyed GamesList lifecycle. Child
// widgets are boundaries; this deterministic hook harness is not browser QA.
const runtime = vi.hoisted(() => ({
  current: { index: 0, slots: [], effects: [] } as Frame,
  zone: "Asia/Shanghai", search: new URLSearchParams(),
  sourceDate: "2026-03-01" as string | null, live: [] as NbaGame[],
}));
vi.mock("react", async original => {
  const memo = (make: () => unknown, deps: unknown[]) => {
    const frame = runtime.current, index = frame.index++;
    const old = frame.slots[index] as { value: unknown; deps: unknown[] } | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) frame.slots[index] = { value: make(), deps };
    return (frame.slots[index] as { value: unknown }).value;
  };
  return {
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
      const frame = runtime.current, index = frame.index++;
      if (!(index in frame.slots)) frame.slots[index] = typeof initial === "function" ? initial() : initial;
      return [frame.slots[index], (value: unknown) => { frame.slots[index] = typeof value === "function" ? value(frame.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => {
      const frame = runtime.current, index = frame.index++;
      return frame.slots[index] ?? (frame.slots[index] = { current: initial });
    },
    useMemo: memo,
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useEffect: (run: () => void | (() => void), deps: unknown[]) => {
      const frame = runtime.current, index = frame.index++, old = frame.slots[index] as Effect | undefined;
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) frame.effects.push(() => {
        old?.cleanup?.(); frame.slots[index] = { deps, cleanup: run() };
      });
    },
  };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => runtime.search, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("@/lib/timezone", async original => ({ ...await original<typeof import("@/lib/timezone")>(), localTz: () => runtime.zone }));
vi.mock("@/lib/api", () => ({ getTodayScoreboard: async () => runtime.live, getScoreboardSourceDate: () => runtime.sourceDate }));
import HomeGames from "./HomeGames";
import HomeClient from "./HomeClient";
import GamesList from "./GamesList";
import GameCard from "./GameCard";
import EmptyState from "./EmptyState";
import { dateInTz } from "@/lib/timezone";
import { getScheduleDayView } from "@/lib/schedule-navigation";

type Props = Parameters<typeof HomeClient>[0];
const frame = (): Frame => ({ index: 0, slots: [], effects: [] });
let home = frame(), games = frame(), previousKey: string | null = null;
const cleanup = (owner: Frame) => owner.slots.forEach(slot => (slot as Effect | undefined)?.cleanup?.());
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
function commit() {
  // Passive child effects run before the parent's mount/date correction.
  games.effects.splice(0).forEach(run => run());
  home.effects.splice(0).forEach(run => run());
}
function render(props: Props, commitEffects = true) {
  runtime.current = home; home.index = 0;
  const child = nodes(HomeClient(props)).find(node => node.type === GamesList)!;
  if (previousKey !== null && previousKey !== child.key) { cleanup(games); games = frame(); }
  previousKey = child.key;
  runtime.current = games; games.index = 0;
  const view = nodes(GamesList(child.props as unknown as Parameters<typeof GamesList>[0]));
  if (commitEffects) commit();
  return { view, child };
}
const cardIds = (view: ReturnType<typeof render>) => view.view.filter(node => node.type === GameCard).map(node => (node.props.game as ScheduleGame).gameId);
const loading = (view: ReturnType<typeof render>) => view.view.some(node => String(node.props.className).includes("skeleton-shimmer"));
const hasEmpty = (view: ReturnType<typeof render>) => view.view.some(node => node.type === EmptyState);
const days = archive.dates as ScheduleDate[];
const day = (prefix: string) => days.find(value => value.gameDate.startsWith(prefix))!;
const toScoreboard = (game: ScheduleGame): NbaGame => ({ ...game, gameStatus: 1, gameStatusText: "Scheduled", gameTimeUTC: game.gameDateTimeUTC, gameEt: game.gameDateTimeUTC } as NbaGame);
const serverSeed = async (date = "2026-03-01") => (await HomeGames({ initialDate: date, initialIsToday: true })).props;
let calls: { url: string; signal: AbortSignal; resolve: (response: Response) => void; reject: (error: Error) => void }[];
async function reply(index: number, data: ScheduleGame[]) {
  calls[index].resolve(new Response(JSON.stringify({ data })));
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
beforeEach(() => {
  home = frame(); games = frame(); previousKey = null; calls = [];
  runtime.zone = "Asia/Shanghai"; runtime.search = new URLSearchParams(); runtime.sourceDate = "2026-03-01";
  runtime.live = day("03/01/2026").games.map(toScoreboard);
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-03-01T08:00:00Z"));
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    calls.push({ url, signal: init.signal as AbortSignal, resolve, reject });
  })));
});
afterEach(() => { cleanup(home); cleanup(games); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each([null, "2026-03-01"])("replaces an ET seed with the complete same-string Shanghai date exactly once (date=%s)", async date => {
  if (date) runtime.search.set("date", date);
  const props = await serverSeed();
  const first = render(props, false);
  expect(cardIds(first)).toHaveLength(11); expect(first.child.props.readyToFetch).toBe(false); expect(calls).toHaveLength(0);
  // These are real adjacent archived ET slates. All eleven March 1 ET games
  // belong to March 2 in Shanghai; all five February 28 ET games belong to March 1.
  expect(runtime.live.every(game => dateInTz(new Date(game.gameTimeUTC), runtime.zone) === "2026-03-02")).toBe(true);
  commit(); const corrected = render(props);
  expect(corrected.child.props.selectedDate).toBe("2026-03-01"); expect(cardIds(corrected)).toEqual([]);
  expect(loading(corrected)).toBe(true); expect(hasEmpty(corrected)).toBe(false);
  expect(calls).toHaveLength(1); expect(calls[0].url).toBe("/api/games?date=2026-03-01&tz=Asia%2FShanghai&navigation=1");
  const expected = getScheduleDayView([day("02/28/2026"), day("03/01/2026")], "2026-03-01", runtime.zone).games;
  expect(expected).toHaveLength(5); await reply(0, expected);
  expect(cardIds(render(props))).toEqual(expected.map(game => game.gameId)); expect(calls).toHaveLength(1);
});

it.each([undefined, "America/New_York", "US/Eastern"])("preserves ET SSR and first hydration with no redundant score request (tz=%s)", async tz => {
  runtime.zone = "America/New_York"; if (tz) runtime.search.set("tz", tz);
  const props = await serverSeed(), first = render(props, false);
  expect(cardIds(first)).toEqual(runtime.live.map(game => game.gameId)); expect(loading(first)).toBe(false);
  const key = first.child.key; commit(); const mounted = render(props);
  expect(mounted.child.key).toBe(key); expect(cardIds(mounted)).toEqual(cardIds(first)); expect(calls).toHaveLength(0);
});

it("fetches the new ET date if midnight falls between server rendering and hydration", async () => {
  runtime.zone = "America/New_York"; vi.setSystemTime(new Date("2026-03-02T04:59:59Z"));
  const props = await serverSeed(); render(props, false);
  vi.setSystemTime(new Date("2026-03-02T05:00:01Z")); commit();
  const mounted = render(props);
  expect(mounted.child.props.selectedDate).toBe("2026-03-02"); expect(cardIds(mounted)).toEqual([]);
  expect(calls).toHaveLength(1); expect(calls[0].url).toContain("date=2026-03-02&tz=America%2FNew_York");
});

it("reconciles a partially matching seed rather than mistaking one ET date for complete local-day coverage", async () => {
  // Illustrative early international tipoff: both adjacent ET dates contribute
  // to this Shanghai date. Filtering the seed alone would omit the prior night.
  const previous = day("02/28/2026").games.at(-1)!;
  const early = { ...day("03/01/2026").games[0], gameDateTimeUTC: "2026-03-01T11:00:00Z" };
  const late = day("03/01/2026").games[1];
  runtime.live = [early, late].map(toScoreboard);
  const props = await serverSeed(); render(props); const mounted = render(props);
  expect(cardIds(mounted)).toEqual([]); expect(calls).toHaveLength(1);
  const expected = getScheduleDayView([{ gameDate: "02/28/2026", games: [previous] }, { gameDate: "03/01/2026", games: [early, late] }], "2026-03-01", runtime.zone).games;
  expect(expected.map(game => game.gameId)).toEqual([previous.gameId, early.gameId]);
  await reply(0, expected); expect(cardIds(render(props))).toEqual([previous.gameId, early.gameId]);
});

it.each(["2026-02-28T22:00:00Z", "2026-02-28T16:00:01Z"])("corrects an overnight local date before making one request (%s)", async now => {
  vi.setSystemTime(new Date(now)); runtime.sourceDate = "2026-02-28"; runtime.live = day("02/28/2026").games.map(toScoreboard);
  const props = await serverSeed("2026-02-28"); render(props);
  expect(calls).toHaveLength(0); const mounted = render(props);
  expect(mounted.child.props.selectedDate).toBe("2026-03-01"); expect(calls).toHaveLength(1);
  expect(calls[0].url).toContain("date=2026-03-01&tz=Asia%2FShanghai");
});

it.each(["2026-03-08T06:30:00Z", "2026-03-08T07:30:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"])("does not treat ET DST offset changes as a new timezone scope (%s)", async now => {
  runtime.zone = "America/New_York"; vi.setSystemTime(new Date(now));
  const date = dateInTz(new Date(), runtime.zone); runtime.sourceDate = date;
  runtime.live = day(date === "2026-03-08" ? "03/08/2026" : "03/01/2026").games.map(game => toScoreboard({ ...game, gameDateTimeUTC: `${date}T23:00:00Z` }));
  const props = await serverSeed(date); render(props); expect(cardIds(render(props))).toHaveLength(runtime.live.length); expect(calls).toHaveLength(0);
});

it.each(["America/New_York", "Asia/Shanghai"])("does not fetch before timezone correction and does not fabricate empty while pending (%s)", async zone => {
  runtime.zone = zone; runtime.live = [];
  const props = await serverSeed(); const first = render(props);
  expect(loading(first)).toBe(true); expect(hasEmpty(first)).toBe(false); expect(calls).toHaveLength(0);
  const mounted = render(props); expect(loading(mounted)).toBe(true); expect(calls).toHaveLength(1);
  await reply(0, []); const empty = render(props);
  expect(loading(empty)).toBe(false); expect(cardIds(empty)).toEqual([]); expect(calls).toHaveLength(1);
});

it("preserves an explicit date and timezone across hydration instead of snapping to local today", async () => {
  runtime.search = new URLSearchParams({ date: "2026-02-28", tz: "America/New_York" });
  const props = { initialDate: "2026-02-28", initialIsToday: false };
  render(props); const mounted = render(props); expect(mounted.child.props.selectedDate).toBe("2026-02-28");
  expect(calls).toHaveLength(1); expect(calls[0].url).toContain("date=2026-02-28&tz=America%2FNew_York");
});

it("does not resurrect the invalid ET seed after a local-date fetch fails", async () => {
  const props = await serverSeed(); render(props); render(props); calls[0].reject(new Error("offline"));
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const failed = render(props); expect(cardIds(failed)).toEqual([]);
  expect(failed.view.find(node => node.type === EmptyState)?.props.title).toBe(getTranslations("en").home.failedToLoad);
});
