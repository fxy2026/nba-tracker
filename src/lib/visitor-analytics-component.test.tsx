import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBrowserPageviewAdapter } from "@/lib/visitor-analytics-client";

type Effect = { run: () => void | (() => void); deps: readonly unknown[]; cleanup?: () => void };
const fixture = vi.hoisted(() => ({
  pathname: "/" as string | null,
  refs: [] as Array<{ current: unknown }>,
  refCursor: 0,
  effect: undefined as Effect | undefined,
  pending: undefined as Effect | undefined,
}));
vi.mock("next/navigation", () => ({ usePathname: () => fixture.pathname }));
// Focused effect fixture: persistent refs, dependency comparison, cleanup before
// setup. This does not claim to replace a production browser/navigation test.
vi.mock("react", () => ({
  useRef(initial: unknown) {
    const index = fixture.refCursor++;
    fixture.refs[index] ??= { current: initial };
    return fixture.refs[index];
  },
  useEffect(run: Effect["run"], deps: readonly unknown[]) {
    if (!fixture.effect || deps.some((value, index) => !Object.is(value, fixture.effect!.deps[index]))) fixture.pending = { run, deps };
  },
}));
import VisitorAnalytics from "@/components/VisitorAnalyticsRuntime";

const config = { enabled: true, productionOrigin: "https://nba.xpy.me" };
let win: {
  location: { pathname: string; origin: string };
  innerWidth: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let fetch: ReturnType<typeof vi.fn>;
let listeners: Map<string, Set<EventListener>>;

function render(props = config) {
  fixture.refCursor = 0;
  expect(VisitorAnalytics(props)).toBe(null);
  if (fixture.pending) {
    fixture.effect?.cleanup?.();
    const effect = fixture.pending;
    fixture.pending = undefined;
    effect.cleanup = effect.run() || undefined;
    fixture.effect = effect;
  }
}
async function navigate(path: string) {
  fixture.pathname = path; win.location.pathname = path; render();
  await vi.advanceTimersByTimeAsync(1000);
}

beforeEach(() => {
  vi.useFakeTimers(); fixture.pathname = "/"; fixture.refs = []; fixture.refCursor = 0; fixture.effect = undefined; fixture.pending = undefined;
  listeners = new Map();
  win = {
    location: { pathname: "/", origin: config.productionOrigin }, innerWidth: 390,
    addEventListener: vi.fn((name: string, callback: EventListener) => {
      const group = listeners.get(name) ?? new Set(); group.add(callback); listeners.set(name, group);
    }),
    removeEventListener: vi.fn((name: string, callback: EventListener) => { listeners.get(name)?.delete(callback); }),
  };
  fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("window", win); vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("document", { visibilityState: "visible", prerendering: false, referrer: "https://www.google.com/search?q=secret", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("navigator", { doNotTrack: "0", globalPrivacyControl: false });
  let id = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `d0e740db-2c85-4ea3-9c58-${String(++id).padStart(12, "0")}` });
});
afterEach(() => { fixture.effect?.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("does nothing by default and waits for the server-provided production opt-in", async () => {
  fixture.refCursor = 0; expect(VisitorAnalytics({})).toBe(null);
  const effect = fixture.pending; effect?.run(); fixture.pending = undefined;
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).not.toHaveBeenCalled(); expect(win.addEventListener).not.toHaveBeenCalled();
  render(); await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledOnce();
});

it("actual component effects send one initial event, one per pathname change, and one on Back", async () => {
  render(); render(); await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledOnce();
  await navigate("/stats"); render(); await vi.advanceTimersByTimeAsync(1000);
  await navigate("/");
  expect(fetch.mock.calls.map(([, request]) => JSON.parse(request.body).path)).toEqual(["/", "/stats", "/"]);
});

it("effect cleanup/setup replay sends once and unmount cancels pending work/listeners", async () => {
  render(); fixture.effect?.cleanup?.();
  fixture.effect!.cleanup = fixture.effect!.run() || undefined;
  await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledOnce();
  fixture.pathname = "/stats"; win.location.pathname = "/stats"; render();
  fixture.effect?.cleanup?.(); await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledOnce(); expect(listeners.get("pageshow")?.size).toBe(0);
});

it("restored bfcache pages count once while ordinary pageshow events do not", async () => {
  render(); await vi.advanceTimersByTimeAsync(1000);
  for (const listener of listeners.get("pageshow") ?? []) listener({ persisted: false } as unknown as Event);
  await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledOnce();
  for (const listener of listeners.get("pageshow") ?? []) listener({ persisted: true } as unknown as Event);
  await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledTimes(2);
  render(); await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledTimes(2);
});

it("stops pending collection if the enable prop is withdrawn", async () => {
  render(); render({ ...config, enabled: false }); await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).not.toHaveBeenCalled(); expect(listeners.get("pageshow")?.size).toBe(0);
});

it("missing secure randomness fails closed", () => {
  vi.stubGlobal("crypto", undefined); expect(createBrowserPageviewAdapter().eventId()).toBe(null);
  vi.stubGlobal("crypto", { randomUUID() { throw new Error("unavailable"); } });
  expect(createBrowserPageviewAdapter().eventId()).toBe(null);
});
