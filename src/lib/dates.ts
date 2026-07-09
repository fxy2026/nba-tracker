// Shared locale-aware date + relative-time formatting.
//
// The app's locale is a bare "zh" | "en" (see LocaleProvider); Intl wants BCP-47
// tags. This module is the single place that mapping lives, plus the two
// display shapes used across the UI: an absolute calendar date and a "X ago"
// relative label. Both are pure — pass the locale and a timestamp/date; never
// read Date.now() here so callers stay SSR/hydration-safe.

function toLocaleTag(locale: string): "zh-CN" | "en-US" {
  return locale === "zh" ? "zh-CN" : "en-US";
}

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/**
 * Locale-aware absolute date. Accepts an ISO string or a Date and preserves the
 * caller's exact Intl options. An unparseable string yields "" (a Date that is
 * already Invalid passes straight through to Intl, matching prior call sites).
 */
export function formatGameDate(
  dateOrIso: string | Date,
  locale: string,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (typeof dateOrIso === "string" && Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(toLocaleTag(locale), opts ?? DEFAULT_DATE_OPTS);
}

function minutesLabel(n: number, isZh: boolean): string {
  return isZh ? `${n} 分钟前` : `${n}m ago`;
}

function hoursLabel(n: number, isZh: boolean): string {
  return isZh ? `${n} 小时前` : `${n}h ago`;
}

/**
 * Relative time from an elapsed-milliseconds delta (now - then).
 *
 * - "ago" (NewsFeed): rounds up the min→hour→day ladder, floors sub-minute to
 *   1m, and returns "" past a week so the caller can substitute an absolute
 *   date (this helper only has the delta, not the source timestamp).
 * - "freshness" (UpdatedPill): floors each bucket and uses fixed "just now" /
 *   "stale" sentinels instead of a day bucket.
 */
export function formatRelative(
  ms: number,
  locale: string,
  variant: "ago" | "freshness"
): string {
  const isZh = locale === "zh";

  if (variant === "freshness") {
    if (ms < 60_000) return isZh ? "刚刚更新" : "Just now";
    if (ms < 60 * 60_000) return minutesLabel(Math.floor(ms / 60_000), isZh);
    if (ms < 24 * 60 * 60_000) return hoursLabel(Math.floor(ms / (60 * 60_000)), isZh);
    return isZh ? "数据较旧" : "Stale";
  }

  // "ago": ladder is rounded, and each rung is derived from the previous
  // (rounded) rung — not from the raw delta — to match the original NewsFeed.
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return minutesLabel(mins, isZh);
  const hours = Math.round(mins / 60);
  if (hours < 24) return hoursLabel(hours, isZh);
  const days = Math.round(hours / 24);
  if (days < 7) return isZh ? `${days} 天前` : `${days}d ago`;
  return "";
}
