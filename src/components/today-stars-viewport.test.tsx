import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import { localToday, localTz, dateInTz } from "@/lib/timezone";

// This harness commits refs/effects and can replay effect cleanup like Strict Mode.
const runtime = vi.hoisted(() => ({ index: 0, slots: [] as unknown[], effects: [] as (() => void)[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = typeof initial === "function" ? initial() : initial;
    return [runtime.slots[index], (value: unknown) => { runtime.slots[index] = typeof value === "function" ? value(runtime.slots[index]) : value; }];
  },
  useRef: (initial: unknown) => { const index = runtime.index++; return runtime.slots[index] ?? (runtime.slots[index] = { current: initial }); },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const index = runtime.index++;
    const old = runtime.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) runtime.effects.push(() => {
      old?.cleanup?.(); runtime.slots[index] = { deps, run, cleanup: run() };
    });
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: en }) }));
import TodayStars from "./TodayStars";
import PlayerHeadshot from "./PlayerHeadshot";

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
const sentinel = {} as Element;
function render() {
  runtime.index = 0; const tree = TodayStars();
  for (const node of nodes(tree)) if (node.props.ref) (node.props.ref as { current: unknown }).current = sentinel;
  runtime.effects.splice(0).forEach(run => run());
  return nodes(tree);
}
function unmount() { runtime.slots.forEach(slot => (slot as { cleanup?: () => void } | undefined)?.cleanup?.()); }
function restartEffects() {
  for (const slot of runtime.slots) {
    const effect = slot as { run?: () => (() => void) | void; cleanup?: () => void } | undefined;
    if (effect?.run) { effect.cleanup?.(); effect.cleanup = effect.run() || undefined; }
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
const response = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) }) as Response;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let observers: MockObserver[];
class MockObserver {
  observe = vi.fn(); disconnect = vi.fn();
  constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) { observers.push(this); }
  intersect(isIntersecting = true) { this.callback([{ isIntersecting, target: sentinel } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}
const player = (personId: number, points: number, overrides = {}) => ({ personId, nameI: `Player ${personId}`, played: "1", statistics: { points, reboundsTotal: 10, assists: 8 }, ...overrides });
const box = (gameId = "first", points = 30) => ({ game: {
  gameId,
  homeTeam: { teamTricode: "LAL", teamId: 1610612747, players: [player(1, points), player(2, 99, { played: "0" })] },
  awayTeam: { teamTricode: "GSW", teamId: 1610612744, players: [player(3, points - 1)] },
} });
const game = (gameId = "first", gameStatus = 3) => ({ gameId, gameStatus });
let calls: { url: string; signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }[];
beforeEach(() => {
  runtime.index = 0; runtime.slots = []; runtime.effects = []; observers = []; calls = [];
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-01T02:00:00Z"));
  vi.stubEnv("TZ", "Pacific/Auckland");
  vi.stubGlobal("IntersectionObserver", MockObserver);
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const reply = deferred<Response>(); calls.push({ url, signal: init.signal as AbortSignal, reply }); return reply.promise;
  }));
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("near-viewport TodayStars request boundary", () => {
  it("renders an invisible stable sentinel and makes no request before near-viewport intersection", () => {
    const view = render(); expect(view[0].type).toBe("div"); expect(view[0].props["aria-hidden"]).toBe("true");
    expect(observers).toHaveLength(1); expect(observers[0].options).toEqual({ rootMargin: "300px 0px" });
    expect(observers[0].observe).toHaveBeenCalledExactlyOnceWith(sentinel);
    observers[0].intersect(false); render(); expect(fetch).not.toHaveBeenCalled(); expect(observers).toHaveLength(1);
  });
  it("activates once despite repeated/queued intersections and unrelated rerenders", async () => {
    render(); observers[0].intersect(); observers[0].intersect(); render(); expect(calls).toHaveLength(1);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    calls[0].reply.resolve(response({ data: [game()] })); await settle(); calls[1].reply.resolve(response(box())); await settle();
    const view = render(); expect(view[0].type).toBe("section");
    expect(view.find(node => node.type === PlayerHeadshot)?.props).toMatchObject({ personId: 1, name: "Player 1" });
    observers[0].intersect(); render(); expect(calls).toHaveLength(2);
  });
  it("uses browser-local today/timezone at activation, including after local midnight", () => {
    render();
    expect(localTz()).toBe("Pacific/Auckland"); expect(localToday()).toBe("2026-03-01");
    expect(dateInTz(new Date(), "America/New_York")).toBe("2026-02-28");
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z")); observers[0].intersect();
    expect(localToday()).toBe("2026-03-02");
    expect(calls[0].url).toBe("/api/games?date=2026-03-02&tz=Pacific%2FAuckland");
    expect(calls[0].url).not.toContain("navigation=1");
  });
  it("keeps source-order first four finals, existing endpoints, per-game scorer selection and descending display", async () => {
    render(); observers[0].intersect();
    calls[0].reply.resolve(response({ data: [game("scheduled", 1), game("live", 2), ...["first", "second", "third", "fourth", "fifth"].map(id => game(id))] })); await settle();
    expect(calls.slice(1).map(call => call.url)).toEqual(["first", "second", "third", "fourth"].map(id => `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`));
    expect(calls.every(call => call.signal === calls[0].signal)).toBe(true);
    const first = box("first", 30), second = box("second", 40), third = box("third", 20), fourth = box("fourth", 50);
    // Equal points retain the original home-first strict-greater tie behavior.
    first.game.awayTeam.players = [player(31, 30)];
    second.game.homeTeam.players = [player(12, 40)]; second.game.awayTeam.players = [player(32, 45)];
    third.game.homeTeam.players = [player(13, 20)]; fourth.game.homeTeam.players = [player(14, 50)];
    [first, second, third, fourth].forEach((data, index) => calls[index + 1].reply.resolve(response(data))); await settle();
    const view = render();
    expect(view.filter(node => node.type === PlayerHeadshot).map(node => node.props.personId)).toEqual([14, 32, 1, 13]);
    expect(view.filter(node => typeof node.props.href === "string").map(node => node.props.href)).toEqual(["/game/fourth", "/game/second", "/game/first", "/game/third"]);
    expect(calls).toHaveLength(5);
  });
  it("falls back to one immediate load when IntersectionObserver is unsupported", () => {
    vi.stubGlobal("IntersectionObserver", undefined); render(); render();
    expect(observers).toHaveLength(0); expect(calls).toHaveLength(1); unmount(); expect(calls[0].signal.aborted).toBe(true);
  });
  it("cleanup disconnects and prevents a queued observer from starting requests", () => {
    render(); unmount(); observers[0].intersect(); expect(observers[0].disconnect).toHaveBeenCalled(); expect(calls).toHaveLength(0);
  });
  it("an aborted scoreboard body cannot launch box score requests", async () => {
    const body = deferred(); render(); observers[0].intersect(); calls[0].reply.resolve(response(body.promise)); await settle();
    unmount(); body.resolve({ data: [game()] }); await settle(); expect(calls).toHaveLength(1); expect(calls[0].signal.aborted).toBe(true);
  });
  it("unmount aborts all pending boxes and ignores their late JSON without changing stars", async () => {
    render(); observers[0].intersect(); calls[0].reply.resolve(response({ data: [game("one"), game("two")] })); await settle();
    const bodies = [deferred(), deferred()]; bodies.forEach((body, i) => calls[i + 1].reply.resolve(response(body.promise))); await settle();
    unmount(); const before = [...runtime.slots]; bodies.forEach(body => body.resolve(box())); await settle();
    expect(calls.every(call => call.signal.aborted)).toBe(true); expect(runtime.slots).toEqual(before);
  });
  it("a fresh remount gets a fresh observer without reusing or reviving old work", () => {
    render(); observers[0].intersect(); unmount(); runtime.slots = []; render();
    observers[0].intersect(); expect(calls).toHaveLength(1); observers[1].intersect();
    expect(calls).toHaveLength(2); expect(calls[0].signal.aborted).toBe(true); expect(calls[1].signal.aborted).toBe(false);
  });
  it("effect cleanup and restart remains activatable without duplicate live requests", () => {
    render(); observers[0].intersect(); restartEffects();
    observers[0].intersect(); expect(calls).toHaveLength(1); observers[1].intersect();
    expect(calls).toHaveLength(2); expect(calls.filter(call => !call.signal.aborted)).toHaveLength(1);
  });
  it.each(["empty", "no-finals", "HTTP", "malformed-JSON"])("keeps the widget silent for %s without later observer retries", async result => {
    render(); observers[0].intersect();
    if (result === "HTTP") calls[0].reply.resolve(response(null, false));
    else if (result === "malformed-JSON") calls[0].reply.resolve({ ok: true, json: async () => { throw new Error("bad JSON"); } } as unknown as Response);
    else calls[0].reply.resolve(response({ data: result === "empty" ? [] : [game("live", 2)] }));
    await settle(); expect(render()[0].type).toBe("div"); observers[0].intersect(); expect(calls).toHaveLength(1);
  });
});
