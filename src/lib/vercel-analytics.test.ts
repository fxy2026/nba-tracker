import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canLoadVercelAnalytics, filterVercelAnalyticsEvent, hasAnalyticsPrivacySignal, isVercelAnalyticsProduction } from "./vercel-analytics";
import { POST } from "@/app/api/analytics/pageview/route";

function browser(href = "https://nba.example/about", referrer = "") {
  vi.stubGlobal("window", { location: new URL(href) });
  vi.stubGlobal("document", { referrer });
  vi.stubGlobal("navigator", { doNotTrack: "0", globalPrivacyControl: false });
}
beforeEach(() => browser());
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([
  ["production", "production", true], ["production", "preview", false],
  ["production", "development", false], ["production", undefined, false],
  ["development", "production", false], ["test", "production", false],
])("loads only in production Vercel deployments (%s/%s)", (node, vercel, expected) => {
  expect(isVercelAnalyticsProduction(node, vercel)).toBe(expected);
});

it("strips URL search/hash and groups public dynamic identifiers without mutating the original", () => {
  browser("https://nba.example/player/201939?q=private#secret", "https://search.example/");
  const event = { type: "pageview" as const, url: "https://nba.example/player/201939?q=private#secret" };
  expect(filterVercelAnalyticsEvent(event)).toEqual({ type: "pageview", url: "https://nba.example/player/[id]" });
  expect(event.url).toContain("?q=private");
  expect(filterVercelAnalyticsEvent({ type: "pageview", url: "https://nba.example/search?q=private#secret" })?.url).toBe("https://nba.example/search");
});

it.each(["/admin", "/admin/settings", "/api/admin", "/api/analytics/pageview", "/offline", "/unknown", "/player/email@example.com", "/player/%31", "/%61dmin"])("never sends or mounts on non-public path %s", path => {
  expect(filterVercelAnalyticsEvent({ type: "pageview", url: `https://nba.example${path}` })).toBeNull();
  browser(`https://nba.example${path}`);
  expect(canLoadVercelAnalytics()).toBe(false);
  expect(filterVercelAnalyticsEvent({ type: "pageview", url: "https://nba.example/" })).toBeNull();
});

it.each(["https://other.example/about", "javascript:alert(1)", "https://user:password@nba.example/about", "broken"])("rejects unsafe event URL %s", url => {
  expect(filterVercelAnalyticsEvent({ type: "pageview", url })).toBeNull();
});

it.each(["https://source.example/article", "https://source.example/?q=secret", "https://source.example/#secret", "https://user:password@source.example/", "https://nba.example/admin", "broken"])("does not initialize the provider or send when the SDK cannot redact referrer %s", referrer => {
  browser("https://nba.example/about", referrer);
  expect(canLoadVercelAnalytics()).toBe(false);
  expect(filterVercelAnalyticsEvent({ type: "pageview", url: "https://nba.example/about" })).toBeNull();
});

it.each(["", "https://source.example/", "https://nba.example/"])("accepts empty/domain-only referrers %s", referrer => {
  browser("https://nba.example/about", referrer);
  expect(canLoadVercelAnalytics()).toBe(true);
});

it.each([{ doNotTrack: "1" }, { doNotTrack: "yes" }, { msDoNotTrack: "1" }, { globalPrivacyControl: true }])("honors browser privacy preference %j before script load and each event", preference => {
  vi.stubGlobal("navigator", preference);
  expect(hasAnalyticsPrivacySignal()).toBe(true);
  expect(canLoadVercelAnalytics()).toBe(false);
  expect(filterVercelAnalyticsEvent({ type: "pageview", url: "https://nba.example/about" })).toBeNull();
});

it("honors legacy window DNT and rechecks preferences changed after mounting", () => {
  const event = { type: "pageview" as const, url: "https://nba.example/about" };
  expect(filterVercelAnalyticsEvent(event)).not.toBeNull();
  vi.stubGlobal("window", { location: new URL(event.url), doNotTrack: "1" });
  expect(filterVercelAnalyticsEvent(event)).toBeNull();
});

it("does not send custom events, server events or local HTTP events", () => {
  expect(filterVercelAnalyticsEvent({ type: "event", url: "https://nba.example/about" })).toBeNull();
  browser("http://localhost/about"); expect(canLoadVercelAnalytics()).toBe(false);
  vi.stubGlobal("window", undefined); expect(canLoadVercelAnalytics()).toBe(false);
});

describe("retired public collector", () => {
  it("is inert even with every legacy production setting enabled and a stale client", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VISITOR_ANALYTICS_ENABLED", "true");
    vi.stubEnv("VISITOR_ANALYTICS_ORIGIN", "https://nba.example");
    vi.stubEnv("ANALYTICS_SUPABASE_URL", "https://offline-fixture.supabase.co");
    vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", "sb_secret_offline_fixture_only");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    // Any stale request body/headers are ignored because the handler accepts no input.
    const response = await POST();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    const route = readFileSync("src/app/api/analytics/pageview/route.ts", "utf8");
    expect(route).not.toMatch(/^import |process\.env|request\.(?:json|text)|fetch\(/m);
  });
  it("mounts only official Analytics and keeps the explicit production gate", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("isVercelAnalyticsProduction(process.env.NODE_ENV, process.env.VERCEL_ENV)");
    expect(layout).toContain("analyticsEnabled && <VercelAnalytics />");
    expect(layout).not.toMatch(/CloudflareAnalytics|VisitorAnalytics|visitor-analytics-server/);
    expect(readFileSync("next.config.ts", "utf8")).toContain('key: "Referrer-Policy", value: "strict-origin"');
  });
});
