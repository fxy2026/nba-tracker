import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
import type { ScheduleGame } from "@/lib/api";

type Effect = { deps: unknown[]; cleanup?: () => void };
type Owner = { slots: unknown[]; mounted: boolean };
// Resolve the real HomeClient -> GamesList/HomeExtra composition with keyed
// component lifetimes, refs before effects, and cleanup when an owner disappears.
// Child widgets and browser navigation are boundaries, not a full DOM/App Router.
const runtime = vi.hoisted(() => ({
  owners: new Map<string, Owner>(), owner: null as Owner | null, index: 0,
  effects: [] as (() => void)[], dirty: false, lateSetters: 0,
  search: new URLSearchParams(), locale: "en" as "en" | "zh",
}));
vi.mock("react", async original => {
  const slot = () => ({ owner: runtime.owner!, index: runtime.index++ });
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (make: () => unknown, deps: unknown[]) => {
    const { owner, index } = slot();
    const old = owner.slots[index] as { deps: unknown[]; value: unknown } | undefined;
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
    useMemo: memo,
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useEffect: (run: () => void | (() => void), deps: unknown[]) => {
      const { owner, index } = slot();
      const old = owner.slots[index] as Effect | undefined;
      if (!old || !same(old.deps, deps)) {
        const effect: Effect = { deps };
        owner.slots[index] = effect;
        runtime.effects.push(() => { old?.cleanup?.(); effect.cleanup = run() || undefined; });
      }
    },
  };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => runtime.search, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale) }) }));
vi.mock("@/lib/timezone", () => ({ localTz: () => "America/New_York", dateInTz: () => "2026-10-04" }));
import HomeClient from "./HomeClient";
import GamesList from "./GamesList";
import HomeExtra from "./HomeExtra";
import DateNav from "./DateNav";
import GameCard from "./GameCard";
import RecentHighlights from "./RecentHighlights";
import EmptyState from "./EmptyState";

const components = [HomeClient, GamesList, HomeExtra];
type Node = ReactElement<Record<string, unknown>>;
let props: ComponentProps<typeof HomeClient>;
let view: { node: Node; owner: string }[];
let live: Set<string>;
let observers: Observer[];
class Observer {
  disconnected = false;
  target?: object;
  constructor(public callback: (entries: { isIntersecting: boolean }[]) => void, public options: IntersectionObserverInit) { observers.push(this); }
  observe(target: object) { this.target = target; }
  disconnect() { this.disconnected = true; }
  notify(isIntersecting: boolean) { if (!this.disconnected) this.callback([{ isIntersecting }]); }
}
function cleanup(owner: Owner) {
  owner.mounted = false;
  for (const slot of owner.slots) (slot as Effect | undefined)?.cleanup?.();
}
function resolve(node: ReactNode, path: string, parent = "") {
  if (Array.isArray(node)) { node.forEach((child, i) => resolve(child, `${path}.${i}`, parent)); return; }
  if (!isValidElement<Record<string, unknown>>(node)) return;
  view.push({ node, owner: parent });
  if (components.some(component => node.type === component)) {
    const component = node.type as (props: Record<string, unknown>) => ReactNode;
    const key = `${path}:${component.name}:${node.key ?? ""}`;
    live.add(key);
    let owner = runtime.owners.get(key);
    if (!owner) { owner = { slots: [], mounted: true }; runtime.owners.set(key, owner); }
    runtime.owner = owner; runtime.index = 0;
    resolve(component(node.props), `${key}.child`, component.name);
    return;
  }
  const ref = node.props.ref;
  if (ref && typeof ref === "object" && "current" in ref) (ref as { current: unknown }).current ??= {};
  resolve(node.props.children as ReactNode, `${path}.child`, parent);
}
function render() {
  runtime.dirty = true;
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 25) throw new Error("Component effects did not settle");
    runtime.dirty = false; view = []; live = new Set();
    resolve(<HomeClient {...props} />, "root");
    for (const [key, owner] of runtime.owners) if (!live.has(key)) { cleanup(owner); runtime.owners.delete(key); }
    runtime.effects.splice(0).forEach(run => run());
  }
  return view;
}
function unmount() { runtime.owners.forEach(cleanup); runtime.owners.clear(); }
async function settle() { for (let i = 0; i < 16; i++) await Promise.resolve(); render(); }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
let calls: { url: string; signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }[];
const extras = () => calls.filter(call => call.url === "/api/extra");
const scores = () => calls.filter(call => call.url.startsWith("/api/games?"));
const nodes = (owner?: string) => view.filter(item => !owner || item.owner === owner).map(item => item.node);
const recent = () => nodes("HomeExtra").find(node => node.type === RecentHighlights)?.props.games;
const cardIds = () => nodes("GamesList").filter(node => node.type === GameCard).map(node => (node.props.game as ScheduleGame).gameId);
const extraPlaceholder = () => nodes("HomeExtra").find(node => node.props.className === "mt-10 space-y-6");
const response = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) }) as Response;
const game = (gameId: string): ScheduleGame => ({
  gameId, gameStatus: 3, gameStatusText: "Final", gameCode: "20261004/LALBOS", gameDateTimeUTC: "2026-10-04T19:00:00Z",
  homeTeam: { teamId: 1610612747, teamTricode: "LAL", teamName: "Lakers", teamCity: "Los Angeles", teamSlug: "lakers", score: 120 },
  awayTeam: { teamId: 1610612738, teamTricode: "BOS", teamName: "Celtics", teamCity: "Boston", teamSlug: "celtics", score: 90 },
});
function navigate(date: string, tz?: string) {
  runtime.search = new URLSearchParams({ date, ...(tz ? { tz } : {}) });
  render();
}
function reveal() { observers.forEach(observer => observer.notify(true)); render(); }
async function loadExtra() {
  reveal(); extras()[0].reply.resolve(response({ playoffs: [], recent: [game("highlight")] })); await settle();
}

beforeEach(() => {
  runtime.owners = new Map(); runtime.owner = null; runtime.index = 0; runtime.effects = [];
  runtime.dirty = false; runtime.lateSetters = 0; runtime.locale = "en";
  runtime.search = new URLSearchParams({ date: "2026-10-04" });
  props = { initialDate: "2026-10-04", initialIsToday: true, initialGames: [game("seed")] };
  view = []; observers = []; calls = [];
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    if (url !== "/api/extra" && !url.startsWith("/api/games?")) throw new Error(`Unexpected request: ${url}`);
    const reply = deferred<Response>(); calls.push({ url, signal: init.signal as AbortSignal, reply }); return reply.promise;
  }));
});
afterEach(() => { unmount(); expect(runtime.lateSetters).toBe(0); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["en", "zh"] as const)("keeps the unchanged viewport gate and placeholder through pre-visibility navigation (%s)", locale => {
  runtime.locale = locale; render();
  expect(calls).toHaveLength(0);
  expect(extraPlaceholder()?.props.style).toEqual({ minHeight: 400 });
  expect(observers).toHaveLength(1);
  expect(observers[0].options).toEqual({ rootMargin: "400px 0px 400px 0px" });
  expect(observers[0].target).toBeDefined();
  observers[0].notify(false); render();
  navigate("2026-10-05"); navigate("2026-10-06", "Asia/Shanghai");
  expect(extras()).toHaveLength(0);
  expect(observers).toHaveLength(1);
  expect(observers[0].disconnected).toBe(false);
  reveal(); reveal();
  expect(extras()).toHaveLength(1);
  expect(observers[0].disconnected).toBe(true);
});

it("requests extras once across initial load and two completed date changes", async () => {
  render(); await loadExtra();
  const counts = [extras().length];
  for (const date of ["2026-10-05", "2026-10-06"]) {
    // Exercise the real controlled date callback before the URL catches up.
    (nodes().find(node => node.type === DateNav)!.props.onDateChange as (date: string) => void)(date);
    render();
    expect(recent()).toEqual([game("highlight")]);
    expect(extraPlaceholder()).toBeUndefined();
    navigate(date);
    scores().at(-1)!.reply.resolve(response({ data: [game(date)] })); await settle(); reveal();
    expect(cardIds()).toEqual([date]); counts.push(extras().length);
  }
  expect(counts).toEqual([1, 1, 1]);
  expect(scores()).toHaveLength(2);
  expect(nodes("HomeExtra").find(node => node.props.className === "mt-10 space-y-10")?.props.style)
    .toEqual({ contentVisibility: "auto", containIntrinsicSize: "auto 400px" });
});

it("lets viewport-visible extras complete while initial games are pending, failed, and retried", async () => {
  props.initialGames = undefined; render();
  expect(scores()).toHaveLength(1); expect(extras()).toHaveLength(0);
  await loadExtra();
  expect(cardIds()).toEqual([]); expect(recent()).toEqual([game("highlight")]);
  scores()[0].reply.reject(new Error("score failure")); await settle();
  const failure = nodes("GamesList").find(node => node.type === EmptyState)!;
  expect(failure).toBeDefined(); expect(recent()).toEqual([game("highlight")]);
  (failure.props.action as { onClick: () => void }).onClick(); render();
  scores()[1].reply.resolve(response({ data: [game("recovered")] })); await settle();
  expect(cardIds()).toEqual(["recovered"]); expect(extras()).toHaveLength(1);
});

it("retains both bracket and recent-highlight inputs without an added wrapper", async () => {
  render(); reveal();
  const data = { playoffs: [game("playoff")], recent: [game("highlight")] };
  extras()[0].reply.resolve(response(data)); await settle();
  for (const date of ["2026-10-04", "2026-10-05"]) {
    navigate(date);
    const content = nodes("HomeExtra");
    expect(content[0].type).toBe("div");
    expect(content[0].props.className).toBe("mt-10 space-y-10");
    const children = content[0].props.children as Node[];
    expect(children).toHaveLength(2);
    expect(children[0].props.games).toBe(data.playoffs);
    expect(children[1].type).toBe(RecentHighlights);
    expect(children[1].props.games).toBe(data.recent);
  }
  expect(extras()).toHaveLength(1);
});

it("keeps pending extras alive while rapid date/timezone requests abort and stale results arrive", async () => {
  render(); reveal();
  navigate("2026-10-05");
  const oldBody = deferred<unknown>();
  scores()[0].reply.resolve(response(oldBody.promise)); await settle();
  navigate("2026-10-06", "America/New_York");
  navigate("2026-10-07", "Asia/Shanghai");
  expect(scores().slice(0, -1).every(call => call.signal.aborted)).toBe(true);
  expect(extras()).toHaveLength(1); expect(extras()[0].signal.aborted).toBe(false);
  const current = scores().at(-1)!;
  expect(current.url).toContain("date=2026-10-07&tz=Asia%2FShanghai");
  current.reply.resolve(response({ data: [game("current")] }));
  oldBody.resolve({ data: [game("stale")] });
  scores()[1].reply.reject(new Error("old zone failure"));
  extras()[0].reply.resolve(response({ playoffs: [], recent: [game("independent")] })); await settle();
  expect(cardIds()).toEqual(["current"]); expect(recent()).toEqual([game("independent")]);
  expect(nodes("GamesList").some(node => node.type === EmptyState)).toBe(false);
  expect(extras()[0].signal.aborted).toBe(false);
});

it("preserves loaded extras through URL Back/Forward date and timezone history", async () => {
  render(); await loadExtra();
  // App Router supplies new search params to the same HomeClient on history
  // travel. Exercise its actual URL-sync effect, including GamesList's zone key.
  const history: [string, string?][] = [
    ["2026-10-05"], ["2026-10-06", "Asia/Shanghai"],
    ["2026-10-05"], ["2026-10-04"], // Back twice
    ["2026-10-05"], ["2026-10-06", "Asia/Shanghai"], // Forward twice
  ];
  for (const [date, zone] of history) {
    navigate(date, zone);
    scores().at(-1)!.reply.resolve(response({ data: [game(`${date}:${zone ?? "local"}`)] })); await settle();
    expect(recent()).toEqual([game("highlight")]);
    expect(nodes().find(node => node.type === DateNav)?.props.selectedDate).toBe(date);
  }
  const count = scores().length; render();
  expect(scores()).toHaveLength(count); expect(extras()).toHaveLength(1); expect(observers).toHaveLength(1);
});

it.each(["reject", "http-error", "empty"])("does not retry terminal extra %s on date/timezone navigation", async kind => {
  render(); reveal();
  if (kind === "reject") extras()[0].reply.reject(new Error("extras unavailable"));
  else extras()[0].reply.resolve(response({ playoffs: [], recent: [] }, kind !== "http-error"));
  await settle();
  expect(nodes("HomeExtra")).toHaveLength(0);
  navigate("2026-10-05"); navigate("2026-10-04", "America/New_York"); navigate("2026-10-04");
  expect(extras()).toHaveLength(1); expect(nodes("HomeExtra")).toHaveLength(0);
});

it.each(["fetch", "body"])("aborts extras only on actual home unmount and ignores late %s results", async phase => {
  render(); reveal();
  const body = deferred<unknown>();
  if (phase === "body") { extras()[0].reply.resolve(response(body.promise)); await settle(); }
  navigate("2026-10-05"); expect(extras()[0].signal.aborted).toBe(false);
  unmount();
  expect(extras()[0].signal.aborted).toBe(true); expect(scores()[0].signal.aborted).toBe(true);
  if (phase === "body") body.resolve({ playoffs: [], recent: [game("late")] });
  else extras()[0].reply.resolve(response({ playoffs: [], recent: [game("late")] }));
  for (let i = 0; i < 16; i++) await Promise.resolve();
  expect(runtime.lateSetters).toBe(0);
  render(); expect(extras()).toHaveLength(1); reveal(); expect(extras()).toHaveLength(2);
});

it("keeps the existing 800ms fallback across navigation and cancels it on unmount", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(); vi.advanceTimersByTime(500); navigate("2026-10-05");
  vi.advanceTimersByTime(299); render(); expect(extras()).toHaveLength(0);
  vi.advanceTimersByTime(1); render(); expect(extras()).toHaveLength(1);
  unmount(); render(); vi.advanceTimersByTime(799); unmount(); vi.advanceTimersByTime(1);
  expect(extras()).toHaveLength(1); expect(runtime.lateSetters).toBe(0);
});
