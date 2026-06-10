// localStorage-backed "recently viewed" tracker for player / team / game
// detail pages. Used to power the RecentlyViewed component on the homepage.
// Capped at 12 entries per kind so the storage stays small.

export type RecentKind = "player" | "team" | "game";

export interface RecentItem {
  kind: RecentKind;
  id: string;     // personId / tricode / gameId (all serialized to string for storage)
  label: string;  // display label (player name / team city+name / "AWAY @ HOME")
  ts: number;     // ms-since-epoch when last viewed
}

const KEY = "nba-tracker-recent";
const MAX_PER_KIND = 12;

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch { return []; }
}

function write(items: RecentItem[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(items)); }
  catch { /* storage full or disabled — silently ignore */ }
}

// Record a visit. Moves the item to the front if it already exists,
// otherwise prepends. Keeps at most MAX_PER_KIND per kind.
export function recordVisit(kind: RecentKind, id: string, label: string): void {
  const items = read();
  const filtered = items.filter((it) => !(it.kind === kind && it.id === id));
  const next: RecentItem = { kind, id, label, ts: Date.now() };

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
