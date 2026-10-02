import { TEAM_META } from "./teams";

// localStorage-backed "recently viewed" tracker for player / team / game / series
// detail pages. Used to power the RecentlyViewed component on the homepage.
// Capped at 12 entries per kind so the storage stays small.

export type RecentKind = "player" | "team" | "game" | "series";

export interface RecentItem {
  kind: RecentKind;
  id: string;     // personId / tricode / gameId (all serialized to string for storage)
  label: string;  // display label (player name / team city+name / "AWAY @ HOME")
  ts: number;     // ms-since-epoch when last viewed
}

const KEY = "nba-tracker-recent";
const MAX_PER_KIND = 12;

/** A canonical playoff series prefix; round sizes are 8 / 4 / 2 / 1. */
function isSeriesId(id: string): boolean {
  return /^004\d{2}00[1-4][0-7]$/.test(id) && Number(id[8]) < 2 ** (4 - Number(id[7]));
}

export function normalizeRecentItem(value: unknown): RecentItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.label !== "string" || !row.label.trim() || row.label.length > 200 || typeof row.ts !== "number" || !Number.isFinite(row.ts) || row.ts < 0) return null;
  // Old series pages saved their canonical nine-digit prefix as a game.
  // Ten-digit real/synthetic game IDs are never reclassified.
  const kind = row.kind === "game" && isSeriesId(row.id) ? "series" : row.kind;
  const valid = kind === "series" ? isSeriesId(row.id)
    : kind === "game" ? /^\d{10}$/.test(row.id)
    : kind === "player" ? /^[1-9]\d{0,14}$/.test(row.id) && Number.isSafeInteger(Number(row.id))
    : kind === "team" ? Object.hasOwn(TEAM_META, row.id) : false;
  if (!valid) return null;
  return { kind: kind as RecentKind, id: row.id, label: row.label, ts: row.ts };
}

export function recentItemHref(item: RecentItem): string | null {
  const valid = normalizeRecentItem(item);
  return valid ? `/${valid.kind}/${valid.id}` : null;
}

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const items = parsed.map(normalizeRecentItem).filter((item): item is RecentItem => item !== null).sort((a, b) => b.ts - a.ts);
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch { return []; }
}

function write(items: RecentItem[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(items)); }
  catch { /* storage full or disabled — silently ignore */ }
}

// Record a visit. Moves the item to the front if it already exists,
// otherwise prepends. Keeps at most MAX_PER_KIND per kind.
export function recordVisit(kind: RecentKind, id: string, label: string): void {
  const next = normalizeRecentItem({ kind, id, label, ts: Date.now() });
  if (!next) return;
  kind = next.kind;
  const items = read();
  const filtered = items.filter((it) => !(it.kind === kind && it.id === id));

  // Cap per-kind: keep only the top MAX_PER_KIND most-recent of each kind.
  const sameKind = filtered.filter((it) => it.kind === kind).slice(0, MAX_PER_KIND - 1);
  const otherKinds = filtered.filter((it) => it.kind !== kind);
  write([next, ...sameKind, ...otherKinds].sort((a, b) => b.ts - a.ts));
}

export function getRecent(kind?: RecentKind, limit = 8): RecentItem[] {
  const items = read();
  const filtered = kind ? items.filter((it) => it.kind === kind) : items;
  return filtered.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
