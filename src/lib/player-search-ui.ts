import type { PlayerIdentity } from "./player-identity";

export function canSearchPlayers(query: string): boolean {
  const value = query.trim();
  return value.length >= 2 || /^\d$/.test(value);
}

/** Guard the response boundary and derive routes from an NBA ID, never a remote URL. */
export function isPlayerSearchResult(value: unknown): value is PlayerIdentity {
  if (value === null || typeof value !== "object") return false;
  const row = value as Partial<PlayerIdentity>;
  return Number.isSafeInteger(row.id) && (row.id ?? 0) > 0 && typeof row.name === "string" && row.name.trim().length > 0;
}

/** A diacritic-insensitive match with offsets into the original, unchanged name. */
export function playerNameMatch(name: string, query: string): { start: number; end: number } | null {
  const normalizedQuery = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  if (!normalizedQuery) return null;
  let normalized = "";
  let offset = 0;
  const spans: { start: number; end: number }[] = [];
  for (const character of name) {
    const part = character.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let index = 0; index < part.length; index++) spans.push({ start: offset, end: offset + character.length });
    normalized += part;
    offset += character.length;
  }
  const start = normalized.indexOf(normalizedQuery);
  if (start < 0) return null;
  return { start: spans[start].start, end: spans[start + normalizedQuery.length - 1].end };
}
