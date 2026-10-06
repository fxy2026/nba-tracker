import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import { getTranslations } from "@/locales";
import type { ScheduleGame } from "@/lib/api";

// Deterministic component hook/commit harness. Browser QA is a separate gate.
const runtime = vi.hoisted(() => ({ index: 0, slots: [] as unknown[], effects: [] as (() => void)[], locale: "en" as "en" | "zh", localTz: vi.fn(() => "Pacific/Auckland") }));
vi.mock("react", async original => {
  const memo = (make: () => unknown, deps: unknown[]) => {
    const index = runtime.index++;
    const old = runtime.slots[index] as { value: unknown; deps: unknown[] } | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) runtime.slots[index] = { value: make(), deps };
    return (runtime.slots[index] as { value: unknown }).value;
  };
  return {
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
      const index = runtime.index++;
      if (!(index in runtime.slots)) runtime.slots[index] = typeof initial === "function" ? initial() : initial;
      return [runtime.slots[index], (value: unknown) => { runtime.slots[index] = typeof value === "function" ? value(runtime.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => { const index = runtime.index++; return runtime.slots[index] ?? (runtime.slots[index] = { current: initial }); },
    useMemo: memo,
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useEffect: (run: () => void | (() => void), deps: unknown[]) => {
      const index = runtime.index++;
      const old = runtime.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) runtime.effects.push(() => {
        old?.cleanup?.(); runtime.slots[index] = { deps, cleanup: run() };
      });
    },
  };
});
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale) }) }));
vi.mock("@/lib/timezone", () => ({ localTz: runtime.localTz }));
import GamesList from "./GamesList";
import EspnScoreboard from "./EspnScoreboard";
import GameCard from "./GameCard";
import LiveScoreRefresher from "./LiveScoreRefresher";
import ScoreTicker from "./ScoreTicker";
import TodayStars from "./TodayStars";
import EmptyState from "./EmptyState";
import { PlannedFixtureSection } from "./PlannedFixtures";
import ScheduleEmptyNavigation from "./ScheduleEmptyNavigation";

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
function render(props: Partial<ComponentProps<typeof GamesList>> = {}) {
  runtime.index = 0;
  const tree = GamesList({ selectedDate: "2026-03-01", isToday: false, ...props });
  runtime.effects.splice(0).forEach(run => run());
  return nodes(tree);
}
function unmount() { runtime.slots.forEach(slot => (slot as { cleanup?: () => void } | undefined)?.cleanup?.()); }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const response = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) }) as Response;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const game = (gameId = "0022500001", gameStatus = 1): ScheduleGame => ({
  gameId, gameStatus, gameStatusText: "7:00 PM", gameCode: "20260301/GSWLAL", gameDateTimeUTC: "2026-03-02T00:00Z",
  homeTeam: { teamId: 1610612747, teamTricode: "LAL", teamName: "Lakers", teamCity: "Los Angeles", teamSlug: "lakers", score: 100 },
  awayTeam: { teamId: 1610612744, teamTricode: "GSW", teamName: "Warriors", teamCity: "Golden State", teamSlug: "warriors", score: 99 },
});
let calls: { url: string; signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }[];
const scores = () => calls.filter(call => call.url.startsWith("/api/games?"));
const replays = () => calls.filter(call => call.url === "/api/replay?action=ids");
const cards = (view: ReturnType<typeof render>) => view.filter(node => node.type === GameCard);
const cardIds = (view: ReturnType<typeof render>) => cards(view).map(node => (node.props.game as ScheduleGame).gameId);
const isLoading = (view: ReturnType<typeof render>) => view.some(node => String(node.props.className).includes("skeleton-shimmer"));
const hasRefreshError = (view: ReturnType<typeof render>) => view.some(node => node.props.children === en.home.refreshFailed);
const refresh = (view: ReturnType<typeof render>) => (view.find(node => node.type === LiveScoreRefresher)!.props.onRefresh as () => void)();
beforeEach(() => {
  runtime.index = 0; runtime.slots = []; runtime.effects = []; calls = [];
  runtime.locale = "en"; runtime.localTz.mockClear();
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const reply = deferred<Response>(); calls.push({ url, signal: init.signal as AbortSignal, reply }); return reply.promise;
  }));
});

afterEach(() => {
  unmount();
  // Every mount, date change, refresh, retry, and cancellation is score-only.
  expect(replays()).toHaveLength(0);
  expect(calls.every(call => call.url.startsWith("/api/games?"))).toBe(true);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("canonical live games after midnight", () => {
  const props = { selectedDate: "2026-03-01", timeZone: "America/New_York", initialGames: [game("0022500001", 2)], isToday: false };
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-03-02T05:10:00Z")); });

  it("keeps polling, ticker and auto label when a pinned live day becomes yesterday, then stops at final", async () => {
    const today = render({ ...props, isToday: true });
    expect(today.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
    const overnight = render(props);
    expect(overnight.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
    expect(overnight.some(node => node.type === ScoreTicker)).toBe(true);
    expect(overnight.some(node => Array.isArray(node.props.children) && node.props.children.includes("auto"))).toBe(true);
    expect(overnight.some(node => node.type === TodayStars)).toBe(false);
    expect(scores()).toHaveLength(0);

    refresh(overnight); scores()[0].reply.resolve(response({ data: [game("0022500001", 3)] })); await settle();
    const finished = render(props);
    expect(finished.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
    expect(finished.some(node => node.type === ScoreTicker)).toBe(false);
    expect(cardIds(finished)).toEqual(["0022500001"]);
  });

  it("retains an overnight refresh loop through a same-scope network failure", async () => {
    refresh(render(props)); scores()[0].reply.reject(new Error("offline")); await settle();
    const stale = render(props);
    expect(hasRefreshError(stale)).toBe(true);
    expect(stale.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
  });

  it.each([{ initialGames: [] }, { initialGames: [game("final", 3)] }, { initialGames: [game("upcoming", 1)] }])("does not poll a selected day without live rows", ({ initialGames }) => {
    const view = render({ ...props, initialGames });
    expect(view.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
    expect(view.some(node => node.type === ScoreTicker)).toBe(false);
  });

  it.each(["2026-02-27T00:00:00Z", "", "invalid", "2026-03-03T00:00:00Z"])("does not extend polling for old, unknown or future tipoffs (%s)", gameDateTimeUTC => {
    const view = render({ ...props, initialGames: [{ ...game("0022500001", 2), gameDateTimeUTC }] });
    expect(view.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
  });

  it("rechecks calendar relevance on refresh, stopping stale status-2 data once it is older than ET yesterday", async () => {
    const first = render(props);
    expect(first.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
    vi.setSystemTime(new Date("2026-03-03T05:00:01Z"));
    refresh(first); scores()[0].reply.resolve(response({ data: props.initialGames })); await settle();
    expect(render(props).find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
  });

  it("waits until hydration resolves before enabling the non-today refresh extension", () => {
    expect(render({ ...props, readyToFetch: false }).find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
    expect(render(props).find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
    expect(scores()).toHaveLength(0);
  });
});

describe("score loading after video replay retirement", () => {
  it("fetches only games and preserves live, upcoming, and final card ordering", async () => {
    render();
    expect(calls).toHaveLength(1);
    scores()[0].reply.resolve(response({ data: [game("final", 3), game("upcoming", 1), game("live", 2)] }));
    await settle();
    const view = cards(render());
    expect(view.map(node => (node.props.game as ScheduleGame).gameId)).toEqual(["live", "upcoming", "final"]);
    expect(view.every(node => !Object.hasOwn(node.props, "hasReplay"))).toBe(true);
    expect(scores()[0].url).toBe("/api/games?date=2026-03-01&tz=Pacific%2FAuckland&navigation=1");
  });
  it("renders initial games without a scoreboard or replay lookup", () => {
    const view = render({ initialGames: [game()] });
    expect(cards(view)).toHaveLength(1);
    expect(calls).toHaveLength(0);
    expect(view.some(node => node.type === EmptyState)).toBe(false);
  });
  it("keeps the existing loading state until the games response arrives", async () => {
    render(); await settle(); const view = render();
    expect(cards(view)).toHaveLength(0); expect(view.some(node => node.type === EmptyState)).toBe(false);
    expect(view.some(node => String(node.props.className).includes("skeleton-shimmer"))).toBe(true);
    expect(scores()).toHaveLength(1);
  });
  it("late old-date score JSON never overwrites the newer date", async () => {
    const oldGames = deferred();
    render(); scores()[0].reply.resolve(response(oldGames.promise)); await settle();
    const props = { selectedDate: "2026-03-02", timeZone: "America/New_York" };
    render(props); expect(scores()[0].signal.aborted).toBe(true);
    scores()[1].reply.resolve(response({ data: [game("new")] })); await settle();
    oldGames.resolve({ data: [game("old")] }); await settle();
    const view = cards(render(props)); expect(view.map(node => (node.props.game as ScheduleGame).gameId)).toEqual(["new"]);
    expect(scores()[1].url).toContain("tz=America%2FNew_York");
  });
  it("a newer refresh aborts the old request without restoring replay polling", async () => {
    const props = { initialGames: [game("live", 2)], isToday: true };
    refresh(render(props)); refresh(render(props));
    expect(scores()).toHaveLength(2); expect(scores()[0].signal.aborted).toBe(true);
    scores()[1].reply.resolve(response({ data: [game("new", 2)] })); await settle();
    scores()[0].reply.reject(new Error("late failure")); await settle();
    const view = render(props);
    expect((cards(view)[0].props.game as ScheduleGame).gameId).toBe("new");
    expect(view.some(node => node.props.children === en.home.refreshFailed)).toBe(false);
  });
  it("an old score failure cannot dismiss the new date's loading state", async () => {
    render(); render({ selectedDate: "2026-03-02" }); scores()[0].reply.reject(new Error("old failure")); await settle();
    const view = render({ selectedDate: "2026-03-02" });
    expect(cards(view)).toHaveLength(0); expect(view.some(node => node.type === EmptyState)).toBe(false);
    expect(view.some(node => String(node.props.className).includes("skeleton-shimmer"))).toBe(true);
  });
  it("unmount aborts the request and ignores late bodies without state updates", async () => {
    const games = deferred();
    render(); scores()[0].reply.resolve(response(games.promise)); await settle();
    unmount(); const before = [...runtime.slots]; expect(calls.every(call => call.signal.aborted)).toBe(true);
    games.resolve({ data: [game()] }); await settle(); expect(runtime.slots).toEqual(before);
  });
  it("current games failure shows the existing full error and retry recovers", async () => {
    render(); scores()[0].reply.resolve(response(null, false)); await settle();
    const error = render().find(node => node.type === EmptyState)!; expect(error.props.title).toBe(en.home.failedToLoad);
    (error.props.action as { onClick: () => void }).onClick(); scores()[1].reply.resolve(response({ data: [game()] })); await settle();
    expect(cards(render())).toHaveLength(1); expect(scores()[0].signal.aborted).toBe(true);
  });
  it("current refresh failure retains the existing scores with a soft error", async () => {
    const props = { initialGames: [game()], isToday: true };
    refresh(render(props)); scores()[0].reply.reject(new Error("offline")); await settle();
    const view = render(props); expect(cards(view)).toHaveLength(1); expect(view.some(node => node.props.children === en.home.refreshFailed)).toBe(true);
  });
  it("keeps TodayStars conditional on the parent's isToday without passing the parent's date or timezone", () => {
    const props = { initialGames: [game()], timeZone: "America/New_York" };
    expect(render(props).some(node => node.type === TodayStars)).toBe(false);
    const widget = render({ ...props, isToday: true }).find(node => node.type === TodayStars)!;
    expect(widget.props).toEqual({});
  });
});

describe("scores belong to the selected calendar date", () => {
  it("hides old cards, summaries, ticker, and polling before the new date effect and after its failure", async () => {
    const initialGames = [game("old-live", 2), game("old-upcoming", 1), game("old-final", 3)];
    const first = render({ initialGames, isToday: true });
    expect(cardIds(first)).toEqual(["old-live", "old-upcoming", "old-final"]);
    expect(first.some(node => node.type === ScoreTicker)).toBe(true);
    expect(first.some(node => node.props.href === "/game/old-final")).toBe(true);

    const props = { selectedDate: "2026-03-02", initialGames, isToday: true };
    // render returns the tree produced before the date-change effect runs.
    const changed = render(props);
    expect(isLoading(changed)).toBe(true);
    expect(cards(changed)).toHaveLength(0);
    expect(changed.some(node => node.type === ScoreTicker || node.type === LiveScoreRefresher)).toBe(false);
    expect(changed.some(node => node.props.href === "/game/old-final")).toBe(false);
    expect(changed.some(node => node.props.children === en.home.liveNow || node.props.children === en.common.final)).toBe(false);

    scores()[0].reply.reject(new Error("new date unavailable")); await settle();
    const failed = render(props);
    expect(isLoading(failed)).toBe(false);
    expect(cards(failed)).toHaveLength(0);
    expect(failed.find(node => node.type === EmptyState)?.props.title).toBe(en.home.failedToLoad);
    expect(hasRefreshError(failed)).toBe(false);
    expect(failed.some(node => node.type === ScoreTicker || node.type === LiveScoreRefresher || node.type === ScheduleEmptyNavigation || node.type === PlannedFixtureSection)).toBe(false);

    const error = failed.find(node => node.type === EmptyState)!;
    (error.props.action as { onClick: () => void }).onClick();
    expect(isLoading(render(props))).toBe(true);
    expect(scores()[1].url).toContain("date=2026-03-02&");
    scores()[1].reply.resolve(response({ data: [game("new-live", 2)] })); await settle();
    const recovered = render(props);
    expect(cardIds(recovered)).toEqual(["new-live"]);
    expect(recovered.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
    expect(recovered.find(node => node.type === ScoreTicker)?.props.games).toEqual([expect.objectContaining({ gameId: "new-live" })]);
  });

  it.each([false, true])("does not borrow the previous date's error before its effect (cached scores: %s)", async hasScores => {
    const props = hasScores ? { initialGames: [game("old", 2)], isToday: true } : {};
    const first = render(props);
    if (hasScores) refresh(first);
    scores()[0].reply.reject(new Error("old date failed")); await settle();
    const failed = render(props);
    expect(hasScores ? hasRefreshError(failed) : failed.some(node => node.type === EmptyState)).toBe(true);

    const changed = render({ ...props, selectedDate: "2026-03-02" });
    expect(isLoading(changed)).toBe(true);
    expect(cards(changed)).toHaveLength(0);
    expect(hasRefreshError(changed)).toBe(false);
    expect(changed.some(node => node.type === EmptyState || node.type === ScheduleEmptyNavigation || node.type === ScoreTicker)).toBe(false);
  });

  it.each([undefined, "America/New_York"])("keeps same-scope scores on refresh failure and retry (timezone: %s)", async timeZone => {
    const props = { initialGames: [game("same-date", 2)], isToday: true, timeZone };
    refresh(render(props)); scores()[0].reply.reject(new Error("offline")); await settle();
    const failed = render(props);
    expect(cardIds(failed)).toEqual(["same-date"]);
    expect(hasRefreshError(failed)).toBe(true);
    expect(failed.some(node => node.type === EmptyState)).toBe(false);
    expect(failed.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);

    (failed.find(node => node.type === "button" && node.props.children === en.common.retry)!.props.onClick as () => void)();
    const retrying = render(props);
    expect(cardIds(retrying)).toEqual(["same-date"]);
    expect(hasRefreshError(retrying)).toBe(false);
    expect(isLoading(retrying)).toBe(false);
    expect(scores()[0].signal.aborted).toBe(true);
    scores()[1].reply.resolve(response({ data: [game("refreshed", 3)] })); await settle();
    const recovered = render(props);
    expect(cardIds(recovered)).toEqual(["refreshed"]);
    expect(recovered.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
    expect(recovered.some(node => node.type === ScoreTicker)).toBe(false);
  });

  it.each(["pending", "loaded"])("ignores A and B responses and errors when C is %s after rapid navigation", async currentState => {
    const props = { initialGames: [game("initial-A", 2)], isToday: true };
    const bodyA = deferred();
    refresh(render(props)); scores()[0].reply.resolve(response(bodyA.promise)); await settle();
    render({ ...props, selectedDate: "2026-03-02" });
    const propsC = { ...props, selectedDate: "2026-03-03" };
    render(propsC);
    expect(scores().slice(0, 2).every(call => call.signal.aborted)).toBe(true);
    expect(scores()).toHaveLength(3);
    if (currentState === "loaded") { scores()[2].reply.resolve(response({ data: [game("current-C", 2)] })); await settle(); }

    bodyA.resolve({ data: [game("late-A", 2)] });
    scores()[1].reply.reject(new Error("late B failure")); await settle();
    const view = render(propsC);
    expect(cardIds(view)).toEqual(currentState === "loaded" ? ["current-C"] : []);
    expect(isLoading(view)).toBe(currentState === "pending");
    expect(hasRefreshError(view)).toBe(false);
    expect(view.some(node => node.type === EmptyState)).toBe(false);
    if (currentState === "pending") {
      expect(view.some(node => node.type === ScoreTicker || node.type === LiveScoreRefresher)).toBe(false);
      scores()[2].reply.resolve(response({ data: [game("current-C", 2)] })); await settle();
      expect(cardIds(render(propsC))).toEqual(["current-C"]);
    }
  });

  it("keeps back/forward navigation date-scoped and does not refetch on same-date rerenders", async () => {
    const propsA = { initialGames: [game("A")], selectedDate: "2026-03-01" };
    const propsB = { ...propsA, selectedDate: "2026-03-02" };
    render(propsA); render(propsB);
    scores()[0].reply.resolve(response({ data: [game("B")] })); await settle();
    expect(cardIds(render(propsB))).toEqual(["B"]);
    expect(cardIds(render({ ...propsB, isToday: true }))).toEqual(["B"]);
    expect(scores()).toHaveLength(1);

    const back = render(propsA);
    expect(isLoading(back)).toBe(true); expect(cards(back)).toHaveLength(0);
    scores()[1].reply.reject(new Error("back failed")); await settle();
    expect(render(propsA).some(node => node.type === EmptyState)).toBe(true);

    const forward = render(propsB);
    expect(cardIds(forward)).toEqual(["B"]);
    expect(hasRefreshError(forward)).toBe(false);
    expect(forward.some(node => node.type === EmptyState)).toBe(false);
    scores()[2].reply.resolve(response({ data: [game("B-refreshed")] })); await settle();
    expect(cardIds(render(propsB))).toEqual(["B-refreshed"]);
    render(propsB); expect(scores()).toHaveLength(3);
  });

  it.each([["planned", "date"], ["empty", "date"], ["planned", "zone"], ["empty", "zone"]])("keeps %s semantics and hides them during a new %s request or failure", async (kind, change) => {
    const props = { selectedDate: "2026-10-04", isToday: true };
    const navigation = { availableFrom: "2025-10-01", availableThrough: "2026-06-20", latestFinalDate: "2026-06-20", nextScheduledDate: null };
    const planned = { state: "snapshot", snapshotDate: "2026-08-13", season: "2026-27", timeZone: "Pacific/Auckland", fixtures: [], nextAvailableDate: "2026-10-21" };
    render(props); scores()[0].reply.resolve(response({ data: [], navigation, ...(kind === "planned" ? { planned } : {}) })); await settle();
    const view = render(props);
    expect(cards(view)).toHaveLength(0);
    expect(view.some(node => node.type === ScoreTicker)).toBe(false);
    expect(view.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(false);
    if (kind === "planned") expect(view.find(node => node.type === PlannedFixtureSection)?.props.view).toEqual(planned);
    else expect(view.find(node => node.type === ScheduleEmptyNavigation)?.props.navigation).toEqual(navigation);

    const nextProps = { ...props, ...(change === "date" ? { selectedDate: "2026-10-05" } : { timeZone: "Asia/Shanghai" }) };
    const changed = render(nextProps);
    expect(isLoading(changed)).toBe(true);
    expect(changed.some(node => node.type === PlannedFixtureSection || node.type === ScheduleEmptyNavigation)).toBe(false);
    scores()[1].reply.reject(new Error("new date failed")); await settle();
    const failed = render(nextProps);
    expect(failed.some(node => node.type === EmptyState)).toBe(true);
    expect(failed.some(node => node.type === PlannedFixtureSection || node.type === ScheduleEmptyNavigation)).toBe(false);
  });
});

describe("scores belong to the selected timezone scope", () => {
  it.each([
    ["America/New_York", "Asia/Shanghai"],
    [undefined, "America/New_York"],
    ["America/New_York", undefined],
  ])("hides same-date scores before changing %s to %s and does not reuse them on failure", async (oldZone, newZone) => {
    const props = { initialGames: [game("old-zone", 2)], timeZone: oldZone, isToday: true };
    expect(cardIds(render(props))).toEqual(["old-zone"]);
    // Neither explicit nor implicit initial data requires browser timezone
    // discovery during the SSR-compatible first render.
    expect(runtime.localTz).not.toHaveBeenCalled();
    const changedProps = { ...props, timeZone: newZone };
    const changed = render(changedProps);
    expect(isLoading(changed)).toBe(true);
    expect(cards(changed)).toHaveLength(0);
    expect(changed.some(node => node.type === ScoreTicker || node.type === LiveScoreRefresher)).toBe(false);
    expect(scores()[0].url).toBe(`/api/games?date=2026-03-01&tz=${encodeURIComponent(newZone ?? "Pacific/Auckland")}&navigation=1`);

    scores()[0].reply.reject(new Error("new zone unavailable")); await settle();
    const failed = render(changedProps);
    expect(cards(failed)).toHaveLength(0);
    expect(hasRefreshError(failed)).toBe(false);
    const error = failed.find(node => node.type === EmptyState)!;
    expect(error.props.title).toBe(en.home.failedToLoad);
    expect(failed.some(node => node.type === ScoreTicker || node.type === LiveScoreRefresher)).toBe(false);

    (error.props.action as { onClick: () => void }).onClick();
    expect(isLoading(render(changedProps))).toBe(true);
    scores()[1].reply.resolve(response({ data: [game("new-zone", 2)] })); await settle();
    expect(cardIds(render(changedProps))).toEqual(["new-zone"]);
    render(changedProps); expect(scores()).toHaveLength(2);

    const back = render(props);
    expect(isLoading(back)).toBe(true); expect(cards(back)).toHaveLength(0);
    scores()[2].reply.reject(new Error("old zone unavailable")); await settle();
    expect(render(props).some(node => node.type === EmptyState)).toBe(true);
    const forward = render(changedProps);
    expect(cardIds(forward)).toEqual(["new-zone"]);
    expect(hasRefreshError(forward)).toBe(false);
    expect(forward.some(node => node.type === EmptyState)).toBe(false);
  });

  it.each([false, true])("does not borrow an old-zone error on the pre-effect render (cached scores: %s)", async hasScores => {
    const props = { timeZone: "America/New_York", ...(hasScores ? { initialGames: [game("old-zone", 2)], isToday: true } : {}) };
    const first = render(props);
    if (hasScores) refresh(first);
    scores()[0].reply.reject(new Error("old zone failed")); await settle();
    render(props);
    const changed = render({ ...props, timeZone: "Asia/Shanghai" });
    expect(isLoading(changed)).toBe(true);
    expect(cards(changed)).toHaveLength(0);
    expect(hasRefreshError(changed)).toBe(false);
    expect(changed.some(node => node.type === EmptyState)).toBe(false);
  });

  it.each(["pending", "loaded", "failed"])("ignores stale zone bodies and errors while the latest same-day scope is %s", async currentState => {
    const props = { initialGames: [game("initial-zone", 2)], timeZone: "America/New_York", isToday: true };
    const body = deferred();
    refresh(render(props)); scores()[0].reply.resolve(response(body.promise)); await settle();
    render({ ...props, timeZone: "Asia/Shanghai" });
    const latestProps = { ...props, timeZone: "UTC" };
    render(latestProps);
    expect(scores().slice(0, 2).every(call => call.signal.aborted)).toBe(true);
    if (currentState === "loaded") scores()[2].reply.resolve(response({ data: [game("latest-zone", 2)] }));
    if (currentState === "failed") scores()[2].reply.reject(new Error("latest zone failed"));
    await settle();

    body.resolve({ data: [game("late-old-zone", 2)] });
    scores()[1].reply.reject(new Error("late superseded failure")); await settle();
    const view = render(latestProps);
    expect(cardIds(view)).toEqual(currentState === "loaded" ? ["latest-zone"] : []);
    expect(isLoading(view)).toBe(currentState === "pending");
    expect(hasRefreshError(view)).toBe(false);
    expect(view.some(node => node.type === EmptyState)).toBe(currentState === "failed");
    if (currentState !== "loaded") expect(view.some(node => node.type === ScoreTicker || node.type === LiveScoreRefresher)).toBe(false);
  });

  it.each(["en", "zh"] as const)("renders the full network error description in %s", async locale => {
    runtime.locale = locale;
    render(); scores()[0].reply.reject(new Error("offline")); await settle();
    const error = render().find(node => node.type === EmptyState)!;
    expect(error.props.title).toBe(getTranslations(locale).home.failedToLoad);
    expect(error.props.description).toBe(locale === "zh" ? "网络可能较慢，或数据源暂时不可用。" : "Network may be slow or the data source is temporarily unavailable.");
  });
});

describe('ESPN scores remain separate from NBA identities', () => {
  const espn = () => ({ source: 'espn', state: 'ready', date: '2026-10-05', timeZone: 'Asia/Shanghai', retrievedAtUTC: '2026-10-05T05:19:00Z', games: [{
    source: 'espn', eventId: '401914127', key: 'espn:401914127', tipoffUTC: '2026-10-04T23:00:00Z', seasonYear: 2027, seasonType: 1, status: 'live', statusText: 'Q2',
    home: { id: '7', name: 'Denver Nuggets', abbreviation: 'DEN', tricode: 'DEN', score: 97 }, away: { id: '26', name: 'Utah Jazz', abbreviation: 'UTAH', tricode: 'UTA', score: 109 },
    sourceUrl: 'https://www.espn.com/nba/game/_/gameId/401914127/jazz-nuggets',
  }] });
  const props = { selectedDate: '2026-10-05', timeZone: 'Asia/Shanghai', isToday: true };
  it('shows fallback, enables existing live refresh, and never supplies ESPN IDs to NBA widgets', async () => {
    render(props); scores()[0].reply.resolve(response({ data: [], espn: espn() })); await settle();
    const view = render(props); expect(view.some(node => node.type === EspnScoreboard)).toBe(true);
    expect(view.some(node => node.type === GameCard || node.type === ScoreTicker || node.type === TodayStars || node.type === PlannedFixtureSection)).toBe(false);
    expect(view.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
    expect(view.some(node => String(node.props.href).startsWith('/game/'))).toBe(false);
  });
  it('hides fallback immediately on date/timezone changes and ignores late old responses', async () => {
    render(props); scores()[0].reply.resolve(response({ data: [], espn: espn() })); await settle();
    expect(render(props).some(node => node.type === EspnScoreboard)).toBe(true);
    const next = { ...props, timeZone: 'America/New_York' };
    expect(render(next).some(node => node.type === EspnScoreboard)).toBe(false);
    scores()[1].reply.resolve(response({ data: [], espn: espn() })); await settle();
    expect(render(next).some(node => node.type === EspnScoreboard)).toBe(false);
  });
  it('retains same-scope ESPN scores through a failed refresh and lets recovered canonical data take precedence', async () => {
    render(props); scores()[0].reply.resolve(response({ data: [], espn: espn() })); await settle();
    refresh(render(props)); scores()[1].reply.reject(new Error('offline')); await settle();
    const failed = render(props); expect(failed.some(node => node.type === EspnScoreboard)).toBe(true); expect(failed.some(node => String(node.props.children).includes('last successfully retrieved ESPN'))).toBe(true);
    refresh(failed); scores()[2].reply.resolve(response({ data: [game('0012600010', 3)], espn: espn() })); await settle();
    const recovered = render(props); expect(cardIds(recovered)).toEqual(['0012600010']); expect(recovered.some(node => node.type === EspnScoreboard)).toBe(false);
  });
});

it('retains source scores on an HTTP-200 unavailable refresh, marks them stale, and keeps live polling', async () => {
  const props = { selectedDate: '2026-10-05', timeZone: 'Asia/Shanghai', isToday: false };
  const provider = { source: 'espn', state: 'ready', date: props.selectedDate, timeZone: props.timeZone, retrievedAtUTC: '2026-10-05T05:19:00Z', games: [{ source: 'espn', eventId: '401914127', key: 'espn:401914127', tipoffUTC: '2026-10-04T23:00:00Z', seasonYear: 2027, seasonType: 1, status: 'live', statusText: 'Q2', home: { id: '7', name: 'Denver Nuggets', abbreviation: 'DEN', tricode: 'DEN', score: 97 }, away: { id: '26', name: 'Utah Jazz', abbreviation: 'UTAH', tricode: 'UTA', score: 109 }, sourceUrl: null }] };
  render(props); scores()[0].reply.resolve(response({ data: [], espn: provider })); await settle();
  expect(render(props).find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
  refresh(render(props)); scores()[1].reply.resolve(response({ data: [], espn: { ...provider, state: 'unavailable', games: [] } })); await settle();
  const stale = render(props); expect(stale.find(node => node.type === EspnScoreboard)?.props.view).toEqual(provider);
  expect(stale.find(node => node.type === LiveScoreRefresher)?.props.hasLiveGames).toBe(true);
  expect(stale.some(node => String(node.props.children).includes('last successfully retrieved ESPN'))).toBe(true);
});
it('offers retry and keeps navigation when providers are unavailable on the first load', async () => {
  const props = { selectedDate: '2026-10-05', timeZone: 'Asia/Shanghai', isToday: true };
  const provider = { source: 'espn', state: 'unavailable', date: props.selectedDate, timeZone: props.timeZone, retrievedAtUTC: '2026-10-05T05:19:00Z', games: [] };
  const navigation = { availableFrom: '2025-10-03', availableThrough: '2026-06-14', latestFinalDate: '2026-06-14', nextScheduledDate: null };
  render(props); scores()[0].reply.resolve(response({ data: [], espn: provider, navigation })); await settle();
  const failed = render(props); expect(failed.some(node => node.type === EspnScoreboard)).toBe(true);
  expect(failed.find(node => node.type === ScheduleEmptyNavigation)?.props.navigation).toEqual(navigation);
  const retry = failed.find(node => node.type === 'button' && node.props.children === en.common.retry)!;
  expect(retry).toBeDefined(); (retry.props.onClick as () => void)(); expect(scores()).toHaveLength(2);
});
