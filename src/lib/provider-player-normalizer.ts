import type { RecoveryManifestGame } from "./recovery-manifest";
import { TEAM_META } from "./teams";

export interface ProviderPlayerLine {
  providerPlayerId: string | null;
  name: string;
  team: null;
  minutesRounded: number | null;
  points: number;
  rebounds: number | null;
  assists: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  threePointersMade: number | null;
  threePointersAttempted: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempted: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  plusMinus: number | null;
  starter: boolean | null;
}
export interface ProviderBasicSnapshot {
  version: 1;
  provider: "BigBallsData";
  coverage: "provider-basic-unassigned";
  game: RecoveryManifestGame;
  retrievedAt: string;
  retrievedAtPrecision: "exact" | "approximate-minute" | "unspecified";
  players: ProviderPlayerLine[];
  validation: { combinedPoints: number; historicalTeams: "unassigned"; officialReportChecked: false };
}
export type ProviderNormalization = { ok: true; snapshot: ProviderBasicSnapshot } | { ok: false; reason: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const normalizeName = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
function teamNameToTricode(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = normalizeName(name);
  const matches = Object.values(TEAM_META).filter(t => n === normalizeName(`${t.city} ${t.name}`) || (t.tricode === "LAC" && n === "los angeles clippers"));
  return matches.length === 1 ? matches[0].tricode : null;
}
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const missing = (v: unknown) => v == null || (typeof v === "string" && ["", "-", "--", "—"].includes(v.trim()));
function integer(v: unknown, signed = false): number | null | undefined {
  if (v === undefined) return undefined;
  if (missing(v)) return null;
  if (typeof v !== "string" || !(signed ? /^[+-]?\d+$/ : /^\d+$/).test(v.trim())) return undefined;
  const n = Number(v); return Number.isSafeInteger(n) ? n : undefined;
}
function split(v: unknown): [number | null, number | null] | null {
  if (v === undefined) return null;
  if (missing(v)) return [null, null];
  if (typeof v !== "string" || !/^\d+-\d+$/.test(v)) return null;
  const [m,a] = v.split("-").map(Number);
  return Number.isSafeInteger(m) && Number.isSafeInteger(a) && m <= a ? [m,a] : null;
}

// Pure parser. Request identity is supplied by the capture/transport, because
// this endpoint's body has no match ID. Current player.team_id is NEVER a
// historical assignment. No secrets, requests, images, or NBA IDs are inferred.
export function normalizeProviderPlayerStats(raw: unknown, game: RecoveryManifestGame, context: { requestedMatchId: string; retrievedAt: string; retrievedAtPrecision?: "exact" | "approximate-minute" }): ProviderNormalization {
  const reject = (reason: string): ProviderNormalization => ({ok:false,reason});
  if (context.requestedMatchId !== game.providerMatchId) return reject("request-match-mismatch");
  if (!Number.isFinite(Date.parse(context.retrievedAt))) return reject("invalid-retrieval-time");
  if (!object(raw)) return reject("malformed-envelope");
  if (!object(raw.data)) return reject("malformed-data");
  if (!object(raw.meta)) return reject("malformed-meta");
  for (const flag of ["available", "players_available", "team_stats_available"] as const) {
    if (raw.meta[flag] === false) return reject(`flag-${flag}-false`);
    if (raw.meta[flag] !== true) return reject(`flag-${flag}-missing-or-invalid`);
  }
  if (!object(raw.meta.withheld)) return reject("withheld-missing-or-malformed");
  for (const field of ["players", "team_stats"] as const) {
    const count = raw.meta.withheld[field];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return reject(`withheld-${field}-missing-or-invalid`);
    if (count > 0) return reject(`withheld-${field}-positive`);
  }
  if (!Array.isArray(raw.data.players) || !raw.data.players.length || !Array.isArray(raw.data.team_stats)) return reject("missing-player-or-team-data");
  const teams = new Set<string>();
  for (const row of raw.data.team_stats) {
    if (!object(row)) return reject("malformed-team-stat");
    const team = teamNameToTricode(row.team_name);
    if (!team || ![game.home.tricode,game.away.tricode].includes(team)) return reject("team-identity-mismatch");
    teams.add(team);
  }
  if (teams.size !== 2) return reject("incomplete-team-identity");
  const players: ProviderPlayerLine[] = [], identities = new Set<string>(), names = new Set<string>();
  for (const row of raw.data.players) {
    if (!object(row) || typeof row.name !== "string" || !row.name.trim() || !object(row.stats)) return reject("malformed-player");
    const normalized = normalizeName(row.name);
    if (names.has(normalized)) return reject("duplicate-player-name");
    names.add(normalized);
    const id = row.id == null ? null : uuid(row.id) ? row.id.toLowerCase() : undefined;
    if (id === undefined || (id !== null && identities.has(id))) return reject("invalid-or-duplicate-player-id");
    if (id) identities.add(id);
    const stats = row.stats;
    const value = (key: string) => stats[key] === undefined ? null : object(stats[key]) ? stats[key].value : undefined;
    const countKeys = ["minutes", "points", "rebounds", "assists", "offensiveRebounds", "defensiveRebounds", "steals", "blocks", "turnovers", "fouls"] as const;
    const counts = countKeys.map(key => integer(value(key)));
    if (counts.some(v => v === undefined) || counts[1] === null) return reject("invalid-counting-stat");
    const [minutesRounded,points,rebounds,assists,offensiveRebounds,defensiveRebounds,steals,blocks,turnovers,fouls] = counts as (number | null)[];
    const fg = split(value("fieldGoalsMade-fieldGoalsAttempted"));
    const three = split(value("threePointFieldGoalsMade-threePointFieldGoalsAttem"));
    const ft = split(value("freeThrowsMade-freeThrowsAttempted"));
    const plusMinus = integer(value("plusMinus"),true);
    const starterRaw = value("starter");
    const starter = starterRaw === undefined ? undefined : missing(starterRaw) ? null : starterRaw === "true" ? true : starterRaw === "false" ? false : undefined;
    if (!fg || !three || !ft || plusMinus === undefined || starter === undefined) return reject("invalid-shooting-or-status-stat");
    if (fg[0] !== null && three[0] !== null && three[0] > fg[0]) return reject("inconsistent-shooting");
    if (fg[1] !== null && three[1] !== null && three[1] > fg[1]) return reject("inconsistent-shooting");
    if (fg[0] !== null && three[0] !== null && ft[0] !== null && 2*fg[0]+three[0]+ft[0] !== points) return reject("inconsistent-player-points");
    if (rebounds !== null && offensiveRebounds !== null && defensiveRebounds !== null && offensiveRebounds+defensiveRebounds !== rebounds) return reject("inconsistent-rebounds");
    players.push({providerPlayerId:id,name:row.name.trim(),team:null,minutesRounded,points:points!,rebounds,assists,offensiveRebounds,defensiveRebounds,steals,blocks,turnovers,fouls,fieldGoalsMade:fg[0],fieldGoalsAttempted:fg[1],threePointersMade:three[0],threePointersAttempted:three[1],freeThrowsMade:ft[0],freeThrowsAttempted:ft[1],plusMinus,starter});
  }
  const total = players.reduce((sum,p)=>sum+p.points,0);
  if (total !== game.home.score+game.away.score) return reject("incomplete-or-mismatched-points-total");
  return {ok:true,snapshot:{version:1,provider:"BigBallsData",coverage:"provider-basic-unassigned",game:{...game,home:{...game.home},away:{...game.away}},retrievedAt:context.retrievedAt,retrievedAtPrecision:context.retrievedAtPrecision ?? "unspecified",players,validation:{combinedPoints:total,historicalTeams:"unassigned",officialReportChecked:false}}};
}
