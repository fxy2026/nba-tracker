import { advanced14Geometry } from "./season-heatmap-geometry";
import { courtBasic12Zones, SEASON_HEATMAP_COURT_GEOMETRY_VERSION } from "./season-heatmap-court-zones";
import type { HeatmapIdentity, SeasonHeatmapRendererDTO, SeasonHeatmapArchiveResource } from "./season-heatmap";

export type { SeasonHeatmapArchiveResource } from "./season-heatmap";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const percent = (value: unknown): value is string => typeof value === "string" && /^(?:\d{1,2}|100)\.\d$/.test(value) && Number(value) <= 100;
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const calendarTimestamp = (value: unknown): value is string => timestamp(value) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const shooting = (value: Record<string, unknown>): boolean => count(value.fgm) && count(value.fga) && count(value.fg3m) && count(value.fg3a) && value.fgm <= value.fga && value.fg3m <= value.fg3a && value.fg3m <= value.fgm && value.fg3a <= value.fga && value.fgm - value.fg3m <= value.fga - value.fg3a;
const archiveKind = "weighted-archive-counts-not-official-displayed-LA";
const shown = (made: number, attempts: number) => {
  if (attempts === 0) return null;
  const tenths = (BigInt(made) * BigInt(2000) + BigInt(attempts)) / (BigInt(attempts) * BigInt(2));
  return `${tenths / BigInt(10)}.${tenths % BigInt(10)}`;
};

/** Defensive client boundary. Immutable-source approval and checksums remain server-only. */
export function decodeSeasonHeatmapResource(value: unknown, expected: HeatmapIdentity): SeasonHeatmapArchiveResource {
  if (!object(value)) return { status: "error" };
  if ((value.status === "unavailable" || value.status === "error") && keys(value, ["status"])) return { status: value.status };
  if (value.status !== "ready" || !keys(value, ["status", "data"]) || !object(value.data)) return { status: "error" };
  const data = value.data;
  const fail = (): SeasonHeatmapArchiveResource => ({ status: "error" });
  const archive = data.status === "archive-summary";
  const courtAligned = data.geometryVersion === SEASON_HEATMAP_COURT_GEOMETRY_VERSION;
  const regions = courtAligned ? courtBasic12Zones : advanced14Geometry;
  if (!keys(data, ["playerId", "season", "seasonType", "geometryVersion", "status", "zones", "residuals", "totals", "coverage", "benchmark", "source", ...(archive ? ["archive"] : [])]) || (!archive && data.status !== "verified-aggregate") || (!courtAligned && data.geometryVersion !== "nba-advanced14-svg-v1") || (courtAligned && !archive) || data.playerId !== expected.playerId || data.season !== expected.season || data.seasonType !== expected.seasonType) return fail();
  if (!object(data.totals) || !keys(data.totals, ["fgm", "fga"]) || !count(data.totals.fgm) || !count(data.totals.fga) || data.totals.fgm > data.totals.fga) return fail();
  const total = { fgm: data.totals.fgm, fga: data.totals.fga };
  if (!object(data.coverage) || !keys(data.coverage, ["aggregate", "rawPoints", "normalZoneAttempts", "residualAttempts", "seasonAttemptDenominator"]) || data.coverage.aggregate !== (archive ? "archive-source-only" : "full-season-reconciled") || data.coverage.rawPoints !== "not-captured" || data.coverage.seasonAttemptDenominator !== total.fga) return fail();
  if (archive) {
    if (!validArchiveMetadata(data.archive, total, expected)) return fail();
    const benchmark = data.benchmark;
    if (benchmark !== null && (!object(benchmark) || !keys(benchmark, ["kind", "season", "seasonType", "from", "to", "shotBearingGames", "leagueFgm", "leagueFga"]) || benchmark.kind !== archiveKind || benchmark.season !== expected.season || benchmark.seasonType !== expected.seasonType || benchmark.from !== data.archive.sourceCoverage.from || benchmark.to !== data.archive.sourceCoverage.to || !count(benchmark.shotBearingGames) || benchmark.shotBearingGames < data.archive.shotBearingGames || !count(benchmark.leagueFgm) || !count(benchmark.leagueFga) || benchmark.leagueFgm > benchmark.leagueFga || benchmark.leagueFgm < total.fgm || benchmark.leagueFga < total.fga)) return fail();
  } else if (data.benchmark !== null && (!object(data.benchmark) || !keys(data.benchmark, ["kind", "independentlyVerifiedScope", "leagueFgm", "leagueFga"]) || data.benchmark.kind !== "source-displayed-unverified-scope" || data.benchmark.independentlyVerifiedScope !== null || data.benchmark.leagueFgm !== null || data.benchmark.leagueFga !== null)) return fail();
  if (!object(data.source) || !keys(data.source, ["url", "capturedAtUtc", "observedAtWindowUtc"]) || typeof data.source.url !== "string") return fail();
  try {
    const url = new URL(data.source.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return fail();
    if (archive) {
      const path = `/fxy2026/nba_data/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/shotdetail_${expected.seasonType === "Playoffs" ? "po_" : ""}${expected.season.slice(0, 4)}.tar.xz`;
      if (url.hostname !== "raw.githubusercontent.com" || url.pathname !== path || url.search) return fail();
    } else if (url.hostname !== "www.nba.com" || url.pathname !== "/stats/events" || url.searchParams.get("PlayerID") !== String(expected.playerId) || url.searchParams.get("Season") !== expected.season || url.searchParams.get("SeasonType") !== expected.seasonType) return fail();
  } catch { return fail(); }
  if (data.source.capturedAtUtc !== null && !timestamp(data.source.capturedAtUtc)) return fail();
  if (archive && !calendarTimestamp(data.source.capturedAtUtc)) return fail();
  const window = data.source.observedAtWindowUtc;
  if (window !== null && (!Array.isArray(window) || window.length !== 2 || !window.every(timestamp) || Date.parse(window[0]) > Date.parse(window[1]))) return fail();
  if (archive && window !== null && (!Array.isArray(window) || !window.every(calendarTimestamp))) return fail();
  if (!Array.isArray(data.zones) || data.zones.length !== regions.length || !Array.isArray(data.residuals) || data.residuals.length > (courtAligned ? 3 : 2)) return fail();
  let made = 0, mapped = 0, residual = 0, threeMade = 0, threeAttempts = 0;
  const seen = new Set<string>();
  for (const [isResidual, rows] of [[false, data.zones], [true, data.residuals]] as const) {
    for (const row of rows) {
      if (!object(row) || !keys(row, ["id", "sourceZoneId", "fgm", "fga", "fgPct", "fgPctDisplay", "sourceFgPctDisplay", "attemptShare", "attemptShareDisplay", "status", "leagueAverage", ...(archive ? ["fg3m", "fg3a"] : [])]) || typeof row.id !== "string" || seen.has(row.id) || !count(row.fgm) || !count(row.fga) || row.fgm > row.fga || row.fga > total.fga) return fail();
      if (archive) {
        if (!shooting(row) || !count(row.fg3m) || !count(row.fg3a)) return fail();
        threeMade += row.fg3m; threeAttempts += row.fg3a;
      }
      seen.add(row.id);
      const region = isResidual ? undefined : regions.find(region => region.id === row.id);
      const sourceId = isResidual ? row.id === "backcourt" ? "Back Court(BC) | Back Court Shot" : row.id === "unclassified" ? "null | null" : courtAligned && row.id === "classification-conflict" ? "Source classification / explicit shot type conflict" : null : region?.sourceZoneId;
      if (courtAligned && !isResidual) {
        const shotValue = courtBasic12Zones.find(region => region.id === row.id)?.shotValue;
        // Inconsistent explicit shot types belong outside the court. Never paint
        // a 3P in a 2P region, or silently place a 2P beyond the three-point line.
        if (shotValue === 2 ? row.fg3m !== 0 || row.fg3a !== 0 : shotValue === 3 ? row.fg3m !== row.fgm || row.fg3a !== row.fga : true) return fail();
      }
      if (!sourceId || row.sourceZoneId !== sourceId || row.fgPct !== (row.fga ? row.fgm / row.fga : null) || row.fgPctDisplay !== shown(row.fgm, row.fga) || row.status !== (row.fga ? "has-attempts" : "no-attempts") || row.attemptShare !== (total.fga ? row.fga / total.fga : 0)) return fail();
      if (row.attemptShareDisplay !== shown(row.fga, total.fga) && !(total.fga === 0 && row.attemptShareDisplay === "0.0")) return fail();
      if (row.sourceFgPctDisplay !== row.fgPctDisplay && !(row.fga === 0 && row.sourceFgPctDisplay === "0.0")) return fail();
      if (row.leagueAverage !== null) {
        const league = row.leagueAverage;
        if (!object(data.benchmark) || !object(league) || !percent(league.displayedPct)) return fail();
        if (archive) {
          if (!keys(league, ["displayedPct", "provenance", "leagueFgm", "leagueFga"]) || league.provenance !== archiveKind || !count(league.leagueFgm) || !count(league.leagueFga) || league.leagueFga === 0 || league.leagueFgm > league.leagueFga || league.displayedPct !== shown(league.leagueFgm, league.leagueFga) || !count(data.benchmark.leagueFgm) || !count(data.benchmark.leagueFga) || league.leagueFgm > data.benchmark.leagueFgm || league.leagueFga > data.benchmark.leagueFga || league.leagueFgm < row.fgm || league.leagueFga < row.fga) return fail();
        } else if (!keys(league, ["displayedPct", "provenance"]) || league.provenance !== "source-displayed-unverified-scope") return fail();
      }
      made += row.fgm;
      if (isResidual) residual += row.fga; else mapped += row.fga;
    }
  }
  if (made !== total.fgm || mapped + residual !== total.fga || data.coverage.normalZoneAttempts !== mapped || data.coverage.residualAttempts !== residual) return fail();
  if (archive && (!object(data.archive) || threeMade !== data.archive.fg3m || threeAttempts !== data.archive.fg3a)) return fail();
  return { status: "ready", data: data as unknown as SeasonHeatmapRendererDTO };
}

export function validArchiveMetadata(value: unknown, total: { fgm: number; fga: number }, expected: HeatmapIdentity): value is import("./season-heatmap").HeatmapArchiveMetadata {
  if (!object(value) || !keys(value, ["fg3m", "fg3a", "shotBearingGames", "officialGp", "coverageStatus", "sourceCoverage", "metadataObservedAtUtc", "officialControl"]) || !shooting({ ...total, fg3m: value.fg3m, fg3a: value.fg3a }) || !count(value.shotBearingGames) || value.shotBearingGames > total.fga || !calendarTimestamp(value.metadataObservedAtUtc) || !object(value.sourceCoverage) || !keys(value.sourceCoverage, ["from", "to"]) || !date(value.sourceCoverage.from) || !date(value.sourceCoverage.to) || value.sourceCoverage.from > value.sourceCoverage.to) return false;
  const year = Number(expected.season.slice(0, 4));
  if (value.sourceCoverage.from < `${year}-07-01` || value.sourceCoverage.to > `${year + 1}-12-31`) return false;
  if (value.officialControl === null) return value.coverageStatus === "not-officially-reconciled" && value.officialGp === null;
  const control = value.officialControl;
  if (!object(control) || !keys(control, ["fgm", "fga", "fg3m", "fg3a", "url", "capturedAtUtc"]) || !shooting(control) || !calendarTimestamp(control.capturedAtUtc) || !count(value.officialGp) || value.officialGp < value.shotBearingGames || typeof control.url !== "string") return false;
  try {
    const url = new URL(control.url);
    if (url.protocol !== "https:" || url.hostname !== "www.nba.com" || url.username || url.password || url.port || url.hash || url.pathname !== `/stats/player/${expected.playerId}/career` || url.search !== "?PerMode=Totals") return false;
  } catch { return false; }
  const matches = control.fgm === total.fgm && control.fga === total.fga && control.fg3m === value.fg3m && control.fg3a === value.fg3a;
  return value.coverageStatus === (matches ? "official-shooting-totals-match" : "official-shooting-totals-mismatch");
}
