import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamDigest } from "./follow-digest-types";

type Effect = {
  run: () => void | (() => void);
  deps?: readonly unknown[];
  cleanup?: () => void;
};
type Hook =
  | { kind: "state"; value: unknown; set: (value: unknown) => void }
  | { kind: "ref"; value: { current: unknown } }
  | { kind: "effect"; value: Effect }
  | { kind: "callback"; fn: unknown; deps: readonly unknown[] };
const runtime = vi.hoisted(() => ({
  hooks: [] as Hook[],
  cursor: 0,
  effects: [] as { index: number; effect: Effect; old?: Effect }[],
  dirty: true,
  mounted: true,
  lateSetters: 0,
  locale: "en",
}));

// Run the real dashboard's effects with React's commit ordering: changed
// cleanups first, then setups, then rerenders. This deterministic fixture
// exercises effects and actual card/remove handlers, not a browser renderer.
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    let slot = runtime.hooks[index];
    if (!slot) {
      const state: Extract<Hook, { kind: "state" }> = {
        kind: "state",
        value: typeof initial === "function" ? initial() : initial,
        set(value) {
          if (!runtime.mounted) { runtime.lateSetters++; return; }
          const next = typeof value === "function" ? value(state.value) : value;
          if (!Object.is(next, state.value)) {
            state.value = next;
            runtime.dirty = true;
          }
        },
      };
      runtime.hooks[index] = slot = state;
    }
    if (slot.kind !== "state") throw new Error("Hook order changed");
    return [slot.value, slot.set];
  },
  useRef: (initial: unknown) => {
    const index = runtime.cursor++;
    runtime.hooks[index] ??= { kind: "ref", value: { current: initial } };
    const slot = runtime.hooks[index];
    if (slot.kind !== "ref") throw new Error("Hook order changed");
    return slot.value;
  },
  useCallback: (fn: unknown, deps: readonly unknown[]) => {
    const index = runtime.cursor++;
    const old = runtime.hooks[index];
    if (!old || old.kind !== "callback" || deps.length !== old.deps.length || deps.some((d, i) => !Object.is(d, old.deps[i]))) {
      runtime.hooks[index] = { kind: "callback", fn, deps };
    }
    return (runtime.hooks[index] as Extract<Hook, { kind: "callback" }>).fn;
  },
  useEffect: (run: Effect["run"], deps?: readonly unknown[]) => {
    const index = runtime.cursor++;
    const slot = runtime.hooks[index];
    const old = slot?.kind === "effect" ? slot.value : undefined;
    if (!old || !deps || deps.length !== old.deps?.length || deps.some((d, i) => !Object.is(d, old.deps?.[i]))) {
      runtime.effects.push({ index, effect: { run, deps }, old });
    }
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));

import Dashboard, { TeamCard } from "@/app/favorites/FavoritesDashboard";
import Page from "@/app/favorites/page";
import { TEAM_META } from "./teams";

type Props = { children?: ReactNode; [key: string]: unknown };
type News = { headline: string; link: string; published: string };
type Request = {
  url: string;
  signal: AbortSignal;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};
let tree: ReactNode;
let storage: Map<string, string>;
const requests: Request[] = [];
const response = (data: unknown) => ({ ok: true, json: async () => data });
const news = (headline: string): News => ({ headline, link: `https://example.test/${encodeURIComponent(headline)}`, published: "2026-10-04" });
const records: TeamDigest[] = ["LAL", "BOS", "MIA"].map(tricode => ({
  ...TEAM_META[tricode], wins: 1, losses: 0, recordSeason: "2025-26",
  conferenceRank: 1, streak: "W1", lastGame: null, nextGame: null,
}));

function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function flush() {
  for (let n = 0; runtime.dirty; n++) {
    if (n > 30) throw new Error("Render loop");
    runtime.dirty = false;
    runtime.cursor = 0;
    runtime.effects = [];
    tree = Dashboard();
    const effects = runtime.effects;
    for (const effect of effects) effect.old?.cleanup?.();
    for (const { index, effect } of effects) {
      runtime.hooks[index] = { kind: "effect", value: effect };
      effect.cleanup = effect.run() || undefined;
    }
  }
}
async function settle() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    if (runtime.mounted) flush();
  }
}
function cards() { return nodes(tree).filter(node => node.type === TeamCard); }
function card(tricode: string) {
  const found = cards().find(node => (node.props.team as TeamDigest).tricode === tricode);
  if (!found) throw new Error(`Missing ${tricode} card`);
  return found;
}
function removeHandler(tricode: string): () => void {
  const current = card(tricode);
  const rendered = TeamCard(current.props as Parameters<typeof TeamCard>[0]);
  const remove = nodes(rendered).find(node => typeof node.type === "function" && node.props.onRemove === current.props.onRemove);
  if (!remove) throw new Error("Missing RemoveButton");
  const button = (remove.type as (props: Props) => ReactElement<{ onClick: () => void }>)(remove.props);
  expect(button.type).toBe("button");
  return button.props.onClick;
}
function removeTeam(tricode: string) { removeHandler(tricode)(); flush(); }
function newsRequests(tricode: string) {
  const url = `/api/news?q=${encodeURIComponent(TEAM_META[tricode].name)}`;
  return requests.filter(request => request.url === url);
}
function unmount() {
  if (!runtime.mounted) return;
  runtime.mounted = false;
  for (const hook of runtime.hooks) if (hook.kind === "effect") hook.value.cleanup?.();
}

beforeEach(() => {
  Object.assign(runtime, { hooks: [], cursor: 0, effects: [], dirty: true, mounted: true, lateSetters: 0, locale: "en" });
  tree = undefined;
  requests.length = 0;
  storage = new Map([["fav_teams", '["LAL","BOS"]'], ["fav_players", "[]"]]);
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("fetch", vi.fn((url: string, init: { signal: AbortSignal }) => {
    if (url.startsWith("/api/follow-digest?")) {
      const teams = new URL(url, "http://local.test").searchParams.get("teams")?.split(",") ?? [];
      return Promise.resolve(response({ teams: records.filter(record => teams.includes(record.tricode)), players: [] }));
    }
    if (url === "/api/injuries") return Promise.resolve(response({ data: [] }));
    if (url.startsWith("/api/news?")) {
      // Do not auto-reject on abort: independently control old completion/catch
      // ordering, including transports whose body parsing outlives cancellation.
      return new Promise((resolve, reject) => requests.push({ url, signal: init.signal, resolve, reject }));
    }
    throw new Error(`Unexpected request ${url}`);
  }));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("favorites news request lifecycle", () => {
  it.each(["en", "zh"])("real page/card/remove path replaces still-followed pending news in %s", async locale => {
    runtime.locale = locale;
    expect(nodes(await Page()).some(node => node.type === Dashboard)).toBe(true);
    flush(); await settle();
    expect(cards()).toHaveLength(2);
    const oldBoston = newsRequests("BOS")[0];
    const oldLakers = newsRequests("LAL")[0];
    removeTeam("LAL"); await settle();
    expect(storage.get("fav_teams")).toBe('["BOS"]');
    expect(oldBoston.signal.aborted).toBe(true);
    expect(oldLakers.signal.aborted).toBe(true);
    expect(newsRequests("BOS")).toHaveLength(2);
    expect(newsRequests("LAL")).toHaveLength(1);
    const replacement = newsRequests("BOS")[1];
    expect(replacement.signal.aborted).toBe(false);
    replacement.resolve(response({ data: [news("Boston replacement")] }));
    await settle();
    expect(card("BOS").props.news).toEqual([news("Boston replacement")]);
    const anchors = nodes(TeamCard(card("BOS").props as Parameters<typeof TeamCard>[0]));
    expect(anchors.some(node => node.type === "a" && node.props.href === news("Boston replacement").link)).toBe(true);
    oldBoston.reject(new DOMException("Aborted", "AbortError"));
    oldLakers.resolve(response({ data: [news("Removed Lakers")] }));
    await settle();
    expect(cards()).toHaveLength(1);
    expect(card("BOS").props.news).toEqual([news("Boston replacement")]);
  });

  it("does not refetch completed news after unfollowing or after a late aborted catch", async () => {
    flush(); await settle();
    const toggleLakers = removeHandler("LAL");
    const oldBoston = newsRequests("BOS")[0];
    removeTeam("LAL"); await settle();
    newsRequests("BOS")[1].resolve(response({ data: [news("Current Boston")] }));
    await settle();
    oldBoston.reject(new DOMException("Aborted", "AbortError"));
    await settle();
    // Reuse the actual handler to re-follow LAL while retaining this mounted
    // dashboard; it delegates to the production localStorage toggle helper.
    toggleLakers(); flush(); await settle();
    expect(newsRequests("BOS")).toHaveLength(2);
    expect(newsRequests("LAL")).toHaveLength(2);
    newsRequests("LAL")[1].resolve(response({ data: [news("Current Lakers")] }));
    await settle();
    removeTeam("LAL"); await settle();
    expect(newsRequests("BOS")).toHaveLength(2);
    expect(card("BOS").props.news).toEqual([news("Current Boston")]);
    // A new same-ID favorites array still reuses the successful BOS result.
    storage.set("fav_teams", '["BOS","LAL"]');
    toggleLakers(); flush(); await settle();
    expect(storage.get("fav_teams")).toBe('["BOS"]');
    expect(newsRequests("BOS")).toHaveLength(2);
  });

  it("ignores old parsed bodies across overlapping add/remove/re-add generations", async () => {
    flush(); await settle();
    const toggleLakers = removeHandler("LAL");
    const oldLakers = newsRequests("LAL")[0];
    const oldBoston = newsRequests("BOS")[0];
    let finishOldBody!: (body: unknown) => void;
    oldLakers.resolve({ ok: true, json: () => new Promise(resolve => { finishOldBody = resolve; }) });
    await settle();
    // Simulate another favorites control adding MIA in localStorage before
    // this dashboard's actual removal handler reads the current list.
    storage.set("fav_teams", '["LAL","BOS","MIA"]');
    removeTeam("LAL"); await settle();
    expect(newsRequests("BOS")).toHaveLength(2);
    expect(newsRequests("MIA")).toHaveLength(1);
    toggleLakers(); flush(); await settle();
    expect(newsRequests("BOS")).toHaveLength(3);
    expect(newsRequests("MIA")).toHaveLength(2);
    expect(newsRequests("LAL")).toHaveLength(2);
    newsRequests("LAL")[1].resolve(response({ data: [news("New Lakers")] }));
    newsRequests("BOS")[2].resolve(response({ data: [news("New Boston")] }));
    await settle();
    removeTeam("MIA"); await settle();
    expect(newsRequests("BOS")).toHaveLength(3);
    expect(newsRequests("LAL")).toHaveLength(2);
    finishOldBody({ data: [news("Stale Lakers body")] });
    oldBoston.resolve(response({ data: [news("Stale Boston")] }));
    newsRequests("BOS")[1].reject(new Error("Late obsolete failure"));
    newsRequests("MIA")[0].resolve(response({ data: [news("Removed Miami")] }));
    newsRequests("MIA")[1].reject(new DOMException("Aborted", "AbortError"));
    await settle();
    expect(cards().map(node => (node.props.team as TeamDigest).tricode)).toEqual(["LAL", "BOS"]);
    expect(card("LAL").props.news).toEqual([news("New Lakers")]);
    expect(card("BOS").props.news).toEqual([news("New Boston")]);
    removeTeam("LAL"); await settle();
    expect(newsRequests("BOS")).toHaveLength(3);
  });

  it("deduplicates repeated IDs and ordinary rerenders while requests are pending", async () => {
    storage.set("fav_teams", '["LAL","BOS","BOS"]');
    flush(); await settle();
    expect(newsRequests("BOS")).toHaveLength(1);
    expect(newsRequests("LAL")).toHaveLength(1);
    for (let i = 0; i < 3; i++) { runtime.dirty = true; flush(); await settle(); }
    expect(newsRequests("BOS")).toHaveLength(1);
    expect(newsRequests("LAL")).toHaveLength(1);
    expect(requests.every(request => !request.signal.aborted)).toBe(true);
  });

  it("keeps successful empty responses cached and preserves the two-headline filter", async () => {
    flush(); await settle();
    const toggleLakers = removeHandler("LAL");
    newsRequests("BOS")[0].resolve(response({ data: [] }));
    newsRequests("LAL")[0].resolve(response({ data: [
      { ...news(""), headline: "" }, { ...news("Missing link"), link: "" },
      news("First"), news("Second"), news("Third"),
    ] }));
    await settle();
    expect(card("BOS").props.news).toBeUndefined();
    expect(card("LAL").props.news).toEqual([news("First"), news("Second")]);
    removeTeam("LAL"); await settle();
    toggleLakers(); flush(); await settle();
    expect(newsRequests("BOS")).toHaveLength(1);
    expect(newsRequests("LAL")).toHaveLength(1);
    expect(card("LAL").props.news).toEqual([news("First"), news("Second")]);
  });

  it.each([
    ["HTTP error", { ok: false, json: async () => ({ data: [] }) }],
    ["rejected JSON", { ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } }],
    ["null payload", response(null)],
    ["missing data", response({})],
    ["non-array data", response({ data: {} })],
    ["null entry", response({ data: [null] })],
    ["non-string headline", response({ data: [{ ...news("Bad"), headline: {} }] })],
    ["non-string link", response({ data: [{ ...news("Bad"), link: 42 }] })],
    ["non-string publication", response({ data: [{ ...news("Bad"), published: {} }] })],
  ])("does not poison the cache after %s", async (_label, result) => {
    flush(); await settle();
    newsRequests("BOS")[0].resolve(result);
    await settle();
    expect(card("BOS").props.news).toBeUndefined();
    removeTeam("LAL"); await settle();
    expect(newsRequests("BOS")).toHaveLength(2);
    newsRequests("BOS")[1].resolve(response({ data: [news("Recovered Boston")] }));
    await settle();
    expect(card("BOS").props.news).toEqual([news("Recovered Boston")]);
  });

  it("retries a transport failure on the next followed-team change", async () => {
    flush(); await settle();
    newsRequests("BOS")[0].reject(new Error("Offline"));
    await settle();
    removeTeam("LAL"); await settle();
    expect(newsRequests("BOS")).toHaveLength(2);
    newsRequests("BOS")[1].resolve(response({ data: [news("Recovered Boston")] }));
    await settle();
    expect(card("BOS").props.news).toEqual([news("Recovered Boston")]);
  });

  it("aborts on actual unmount and never commits a late response or parsed body", async () => {
    flush(); await settle();
    const lakers = newsRequests("LAL")[0];
    const boston = newsRequests("BOS")[0];
    let finishBody!: (body: unknown) => void;
    lakers.resolve({ ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) });
    await settle();
    unmount();
    expect(requests.every(request => request.signal.aborted)).toBe(true);
    finishBody({ data: [news("Late Lakers")] });
    boston.resolve(response({ data: [news("Late Boston")] }));
    await settle();
    expect(runtime.lateSetters).toBe(0);
  });
});
