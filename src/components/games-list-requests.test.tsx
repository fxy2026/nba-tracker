import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import type { ScheduleGame } from "@/lib/api";

// Deterministic component hook/commit harness. Browser QA is a separate gate.
const runtime = vi.hoisted(() => ({ index: 0, slots: [] as unknown[], effects: [] as (() => void)[] }));
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
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: en }) }));
vi.mock("@/lib/timezone", () => ({ localTz: () => "Pacific/Auckland" }));
import GamesList from "./GamesList";
import GameCard from "./GameCard";
import LiveScoreRefresher from "./LiveScoreRefresher";
import TodayStars from "./TodayStars";
import EmptyState from "./EmptyState";

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
const refresh = (view: ReturnType<typeof render>) => (view.find(node => node.type === LiveScoreRefresher)!.props.onRefresh as () => void)();
beforeEach(() => {
  runtime.index = 0; runtime.slots = []; runtime.effects = []; calls = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const reply = deferred<Response>(); calls.push({ url, signal: init.signal as AbortSignal, reply }); return reply.promise;
  }));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("independent optional replay loading", () => {
  it.each(["response", "JSON"])("renders valid scores while replay %s stays pending", async pending => {
    render();
    if (pending === "JSON") replays()[0].reply.resolve(response(deferred().promise));
    scores()[0].reply.resolve(response({ data: [game("final", 3), game("upcoming", 1), game("live", 2)] }));
    await settle();
    expect(cards(render()).map(node => (node.props.game as ScheduleGame).gameId)).toEqual(["live", "upcoming", "final"]);
    expect(scores()[0].url).toBe("/api/games?date=2026-03-01&tz=Pacific%2FAuckland&navigation=1");
    expect(scores()[0].signal).toBe(replays()[0].signal);
  });
  it.each(["network", "HTTP", "JSON"])("replay %s failure keeps valid scores and known replay IDs", async failure => {
    render({ initialReplayIds: ["0022500001"] });
    if (failure === "network") replays()[0].reply.reject(new Error("offline"));
    else if (failure === "HTTP") replays()[0].reply.resolve(response(null, false));
    else replays()[0].reply.resolve({ ok: true, json: async () => { throw new Error("bad JSON"); } } as unknown as Response);
    scores()[0].reply.resolve(response({ data: [game()] })); await settle();
    const view = render(); expect(cards(view)).toHaveLength(1); expect(cards(view)[0].props.hasReplay).toBe(true);
    expect(view.some(node => node.type === EmptyState)).toBe(false);
    expect(view.some(node => node.props.children === en.home.refreshFailed)).toBe(false);
  });
  it.each(["success", "failure"])("replay %s never finishes score loading or changes its error state", async result => {
    render();
    if (result === "success") replays()[0].reply.resolve(response({ ids: ["0022500001"] }));
    else replays()[0].reply.reject(new Error("optional failure"));
    await settle(); const view = render();
    expect(cards(view)).toHaveLength(0); expect(view.some(node => node.type === EmptyState)).toBe(false);
    expect(view.some(node => String(node.props.className).includes("skeleton-shimmer"))).toBe(true);
  });
  it("late replay IDs can update cards without another scoreboard fetch", async () => {
    render(); scores()[0].reply.resolve(response({ data: [game()] })); await settle();
    expect(cards(render())[0].props.hasReplay).toBe(false);
    replays()[0].reply.resolve(response({ ids: ["0022500001"] })); await settle();
    expect(cards(render())[0].props.hasReplay).toBe(true); expect(scores()).toHaveLength(1);
  });
  it("late old-date score and replay JSON never overwrite the newer date", async () => {
    const oldGames = deferred(), oldReplay = deferred();
    render(); scores()[0].reply.resolve(response(oldGames.promise)); replays()[0].reply.resolve(response(oldReplay.promise)); await settle();
    const props = { selectedDate: "2026-03-02", timeZone: "America/New_York" };
    render(props); expect(calls.slice(0, 2).every(call => call.signal.aborted)).toBe(true);
    scores()[1].reply.resolve(response({ data: [game("new")] })); replays()[1].reply.resolve(response({ ids: ["new"] })); await settle();
    oldGames.resolve({ data: [game("old")] }); oldReplay.resolve({ ids: ["old"] }); await settle();
    const view = cards(render(props)); expect(view.map(node => (node.props.game as ScheduleGame).gameId)).toEqual(["new"]);
    expect(view[0].props.hasReplay).toBe(true); expect(scores()[1].url).toContain("tz=America%2FNew_York");
  });
  it("a newer refresh aborts both old requests and keeps the same replay cadence", async () => {
    const props = { initialGames: [game("live", 2)], isToday: true };
    refresh(render(props)); refresh(render(props));
    expect(scores()).toHaveLength(2); expect(replays()).toHaveLength(2); expect(calls.slice(0, 2).every(call => call.signal.aborted)).toBe(true);
    scores()[1].reply.resolve(response({ data: [game("new", 2)] })); replays()[1].reply.resolve(response({ ids: ["new"] })); await settle();
    scores()[0].reply.reject(new Error("late failure")); replays()[0].reply.resolve(response({ ids: ["old"] })); await settle();
    const view = render(props); expect(cards(view)[0].props.hasReplay).toBe(true); expect(view.some(node => node.props.children === en.home.refreshFailed)).toBe(false);
  });
  it("an old score failure cannot dismiss the new date's loading state", async () => {
    render(); render({ selectedDate: "2026-03-02" }); scores()[0].reply.reject(new Error("old failure")); await settle();
    const view = render({ selectedDate: "2026-03-02" });
    expect(cards(view)).toHaveLength(0); expect(view.some(node => node.type === EmptyState)).toBe(false);
    expect(view.some(node => String(node.props.className).includes("skeleton-shimmer"))).toBe(true);
  });
  it("unmount aborts both requests and ignores late bodies without state updates", async () => {
    const games = deferred(), replay = deferred();
    render(); scores()[0].reply.resolve(response(games.promise)); replays()[0].reply.resolve(response(replay.promise)); await settle();
    unmount(); const before = [...runtime.slots]; expect(calls.every(call => call.signal.aborted)).toBe(true);
    games.resolve({ data: [game()] }); replay.resolve({ ids: ["0022500001"] }); await settle(); expect(runtime.slots).toEqual(before);
  });
  it("current games failure shows the existing full error even with replay pending and retry recovers", async () => {
    render(); scores()[0].reply.resolve(response(null, false)); await settle();
    const error = render().find(node => node.type === EmptyState)!; expect(error.props.title).toBe(en.home.failedToLoad);
    (error.props.action as { onClick: () => void }).onClick(); scores()[1].reply.resolve(response({ data: [game()] })); await settle();
    expect(cards(render())).toHaveLength(1); expect(calls.slice(0, 2).every(call => call.signal.aborted)).toBe(true);
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
