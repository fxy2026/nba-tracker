import "server-only";
import registry from "@/data/player-identity/official-all-player-identities.compact.json";
import nameOverrides from "@/data/player-identity/verified-display-name-overrides.json";
import searchAliases from "@/data/player-identity/verified-search-aliases.json";
import type { IdentityRecord } from "./player-identity";

export const OFFICIAL_PLAYER_REGISTRY_SOURCE = registry.source;
/** Fixed, reviewed snapshot; page visits do not fan out to NBA player APIs. */
export function parseOfficialPlayerRegistry(value: unknown): readonly IdentityRecord[] {
  if (!value || typeof value !== "object") throw new Error("Invalid NBA player registry");
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || JSON.stringify(raw.columns) !== JSON.stringify(["personId", "fullName", "fromYear", "toYear"]) || !Array.isArray(raw.rows)) throw new Error("Invalid NBA player registry schema");
  const seen = new Set<number>();
  return raw.rows.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 4) throw new Error("Invalid NBA player registry row");
    const [id, name, from, to] = row;
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || typeof name !== "string" || !name.trim() || !Number.isInteger(from) || !Number.isInteger(to) || from < 1946 || to < from || to > 2100) throw new Error("Invalid NBA player registry identity");
    seen.add(id);
    return { id, name, sourceYears: { from, to } };
  });
}
const aliases = new Map(searchAliases.aliases.map(row => [row.personId, row]));
const overrides = new Map(nameOverrides.overrides.map(row => [row.personId, row]));
export const OFFICIAL_PLAYER_IDENTITIES = parseOfficialPlayerRegistry(registry).map(record => {
  const override = overrides.get(record.id);
  const extra = aliases.get(record.id);
  if (extra && extra.sourceName !== record.name) throw new Error("Unverified NBA player alias");
  if (!override) return extra ? { ...record, aliases: extra.aliases } : record;
  if (override.sourceFullName !== record.name || !override.sources.every(source => source.url.startsWith("https://www.nba.com/") || source.url.startsWith("https://stats.nba.com/"))) throw new Error("Unverified NBA player name override");
  return { ...record, name: override.fullName, aliases: override.aliases };
});
