import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { courtSeasonHeatmapUrl, decodeCourtSeasonHeatmapResource } from "./season-heatmap-request";
import { loadHistoricalCourtArchive } from "./historical-shot-archive";
import { loadSeasonHeatmapArchive } from "./verified-season-heatmap-archive";
import type { HeatmapIdentity } from "./season-heatmap";
const identity: HeatmapIdentity = { playerId: 201939, season: "2015-16", seasonType: "Regular Season" };

describe("default court heatmap request identity", () => {
  it("versions the request by geometry while preserving exact player/season/type", () => {
    const url = new URL(courtSeasonHeatmapUrl(identity), "https://example.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({ playerId: "201939", season: "2015-16", seasonType: "Regular Season", geometry: "nba-court-basic12-v1" });
    expect(url.pathname).toBe("/api/player-season-heatmap");
  });
  it("rejects a previously cached official14 response even when its player and season match", () => {
    const old = loadSeasonHeatmapArchive(identity);
    expect(old.status).toBe("ready");
    expect(decodeCourtSeasonHeatmapResource(old, identity)).toEqual({ status: "error" });
  });
  it("accepts only the recomputed default court shape and preserves failure distinctions", async () => {
    const current = await loadHistoricalCourtArchive(identity);
    expect(decodeCourtSeasonHeatmapResource(current, identity)).toEqual(current);
    expect(decodeCourtSeasonHeatmapResource({ status: "unavailable" }, identity)).toEqual({ status: "unavailable" });
    expect(decodeCourtSeasonHeatmapResource({ status: "error" }, identity)).toEqual({ status: "error" });
  });
});
