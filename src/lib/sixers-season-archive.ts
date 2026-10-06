import "server-only";
import catalog from "@/data/sixers-2024-25/catalog.json";
import { TEAM_META } from "./teams";
import { ESPN_TEAM_TRICODES } from "./espn-scoreboard";
import { validCalendarDate } from "./planned-fixtures";
import type { ScheduleGame } from "./nba-contracts";
import { espnBoxApiUrl } from "./espn-player-box";
import { readEspnPlayerBoxEntry, type EspnBoxArchiveEntry } from "./espn-player-box-archive";

interface ArchiveTeam { tricode: string; teamId: number | null; espnTeamId: string; score: number }
export interface SixersArchiveResult {
  eventId: string; nbaGameId: string | null; phase: "regular" | "preseason"; date: string; tipoffUTC: string;
  home: ArchiveTeam; away: ArchiveTeam;
  source: { url: string; rawSha256: string; retrievedAt: string };
  identityEvidence: null | {
    method: "crosswalk-and-raw" | "crosswalk-omission-verified-final-period";
    finalPeriod: { period: number; actionId: number; homeScore: number; awayScore: number };
    crosswalkSha256: string; shotSubsetSha256: string; pbpSubsetSha256: string;
  };
  boxEntry: EspnBoxArchiveEntry | null;
}
export interface SixersSeasonArchive {
  version: 1; team: "PHI"; season: "2024-25";
  sources: Record<"shotdetail" | "nbastatsv3", { url: string; sourceSha256: string; subsetSha256: string }>;
  games: SixersArchiveResult[];
  coverage: Record<string, number>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const sha = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const iso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)) && validCalendarDate(v.slice(0, 10));
const etDate = (v: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(v));
function team(v: unknown): v is ArchiveTeam {
  if (!object(v) || !exact(v, ["tricode", "teamId", "espnTeamId", "score"]) || typeof v.espnTeamId !== "string" || !count(v.score) || v.score > 300) return false;
  if (v.espnTeamId === "111836") return v.tricode === "NZL" && v.teamId === null;
  const tricode = ESPN_TEAM_TRICODES[v.espnTeamId];
  return !!tricode && v.tricode === tricode && v.teamId === TEAM_META[tricode].teamId;
}
/** A closed, single-season catalog. It is never merged into the current schedule. */
export function validateSixersSeasonArchive(raw: unknown): SixersSeasonArchive | null {
  if (!object(raw) || !exact(raw, ["version", "team", "season", "sources", "games", "coverage"]) || raw.version !== 1 || raw.team !== "PHI" || raw.season !== "2024-25"
    || !object(raw.sources) || !exact(raw.sources, ["shotdetail", "nbastatsv3"]) || !Array.isArray(raw.games) || raw.games.length !== 88 || !object(raw.coverage)) return null;
  for (const key of ["shotdetail", "nbastatsv3"]) {
    const source = raw.sources[key];
    if (!object(source) || !exact(source, ["url", "sourceSha256", "subsetSha256"]) || !sha(source.sourceSha256) || !sha(source.subsetSha256)
      || typeof source.url !== "string" || !new RegExp(`^https://raw\\.githubusercontent\\.com/fxy2026/nba_data/[a-f0-9]{40}/datasets/${key}_2024\\.tar\\.xz$`).test(source.url)) return null;
  }
  const events = new Set<string>(), nbaIds = new Set<string>();
  let regular = 0, preseason = 0, corrections = 0;
  for (const g of raw.games) {
    if (!object(g) || !exact(g, ["eventId", "nbaGameId", "phase", "date", "tipoffUTC", "home", "away", "source", "identityEvidence", "boxEntry"])
      || typeof g.eventId !== "string" || !/^\d{9}$/.test(g.eventId) || events.has(g.eventId)
      || typeof g.date !== "string" || !validCalendarDate(g.date) || !iso(g.tipoffUTC) || etDate(g.tipoffUTC) !== g.date
      || g.date < "2024-10-01" || g.date > "2025-04-30" || !team(g.home) || !team(g.away)
      || g.home.espnTeamId === g.away.espnTeamId || g.home.score === g.away.score || ![g.home.tricode, g.away.tricode].includes("PHI")
      || !object(g.source) || !exact(g.source, ["url", "rawSha256", "retrievedAt"]) || !sha(g.source.rawSha256) || !iso(g.source.retrievedAt)
      || g.source.url !== `https://www.espn.com/nba/boxscore/_/gameId/${g.eventId}`) return null;
    events.add(g.eventId);
    if (g.phase === "preseason") {
      if (g.nbaGameId !== null || g.boxEntry !== null || g.identityEvidence !== null) return null;
      preseason++; continue;
    }
    if (g.phase !== "regular" || typeof g.nbaGameId !== "string" || !/^00224\d{5}$/.test(g.nbaGameId) || nbaIds.has(g.nbaGameId)
      || !g.home.teamId || !g.away.teamId || !object(g.identityEvidence) || !object(g.boxEntry)) return null;
    nbaIds.add(g.nbaGameId); regular++;
    const e = g.identityEvidence, b = g.boxEntry;
    if (!exact(e, ["method", "finalPeriod", "crosswalkSha256", "shotSubsetSha256", "pbpSubsetSha256"]) || !sha(e.crosswalkSha256)
      || e.shotSubsetSha256 !== (raw.sources.shotdetail as Record<string, unknown>).subsetSha256 || e.pbpSubsetSha256 !== (raw.sources.nbastatsv3 as Record<string, unknown>).subsetSha256
      || !object(e.finalPeriod) || !exact(e.finalPeriod, ["period", "actionId", "homeScore", "awayScore"])
      || !count(e.finalPeriod.period) || e.finalPeriod.period < 4 || !count(e.finalPeriod.actionId) || e.finalPeriod.actionId === 0
      || e.finalPeriod.homeScore !== g.home.score || e.finalPeriod.awayScore !== g.away.score) return null;
    if (e.method === "crosswalk-omission-verified-final-period") {
      if (g.eventId !== "401704888" || g.nbaGameId !== "0022400322" || e.finalPeriod.actionId !== 476 || g.date !== "2024-12-04" || g.home.tricode !== "PHI" || g.away.tricode !== "ORL") return null;
      corrections++;
    } else if (e.method !== "crosswalk-and-raw") return null;
    if (!exact(b, ["gameId", "eventId", "file", "sha256", "compressedSha256", "bytes", "uncompressedBytes", "sourceRawSha256", "sourceUrl", "retrievedAt"])
      || b.gameId !== g.nbaGameId || b.eventId !== g.eventId || b.file !== `${g.nbaGameId}.json.gz`
      || !sha(b.sha256) || !sha(b.compressedSha256) || b.sourceRawSha256 !== g.source.rawSha256 || b.sourceUrl !== espnBoxApiUrl(g.eventId) || b.retrievedAt !== g.source.retrievedAt
      || !count(b.bytes) || b.bytes === 0 || b.bytes > 64 * 1024 || !count(b.uncompressedBytes) || b.uncompressedBytes === 0 || b.uncompressedBytes > 128 * 1024) return null;
  }
  if (regular !== 82 || preseason !== 6 || corrections !== 1 || !Object.values(raw.coverage).every(count)) return null;
  return raw as unknown as SixersSeasonArchive;
}
const archive = validateSixersSeasonArchive(catalog);
export function getSixersSeasonArchive() { return archive; }
function resultForId(id: string) { return archive?.games.find(g => g.nbaGameId === id) ?? null; }
export function getSixersArchiveGame(id: string): ScheduleGame | null {
  const row = resultForId(id);
  if (!row?.nbaGameId || !row.boxEntry) return null;
  const side = (t: ArchiveTeam): ScheduleGame["homeTeam"] => ({ teamId: t.teamId!, teamTricode: t.tricode, teamName: TEAM_META[t.tricode].name, teamCity: TEAM_META[t.tricode].city, teamSlug: "", score: t.score });
  return { gameId: row.nbaGameId, gameStatus: 3, gameStatusText: "Final", gameCode: `${row.date.replaceAll("-", "")}/${row.away.tricode}${row.home.tricode}`,
    gameDateTimeUTC: row.tipoffUTC, homeTeam: side(row.home), awayTeam: side(row.away) };
}
export async function getSixersArchivePlayerBox(id: string) {
  const row = resultForId(id), game = getSixersArchiveGame(id);
  return row?.boxEntry && game ? readEspnPlayerBoxEntry(row.boxEntry, game, "sixers-2024-25") : null;
}
