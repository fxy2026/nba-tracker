import { describe, expect, it } from "vitest";
import { decodeSeasonHeatmapResource } from "./season-heatmap-client";
import { courtBasic12Zones, SEASON_HEATMAP_COURT_GEOMETRY_VERSION } from "./season-heatmap-court-zones";
import type { HeatmapIdentity, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "./season-heatmap";

const identity: HeatmapIdentity = { playerId: 201939, season: "2015-16", seasonType: "Regular Season" };
const benchmarkKind = "weighted-archive-counts-not-official-displayed-LA" as const;
const shown = (made: number, attempts: number) => attempts ? (Math.round(made * 1000 / attempts) / 10).toFixed(1) : null;
type Shooting = { fgm: number; fga: number; fg3m: number; fg3a: number };

/** Synthetic contract fixture. These zone counts are not an observed player archive. */
function courtArchiveFixture(): { status: "ready"; data: SeasonHeatmapRendererDTO } {
  const row = (id: SeasonHeatmapDisplayRow["id"], sourceZoneId: string, shooting: Shooting): SeasonHeatmapDisplayRow => ({
    id, sourceZoneId, ...shooting, fgPct: shooting.fga ? shooting.fgm / shooting.fga : null,
    fgPctDisplay: shown(shooting.fgm, shooting.fga), sourceFgPctDisplay: shown(shooting.fgm, shooting.fga),
    attemptShare: shooting.fga / 57, attemptShareDisplay: shown(shooting.fga, 57),
    status: shooting.fga ? "has-attempts" : "no-attempts",
    leagueAverage: shooting.fga ? { provenance: benchmarkKind, displayedPct: shown(shooting.fgm, shooting.fga)!, leagueFgm: shooting.fgm * 2, leagueFga: shooting.fga * 2 } : null,
  });
  const zones = courtBasic12Zones.map(zone => row(zone.id, zone.sourceZoneId, { fgm: 2, fga: 4, fg3m: zone.shotValue === 3 ? 2 : 0, fg3a: zone.shotValue === 3 ? 4 : 0 }));
  const residuals = [
    row("backcourt", "Back Court(BC) | Back Court Shot", { fgm: 1, fga: 5, fg3m: 1, fg3a: 5 }),
    row("unclassified", "null | null", { fgm: 0, fga: 1, fg3m: 0, fg3a: 0 }),
    row("classification-conflict", "Source classification / explicit shot type conflict", { fgm: 1, fga: 3, fg3m: 1, fg3a: 2 }),
  ];
  return { status: "ready", data: {
    ...identity, geometryVersion: SEASON_HEATMAP_COURT_GEOMETRY_VERSION, status: "archive-summary", zones, residuals,
    totals: { fgm: 26, fga: 57 },
    source: { url: "https://raw.githubusercontent.com/fxy2026/nba_data/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/shotdetail_2015.tar.xz", capturedAtUtc: "2026-10-03T09:45:03.679217Z", observedAtWindowUtc: null },
    coverage: { aggregate: "archive-source-only", rawPoints: "not-captured", normalZoneAttempts: 48, residualAttempts: 9, seasonAttemptDenominator: 57 },
    benchmark: { kind: benchmarkKind, season: identity.season, seasonType: identity.seasonType, from: "2015-10-27", to: "2016-04-13", shotBearingGames: 10, leagueFgm: 52, leagueFga: 114 },
    archive: { fg3m: 12, fg3a: 27, shotBearingGames: 5, officialGp: null, coverageStatus: "not-officially-reconciled", sourceCoverage: { from: "2015-10-27", to: "2016-04-13" }, metadataObservedAtUtc: "2026-10-03T10:47:00Z", officialControl: null },
  } };
}

describe("court-aligned archive client contract", () => {
  it("accepts all 12 BASIC regions and retains every residual and explicit 3P count", () => {
    const result = courtArchiveFixture();
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual(result);
    expect(result.data.zones).toHaveLength(12);
    expect(result.data.residuals.map(row => [row.id, row.fgm, row.fga, row.fg3m, row.fg3a])).toEqual([
      ["backcourt", 1, 5, 1, 5], ["unclassified", 0, 1, 0, 0], ["classification-conflict", 1, 3, 1, 2],
    ]);
  });
  it("rejects missing, duplicate, legacy, wrong-source and misplaced residual zone rows", () => {
    const mutations: ((data: SeasonHeatmapRendererDTO) => void)[] = [
      data => { data.zones.pop(); },
      data => { data.zones[0].id = data.zones[1].id; },
      data => { data.zones[0].id = "center-under-8"; },
      data => { data.zones[0].sourceZoneId = "Center(C) | Less Than 8 ft."; },
      data => { data.residuals[2].sourceZoneId = "null | null"; },
      data => { [data.zones[0], data.residuals[2]] = [data.residuals[2], data.zones[0]]; },
      data => { data.residuals.push({ ...data.residuals[2] }); },
      data => { delete data.zones[0].fg3a; },
      data => { data.geometryVersion = "nba-advanced14-svg-v1"; },
      data => { data.status = "verified-aggregate"; },
      data => { data.coverage.aggregate = "full-season-reconciled"; },
    ];
    for (const mutate of mutations) {
      const result = courtArchiveFixture(); mutate(result.data);
      expect(decodeSeasonHeatmapResource(result, identity)).toEqual({ status: "error" });
    }
  });
  it("rejects explicit 3Ps inside the two-point court even when shooting totals still reconcile", () => {
    const result = courtArchiveFixture();
    result.data.zones[0].fg3m = 1; result.data.zones[0].fg3a = 1;
    result.data.archive!.fg3m++; result.data.archive!.fg3a++;
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual({ status: "error" });
  });
  it("rejects explicit 2Ps in a three-point region even when shooting totals still reconcile", () => {
    const result = courtArchiveFixture();
    const row = result.data.zones.find(row => row.id === "corner-three-left")!;
    row.fg3m = 1; row.fg3a = 2;
    result.data.archive!.fg3m--; result.data.archive!.fg3a -= 2;
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual({ status: "error" });
  });
  it("does not lose mixed point types or attempts in the classification-conflict residual", () => {
    const result = courtArchiveFixture();
    expect(decodeSeasonHeatmapResource(result, identity).status).toBe("ready");
    result.data.residuals.pop();
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual({ status: "error" });
  });
  it("retains genuine zero-attempt rows with null rates without converting missing records to zeros", () => {
    const result = courtArchiveFixture();
    result.data.totals = { fgm: 0, fga: 0 };
    Object.assign(result.data.archive!, { fg3m: 0, fg3a: 0, shotBearingGames: 0 });
    Object.assign(result.data.coverage, { normalZoneAttempts: 0, residualAttempts: 0, seasonAttemptDenominator: 0 });
    for (const row of [...result.data.zones, ...result.data.residuals]) Object.assign(row, { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, fgPct: null, fgPctDisplay: null, sourceFgPctDisplay: null, attemptShare: 0, attemptShareDisplay: "0.0", status: "no-attempts", leagueAverage: null });
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual(result);
    expect(decodeSeasonHeatmapResource({ status: "unavailable" }, identity)).toEqual({ status: "unavailable" });
    result.data.zones.pop();
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual({ status: "error" });
  });
  it("preserves source date bounds and rejects invalid or out-of-season calendar dates", () => {
    for (const [from, to] of [["2015-06-30", "2016-04-13"], ["2015-10-27", "2017-01-01"], ["2015-10-27", "2016-02-30"], ["2016-04-13", "2015-10-27"]]) {
      const result = courtArchiveFixture();
      result.data.archive!.sourceCoverage = { from, to }; Object.assign(result.data.benchmark!, { from, to });
      expect(decodeSeasonHeatmapResource(result, identity)).toEqual({ status: "error" });
    }
    const result = courtArchiveFixture();
    result.data.archive!.sourceCoverage = { from: "2015-07-01", to: "2016-12-31" };
    Object.assign(result.data.benchmark!, result.data.archive!.sourceCoverage);
    expect(decodeSeasonHeatmapResource(result, identity)).toEqual(result);
  });
});
