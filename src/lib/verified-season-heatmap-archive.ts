import "server-only";
import { createHash } from "node:crypto";
import curry2025 from "@/data/verified-season-heatmaps/201939-2025-26-regular.json";
import curry2015 from "@/data/verified-season-heatmaps/201939-2015-16-regular.json";
import {
  advanced14Geometry, SEASON_HEATMAP_CLASSIFICATION_VERSION, SEASON_HEATMAP_GEOMETRY_VERSION,
} from "./season-heatmap-geometry";
import { displayedPercentage } from "./season-heatmap-server";
import type {
  HeatmapCounts, HeatmapIdentity, SeasonHeatmapArchiveResource, SeasonHeatmapCatalogEntry,
  SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO,
} from "./season-heatmap";

// Only these separately verified, immutable aggregate identities are enabled.
// Hashes cover canonical public facts, not capture artifacts or review documents.
const reviewed = [
  {
    playerId: 201939, season: "2025-26", seasonType: "Regular Season",
    factsSha256: "e0b0a43cca260faf547cd834dc15788bc6379838523b6dead8ec8e60bd6b2a22",
    fgm: 374, fga: 799, fg3m: 190, fg3a: 484, normalFgm: 374, normalFga: 799,
    raw: curry2025,
  },
  {
    playerId: 201939, season: "2015-16", seasonType: "Regular Season",
    factsSha256: "3ca96608cdec2f646ab54e7871af8018ba557c4ee1255331b6379cb82a5709dc",
    fgm: 805, fga: 1598, fg3m: 402, fg3a: 886, normalFgm: 801, normalFga: 1584,
    raw: curry2015,
  },
] as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
deepFreeze(reviewed);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid aggregate archive");
}
function object(value: unknown): Record<string, unknown> {
  requireValue(isObject(value));
  return value;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  requireValue(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** No coercion, trimming, default season, or partial-player lookup. */
export function isSeasonHeatmapIdentity(value: unknown): value is HeatmapIdentity {
  if (!isObject(value) || Object.keys(value).length !== 3 ||
    !["playerId", "season", "seasonType"].every(key => Object.hasOwn(value, key)) ||
    !count(value.playerId) || value.playerId === 0 || typeof value.season !== "string" ||
    (value.seasonType !== "Regular Season" && value.seasonType !== "Playoffs")) return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value.season);
  return !!match && Number(match[1]) >= 1946 && Number(match[2]) === (Number(match[1]) + 1) % 100;
}
const sameIdentity = (left: HeatmapIdentity, right: HeatmapIdentity) =>
  left.playerId === right.playerId && left.season === right.season && left.seasonType === right.seasonType;
const identityKey = (identity: HeatmapIdentity) => `${identity.playerId}:${identity.season}:${identity.seasonType}`;
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function counts(value: Record<string, unknown>): HeatmapCounts {
  requireValue(count(value.fgm) && count(value.fga) && value.fgm <= value.fga);
  return { fgm: value.fgm, fga: value.fga };
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().replace(/\.000Z$/, "Z") === value.replace(/\.000Z$/, "Z");
}
function source(raw: unknown, identity: HeatmapIdentity, kind: "chart" | "overall" | "career"): NonNullable<SeasonHeatmapRendererDTO["source"]> {
  const value = object(raw);
  exactKeys(value, ["url", "capturedAtUtc", "observedAtWindowUtc"]);
  requireValue(typeof value.url === "string");
  const url = new URL(value.url);
  requireValue(url.origin === "https://www.nba.com" && !url.username && !url.password && !url.hash);
  for (const key of url.searchParams.keys()) requireValue(url.searchParams.getAll(key).length === 1);
  if (kind === "career") {
    requireValue(url.pathname === `/stats/player/${identity.playerId}/career` &&
      url.searchParams.get("PerMode") === "Totals" && [...url.searchParams.keys()].length === 1);
  } else {
    requireValue(url.searchParams.get("Season") === identity.season && url.searchParams.get("SeasonType") === identity.seasonType);
    const events = url.pathname === "/stats/events" && url.searchParams.get("PlayerID") === String(identity.playerId) && url.searchParams.get("ContextMeasure") === "FGA";
    requireValue(events || kind === "overall" && url.pathname === `/stats/player/${identity.playerId}/shooting`);
    const allowed = events ? ["CFID", "CFPARAMS", "ContextMeasure", "GameID", "PlayerID", "Season", "SeasonType", "TeamID", "flag", "sct", "section"] : ["Season", "SeasonType"];
    requireValue([...url.searchParams.keys()].every(key => allowed.includes(key)));
    for (const key of ["CFID", "CFPARAMS", "GameID"]) requireValue(!url.searchParams.get(key));
    requireValue(!url.searchParams.get("TeamID") || url.searchParams.get("TeamID") === "0");
  }
  requireValue(value.capturedAtUtc === null || timestamp(value.capturedAtUtc));
  let window: [string, string] | null = null;
  if (value.observedAtWindowUtc !== null) {
    const observed = value.observedAtWindowUtc;
    requireValue(Array.isArray(observed) && observed.length === 2 && timestamp(observed[0]) && timestamp(observed[1]) && Date.parse(observed[0]) <= Date.parse(observed[1]));
    window = [observed[0], observed[1]];
    requireValue(value.capturedAtUtc === null || Date.parse(value.capturedAtUtc) >= Date.parse(window[0]) && Date.parse(value.capturedAtUtc) <= Date.parse(window[1]));
  }
  return { url: value.url, capturedAtUtc: value.capturedAtUtc, observedAtWindowUtc: window };
}
function totals(raw: unknown, identity: HeatmapIdentity, kind: "overall" | "career") {
  const value = object(raw);
  exactKeys(value, ["fgm", "fga", "fg3m", "fg3a", "fgPctDisplay", "source"]);
  const shooting = counts(value);
  requireValue(value.fgPctDisplay === displayedPercentage(shooting.fgm, shooting.fga));
  requireValue(value.fg3m === null && value.fg3a === null || count(value.fg3m) && count(value.fg3a) &&
    value.fg3m <= value.fg3a && value.fg3m <= shooting.fgm && value.fg3a <= shooting.fga && shooting.fgm - value.fg3m <= shooting.fga - value.fg3a);
  source(value.source, identity, kind);
  return { ...shooting, fg3m: value.fg3m as number | null, fg3a: value.fg3a as number | null };
}
function percentage(value: unknown): value is string | null {
  return value === null || typeof value === "string" && /^(?:\d{1,2}|100)\.\d$/.test(value) && Number(value) <= 100;
}
function displayRow(raw: unknown, denominator: number, residual: boolean, orders: Set<number>): SeasonHeatmapDisplayRow {
  const value = object(raw);
  exactKeys(value, ["id", "sourceZoneId", "sourceOrder", "fgm", "fga", "fgPctDisplay", "distributionPctDisplay", "leagueAveragePctDisplay", ...(residual ? ["shotType"] : [])]);
  const shooting = counts(value);
  requireValue(shooting.fga <= denominator && count(value.sourceOrder) && !orders.has(value.sourceOrder));
  orders.add(value.sourceOrder);
  if (residual) {
    requireValue((value.id === "backcourt" || value.id === "unclassified") && value.shotType === "unknown" &&
      value.sourceZoneId === (value.id === "backcourt" ? "Back Court(BC) | Back Court Shot" : "null | null"));
  } else {
    requireValue(advanced14Geometry.some(zone => zone.id === value.id && zone.sourceZoneId === value.sourceZoneId));
  }
  requireValue(percentage(value.fgPctDisplay) && (shooting.fga === 0 ? value.fgPctDisplay === null || value.fgPctDisplay === "0.0" : value.fgPctDisplay === displayedPercentage(shooting.fgm, shooting.fga)));
  requireValue(value.distributionPctDisplay === displayedPercentage(shooting.fga, denominator));
  requireValue(percentage(value.leagueAveragePctDisplay));
  return {
    id: value.id as SeasonHeatmapDisplayRow["id"], sourceZoneId: value.sourceZoneId as string,
    fgm: shooting.fgm, fga: shooting.fga, fgPct: shooting.fga === 0 ? null : shooting.fgm / shooting.fga,
    fgPctDisplay: shooting.fga === 0 ? null : value.fgPctDisplay, sourceFgPctDisplay: value.fgPctDisplay,
    attemptShare: shooting.fga / denominator, attemptShareDisplay: value.distributionPctDisplay as string,
    status: shooting.fga === 0 ? "no-attempts" : "has-attempts",
    leagueAverage: value.leagueAveragePctDisplay === null ? null : { displayedPct: value.leagueAveragePctDisplay, provenance: "source-displayed-unverified-scope" },
  };
}
const sum = (rows: HeatmapCounts[]): HeatmapCounts => rows.reduce((total, row) => ({ fgm: total.fgm + row.fgm, fga: total.fga + row.fga }), { fgm: 0, fga: 0 });

/** Hash, identity, shape, counts, and context must all pass before explicit projection. */
export function validateSeasonHeatmapArchive(raw: unknown, identity: unknown): SeasonHeatmapRendererDTO | null {
  try {
    if (!isSeasonHeatmapIdentity(identity)) return null;
    const enabled = reviewed.find(entry => sameIdentity(entry, identity));
    if (!enabled || createHash("sha256").update(canonicalJson(raw)).digest("hex") !== enabled.factsSha256) return null;
    const value = object(raw);
    exactKeys(value, ["schemaVersion", "kind", "playerId", "season", "seasonType", "geometryVersion", "classificationVersion", "source", "zones", "residuals", "sourceOverall", "independentCareerTotals", "benchmark", "rawPoints"]);
    requireValue(value.schemaVersion === 1 && value.kind === "verified-player-season-advanced14-aggregate" &&
      value.playerId === identity.playerId && value.season === identity.season && value.seasonType === identity.seasonType &&
      value.geometryVersion === SEASON_HEATMAP_GEOMETRY_VERSION && value.classificationVersion === SEASON_HEATMAP_CLASSIFICATION_VERSION && value.rawPoints === "not-captured");
    const chartSource = source(value.source, identity, "chart");
    const overall = totals(value.sourceOverall, identity, "overall"), career = totals(value.independentCareerTotals, identity, "career");
    requireValue(overall.fgm === enabled.fgm && overall.fga === enabled.fga && career.fgm === enabled.fgm && career.fga === enabled.fga &&
      career.fg3m === enabled.fg3m && career.fg3a === enabled.fg3a &&
      (overall.fg3m === null || overall.fg3m === career.fg3m && overall.fg3a === career.fg3a));
    const benchmark = object(value.benchmark);
    exactKeys(benchmark, ["kind", "sourceLabel", "chartSeason", "chartSeasonType", "independentlyVerifiedScope", "leagueFgm", "leagueFga", "methodology", "recomputed"]);
    requireValue(benchmark.kind === "nba-chart-displayed-la" && benchmark.sourceLabel === "LA - League Average" &&
      benchmark.chartSeason === identity.season && benchmark.chartSeasonType === identity.seasonType &&
      benchmark.independentlyVerifiedScope === null && benchmark.leagueFgm === null && benchmark.leagueFga === null && benchmark.methodology === null && benchmark.recomputed === false);
    requireValue(Array.isArray(value.zones) && value.zones.length === 14 && Array.isArray(value.residuals) && value.residuals.length <= 2);
    const orders = new Set<number>();
    const unordered = value.zones.map(row => displayRow(row, overall.fga, false, orders));
    const residuals = value.residuals.map(row => displayRow(row, overall.fga, true, orders));
    requireValue(new Set([...unordered, ...residuals].map(row => row.id)).size === unordered.length + residuals.length);
    const zones = advanced14Geometry.map(geometry => {
      const row = unordered.find(row => row.id === geometry.id);
      requireValue(row);
      return row;
    });
    const normal = sum(zones), remainder = sum(residuals), combined = sum([normal, remainder]);
    requireValue(normal.fgm === enabled.normalFgm && normal.fga === enabled.normalFga && combined.fgm === overall.fgm && combined.fga === overall.fga);
    const normalThree = sum(zones.filter(row => row.sourceZoneId.endsWith(" | 24+ ft.")));
    const remainingThree = { fgm: enabled.fg3m - normalThree.fgm, fga: enabled.fg3a - normalThree.fga };
    requireValue(count(remainingThree.fgm) && count(remainingThree.fga) && remainingThree.fgm <= remainingThree.fga &&
      remainingThree.fgm <= remainder.fgm && remainingThree.fga <= remainder.fga && remainder.fgm - remainingThree.fgm <= remainder.fga - remainingThree.fga);
    return deepFreeze<SeasonHeatmapRendererDTO>({
      playerId: identity.playerId, season: identity.season, seasonType: identity.seasonType,
      geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION, status: "verified-aggregate", source: chartSource,
      zones, residuals, totals: { fgm: combined.fgm, fga: combined.fga },
      coverage: { aggregate: "full-season-reconciled", rawPoints: "not-captured", normalZoneAttempts: normal.fga, residualAttempts: remainder.fga, seasonAttemptDenominator: overall.fga },
      benchmark: { kind: "source-displayed-unverified-scope", independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null },
    });
  } catch { return null; }
}

const cache = new Map<string, SeasonHeatmapArchiveResource>();
const unavailable: SeasonHeatmapArchiveResource = Object.freeze({ status: "unavailable" });

/** Immutable in-process cache. Unsupported identities never fall back to another archive. */
export function loadSeasonHeatmapArchive(identity: unknown): SeasonHeatmapArchiveResource {
  if (!isSeasonHeatmapIdentity(identity)) return unavailable;
  const enabled = reviewed.find(entry => sameIdentity(entry, identity));
  if (!enabled) return unavailable;
  const key = identityKey(identity), cached = cache.get(key);
  if (cached) return cached;
  const data = validateSeasonHeatmapArchive(enabled.raw, identity);
  const resource: SeasonHeatmapArchiveResource = deepFreeze(data ? { status: "ready", data } : { status: "error" });
  cache.set(key, resource);
  return resource;
}

/** Registration metadata stays visible even if loading fails, so consumers can show an error. */
export function getSeasonHeatmapCatalog(playerId: number): readonly SeasonHeatmapCatalogEntry[] {
  if (!count(playerId) || playerId === 0) return Object.freeze([]);
  return deepFreeze(reviewed.filter(entry => entry.playerId === playerId).map(entry => ({
    playerId: entry.playerId, season: entry.season, seasonType: entry.seasonType, availability: "available" as const,
  })));
}
