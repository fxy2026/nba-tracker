import { describe, expect, it } from "vitest";
import { decodeSeasonShotMapResource } from "./season-shot-map-client";
import { seasonShotMapUrl } from "./season-shot-map-request";
import { shotMapBinCenter, shotMapCellIntersectsFrame, type SeasonShotMapDTO } from "./season-shot-map";
const identity = { playerId: 201939, season: "2015-16", seasonType: "Regular Season" as const };
/** Synthetic transport fixture, deliberately independent of production shot positions. */
function fixture(): SeasonShotMapDTO {
  const counts = { fgm: 20, fga: 40, fg3m: 5, fg3a: 10 };
  const league = { fgm: 200, fga: 400, fg3m: 50, fg3a: 100 };
  return { ...identity, schemaVersion: "nba-spatial-v1", geometryVersion: "nba-shot-hex-v1", totals: { ...counts }, plotted: { ...counts }, residuals: [],
    resolutions: [{ id: "fine", radius: 25, bins: [{ q: 0, r: 0, ...counts, league: { ...league } }] }, { id: "coarse", radius: 40, bins: [{ q: 0, r: 0, ...counts, league: { ...league } }] }],
    source: { url: "https://raw.githubusercontent.com/fxy2026/nba_data/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/shotdetail_2015.tar.xz", capturedAtUtc: "2026-10-03T09:00:00Z" },
    archive: { fg3m: 5, fg3a: 10, shotBearingGames: 3, officialGp: null, coverageStatus: "not-officially-reconciled", sourceCoverage: { from: "2015-10-27", to: "2016-04-13" }, metadataObservedAtUtc: "2026-10-03T09:00:00Z", officialControl: null },
    reference: { kind: "same-season-type-cell-archive-counts", includesPlayer: true, minPlayerAttempts: 5, minLeagueAttempts: 20, scope: { kind: "weighted-archive-counts-not-official-displayed-LA", ...{ season: identity.season, seasonType: identity.seasonType }, from: "2015-10-27", to: "2016-04-13", shotBearingGames: 100, leagueFgm: 200, leagueFga: 400 } },
  };
}
const decode = (data: unknown) => decodeSeasonShotMapResource({ status: "ready", data }, identity);
describe("strict spatial client boundary", () => {
  it("preserves exact cells including mixed explicit point types and versions the URL", () => {
    const data = fixture(); expect(decode(data)).toEqual({ status: "ready", data });
    const url = new URL(seasonShotMapUrl(identity), "https://example.test");
    expect(url.pathname).toBe("/api/player-season-shot-map"); expect(url.searchParams.get("geometry")).toBe("nba-shot-hex-v1");
  });
  it.each([
    ["wrong identity", (x: SeasonShotMapDTO) => { x.playerId++; }],
    ["wrong geometry", (x: SeasonShotMapDTO) => { Object.assign(x, { geometryVersion: "nba-court-basic12-v1" }); }],
    ["unknown fields", (x: SeasonShotMapDTO) => { Object.assign(x, { sourceZoneCounts: [] }); }],
    ["duplicate resolution", (x: SeasonShotMapDTO) => { x.resolutions[1] = x.resolutions[0]; }],
    ["wrong radius", (x: SeasonShotMapDTO) => { x.resolutions[0].radius = 40; }],
    ["duplicate cell", (x: SeasonShotMapDTO) => { x.resolutions[0].bins.push(x.resolutions[0].bins[0]); }],
    ["fractional coordinate", (x: SeasonShotMapDTO) => { x.resolutions[0].bins[0].q = 0.1; }],
    ["off-court cell", (x: SeasonShotMapDTO) => { x.resolutions[0].bins[0].q = 30; }],
    ["lost attempt", (x: SeasonShotMapDTO) => { x.resolutions[0].bins[0].fga--; }],
    ["lost 3P", (x: SeasonShotMapDTO) => { x.resolutions[0].bins[0].fg3a--; }],
    ["negative count", (x: SeasonShotMapDTO) => { x.plotted.fga = -1; }],
    ["impossible subset misses", (x: SeasonShotMapDTO) => { x.resolutions[0].bins[0].league = { fgm: 40, fga: 40, fg3m: 10, fg3a: 10 }; }],
    ["wrong reference season", (x: SeasonShotMapDTO) => { x.reference.scope.season = "2025-26"; }],
    ["wrong dates", (x: SeasonShotMapDTO) => { x.reference.scope.from = "2015-02-30"; }],
    ["raw source mismatch", (x: SeasonShotMapDTO) => { x.source.url += "?token=secret"; }],
    ["fake reconciliation", (x: SeasonShotMapDTO) => { x.archive.coverageStatus = "official-shooting-totals-match"; }],
    ["unknown residual", (x: SeasonShotMapDTO) => { x.residuals.push({ reason: "unclassified" as never, fgm: 0, fga: 1, fg3m: 0, fg3a: 0 }); }],
    ["impossible repeated league mass", (x: SeasonShotMapDTO) => {
      const first = x.resolutions[0].bins[0]; first.fgm /= 2; first.fga /= 2; first.fg3m = 2; first.fg3a = 5;
      x.resolutions[0].bins.push({ ...first, q: 1, fg3m: 3, league: { ...first.league } });
    }],
  ])("rejects %s", (_, mutate) => { const data = fixture(); mutate(data); expect(decode(data)).toEqual({ status: "error" }); });
  it("retains missing coordinates outside the spatial plot without changing the denominator", () => {
    const data = fixture(); data.totals.fga++; data.residuals.push({ reason: "missing-coordinate", fgm: 0, fga: 1, fg3m: 0, fg3a: 0 });
    expect(decode(data)).toEqual({ status: "ready", data });
  });
  it("retains quarantined rim 3P counts and rejects two-point counts under that reason", () => {
    const data = fixture(); data.totals.fgm++; data.totals.fga += 2; data.totals.fg3m++; data.totals.fg3a += 2;
    data.archive.fg3m++; data.archive.fg3a += 2;
    data.residuals.push({ reason: "coordinate-shot-type-conflict", fgm: 1, fga: 2, fg3m: 1, fg3a: 2 });
    expect(decode(data)).toEqual({ status: "ready", data });
    data.residuals[0].fg3m = 0; data.residuals[0].fg3a = 0;
    data.totals.fg3m--; data.totals.fg3a -= 2; data.archive.fg3m--; data.archive.fg3a -= 2;
    expect(decode(data)).toEqual({ status: "error" });
  });
  it("preserves an explicitly supplied zero-attempt dataset without inventing any bins", () => {
    const data = fixture(), zero = { fgm: 0, fga: 0, fg3m: 0, fg3a: 0 };
    data.totals = { ...zero }; data.plotted = { ...zero }; data.archive.fg3m = 0; data.archive.fg3a = 0; data.archive.shotBearingGames = 0;
    data.resolutions.forEach(resolution => { resolution.bins = []; });
    expect(decode(data)).toEqual({ status: "ready", data });
  });
  it("preserves error/unavailable and rejects data on those states", () => {
    for (const status of ["error", "unavailable"] as const) {
      expect(decodeSeasonShotMapResource({ status }, identity)).toEqual({ status });
      expect(decodeSeasonShotMapResource({ status, data: fixture() }, identity)).toEqual({ status: "error" });
    }
  });
  it("derives the same real lattice and accepts only intersecting half-court cells", () => {
    expect(shotMapBinCenter({ q: 0, r: 0 }, 25)).toEqual({ x: 0, y: 0 });
    expect(shotMapBinCenter({ q: -6, r: 0 }, 25).x).toBeLessThan(-250);
    expect(shotMapCellIntersectsFrame({ q: -6, r: 0 }, 25)).toBe(true);
    expect(shotMapCellIntersectsFrame({ q: -20, r: 0 }, 25)).toBe(false);
  });
});
