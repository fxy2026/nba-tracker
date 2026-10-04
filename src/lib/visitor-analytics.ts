/** Public, secret-free analytics contract. No browser identifier is collected by default. */
export const ANALYTICS_TIMEZONE = "Asia/Shanghai" as const;
export const ANALYTICS_REFERRERS = ["direct", "internal", "google", "baidu", "bing", "duckduckgo", "social", "other"] as const;
export const ANALYTICS_DEVICES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type AnalyticsReferrer = typeof ANALYTICS_REFERRERS[number];
export type AnalyticsDevice = typeof ANALYTICS_DEVICES[number];
export type AnalyticsDays = 7 | 30;
export interface AnalyticsPageview {
  eventId: string;
  path: string;
  referrer: AnalyticsReferrer;
  device: AnalyticsDevice;
  /** Only an explicit, affirmative analytics-consent adapter may supply this. */
  identity?: { consent: true; day: string; token: string };
}
export interface AnalyticsCounts {
  pageViews: number;
  /** Consenting daily browsers, NOT people or the total audience. */
  visitors: number | null;
  identifiedPageViews: number;
  missingIdentityPageViews: number;
}
export interface VisitorAnalyticsReport {
  status: "ready" | "unconfigured" | "unavailable";
  timezone: typeof ANALYTICS_TIMEZONE;
  metric: "daily-browser";
  collectedSince: string | null;
  generatedAt: string;
  range: { days: AnalyticsDays; from: string; to: string };
  today: AnalyticsCounts | null;
  period: {
    pageViews: number;
    visitorDays: number | null;
    avgDailyVisitors: number | null;
    observedDays: number;
    identifiedPageViews: number;
    missingIdentityPageViews: number;
  } | null;
  series: Array<AnalyticsCounts & { date: string }> | null;
  pages: Array<{ path: string; pageViews: number }> | null;
  referrers: Array<{ source: AnalyticsReferrer; pageViews: number }> | null;
  /** Coarse viewport category, never a device fingerprint or actual device model. */
  devices: Array<{ device: AnalyticsDevice; pageViews: number }> | null;
  /** Reached collection's hard daily budget; figures may be incomplete. */
  limited: boolean;
}

const STATIC_PATHS = new Set([
  "/", "/about", "/all-time-leaders", "/awards-race", "/back-to-back", "/best-games", "/best-of-night",
  "/by-college", "/by-country", "/by-position", "/calendar", "/clutch-teams", "/clutch", "/compare",
  "/conference-race", "/divisions", "/draft-classes", "/draft/2026", "/explore", "/favorites", "/game-predictor",
  "/glossary", "/h2h", "/history", "/home-vs-road", "/iconic-games", "/iconic-seasons", "/injuries",
  "/lab/career-arc", "/lab/explore", "/lab/game-impact", "/lab", "/lab/team-trajectory", "/milestones",
  "/momentum", "/news", "/power-rankings", "/quiz", "/records", "/rivalries", "/rookie-watch",
  "/schedule-heatmap", "/schedule", "/scoring-output", "/search", "/season/2025-26", "/shot-archive",
  "/standings", "/stats", "/streaks", "/team-stats", "/this-day", "/tier-list", "/transactions",
]);
const DYNAMIC_PATHS: Array<[RegExp, string]> = [
  [/^\/game\/\d{8,12}$/, "/game/[id]"],
  [/^\/player\/\d{1,10}\/gamelog$/, "/player/[id]/gamelog"],
  [/^\/player\/\d{1,10}$/, "/player/[id]"],
  [/^\/legends\/\d{1,10}(?:-\d{4})?$/, "/legends/[id]"],
  [/^\/team\/[A-Z]{2,3}$/, "/team/[tricode]"],
  [/^\/series\/[A-Za-z0-9-]{1,48}$/, "/series/[id]"],
  [/^\/iconic-games\/\d{4}s?$/, "/iconic-games/[decade]"],
  [/^\/iconic-seasons\/\d{4}s?$/, "/iconic-seasons/[decade]"],
];
export const ANALYTICS_PATH_KEYS = [...STATIC_PATHS, ...DYNAMIC_PATHS.map(([, key]) => key)] as readonly string[];
/** Input must already be a pathname. Reject rather than accept query strings, URLs, or unknown routes. */
export function normalizeAnalyticsPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160 || /[?#%\\\x00-\x20]/.test(value)) return null;
  const path = value.length > 1 ? value.replace(/\/$/, "") : value;
  if (STATIC_PATHS.has(path)) return path;
  for (const [pattern, key] of DYNAMIC_PATHS) if (path === key || pattern.test(path)) return key;
  return null;
}

export function analyticsDay(now: Date = new Date()): string {
  // Asia/Shanghai is UTC+08:00 with no seasonal changes for the supported current dates.
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function analyticsRange(days: AnalyticsDays, now: Date = new Date()): VisitorAnalyticsReport["range"] {
  const to = analyticsDay(now);
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { days, from: start.toISOString().slice(0, 10), to };
}
