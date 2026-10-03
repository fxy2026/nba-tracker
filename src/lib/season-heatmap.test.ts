import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { advanced14Geometry, SEASON_HEATMAP_GEOMETRY_VERSION, SEASON_HEATMAP_CLASSIFICATION_VERSION } from "./season-heatmap-geometry";
import { displayedPercentage, evidenceSha256, toSeasonHeatmapRendererDTO, validateSeasonHeatmapCandidate } from "./season-heatmap-server";
import { importVisibleAdvanced14Evidence } from "./season-heatmap-import-server";
import type { HeatmapIdentity, HeatmapSourceReference, SeasonHeatmapCandidate } from "./season-heatmap";

// Deliberately invented test-only player and counts. This fixture is never runtime data.
const id: HeatmapIdentity = { playerId: 999999, season: "2001-02", seasonType: "Regular Season" };
function source(kind: "chart" | "career" = "chart"): HeatmapSourceReference {
  return {
    url: kind === "chart" ? `https://www.nba.com/stats/events?PlayerID=${id.playerId}&Season=${id.season}&SeasonType=Regular%20Season&ContextMeasure=FGA` : `https://www.nba.com/stats/player/${id.playerId}/career?PerMode=Totals`,
    capturedAtUtc: null, observedAtWindowUtc: ["2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z"],
    evidencePath: `test-only/${kind}.json`, evidenceSha256: (kind === "chart" ? "a" : "b").repeat(64),
  };
}
function fixture(): SeasonHeatmapCandidate {
  return {
    schemaVersion: 1, kind: "player-season-advanced14-aggregate-candidate", publicationStatus: "private-unenabled", ...id,
    geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION,
    classification: { ...id, version: SEASON_HEATMAP_CLASSIFICATION_VERSION, geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION, basis: "source-displayed-scales" },
    source: source(), benchmark: { kind: "nba-chart-displayed-la", sourceLabel: "LA - League Average", chartIdentity: { ...id }, sourceUrl: source().url, independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null, methodology: null, recomputed: false, displayDecimalPlaces: 1 },
    zones: advanced14Geometry.map(g => ({ ...g, labelGroupTranslate: [...g.labelGroupTranslate], sourceOrder: advanced14Geometry.indexOf(g), fgm: 1, fga: 2, fgPctDisplay: "50.0", distributionPctDisplay: "7.1", leagueAveragePctDisplay: "40.0", sourceTraditionalScaleValue: 5, sourceExtendedScaleValue: 5 })),
    residuals: [], sourceOverall: { ...id, fgm: 14, fga: 28, fg3m: 5, fg3a: 10, fgPctDisplay: "50.0", source: source() },
    independentCareerTotals: { ...id, fgm: 14, fga: 28, fg3m: 5, fg3a: 10, fgPctDisplay: "50.0", source: source("career") },
    rawPointCoverage: { status: "not-captured", durableCount: 0, sourceObservedCount: 28 },
    review: { status: "pending", evidenceSha256: "a".repeat(64), reportSha256: null },
  };
}
function valid(candidate: SeasonHeatmapCandidate = fixture()) {
  const result = validateSeasonHeatmapCandidate(candidate, id);
  expect(result, result.ok ? "" : result.error).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(result.error);
  return result;
}
function resetTotals(candidate: SeasonHeatmapCandidate) {
  const rows = [...candidate.zones, ...candidate.residuals];
  const fgm = rows.reduce((s, r) => s + r.fgm, 0), fga = rows.reduce((s, r) => s + r.fga, 0);
  const threes = candidate.zones.filter(z => z.sourceZoneId.endsWith(" | 24+ ft."));
  for (const total of [candidate.sourceOverall, candidate.independentCareerTotals]) if (total) Object.assign(total, { fgm, fga, fgPctDisplay: displayedPercentage(fgm, fga), fg3m: threes.reduce((s, r) => s + r.fgm, 0), fg3a: threes.reduce((s, r) => s + r.fga, 0) });
  for (const row of rows) { row.fgPctDisplay = displayedPercentage(row.fgm, row.fga); row.distributionPctDisplay = displayedPercentage(row.fga, fga); }
  candidate.rawPointCoverage.sourceObservedCount = fga;
}
describe("private advanced-14 player-season aggregate", () => {
  it("reconciles separate source and career totals without claiming raw-point coverage", () => {
    expect(valid().reconciliation).toMatchObject({ normalZones: { fgm: 14, fga: 28 }, sourceOverallMatches: true, independentCareerTotalsMatches: true, aggregateCoverage: "full-season-reconciled", residualShotTypesVerified: false });
    expect(toSeasonHeatmapRendererDTO(fixture(), id)?.coverage).toMatchObject({ rawPoints: "not-captured", seasonAttemptDenominator: 28 });
  });
  it("keeps missing independent career evidence explicitly unknown", () => {
    const f = fixture(); f.independentCareerTotals = null;
    expect(valid(f).reconciliation).toMatchObject({ independentCareerTotalsMatches: null, aggregateCoverage: "source-overall-only" });
  });
  it("is stable when source order changes", () => {
    const f = fixture(); f.zones.reverse(); f.zones.forEach((z, i) => z.sourceOrder = i);
    expect(toSeasonHeatmapRendererDTO(f, id)).toEqual(toSeasonHeatmapRendererDTO(fixture(), id));
  });
  it("preserves exact source percentage strings; uses half-up display, never banker's rounding", () => {
    expect(displayedPercentage(9, 16)).toBe("56.3");
    expect(displayedPercentage(1, 8)).toBe("12.5");
    expect(displayedPercentage(0, 0)).toBeNull();
    expect(displayedPercentage(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe("100.0");
  });
  it("shows no attempts as null FG and zero volume, preserving a source 0.0 label separately", () => {
    const f = fixture(); f.zones[0].fgm = 0; f.zones[0].fga = 0; resetTotals(f); f.zones[0].fgPctDisplay = "0.0";
    valid(f);
    expect(toSeasonHeatmapRendererDTO(f, id)?.zones[0]).toMatchObject({ fgPct: null, fgPctDisplay: null, sourceFgPctDisplay: "0.0", attemptShare: 0, status: "no-attempts" });
  });
  it("supports a complete zero-attempt capture with no NaN ratios", () => {
    const f = fixture(); f.zones.forEach(z => { z.fgm = 0; z.fga = 0; }); resetTotals(f); valid(f);
    expect(toSeasonHeatmapRendererDTO(f, id)?.zones.every(z => z.fgPct === null && z.attemptShare === 0)).toBe(true);
  });
  it("preserves non-spatial residuals and uses the full denominator", () => {
    const f = fixture(); f.residuals.push({ ...f.zones[0], id: "unclassified", sourceZoneId: "null | null", sourceOrder: 14, shotType: "unknown" });
    // The test explicitly removes zone-only geometry from its synthesized residual.
    delete (f.residuals[0] as unknown as Record<string, unknown>).pathD;
    delete (f.residuals[0] as unknown as Record<string, unknown>).labelGroupTranslate;
    resetTotals(f); const result = valid(f), dto = toSeasonHeatmapRendererDTO(f, id)!;
    expect(result.reconciliation.residuals).toEqual({ fgm: 1, fga: 2 });
    expect(dto.zones[0].attemptShare).toBe(2 / 30);
    expect(dto.residuals[0]).not.toHaveProperty("pathD");
    expect(dto.coverage).toMatchObject({ normalZoneAttempts: 28, residualAttempts: 2, seasonAttemptDenominator: 30 });
  });
  it("rejects a three-point remainder leaving impossible two-point residual counts", () => {
    const f = fixture(); f.residuals.push({ id: "unclassified", sourceZoneId: "null | null", sourceOrder: 14, shotType: "unknown", fgm: 1, fga: 2, fgPctDisplay: "50.0", distributionPctDisplay: "6.7", leagueAveragePctDisplay: null, sourceTraditionalScaleValue: null, sourceExtendedScaleValue: null });
    resetTotals(f); f.sourceOverall.fg3a = 12; f.independentCareerTotals!.fg3a = 12;
    expect(validateSeasonHeatmapCandidate(f, id)).toEqual({ ok: false, error: "three-point remainder cannot reconcile with residual counts" });
  });
  it("permits missing displayed league values only without making up a baseline", () => {
    const f = fixture(); f.benchmark = null; f.zones.forEach(z => { z.leagueAveragePctDisplay = null; z.sourceTraditionalScaleValue = null; z.sourceExtendedScaleValue = null; }); valid(f);
    expect(toSeasonHeatmapRendererDTO(f, id)?.benchmark).toBeNull();
  });
  it("returns a fresh explicit DTO without evidence, source paths, raw points or invented league deltas", () => {
    const f = fixture(), dto = toSeasonHeatmapRendererDTO(f, id)!;
    const text = JSON.stringify(dto);
    for (const secret of ["evidencePath", "evidenceSha256", "observedAtWindowUtc", "sourceTraditionalScaleValue", "sourceExtendedScaleValue", "rawPointCoverage", "reportSha256", "delta", "pathD"]) expect(text).not.toContain(secret);
    expect(dto.benchmark).toEqual({ kind: "source-displayed-unverified-scope", independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null });
    dto.zones[0].fga = 900; expect(f.zones[0].fga).toBe(2);
  });
  const mutations: [string, (f: SeasonHeatmapCandidate) => void][] = [
    ["duplicate IDs", f => { f.zones[1] = { ...f.zones[0] }; }],
    ["coarse seven zones", f => { f.zones = f.zones.slice(0, 7); }],
    ["negative count", f => { f.zones[0].fga = -1; }],
    ["NaN", f => { f.zones[0].fgm = NaN; }],
    ["Infinity", f => { f.zones[0].fga = Infinity; }],
    ["fractional count", f => { f.zones[0].fga = 2.2; }],
    ["unsafe integer", f => { f.zones[0].fga = Number.MAX_SAFE_INTEGER + 1; }],
    ["makes exceed attempts", f => { f.zones[0].fgm = 3; }],
    ["wrong percent", f => { f.zones[0].fgPctDisplay = "49.9"; }],
    ["wrong volume", f => { f.zones[0].distributionPctDisplay = "7.2"; }],
    ["missing percentage", f => { f.zones[0].fgPctDisplay = null; }],
    ["wrong source order", f => { f.zones[1].sourceOrder = 0; }],
    ["source sum disagreement", f => { f.sourceOverall.fgm = 13; f.sourceOverall.fgPctDisplay = "46.4"; }],
    ["career disagreement", f => { f.independentCareerTotals!.fgm = 13; f.independentCareerTotals!.fgPctDisplay = "46.4"; }],
    ["same-source career copy", f => { f.independentCareerTotals!.source.evidenceSha256 = f.source.evidenceSha256; }],
    ["wrong season", f => { f.season = "2002-03"; }],
    ["invalid season", f => { f.season = "2001-05"; }],
    ["wrong player", f => { f.playerId = 42; }],
    ["wrong type", f => { f.seasonType = "Playoffs"; }],
    ["wrong career identity", f => { f.independentCareerTotals!.playerId = 42; }],
    ["stale classification identity", f => { f.classification.season = "2002-03"; }],
    ["stale geometry", f => { Object.assign(f, { geometryVersion: "legacy-seven" }); }],
    ["stale classification version", f => { Object.assign(f.classification, { version: "old" }); }],
    ["incompatible classifier geometry", f => { Object.assign(f.classification, { geometryVersion: "other" }); }],
    ["path injection", f => { f.zones[0].pathD = 'M0,0\" onload=\"alert(1)'; }],
    ["path remapping", f => { f.zones[0].pathD = f.zones[1].pathD; }],
    ["unsafe coordinate", f => { f.zones[0].labelGroupTranslate[0] = NaN; }],
    ["path traversal", f => { f.source.evidencePath = "../secret.json"; }],
    ["absolute path", f => { f.source.evidencePath = "/private/file.json"; }],
    ["windows path", f => { f.source.evidencePath = "a\\file.json"; }],
    ["URL mismatch", f => { f.source.url = f.source.url.replace("2001-02", "2002-03"); }],
    ["URL duplicate scope", f => { f.source.url += "&Season=2001-02"; }],
    ["filtered game URL", f => { f.source.url += "&GameID=0020000010"; }],
    ["filtered team URL", f => { f.source.url += "&TeamID=1610612744"; }],
    ["unverified URL filter", f => { f.source.url += "&DateFrom=01-01-2002"; }],
    ["nonofficial URL", f => { f.source.url = f.source.url.replace("www.nba.com", "evil.test"); }],
    ["invalid timestamp", f => { f.source.capturedAtUtc = "2026-02-31T00:00:00Z"; }],
    ["reversed observation window", f => { f.source.observedAtWindowUtc!.reverse(); }],
    ["invented exact timestamp", f => { f.source.capturedAtUtc = "2026-01-02T00:00:00Z"; }],
    ["unverified weighted league claim", f => { Object.assign(f.benchmark!, { leagueFga: 10000 }); }],
    ["stale benchmark season", f => { f.benchmark!.chartIdentity.season = "2002-03"; }],
    ["orphan LA", f => { f.benchmark = null; }],
    ["invalid scale", f => { f.zones[0].sourceTraditionalScaleValue = 6; }],
    ["observed points treated as durable", f => { Object.assign(f.rawPointCoverage, { durableCount: 28 }); }],
    ["observed points disagree", f => { f.rawPointCoverage.sourceObservedCount = 27; }],
    ["stale review", f => { f.review.evidenceSha256 = "d".repeat(64); }],
    ["review without report", f => { f.review.status = "passed"; }],
    ["unknown fields", f => { Object.assign(f, { rawShots: [] }); }],
    ["runtime enablement", f => { Object.assign(f, { publicationStatus: "approved" }); }],
  ];
  it.each(mutations)("rejects %s", (_, mutate) => {
    const f = fixture(); mutate(f);
    expect(validateSeasonHeatmapCandidate(f, id).ok).toBe(false);
    expect(toSeasonHeatmapRendererDTO(f, id)).toBeNull();
  });
  it.each([null, [], "json", 1, {}])("rejects malformed top-level %s", raw => expect(validateSeasonHeatmapCandidate(raw, id).ok).toBe(false));
  it("rejects assigning a residual an unverified shot type", () => {
    const f = fixture(); Object.assign(f, { residuals: [{ id: "backcourt", sourceZoneId: "Back Court(BC) | Back Court Shot", sourceOrder: 14, fgm: 0, fga: 0, fgPctDisplay: null, distributionPctDisplay: "0.0", leagueAveragePctDisplay: null, sourceTraditionalScaleValue: null, sourceExtendedScaleValue: null, shotType: 3 }] });
    expect(validateSeasonHeatmapCandidate(f, id).ok).toBe(false);
  });
  it("imports a synthetic source with exact hash and stable named-zone mapping", () => {
    const f = fixture();
    const raw = { schemaVersion: 1, kind: "read-only-official-NBA-visible-advanced-14-zone-pilot", publicationStatus: "not-approved-not-runtime-data", player: { nbaId: id.playerId, name: "Synthetic Test Player" }, season: id.season, seasonType: id.seasonType,
      source: { heading: `FGA for Synthetic Test Player during the ${id.season} ${id.seasonType}`, url: f.source.url, contextMeasure: "FGA", selectedChart: "SHOT ZONES", selectedZoneMode: "ADVANCED", selectedColorScale: "TRADITIONAL", exactRetrievedAtUtc: null, renderedDomReadAtWindowUtc: f.source.observedAtWindowUtc },
      svg: { viewBox: "0 0 540 570", allZonePathTransform: "scale(0.835)" },
      zones: f.zones.map(z => ({ sourceZoneId: z.sourceZoneId, sourceOrder: z.sourceOrder, FGM: z.fgm, FGA: z.fga, FG_PCT_display: z.fgPctDisplay, distributionPct_display: z.distributionPctDisplay, leagueAverageFG_PCT_display: z.leagueAveragePctDisplay, sourceTraditionalScaleValue: z.sourceTraditionalScaleValue, sourceExtendedScaleValue: z.sourceExtendedScaleValue, pathD: z.pathD, labelGroupTranslate: z.labelGroupTranslate })),
    };
    const bytes = JSON.stringify(raw);
    const options = { expectedIdentity: id, expectedEvidenceSha256: evidenceSha256(bytes), evidencePath: "test-only/raw.json", sourceOverall: f.sourceOverall, independentCareerTotals: f.independentCareerTotals, sourceObservedPointCount: 28 };
    const result = importVisibleAdvanced14Evidence(bytes, options);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.review.status).toBe("pending");
    expect(result.value.source.capturedAtUtc).toBeNull();
    expect(toSeasonHeatmapRendererDTO(result.value, id)).toEqual(toSeasonHeatmapRendererDTO(f, id));
    expect(importVisibleAdvanced14Evidence(bytes, { ...options, expectedIdentity: { ...id, playerId: 42 } }).ok).toBe(false);
    expect(importVisibleAdvanced14Evidence("bad-json", { ...options, expectedEvidenceSha256: evidenceSha256("bad-json") }).ok).toBe(false);
    raw.zones[0].pathD = "M0,0";
    const altered = JSON.stringify(raw);
    expect(importVisibleAdvanced14Evidence(altered, { ...options, expectedEvidenceSha256: evidenceSha256(altered) }).ok).toBe(false);
  });
  it("requires exact frozen evidence bytes for offline import", () => {
    const f = fixture();
    expect(importVisibleAdvanced14Evidence("{}", { expectedIdentity: id, expectedEvidenceSha256: "f".repeat(64), evidencePath: "test-only/raw.json", sourceOverall: f.sourceOverall, independentCareerTotals: null, sourceObservedPointCount: null })).toEqual({ ok: false, error: "Evidence byte hash differs from frozen source" });
    expect(evidenceSha256("{}\n")).not.toBe(evidenceSha256("{}"));
  });
});
