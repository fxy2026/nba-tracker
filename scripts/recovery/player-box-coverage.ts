import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEAM_META } from "../../src/lib/teams";
import type { PlayerBoxCoverageManifest, PlayerBoxCoveragePhase, PlayerBoxEvidenceTier, TeamPlayerBoxCoverage } from "../../src/lib/player-box-coverage-contract";
import { readStoredArchives } from "./snapshot-store";

const phases: PlayerBoxCoveragePhase[] = ["regular", "playoffs", "play-in", "preseason", "cup-final"];
const tiers: PlayerBoxEvidenceTier[] = ["officialReport", "recordedReportReview", "legacyManualReview", "espnAssigned", "unassignedProvider"];
const teams = Object.keys(TEAM_META).sort();
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const isSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(`Coverage metadata: ${message}`); }
function phaseOf(id: string): PlayerBoxCoveragePhase {
  const phase = ({ "001": "preseason", "002": "regular", "004": "playoffs", "005": "play-in", "006": "cup-final" } as const)[id.slice(0, 3) as "001"];
  requireValue(/^00[12456]\d{7}$/.test(id) && phase, "invalid canonical game ID");
  return phase;
}
function seasonOf(id: string) { return `20${id.slice(3, 5)}-${String(Number(id.slice(3, 5)) + 1).padStart(2, "0")}`; }
function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
interface GameIdentity { gameId: string; season: string; phase: PlayerBoxCoveragePhase; date: string; home: string; away: string; homeScore: number; awayScore: number }
interface ArchivedGame extends GameIdentity { tier: PlayerBoxEvidenceTier; partial: boolean }
interface ScheduleSource { dates: { games: { gameId: string; gameCode: string; gameStatus: number; homeTeam: { teamId: number; teamTricode: string; score: number }; awayTeam: { teamId: number; teamTricode: string; score: number } }[] }[] }
interface FinalProjection { season: string; finishedGames: { gameId: string; gameDate: string; homeTricode: string; awayTricode: string; homeScore: number; awayScore: number }[] }
interface EspnMetadata { gameId: string; eventId: string; file: string; sha256: string; compressedSha256: string; sourceRawSha256: string; bytes: number; uncompressedBytes: number; sourceUrl: string; retrievedAt: string }
interface HistoricalCatalog {
  version: number; season: string; team: string;
  games: { eventId: string; nbaGameId: string | null; phase: string; date: string; home: { tricode: string; score: number }; away: { tricode: string; score: number };
    boxEntry: EspnMetadata | null; source: { rawSha256: string }; identityEvidence: { finalPeriod: { homeScore: number; awayScore: number } } | null }[];
}
function identity(id: string, date: string, home: string, away: string, homeScore: number, awayScore: number): GameIdentity {
  requireValue(validDate(date) && teams.includes(home) && teams.includes(away) && home !== away && [homeScore, awayScore].every(n => Number.isSafeInteger(n) && n >= 0) && homeScore !== awayScore, "invalid game identity");
  const season = seasonOf(id), phase = phaseOf(id);
  requireValue(date >= `${season.slice(0, 4)}-07-01` && date < `${Number(season.slice(0, 4)) + 1}-07-01`, "game date outside season");
  return { gameId: id, season, phase, date, home, away, homeScore, awayScore };
}
function sameIdentity(a: GameIdentity, b: GameIdentity) {
  return ["gameId", "season", "phase", "date", "home", "away", "homeScore", "awayScore"].every(key => a[key as keyof GameIdentity] === b[key as keyof GameIdentity]);
}
/** Canonical ID deduplication. A weaker overlapping store cannot inflate coverage. */
export function selectCoverageGames(rows: ArchivedGame[]): ArchivedGame[] {
  const selected = new Map<string, ArchivedGame>();
  for (const row of rows) {
    const prior = selected.get(row.gameId);
    requireValue(!prior || sameIdentity(prior, row), "conflicting duplicate game identity");
    if (!prior || tiers.indexOf(row.tier) < tiers.indexOf(prior.tier)) selected.set(row.gameId, row);
    else if (prior.tier === row.tier) requireValue(prior.partial === row.partial, "conflicting same-tier coverage");
  }
  return [...selected.values()].sort((a, b) => a.gameId.localeCompare(b.gameId));
}
/** All 15 best-of-seven series must end, and each subsequent round contains the prior winners. */
function completePlayoffs(games: GameIdentity[]) {
  const roundWinners: string[][] = [];
  for (const [round, seriesCount] of [[1, 8], [2, 4], [3, 2], [4, 1]]) {
    const roundGames = games.filter(g => Number(g.gameId[7]) === round);
    const ids = [...new Set(roundGames.map(g => g.gameId.slice(0, 9)))].sort();
    if (ids.length !== seriesCount) return false;
    const participants: string[] = [], winners: string[] = [];
    for (const id of ids) {
      const series = roundGames.filter(g => g.gameId.startsWith(id)).sort((a, b) => a.gameId.localeCompare(b.gameId));
      const sides = [...new Set(series.flatMap(g => [g.home, g.away]))].sort();
      if (sides.length !== 2 || series.length < 4 || series.length > 7 || series.some((g, i) => Number(g.gameId[9]) !== i + 1)) return false;
      const wins = new Map(sides.map(team => [team, 0]));
      for (const [index, game] of series.entries()) {
        const winner = game.homeScore > game.awayScore ? game.home : game.away;
        wins.set(winner, wins.get(winner)! + 1);
        if (wins.get(winner) === 4 && index !== series.length - 1) return false;
      }
      const winner = sides.find(team => wins.get(team) === 4);
      if (!winner) return false;
      participants.push(...sides); winners.push(winner);
    }
    if (new Set(participants).size !== participants.length || (round > 1 && participants.sort().join() !== roundWinners[round - 2].sort().join())) return false;
    roundWinners.push(winners);
  }
  return games.length === games.filter(g => [1, 2, 3, 4].includes(Number(g.gameId[7]))).length;
}

/** Offline metadata generation only. Reads authoritative stores; never decodes gzip or changes source files. */
export function buildPlayerBoxCoverageManifest(root = "src/data"): PlayerBoxCoverageManifest {
  const inputs = new Map<string, string>();
  function bytes(path: string) {
    const full = join(root, path);
    requireValue(lstatSync(full).isFile(), "nonregular source file");
    const value = readFileSync(full); inputs.set(path, sha(value)); return value;
  }
  const json = <T,>(path: string): T => JSON.parse(bytes(path).toString("utf8")) as T; // Source schemas are checked below and by readStoredArchives.
  const { generic, verified, quarantined } = readStoredArchives(root);
  const quarantine = json<Record<string, unknown>>("player-box-quarantine.json");
  const aliases = json<Record<string, unknown>>("archive-game-aliases.json");
  const schedule = json<ScheduleSource>("schedule-2025-26.json");
  const finals = json<FinalProjection>("season-2025-26-final.json");
  const provenance = json<Record<string, Record<string, unknown>>>("recovered-player-box-provenance.json");
  bytes("recovered-player-boxes.README.md");
  for (const file of ["resolved-player-box-quarantine.json", "supplemented-player-box-history.json"]) bytes(file);
  requireValue(object(quarantine) && object(aliases) && object(provenance), "invalid registries");
  const scheduleGames = new Map<string, GameIdentity>();
  let allFinal = true;
  requireValue(Array.isArray(schedule.dates), "missing schedule");
  for (const day of schedule.dates) {
    requireValue(Array.isArray(day.games), "invalid schedule day");
    for (const game of day.games) {
      requireValue(typeof game.gameId === "string" && typeof game.gameCode === "string" && !Object.hasOwn(aliases, game.gameId) && !scheduleGames.has(game.gameId), "duplicate or aliased schedule identity");
      requireValue(game.homeTeam?.teamId === TEAM_META[game.homeTeam?.teamTricode]?.teamId && game.awayTeam?.teamId === TEAM_META[game.awayTeam?.teamTricode]?.teamId, "schedule team ID mismatch");
      const rawDate = game.gameCode.slice(0, 8), date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const row = identity(game.gameId, date, game.homeTeam.teamTricode, game.awayTeam.teamTricode, game.homeTeam.score, game.awayTeam.score);
      requireValue(game.gameCode === `${rawDate}/${row.away}${row.home}`, "game code mismatch");
      allFinal &&= game.gameStatus === 3;
      scheduleGames.set(row.gameId, row);
    }
  }
  const finalGames = new Map<string, GameIdentity>();
  requireValue(Array.isArray(finals.finishedGames), "missing final projection");
  for (const g of finals.finishedGames) {
    if (typeof g.gameId !== "string" || !/^00[24]/.test(g.gameId)) continue;
    requireValue(!finalGames.has(g.gameId), "duplicate final projection identity");
    finalGames.set(g.gameId, identity(g.gameId, g.gameDate, g.homeTricode, g.awayTricode, g.homeScore, g.awayScore));
  }
  const regular = [...scheduleGames.values()].filter(g => g.phase === "regular");
  const playoffs = [...scheduleGames.values()].filter(g => g.phase === "playoffs");
  const exactFinals = (games: GameIdentity[], phase: PlayerBoxCoveragePhase) => games.length === [...finalGames.values()].filter(g => g.phase === phase).length && games.every(g => finalGames.has(g.gameId) && sameIdentity(g, finalGames.get(g.gameId)!));
  const completed = allFinal && finals.season === "2025-26" && [...scheduleGames.values()].every(g => g.season === finals.season)
    && regular.length === 1230 && teams.every(team => regular.filter(g => g.home === team || g.away === team).length === 82)
    && exactFinals(regular, "regular") && exactFinals(playoffs, "playoffs") && completePlayoffs(playoffs);
  const completedSeasons = completed ? [{ season: "2025-26", regularGames: regular.length, playoffGames: playoffs.length,
    scheduleSha256: inputs.get("schedule-2025-26.json")!, finalProjectionSha256: inputs.get("season-2025-26-final.json")! }] : [];
  const rows: ArchivedGame[] = [];
  function add(row: GameIdentity, tier: PlayerBoxEvidenceTier, partial = false) {
    requireValue(!Object.hasOwn(aliases, row.gameId), "archive contains alias ID");
    if (Object.hasOwn(quarantine, row.gameId) || Object.hasOwn(quarantined, row.gameId)) return;
    const canonical = scheduleGames.get(row.gameId);
    requireValue(!canonical || sameIdentity(canonical, row), "archive/schedule mismatch");
    rows.push({ ...row, tier, partial });
  }
  for (const [id, box] of Object.entries(verified)) {
    bytes(`recovered-player-boxes/${id}.json`);
    let tier: PlayerBoxEvidenceTier;
    if (box.provider === "NBA official final report") { requireValue(isSha(box.officialReport?.reportSha256), "missing official report hash"); tier = "officialReport"; }
    else if (object(provenance[id])) {
      requireValue(provenance[id].officialReportUrl === box.reportUrl && isSha(provenance[id].officialReportSha256), "unbound recorded review");
      tier = "recordedReportReview";
    } else { requireValue(["0022500340", "0022500961"].includes(id), "missing review evidence"); tier = "legacyManualReview"; }
    add(identity(id, box.gameDate, box.home, box.away, box.homeScore, box.awayScore), tier, box.playedCoverage?.status === "partial");
  }
  for (const [id, box] of Object.entries(generic)) {
    bytes(`provider-player-boxes/${id}.json`);
    requireValue(box.players.every(p => p.team === null), "unexpected provider team attribution");
    add(identity(id, box.game.gameDate, box.game.home.tricode, box.game.away.tricode, box.game.home.score, box.game.away.score), "unassignedProvider");
  }
  const currentManifest = json<EspnMetadata[]>("espn-player-boxes/manifest.json");
  const historical = json<HistoricalCatalog>("sixers-2024-25/catalog.json");
  requireValue(Array.isArray(currentManifest) && historical.version === 1 && historical.season === "2024-25" && historical.team === "PHI" && Array.isArray(historical.games), "invalid ESPN catalogs");
  const historicalGames = new Map<string, GameIdentity>();
  const historicalEvents = new Set<string>();
  for (const g of historical.games) {
    requireValue(typeof g.eventId === "string" && !historicalEvents.has(g.eventId), "duplicate historical event"); historicalEvents.add(g.eventId);
    if (g.nbaGameId === null) { requireValue(g.phase === "preseason" && g.boxEntry === null, "unmapped historical box"); continue; }
    const row = identity(g.nbaGameId, g.date, g.home.tricode, g.away.tricode, g.home.score, g.away.score);
    requireValue(row.season === historical.season && row.phase === "regular" && [row.home, row.away].includes(historical.team) && !historicalGames.has(row.gameId)
      && g.boxEntry?.eventId === g.eventId && g.boxEntry?.sourceRawSha256 === g.source?.rawSha256 && g.identityEvidence?.finalPeriod?.homeScore === row.homeScore && g.identityEvidence?.finalPeriod?.awayScore === row.awayScore, "invalid historical box metadata");
    historicalGames.set(row.gameId, row);
  }
  for (const [store, entries, games] of [["espn-player-boxes", currentManifest, scheduleGames], ["sixers-2024-25", historical.games.flatMap(g => g.boxEntry ? [g.boxEntry] : []), historicalGames]] as const) {
    const ids = new Set<string>(), events = new Set<string>();
    for (const entry of entries) {
      const game = games.get(entry.gameId);
      requireValue(game && /^0022[45]\d{5}$/.test(entry.gameId) && !ids.has(entry.gameId) && !events.has(entry.eventId) && /^\d{9}$/.test(entry.eventId)
        && entry.file === `${entry.gameId}.json.gz` && [entry.sha256, entry.compressedSha256, entry.sourceRawSha256].every(isSha)
        && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 64 * 1024 && Number.isSafeInteger(entry.uncompressedBytes) && entry.uncompressedBytes > 0 && entry.uncompressedBytes <= 128 * 1024
        && entry.sourceUrl === `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${entry.eventId}` && Number.isFinite(Date.parse(entry.retrievedAt)), "invalid ESPN manifest entry");
      const compressed = bytes(`${store}/${entry.file}`);
      requireValue(compressed.length === entry.bytes && sha(compressed) === entry.compressedSha256, "changed ESPN compressed source");
      ids.add(entry.gameId); events.add(entry.eventId); add(game, "espnAssigned");
    }
    requireValue(readdirSync(join(root, store)).filter(file => file.endsWith(".gz")).sort().join() === [...ids].map(id => `${id}.json.gz`).sort().join(), "unlisted ESPN source file");
  }
  const selected = selectCoverageGames(rows);
  const seasons = [...new Set([...selected.map(g => g.season), ...completedSeasons.map(s => s.season)])].sort();
  const coverage: TeamPlayerBoxCoverage[] = [];
  for (const season of seasons) for (const team of teams) for (const phase of phases) {
    if (![...scheduleGames.values(), ...historicalGames.values()].some(g => g.season === season && g.phase === phase)
      && !(season === historical.season && historical.games.some(g => g.phase === phase))) continue;
    const games = selected.filter(g => g.season === season && g.phase === phase && [g.home, g.away].includes(team));
    const complete = completedSeasons.some(s => s.season === season) && ["regular", "playoffs"].includes(phase);
    const expectedGames = complete ? [...scheduleGames.values()].filter(g => g.season === season && g.phase === phase && [g.home, g.away].includes(team)).length
      : season === historical.season && team === historical.team && phase === "regular" && historicalGames.size === 82 ? 82 : null;
    const evidence = Object.fromEntries(tiers.map(tier => [tier, games.filter(g => g.tier === tier).length])) as TeamPlayerBoxCoverage["evidence"];
    const dates = games.map(g => g.date).sort();
    requireValue(expectedGames === null || games.length <= expectedGames, "coverage exceeds proven schedule");
    coverage.push({ team, season, phase, expectedGames, archivedGames: games.length, teamAssignedGames: games.length - evidence.unassignedProvider, evidence,
      firstGameDate: dates[0] ?? null, lastGameDate: dates.at(-1) ?? null, partialPlayerBoxGames: games.filter(g => g.partial).length });
  }
  return { version: 1, inputSha256: sha(JSON.stringify([...inputs].sort(([a], [b]) => a.localeCompare(b)))), completedSeasons, coverage };
}

/** Only the deterministic metadata output can be changed by this generator. */
export function generatePlayerBoxCoverageManifest(root = "src/data") {
  const manifest = buildPlayerBoxCoverageManifest(root);
  const path = join(root, "player-box-coverage.json"), text = JSON.stringify(manifest) + "\n";
  if (existsSync(path) && readFileSync(path, "utf8") === text) return manifest;
  const temporary = `${path}.${process.pid}.tmp`;
  try { writeFileSync(temporary, text, { flag: "wx" }); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
  return manifest;
}
