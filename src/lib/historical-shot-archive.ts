import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import archiveIndex from "@/data/historical-shot-archive/catalog-index.json";
import { advanced14Geometry, SEASON_HEATMAP_GEOMETRY_VERSION } from "./season-heatmap-geometry";
import { displayedPercentage } from "./season-heatmap-server";
import { isSeasonHeatmapIdentity } from "./verified-season-heatmap-archive";
import { courtBasic12Zones, courtZoneForSource, SEASON_HEATMAP_COURT_GEOMETRY_VERSION, type CourtBasic12ZoneId } from "./season-heatmap-court-zones";
import type { HeatmapIdentity, SeasonHeatmapArchiveResource, SeasonHeatmapCatalogEntry, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "./season-heatmap";

const PARSER_VERSIONS = ["nba-shot-summary-v1.0.0", "nba-shot-summary-v1.1.0", "nba-shot-summary-v1.2.0"];
const PIN = "e829d4678be1e075f99e5d41a1c5f97089be446b";
const BENCHMARK = "weighted-archive-counts-not-official-displayed-LA" as const;
const DIRECTORY_PAGE_SIZE = 48;
const MAX_GZIP_BYTES = 2 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const ARCHIVE_ROOT = path.join(process.cwd(), "src/data/historical-shot-archive");
const countKeys = ["fgm", "fga", "fg3m", "fg3a"] as const;
type Counts = Record<(typeof countKeys)[number], number>;
type ObjectValue = Record<string, unknown>;
interface SummaryEntry { season: string; seasonType: HeatmapIdentity["seasonType"]; file: string; sha256: string; compressedBytes: number }
export interface HistoricalShotPlayer { playerId: number; name: string; aliases?: readonly string[]; firstSeason: string; lastSeason: string; datasetCount: number }
interface CatalogPlayer { player: HistoricalShotPlayer; searchText: string; datasets: readonly SeasonHeatmapCatalogEntry[] }
interface Catalog { players: Map<number, CatalogPlayer>; sorted: HistoricalShotPlayer[] }

function requireValue(condition: unknown): asserts condition { if (!condition) throw new Error("Invalid historical shot archive"); }
function object(value: unknown): ObjectValue { requireValue(!!value && typeof value === "object" && !Array.isArray(value)); return value as ObjectValue; }
function integer(value: unknown): number { requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= 0); return value; }
function text(value: unknown): string { requireValue(typeof value === "string" && value.length > 0 && value.length <= 250); return value; }
function counts(value: unknown): Counts {
  const raw = object(value);
  const [fgm, fga, fg3m, fg3a] = countKeys.map(key => integer(raw[key]));
  requireValue(fgm <= fga && fg3m <= fg3a && fg3m <= fgm && fg3a <= fga && fgm - fg3m <= fga - fg3a);
  return { fgm, fga, fg3m, fg3a };
}
const zero = (): Counts => ({ fgm: 0, fga: 0, fg3m: 0, fg3a: 0 });
function sum(rows: Counts[]): Counts { return rows.reduce((total, row) => { for (const key of countKeys) total[key] = integer(total[key] + row[key]); return total; }, zero()); }
function sameCounts(left: Counts, right: Counts): boolean { return countKeys.every(key => left[key] === right[key]); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function timestamp(raw: unknown): string {
  const value = text(raw);
  requireValue(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value)));
  const normalized = new Date(value).toISOString();
  requireValue(normalized.slice(0, 19) === value.slice(0, 19));
  return normalized;
}
function date(raw: unknown, year: number): string {
  const value = text(raw);
  requireValue(/^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value >= `${year}-07-01` && value <= `${year + 1}-12-31`);
  return value;
}
const identityKey = (value: Pick<HeatmapIdentity, "season" | "seasonType">) => `${value.season}:${value.seasonType}`;
const summaryFile = (value: Pick<HeatmapIdentity, "season" | "seasonType">) => `summaries/${value.season}-${value.seasonType === "Playoffs" ? "playoffs" : "regular"}.json.gz`;
const sourceUrl = (value: HeatmapIdentity) => `https://raw.githubusercontent.com/fxy2026/nba_data/${PIN}/datasets/shotdetail_${value.seasonType === "Playoffs" ? "po_" : ""}${value.season.slice(0, 4)}.tar.xz`;
const unavailable: SeasonHeatmapArchiveResource = freeze({ status: "unavailable" });
const failed: SeasonHeatmapArchiveResource = freeze({ status: "error" });

function summaryEntries(index: unknown): Map<string, SummaryEntry> {
  const raw = object(index);
  requireValue(raw.schemaVersion === 1 && Array.isArray(raw.summaries) && raw.summaries.length <= 60 && raw.stagedArchiveCount === raw.summaries.length);
  const result = new Map<string, SummaryEntry>();
  for (const item of raw.summaries) {
    const entry = object(item);
    const identity = { playerId: 1, season: entry.season, seasonType: entry.seasonType };
    requireValue(isSeasonHeatmapIdentity(identity) && Number(identity.season.slice(0, 4)) >= 1996 && Number(identity.season.slice(0, 4)) <= 2025);
    requireValue(entry.file === summaryFile(identity) && typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256));
    const compressedBytes = integer(entry.compressedBytes); requireValue(compressedBytes > 0 && compressedBytes <= MAX_GZIP_BYTES);
    requireValue(!result.has(identityKey(identity)));
    result.set(identityKey(identity), { season: identity.season, seasonType: identity.seasonType, file: entry.file, sha256: entry.sha256, compressedBytes });
  }
  return result;
}

function validateCountBlock(raw: unknown): { totals: Counts; zones: Map<string, Counts>; residuals: Map<"backcourt" | "unclassified", Counts> } {
  const value = object(raw), totals = counts(value), zonesRaw = object(value.zones);
  requireValue(Object.keys(zonesRaw).length === advanced14Geometry.length);
  const zones = new Map<string, Counts>(advanced14Geometry.map(zone => [zone.sourceZoneId, counts(zonesRaw[zone.sourceZoneId])]));
  requireValue(Array.isArray(value.residualZones) && value.residualZones.length <= 100);
  const grouped = new Map<"backcourt" | "unclassified", Counts>();
  const seen = new Set<string>();
  for (const item of value.residualZones) {
    const row = object(item);
    requireValue([row.basic, row.area, row.range].every(key => typeof key === "string" && key.length <= 250));
    const key = `${row.area} | ${row.range}`;
    requireValue(!zones.has(key));
    const triple = JSON.stringify([row.basic, row.area, row.range]); requireValue(!seen.has(triple)); seen.add(triple);
    const id = key === "Back Court(BC) | Back Court Shot" ? "backcourt" : "unclassified";
    grouped.set(id, sum([grouped.get(id) ?? zero(), counts(row)]));
  }
  requireValue(sameCounts(sum([...zones.values(), ...grouped.values()]), totals));
  return { totals, zones, residuals: grouped };
}

/** Projects one identity only. Archive row classifications never imply a shot's point value. */
export function projectHistoricalShotSummary(raw: unknown, identity: HeatmapIdentity): SeasonHeatmapRendererDTO | null {
  try {
    requireValue(isSeasonHeatmapIdentity(identity));
    const value = object(raw), year = Number(identity.season.slice(0, 4));
    requireValue(value.schemaVersion === 1 && typeof value.parserVersion === "string" && PARSER_VERSIONS.includes(value.parserVersion) && value.season === identity.season && value.seasonStartYear === year && value.seasonType === identity.seasonType);
    requireValue(Array.isArray(value.zoneOrder) && value.zoneOrder.length === 14 && value.zoneOrder.every((key, i) => key === advanced14Geometry[i].sourceZoneId));
    const provenance = object(value.provenance), quality = object(value.quality);
    requireValue(provenance.repository === "fxy2026/nba_data" && provenance.revision === PIN && provenance.sourceUrl === sourceUrl(identity) && provenance.leagueBenchmark === BENCHMARK && provenance.rawPointAvailability === "not-exported");
    requireValue(quality.validation === "passed" && quality.duplicateGameEventKeys === 0 && quality.officialCoverage === "not-officially-reconciled");
    const from = date(quality.minGameDate, year), to = date(quality.maxGameDate, year); requireValue(from <= to);
    const league = validateCountBlock(value.league), players = object(value.players), player = object(players[String(identity.playerId)]);
    requireValue(player.playerId === String(identity.playerId));
    const selected = validateCountBlock(player), shotBearingGames = integer(player.shotBearingGames);
    const leagueGames = integer(object(value.league).shotBearingGames);
    requireValue(leagueGames > 0 && shotBearingGames <= leagueGames && shotBearingGames <= selected.totals.fga && quality.shotBearingGames === leagueGames && quality.csvRows === league.totals.fga && quality.playersWithShots === Object.keys(players).length);
    for (const key of countKeys) requireValue(selected.totals[key] <= league.totals[key]);
    // Validate league weighting against all source-player totals, without summing team/TOT splits.
    requireValue(sameCounts(sum(Object.values(players).map(counts)), league.totals));
    const localImport = value.parserVersion === "nba-shot-summary-v1.2.0";
    let sourceRowExclusions: NonNullable<SeasonHeatmapRendererDTO["archive"]>["sourceRowExclusions"];
    if (localImport) {
      requireValue(year >= 1996 && year <= 2004 && provenance.acquisitionMethod === "user-authorized-git-clone-local-blob-verification");
      const excluded = integer(quality.quarantinedRowCount), playerExcluded = integer(player.quarantinedRowCount);
      requireValue(quality.rowCountConvention === "csvRows-accepted-explicit-point-type-only" && integer(quality.sourceCsvRows) === league.totals.fga + excluded && playerExcluded <= excluded);
      requireValue(Object.values(players).reduce<number>((sum, row) => sum + integer(object(row).quarantinedRowCount), 0) === excluded);
      if (excluded > 0) sourceRowExclusions = { reason: "unknown-shot-type", leagueRows: excluded, playerRows: playerExcluded };
    }
    const coverageStatus = player.coverageStatus;
    requireValue(coverageStatus === "not-officially-reconciled" || coverageStatus === "official-shooting-totals-match" || coverageStatus === "official-shooting-totals-mismatch");
    const officialGp = player.officialGp === null ? null : integer(player.officialGp);
    requireValue(officialGp === null || shotBearingGames <= officialGp);
    let officialControl: NonNullable<SeasonHeatmapRendererDTO["archive"]>["officialControl"] = null;
    if (player.officialControl !== null && player.officialControl !== undefined) {
      const control = object(player.officialControl), expected = counts(control.expected);
      requireValue(control.sourceUrl === `https://www.nba.com/stats/player/${identity.playerId}/career?PerMode=Totals`);
      requireValue(control.totalsMatch === sameCounts(selected.totals, expected) && coverageStatus === (control.totalsMatch ? "official-shooting-totals-match" : "official-shooting-totals-mismatch") && officialGp !== null);
      officialControl = { ...expected, url: control.sourceUrl, capturedAtUtc: timestamp(control.capturedAt) };
    } else requireValue(coverageStatus === "not-officially-reconciled" && officialGp === null);
    const row = (id: SeasonHeatmapDisplayRow["id"], sourceZoneId: string, shooting: Counts, reference?: Counts): SeasonHeatmapDisplayRow => ({
      id, sourceZoneId, ...shooting, fgPct: shooting.fga === 0 ? null : shooting.fgm / shooting.fga,
      fgPctDisplay: displayedPercentage(shooting.fgm, shooting.fga), sourceFgPctDisplay: displayedPercentage(shooting.fgm, shooting.fga),
      attemptShare: selected.totals.fga === 0 ? 0 : shooting.fga / selected.totals.fga,
      attemptShareDisplay: displayedPercentage(shooting.fga, selected.totals.fga), status: shooting.fga === 0 ? "no-attempts" : "has-attempts",
      leagueAverage: reference?.fga ? { displayedPct: displayedPercentage(reference.fgm, reference.fga)!, provenance: BENCHMARK, leagueFgm: reference.fgm, leagueFga: reference.fga } : null,
    });
    const zones = advanced14Geometry.map(zone => row(zone.id, zone.sourceZoneId, selected.zones.get(zone.sourceZoneId)!, league.zones.get(zone.sourceZoneId)));
    const residuals = (["backcourt", "unclassified"] as const).filter(id => selected.residuals.has(id)).map(id => row(id, id === "backcourt" ? "Back Court(BC) | Back Court Shot" : "null | null", selected.residuals.get(id)!, league.residuals.get(id)));
    return freeze({
      ...identity, geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION, status: "archive-summary",
      source: { url: sourceUrl(identity), capturedAtUtc: timestamp(localImport ? provenance.localVerifiedAt : provenance.downloadedAt), observedAtWindowUtc: null },
      zones, residuals, totals: { fgm: selected.totals.fgm, fga: selected.totals.fga },
      coverage: { aggregate: "archive-source-only", rawPoints: "not-captured", normalZoneAttempts: sum([...selected.zones.values()]).fga, residualAttempts: sum([...selected.residuals.values()]).fga, seasonAttemptDenominator: selected.totals.fga },
      benchmark: { kind: BENCHMARK, season: identity.season, seasonType: identity.seasonType, from, to, shotBearingGames: leagueGames, leagueFgm: league.totals.fgm, leagueFga: league.totals.fga },
      archive: { fg3m: selected.totals.fg3m, fg3a: selected.totals.fg3a, shotBearingGames, officialGp, coverageStatus, sourceCoverage: { from, to }, metadataObservedAtUtc: timestamp(provenance.metadataVerifiedAt), officialControl, ...(localImport ? { sourceObservationKind: "local-blob-verification" as const } : {}), ...(sourceRowExclusions ? { sourceRowExclusions } : {}) },
    });
  } catch { return null; }
}

type CourtResidual = "backcourt" | "unclassified" | "classification-conflict";
function courtCountBlock(raw: unknown) {
  const value = object(raw), totals = counts(value);
  requireValue(Array.isArray(value.sourceZoneCounts) && value.sourceZoneCounts.length <= 100);
  const zones = new Map<CourtBasic12ZoneId, Counts>(courtBasic12Zones.map(zone => [zone.id, zero()]));
  const residuals = new Map<CourtResidual, Counts>();
  const triples = new Set<string>(), distanceGroups = new Map<string, Counts>();
  const rawGroups: Counts[] = [];
  const retain = (id: CourtResidual, shooting: Counts) => {
    if (shooting.fga > 0) residuals.set(id, sum([residuals.get(id) ?? zero(), shooting]));
  };
  for (const item of value.sourceZoneCounts) {
    const group = object(item);
    requireValue([group.basic, group.area, group.range].every(key => typeof key === "string" && key.length <= 250));
    const basic = group.basic as string, area = group.area as string, range = group.range as string;
    const key = JSON.stringify([basic, area, range]); requireValue(!triples.has(key)); triples.add(key);
    const shooting = counts(group), distanceKey = `${area} | ${range}`;
    rawGroups.push(shooting);
    distanceGroups.set(distanceKey, sum([distanceGroups.get(distanceKey) ?? zero(), shooting]));
    if ((basic === "Backcourt" || basic === "Above the Break 3") && area === "Back Court(BC)" && range === "Back Court Shot") { retain("backcourt", shooting); continue; }
    const zone = courtZoneForSource(basic, area, range);
    if (!zone) { retain("unclassified", shooting); continue; }
    // Count contradictions explicitly, outside the court. Never reinterpret point value by geometry.
    const three = { fgm: shooting.fg3m, fga: shooting.fg3a, fg3m: shooting.fg3m, fg3a: shooting.fg3a };
    const two = { fgm: shooting.fgm - shooting.fg3m, fga: shooting.fga - shooting.fg3a, fg3m: 0, fg3a: 0 };
    const main = zone.shotValue === 3 ? three : two, conflict = zone.shotValue === 3 ? two : three;
    zones.set(zone.id, sum([zones.get(zone.id)!, main]));
    retain("classification-conflict", conflict);
  }
  requireValue(sameCounts(sum(rawGroups), totals));
  // The two independently stored summary views must also agree for every source area/range.
  const sourceZones = object(value.zones);
  requireValue(Array.isArray(value.residualZones));
  const expectedDistances = new Map<string, Counts>(Object.entries(sourceZones).map(([key, value]) => [key, counts(value)]));
  for (const item of value.residualZones) {
    const row = object(item), key = `${row.area} | ${row.range}`;
    expectedDistances.set(key, sum([expectedDistances.get(key) ?? zero(), counts(row)]));
  }
  for (const key of new Set([...distanceGroups.keys(), ...expectedDistances.keys()])) requireValue(sameCounts(distanceGroups.get(key) ?? zero(), expectedDistances.get(key) ?? zero()));
  requireValue(sameCounts(sum([...zones.values(), ...residuals.values()]), totals));
  return { totals, zones, residuals };
}

/** New default: recompute a court-aligned partition from BASIC/AREA, not the legacy distance rings. */
export function projectHistoricalCourtSummary(raw: unknown, identity: HeatmapIdentity): SeasonHeatmapRendererDTO | null {
  const legacy = projectHistoricalShotSummary(raw, identity);
  if (!legacy) return null;
  try {
    const value = object(raw), selected = courtCountBlock(object(value.players)[String(identity.playerId)]), league = courtCountBlock(value.league);
    const row = (id: SeasonHeatmapDisplayRow["id"], sourceZoneId: string, shooting: Counts, reference?: Counts): SeasonHeatmapDisplayRow => ({
      id, sourceZoneId, ...shooting, fgPct: shooting.fga === 0 ? null : shooting.fgm / shooting.fga,
      fgPctDisplay: displayedPercentage(shooting.fgm, shooting.fga), sourceFgPctDisplay: displayedPercentage(shooting.fgm, shooting.fga),
      attemptShare: selected.totals.fga === 0 ? 0 : shooting.fga / selected.totals.fga,
      attemptShareDisplay: displayedPercentage(shooting.fga, selected.totals.fga), status: shooting.fga === 0 ? "no-attempts" : "has-attempts",
      leagueAverage: reference?.fga ? { displayedPct: displayedPercentage(reference.fgm, reference.fga)!, provenance: BENCHMARK, leagueFgm: reference.fgm, leagueFga: reference.fga } : null,
    });
    const zones = courtBasic12Zones.map(zone => row(zone.id, zone.sourceZoneId, selected.zones.get(zone.id)!, league.zones.get(zone.id)));
    const residuals = (["backcourt", "unclassified", "classification-conflict"] as const).filter(id => selected.residuals.has(id)).map(id => row(id,
      id === "backcourt" ? "Back Court(BC) | Back Court Shot" : id === "classification-conflict" ? "Source classification / explicit shot type conflict" : "null | null",
      selected.residuals.get(id)!, league.residuals.get(id)));
    return freeze({ ...legacy, geometryVersion: SEASON_HEATMAP_COURT_GEOMETRY_VERSION, zones, residuals,
      coverage: { ...legacy.coverage, normalZoneAttempts: sum([...selected.zones.values()]).fga, residualAttempts: sum([...selected.residuals.values()]).fga } });
  } catch { return null; }
}

/** Read interface is injectable for integrity/failure tests. Files are allowlisted by the pinned index. */
export function createHistoricalShotArchiveStore(index: unknown, read: (file: string) => Promise<Buffer>) {
  const entries = summaryEntries(index), rawIndex = object(index), catalogTransport = object(rawIndex.catalog);
  requireValue(catalogTransport.file === "player-season-catalog.json.gz" && typeof catalogTransport.sha256 === "string" && /^[a-f0-9]{64}$/.test(catalogTransport.sha256));
  const catalogBytes = integer(catalogTransport.bytes), catalogJsonBytes = integer(catalogTransport.uncompressedBytes);
  requireValue(catalogBytes <= MAX_GZIP_BYTES && catalogJsonBytes <= MAX_JSON_BYTES);
  async function checkedJson(file: string, digest: string, bytes: number, expanded?: number): Promise<unknown> {
    const data = await read(file);
    requireValue(data.length === bytes && data.length <= MAX_GZIP_BYTES && createHash("sha256").update(data).digest("hex") === digest);
    const json = gunzipSync(data, { maxOutputLength: MAX_JSON_BYTES });
    requireValue(expanded === undefined || json.length === expanded);
    return JSON.parse(json.toString("utf8"));
  }
  let catalogPending: Promise<Catalog> | null = null;
  function catalog(): Promise<Catalog> {
    if (catalogPending) return catalogPending;
    catalogPending = (async () => {
      const value = object(await checkedJson("player-season-catalog.json.gz", catalogTransport.sha256 as string, catalogBytes, catalogJsonBytes));
      requireValue(value.schemaVersion === 1 && typeof value.parserVersion === "string" && PARSER_VERSIONS.includes(value.parserVersion) && value.repository === "fxy2026/nba_data" && value.revision === PIN && value.expectedArchiveCount === 60 && value.stagedArchiveCount === entries.size);
      const sourcePlayers = object(value.players), players = new Map<number, CatalogPlayer>();
      requireValue(Object.keys(sourcePlayers).length === rawIndex.playerCount);
      for (const [id, record] of Object.entries(sourcePlayers)) {
        const source = object(record); requireValue(/^[1-9]\d*$/.test(id) && source.playerId === id);
        const playerId = Number(id); requireValue(Number.isSafeInteger(playerId));
        requireValue(Array.isArray(source.names) && source.names.length > 0 && source.names.every(name => typeof name === "string" && name.length > 0 && name.length <= 150) && Array.isArray(source.seasons) && source.seasons.length > 0 && source.seasons.length <= 60);
        const seen = new Set<string>();
        const datasets: SeasonHeatmapCatalogEntry[] = source.seasons.map(rawSeason => {
          const season = object(rawSeason), identity = { playerId, season: season.season, seasonType: season.seasonType };
          requireValue(isSeasonHeatmapIdentity(identity) && entries.has(identityKey(identity)) && season.summary === summaryFile(identity) && !seen.has(identityKey(identity)));
          seen.add(identityKey(identity)); counts(season);
          return { ...identity, availability: "available" };
        });
        datasets.sort((a, b) => b.season.localeCompare(a.season) || (a.seasonType === "Regular Season" ? -1 : 1));
        const player = freeze({ playerId, name: source.names[0] as string, aliases: source.names as string[], firstSeason: datasets[datasets.length - 1].season, lastSeason: datasets[0].season, datasetCount: datasets.length });
        players.set(playerId, { player, searchText: source.names.join(" ").normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en"), datasets: freeze(datasets) });
      }
      return { players, sorted: [...players.values()].map(row => row.player).sort((a, b) => a.name.localeCompare(b.name, "en") || a.playerId - b.playerId) };
    })().catch(error => { catalogPending = null; throw error; });
    return catalogPending;
  }
  // At most two decompressed seasons are retained. Concurrent requests for a season share work.
  const summaries = new Map<string, Promise<unknown>>();
  function summary(entry: SummaryEntry): Promise<unknown> {
    const cached = summaries.get(entry.file);
    if (cached) { summaries.delete(entry.file); summaries.set(entry.file, cached); return cached; }
    const pending = checkedJson(entry.file, entry.sha256, entry.compressedBytes).catch(error => { if (summaries.get(entry.file) === pending) summaries.delete(entry.file); throw error; });
    summaries.set(entry.file, pending);
    while (summaries.size > 2) summaries.delete(summaries.keys().next().value!);
    return pending;
  }
  const resources = new Map<string, SeasonHeatmapArchiveResource>();
  return {
    async getPlayers(): Promise<readonly HistoricalShotPlayer[]> { return (await catalog()).sorted; },
    async getPlayer(playerId: number): Promise<HistoricalShotPlayer | null> { return (await catalog()).players.get(playerId)?.player ?? null; },
    async getCatalog(playerId: number): Promise<readonly SeasonHeatmapCatalogEntry[]> { return (await catalog()).players.get(playerId)?.datasets ?? []; },
    async search(query: string, requestedPage: number) {
      const source = await catalog(), needle = query.trim().slice(0, 100).normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");
      const filtered = needle ? source.sorted.filter(player => source.players.get(player.playerId)!.searchText.includes(needle) || String(player.playerId) === needle) : source.sorted;
      const page = Math.min(Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1), Math.max(1, Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE)));
      return { status: "ready" as const, players: filtered.slice((page - 1) * DIRECTORY_PAGE_SIZE, page * DIRECTORY_PAGE_SIZE), total: filtered.length, page, pageSize: DIRECTORY_PAGE_SIZE, seasonCount: new Set([...entries.values()].map(row => row.season)).size, archiveCount: entries.size };
    },
    async load(identity: unknown, geometry: "distance14" | "court12" = "distance14"): Promise<SeasonHeatmapArchiveResource> {
      if (!isSeasonHeatmapIdentity(identity)) return unavailable;
      const entry = entries.get(identityKey(identity)); if (!entry) return unavailable;
      const key = `${geometry}:${identity.playerId}:${identityKey(identity)}`, cached = resources.get(key);
      if (cached) { resources.delete(key); resources.set(key, cached); return cached; }
      try {
        if (!(await catalog()).players.get(identity.playerId)?.datasets.some(row => identityKey(row) === identityKey(identity))) return unavailable;
        const projected = (geometry === "court12" ? projectHistoricalCourtSummary : projectHistoricalShotSummary)(await summary(entry), identity);
        if (!projected) return failed;
        const result: SeasonHeatmapArchiveResource = freeze({ status: "ready", data: projected });
        resources.set(key, result); while (resources.size > 256) resources.delete(resources.keys().next().value!);
        return result;
      } catch { return failed; }
    },
  };
}
const store = createHistoricalShotArchiveStore(archiveIndex, file => readFile(path.join(ARCHIVE_ROOT, file)));
export const loadHistoricalShotArchive = (identity: unknown) => store.load(identity);
export const loadHistoricalCourtArchive = (identity: unknown) => store.load(identity, "court12");
export const getHistoricalShotCatalog = store.getCatalog;
export const getHistoricalShotPlayer = store.getPlayer;
export const getHistoricalShotPlayers = store.getPlayers;
export async function searchHistoricalShotPlayers(query: string, page: number) {
  try { return await store.search(query, page); } catch { return { status: "error" as const }; }
}
