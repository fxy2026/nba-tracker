import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const routerSource = readFileSync(require.resolve("next/dist/client/components/app-router.js"), "utf8");
const linkSource = readFileSync(require.resolve("next/dist/client/app-dir/link.js"), "utf8");
function excerpt(source: string, start: string, end: string) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  if (from < 0 || to <= from) throw new Error(`Installed Next history adapter changed: ${start}`);
  return source.slice(from, to);
}

type Tree = { playerId: string };
type HistoryState = { __NA: boolean; __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: Tree; renderedSearch: string } } | null;
type RouterState = { tree: Tree; canonicalUrl: string; renderedSearch: string; pushRef: { pendingPush: boolean; preserveCustomHistoryState: boolean } };

/**
 * Network-free contract fixture, not a browser or the full App Router renderer.
 * Run the installed Link click, HistoryUpdater and popstate implementations;
 * stub only route resolution/commit and the browser's session-history storage.
 * In particular, never make native hash anchors preserve Next state in a mock.
 */
function historyFixture(initial = "/player/201939") {
  const origin = "https://example.test";
  let url = new URL(initial, origin), index = 0;
  const entries: { url: URL; state: HistoryState }[] = [{ url, state: null }];
  const treeFor = (next: URL): Tree => ({ playerId: next.pathname.split("/").at(-1)! });
  let router: RouterState = { tree: treeFor(url), canonicalUrl: url.pathname + url.search + url.hash, renderedSearch: url.search, pushRef: { pendingPush: false, preserveCustomHistoryState: false } };
  const write = (state: HistoryState, href: string, push: boolean) => {
    url = new URL(href, url);
    if (push) { entries.splice(index + 1); index++; }
    entries[index] = { url, state };
  };
  const window = {
    location: { get href() { return url.href; }, reload: vi.fn() },
    history: {
      get state() { return entries[index].state; },
      pushState: (state: HistoryState, _unused: string, href: string) => write(state, href, true),
      replaceState: (state: HistoryState, _unused: string, href: string) => write(state, href, false),
    },
  };
  const historyUpdater = new Function("_react", "window", "_createhreffromurl", "_committedstate", "process", `${excerpt(routerSource, "function HistoryUpdater(", "\nfunction copyNextJsInternalHistoryState(")}\nreturn HistoryUpdater;`)(
    { useInsertionEffect: (effect: () => void) => effect(), useEffect: () => {} }, window,
    { createHrefFromUrl: (next: URL) => next.pathname + next.search + next.hash },
    { setLastCommittedTree: () => {} }, { env: {} },
  ) as (props: { appRouterState: RouterState }) => void;
  const commit = () => historyUpdater({ appRouterState: router });
  const dispatchNavigateAction = vi.fn((href: string, mode: string) => {
    const next = new URL(href, url);
    router = { tree: treeFor(next), canonicalUrl: next.pathname + next.search + next.hash, renderedSearch: next.search, pushRef: { pendingPush: mode === "push", preserveCustomHistoryState: false } };
    commit();
  });
  const dispatchTraverseAction = vi.fn((href: string, saved: NonNullable<HistoryState>["__PRIVATE_NEXTJS_INTERNALS_TREE"]) => {
    const next = new URL(href);
    router = { tree: saved.tree, canonicalUrl: next.pathname + next.search + next.hash, renderedSearch: saved.renderedSearch, pushRef: { pendingPush: false, preserveCustomHistoryState: true } };
    commit();
  });
  const onPopState = new Function("window", "_react", "_approuterinstance", `${excerpt(routerSource, "const onPopState = (event)=>{", "\n        // Register popstate")}\nreturn onPopState;`)(
    window, { startTransition: (run: () => void) => run() }, { dispatchTraverseAction },
  ) as (event: { state: HistoryState }) => void;
  const linkClicked = new Function("window", "_islocalurl", "require", "_react", "_routerreducertypes", `${excerpt(linkSource, "function isModifiedEvent(", "\nfunction formatStringOrUrl(")}\nreturn linkClicked;`)(
    window, { isLocalURL: (href: string) => new URL(href, url).origin === origin },
    () => ({ dispatchNavigateAction }), { default: { startTransition: (run: () => void) => run() } },
    { ScrollBehavior: { NoScroll: "none", Default: "default" } },
  ) as (event: object, href: string, ref: object, replace: boolean, scroll: boolean, onNavigate?: () => void) => void;
  commit();
  const traverse = (delta: number) => {
    index += delta;
    url = entries[index].url;
    onPopState({ state: entries[index].state });
  };
  return {
    get href() { return url.pathname + url.search + url.hash; },
    get playerId() { return router.tree.playerId; },
    get entries() { return entries; },
    dispatchTraverseAction,
    click(href: string, ctrlKey = false, onNavigate?: () => void, canceled = false) {
      const event = { currentTarget: { nodeName: "A", getAttribute: () => null, hasAttribute: () => false }, defaultPrevented: false, preventDefault: vi.fn(() => { event.defaultPrevented = true; }), ctrlKey };
      // Execute Link's outer click handler too: previously canceled events
      // must not reach onNavigate (the skip link's focus callback).
      const onClick = new Function("process", "legacyBehavior", "onClick", "child", "router", "linkClicked", "formattedHref", "linkInstanceRef", "replace", "scroll", "onNavigate", "transitionTypes", "prefetchIntent", `return ({${excerpt(linkSource, "onClick (e) {", ",\n        onMouseEnter")} }).onClick;`)(
        { env: {} }, false, canceled ? () => event.preventDefault() : undefined, null, {}, linkClicked, href, { current: null }, false, true, onNavigate, undefined, "none",
      ) as (event: object) => void;
      onClick(event);
      return event.preventDefault;
    },
    nativeHash(href: string) { write(null, href, true); onPopState({ state: null }); },
    back: () => traverse(-1), forward: () => traverse(1),
  };
}

describe("router-owned player hash history", () => {
  it("reproduces the native-anchor failure without fast or overlapping Back actions", () => {
    const session = historyFixture();
    session.nativeHash("#career");
    session.click("/player/202710");
    session.nativeHash("#career");
    session.back();
    expect(session.playerId).toBe("202710");
    session.back();
    expect(session.href).toBe("/player/201939#career");
    expect(session.playerId).toBe("202710"); // null state never dispatches restoration
    expect(session.dispatchTraverseAction).toHaveBeenCalledTimes(1);
  });

  it.each(["#overview", "#shooting", "#career", "#main-content"])("restores the matching player across %s and another player's hash", hash => {
    const session = historyFixture("/player/201939?season=2025-26&seasonType=Regular+Season");
    expect(session.click(hash)).toHaveBeenCalledOnce();
    expect(session.href).toBe(`/player/201939?season=2025-26&seasonType=Regular+Season${hash}`);
    expect(session.entries.at(-1)?.state?.__PRIVATE_NEXTJS_INTERNALS_TREE.tree.playerId).toBe("201939");
    session.click("/player/202710");
    session.click("#career");
    session.back();
    expect(session.href).toBe("/player/202710");
    expect(session.playerId).toBe("202710");
    session.back();
    expect(session.href).toBe(`/player/201939?season=2025-26&seasonType=Regular+Season${hash}`);
    expect(session.playerId).toBe("201939");
    session.forward();
    expect(session.href).toBe("/player/202710");
    expect(session.playerId).toBe("202710");
    session.back();
    expect(session.playerId).toBe("201939");
    session.back();
    expect(session.href).toBe("/player/201939?season=2025-26&seasonType=Regular+Season");
    expect(session.playerId).toBe("201939");
  });

  it("does not add duplicate same-hash entries and leaves modified clicks to the browser", () => {
    const session = historyFixture();
    session.click("#career");
    session.click("#career");
    expect(session.entries).toHaveLength(2);
    const focusMain = vi.fn();
    expect(session.click("#main-content", true, focusMain)).not.toHaveBeenCalled();
    expect(focusMain).not.toHaveBeenCalled();
    expect(session.href).toBe("/player/201939#career");
    session.click("#main-content", false, focusMain, true);
    expect(focusMain).not.toHaveBeenCalled();
    expect(session.href).toBe("/player/201939#career");
    session.click("#main-content", false, focusMain);
    expect(focusMain).toHaveBeenCalledOnce();
  });
});
