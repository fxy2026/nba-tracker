import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadSeasonHeatmapArchive } from "./verified-season-heatmap-archive";
import { decodeSeasonHeatmapResource } from "./season-heatmap-client";
import type { HeatmapIdentity, SeasonHeatmapRendererDTO } from "./season-heatmap";

const current: HeatmapIdentity = { playerId: 201939, season: "2025-26", seasonType: "Regular Season" };
const historical: HeatmapIdentity = { ...current, season: "2015-16" };
function fixture(identity = current): { status: "ready"; data: SeasonHeatmapRendererDTO } {
  const result = loadSeasonHeatmapArchive(identity);
  if (result.status !== "ready") throw Error("Expected verified archive");
  return structuredClone(result);
}

// Synthetic extension of a verified fixture; not a captured archive observation.
function archiveFixture(identity = current) {
  const result = fixture(identity), data = result.data;
  const from = `${identity.season.slice(0, 4)}-10-01`, to = `${Number(identity.season.slice(0, 4)) + 1}-06-30`;
  data.status = "archive-summary";
  data.coverage.aggregate = "archive-source-only";
  data.source = { url: `https://raw.githubusercontent.com/fxy2026/nba_data/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/shotdetail_${identity.season.slice(0, 4)}.tar.xz`, capturedAtUtc: "2026-10-03T09:45:03.679217Z", observedAtWindowUtc: null };
  data.benchmark = { kind: "weighted-archive-counts-not-official-displayed-LA", season: identity.season, seasonType: identity.seasonType, from, to, shotBearingGames: 60, leagueFgm: data.totals.fgm * 2, leagueFga: data.totals.fga * 2 };
  data.archive = { fg3m: 0, fg3a: 0, shotBearingGames: 35, officialGp: null, coverageStatus: "not-officially-reconciled", sourceCoverage: { from, to }, metadataObservedAtUtc: "2026-10-03T10:47:00Z", officialControl: null };
  for (const row of [...data.zones, ...data.residuals]) {
    row.fg3m = 0; row.fg3a = 0;
    row.leagueAverage = row.fga ? { provenance: "weighted-archive-counts-not-official-displayed-LA", displayedPct: row.fgPctDisplay!, leagueFgm: row.fgm * 2, leagueFga: row.fga * 2 } : null;
  }
  return result;
}

describe("season heatmap client response boundary", () => {
  it.each([current, historical])("accepts only validated ready data for $season", identity => {
    const result = fixture(identity);
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual(result);
  });
  it("rejects wrong season, player, type and private-preview data", () => {
    for (const wrong of [{ ...current, season: "2015-16" }, { ...current, playerId: 2544 }, { ...current, seasonType: "Playoffs" as const }]) expect(decodeSeasonHeatmapResource(fixture(), wrong)).toEqual({ status: "error" });
    const result = fixture(); result.data.status = "private-preview-only";
    expect(decodeSeasonHeatmapResource(result, current)).toEqual({ status: "error" });
  });
  it.each([null, [], {}, { status: "loading" }, { status: "ready" }, { status: "ready", data: [] }, { status: "unavailable", data: null }])("fails closed for malformed envelope %j", value => {
    expect(decodeSeasonHeatmapResource(value, current)).toEqual({ status: "error" });
  });
  it("distinguishes unavailable and error from zero shooting", () => {
    expect(decodeSeasonHeatmapResource({ status: "unavailable" }, current)).toEqual({ status: "unavailable" });
    expect(decodeSeasonHeatmapResource({ status: "error" }, current)).toEqual({ status: "error" });
  });
  it("rejects altered counts, missing/duplicate zones, unsafe sources and added evidence", () => {
    const mutations: ((data: SeasonHeatmapRendererDTO) => void)[] = [
      data => { data.totals.fga++; }, data => { data.zones[0].fgm++; }, data => { data.zones.pop(); },
      data => { data.zones[0].id = data.zones[1].id; }, data => { data.coverage.seasonAttemptDenominator--; },
      data => { data.zones[0].attemptShare = .99; }, data => { data.zones[0].leagueAverage!.displayedPct = "NaN"; },
      data => { data.source!.url = "javascript:alert(1)"; }, data => { data.source!.url = data.source!.url.replace("2025-26", "2015-16"); },
      data => { Object.assign(data, { evidencePath: "/not-a-public-fact" }); },
    ];
    for (const mutate of mutations) { const result = fixture(); mutate(result.data); expect(decodeSeasonHeatmapResource(result, current)).toEqual({ status: "error" }); }
  });
  it("keeps 2015 residual counts and full denominator instead of spatial reassignment", () => {
    const result = decodeSeasonHeatmapResource(fixture(historical), historical);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.data.residuals.map(row => [row.id, row.fgm, row.fga])).toEqual([["backcourt", 3, 12], ["unclassified", 1, 2]]);
    expect(result.data.coverage).toMatchObject({ normalZoneAttempts: 1584, residualAttempts: 14, seasonAttemptDenominator: 1598 });
  });
  it("supports genuinely zero attempts with no rate rather than fabricating 0%", () => {
    const result = fixture();
    result.data.totals = { fgm: 0, fga: 0 };
    Object.assign(result.data.coverage, { normalZoneAttempts: 0, residualAttempts: 0, seasonAttemptDenominator: 0 });
    for (const row of result.data.zones) Object.assign(row, { fgm: 0, fga: 0, fgPct: null, fgPctDisplay: null, sourceFgPctDisplay: "0.0", attemptShare: 0, attemptShareDisplay: "0.0", status: "no-attempts" });
    expect(decodeSeasonHeatmapResource(result, current)).toEqual(result);
  });
});

describe("archive-summary client boundary", () => {
  it.each([current, historical])("accepts source-specific weighted summaries without promoting $season to official coverage", identity => {
    const result = archiveFixture(identity);
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual(result);
    expect(result.data.zones.find(row => row.id === "left-24-plus")!.fg3a).toBe(0);
  });
  it("retains non-spatial residuals and validates their explicit three-point contribution", () => {
    const result = archiveFixture(historical), row = result.data.residuals[0];
    row.fg3m = 2; row.fg3a = 4;
    result.data.archive!.fg3m = 2; result.data.archive!.fg3a = 4;
    expect(decodeSeasonHeatmapResource(result, historical)).toEqual(result);
    result.data.archive!.fg3a = 5;
    expect(decodeSeasonHeatmapResource(result, historical)).toEqual({ status: "error" });
  });
  it("keeps shot-bearing games separate from official GP and verifies the control result", () => {
    const result = archiveFixture();
    Object.assign(result.data.archive!, { officialGp: 36, coverageStatus: "official-shooting-totals-match", officialControl: { ...result.data.totals, fg3m: 0, fg3a: 0, url: "https://www.nba.com/stats/player/201939/career?PerMode=Totals", capturedAtUtc: "2026-10-03T03:21:09.496Z" } });
    expect(decodeSeasonHeatmapResource(result, current)).toEqual(result);
    result.data.archive!.officialControl!.fga++;
    expect(decodeSeasonHeatmapResource(result, current)).toEqual({ status: "error" });
    result.data.archive!.coverageStatus = "official-shooting-totals-mismatch";
    expect(decodeSeasonHeatmapResource(result, current)).toEqual(result);
    result.data.archive!.officialGp = 34;
    expect(decodeSeasonHeatmapResource(result, current)).toEqual({ status: "error" });
    result.data.archive!.officialGp = 36;
    result.data.archive!.officialControl!.capturedAtUtc = "2026-02-30T03:21:09Z";
    expect(decodeSeasonHeatmapResource(result, current)).toEqual({ status: "error" });
  });
  it("requires explicit provenance, exact league period, original counts and pinned source", () => {
    const mutations: ((data: SeasonHeatmapRendererDTO) => void)[] = [
      data => { delete data.archive; }, data => { data.status = "verified-aggregate"; },
      data => { data.coverage.aggregate = "full-season-reconciled"; },
      data => { data.zones[0].leagueAverage = { displayedPct: "40.0", provenance: "source-displayed-unverified-scope" }; },
      data => { if (data.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA") data.benchmark.seasonType = "Playoffs"; },
      data => { if (data.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA") data.benchmark.from = "2025-09-01"; },
      data => { if (data.zones[0].leagueAverage?.provenance === "weighted-archive-counts-not-official-displayed-LA") data.zones[0].leagueAverage.leagueFga++; },
      data => { data.zones[0].fg3a = data.zones[0].fga; },
      data => { delete data.zones[0].fg3a; }, data => { data.archive!.shotBearingGames = data.totals.fga + 1; },
      data => { data.archive!.officialGp = 36; }, data => { data.archive!.coverageStatus = "official-shooting-totals-match"; },
      data => { data.archive!.sourceCoverage.from = "2025-02-30"; },
      data => { data.archive!.sourceCoverage.from = "2025-06-30"; if (data.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA") data.benchmark.from = "2025-06-30"; },
      data => { data.archive!.sourceCoverage.to = "2027-01-01"; if (data.benchmark?.kind === "weighted-archive-counts-not-official-displayed-LA") data.benchmark.to = "2027-01-01"; },
      data => { data.archive!.metadataObservedAtUtc = "not a date"; },
      data => { data.archive!.metadataObservedAtUtc = "2026-02-30T10:47:00Z"; },
      data => { data.source!.capturedAtUtc = "2026-02-30T09:45:00Z"; },
      data => { data.source!.observedAtWindowUtc = ["2026-02-30T09:45:00Z", "2026-03-03T09:45:00Z"]; },
      data => { data.source!.url = data.source!.url.replace("shotdetail_2025", "shotdetail_po_2025"); },
      data => { data.source!.url = data.source!.url.replace("e829d4678be1e075f99e5d41a1c5f97089be446b", "main"); },
      data => { Object.assign(data.archive!, { rawPoints: [] }); },
    ];
    for (const mutate of mutations) { const result = archiveFixture(); mutate(result.data); expect(decodeSeasonHeatmapResource(result, current)).toEqual({ status: "error" }); }
  });
  it("accepts extended season dates through the next December without permitting another season", () => {
    const result = archiveFixture();
    result.data.archive!.sourceCoverage = { from: "2025-07-01", to: "2026-12-31" };
    Object.assign(result.data.benchmark!, { from: "2025-07-01", to: "2026-12-31" });
    expect(decodeSeasonHeatmapResource(result, current)).toEqual(result);
  });
  it("accepts genuine zero counts with null rates and no comparison instead of inventing shot records", () => {
    const result = archiveFixture();
    result.data.totals = { fgm: 0, fga: 0 };
    Object.assign(result.data.archive!, { fg3m: 0, fg3a: 0, shotBearingGames: 0 });
    Object.assign(result.data.coverage, { normalZoneAttempts: 0, residualAttempts: 0, seasonAttemptDenominator: 0 });
    for (const row of [...result.data.zones, ...result.data.residuals]) Object.assign(row, { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, fgPct: null, fgPctDisplay: null, sourceFgPctDisplay: null, attemptShare: 0, attemptShareDisplay: "0.0", status: "no-attempts", leagueAverage: null });
    expect(decodeSeasonHeatmapResource(result, current)).toEqual(result);
  });
});
