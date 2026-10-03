import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import * as archive from "@/lib/historical-shot-spatial";
import { GET } from "./route";
const query = "playerId=201939&season=2015-16&seasonType=Regular+Season&geometry=nba-shot-hex-v1";
const request = (params = query) => new Request(`https://example.test/api/player-season-shot-map?${params}`);
afterEach(() => vi.restoreAllMocks());
describe("versioned per-selection spatial API", () => {
  it("returns actual bins and the honest raw/control distinction with public cache headers", async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400");
    expect(await response.json()).toMatchObject({ status: "ready", data: { geometryVersion: "nba-shot-hex-v1", totals: { fgm: 804, fga: 1596 }, plotted: { fgm: 802, fga: 1585 }, archive: { officialControl: { fgm: 805, fga: 1598 } } } });
  });
  it.each(["", query.replace("&geometry=nba-shot-hex-v1", ""), query.replace("nba-shot-hex-v1", "nba-court-basic12-v1"), query + "&extra=1", query + "&geometry=nba-shot-hex-v1", query + "&playerId=1", query.replace("201939", "0201939"), query.replace("201939", "NaN"), query.replace("201939", "9007199254740992"), query.replace("2015-16", "2015-17"), query.replace("Regular+Season", "Pre+Season")])("rejects malformed identity/version %s", async params => {
    const response = await GET(request(params)); expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("distinguishes unavailable from failed validation with no-store and no fallback", async () => {
    expect((await GET(request(query.replace("2015-16", "2004-05")))).status).toBe(404);
    vi.spyOn(archive, "loadHistoricalShotMap").mockResolvedValue({ status: "error" });
    const response = await GET(request()); expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
