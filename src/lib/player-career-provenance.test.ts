import { describe, expect, it } from "vitest";
import { normalizePlayerCareerData } from "./player-career-data";
import { careerSourceUrl, normalizeCareerProvenance } from "./player-career-provenance";

const provenance = {
  source: "nba-stats", providerPlayerId: "2544", scope: "regular-season",
  retrievalKind: "api-response", retrievedAt: "2026-10-03T02:00:00.000Z",
} as const;
const row = {
  SEASON_ID: "2025-26", TEAM_ABBREVIATION: "LAL", GP: 70, MIN: 30, PTS: 20,
  REB: 5, AST: 6, STL: 1, BLK: 0, FG_PCT: .5, FG3_PCT: null, FT_PCT: .8,
};
const careerShooting = { source: "nba-career-totals", FG_PCT: .5, FG3_PCT: null, FT_PCT: .8 };

describe("career response attribution", () => {
  it.each(["nba-stats", "espn"])("preserves valid %s metadata and permits a known empty history", source => {
    const meta = { ...provenance, source, providerPlayerId: source === "espn" ? "1966" : "2544" };
    for (const careerSeasons of [[], [row]]) {
      expect(normalizePlayerCareerData({ careerSeasons, provenance: meta })).toEqual({ careerSeasons, provenance: meta });
    }
  });

  it.each([
    null, [], {}, "nba-stats", { ...provenance, source: "independently-verified" },
    { ...provenance, providerPlayerId: 2544 }, { ...provenance, providerPlayerId: "" },
    { ...provenance, providerPlayerId: "2544/other" }, { ...provenance, providerPlayerId: "1966?redirect=evil" },
    { ...provenance, scope: "playoffs" }, { ...provenance, retrievalKind: "source-updated" },
    { ...provenance, retrievedAt: null }, { ...provenance, retrievedAt: 1790992800000 },
    { ...provenance, retrievedAt: "2025-26" }, { ...provenance, retrievedAt: "2026-10-03" },
    { ...provenance, retrievedAt: "2026-10-03T02:00:00" },
    { ...provenance, retrievedAt: "2026-10-03T02:00:00.000+08:00" },
    { ...provenance, retrievedAt: "2026-02-30T02:00:00.000Z" },
    { ...provenance, retrievedAt: "2026-13-03T02:00:00.000Z" },
    { ...provenance, retrievedAt: "2026-10-03T24:00:00.000Z" },
  ])("rejects malformed declared provenance without relabeling it as legacy %#", raw => {
    expect(normalizeCareerProvenance(raw)).toBeNull();
    expect(normalizePlayerCareerData({ careerSeasons: [row], provenance: raw })).toBeNull();
    expect(normalizePlayerCareerData({ careerSeasons: [], provenance: raw })).toBeNull();
  });

  it("keeps legacy rows and shooting attribution without inventing general provenance", () => {
    expect(normalizePlayerCareerData({ careerSeasons: [row], careerShooting }))
      .toEqual({ careerSeasons: [row], careerShooting });
  });

  it("does not weaken stat validation when provenance is valid", () => {
    expect(normalizePlayerCareerData({ careerSeasons: [{ ...row, PTS: null }], provenance })).toBeNull();
  });

  it("keeps the NBA shooting aggregate separate and rejects a mixed ESPN/NBA snapshot", () => {
    expect(normalizePlayerCareerData({ careerSeasons: [row], careerShooting, provenance }))
      .toEqual({ careerSeasons: [row], careerShooting, provenance });
    expect(normalizePlayerCareerData({ careerSeasons: [row], careerShooting, provenance: { ...provenance, source: "espn" } })).toBeNull();
  });

  it("drops unknown attribution claims and derives links only from known provider identities", () => {
    const meta = normalizeCareerProvenance({ ...provenance, sourceUrl: "https://invalid.example", verified: true })!;
    expect(meta).toEqual(provenance);
    expect(careerSourceUrl(meta)).toBe("https://stats.nba.com/stats/playercareerstats?PlayerID=2544&PerMode=PerGame");
    expect(careerSourceUrl({ ...meta, source: "espn", providerPlayerId: "1966" }))
      .toBe("https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/1966/stats");
  });
});
