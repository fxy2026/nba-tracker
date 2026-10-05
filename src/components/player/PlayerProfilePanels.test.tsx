import { createElement, Fragment, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

type Instance = { type: unknown; slots: unknown[]; index: number };
type Effect = { deps: unknown[]; cleanup?: () => void };
const runtime = vi.hoisted(() => ({
  current: null as Instance | null, instances: new Map<string, Instance>(), effects: [] as (() => void)[],
  context: { mobile: null as boolean | null, active: "data" }, server: true, mobile: true, notifications: 0,
  navTop: 300, bodyTop: 352, focusWithin: null as "body" | "tabs" | null,
}));
// Offline component lifecycle fixture. Actual boundary components run with
// deterministic viewport/history subscriptions; no browser/layout claim is made.
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useContext: () => runtime.context,
  useState: (initial: unknown) => {
    const instance = runtime.current!, index = instance.index++;
    if (!(index in instance.slots)) instance.slots[index] = typeof initial === "function" ? initial() : initial;
    return [instance.slots[index], (value: unknown) => { instance.slots[index] = typeof value === "function" ? value(instance.slots[index]) : value; }];
  },
  useRef: (initial: unknown) => { const instance = runtime.current!, index = instance.index++; return instance.slots[index] ?? (instance.slots[index] = { current: initial }); },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const instance = runtime.current!, index = instance.index++, prior = instance.slots[index] as Effect | undefined;
    if (!runtime.server && (!prior || deps.some((value, i) => value !== prior.deps[i]))) runtime.effects.push(() => { prior?.cleanup?.(); instance.slots[index] = { deps, cleanup: run() }; });
  },
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, getSnapshot: () => unknown, getServerSnapshot: () => unknown) => {
    const instance = runtime.current!, index = instance.index++;
    if (runtime.server) return getServerSnapshot();
    if (!instance.slots[index]) instance.slots[index] = { cleanup: subscribe(() => { runtime.notifications++; }) };
    return getSnapshot();
  },
}));
import PlayerProfilePanels, { commitPlayerProfileUrl, PlayerDeferred, PlayerProfilePart } from "./PlayerProfilePanels";
import { playerPanelHref } from "@/lib/player-mobile-navigation";
let url: URL;
let events: Map<string, Set<() => void>>;
const requests = new Map<string, number>(), cleanupCounts = new Map<string, number>();
function Owner({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => { requests.set(name, (requests.get(name) ?? 0) + 1); return () => { cleanupCounts.set(name, (cleanupCounts.get(name) ?? 0) + 1); }; }, [name]);
  return <button data-owner={name} onClick={() => setCount(value => value + 1)}>{name}:{count}</button>;
}
function cleanup(instance: Instance) { instance.slots.forEach(slot => (slot as Effect | undefined)?.cleanup?.()); }
function expand(node: ReactNode, path: string, seen: Set<string>): ReactNode {
  if (Array.isArray(node)) return node.map((child, i) => expand(child, `${path}.${i}`, seen));
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  const key = `${path}:${node.key ?? ""}`;
  if (node.type === Fragment) return expand(node.props.children as ReactNode, `${key}.fragment`, seen);
  if (typeof node.type === "object" && "_currentValue" in node.type) {
    const previous = runtime.context; runtime.context = node.props.value as typeof runtime.context;
    const children = expand(node.props.children as ReactNode, `${key}.context`, seen); runtime.context = previous; return children;
  }
  if (typeof node.type === "function") {
    let instance = runtime.instances.get(key);
    if (instance && instance.type !== node.type) { cleanup(instance); instance = undefined; }
    if (!instance) { instance = { type: node.type, slots: [], index: 0 }; runtime.instances.set(key, instance); }
    seen.add(key); instance.index = 0; runtime.current = instance;
    const rendered = (node.type as (props: Record<string, unknown>) => ReactNode)(node.props); runtime.current = null;
    return expand(rendered, `${key}.child`, seen);
  }
  const { children, ref, ...props } = node.props;
  if (ref) (ref as { current: unknown }).current = { contains: () => runtime.focusWithin === (props.role === "tablist" ? "tabs" : "body"), getBoundingClientRect: () => ({ top: props.role === "tablist" ? runtime.navTop : runtime.bodyTop, height: 52 }), scrollIntoView: vi.fn() };
  return createElement(node.type, { ...props, key }, expand(children as ReactNode, `${key}.host`, seen));
}
function fixture(id = 2544, initialSearch = "") {
  return <PlayerProfilePanels key={id} playerId={id} locale="en" initialSearch={initialSearch} header={<h1>Player {id}</h1>}>
    <PlayerProfilePart panel="data"><p>Source-labelled snapshot</p></PlayerProfilePart>
    <PlayerProfilePart panel="shooting"><section id="shooting"><PlayerDeferred panel="shooting"><Owner name={`shots-${id}`} /></PlayerDeferred></section></PlayerProfilePart>
    <PlayerProfilePart panel="honors" deferred><Owner name={`awards-${id}`} /></PlayerProfilePart>
    <PlayerProfilePart panel="career" deferred><Owner name={`career-${id}`} /></PlayerProfilePart>
    <PlayerProfilePart panel="games" deferred mobileOnly><Owner name={`games-${id}`} /></PlayerProfilePart>
  </PlayerProfilePanels>;
}
function render(id = 2544, initialSearch = "") {
  const seen = new Set<string>(), tree = expand(fixture(id, initialSearch), "root", seen);
  for (const [key, instance] of runtime.instances) if (!seen.has(key)) { cleanup(instance); runtime.instances.delete(key); }
  runtime.effects.splice(0).forEach(run => run());
  return { tree, html: renderToStaticMarkup(tree) };
}
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as ReactNode)];
}
const select = (panel: "shooting" | "honors" | "career" | "games" | "data") => { commitPlayerProfileUrl(playerPanelHref(url.href, panel)); return render(); };
beforeEach(() => {
  runtime.instances.forEach(cleanup); runtime.instances.clear(); runtime.effects = []; runtime.server = true; runtime.mobile = true; runtime.notifications = 0;
  runtime.navTop = 300; runtime.bodyTop = 352; runtime.focusWithin = null;
  requests.clear(); cleanupCounts.clear(); events = new Map(); url = new URL("https://nba.xpy.me/player/2544");
  vi.stubGlobal("window", {
    location: { get href() { return url.href; }, get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { pushState: vi.fn((_state, _unused, href) => { url = new URL(href, url); }) },
    matchMedia: () => ({ matches: runtime.mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    addEventListener: (event: string, notify: () => void) => { if (!events.has(event)) events.set(event, new Set()); events.get(event)!.add(notify); },
    removeEventListener: (event: string, notify: () => void) => events.get(event)?.delete(notify),
    scrollY: 0, scrollTo: vi.fn(),
    dispatchEvent: (event: Event) => { events.get(event.type)?.forEach(notify => notify()); },
  });
  vi.stubGlobal("document", { activeElement: null, getElementById: () => null });
  vi.stubGlobal("getComputedStyle", () => ({ top: "48px" }));
});
afterEach(() => { runtime.instances.forEach(cleanup); runtime.instances.clear(); vi.unstubAllGlobals(); });

describe("mobile profile panel boundary", () => {
  it("SSR has stable anchor targets, a single selected tab and request-free deferred children", () => {
    const { html } = render(2544, "panel=shooting&season=2025-26");
    expect(html).toContain('data-player-panel="shooting"'); expect(html).toContain('id="shooting"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toContain('data-player-deferred="shooting"'); expect(requests.size).toBe(0);
    const css = readFileSync(new URL("./player-panels.module.css", import.meta.url), "utf8");
    expect(css).toContain('.shell[data-player-panel="shooting"] .part:not([data-profile-part="shooting"])');
    expect(css).toContain('.part[hidden] { display: none; }');
  });
  it("mounts only visited mobile data owners and retains their local state without duplicate requests", () => {
    render(); runtime.server = false; render(); expect(requests.size).toBe(0);
    const shots = select("shooting"); expect([...requests]).toEqual([["shots-2544", 1]]);
    const owner = nodes(shots.tree).find(node => node.props["data-owner"] === "shots-2544")!;
    (owner.props.onClick as () => void)();
    const honors = select("honors"); expect([...requests]).toEqual([["shots-2544", 1], ["awards-2544", 1]]);
    expect(nodes(honors.tree).find(node => node.props["data-profile-part"] === "shooting")?.props.hidden).toBe(true);
    expect(select("shooting").html).toContain("shots-2544:1"); expect(requests.get("shots-2544")).toBe(1); expect(cleanupCounts.size).toBe(0);
    const pushes = vi.mocked(window.history.pushState).mock.calls.length; select("shooting"); expect(window.history.pushState).toHaveBeenCalledTimes(pushes);
    expect(runtime.notifications).toBeGreaterThan(0);
  });
  it("desktop activates shared sections once, hides mobile-only content, and survives resizing", () => {
    runtime.server = false; runtime.mobile = false; const desktop = render();
    expect([...requests.keys()]).toEqual(["shots-2544", "awards-2544", "career-2544"]);
    expect(desktop.html).not.toContain('role="tabpanel"');
    runtime.mobile = true; select("shooting"); runtime.mobile = false; render();
    expect([...requests.values()]).toEqual([1, 1, 1]); expect(cleanupCounts.size).toBe(0);
  });
  it("scrolls long-panel switches from normal-flow body coordinates and repairs hidden-panel focus", () => {
    runtime.server = false; runtime.navTop = 48; runtime.bodyTop = -620; window.scrollY = 900;
    const focus = vi.fn(), scrollIntoView = vi.fn();
    vi.stubGlobal("document", { activeElement: null, getElementById: () => ({ focus, scrollIntoView }) });
    const tree = select("shooting").tree;
    const honorsTab = nodes(tree).find(node => node.props.id === "player-tab-2544-honors")!;
    (honorsTab.props.onClick as () => void)();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 180, behavior: "instant" });
    runtime.focusWithin = "body";
    vi.stubGlobal("document", { activeElement: { closest: () => ({ getAttribute: () => "shooting" }) }, getElementById: () => ({ focus, scrollIntoView }) });
    render(); expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(nodes(render().tree).find(node => node.props["data-profile-part"] === "shooting")?.props.hidden).toBe(true);
  });
  it("restores focus even when the browser has already moved hidden-panel focus to body", () => {
    runtime.server = false;
    const focus = vi.fn(), documentBody = { closest: () => null };
    vi.stubGlobal("document", { body: documentBody, activeElement: null, getElementById: () => ({ focus, scrollIntoView: vi.fn() }) });
    const shellBody = nodes(select("shooting").tree).find(node => node.props.role === "tabpanel")!;
    (shellBody.props.onFocusCapture as (event: unknown) => void)({ target: { closest: () => ({ getAttribute: () => "shooting" }) } });
    vi.stubGlobal("document", { body: documentBody, activeElement: documentBody, getElementById: () => ({ focus, scrollIntoView: vi.fn() }) });
    url = new URL("https://nba.xpy.me/player/2544?panel=honors"); window.dispatchEvent(new Event("popstate")); render();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  });
  it("provides roving arrow/Home/End selection without swallowing unrelated keys", () => {
    runtime.server = false;
    const focus = vi.fn(); vi.stubGlobal("document", { activeElement: null, getElementById: () => ({ focus, scrollIntoView: vi.fn() }) });
    const data = nodes(render().tree).find(node => node.props.id === "player-tab-2544-data")!;
    const preventDefault = vi.fn();
    (data.props.onKeyDown as (event: unknown) => void)({ key: "End", preventDefault });
    expect(url.searchParams.get("panel")).toBe("details"); expect(preventDefault).toHaveBeenCalledOnce(); expect(focus).toHaveBeenCalled();
    (data.props.onKeyDown as (event: unknown) => void)({ key: "Tab", preventDefault }); expect(preventDefault).toHaveBeenCalledOnce();
    const tabs = nodes(render().tree).filter(node => node.props.role === "tab");
    expect(tabs.filter(node => node.props.tabIndex === 0)).toHaveLength(1);
  });
  it("Back/Forward subscriptions restore selection, while player identity changes reset mounted state", () => {
    runtime.server = false; render(); select("shooting");
    url = new URL("https://nba.xpy.me/player/2544?panel=honors"); window.dispatchEvent(new Event("popstate")); expect(render().html).toContain('data-player-panel="honors"');
    url = new URL("https://nba.xpy.me/player/2544?panel=shooting"); window.dispatchEvent(new Event("popstate")); expect(render().html).toContain('data-player-panel="shooting"');
    url = new URL("https://nba.xpy.me/player/977?panel=career"); const next = render(977, "panel=career");
    expect(next.html).toContain("Player 977"); expect(next.html).not.toContain("shots-2544"); expect(cleanupCounts.get("shots-2544")).toBe(1);
  });
});
