import "server-only";
import { createHash } from "node:crypto";
import { isAdminRequest } from "./admin-auth";
import {
  ANALYTICS_DEVICES, ANALYTICS_REFERRERS, ANALYTICS_TIMEZONE, analyticsDay, analyticsRange, normalizeAnalyticsPath,
  type AnalyticsCounts, type AnalyticsDays, type AnalyticsPageview, type VisitorAnalyticsReport,
} from "./visitor-analytics";

const MAX_BODY_BYTES = 2048;
const BODY_TIMEOUT_MS = 2000;
const RPC_TIMEOUT_MS = 2500;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", "Vary": "x-admin-password" };
export function analyticsResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}
export function analyticsNoContent(): Response { return new Response(null, { status: 204, headers: PRIVATE_HEADERS }); }

interface AnalyticsCredential { kind: "secret" | "legacy-service-role"; key: string }
interface AnalyticsConfig { origin: string; databaseUrl: string; credential: AnalyticsCredential }
/** Classify configured credentials only; Supabase must validate their authenticity and permissions. */
function getCredential(): AnalyticsCredential | null {
  const secret = process.env.ANALYTICS_SUPABASE_SECRET_KEY;
  // A configured but invalid modern key must not silently fall back to a legacy credential.
  if (secret) return secret.length <= 4096 && /^sb_secret_[A-Za-z0-9_-]+$/.test(secret) ? { kind: "secret", key: secret } : null;
  const legacy = process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY;
  if (!legacy || legacy.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(legacy)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(legacy.split(".")[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("role" in payload) || payload.role !== "service_role") return null;
    return { kind: "legacy-service-role", key: legacy };
  } catch { return null; }
}
/** Never export this object or its credentials to a client component. */
function getConfig(): AnalyticsConfig | null {
  if (process.env.VISITOR_ANALYTICS_ENABLED !== "true" || process.env.NODE_ENV !== "production") return null;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return null;
  const origin = process.env.VISITOR_ANALYTICS_ORIGIN;
  // Never inherit generic integration variables used by the separate legacy replay store.
  const databaseUrl = process.env.ANALYTICS_SUPABASE_URL;
  const credential = getCredential();
  if (!origin || !databaseUrl || !credential) return null;
  try {
    const site = new URL(origin);
    const database = new URL(databaseUrl);
    if (site.protocol !== "https:" || site.origin !== origin || site.username || site.password || site.port) return null;
    if (["localhost", "127.0.0.1", "::1"].includes(site.hostname)) return null;
    if (database.protocol !== "https:" || database.username || database.password || database.search || database.hash || database.port || !["", "/"].includes(database.pathname)) return null;
    // Keys are sent only to the specifically configured Supabase project, never to request-supplied URLs.
    if (!/^[a-z0-9-]+\.supabase\.co$/.test(database.hostname)) return null;
    return { origin, databaseUrl: database.origin, credential };
  } catch { return null; }
}
/** Safe boolean for a server layout to pass into a disabled-by-default collector. */
export function isVisitorAnalyticsEnabled(): boolean { return getConfig() !== null; }
export function getVisitorAnalyticsClientConfig(): { enabled: boolean; origin: string | null } {
  const config = getConfig();
  return { enabled: config !== null, origin: config?.origin ?? null };
}

export function isAnalyticsAdmin(request: Request): boolean { return isAdminRequest(request); }
export function parseAnalyticsDays(url: string): AnalyticsDays | null {
  if (url.length > 512) return null;
  const params = new URL(url).searchParams;
  if ([...params.keys()].some(key => key !== "days") || params.getAll("days").length > 1) return null;
  const value = params.get("days") ?? "7";
  return value === "7" ? 7 : value === "30" ? 30 : null;
}
export class AnalyticsRequestError extends Error {
  constructor(readonly status: number) { super("Invalid analytics request"); }
}

export async function readAnalyticsPageview(request: Request, now = new Date()): Promise<AnalyticsPageview> {
  if (new URL(request.url).search) throw new AnalyticsRequestError(400);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new AnalyticsRequestError(415);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new AnalyticsRequestError(413);
  if (request.headers.get("content-encoding")) throw new AnalyticsRequestError(415);
  const reader = request.body?.getReader();
  if (!reader) throw new AnalyticsRequestError(400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    const stop = () => { timedOut = true; reject(new AnalyticsRequestError(408)); void reader.cancel().catch(() => {}); };
    onAbort = stop;
    timer = setTimeout(stop, BODY_TIMEOUT_MS);
    if (request.signal.aborted) stop();
    else request.signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { void reader.cancel().catch(() => {}); throw new AnalyticsRequestError(413); }
      chunks.push(value);
    }
  } finally { clearTimeout(timer!); request.signal.removeEventListener("abort", onAbort); reader.releaseLock(); }
  if (timedOut || request.signal.aborted) throw new AnalyticsRequestError(408);
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AnalyticsRequestError(400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AnalyticsRequestError(400);
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !["eventId", "path", "referrer", "device", "identity"].includes(key))) throw new AnalyticsRequestError(400);
  const path = normalizeAnalyticsPath(input.path);
  if (typeof input.eventId !== "string" || !UUID_V4.test(input.eventId) || !path ||
    !ANALYTICS_REFERRERS.includes(input.referrer as AnalyticsPageview["referrer"]) ||
    !ANALYTICS_DEVICES.includes(input.device as AnalyticsPageview["device"])) throw new AnalyticsRequestError(400);
  const result: AnalyticsPageview = { eventId: input.eventId.toLowerCase(), path, referrer: input.referrer as AnalyticsPageview["referrer"], device: input.device as AnalyticsPageview["device"] };
  if (input.identity !== undefined) {
    if (!input.identity || typeof input.identity !== "object" || Array.isArray(input.identity)) throw new AnalyticsRequestError(400);
    const id = input.identity as Record<string, unknown>;
    if (Object.keys(id).some(key => !["consent", "day", "token"].includes(key)) || id.consent !== true || typeof id.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(id.day) || typeof id.token !== "string" || !UUID_V4.test(id.token)) throw new AnalyticsRequestError(400);
    // Midnight racing or stale storage must not link yesterday's browser token to today.
    if (id.day === analyticsDay(now)) result.identity = { consent: true, day: id.day, token: id.token.toLowerCase() };
  }
  return result;
}

function hasSameOrigin(request: Request, origin: string): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  return request.headers.get("origin") === origin && (!fetchSite || fetchSite === "same-origin");
}

async function rpc(config: AnalyticsConfig, name: "visitor_analytics_collect" | "visitor_analytics_report", body: object): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.databaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST", cache: "no-store", redirect: "error", signal: controller.signal,
      headers: {
        "Content-Type": "application/json", apikey: config.credential.key,
        // Modern secret keys are opaque, not JWTs. Only legacy service-role JWTs use Bearer.
        ...(config.credential.kind === "legacy-service-role" ? { Authorization: `Bearer ${config.credential.key}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Analytics store unavailable");
    return await response.json();
  } finally { clearTimeout(timeout); }
}

/** Await the durable atomic RPC; never claim success after a detached serverless promise. */
export async function collectAnalyticsPageview(request: Request): Promise<Response> {
  const config = getConfig();
  if (!config) return analyticsNoContent();
  if (!hasSameOrigin(request, config.origin)) return analyticsResponse({ error: "Invalid origin" }, 403);
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return analyticsNoContent();
  let event: AnalyticsPageview;
  try { event = await readAnalyticsPageview(request); }
  catch (error) { return analyticsResponse({ error: "Invalid analytics request" }, error instanceof AnalyticsRequestError ? error.status : 400); }
  try {
    const visitorHash = event.identity ? createHash("sha256").update(`${event.identity.day}:${event.identity.token}`).digest("hex") : null;
    const result = await rpc(config, "visitor_analytics_collect", {
      p_event_id: event.eventId, p_path: event.path, p_referrer: event.referrer, p_device: event.device,
      p_visitor_hash: visitorHash, p_identity_day: event.identity?.day ?? null,
    });
    if (result === "limited") return analyticsResponse({ error: "Collection limit reached" }, 429);
    if (result !== "recorded" && result !== "duplicate") throw new Error("Invalid analytics store response");
    return analyticsNoContent();
  } catch {
    // Never log the body, Origin/Referer, IP, identifier, credentials, or provider error text.
    return analyticsResponse({ error: "Analytics unavailable" }, 503);
  }
}

interface StoreDay { day: string; page_views: number; unique_browsers: number; identified_page_views: number; limited: boolean }
interface StoreDimension { dimension: "path" | "referrer" | "device"; key: string; page_views: number }
interface StoreReport { collected_since: string | null; days: StoreDay[]; dimensions: StoreDimension[] }
function validCount(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function parseStoreReport(data: unknown, range: VisitorAnalyticsReport["range"]): StoreReport {
  if (!data || typeof data !== "object") throw new Error("Invalid store report");
  const result = data as StoreReport;
  if (!(result.collected_since === null || (typeof result.collected_since === "string" && !Number.isNaN(Date.parse(result.collected_since)))) ||
      !Array.isArray(result.days) || result.days.length > range.days || !Array.isArray(result.dimensions) || result.dimensions.length > 100) throw new Error("Invalid store report");
  const seen = new Set<string>();
  for (const day of result.days) {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day.day) || day.day < range.from || day.day > range.to || seen.has(day.day) ||
      !validCount(day.page_views) || !validCount(day.unique_browsers) || !validCount(day.identified_page_views) ||
      day.unique_browsers > day.identified_page_views || day.identified_page_views > day.page_views || typeof day.limited !== "boolean") throw new Error("Invalid store report");
    seen.add(day.day);
  }
  const collectedDay = result.collected_since ? analyticsDay(new Date(result.collected_since)) : null;
  if (result.days.some(row => row.page_views > 0 && (!collectedDay || row.day < collectedDay))) throw new Error("Inconsistent store report");
  const dimensionKeys = new Set<string>();
  for (const dimension of result.dimensions) {
    if (!dimension || !validCount(dimension.page_views) || !(dimension.dimension === "path" ? normalizeAnalyticsPath(dimension.key) === dimension.key :
      dimension.dimension === "referrer" ? ANALYTICS_REFERRERS.includes(dimension.key as AnalyticsPageview["referrer"]) :
      dimension.dimension === "device" && ANALYTICS_DEVICES.includes(dimension.key as AnalyticsPageview["device"]))) throw new Error("Invalid store report");
    const dimensionKey = `${dimension.dimension}:${dimension.key}`;
    if (dimensionKeys.has(dimensionKey)) throw new Error("Duplicate store dimension");
    dimensionKeys.add(dimensionKey);
  }
  const total = result.days.reduce((sum, row) => sum + row.page_views, 0);
  for (const kind of ["path", "referrer", "device"] as const) {
    if (result.dimensions.filter(row => row.dimension === kind).reduce((sum, row) => sum + row.page_views, 0) !== total) throw new Error("Inconsistent store dimensions");
  }
  return result;
}
export function emptyAnalyticsReport(days: AnalyticsDays, status: "unconfigured" | "unavailable", now = new Date()): VisitorAnalyticsReport {
  return { status, timezone: ANALYTICS_TIMEZONE, metric: "daily-browser", collectedSince: null, generatedAt: now.toISOString(), range: analyticsRange(days, now), today: null, period: null, series: null, pages: null, referrers: null, devices: null, limited: false };
}
function counts(row?: StoreDay): AnalyticsCounts {
  const pageViews = row?.page_views ?? 0;
  const identifiedPageViews = row?.identified_page_views ?? 0;
  return { pageViews, identifiedPageViews, missingIdentityPageViews: pageViews - identifiedPageViews, visitors: identifiedPageViews > 0 ? row!.unique_browsers : null };
}
export async function getVisitorAnalyticsReport(days: AnalyticsDays, now = new Date()): Promise<VisitorAnalyticsReport> {
  const config = getConfig();
  if (!config) return emptyAnalyticsReport(days, "unconfigured", now);
  const base = emptyAnalyticsReport(days, "unavailable", now);
  try {
    const data = parseStoreReport(await rpc(config, "visitor_analytics_report", { p_from: base.range.from, p_to: base.range.to }), base.range);
    const series: NonNullable<VisitorAnalyticsReport["series"]> = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(`${base.range.from}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + i);
      const date = day.toISOString().slice(0, 10);
      if (data.collected_since && date >= analyticsDay(new Date(data.collected_since))) {
        series.push({ date, ...counts(data.days.find(row => row.day === date)) });
      }
    }
    const pageViews = series.reduce((sum, row) => sum + row.pageViews, 0);
    const identifiedPageViews = series.reduce((sum, row) => sum + row.identifiedPageViews, 0);
    const visitorDays = identifiedPageViews > 0 ? series.reduce((sum, row) => sum + (row.visitors ?? 0), 0) : null;
    return { ...base, status: "ready", collectedSince: data.collected_since, today: counts(data.days.find(row => row.day === base.range.to)),
      period: { pageViews, identifiedPageViews, missingIdentityPageViews: pageViews - identifiedPageViews, visitorDays, avgDailyVisitors: visitorDays === null || series.length === 0 ? null : visitorDays / series.length, observedDays: series.length },
      series, limited: data.days.some(row => row.limited),
      pages: data.dimensions.filter(row => row.dimension === "path").map(row => ({ path: row.key, pageViews: row.page_views })),
      referrers: data.dimensions.filter(row => row.dimension === "referrer").map(row => ({ source: row.key as AnalyticsPageview["referrer"], pageViews: row.page_views })),
      devices: data.dimensions.filter(row => row.dimension === "device").map(row => ({ device: row.key as AnalyticsPageview["device"], pageViews: row.page_views })),
    };
  } catch { return base; }
}
