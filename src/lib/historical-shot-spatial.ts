import "server-only";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import spatialIndex from "@/data/historical-shot-spatial/index.json";
import summaryIndex from "@/data/historical-shot-archive/catalog-index.json";
import earlyImportSourceManifest from "@/data/historical-shot-archive/early-import-source-manifest.json";
import { loadHistoricalCourtArchive } from "./historical-shot-archive";
import { isSeasonHeatmapIdentity } from "./verified-season-heatmap-archive";
import { decodeSeasonShotMapResource } from "./season-shot-map-client";
import { SHOT_MAP_GEOMETRY_VERSION, SHOT_MAP_MAX_DTO_BYTES, SHOT_MAP_RESIDUAL_REASONS, SHOT_MAP_RESOLUTIONS, shotMapCellIntersectsFrame, type SeasonShotMapDTO, type SeasonShotMapResource, type ShotMapBin, type ShotMapCounts, type ShotMapResolutionId, type ShotMapResidualReason } from "./season-shot-map";
import type { HeatmapIdentity, SeasonHeatmapArchiveResource, SeasonHeatmapRendererDTO } from "./season-heatmap";

const ROOT = path.join(process.cwd(), "src/data/historical-shot-spatial");
const PIN = "e829d4678be1e075f99e5d41a1c5f97089be446b";
const SOURCE_RELEASE = "0273d933ce91f777b790f126fffb95ac2012d2a5d2749ec76d0f059714a534a4";
const EARLY_SOURCE_RELEASE = createHash("sha256").update(JSON.stringify(earlyImportSourceManifest) + "\n").digest("hex");
const MAX_COMPRESSED = 2 * 1024 * 1024, MAX_EXPANDED = 16 * 1024 * 1024;
const countKeys = ["fgm", "fga", "fg3m", "fg3a"] as const;
type ObjectValue = Record<string, unknown>;
interface Entry { season: string; seasonType: HeatmapIdentity["seasonType"]; file: string; sha256: string; compressedBytes: number; uncompressedBytes: number; sourceSummarySha256: string }
interface Block { total: ShotMapCounts; plotted: ShotMapCounts; residuals: Map<ShotMapResidualReason, ShotMapCounts>; bins: Map<ShotMapResolutionId, Map<string, Omit<ShotMapBin, "league">>>; shotBearingGames: number }
interface Pack { players: Map<number, Block>; league: Block }
function requireValue(value: unknown): asserts value { if (!value) throw new Error("Invalid historical spatial archive"); }
function object(value: unknown): ObjectValue { requireValue(!!value && typeof value === "object" && !Array.isArray(value)); return value as ObjectValue; }
function integer(value: unknown): number { requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= 0); return value; }
function counts(value: unknown): ShotMapCounts {
  const row = object(value), [fgm, fga, fg3m, fg3a] = countKeys.map(key => integer(row[key]));
  requireValue(fgm <= fga && fg3m <= fg3a && fg3m <= fgm && fg3a <= fga && fgm - fg3m <= fga - fg3a);
  return { fgm, fga, fg3m, fg3a };
}
const zero = (): ShotMapCounts => ({ fgm: 0, fga: 0, fg3m: 0, fg3a: 0 });
function add(total: ShotMapCounts, row: ShotMapCounts): void { for (const key of countKeys) total[key] = integer(total[key] + row[key]); }
const equal = (a: ShotMapCounts, b: ShotMapCounts) => countKeys.every(key => a[key] === b[key]);
function subset(part: ShotMapCounts, whole: ShotMapCounts): void { counts(Object.fromEntries(countKeys.map(key => [key, whole[key] - part[key]]))); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const fileFor = (identity: Pick<HeatmapIdentity, "season" | "seasonType">) => `assets/${identity.season}-${identity.seasonType === "Playoffs" ? "playoffs" : "regular"}.json.gz`;
const keyFor = (identity: Pick<HeatmapIdentity, "season" | "seasonType">) => `${identity.season}:${identity.seasonType}`;
const summaries = new Map(summaryIndex.summaries.map(row => [`${row.season}:${row.seasonType}`, row]));

function indexEntries(index: unknown): Map<string, Entry> {
  const value = object(index);
  requireValue(value.schemaVersion === "nba-spatial-v1" && value.geometryVersion === SHOT_MAP_GEOMETRY_VERSION && Array.isArray(value.entries) && value.entries.length <= 60 && value.stagedArchiveCount === value.entries.length);
  const entries = new Map<string, Entry>();
  for (const item of value.entries) {
    const row = object(item), identity = { playerId: 1, season: row.season, seasonType: row.seasonType };
    requireValue(isSeasonHeatmapIdentity(identity));
    const summary = summaries.get(keyFor(identity));
    requireValue(summary && row.file === fileFor(identity) && row.sourceSummarySha256 === summary.sha256 && typeof row.sha256 === "string" && /^[a-f0-9]{64}$/.test(row.sha256) && !entries.has(keyFor(identity)));
    const compressedBytes = integer(row.compressedBytes), uncompressedBytes = integer(row.uncompressedBytes);
    requireValue(compressedBytes > 0 && compressedBytes <= MAX_COMPRESSED && uncompressedBytes > 0 && uncompressedBytes <= MAX_EXPANDED);
    entries.set(keyFor(identity), { season: identity.season, seasonType: identity.seasonType, file: row.file as string, sha256: row.sha256, compressedBytes, uncompressedBytes, sourceSummarySha256: summary.sha256 });
  }
  return entries;
}
function countBlock(raw: unknown, intersectsFrame: typeof shotMapCellIntersectsFrame): Block {
  const value = object(raw), total = counts(value.total), plotted = counts(value.plotted), residualsRaw = object(value.residuals), binsRaw = object(value.bins);
  requireValue(Object.keys(residualsRaw).length === SHOT_MAP_RESIDUAL_REASONS.length && Object.keys(binsRaw).length === SHOT_MAP_RESOLUTIONS.length);
  const residuals = new Map<ShotMapResidualReason, ShotMapCounts>(), reconciled = { ...plotted };
  for (const reason of SHOT_MAP_RESIDUAL_REASONS) { const row = counts(residualsRaw[reason]); residuals.set(reason, row); add(reconciled, row); }
  requireValue(equal(reconciled, total));
  const bins = new Map<ShotMapResolutionId, Map<string, Omit<ShotMapBin, "league">>>();
  for (const spec of SHOT_MAP_RESOLUTIONS) {
    const rows = binsRaw[spec.id]; requireValue(Array.isArray(rows) && rows.length <= 400);
    const mapped = new Map<string, Omit<ShotMapBin, "league">>(), sum = zero(); let previous: [number, number] | null = null;
    for (const rawRow of rows) {
      requireValue(Array.isArray(rawRow) && rawRow.length === 6);
      const [q, r, fgm, fga, fg3m, fg3a] = rawRow;
      requireValue(typeof q === "number" && Number.isSafeInteger(q) && Math.abs(q) <= 32 && typeof r === "number" && Number.isSafeInteger(r) && Math.abs(r) <= 32 && intersectsFrame({ q, r }, spec.radius));
      requireValue(!previous || q > previous[0] || q === previous[0] && r > previous[1]); previous = [q, r];
      const row = { q, r, ...counts({ fgm, fga, fg3m, fg3a }) }; requireValue(row.fga > 0);
      mapped.set(`${q}:${r}`, row); add(sum, row);
    }
    requireValue(equal(sum, plotted)); bins.set(spec.id, mapped);
  }
  const shotBearingGames = integer(value.shotBearingGames); requireValue(shotBearingGames <= total.fga);
  const recordedZero = counts(value.recordedZeroCoordinates), conflict = residuals.get("coordinate-shot-type-conflict")!;
  // These are literal source zeros, not independently verified physical positions.
  // Only explicit 3P at exactly (0,0) is quarantined by the importer.
  requireValue(conflict.fgm === conflict.fg3m && conflict.fga === conflict.fg3a && conflict.fg3m === recordedZero.fg3m && conflict.fg3a === recordedZero.fg3a);
  subset(conflict, recordedZero);
  const plottedZero = counts(Object.fromEntries(countKeys.map(key => [key, recordedZero[key] - conflict[key]]))); subset(plottedZero, plotted);
  for (const grid of bins.values()) subset(plottedZero, grid.get("0:0") ?? zero());
  return { total, plotted, residuals, bins, shotBearingGames };
}
function parsePack(raw: unknown, identity: HeatmapIdentity): Pack {
  // Every player uses the same finite lattice. Reuse the exact predicate within
  // this validation pass, without retaining source data or changing geometry.
  const frameCells = new Map<string, boolean>();
  const intersectsFrame: typeof shotMapCellIntersectsFrame = (bin, radius) => {
    const key = `${radius}:${bin.q}:${bin.r}`;
    const cached = frameCells.get(key); if (cached !== undefined) return cached;
    const result = shotMapCellIntersectsFrame(bin, radius); frameCells.set(key, result); return result;
  };
  const value = object(raw), frame = object(value.coordinateFrame), geometry = object(value.geometry), metrics = object(value.metrics), provenance = object(value.provenance), source = object(provenance.sourceArchive), quality = object(value.quality);
  requireValue(value.schemaVersion === "nba-spatial-v1" && value.geometryVersion === SHOT_MAP_GEOMETRY_VERSION && value.season === identity.season && value.seasonStartYear === Number(identity.season.slice(0, 4)) && value.seasonType === identity.seasonType);
  requireValue(frame.id === "nba-legacy-tenths-feet" && frame.unitsPerFoot === 10 && frame.origin === "basket-center" && frame.positiveX === "right" && frame.positiveY === "toward-half-court" && frame.xMin === -250 && frame.xMax === 250 && frame.yMin === -52.5 && frame.yMax === 417.5 && frame.fullCourtYMax === 887.5 && frame.boundsInclusive === true && frame.coordinateTransform === "none" && frame.officialEventCoordinateVerification === false);
  requireValue(geometry.geometryVersion === SHOT_MAP_GEOMETRY_VERSION && geometry.orientation === "pointy" && JSON.stringify(geometry.origin) === "[0,0]" && object(geometry.resolutions).fine === 25 && object(geometry.resolutions).coarse === 40 && Object.keys(object(geometry.resolutions)).length === 2 && JSON.stringify(geometry.binColumns) === '["q","r","fgm","fga","fg3m","fg3a"]' && geometry.tieRule === "floor(v+0.5); largest-error correction; equal-error priority z,y,x" && geometry.maxBinsPerResolution === 400);
  requireValue(metrics.baseline === "same-season-type-bin-weighted-archive-including-player" && metrics.efficiency === "raw-field-goal-percentage-point-difference" && metrics.minimumPlayerAttemptsForColor === 5 && metrics.minimumLeagueAttemptsForColor === 20 && metrics.regularization === "none" && metrics.density === "optional-smoothed-binned-attempt-frequency-estimate");
  const earlyImport = Number(identity.season.slice(0, 4)) < 2005;
  requireValue(Number(identity.season.slice(0, 4)) >= 1996 && Number(identity.season.slice(0, 4)) <= 2025);
  requireValue(value.parserVersion === (earlyImport ? "nba-spatial-importer-v1.2.0" : "nba-spatial-importer-v1.1.0"));
  const summary = summaries.get(keyFor(identity)); requireValue(summary && provenance.sourceSummarySha256 === summary.sha256 && provenance.sourceReleaseSha256 === (earlyImport ? EARLY_SOURCE_RELEASE : SOURCE_RELEASE));
  if (earlyImport) {
    requireValue(provenance.generatingCodeSha256 === earlyImportSourceManifest.parserCodeSha256 && source.acquisitionMethod === "user-authorized-git-clone-local-blob-verification");
    requireValue(integer(quality.sourceCsvRows) === integer(quality.csvRows) + integer(quality.quarantinedRowCount));
  }
  requireValue(source.repository === "fxy2026/nba_data" && source.revision === PIN && source.path === `datasets/shotdetail_${identity.seasonType === "Playoffs" ? "po_" : ""}${identity.season.slice(0, 4)}.tar.xz` && source.sourceUrl === `https://raw.githubusercontent.com/fxy2026/nba_data/${PIN}/${source.path}` && quality.duplicateGameEventKeys === 0 && quality.officialCoverage === "not-officially-reconciled");
  const league = countBlock(value.league, intersectsFrame), rawPlayers = object(value.players), players = new Map<number, Block>(), sum = zero(), plotted = zero();
  requireValue(Object.keys(rawPlayers).length <= 1000 && quality.csvRows === league.total.fga);
  const leagueSums = new Map(SHOT_MAP_RESOLUTIONS.map(spec => [spec.id, new Map<string, ShotMapCounts>()]));
  const residualSums = new Map(SHOT_MAP_RESIDUAL_REASONS.map(reason => [reason, zero()]));
  for (const [id, rawPlayer] of Object.entries(rawPlayers)) {
    const player = object(rawPlayer); requireValue(/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) && player.playerId === id);
    const block = countBlock(player, intersectsFrame); requireValue(block.shotBearingGames <= league.shotBearingGames); players.set(Number(id), block); add(sum, block.total); add(plotted, block.plotted);
    for (const [reason, counts] of block.residuals) add(residualSums.get(reason)!, counts);
    for (const [resolution, bins] of block.bins) for (const [key, counts] of bins) {
      const binsTotal = leagueSums.get(resolution)!; if (!binsTotal.has(key)) binsTotal.set(key, zero()); add(binsTotal.get(key)!, counts);
    }
  }
  requireValue(equal(sum, league.total) && equal(plotted, league.plotted));
  for (const [reason, sum] of residualSums) requireValue(equal(sum, league.residuals.get(reason)!));
  for (const [resolution, bins] of league.bins) {
    const summed = leagueSums.get(resolution)!; requireValue(summed.size === bins.size);
    for (const [key, counts] of bins) requireValue(summed.has(key) && equal(summed.get(key)!, counts));
  }
  return { league, players };
}
function project(pack: Pack, court: SeasonHeatmapRendererDTO): SeasonShotMapDTO | null {
  try {
    requireValue(court.status === "archive-summary" && court.geometryVersion === "nba-court-basic12-v1" && court.archive && court.source?.capturedAtUtc && court.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA");
    const player = pack.players.get(court.playerId); requireValue(player);
    requireValue(equal(player.total, { ...court.totals, fg3m: court.archive.fg3m, fg3a: court.archive.fg3a }) && player.shotBearingGames === court.archive.shotBearingGames && pack.league.total.fgm === court.benchmark.leagueFgm && pack.league.total.fga === court.benchmark.leagueFga && pack.league.shotBearingGames === court.benchmark.shotBearingGames);
    const data: SeasonShotMapDTO = {
      playerId: court.playerId, season: court.season, seasonType: court.seasonType, schemaVersion: "nba-spatial-v1", geometryVersion: SHOT_MAP_GEOMETRY_VERSION,
      totals: { ...player.total }, plotted: { ...player.plotted },
      residuals: [...player.residuals].filter(([, counts]) => counts.fga > 0).map(([reason, counts]) => ({ reason, ...counts })),
      resolutions: SHOT_MAP_RESOLUTIONS.map(spec => ({ ...spec, bins: [...player.bins.get(spec.id)!.entries()].map(([key, counts]) => {
        const league = pack.league.bins.get(spec.id)!.get(key); requireValue(league); subset(counts, league);
        return { ...counts, league: { fgm: league.fgm, fga: league.fga, fg3m: league.fg3m, fg3a: league.fg3a } };
      }) })),
      source: { url: court.source.url, capturedAtUtc: court.source.capturedAtUtc }, archive: court.archive,
      reference: { kind: "same-season-type-cell-archive-counts", includesPlayer: true, minPlayerAttempts: 5, minLeagueAttempts: 20, scope: court.benchmark },
    };
    const checked = decodeSeasonShotMapResource({ status: "ready", data }, court); requireValue(checked.status === "ready");
    return freeze(checked.data);
  } catch { return null; }
}
/** Public test/review seam; validates full compact pack before projecting one identity. */
export function projectHistoricalShotMap(raw: unknown, court: SeasonHeatmapRendererDTO): SeasonShotMapDTO | null {
  try { return project(parsePack(raw, court), court); } catch { return null; }
}

export function createHistoricalShotMapStore(index: unknown, read: (file: string) => Promise<Buffer>, loadCourt: (identity: HeatmapIdentity) => Promise<SeasonHeatmapArchiveResource> = loadHistoricalCourtArchive) {
  const entries = indexEntries(index), packs = new Map<string, Pack>(), pendingPacks = new Map<string, Promise<Pack>>();
  const resources = new Map<string, { resource: SeasonShotMapResource; bytes: number }>(), pendingResources = new Map<string, Promise<SeasonShotMapResource>>();
  let resourceBytes = 0, decodeTail: Promise<void> = Promise.resolve();
  async function pack(entry: Entry, identity: HeatmapIdentity): Promise<Pack> {
    const cached = packs.get(entry.file); if (cached) { packs.delete(entry.file); packs.set(entry.file, cached); return cached; }
    const inFlight = pendingPacks.get(entry.file); if (inFlight) return inFlight;
    // Serialize disk reads/decompression as well as bounding the retained pack cache.
    // A burst across many seasons must not inflate many compressed packs at once.
    const pending = decodeTail.then(async () => {
      const bytes = await read(entry.file); requireValue(bytes.length === entry.compressedBytes && bytes.length <= MAX_COMPRESSED && createHash("sha256").update(bytes).digest("hex") === entry.sha256);
      const json = gunzipSync(bytes, { maxOutputLength: MAX_EXPANDED }); requireValue(json.length === entry.uncompressedBytes);
      const parsed = parsePack(JSON.parse(json.toString("utf8")), identity);
      packs.set(entry.file, parsed); while (packs.size > 2) packs.delete(packs.keys().next().value!);
      return parsed;
    }).finally(() => { if (pendingPacks.get(entry.file) === pending) pendingPacks.delete(entry.file); });
    decodeTail = pending.then(() => undefined, () => undefined);
    // Pending entries are separate from the two settled packs, so a queued
    // season cannot evict another season's in-flight work and duplicate it.
    pendingPacks.set(entry.file, pending);
    return pending;
  }
  return {
    async load(identity: unknown): Promise<SeasonShotMapResource> {
      if (!isSeasonHeatmapIdentity(identity)) return { status: "unavailable" };
      const entry = entries.get(keyFor(identity)); if (!entry) return { status: "unavailable" };
      const key = `${identity.playerId}:${keyFor(identity)}`, cached = resources.get(key);
      if (cached) { resources.delete(key); resources.set(key, cached); return cached.resource; }
      const inFlight = pendingResources.get(key); if (inFlight) return inFlight;
      const pending = (async (): Promise<SeasonShotMapResource> => {
        try {
          const court = await loadCourt(identity); if (court.status !== "ready") return court;
          const data = project(await pack(entry, identity), court.data); if (!data) return { status: "error" };
          const resource: SeasonShotMapResource = freeze({ status: "ready", data }), bytes = Buffer.byteLength(JSON.stringify(resource));
          requireValue(bytes <= SHOT_MAP_MAX_DTO_BYTES);
          resourceBytes -= resources.get(key)?.bytes ?? 0;
          resources.set(key, { resource, bytes }); resourceBytes += bytes;
          while (resources.size > 128 || resourceBytes > 4 * 1024 * 1024) {
            const oldest = resources.keys().next().value!; resourceBytes -= resources.get(oldest)!.bytes; resources.delete(oldest);
          }
          return resource;
        } catch { return { status: "error" }; }
      })().finally(() => { if (pendingResources.get(key) === pending) pendingResources.delete(key); });
      pendingResources.set(key, pending);
      return pending;
    },
  };
}
const store = createHistoricalShotMapStore(spatialIndex, file => readFile(path.join(ROOT, file)));
export const loadHistoricalShotMap = store.load;
