import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = { deps: unknown[]; cleanup?: () => void };
// Exercise the page's hooks and async lifetimes. UI children remain boundaries;
// browser layout and Next navigation are intentionally outside this harness.
const runtime = vi.hoisted(() => ({
  slots: [] as unknown[], index: 0, effects: [] as (() => void)[], dirty: false,
  mounted: true, lateSetters: 0, locale: "en" as "en" | "zh",
}));
vi.mock("react", async original => {
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  return {
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
      const index = runtime.index++;
      if (!(index in runtime.slots)) runtime.slots[index] = typeof initial === "function" ? initial() : initial;
      return [runtime.slots[index], (value: unknown) => {
        if (!runtime.mounted) { runtime.lateSetters++; return; }
        const next = typeof value === "function" ? value(runtime.slots[index]) : value;
        if (!Object.is(next, runtime.slots[index])) { runtime.slots[index] = next; runtime.dirty = true; }
      }];
    },
    useMemo: (make: () => unknown, deps: unknown[]) => {
      const index = runtime.index++;
      const old = runtime.slots[index] as { deps: unknown[]; value: unknown } | undefined;
      if (!old || !same(old.deps, deps)) runtime.slots[index] = { deps, value: make() };
      return (runtime.slots[index] as { value: unknown }).value;
    },
    useEffect: (run: () => void | (() => void), deps: unknown[]) => {
      const index = runtime.index++, old = runtime.slots[index] as Effect | undefined;
      if (!old || !same(old.deps, deps)) {
        const effect: Effect = { deps };
        runtime.slots[index] = effect;
        runtime.effects.push(() => { old?.cleanup?.(); effect.cleanup = run() || undefined; });
      }
    },
  };
});
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));

import TransactionsPage from "./page";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";

type Node = ReactElement<Record<string, unknown>>;
let view: Node[];
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as ReactNode)];
}
function render() {
  runtime.dirty = true;
  for (let count = 0; runtime.dirty; count++) {
    if (count > 20) throw new Error("Effects did not settle");
    runtime.dirty = false; runtime.index = 0;
    view = nodes(TransactionsPage());
    runtime.effects.splice(0).forEach(run => run());
  }
}
function unmount() {
  runtime.mounted = false;
  for (const slot of runtime.slots) (slot as Effect | undefined)?.cleanup?.();
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); if (runtime.mounted) render(); }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
let requests: { url: string; signal: AbortSignal; response: ReturnType<typeof deferred<Response>> }[];
const feeds = () => requests.filter(request => request.url === "/api/transactions?limit=150");
const indexes = () => requests.filter(request => request.url === "/api/player-index");
const response = (body: unknown, ok = true) => ({ ok, json: () => Promise.resolve(body) }) as Response;
const transaction = (description = "Signed G Test Player.") => ({
  date: "2026-10-05T18:00:00Z", team: "Los Angeles Lakers", teamAbbr: "LAL", player: "Test Player",
  type: "Transaction", description, players: ["Test Player"], kind: "signed", teamLogo: "",
});
const states = () => view.filter(node => node.type === EmptyState).map(node => node.props as unknown as ComponentProps<typeof EmptyState>);
const loading = () => view.find(node => node.props.role === "status" && node.props["aria-busy"] === "true");
const hasText = (text: string) => view.some(node => node.props.children === text);
const playerLink = () => view.find(node => node.type === Link && node.props.href === "/player/123");
function retry(times = 1) {
  const action = states().find(state => state.tone === "danger")!.action!.onClick!;
  for (let i = 0; i < times; i++) action();
  render();
}
async function resolveFeed(rows = [transaction()]) {
  feeds().at(-1)!.response.resolve(response({ transactions: rows })); await settle();
}

beforeEach(() => {
  runtime.slots = []; runtime.index = 0; runtime.effects = []; runtime.dirty = false;
  runtime.mounted = true; runtime.lateSetters = 0; runtime.locale = "en";
  view = []; requests = [];
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    if (url !== "/api/transactions?limit=150" && url !== "/api/player-index") throw new Error(`Unexpected request: ${url}`);
    const pending = deferred<Response>(); requests.push({ url, signal: init.signal as AbortSignal, response: pending });
    return pending.promise;
  }));
});
afterEach(() => {
  unmount(); expect(runtime.lateSetters).toBe(0); expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers(); vi.unstubAllGlobals();
});

it("shows the feed before the optional index settles, then enriches player names once", async () => {
  render();
  expect(loading()?.props["aria-label"]).toBe("Loading transactions");
  expect(feeds()).toHaveLength(1); expect(indexes()).toHaveLength(0);
  await resolveFeed();
  expect(loading()).toBeUndefined(); expect(states()).toEqual([]);
  expect(hasText("Signed G Test Player.")).toBe(true);
  expect(hasText("Test Player")).toBe(true); expect(playerLink()).toBeUndefined();
  expect(indexes()).toHaveLength(1);
  indexes()[0].response.resolve(response({ data: [{ personId: 123, firstName: "Test", lastName: "Player" }] }));
  await settle();
  expect(playerLink()?.props.children).toBe("Test Player"); expect(vi.getTimerCount()).toBe(0);
  (view.find(node => node.type === "button" && node.props.children === "LAL")!.props.onClick as () => void)(); render();
  expect(hasText("Signed G Test Player.")).toBe(true); expect(indexes()).toHaveLength(1);
});

it.each(["http", "network", "shape", "rows"])("keeps the feed usable when optional index fails: %s", async failure => {
  render(); await resolveFeed();
  const pending = indexes()[0];
  if (failure === "network") pending.response.reject(new Error("Offline"));
  else pending.response.resolve(response(failure === "rows" ? { data: [null, { personId: -1, firstName: "Test", lastName: "Player" }, { personId: 123, firstName: {}, lastName: "Player" }] } : { data: {} }, failure !== "http"));
  await settle();
  expect(hasText("Signed G Test Player.")).toBe(true); expect(loading()).toBeUndefined();
  expect(states()).toEqual([]); expect(playerLink()).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
});

it("bounds optional index body loading without hiding the feed or accepting a late result", async () => {
  render(); await resolveFeed();
  const body = deferred<unknown>();
  indexes()[0].response.resolve({ ok: true, json: () => body.promise } as Response); await settle();
  vi.advanceTimersByTime(12_000); render();
  expect(indexes()[0].signal.aborted).toBe(true); expect(states()).toEqual([]); expect(loading()).toBeUndefined();
  body.resolve({ data: [{ personId: 123, firstName: "Test", lastName: "Player" }] }); await settle();
  expect(playerLink()).toBeUndefined(); expect(hasText("Signed G Test Player.")).toBe(true);
});

it("treats a verified empty response as empty and skips player-index loading", async () => {
  render(); await resolveFeed([]);
  expect(loading()).toBeUndefined(); expect(states()[0].title).toBe("No recent transactions available");
  expect(states()[0].tone).toBeUndefined(); expect(indexes()).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
});

it("preserves optional-row defaults and skips an index that cannot enrich any names", async () => {
  render();
  const { players: _players, kind: _kind, teamLogo: _teamLogo, ...row } = transaction();
  void _players; void _kind; void _teamLogo;
  feeds()[0].response.resolve(response({ transactions: [row] })); await settle();
  expect(hasText(row.description)).toBe(true); expect(hasText(row.player)).toBe(true);
  expect(hasText("Move")).toBe(true); expect(indexes()).toHaveLength(0);
});

it.each([null, {}, { transactions: null }, { transactions: {} }, { transactions: [null] },
  { transactions: [transaction(), { ...transaction(), teamAbbr: {} }] },
  { transactions: [{ ...transaction(), players: [123] }] },
  { transactions: [{ ...transaction(), kind: {} }] },
  { transactions: [{ ...transaction(), teamLogo: [] }] },
])("reports malformed successful payloads instead of an empty feed: %j", async payload => {
  render(); feeds()[0].response.resolve(response(payload)); await settle();
  expect(states()).toHaveLength(1); expect(states()[0].tone).toBe("danger");
  expect(states()[0].title).toBe("Transactions are temporarily unavailable");
  expect(loading()).toBeUndefined(); expect(indexes()).toHaveLength(0);
});

it.each(["http", "network", "json"])("offers retry after a primary %s failure without claiming an empty feed", async failure => {
  render();
  if (failure === "network") feeds()[0].response.reject(new Error("Offline"));
  else if (failure === "json") feeds()[0].response.resolve({ ok: true, json: () => Promise.reject(new Error("Invalid JSON")) } as Response);
  else feeds()[0].response.resolve(response({ transactions: [] }, false));
  await settle();
  expect(states()[0].tone).toBe("danger"); expect(states()[0].action?.label).toBe("Retry");
  expect(indexes()).toHaveLength(0); expect(loading()).toBeUndefined();
  // Repeated activation before React commits still starts only one new request.
  retry(2);
  expect(states()).toEqual([]); expect(loading()).toBeDefined(); expect(feeds()).toHaveLength(2);
  expect(feeds()[0].signal.aborted).toBe(true);
  await resolveFeed();
  expect(hasText("Signed G Test Player.")).toBe(true); expect(states()).toEqual([]);
});

it.each(["headers", "body"])("times out stalled primary %s and ignores its late completion after retry", async stage => {
  render();
  const stale = feeds()[0], body = deferred<unknown>();
  if (stage === "body") { stale.response.resolve({ ok: true, json: () => body.promise } as Response); await settle(); }
  vi.advanceTimersByTime(12_000); render();
  expect(stale.signal.aborted).toBe(true); expect(loading()).toBeUndefined(); expect(states()[0].tone).toBe("danger");
  retry(); await resolveFeed([{ ...transaction("New feed"), players: [] }]);
  if (stage === "headers") stale.response.resolve(response({ transactions: [transaction("Obsolete feed")] }));
  else body.resolve({ transactions: [transaction("Obsolete feed")] });
  await settle();
  expect(hasText("New feed")).toBe(true); expect(hasText("Obsolete feed")).toBe(false);
  expect(states()).toEqual([]); expect(indexes()).toHaveLength(0);
});

it.each(["primary", "index"])("aborts %s work on unmount without late state updates", async stage => {
  render();
  if (stage === "index") await resolveFeed();
  const request = stage === "primary" ? feeds()[0] : indexes()[0];
  unmount();
  expect(request.signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  request.response.resolve(response(stage === "primary" ? { transactions: [transaction()] } : { data: [{ personId: 123, firstName: "Test", lastName: "Player" }] }));
  await settle();
  expect(runtime.lateSetters).toBe(0);
});

it("localizes the loading, failure and retry states in Chinese", async () => {
  runtime.locale = "zh"; render();
  expect(loading()?.props["aria-label"]).toBe("正在加载交易动态");
  feeds()[0].response.reject(new Error("Offline")); await settle();
  expect(states()[0].title).toBe("交易动态暂时不可用"); expect(states()[0].action?.label).toBe("重试");
  expect(states()[0].className).toContain("[&_button]:min-h-11");
  retry(); await resolveFeed([]);
  expect(states()[0].title).toBe("暂无最新交易动态");
});

it.each(["en", "zh"] as const)("keeps mobile team filters touch-sized, wrapped and stateful after retry (%s)", async locale => {
  runtime.locale = locale;
  const group = () => view.find(node => node.props.role === "group" && node.props["aria-label"] === (locale === "zh" ? "按球队筛选" : "Filter by team"));
  const buttons = () => nodes(group()?.props.children as ReactNode).filter(node => node.type === "button");
  const click = (label: string) => { (buttons().find(node => node.props.children === label)!.props.onClick as () => void)(); render(); };
  render(); expect(group()).toBeUndefined();
  feeds()[0].response.reject(new Error("Offline")); await settle();
  expect(group()).toBeUndefined();
  retry(); expect(group()).toBeUndefined();
  await resolveFeed([
    { ...transaction("Lakers move"), players: [] },
    { ...transaction("Celtics move"), team: "Boston Celtics", teamAbbr: "BOS", players: [] },
  ]);
  expect(group()?.props.className).toContain("flex-wrap");
  expect(buttons()).toHaveLength(3);
  for (const button of buttons()) {
    expect(button.props.type).toBe("button");
    expect(button.props.className).toContain("min-h-11 min-w-11");
    expect(button.props.className).toContain("sm:min-h-0 sm:min-w-0");
  }
  const all = locale === "zh" ? "全部" : "All";
  expect(buttons().find(node => node.props.children === all)?.props["aria-pressed"]).toBe(true);
  click("LAL");
  expect(hasText("Lakers move")).toBe(true); expect(hasText("Celtics move")).toBe(false);
  expect(buttons().find(node => node.props.children === "LAL")?.props["aria-pressed"]).toBe(true);
  expect(buttons().find(node => node.props.children === all)?.props["aria-pressed"]).toBe(false);
  click("LAL"); expect(hasText("Celtics move")).toBe(true);
  click("BOS"); expect(hasText("Lakers move")).toBe(false);
  click(all); expect(hasText("Lakers move")).toBe(true); expect(hasText("Celtics move")).toBe(true);
  expect(feeds()).toHaveLength(2); expect(indexes()).toHaveLength(0);
});
