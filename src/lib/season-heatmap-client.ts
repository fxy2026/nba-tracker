import { advanced14Geometry } from "./season-heatmap-geometry";
import type { HeatmapIdentity, SeasonHeatmapRendererDTO, SeasonHeatmapArchiveResource } from "./season-heatmap";

export type { SeasonHeatmapArchiveResource } from "./season-heatmap";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const percent = (value: unknown): value is string => typeof value === "string" && /^(?:\d{1,2}|100)\.\d$/.test(value) && Number(value) <= 100;
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
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
  if (!keys(data, ["playerId", "season", "seasonType", "geometryVersion", "status", "zones", "residuals", "totals", "coverage", "benchmark", "source"]) || data.status !== "verified-aggregate" || data.geometryVersion !== "nba-advanced14-svg-v1" || data.playerId !== expected.playerId || data.season !== expected.season || data.seasonType !== expected.seasonType) return fail();
  if (!object(data.totals) || !keys(data.totals, ["fgm", "fga"]) || !count(data.totals.fgm) || !count(data.totals.fga) || data.totals.fgm > data.totals.fga) return fail();
  const total = { fgm: data.totals.fgm, fga: data.totals.fga };
  if (!object(data.coverage) || !keys(data.coverage, ["aggregate", "rawPoints", "normalZoneAttempts", "residualAttempts", "seasonAttemptDenominator"]) || data.coverage.aggregate !== "full-season-reconciled" || data.coverage.rawPoints !== "not-captured" || data.coverage.seasonAttemptDenominator !== total.fga) return fail();
  if (data.benchmark !== null && (!object(data.benchmark) || !keys(data.benchmark, ["kind", "independentlyVerifiedScope", "leagueFgm", "leagueFga"]) || data.benchmark.kind !== "source-displayed-unverified-scope" || data.benchmark.independentlyVerifiedScope !== null || data.benchmark.leagueFgm !== null || data.benchmark.leagueFga !== null)) return fail();
  if (!object(data.source) || !keys(data.source, ["url", "capturedAtUtc", "observedAtWindowUtc"]) || typeof data.source.url !== "string") return fail();
  try {
    const url = new URL(data.source.url);
    if (url.protocol !== "https:" || url.hostname !== "www.nba.com" || url.pathname !== "/stats/events" || url.username || url.password || url.port || url.hash || url.searchParams.get("PlayerID") !== String(expected.playerId) || url.searchParams.get("Season") !== expected.season || url.searchParams.get("SeasonType") !== expected.seasonType) return fail();
  } catch { return fail(); }
  const timestamp = (v: unknown) => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) && Number.isFinite(Date.parse(v));
  if (data.source.capturedAtUtc !== null && !timestamp(data.source.capturedAtUtc)) return fail();
  const window = data.source.observedAtWindowUtc;
  if (window !== null && (!Array.isArray(window) || window.length !== 2 || !window.every(timestamp) || Date.parse(window[0]) > Date.parse(window[1]))) return fail();
  if (!Array.isArray(data.zones) || data.zones.length !== 14 || !Array.isArray(data.residuals) || data.residuals.length > 2) return fail();
  let made = 0, mapped = 0, residual = 0;
  const seen = new Set<string>();
  for (const [isResidual, rows] of [[false, data.zones], [true, data.residuals]] as const) {
    for (const row of rows) {
      if (!object(row) || !keys(row, ["id", "sourceZoneId", "fgm", "fga", "fgPct", "fgPctDisplay", "sourceFgPctDisplay", "attemptShare", "attemptShareDisplay", "status", "leagueAverage"]) || typeof row.id !== "string" || seen.has(row.id) || !count(row.fgm) || !count(row.fga) || row.fgm > row.fga || row.fga > total.fga) return fail();
      seen.add(row.id);
      const sourceId = isResidual ? row.id === "backcourt" ? "Back Court(BC) | Back Court Shot" : row.id === "unclassified" ? "null | null" : null : advanced14Geometry.find(g => g.id === row.id)?.sourceZoneId;
      if (!sourceId || row.sourceZoneId !== sourceId || row.fgPct !== (row.fga ? row.fgm / row.fga : null) || row.fgPctDisplay !== shown(row.fgm, row.fga) || row.status !== (row.fga ? "has-attempts" : "no-attempts") || row.attemptShare !== (total.fga ? row.fga / total.fga : 0)) return fail();
      if (row.attemptShareDisplay !== shown(row.fga, total.fga) && !(total.fga === 0 && row.attemptShareDisplay === "0.0")) return fail();
      if (row.sourceFgPctDisplay !== row.fgPctDisplay && !(row.fga === 0 && row.sourceFgPctDisplay === "0.0")) return fail();
      if (row.leagueAverage !== null && (!data.benchmark || !object(row.leagueAverage) || !keys(row.leagueAverage, ["displayedPct", "provenance"]) || !percent(row.leagueAverage.displayedPct) || row.leagueAverage.provenance !== "source-displayed-unverified-scope")) return fail();
      made += row.fgm;
      if (isResidual) residual += row.fga; else mapped += row.fga;
    }
  }
  if (made !== total.fgm || mapped + residual !== total.fga || data.coverage.normalZoneAttempts !== mapped || data.coverage.residualAttempts !== residual) return fail();
  return { status: "ready", data: data as unknown as SeasonHeatmapRendererDTO };
}
