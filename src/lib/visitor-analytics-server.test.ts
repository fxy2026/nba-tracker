import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { collectAnalyticsPageview, getVisitorAnalyticsClientConfig, getVisitorAnalyticsReport, parseAnalyticsDays, readAnalyticsPageview } from "./visitor-analytics-server";
import { GET } from "../app/api/admin/analytics/route";
// Historical collector unit coverage only: the public POST route is retired.
const POST = collectAnalyticsPageview;
const event = { eventId: "18b18274-df2a-4f7c-b4cc-e737f3200302", path: "/player/201939", referrer: "direct", device: "mobile" };
const token = "345827fb-0c05-4629-ae03-98b42faeebca";
const now = new Date("2026-10-04T08:00:00Z");
// Deliberately unusable test fixtures, never credentials for any actual project.
const secretKey = "sb_secret_offline_test_only";
function legacyKey(payload: unknown = { role: "service_role" }) {
  return [JSON.stringify({ alg: "HS256", typ: "JWT" }), JSON.stringify(payload), "not-a-valid-signature"].map(part => Buffer.from(part).toString("base64url")).join(".");
}
let fetchMock: ReturnType<typeof vi.fn>;
function configure() {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VISITOR_ANALYTICS_ENABLED", "true"); vi.stubEnv("VISITOR_ANALYTICS_ORIGIN", "https://nba.example.com");
  vi.stubEnv("ANALYTICS_SUPABASE_URL", "https://analytics-project.supabase.co");
  vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", secretKey); vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SUPABASE_URL", "https://generic-project.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://replay-project.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_generic_test_only"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", legacyKey());
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", legacyKey({ role: "anon" })); vi.stubEnv("ADMIN_PASSWORD", "test-admin-password");
}
function request(body: unknown = event, headers: Record<string, string> = {}) {
  return new Request("https://nba.example.com/api/analytics/pageview", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://nba.example.com", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function store(days: unknown[] = [], dimensions: unknown[] = [], collected_since: string | null = null) { return Response.json({ days, dimensions, collected_since }); }
beforeEach(() => { configure(); fetchMock = vi.fn().mockResolvedValue(Response.json("recorded")); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("configuration and server credential boundary", () => {
  it.each([["VISITOR_ANALYTICS_ENABLED", ""], ["VISITOR_ANALYTICS_ENABLED", "1"], ["VERCEL_ENV", "preview"], ["VERCEL_ENV", "development"], ["NODE_ENV", "development"], ["ANALYTICS_SUPABASE_SECRET_KEY", ""], ["ANALYTICS_SUPABASE_URL", ""], ["ANALYTICS_SUPABASE_URL", "https://evil.test"], ["ANALYTICS_SUPABASE_URL", "https://project.supabase.co/path"], ["VISITOR_ANALYTICS_ORIGIN", "https://nba.example.com/"], ["VISITOR_ANALYTICS_ORIGIN", "http://nba.example.com"], ["VISITOR_ANALYTICS_ORIGIN", "https://localhost"]])("keeps disabled for %s=%s", async (name, value) => {
    vi.stubEnv(name, value); expect(getVisitorAnalyticsClientConfig()).toEqual({ enabled: false, origin: null });
    expect((await POST(request())).status).toBe(204);
    expect((await getVisitorAnalyticsReport(7, now)).status).toBe("unconfigured"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("exposes only a boolean and public origin to client", () => expect(getVisitorAnalyticsClientConfig()).toEqual({ enabled: true, origin: "https://nba.example.com" }));
  it("ignores the full generic integration bundle when dedicated analytics config is absent", async () => {
    vi.stubEnv("ANALYTICS_SUPABASE_URL", undefined); vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", undefined);
    vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", undefined);
    expect(getVisitorAnalyticsClientConfig()).toEqual({ enabled: false, origin: null });
    expect((await POST(request())).status).toBe(204);
    expect((await getVisitorAnalyticsReport(7, now)).status).toBe("unconfigured"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    "http://analytics-project.supabase.co", "https://analytics-project.supabase.co.evil.test",
    "https://nested.analytics-project.supabase.co", "https://analytics-project.supabase.co?project=other",
    "https://analytics-project.supabase.co#other", "https://analytics-project.supabase.co:8443",
    "https://user:password@analytics-project.supabase.co", "not-a-url",
  ])("never sends credentials to an invalid analytics destination %s", async url => {
    vi.stubEnv("ANALYTICS_SUPABASE_URL", url);
    expect((await POST(request())).status).toBe(204);
    expect((await getVisitorAnalyticsReport(7, now)).status).toBe("unconfigured"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["sb_publishable_offline_test_only", legacyKey({ role: "anon" }), legacyKey(), "sb_secret_", " sb_secret_test", "sb_secret_test\n", "test-server-key", "sb_secret_" + "x".repeat(4096)])("does not downgrade an invalid modern credential to legacy: %s", async key => {
    vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", key); vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", legacyKey());
    expect(getVisitorAnalyticsClientConfig()).toEqual({ enabled: false, origin: null });
    expect((await POST(request())).status).toBe(204);
    expect((await getVisitorAnalyticsReport(7, now)).status).toBe("unconfigured"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["sb_publishable_offline_test_only", secretKey, legacyKey({ role: "anon" }), legacyKey({ role: "authenticated" }), legacyKey({}), legacyKey(null), legacyKey([]), "not.a.jwt", "test-server-key", legacyKey() + "\n", "x".repeat(4097)])("rejects non-service-role or malformed legacy credentials: %s", async key => {
    vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", ""); vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", key);
    expect(getVisitorAnalyticsClientConfig()).toEqual({ enabled: false, origin: null });
    expect((await POST(request())).status).toBe(204);
    expect((await getVisitorAnalyticsReport(7, now)).status).toBe("unconfigured"); expect(fetchMock).not.toHaveBeenCalled();
  });
});
describe("dedicated Supabase credential transport", () => {
  it.each(["secret", "legacy"] as const)("uses documented %s headers for both RPCs without forwarding request credentials", async kind => {
    const key = kind === "secret" ? secretKey : legacyKey();
    vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", kind === "secret" ? secretKey : "");
    vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", legacyKey());
    vi.stubEnv("ANALYTICS_SUPABASE_URL", "https://analytics-project.supabase.co/");
    expect(getVisitorAnalyticsClientConfig()).toEqual({ enabled: true, origin: "https://nba.example.com" });
    const incoming = { Authorization: "Bearer caller-token", apikey: "caller-key", Cookie: "caller-cookie", "x-admin-password": "test-admin-password" };
    const collect = await POST(request(event, incoming)); expect(collect.status).toBe(204);
    fetchMock.mockResolvedValue(store());
    const report = await GET(new Request("https://nba.example.com/api/admin/analytics", { headers: incoming }));
    expect(report.status).toBe(200); expect((await report.clone().json()).status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://analytics-project.supabase.co/rest/v1/rpc/visitor_analytics_collect",
      "https://analytics-project.supabase.co/rest/v1/rpc/visitor_analytics_report",
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.headers).toEqual({ "Content-Type": "application/json", apikey: key, ...(kind === "legacy" ? { Authorization: `Bearer ${key}` } : {}) });
      expect(options.body).not.toContain(key);
    }
    expect(JSON.stringify(getVisitorAnalyticsClientConfig())).not.toContain(key);
    expect(await collect.text()).not.toContain(key); expect(await report.text()).not.toContain(key);
  });
  it("prefers the modern key without validating or transmitting the unused legacy value", async () => {
    vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", "invalid-unused-legacy-value");
    expect((await POST(request())).status).toBe(204);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "Content-Type": "application/json", apikey: secretKey });
  });
  it.each(["secret", "legacy"] as const)("treats rejected %s credentials as unavailable without leaking provider errors", async kind => {
    const key = kind === "secret" ? secretKey : legacyKey();
    vi.stubEnv("ANALYTICS_SUPABASE_SECRET_KEY", kind === "secret" ? key : "");
    vi.stubEnv("ANALYTICS_SUPABASE_SERVICE_ROLE_KEY", kind === "legacy" ? key : "");
    const log = vi.spyOn(console, "error");
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ error: `provider detail ${key}` }, { status: 401 })));
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Analytics unavailable" });
    const report = await getVisitorAnalyticsReport(7, now); expect(report.status).toBe("unavailable");
    expect(JSON.stringify(report)).not.toContain(key); expect(log).not.toHaveBeenCalled();
  });
});
describe("bounded privacy-safe collection", () => {
  it.each(["https://evil.example", "https://nba.example.com.evil.test", "null", ""])('rejects Origin "%s" before database', async origin => {
    expect((await POST(request(event, { Origin: origin }))).status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects cross-site Fetch Metadata", async () => { expect((await POST(request(event, { "Sec-Fetch-Site": "cross-site" }))).status).toBe(403); expect(fetchMock).not.toHaveBeenCalled(); });
  it.each(["DNT", "Sec-GPC"])("honors %s before storage", async header => { expect((await POST(request(event, { [header]: "1" }))).status).toBe(204); expect(fetchMock).not.toHaveBeenCalled(); });
  it.each([null, [], true, { ...event, eventId: "foo" }, { ...event, path: "/search?q=secret" }, { ...event, path: "/admin" }, { ...event, referrer: "private.example.com" }, { ...event, device: "iPhone" }, { ...event, ip: "1.2.3.4" }, { ...event, identity: { token, day: "2026-10-04", consent: false } }, { ...event, identity: { token: "stable-user-id", day: "2026-10-04", consent: true } }])("rejects invalid input %j", async body => { expect((await POST(request(body))).status).toBe(400); expect(fetchMock).not.toHaveBeenCalled(); });
  it.each(["text/plain", "application/x-www-form-urlencoded"])("rejects type %s", async type => { expect((await POST(request(event, { "Content-Type": type }))).status).toBe(415); });
  it("rejects malformed JSON, declared oversize, streamed oversize and encoded body", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(event, { "Content-Length": "9999" }))).status).toBe(413);
    expect((await POST(request(" ".repeat(2049)))).status).toBe(413);
    expect((await POST(request(event, { "Content-Encoding": "gzip" }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("limits trickling request body time and cancels its stream", async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const req = new Request("https://nba.example.com/api/analytics/pageview", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://nba.example.com" }, body: new ReadableStream({ cancel }), duplex: "half" } as RequestInit);
    const pending = POST(req); await vi.advanceTimersByTimeAsync(2001);
    expect((await pending).status).toBe(408); expect(cancel).toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("never accepts buffered valid JSON from a body that has not completed before timeout", async () => {
    vi.useFakeTimers();
    const req = new Request("https://nba.example.com/api/analytics/pageview", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://nba.example.com" }, body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(event))); } }), duplex: "half" } as RequestInit);
    const pending = POST(req); await vi.advanceTimersByTimeAsync(2001); expect((await pending).status).toBe(408); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("aborted buffered input cannot be accepted", async () => {
    const controller = new AbortController();
    const req = new Request("https://nba.example.com/api/analytics/pageview", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://nba.example.com" }, signal: controller.signal, body: new ReadableStream({ start(stream) { stream.enqueue(new TextEncoder().encode(JSON.stringify(event))); } }), duplex: "half" } as RequestInit);
    const pending = POST(req); await Promise.resolve(); controller.abort(); expect((await pending).status).toBe(408); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("counts anonymous event without visitor token, using canonical path and only scoped RPC fields", async () => {
    const res = await collectAnalyticsPageview(request()); expect(res.status).toBe(204);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://analytics-project.supabase.co/rest/v1/rpc/visitor_analytics_collect");
    expect(options.cache).toBe("no-store"); expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body)).toEqual({ p_event_id: event.eventId, p_path: "/player/[id]", p_referrer: "direct", p_device: "mobile", p_visitor_hash: null, p_identity_day: null });
    expect(res.headers.get("Cache-Control")).toContain("no-store"); expect(res.headers.get("Set-Cookie")).toBeNull();
  });
  it("uses only explicitly consented current-day identity, hashes it before database", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    expect((await POST(request({ ...event, identity: { consent: true, day: "2026-10-04", token } }))).status).toBe(204);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body); expect(body.p_visitor_hash).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(body)).not.toContain(token);
    expect(body.p_identity_day).toBe("2026-10-04");
    const stale = await readAnalyticsPageview(request({ ...event, identity: { consent: true, day: "2026-10-03", token } }), now); expect(stale.identity).toBeUndefined();
  });
  it.each(["recorded", "duplicate"])("acknowledges durable %s without local counter", async result => { fetchMock.mockResolvedValue(Response.json(result)); expect((await POST(request())).status).toBe(204); expect(fetchMock).toHaveBeenCalledTimes(1); });
  it("returns generic errors without logging provider details or accepting unknown RPC results", async () => {
    const log = vi.spyOn(console, "error"); fetchMock.mockRejectedValue(new Error("test-server-key + IP + body"));
    const res = await POST(request()); expect(res.status).toBe(503); expect(await res.text()).not.toContain("test-server-key"); expect(log).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(Response.json({ unexpected: true })); expect((await POST(request())).status).toBe(503);
    fetchMock.mockResolvedValue(Response.json("limited")); expect((await POST(request())).status).toBe(429);
  });
  it("times out RPC and preserves site response independence", async () => {
    vi.useFakeTimers(); fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("abort")))));
    const pending = POST(request()); await vi.advanceTimersByTimeAsync(2600); expect((await pending).status).toBe(503);
  });
});
describe("private reporting, real zero versus unavailable", () => {
  it("checks auth before config/query/database and never exposes secret", async () => {
    for (const password of [null, "wrong", "x".repeat(4097)]) {
      const req = new Request("https://nba.example.com/api/admin/analytics?days=garbage", { headers: password ? { "x-admin-password": password } : {} });
      const res = await GET(req); expect(res.status).toBe(401); expect(res.headers.get("Cache-Control")).toContain("private"); expect(res.headers.get("Vary")).toBe("x-admin-password");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["days=0", "days=365", "days=07", "days=7&days=30", "other=1", "days=7&raw=" + "x".repeat(600)])("rejects %s", async query => {
    const res = await GET(new Request("https://nba.example.com/api/admin/analytics?" + query, { headers: { "x-admin-password": "test-admin-password" } })); expect(res.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("allows only default7 or7/30", () => { expect(parseAnalyticsDays("https://x.test")).toBe(7); expect(parseAnalyticsDays("https://x.test?days=30")).toBe(30); });
  it("unconfigured returns nulls without network", async () => { vi.stubEnv("VISITOR_ANALYTICS_ENABLED", ""); const result = await getVisitorAnalyticsReport(7, now); expect(result).toMatchObject({ status: "unconfigured", today: null, period: null, series: null, pages: null, referrers: null, devices: null }); expect(fetchMock).not.toHaveBeenCalled(); });
  it("a real empty store is ready with measured PV0, UVnull and no invented historical bins", async () => {
    fetchMock.mockResolvedValue(store()); const result = await getVisitorAnalyticsReport(7, now);
    expect(result.status).toBe("ready"); expect(result.today).toMatchObject({ pageViews: 0, visitors: null, identifiedPageViews: 0 });
    expect(result.series).toEqual([]); expect(result.period).toMatchObject({ pageViews: 0, visitorDays: null, avgDailyVisitors: null, observedDays: 0 });
  });
  it("returns daily consenting browser counts, coverage, observed-days average and templates", async () => {
    fetchMock.mockResolvedValue(store([
      { day: "2026-10-03", page_views: 9, unique_browsers: 2, identified_page_views: 5, limited: false },
      { day: "2026-10-04", page_views: 11, unique_browsers: 3, identified_page_views: 8, limited: true },
    ], [{ dimension: "path", key: "/player/[id]", page_views: 20 }, { dimension: "referrer", key: "direct", page_views: 20 }, { dimension: "device", key: "mobile", page_views: 20 }], "2026-10-03T01:00:00Z"));
    const result = await getVisitorAnalyticsReport(7, now);
    expect(result).toMatchObject({ status: "ready", timezone: "Asia/Shanghai", limited: true, period: { pageViews: 20, visitorDays: 5, avgDailyVisitors: 2.5, observedDays: 2, identifiedPageViews: 13, missingIdentityPageViews: 7 }, today: { visitors: 3, pageViews: 11 } });
    expect(result.series).toHaveLength(2); expect(result.pages).toEqual([{ path: "/player/[id]", pageViews: 20 }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_from: "2026-09-28", p_to: "2026-10-04" });
  });
  it("never converts inconsistent or pre-collection store rows into false zero", async () => {
    const days = [{ day: "2026-10-04", page_views: 1, unique_browsers: 0, identified_page_views: 0, limited: false }];
    for (const response of [store(days), store(days, [], "2026-10-05T00:00:00Z"), store(days, [{ dimension: "path", key: "/", page_views: 1 }], "2026-10-04T00:00:00Z")]) {
      fetchMock.mockResolvedValue(response); const result = await getVisitorAnalyticsReport(7, now); expect(result.status).toBe("unavailable"); expect(result.period).toBeNull();
    }
  });
  it("missing RPC, network failure and malformed result stay unavailable, never empty", async () => {
    for (const response of [Response.json({}, { status: 404 }), store([{ day: "2026-10-04", page_views: 2, unique_browsers: 3, identified_page_views: 2, limited: false }]), store([], [{ dimension: "path", key: "/private?token=secret", page_views: 1 }])]) {
      fetchMock.mockResolvedValue(response); expect(await getVisitorAnalyticsReport(7, now)).toMatchObject({ status: "unavailable", today: null, series: null });
    }
    fetchMock.mockRejectedValue(new Error("offline")); expect((await getVisitorAnalyticsReport(7, now)).status).toBe("unavailable");
  });
});
