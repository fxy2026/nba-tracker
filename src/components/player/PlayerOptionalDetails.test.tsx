import { readFileSync } from "node:fs";
import { createElement, Fragment, isValidElement, type ComponentProps, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";

type Effect = { deps: unknown[]; run: () => void | (() => void); cleanup?: () => void };
type Instance = { type: unknown; slots: unknown[]; index: number; mounted: boolean };
type LazyState = { component?: ComponentType<Record<string, unknown>>; pending?: Promise<void>; loads: number };
const runtime = vi.hoisted(() => ({
  current: null as Instance | null,
  instances: new Map<string, Instance>(), effects: [] as (() => void)[],
  lazy: [] as LazyState[], writes: 0, lateWrites: 0, locale: "en",
}));

// Deterministic, offline component/commit harness. Each actual component has its
// own hooks; element keys reconcile subtrees and run effect cleanup on unmount.
// This counts fetches in the real data-owning children, not placeholder widgets.
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const instance = runtime.current!;
    const index = instance.index++;
    if (!(index in instance.slots)) instance.slots[index] = typeof initial === "function" ? initial() : initial;
    return [instance.slots[index], (value: unknown) => {
      runtime.writes++;
      if (!instance.mounted) runtime.lateWrites++;
      instance.slots[index] = typeof value === "function" ? value(instance.slots[index]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const instance = runtime.current!, index = instance.index++;
    return instance.slots[index] ?? (instance.slots[index] = { current: initial });
  },
  useEffect: (run: Effect["run"], deps: unknown[]) => {
    const instance = runtime.current!, index = instance.index++;
    const old = instance.slots[index] as Effect | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) runtime.effects.push(() => {
      old?.cleanup?.(); instance.slots[index] = { deps, run, cleanup: run() };
    });
  },
}));
vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return { default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>, options?: { loading?: ComponentType }) => {
    const state: LazyState = { loads: 0 }; runtime.lazy.push(state);
    return function DynamicChild(props: Record<string, unknown>) {
      if (!state.pending) {
        state.loads++;
        state.pending = loader().then(module => { state.component = module.default; });
      }
      return state.component ? createElement(state.component, props) : options?.loading ? createElement(options.loading) : null;
    };
  } };
});
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale, t: runtime.locale === "zh" ? zh : en }) }));
vi.mock("lucide-react", () => ({ Newspaper: () => null, Ruler: () => null, DollarSign: () => null }));
import PlayerOptionalDetails from "./PlayerOptionalDetails";
import PlayerMeasurements from "./PlayerMeasurements";
import PlayerSalary from "./PlayerSalary";
import PlayerNews from "./PlayerNews";
import PlayerVisibleNews from "./PlayerVisibleNews";
import { PlayerNewsLoading, PlayerSalaryLoading } from "./PlayerDetailsLoading";

type Props = ComponentProps<typeof PlayerOptionalDetails>;
const first: Props = { playerId: 201939, draftYear: 2009, playerName: "Stephen Curry", teamAbbr: "GSW" };
const second: Props = { playerId: 201935, draftYear: 2009, playerName: "James Harden", teamAbbr: "LAC" };
const sentinel = {} as Element;
function cleanup(instance: Instance) {
  instance.mounted = false;
  instance.slots.forEach(slot => (slot as Effect | undefined)?.cleanup?.());
}
function unmount() {
  runtime.instances.forEach(cleanup); runtime.instances.clear(); runtime.effects = [];
}
function expand(node: ReactNode, path: string, seen: Set<string>): ReactNode {
  if (Array.isArray(node)) return node.map((child, i) => expand(child, `${path}.${i}`, seen));
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  const key = `${path}:${node.key ?? ""}`;
  if (node.type === Fragment) return expand(node.props.children as ReactNode, `${key}.fragment`, seen);
  if (typeof node.type === "function") {
    let instance = runtime.instances.get(key);
    if (instance && instance.type !== node.type) { cleanup(instance); instance = undefined; }
    if (!instance) { instance = { type: node.type, slots: [], index: 0, mounted: true }; runtime.instances.set(key, instance); }
    seen.add(key); instance.index = 0; runtime.current = instance;
    const rendered = (node.type as (props: Record<string, unknown>) => ReactNode)(node.props);
    runtime.current = null;
    return expand(rendered, `${key}.child`, seen);
  }
  const { children, ref, ...props } = node.props;
  if (ref) (ref as { current: unknown }).current = sentinel;
  return createElement(node.type, { ...props, key }, expand(children as ReactNode, `${key}.host`, seen));
}
function renderNode(node: ReactNode) {
  const seen = new Set<string>(), tree = expand(node, "root", seen);
  for (const [key, instance] of runtime.instances) if (!seen.has(key)) { cleanup(instance); runtime.instances.delete(key); }
  runtime.effects.splice(0).forEach(run => run());
  return { tree, html: renderToStaticMarkup(tree) };
}
const render = (props = first) => renderNode(<PlayerOptionalDetails {...props} />);
const eager = (props = first) => renderNode(<>
  <PlayerMeasurements playerId={props.playerId} draftYear={props.draftYear} />
  <PlayerSalary playerName={props.playerName} teamAbbr={props.teamAbbr} />
  <PlayerNews playerName={props.playerName} />
</>);
const settle = async () => { await vi.dynamicImportSettled(); for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function activate(props = first, observer = observers.at(-1)!) {
  observer.intersect(); render(props); await settle(); return render(props);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
const response = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) }) as Response;
const measurements = (id = first.playerId, value = 75.5) => ({ resultSets: [{ headers: ["PLAYER_ID", "WINGSPAN"], rowSet: [[99, 99], [id, value]] }] });
const salary = (amount = 50000000) => ({ data: [{ season: 2026, base_salary: amount, cap_hit: amount }] });
const news = (headline = "Curry headline") => ({ data: [{ headline, description: "Report", link: "https://example.com/article", published: "2026-10-04" }] });
function resolveBatch(offset = 0, id = first.playerId, headline = "Curry headline") {
  calls[offset].reply.resolve(response(measurements(id)));
  calls[offset + 1].reply.resolve(response(salary()));
  calls[offset + 2].reply.resolve(response(news(headline)));
}
let observers: MockObserver[];
class MockObserver {
  observe = vi.fn(); disconnect = vi.fn();
  constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) { observers.push(this); }
  intersect(isIntersecting = true) { this.callback([{ isIntersecting, target: sentinel } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}
let calls: { url: string; signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }[];
beforeEach(() => {
  runtime.current = null; runtime.instances.clear(); runtime.effects = []; runtime.writes = 0; runtime.lateWrites = 0; runtime.locale = "en";
  runtime.lazy.forEach(state => { state.component = undefined; state.pending = undefined; state.loads = 0; });
  observers = []; calls = [];
  vi.stubGlobal("IntersectionObserver", MockObserver);
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const reply = deferred<Response>(); calls.push({ url, signal: init.signal as AbortSignal, reply }); return reply.promise;
  }));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("optional player details visibility and requests", () => {
  it.each([2009, null])("reduces actual initial child requests from %s-era eager mounting to zero far offscreen", draftYear => {
    const props = { ...first, draftYear };
    eager(props); expect(calls).toHaveLength(draftYear ? 3 : 2);
    unmount(); calls = [];
    render(props); observers[0].intersect(false); render(props);
    expect(calls).toHaveLength(0); expect(runtime.lazy.map(state => state.loads)).toEqual([0, 0, 0, 0]);
    expect(observers[0].options).toEqual({ rootMargin: "300px 0px" });
    expect(observers[0].observe).toHaveBeenCalledExactlyOnceWith(sentinel);
  });
  it("retains the exact existing salary/news skeleton markup before activation and during chunk/data loading", async () => {
    const oldLoading = eager().html; unmount(); calls = [];
    const before = render().html;
    expect(before).toContain(oldLoading); expect(calls).toHaveLength(0);
    observers[0].intersect(); const during = render().html;
    expect(during).toBe(before);
    await settle(); expect(render().html).toBe(before); expect(calls).toHaveLength(3);
    expect(before).not.toMatch(/min-h-|h-\[|style=/);
  });
  it("activates once, preserves URLs and renders real matching data despite repeated entries", async () => {
    render(); observers[0].intersect(); observers[0].intersect(); render(); await settle(); render();
    expect(calls.map(call => call.url)).toEqual([
      "/api/stats?endpoint=draftcombineplayeranthro&LeagueID=00&SeasonYear=2009",
      "/api/salary?player=Stephen%20Curry&team=GSW",
      "/api/news?q=Stephen%20Curry",
    ]);
    resolveBatch(); await settle(); const html = render().html;
    expect(html).toContain("75.5&quot;"); expect(html).not.toContain("99&quot;");
    expect(html).toContain("$50.0M"); expect(html).toContain("Curry headline");
    observers[0].intersect(false); render(); observers[0].intersect(); render();
    expect(calls).toHaveLength(3); expect(observers).toHaveLength(1);
    expect(runtime.lazy.map(state => state.loads)).toEqual([1, 1, 1, 0]);
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
  it("remains keyboard and screen-reader reachable without waiting for an observer entry", async () => {
    const initial = render(); const region = initial.tree as ReactElement<{ role: string; tabIndex: number; onFocus: () => void; "aria-label": string }>;
    expect(region.props.role).toBe("region"); expect(region.props.tabIndex).toBe(0);
    expect(region.props["aria-label"]).toBe(`${en.playerMeasurements.title}, ${en.playerSalary.title}, ${en.playerNews.title}`);
    region.props.onFocus(); render(); await settle(); const ready = render(); expect(calls).toHaveLength(3);
    expect((ready.tree as ReactElement).type).toBe(region.type);
    (ready.tree as typeof region).props.onFocus(); render(); expect(calls).toHaveLength(3);
  });
  it("disconnects and rejects queued observer callbacks after unmount before intersection", async () => {
    render(); unmount(); const writes = runtime.writes; observers[0].intersect(); await settle();
    expect(runtime.writes).toBe(writes); expect(runtime.lateWrites).toBe(0); expect(calls).toHaveLength(0);
    expect(observers[0].disconnect).toHaveBeenCalled(); expect(runtime.lazy.every(state => state.loads === 0)).toBe(true);
  });
  it("does not mount children after their chunks resolve beyond unmount", async () => {
    render(); observers[0].intersect(); render(); expect(calls).toHaveLength(0);
    unmount(); await settle(); expect(calls).toHaveLength(0); expect(runtime.lateWrites).toBe(0);
  });
  it("replaces pending A before visibility and never lets its old observer activate B", async () => {
    render(); render(second); const writes = runtime.writes; observers[0].intersect();
    expect(runtime.writes).toBe(writes); expect(calls).toHaveLength(0);
    await activate(second); expect(calls[1].url).toContain("James%20Harden"); expect(calls).toHaveLength(3);
  });
  it("resets all child state on A → B → A and aborts active requests without reviving old values", async () => {
    render(); await activate(); resolveBatch(); await settle(); expect(render().html).toContain("Curry headline");
    const newB = render(second); expect(newB.html).not.toMatch(/Curry headline|\$50.0M|75.5&quot;/);
    expect(calls.every(call => call.signal.aborted)).toBe(true);
    await activate(second); expect(calls).toHaveLength(6);
    const returnA = render(); expect(returnA.html).not.toMatch(/Curry headline|\$50.0M|75.5&quot;/);
    expect(calls.every(call => call.signal.aborted)).toBe(true);
    resolveBatch(3, second.playerId, "Stale Harden headline"); await settle();
    expect(render().html).not.toContain("Stale Harden"); expect(calls).toHaveLength(6);
    await activate(); expect(calls).toHaveLength(9); resolveBatch(6, first.playerId, "Fresh Curry headline"); await settle();
    expect(render().html).toContain("Fresh Curry headline"); expect(runtime.lateWrites).toBe(0);
  });
  it.each([
    { playerId: 123 }, { draftYear: 2010 }, { draftYear: null }, { playerName: "Updated Name" }, { teamAbbr: "BOS" },
  ])("keys the entire boundary on a changed identity field %j", async change => {
    render(); await activate();
    const updated = { ...first, ...change }; render(updated);
    expect(observers).toHaveLength(2); expect(calls.every(call => call.signal.aborted)).toBe(true);
    observers[0].intersect(); render(updated); expect(calls).toHaveLength(3);
    await activate(updated); expect(calls).toHaveLength(updated.draftYear === null ? 5 : 6);
  });
  it.each(["response", "body", "HTTP"])("aborts mounted child requests and ignores their late %s on unmount", async stage => {
    render(); await activate(); const bodies = [deferred(), deferred(), deferred()];
    if (stage === "body") { calls.forEach((call, i) => call.reply.resolve(response(bodies[i].promise))); await settle(); }
    unmount(); expect(calls.every(call => call.signal.aborted)).toBe(true); const writes = runtime.writes;
    if (stage === "body") [measurements(), salary(), news()].forEach((payload, i) => bodies[i].resolve(payload));
    else if (stage === "HTTP") calls.forEach(call => call.reply.resolve(response(null, false)));
    else resolveBatch();
    await settle(); expect(runtime.writes).toBe(writes); expect(runtime.lateWrites).toBe(0);
  });
  it("falls back once when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined); render(); await settle(); render(); await settle(); render();
    expect(calls).toHaveLength(3); expect(observers).toHaveLength(0); render(); expect(calls).toHaveLength(3);
  });
  it("cancels the queued unsupported-observer fallback when unmounted", async () => {
    vi.stubGlobal("IntersectionObserver", undefined); render(); unmount(); const writes = runtime.writes; await settle();
    expect(calls).toHaveLength(0); expect(runtime.writes).toBe(writes); expect(runtime.lateWrites).toBe(0);
  });
  it("survives Strict Mode effect cleanup/restart without reviving the discarded observer", async () => {
    render();
    for (const instance of runtime.instances.values()) for (const slot of instance.slots) {
      const effect = slot as Effect | undefined;
      if (effect?.run) { effect.cleanup?.(); effect.cleanup = effect.run() || undefined; }
    }
    const writes = runtime.writes; observers[0].intersect(); expect(runtime.writes).toBe(writes);
    await activate(); expect(calls).toHaveLength(3); expect(observers).toHaveLength(2);
  });
  it.each(["empty", "missing", "malformed-JSON", "HTTP"])("preserves existing silent empty/error behavior for %s responses", async outcome => {
    render(); await activate();
    calls.forEach(call => {
      if (outcome === "malformed-JSON") call.reply.resolve({ ok: true, json: async () => { throw new Error("Invalid JSON"); } } as unknown as Response);
      else if (outcome === "HTTP") call.reply.resolve(response(null, false));
      else call.reply.resolve(response(outcome === "empty" ? { data: [], resultSets: [] } : {}));
    });
    await settle(); const html = render().html;
    expect(html).not.toMatch(/glass-tile|skeleton-shimmer|<table|<a /);
    observers[0].intersect(); render(); expect(calls).toHaveLength(3);
  });
  it("localizes the accessible boundary and preserves the existing news loading title", () => {
    runtime.locale = "zh"; const html = render().html;
    expect(html).toContain(zh.playerNews.title); expect(html).toContain(zh.playerSalary.title); expect(html).toContain(zh.playerMeasurements.title);
  });
  it.each(["en", "zh"])("uses the %s news title in both pending and loaded states", async locale => {
    runtime.locale = locale;
    const title = (locale === "zh" ? zh : en).playerNews.title;
    const heading = new RegExp(`<h3[^>]*>${title}</h3>`);
    expect(render().html).toMatch(heading);
    await activate(); resolveBatch(); await settle();
    const html = render().html;
    expect(html).toMatch(heading); expect(html).toContain("Curry headline");
    if (locale === "zh") expect(html).not.toContain(en.playerNews.title);
  });
  it("keeps skeletons request-free and the new client import graph free of server/provider code", () => {
    renderNode(<><PlayerSalaryLoading /><PlayerNewsLoading /></>); expect(calls).toHaveLength(0);
    for (const file of ["PlayerOptionalDetails.tsx", "PlayerDetailsLoading.tsx"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).toMatch(/^"use client";/);
      expect(source).not.toMatch(/(?:node:|server-only|process\.env|supabase|@\/lib\/(?:api|.*server|.*provider))/);
    }
    const boundary = readFileSync(new URL("PlayerOptionalDetails.tsx", import.meta.url), "utf8");
    expect(boundary).toContain('dynamic(() => import("./PlayerMeasurements"), { loading: () => null })');
    expect(boundary).toContain('dynamic(() => import("./PlayerSalary"), { loading: PlayerSalaryLoading })');
    expect(boundary).toContain('dynamic(() => import("./PlayerNews"), { loading: PlayerNewsLoading })');
    const page = readFileSync(new URL("../../app/player/[id]/page.tsx", import.meta.url), "utf8");
    expect(page).toContain('<PlayerOptionalDetails playerId={personId} draftYear={player.draftYear} playerName={fullName} teamAbbr={player.teamAbbr} includeNews={false} />');
    expect(page).not.toMatch(/const Player(?:Measurements|Salary) =/);
  });
});


describe("standalone news panel visibility", () => {
  it("keeps desktop news request-free until its own visibility boundary is reached", async () => {
    const panel = () => renderNode(<PlayerVisibleNews playerName="Stephen Curry" />);
    panel(); await settle(); panel();
    expect(calls).toHaveLength(0);
    observers.at(-1)!.intersect(); panel(); await settle(); panel();
    expect(calls.map(call => call.url)).toEqual(["/api/news?q=Stephen%20Curry"]);
    panel(); expect(calls).toHaveLength(1);
  });
});
