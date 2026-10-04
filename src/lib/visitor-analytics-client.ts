import { normalizeAnalyticsPath, type AnalyticsPageview } from "@/lib/visitor-analytics";

// No visitor identifier, cookies, storage, user-agent, fingerprint, query or hash.
export type AnonymousPageview = Pick<AnalyticsPageview, "eventId" | "path" | "referrer" | "device">;
export interface VisitorCollectorConfig {
  enabled?: boolean;
  productionOrigin?: string | null;
}

export interface PageviewBrowserState {
  origin: string;
  pathname: string;
  referrer: string;
  width: number;
  privacyOptOut: boolean;
  visible: boolean;
}

export interface PageviewBrowser {
  read(): PageviewBrowserState;
  schedule(callback: () => void): () => void;
  onVisible(callback: () => void): () => void;
  eventId(): string | null;
  post(event: AnonymousPageview): void;
}

const GOOGLE_HOSTS = ["google.com", "google.co.uk", "google.ca", "google.de", "google.fr", "google.co.jp", "google.com.au", "google.co.in", "google.com.hk", "google.com.tw", "google.com.sg", "google.com.br"];
const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "x.com", "twitter.com", "t.co", "reddit.com", "linkedin.com", "youtube.com", "youtu.be", "weibo.com", "weibo.cn"];
const isHost = (host: string, domains: readonly string[]) => domains.some(domain => host === domain || host.endsWith(`.${domain}`));

/** Reduce a document referrer to a fixed bucket locally; never send its host. */
export function classifyPageviewReferrer(raw: string, origin: string): AnonymousPageview["referrer"] {
  if (!raw) return "direct";
  if (raw.length > 2048) return "other";
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "other";
    if (url.origin === origin) return "internal";
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (isHost(host, GOOGLE_HOSTS)) return "google";
    if (isHost(host, ["baidu.com"])) return "baidu";
    if (isHost(host, ["bing.com"])) return "bing";
    if (isHost(host, ["duckduckgo.com"])) return "duckduckgo";
    if (isHost(host, SOCIAL_HOSTS)) return "social";
  } catch { /* Invalid/opaque referrers get no identifying fallback. */ }
  return "other";
}

/** Coarse layout bucket, not inferred hardware or a user-agent measurement. */
export function classifyPageviewDevice(width: number): AnonymousPageview["device"] {
  if (!Number.isFinite(width) || width <= 0) return "unknown";
  if (width < 768) return "mobile";
  return width < 1024 ? "tablet" : "desktop";
}

function canCollect(config: VisitorCollectorConfig, state: PageviewBrowserState) {
  if (config.enabled !== true || !config.productionOrigin || state.privacyOptOut) return false;
  try {
    const expected = new URL(config.productionOrigin);
    return expected.protocol === "https:" && expected.origin === config.productionOrigin &&
      !expected.username && !expected.password && state.origin === expected.origin;
  } catch { return false; }
}

/** One in-memory navigation slot, not a visit history or retry queue. */
export function createPageviewCollector(browser: PageviewBrowser) {
  let navigation: { key: string; attempted: boolean; referrer: AnonymousPageview["referrer"] } | undefined;
  let stopPending = () => {};

  return {
    observe(pathname: string, config: VisitorCollectorConfig = {}, restored = false): () => void {
      stopPending();
      // The default-disabled path does not even inspect browser state.
      if (config.enabled !== true) return () => {};
      const initial = browser.read();
      // Treat query/hash changes as the same navigation, even if a caller passes
      // more than Next's usePathname value. No query/hash enters the payload.
      const key = pathname.split(/[?#]/, 1)[0];
      if (!navigation || navigation.key !== key || restored) {
        navigation = {
          key,
          attempted: false,
          referrer: navigation ? "internal" : classifyPageviewReferrer(initial.referrer, initial.origin),
        };
      }
      const current = navigation;
      const path = normalizeAnalyticsPath(key);
      if (current.attempted || !path || !canCollect(config, initial)) return () => {};

      let cancelled = false;
      let cancelSchedule = () => {};
      let stopVisibility = () => {};
      const stop = () => {
        cancelled = true;
        cancelSchedule();
        stopVisibility();
      };
      stopPending = stop;

      const enqueue = () => {
        if (cancelled) return;
        stopVisibility();
        cancelSchedule();
        cancelSchedule = browser.schedule(() => {
          if (cancelled || current !== navigation || current.attempted) return;
          const state = browser.read();
          if (!state.visible) {
            stopVisibility = browser.onVisible(enqueue);
            return;
          }
          // Re-check all privacy/domain/path gates at dispatch, not just mount.
          if (!canCollect(config, state) || state.pathname !== key) return;
          current.attempted = true;
          const eventId = browser.eventId();
          if (!eventId) return; // No weak random/browser-identifier fallback.
          browser.post({ eventId, path, referrer: current.referrer, device: classifyPageviewDevice(state.width) });
        });
      };
      if (initial.visible) enqueue();
      else stopVisibility = browser.onVisible(enqueue);
      return stop;
    },
  };
}

export const PAGEVIEW_REQUEST_TIMEOUT_MS = 4000;

/** Best effort: no retries, unload beacon, offline buffering or response body. */
export function postAnonymousPageview(event: AnonymousPageview): void {
  // Pick the only permitted fields even if a future caller carries extra data.
  const { eventId, path, referrer, device } = event;
  const body = JSON.stringify({ eventId, path, referrer, device });
  if (body.length > 1024) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGEVIEW_REQUEST_TIMEOUT_MS);
  try {
    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      mode: "same-origin",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {}).finally(() => clearTimeout(timeout));
  } catch { clearTimeout(timeout); }
}

export function createBrowserPageviewAdapter(): PageviewBrowser {
  const visible = () => document.visibilityState === "visible" &&
    !(document as Document & { prerendering?: boolean }).prerendering;
  return {
    read() {
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
      const win = window as Window & { doNotTrack?: string };
      const optOut = [nav.doNotTrack, nav.msDoNotTrack, win.doNotTrack]
        .some(value => value === "1" || value?.toLowerCase() === "yes");
      return {
        origin: window.location.origin,
        pathname: window.location.pathname,
        referrer: document.referrer,
        width: window.innerWidth,
        privacyOptOut: nav.globalPrivacyControl === true || optOut,
        visible: visible(),
      };
    },
    schedule(callback) {
      if (typeof window.requestIdleCallback === "function" && typeof window.cancelIdleCallback === "function") {
        const handle = window.requestIdleCallback(callback, { timeout: 2000 });
        return () => window.cancelIdleCallback(handle);
      }
      const handle = setTimeout(callback, 1000);
      return () => clearTimeout(handle);
    },
    onVisible(callback) {
      const changed = () => { if (visible()) callback(); };
      document.addEventListener("visibilitychange", changed);
      document.addEventListener("prerenderingchange", changed);
      return () => {
        document.removeEventListener("visibilitychange", changed);
        document.removeEventListener("prerenderingchange", changed);
      };
    },
    eventId() {
      try { return typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : null; }
      catch { return null; }
    },
    post: postAnonymousPageview,
  };
}
