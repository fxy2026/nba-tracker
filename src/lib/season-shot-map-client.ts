import type { HeatmapIdentity } from "./season-heatmap";
import { validArchiveMetadata } from "./season-heatmap-client";
import { SHOT_MAP_GEOMETRY_VERSION, SHOT_MAP_RESIDUAL_REASONS, SHOT_MAP_RESOLUTIONS, shotMapCellIntersectsFrame, type SeasonShotMapDTO, type SeasonShotMapResource, type ShotMapCounts } from "./season-shot-map";

const countKeys = ["fgm", "fga", "fg3m", "fg3a"] as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: readonly string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function shooting(value: unknown): value is ShotMapCounts {
  if (!object(value) || !countKeys.every(key => count(value[key]))) return false;
  const row = value as unknown as ShotMapCounts;
  return row.fgm <= row.fga && row.fg3m <= row.fg3a && row.fg3m <= row.fgm && row.fg3a <= row.fga && row.fgm - row.fg3m <= row.fga - row.fg3a;
}
const exactCounts = (value: unknown): value is ShotMapCounts => object(value) && keys(value, countKeys) && shooting(value);
const zero = (): ShotMapCounts => ({ fgm: 0, fga: 0, fg3m: 0, fg3a: 0 });
const equal = (a: ShotMapCounts, b: ShotMapCounts) => countKeys.every(key => a[key] === b[key]);
function add(total: ShotMapCounts, row: ShotMapCounts): void { for (const key of countKeys) total[key] += row[key]; }
const subset = (row: ShotMapCounts, whole: ShotMapCounts) => shooting(Object.fromEntries(countKeys.map(key => [key, whole[key] - row[key]])));
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);

/** Strict transport boundary. Hash verification and full-season assets stay on the server. */
export function decodeSeasonShotMapResource(value: unknown, expected: HeatmapIdentity): SeasonShotMapResource {
  const fail = (): SeasonShotMapResource => ({ status: "error" });
  if (!object(value)) return fail();
  if ((value.status === "error" || value.status === "unavailable") && keys(value, ["status"])) return { status: value.status };
  if (value.status !== "ready" || !keys(value, ["status", "data"]) || !object(value.data)) return fail();
  const data = value.data;
  if (!keys(data, ["playerId", "season", "seasonType", "schemaVersion", "geometryVersion", "totals", "plotted", "residuals", "resolutions", "source", "archive", "reference"]) || data.playerId !== expected.playerId || data.season !== expected.season || data.seasonType !== expected.seasonType || data.schemaVersion !== "nba-spatial-v1" || data.geometryVersion !== SHOT_MAP_GEOMETRY_VERSION) return fail();
  if (!exactCounts(data.totals) || !exactCounts(data.plotted) || !subset(data.plotted, data.totals) || !validArchiveMetadata(data.archive, data.totals, expected) || data.archive.fg3m !== data.totals.fg3m || data.archive.fg3a !== data.totals.fg3a) return fail();
  if (!object(data.source) || !keys(data.source, ["url", "capturedAtUtc"]) || !timestamp(data.source.capturedAtUtc)) return fail();
  const expectedSource = `https://raw.githubusercontent.com/fxy2026/nba_data/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/shotdetail_${expected.seasonType === "Playoffs" ? "po_" : ""}${expected.season.slice(0, 4)}.tar.xz`;
  if (data.source.url !== expectedSource) return fail();
  const reference = data.reference;
  if (!object(reference) || !keys(reference, ["kind", "includesPlayer", "minPlayerAttempts", "minLeagueAttempts", "scope"]) || reference.kind !== "same-season-type-cell-archive-counts" || reference.includesPlayer !== true || reference.minPlayerAttempts !== 5 || reference.minLeagueAttempts !== 20) return fail();
  const scope = reference.scope;
  if (!object(scope) || !keys(scope, ["kind", "season", "seasonType", "from", "to", "shotBearingGames", "leagueFgm", "leagueFga"]) || scope.kind !== "weighted-archive-counts-not-official-displayed-LA" || scope.season !== expected.season || scope.seasonType !== expected.seasonType || scope.from !== data.archive.sourceCoverage.from || scope.to !== data.archive.sourceCoverage.to || !count(scope.shotBearingGames) || scope.shotBearingGames < data.archive.shotBearingGames || !count(scope.leagueFgm) || !count(scope.leagueFga) || scope.leagueFgm > scope.leagueFga || scope.leagueFgm < data.totals.fgm || scope.leagueFga < data.totals.fga || scope.leagueFga - scope.leagueFgm < data.totals.fga - data.totals.fgm) return fail();
  if (!Array.isArray(data.residuals) || data.residuals.length > SHOT_MAP_RESIDUAL_REASONS.length) return fail();
  const combined = { ...data.plotted }, residualReasons = new Set<string>();
  for (const row of data.residuals) {
    if (!object(row) || !keys(row, ["reason", ...countKeys]) || !shooting(row) || row.fga === 0 || typeof row.reason !== "string" || !(SHOT_MAP_RESIDUAL_REASONS as readonly string[]).includes(row.reason) || residualReasons.has(row.reason)) return fail();
    if (row.reason === "coordinate-shot-type-conflict" && (row.fgm !== row.fg3m || row.fga !== row.fg3a)) return fail();
    residualReasons.add(row.reason); add(combined, row);
  }
  if (!equal(combined, data.totals) || !Array.isArray(data.resolutions) || data.resolutions.length !== SHOT_MAP_RESOLUTIONS.length) return fail();
  for (let i = 0; i < SHOT_MAP_RESOLUTIONS.length; i++) {
    const resolution = data.resolutions[i], spec = SHOT_MAP_RESOLUTIONS[i];
    if (!object(resolution) || !keys(resolution, ["id", "radius", "bins"]) || resolution.id !== spec.id || resolution.radius !== spec.radius || !Array.isArray(resolution.bins) || resolution.bins.length > 400) return fail();
    const summed = zero(), leagueSummed = zero(); let previous: [number, number] | null = null;
    for (const bin of resolution.bins) {
      if (!object(bin) || !keys(bin, ["q", "r", ...countKeys, "league"]) || !shooting(bin) || bin.fga === 0 || typeof bin.q !== "number" || !Number.isSafeInteger(bin.q) || typeof bin.r !== "number" || !Number.isSafeInteger(bin.r) || Math.abs(bin.q) > 32 || Math.abs(bin.r) > 32 || !exactCounts(bin.league) || !subset(bin, bin.league) || bin.league.fga > scope.leagueFga || bin.league.fgm > scope.leagueFgm) return fail();
      if (previous && (bin.q < previous[0] || bin.q === previous[0] && bin.r <= previous[1])) return fail();
      previous = [bin.q, bin.r];
      if (!shotMapCellIntersectsFrame({ q: bin.q, r: bin.r }, spec.radius)) return fail();
      add(summed, bin); add(leagueSummed, bin.league);
    }
    if (!equal(summed, data.plotted) || leagueSummed.fgm > scope.leagueFgm || leagueSummed.fga > scope.leagueFga || leagueSummed.fga - leagueSummed.fgm > scope.leagueFga - scope.leagueFgm) return fail();
  }
  return { status: "ready", data: data as unknown as SeasonShotMapDTO };
}
