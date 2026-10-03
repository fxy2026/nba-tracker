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
