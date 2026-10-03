// Node-only validation/import boundary: no runtime archive registration or route imports.
import "server-only";
import { createHash } from "node:crypto";
import {
  advanced14Geometry, SEASON_HEATMAP_CLASSIFICATION_VERSION, SEASON_HEATMAP_GEOMETRY_VERSION,
} from "./season-heatmap-geometry";
import type {
  HeatmapCounts, HeatmapIdentity, HeatmapReconciliation, HeatmapSourceReference,
  HeatmapSourceTotals, HeatmapCandidateRow, SeasonHeatmapCandidate, SeasonHeatmapRendererDTO,
  SeasonHeatmapDisplayRow,
} from "./season-heatmap";

class CandidateError extends Error {}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CandidateError(message);
}
function object(value: unknown, label: string): Record<string, unknown> {
  requireValue(typeof value === "object" && value !== null && !Array.isArray(value), `${label}: expected object`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[], label: string) {
  requireValue(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), `${label}: unexpected or missing fields`);
}
function count(value: unknown, label: string): number {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, `${label}: expected nonnegative safe integer`);
  return value;
}
function counts(value: Record<string, unknown>, label: string): HeatmapCounts {
  const fgm = count(value.fgm, `${label}.fgm`), fga = count(value.fga, `${label}.fga`);
  requireValue(fgm <= fga, `${label}: makes exceed attempts`);
  return { fgm, fga };
}
function identity(value: Record<string, unknown>, expected?: HeatmapIdentity): HeatmapIdentity {
  const playerId = count(value.playerId, "playerId");
  requireValue(playerId > 0 && typeof value.season === "string", "identity: invalid player or season");
  const match = /^(\d{4})-(\d{2})$/.exec(value.season);
  requireValue(match && Number(match[2]) === (Number(match[1]) + 1) % 100 && Number(match[1]) >= 1946, "identity: invalid season");
  requireValue(value.seasonType === "Regular Season" || value.seasonType === "Playoffs", "identity: invalid season type");
  const result: HeatmapIdentity = { playerId, season: value.season, seasonType: value.seasonType };
  requireValue(!expected || result.playerId === expected.playerId && result.season === expected.season && result.seasonType === expected.seasonType, "identity: wrong player, season or season type");
  return result;
}
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().replace(/\.000Z$/, "Z") === value.replace(/\.(\d{1,3})Z$/, (_, digits: string) => `.${digits.padEnd(3, "0")}Z`).replace(/\.000Z$/, "Z");
}
function sourceReference(raw: unknown, expected: HeatmapIdentity, kind: "chart" | "overall" | "career"): HeatmapSourceReference {
  const source = object(raw, "source");
  exactKeys(source, ["url", "capturedAtUtc", "observedAtWindowUtc", "evidencePath", "evidenceSha256"], "source");
  requireValue(typeof source.url === "string", "source URL missing");
  let url: URL;
  try { url = new URL(source.url); } catch { throw new CandidateError("source URL malformed"); }
  requireValue(url.protocol === "https:" && url.hostname === "www.nba.com" && !url.username && !url.password && !url.port && !url.hash, "source URL must be official HTTPS NBA");
  for (const key of url.searchParams.keys())
    requireValue(url.searchParams.getAll(key).length === 1, `source URL duplicate ${key}`);
  const allowedParams = kind === "career" ? ["PerMode"] : url.pathname === "/stats/events"
    ? ["CFID", "CFPARAMS", "ContextMeasure", "GameID", "PlayerID", "Season", "SeasonType", "TeamID", "flag", "sct", "section"]
    : ["Season", "SeasonType"];
  requireValue([...url.searchParams.keys()].every(key => allowedParams.includes(key)), "source URL has unverified filters");
  for (const key of ["CFID", "CFPARAMS", "GameID"]) requireValue(!url.searchParams.get(key), "source URL is filtered below whole season");
  requireValue(!url.searchParams.get("TeamID") || url.searchParams.get("TeamID") === "0", "source URL team filter is not full player season");
  if (kind === "career") {
    requireValue(url.pathname === `/stats/player/${expected.playerId}/career` && url.searchParams.get("PerMode") === "Totals", "career source identity or mode mismatch");
  } else {
    requireValue(url.searchParams.get("Season") === expected.season && url.searchParams.get("SeasonType") === expected.seasonType, "source URL season/type mismatch");
    const events = url.pathname === "/stats/events" && url.searchParams.get("PlayerID") === String(expected.playerId) && url.searchParams.get("ContextMeasure") === "FGA";
    requireValue(events || kind === "overall" && url.pathname === `/stats/player/${expected.playerId}/shooting`, "source URL player/context mismatch");
  }
  requireValue(source.capturedAtUtc === null || timestamp(source.capturedAtUtc), "source exact capture time invalid");
  let observed: [string, string] | null = null;
  if (source.observedAtWindowUtc !== null) {
    const window = source.observedAtWindowUtc;
    requireValue(Array.isArray(window) && window.length === 2 && timestamp(window[0]) && timestamp(window[1]) && Date.parse(window[0]) <= Date.parse(window[1]), "source observation window invalid");
    observed = [window[0], window[1]];
    if (source.capturedAtUtc !== null) requireValue(Date.parse(source.capturedAtUtc) >= Date.parse(observed[0]) && Date.parse(source.capturedAtUtc) <= Date.parse(observed[1]), "capture time outside observation window");
  }
  requireValue(typeof source.evidencePath === "string" && source.evidencePath.length <= 240 && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(json|txt)$/.test(source.evidencePath), "source evidence path unsafe");
  requireValue(sha256(source.evidenceSha256), "source evidence SHA-256 invalid");
  return { url: source.url, capturedAtUtc: source.capturedAtUtc, observedAtWindowUtc: observed, evidencePath: source.evidencePath, evidenceSha256: source.evidenceSha256 };
}
/** Integer arithmetic gives the source's one-decimal half-up semantics, including 9/16. */
export function displayedPercentage(numerator: number, denominator: number): string | null {
  count(numerator, "percentage numerator"); count(denominator, "percentage denominator");
  requireValue(numerator <= denominator, "percentage numerator exceeds denominator");
  if (denominator === 0) return null;
  const tenths = (BigInt(numerator) * BigInt(2000) + BigInt(denominator)) / (BigInt(denominator) * BigInt(2));
  return `${tenths / BigInt(10)}.${tenths % BigInt(10)}`;
}
function percentage(value: unknown, label: string): string | null {
  requireValue(value === null || typeof value === "string" && /^(?:\d{1,2}|100)\.\d$/.test(value) && Number(value) <= 100, `${label}: invalid one-decimal percentage`);
  return value;
}
function measuredPercentage(value: unknown, fgm: number, fga: number, label: string): string | null {
  const result = percentage(value, label);
  requireValue(fga === 0 ? result === null || result === "0.0" : result === displayedPercentage(fgm, fga), `${label}: disagrees with counts`);
  return result;
}
function row(raw: unknown, totalAttempts: number, label: string): HeatmapCandidateRow {
  const value = object(raw, label), shooting = counts(value, label);
  requireValue(typeof value.sourceZoneId === "string", `${label}: missing source ID`);
  const sourceOrder = count(value.sourceOrder, `${label}.sourceOrder`);
  const fgPctDisplay = measuredPercentage(value.fgPctDisplay, shooting.fgm, shooting.fga, `${label}.fgPctDisplay`);
  const distributionPctDisplay = measuredPercentage(value.distributionPctDisplay, shooting.fga, totalAttempts, `${label}.distributionPctDisplay`);
  const leagueAveragePctDisplay = percentage(value.leagueAveragePctDisplay, `${label}.LA`);
  for (const key of ["sourceTraditionalScaleValue", "sourceExtendedScaleValue"]) requireValue(value[key] === null || Number.isInteger(value[key]) && (value[key] as number) >= 1 && (value[key] as number) <= 5, `${label}: invalid source scale`);
  return { ...shooting, sourceZoneId: value.sourceZoneId, sourceOrder, fgPctDisplay, distributionPctDisplay, leagueAveragePctDisplay, sourceTraditionalScaleValue: value.sourceTraditionalScaleValue as number | null, sourceExtendedScaleValue: value.sourceExtendedScaleValue as number | null };
}
function totals(raw: unknown, expected: HeatmapIdentity, kind: "overall" | "career"): HeatmapSourceTotals {
  const value = object(raw, `${kind} totals`);
  exactKeys(value, ["playerId", "season", "seasonType", "fgm", "fga", "fg3m", "fg3a", "fgPctDisplay", "source"], `${kind} totals`);
  const id = identity(value, expected), shooting = counts(value, `${kind} totals`);
  const fgPctDisplay = measuredPercentage(value.fgPctDisplay, shooting.fgm, shooting.fga, `${kind} FG%`);
  let fg3m: number | null = null, fg3a: number | null = null;
  if (value.fg3m !== null || value.fg3a !== null) {
    fg3m = count(value.fg3m, "3PM"); fg3a = count(value.fg3a, "3PA");
    requireValue(fg3m <= fg3a && fg3m <= shooting.fgm && fg3a <= shooting.fga && shooting.fgm - fg3m <= shooting.fga - fg3a, "invalid three-point totals");
  }
  return { ...id, ...shooting, fg3m, fg3a, fgPctDisplay, source: sourceReference(value.source, expected, kind) };
}
const rowKeys = ["sourceZoneId", "sourceOrder", "fgm", "fga", "fgPctDisplay", "distributionPctDisplay", "leagueAveragePctDisplay", "sourceTraditionalScaleValue", "sourceExtendedScaleValue"];
function sum(rows: HeatmapCounts[]): HeatmapCounts {
  return rows.reduce((total, value) => ({ fgm: count(total.fgm + value.fgm, "sum FGM"), fga: count(total.fga + value.fga, "sum FGA") }), { fgm: 0, fga: 0 });
}
export type CandidateValidation = { ok: true; value: SeasonHeatmapCandidate; reconciliation: HeatmapReconciliation } | { ok: false; error: string };
/** All inputs are untrusted; expected identity is required so callers cannot reuse a stale season. */
export function validateSeasonHeatmapCandidate(raw: unknown, expected: HeatmapIdentity): CandidateValidation {
  try {
    const value = object(raw, "candidate");
    identity(object(expected, "expected identity"));
    exactKeys(value, ["schemaVersion", "kind", "publicationStatus", "playerId", "season", "seasonType", "geometryVersion", "classification", "source", "benchmark", "zones", "residuals", "sourceOverall", "independentCareerTotals", "rawPointCoverage", "review"], "candidate");
    const id = identity(value, expected);
    requireValue(value.schemaVersion === 1 && value.kind === "player-season-advanced14-aggregate-candidate" && value.publicationStatus === "private-unenabled", "candidate schema/kind/publication mismatch");
    requireValue(value.geometryVersion === SEASON_HEATMAP_GEOMETRY_VERSION, "incompatible geometry version");
    const classification = object(value.classification, "classification");
    exactKeys(classification, ["playerId", "season", "seasonType", "version", "geometryVersion", "basis"], "classification");
    identity(classification, id);
    requireValue(classification.version === SEASON_HEATMAP_CLASSIFICATION_VERSION && classification.geometryVersion === value.geometryVersion && classification.basis === "source-displayed-scales", "stale or incompatible classification");
    const source = sourceReference(value.source, id, "chart");
    const sourceOverall = totals(value.sourceOverall, id, "overall");
    const independentCareerTotals = value.independentCareerTotals === null ? null : totals(value.independentCareerTotals, id, "career");
    if (independentCareerTotals) requireValue(independentCareerTotals.source.evidenceSha256 !== source.evidenceSha256, "career comparison must use independent evidence");
    let benchmark: SeasonHeatmapCandidate["benchmark"] = null;
    if (value.benchmark !== null) {
      const b = object(value.benchmark, "benchmark");
      exactKeys(b, ["kind", "sourceLabel", "chartIdentity", "sourceUrl", "independentlyVerifiedScope", "leagueFgm", "leagueFga", "methodology", "recomputed", "displayDecimalPlaces"], "benchmark");
      identity(object(b.chartIdentity, "benchmark identity"), id);
      requireValue(b.kind === "nba-chart-displayed-la" && b.sourceLabel === "LA - League Average" && b.sourceUrl === source.url && b.independentlyVerifiedScope === null && b.leagueFgm === null && b.leagueFga === null && b.methodology === null && b.recomputed === false && b.displayDecimalPlaces === 1, "unsupported or mis-scoped benchmark claim");
      benchmark = { kind: "nba-chart-displayed-la", sourceLabel: "LA - League Average", chartIdentity: { ...id }, sourceUrl: source.url, independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null, methodology: null, recomputed: false, displayDecimalPlaces: 1 };
    }
    requireValue(Array.isArray(value.zones) && value.zones.length === 14, "exactly 14 source zones required; do not expand coarse zones");
    const seen = new Set<string>(), orders = new Set<number>();
    const zones: SeasonHeatmapCandidate["zones"] = value.zones.map((rawZone, index) => {
      const zone = object(rawZone, `zone ${index}`);
      exactKeys(zone, [...rowKeys, "id", "pathD", "labelGroupTranslate"], `zone ${index}`);
      const geometry = advanced14Geometry.find(item => item.id === zone.id);
      requireValue(geometry && zone.sourceZoneId === geometry.sourceZoneId && !seen.has(geometry.id), "unknown, mismatched or duplicate zone ID");
      requireValue(zone.pathD === geometry.pathD && Array.isArray(zone.labelGroupTranslate) && zone.labelGroupTranslate.length === 2 && zone.labelGroupTranslate.every((v, i) => v === geometry.labelGroupTranslate[i]), "unsafe or incompatible zone geometry");
      seen.add(geometry.id);
      const parsed = row(zone, sourceOverall.fga, `zone ${geometry.id}`);
      requireValue(!orders.has(parsed.sourceOrder), "duplicate source order"); orders.add(parsed.sourceOrder);
      return { ...parsed, id: geometry.id, pathD: geometry.pathD, labelGroupTranslate: [...geometry.labelGroupTranslate] };
    });
    requireValue(Array.isArray(value.residuals) && value.residuals.length <= 2, "invalid residual categories");
    const residuals: SeasonHeatmapCandidate["residuals"] = value.residuals.map((rawResidual, index) => {
      const residual = object(rawResidual, `residual ${index}`);
      exactKeys(residual, [...rowKeys, "id", "shotType"], `residual ${index}`);
      requireValue(residual.id === "backcourt" || residual.id === "unclassified", "unknown residual ID");
      requireValue(residual.sourceZoneId === (residual.id === "backcourt" ? "Back Court(BC) | Back Court Shot" : "null | null") && !seen.has(residual.id), "mismatched or duplicate residual ID");
      requireValue(residual.shotType === "unknown", "residual shot types not directly verified");
      seen.add(residual.id);
      const parsed = row(residual, sourceOverall.fga, `residual ${residual.id}`);
      requireValue(!orders.has(parsed.sourceOrder), "duplicate source order"); orders.add(parsed.sourceOrder);
      return { ...parsed, id: residual.id, shotType: "unknown" };
    });
    requireValue([...zones, ...residuals].every(r => benchmark !== null || r.leagueAveragePctDisplay === null && r.sourceTraditionalScaleValue === null && r.sourceExtendedScaleValue === null), "benchmark values/scales without provenance");
    const normalZones = sum(zones), residualTotal = sum(residuals), combined = sum([normalZones, residualTotal]);
    requireValue(combined.fgm === sourceOverall.fgm && combined.fga === sourceOverall.fga, "zone plus residual counts disagree with source overall");
    if (independentCareerTotals) requireValue(independentCareerTotals.fgm === combined.fgm && independentCareerTotals.fga === combined.fga && (sourceOverall.fg3m === null || independentCareerTotals.fg3m === null || sourceOverall.fg3m === independentCareerTotals.fg3m && sourceOverall.fg3a === independentCareerTotals.fg3a), "independent career totals disagree");
    const normal24Plus = sum(zones.filter(z => z.sourceZoneId.endsWith(" | 24+ ft.")));
    const threeTotals = independentCareerTotals?.fg3m !== null && independentCareerTotals?.fg3m !== undefined ? independentCareerTotals : sourceOverall;
    let threePointRemainder: HeatmapCounts | null = null;
    if (threeTotals.fg3m !== null && threeTotals.fg3a !== null) {
      requireValue(normal24Plus.fgm <= threeTotals.fg3m && normal24Plus.fga <= threeTotals.fg3a, "24+ zones exceed official three-point totals");
      threePointRemainder = { fgm: threeTotals.fg3m - normal24Plus.fgm, fga: threeTotals.fg3a - normal24Plus.fga };
      requireValue(threePointRemainder.fgm <= threePointRemainder.fga && threePointRemainder.fgm <= residualTotal.fgm && threePointRemainder.fga <= residualTotal.fga && residualTotal.fgm - threePointRemainder.fgm <= residualTotal.fga - threePointRemainder.fga, "three-point remainder cannot reconcile with residual counts");
    }
    const coverage = object(value.rawPointCoverage, "raw point coverage");
    exactKeys(coverage, ["status", "durableCount", "sourceObservedCount"], "raw point coverage");
    requireValue(coverage.status === "not-captured" && coverage.durableCount === 0, "aggregate source cannot claim durable raw-point coverage");
    const sourceObservedCount = coverage.sourceObservedCount === null ? null : count(coverage.sourceObservedCount, "observed point count");
    requireValue(sourceObservedCount === null || sourceObservedCount === sourceOverall.fga, "observed source point count disagrees with overall");
    const review = object(value.review, "review");
    exactKeys(review, ["status", "evidenceSha256", "reportSha256"], "review");
    requireValue((review.status === "pending" || review.status === "passed") && review.evidenceSha256 === source.evidenceSha256 && (review.status === "passed" ? sha256(review.reportSha256) : review.reportSha256 === null), "invalid or stale source review");
    const candidate: SeasonHeatmapCandidate = { schemaVersion: 1, kind: "player-season-advanced14-aggregate-candidate", publicationStatus: "private-unenabled", ...id, geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION, classification: { ...id, version: SEASON_HEATMAP_CLASSIFICATION_VERSION, geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION, basis: "source-displayed-scales" }, source, benchmark, zones, residuals, sourceOverall, independentCareerTotals, rawPointCoverage: { status: "not-captured", durableCount: 0, sourceObservedCount }, review: { status: review.status, evidenceSha256: source.evidenceSha256, reportSha256: review.reportSha256 as string | null } };
    return { ok: true, value: candidate, reconciliation: { normalZones, residuals: residualTotal, combined, normal24Plus, threePointRemainder, residualShotTypesVerified: false, sourceOverallMatches: true, independentCareerTotalsMatches: independentCareerTotals ? true : null, aggregateCoverage: independentCareerTotals ? "full-season-reconciled" : "source-overall-only" } };
  } catch (error) {
    return { ok: false, error: error instanceof CandidateError ? error.message : "Malformed season heatmap candidate" };
  }
}
/** Validation precedes every projection; no private provenance is spread into the DTO. */
export function toSeasonHeatmapRendererDTO(raw: unknown, expected: HeatmapIdentity): SeasonHeatmapRendererDTO | null {
  const result = validateSeasonHeatmapCandidate(raw, expected);
  if (!result.ok) return null;
  const { value, reconciliation } = result;
  const displayRow = (r: SeasonHeatmapCandidate["zones"][number] | SeasonHeatmapCandidate["residuals"][number]): SeasonHeatmapDisplayRow => ({
    id: r.id, sourceZoneId: r.sourceZoneId, fgm: r.fgm, fga: r.fga,
    fgPct: r.fga === 0 ? null : r.fgm / r.fga,
    fgPctDisplay: r.fga === 0 ? null : r.fgPctDisplay, sourceFgPctDisplay: r.fgPctDisplay,
    attemptShare: value.sourceOverall.fga === 0 ? 0 : r.fga / value.sourceOverall.fga,
    attemptShareDisplay: r.distributionPctDisplay, status: r.fga === 0 ? "no-attempts" : "has-attempts",
    leagueAverage: r.leagueAveragePctDisplay === null ? null : { displayedPct: r.leagueAveragePctDisplay, provenance: "source-displayed-unverified-scope" },
  });
  return {
    playerId: value.playerId, season: value.season, seasonType: value.seasonType,
    geometryVersion: value.geometryVersion, status: "private-preview-only",
    zones: advanced14Geometry.map(g => displayRow(value.zones.find(z => z.id === g.id)!)),
    residuals: value.residuals.map(displayRow), totals: { ...reconciliation.combined },
    coverage: { aggregate: reconciliation.aggregateCoverage, rawPoints: "not-captured", normalZoneAttempts: reconciliation.normalZones.fga, residualAttempts: reconciliation.residuals.fga, seasonAttemptDenominator: value.sourceOverall.fga },
    benchmark: value.benchmark === null ? null : { kind: "source-displayed-unverified-scope", independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null },
  };
}
export function evidenceSha256(bytes: string | Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
