import type { PlayerInfo, PlayerIndexSnapshot } from "./api";
import type { PlayerIndexProvenance } from "./player-index-provenance";
import { normalizePlayerSearchText } from "./player-search-text";
import { expandQuery } from "./playerAliases";
import { preferredAliasPlayerId } from "./player-alias-identities";

export type PlayerIdentitySource = "player-index" | "historical-shots" | "all-time-leaders" | "all-time-registry";
export interface IdentityRecord { id: number; name: string; aliases?: readonly string[]; sourceYears?: { from: number; to: number } | null }
export interface ShotIdentityRecord { playerId: number; name: string; aliases?: readonly string[]; firstSeason: string; lastSeason: string; datasetCount: number }
/** Identity and coverage only. Absence from an index never implies retirement. */
export interface PlayerIdentity {
  id: number;
  name: string;
  aliases: readonly string[];
  sources: readonly PlayerIdentitySource[];
  href: string;
  teamLabel: string | null;
  teamAbbr: string | null;
  position: string | null;
  indexProvenance: PlayerIndexProvenance | null;
  sourceYears?: { from: number; to: number } | null;
  shotArchiveStatus?: "ready" | "error";
  shotCoverage: { firstSeason: string; lastSeason: string; datasetCount: number } | null;
}
export function parsePlayerId(value: string): number | null {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
function validIdentity(record: IdentityRecord): boolean {
  return Number.isSafeInteger(record.id) && record.id > 0 && typeof record.name === "string" && record.name.trim().length > 0;
}
/** Merge strictly by NBA ID. Preserve source spellings as aliases; never merge namesakes. */
export function buildPlayerIdentityDirectory(input: {
  snapshot: PlayerIndexSnapshot;
  historical: readonly ShotIdentityRecord[];
  legends: readonly IdentityRecord[];
  registry?: readonly IdentityRecord[];
}): readonly PlayerIdentity[] {
  const map = new Map<number, PlayerIdentity>();
  const add = (record: IdentityRecord, source: PlayerIdentitySource) => {
    if (!validIdentity(record)) return;
    const prior = map.get(record.id);
    const names = [record.name.trim(), ...(record.aliases ?? [])].filter(name => typeof name === "string" && name.trim()).map(name => name.trim());
    map.set(record.id, {
      id: record.id, name: record.name.trim(), href: `/player/${record.id}`,
      aliases: [...new Set([...(prior?.aliases ?? []), ...names])],
      sources: [...new Set([...(prior?.sources ?? []), source])],
      teamLabel: prior?.teamLabel ?? null, teamAbbr: prior?.teamAbbr ?? null, position: prior?.position ?? null,
      sourceYears: record.sourceYears ?? prior?.sourceYears ?? null,
      indexProvenance: prior?.indexProvenance ?? null, shotCoverage: prior?.shotCoverage ?? null,
    });
  };
  // Later identity sources take precedence; no source contributes unsupported biography.
  for (const record of input.historical) {
    add({ id: record.playerId, name: record.name, aliases: record.aliases }, "historical-shots");
    const player = map.get(record.playerId);
    if (player) player.shotCoverage = { firstSeason: record.firstSeason, lastSeason: record.lastSeason, datasetCount: record.datasetCount };
  }
  for (const record of input.legends) add(record, "all-time-leaders");
  for (const record of input.registry ?? []) add(record, "all-time-registry");
  for (const record of input.snapshot.players) {
    add({ id: record.personId, name: `${record.firstName} ${record.lastName}`.trim() }, "player-index");
    const player = map.get(record.personId);
    if (!player) continue;
    player.teamLabel = [record.teamCity, record.teamName].filter(Boolean).join(" ") || null;
    player.teamAbbr = record.teamAbbr || null;
    player.position = record.position || null;
    player.indexProvenance = input.snapshot.provenance;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id - b.id);
}
export function indexedPlayerForIdentity(identity: PlayerIdentity, snapshot: PlayerIndexSnapshot): PlayerInfo | null {
  return snapshot.players.find(player => player.personId === identity.id) ?? null;
}
/** Compact search shared by home, search, and numeric-ID discovery. */
export function searchPlayerIdentities(players: readonly PlayerIdentity[], query: string): PlayerIdentity[] {
  const needle = normalizePlayerSearchText(query).slice(0, 100);
  if (!needle) return [];
  const terms = [...new Set(expandQuery(needle).map(normalizePlayerSearchText))];
  // Unicode name boundaries distinguish Curry from Scurry, including hyphenated
  // surnames. Compile escaped literal queries once, not once per identity.
  const wholeNameTerms = terms.map(term => {
    const literal = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${literal}(?=$|[^\\p{L}\\p{N}])`, "u");
  });
  const preferredId = preferredAliasPlayerId(needle);
  // Ambiguous surnames retain name/ID ties: dated coverage is not current activity.
  return players.map(player => {
    const names = [player.name, ...player.aliases].map(normalizePlayerSearchText);
    const team = normalizePlayerSearchText([player.teamAbbr, player.teamLabel].filter(Boolean).join(" "));
    const score = String(player.id) === needle ? 0 : names.includes(needle) ? 1 : player.id === preferredId ? 1.5 : terms.some(term => names.includes(term)) ? 2
      : wholeNameTerms.some(term => names.some(name => term.test(name))) ? 3
      : terms.some(term => names.some(name => name.startsWith(term))) ? 4
      : terms.some(term => names.some(name => name.includes(term))) ? 5
      : terms.some(term => team.includes(term)) ? 6 : 7;
    return { player, score };
  }).filter(match => match.score < 7).sort((a, b) => a.score - b.score || a.player.name.localeCompare(b.player.name, "en") || a.player.id - b.player.id).map(match => match.player);
}
