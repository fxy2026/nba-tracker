import type { BeforeSendEvent } from "@vercel/analytics/next";
import { normalizeAnalyticsPath } from "@/lib/visitor-analytics";

/** NODE_ENV alone also enables preview builds and local next start. */
export function isVercelAnalyticsProduction(nodeEnv?: string, vercelEnv?: string): boolean {
  return nodeEnv === "production" && vercelEnv === "production";
}

export function hasAnalyticsPrivacySignal(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const browser = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const legacy = window as Window & { doNotTrack?: string };
  return browser.globalPrivacyControl === true
    || [browser.doNotTrack, browser.msDoNotTrack, legacy.doNotTrack].some(value => value === "1" || value === "yes");
}

function hasSafeAnalyticsReferrer(): boolean {
  if (typeof document === "undefined") return false;
  if (!document.referrer) return true;
  try {
    const referrer = new URL(document.referrer);
    return ["http:", "https:"].includes(referrer.protocol) && !referrer.username && !referrer.password
      && !referrer.search && !referrer.hash && referrer.pathname === "/";
  } catch { return false; }
}

/** Do not even load the provider on a private route or an opted-out browser. */
export function canLoadVercelAnalytics(): boolean {
  if (hasAnalyticsPrivacySignal() || !hasSafeAnalyticsReferrer()) return false;
  try {
    const current = new URL(window.location.href);
    return current.protocol === "https:" && !!normalizeAnalyticsPath(current.pathname);
  } catch { return false; }
}

/**
 * Only the SDK's supported URL field is changed. It does not expose referrer.
 * Reject a path-bearing incoming referrer rather than forwarding private data;
 * our strict-origin response header protects subsequent same-site referrers too.
 */
export function filterVercelAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview" || !canLoadVercelAnalytics()) return null;
  try {
    const url = new URL(event.url);
    if (url.origin !== window.location.origin || url.username || url.password) return null;
    const path = normalizeAnalyticsPath(url.pathname);
    if (!path) return null;
    // Preserve public page categories while avoiding query terms and arbitrary IDs.
    url.pathname = path;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch { return null; }
}
