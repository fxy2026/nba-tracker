import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyPageviewDevice,
  classifyPageviewReferrer,
  createBrowserPageviewAdapter,
  createPageviewCollector,
  PAGEVIEW_REQUEST_TIMEOUT_MS,
  postAnonymousPageview,
  type AnonymousPageview,
  type PageviewBrowser,
  type PageviewBrowserState,
} from "@/lib/visitor-analytics-client";

const config = { enabled: true, productionOrigin: "https://nba.xpy.me" };
const event: AnonymousPageview = {
  eventId: "d0e740db-2c85-4ea3-9c58-370199f4a818", path: "/", referrer: "direct", device: "mobile",
};

function fixture() {
  const state: PageviewBrowserState = {
    origin: "https://nba.xpy.me", pathname: "/", referrer: "https://www.google.com/search?q=private",
    width: 390, privacyOptOut: false, visible: true,
  };
  const pending = new Set<() => void>();
  const visibility = new Set<() => void>();
  const post = vi.fn();
  let serial = 0;
  const browser: PageviewBrowser = {
    read: vi.fn(() => ({ ...state })),
    schedule: vi.fn(callback => { pending.add(callback); return () => { pending.delete(callback); }; }),
    onVisible: vi.fn(callback => { visibility.add(callback); return () => { visibility.delete(callback); }; }),
    eventId: vi.fn(() => `d0e740db-2c85-4ea3-9c58-${String(++serial).padStart(12, "0")}`),
    post,
  };
  const collector = createPageviewCollector(browser);
  return {
    state, browser, post, pending, visibility, collector,
    flush() { const callbacks = [...pending]; pending.clear(); callbacks.forEach(callback => callback()); },
    show() { state.visible = true; [...visibility].forEach(callback => callback()); },
    navigate(path: string) { state.pathname = path; return collector.observe(path, config); },
  };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("anonymous navigation collector", () => {
  it("does no browser read, scheduling, randomness or network while disabled by default", () => {
    const f = fixture();
    f.collector.observe("/");
    f.collector.observe("/", { ...config, enabled: false });
    expect(f.browser.read).not.toHaveBeenCalled();
    expect(f.browser.schedule).not.toHaveBeenCalled();
    expect(f.browser.eventId).not.toHaveBeenCalled();
    expect(f.post).not.toHaveBeenCalled();
  });

  it("only sends on the exact explicitly configured HTTPS production origin", () => {
    for (const origin of ["http://nba.xpy.me", "https://nba-preview.vercel.app", "https://evilnba.xpy.me", "https://nba.xpy.me.evil.test", "http://localhost:3000"]) {
      const f = fixture(); f.state.origin = origin; f.navigate("/"); f.flush();
      expect(f.post).not.toHaveBeenCalled(); expect(f.browser.schedule).not.toHaveBeenCalled();
    }
    for (const productionOrigin of [null, "", "http://nba.xpy.me", "https://nba.xpy.me/", "https://nba.xpy.me/path", "https://user@nba.xpy.me", "https://nba.xpy.me?token=secret"]) {
      const f = fixture(); f.collector.observe("/", { enabled: true, productionOrigin }); f.flush();
      expect(f.post).not.toHaveBeenCalled();
    }
  });

  it("defers the initial event and emits only bounded anonymous fields", () => {
    const f = fixture(); f.navigate("/");
    expect(f.post).not.toHaveBeenCalled();
    f.flush();
    expect(f.post).toHaveBeenCalledOnce();
    expect(f.post.mock.calls[0][0]).toEqual({
      eventId: expect.stringMatching(/^[\da-f-]{36}$/), path: "/", referrer: "google", device: "mobile",
    });
    expect(JSON.stringify(f.post.mock.calls[0][0])).not.toMatch(/private|google\.com|consent|token|userAgent|timestamp|identifier/);
  });

  it("survives Strict Mode effect replay without duplicate events or a lost initial event", () => {
    const f = fixture(); const stop = f.navigate("/"); stop();
    f.navigate("/"); f.flush();
    f.navigate("/"); f.flush();
    expect(f.post).toHaveBeenCalledOnce();
  });

  it("counts forward and Back path navigations, not repeated renders or query/hash changes", () => {
    const f = fixture(); f.navigate("/"); f.flush();
    f.navigate("/stats"); f.flush();
    f.collector.observe("/stats?search=secret#account", config); f.flush();
    f.navigate("/stats"); f.flush();
    f.navigate("/"); f.flush();
    expect(f.post.mock.calls.map(([payload]) => payload.path)).toEqual(["/", "/stats", "/"]);
    expect(f.post.mock.calls.map(([payload]) => payload.referrer)).toEqual(["google", "internal", "internal"]);
    expect(new Set(f.post.mock.calls.map(([payload]) => payload.eventId)).size).toBe(3);
  });

  it("counts dynamic route changes independently but sends canonical route templates", () => {
    const f = fixture();
    f.navigate("/player/201939"); f.flush();
    f.navigate("/player/2544"); f.flush();
    expect(f.post).toHaveBeenCalledTimes(2);
    expect(f.post.mock.calls[0][0].path).toBe(f.post.mock.calls[1][0].path);
    expect(f.post.mock.calls[0][0].path).not.toContain("201939");
  });

  it("rejects admin, API, preview, arbitrary and encoded paths before scheduling", () => {
    for (const path of ["/admin", "/admin/people", "/api/analytics/pageview", "/preview", "/something-private", "/player/email@example.com", "/game/%2Fadmin", "/%61dmin", "/offline"]) {
      const f = fixture(); f.navigate(path); f.flush();
      expect(f.browser.schedule).not.toHaveBeenCalled(); expect(f.post).not.toHaveBeenCalled();
    }
  });

  it("returning from an excluded page is a new navigation", () => {
    const f = fixture(); f.navigate("/stats"); f.flush();
    f.navigate("/admin"); f.flush(); f.navigate("/stats"); f.flush();
    expect(f.post).toHaveBeenCalledTimes(2);
  });

  it("never sends while hidden/prerendered and waits for actual visibility", () => {
    const f = fixture(); f.state.visible = false; const stop = f.navigate("/");
    expect(f.pending.size).toBe(0); f.flush(); expect(f.post).not.toHaveBeenCalled();
    f.show(); f.flush(); expect(f.post).toHaveBeenCalledOnce();
    stop(); expect(f.visibility.size).toBe(0);
  });

  it("rechecks visibility, domain and privacy at dispatch", () => {
    const hidden = fixture(); hidden.navigate("/"); hidden.state.visible = false; hidden.flush();
    expect(hidden.post).not.toHaveBeenCalled(); hidden.show(); hidden.flush(); expect(hidden.post).toHaveBeenCalledOnce();
    for (const changed of [{ privacyOptOut: true }, { origin: "https://preview.vercel.app" }, { pathname: "/admin" }]) {
      const f = fixture(); f.navigate("/"); Object.assign(f.state, changed); f.flush();
      expect(f.post).not.toHaveBeenCalled();
    }
  });

  it("cancels superseded work with a single pending slot and no delayed queue", () => {
    const f = fixture(); f.navigate("/"); f.navigate("/stats"); f.navigate("/news");
    expect(f.pending.size).toBe(1); f.flush();
    expect(f.post).toHaveBeenCalledOnce(); expect(f.post.mock.calls[0][0].path).toBe("/news");
    const stop = f.navigate("/calendar"); stop(); f.flush(); expect(f.post).toHaveBeenCalledOnce();
  });

  it("does not send without secure randomness or regenerate a browser identifier", () => {
    const f = fixture(); f.browser.eventId = vi.fn(() => null);
    f.navigate("/"); f.flush(); f.navigate("/"); f.flush();
    expect(f.post).not.toHaveBeenCalled(); expect(f.browser.eventId).toHaveBeenCalledOnce();
  });

  it("counts a bfcache restoration once with a fresh event ID", () => {
    const f = fixture(); f.navigate("/"); f.flush();
    f.collector.observe("/", config, true); f.flush(); f.navigate("/"); f.flush();
    expect(f.post).toHaveBeenCalledTimes(2);
    expect(f.post.mock.calls[1][0].referrer).toBe("internal");
    expect(f.post.mock.calls[0][0].eventId).not.toBe(f.post.mock.calls[1][0].eventId);
  });
});

describe("local coarse classification", () => {
  it.each([
    ["", "direct"], ["https://nba.xpy.me/search?q=secret", "internal"],
    ["https://www.google.com/search?q=private", "google"], ["https://news.google.co.uk/path", "google"],
    ["https://www.baidu.com/s?wd=private", "baidu"], ["https://bing.com/search?q=private", "bing"],
    ["https://duckduckgo.com/?q=private", "duckduckgo"], ["https://t.co/token", "social"],
    ["https://www.reddit.com/r/private", "social"], ["https://secret-company.example/path", "other"],
    ["https://google.com.evil.test/", "other"], ["https://evilgoogle.com/", "other"],
    ["data:text/html,secret", "other"], ["javascript:alert(1)", "other"],
    ["https://user:password@google.com/", "other"], ["//google.com/path", "other"], ["broken", "other"],
  ] as const)("reduces %s to %s without arbitrary hostname output", (raw, bucket) => {
    expect(classifyPageviewReferrer(raw, config.productionOrigin)).toBe(bucket);
  });

  it.each([[0, "unknown"], [-1, "unknown"], [NaN, "unknown"], [Infinity, "unknown"], [390, "mobile"], [767, "mobile"], [768, "tablet"], [1023, "tablet"], [1024, "desktop"]] as const)("buckets viewport width %s as %s", (width, bucket) => {
    expect(classifyPageviewDevice(width)).toBe(bucket);
  });
});

describe("browser privacy and transport", () => {
  function browserGlobals() {
    const win = { location: { origin: config.productionOrigin, pathname: "/" }, innerWidth: 390, doNotTrack: undefined as string | undefined };
    const doc = { visibilityState: "visible", prerendering: false, referrer: "", addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const nav = { doNotTrack: "0", globalPrivacyControl: false, msDoNotTrack: undefined as string | undefined };
    vi.stubGlobal("window", win); vi.stubGlobal("document", doc); vi.stubGlobal("navigator", nav);
    // The collector must never touch cookie/local/session storage.
    for (const key of ["localStorage", "sessionStorage"]) Object.defineProperty(win, key, { get() { throw new Error("No storage permitted"); } });
    Object.defineProperty(doc, "cookie", { get() { throw new Error("No cookie permitted"); }, set() { throw new Error("No cookie permitted"); } });
    return { win, doc, nav };
  }

  it("honors DNT, legacy explicit DNT and GPC, and refuses speculative prerenders", () => {
    const { win, doc, nav } = browserGlobals(); const adapter = createBrowserPageviewAdapter();
    expect(adapter.read().privacyOptOut).toBe(false);
    nav.doNotTrack = "1"; expect(adapter.read().privacyOptOut).toBe(true);
    nav.doNotTrack = "yes"; expect(adapter.read().privacyOptOut).toBe(true);
    nav.doNotTrack = "0"; nav.globalPrivacyControl = true; expect(adapter.read().privacyOptOut).toBe(true);
    nav.globalPrivacyControl = false; nav.msDoNotTrack = "1"; expect(adapter.read().privacyOptOut).toBe(true);
    nav.msDoNotTrack = undefined; win.doNotTrack = "yes"; expect(adapter.read().privacyOptOut).toBe(true);
    doc.prerendering = true; expect(adapter.read().visible).toBe(false);
    doc.prerendering = false; doc.visibilityState = "hidden"; expect(adapter.read().visible).toBe(false);
  });

  it("uses a cancellable idle callback or short timer, without polling", () => {
    const { win } = browserGlobals(); vi.useFakeTimers(); const callback = vi.fn();
    const adapter = createBrowserPageviewAdapter(); const cancel = adapter.schedule(callback); cancel();
    vi.advanceTimersByTime(3000); expect(callback).not.toHaveBeenCalled();
    adapter.schedule(callback); vi.advanceTimersByTime(1000); expect(callback).toHaveBeenCalledOnce();
    const requestIdleCallback = vi.fn(() => 42); const cancelIdleCallback = vi.fn();
    Object.assign(win, { requestIdleCallback, cancelIdleCallback });
    const stop = adapter.schedule(callback); expect(requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 2000 });
    stop(); expect(cancelIdleCallback).toHaveBeenCalledWith(42);
  });

  it("posts only allowed fields with no Referer or cookies and no response parsing", async () => {
    vi.useFakeTimers(); const json = vi.fn(); const fetch = vi.fn().mockResolvedValue({ ok: true, json }); vi.stubGlobal("fetch", fetch);
    postAnonymousPageview({ ...event, browserId: "never-send", rawReferrer: "https://private.example/?secret=1" } as AnonymousPageview);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe("/api/analytics/pageview"); expect(JSON.parse(request.body)).toEqual(event);
    expect(request).toMatchObject({ method: "POST", mode: "same-origin", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", keepalive: true });
    await vi.runAllTimersAsync(); expect(json).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds the payload and aborts a slow request once without retries", () => {
    vi.useFakeTimers(); const fetch = vi.fn(() => new Promise(() => {})); vi.stubGlobal("fetch", fetch);
    postAnonymousPageview({ ...event, path: "/" + "x".repeat(2048) }); expect(fetch).not.toHaveBeenCalled();
    postAnonymousPageview(event); const signal = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal;
    expect(signal?.aborted).toBe(false); vi.advanceTimersByTime(PAGEVIEW_REQUEST_TIMEOUT_MS); expect(signal?.aborted).toBe(true);
    vi.advanceTimersByTime(60000); expect(fetch).toHaveBeenCalledOnce();
  });

  it("silently drops rejected and synchronously throwing requests without retry", async () => {
    vi.useFakeTimers(); const fetch = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetch);
    postAnonymousPageview(event); await vi.runAllTimersAsync(); expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    fetch.mockImplementation(() => { throw new Error("unsupported"); });
    expect(() => postAnonymousPageview(event)).not.toThrow(); expect(vi.getTimerCount()).toBe(0); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
