import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import * as archive from "@/lib/season-heatmap-catalog-server";
import { GET } from "./route";

const query = "playerId=201939&season=2025-26&seasonType=Regular+Season";
const request = (params = query) => new Request(`https://example.test/api/player-season-heatmap?${params}`);
afterEach(() => vi.restoreAllMocks());

describe("read-only player-season aggregate API", () => {
  it("returns only court-aligned current and historical public DTOs with stable headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const [season, fga] of [["2025-26", 799], ["2015-16", 1596]] as const) {
      const response = await GET(request(query.replace("2025-26", season)));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400");
      expect(await response.json()).toMatchObject({ status: "ready", data: { playerId: 201939, season, status: "archive-summary", geometryVersion: "nba-court-basic12-v1", totals: { fga } } });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    query + "&geometry=invalid", query + "&geometry=nba-advanced14-svg-v1", query + "&geometry=nba-court-basic12-v1&geometry=nba-court-basic12-v1",
    "", "playerId=201939", query + "&playerId=201939", query + "&season=2025-26", query + "&seasonType=Regular+Season", query + "&extra=1",
    query.replace("201939", "0201939"), query.replace("201939", "201939abc"), query.replace("201939", "0"),
    query.replace("201939", "-201939"), query.replace("201939", "201939.0"), query.replace("201939", "9007199254740992"),
    query.replace("201939", "%20201939"), query.replace("2025-26", "2025-27"), query.replace("2025-26", "2025"),
    query.replace("Regular+Season", "Regular%2BSeason"), query.replace("Regular+Season", "Pre+Season"),
  ])("returns a no-store 400 for malformed query %s", async params => {
    const response = await GET(request(params));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "error" });
  });

  it.each([query.replace("201939", "999999999"), query.replace("2025-26", "1995-96"), query.replace("201939", "999999998").replace("Regular+Season", "Playoffs")])("returns unavailable without fallback for %s", async params => {
    const response = await GET(request(params));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it("accepts a versioned court identity for a fresh geometry-specific HTTP cache entry", async () => {
    const response = await GET(request(query + "&geometry=nba-court-basic12-v1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready", data: { geometryVersion: "nba-court-basic12-v1" } });
  });

  it("reports an integrity failure as a no-store 503 without fabricated data", async () => {
    vi.spyOn(archive, "loadPlayerSeasonHeatmapArchive").mockResolvedValue({ status: "error" });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "error" });
  });
});
