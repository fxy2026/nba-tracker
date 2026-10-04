import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import archive from "@/data/historical-career-archives/893-2026-10-04.json";
import { getHistoricalCareerArchive, validateHistoricalCareerArchive } from "./historical-career-archive";
import { historicalCareerAverage, historicalCareerPercentage, normalizeHistoricalCareerData, sumHistoricalCareerTotals } from "./historical-career-data";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = (path: string, value: unknown): unknown => {
  const copy = structuredClone(archive);
  const keys = path.split(".");
  let target = copy as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = value;
  return copy;
};

describe("dated historical career data", () => {
  it("loads a player-scoped secondary-source snapshot and preserves its date", async () => {
    const data = await getHistoricalCareerArchive(893);
    expect(data?.playerName).toBe("Michael Jordan");
    expect(data?.retrievedAt).toBe("2026-10-04T03:24:33Z");
    expect(data?.rows.filter(row => row.seasonType === "Regular Season")).toHaveLength(15);
    expect(data?.rows.filter(row => row.seasonType === "Playoffs")).toHaveLength(13);
    expect(data?.rows.every(row => row.sourceStatus === "secondary_source")).toBe(true);
    expect(data?.rows.every(row => row.nbaPlayerId === 893)).toBe(true);
    expect(data?.rows.some(row => row.season === "1993-94")).toBe(false);
    expect(data?.rows.some(row => row.season === "2000-01")).toBe(false);
    expect(data?.rows.filter(row => row.seasonType === "Playoffs").some(row => row.teamAbbreviation === "WAS")).toBe(false);
    expect(JSON.stringify(data)).not.toMatch(/evidenceFile|evidenceSha256|sourceObservations|derivedFromTotals|perGame|publishedCareerTotals/);
  });
  it("reconstructs weighted regular-season and playoff career statistics from totals independently", () => {
    const data = normalizeHistoricalCareerData(archive, 893)!;
    const regular = sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Regular Season"));
    const playoffs = sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Playoffs"));
    expect(regular).toMatchObject({ GP: 1072, PTS: 32292, REB: 6672, AST: 5633, MIN: null, GS: null });
    expect(playoffs).toMatchObject({ GP: 179, PTS: 5987, REB: 1152, AST: 1022 });
    expect(historicalCareerAverage(regular, "PTS")).toBe(32292 / 1072);
    expect(historicalCareerAverage(playoffs, "PTS")).toBe(5987 / 179);
    expect(historicalCareerPercentage(regular, "FG")).toBe(regular.FGM! / regular.FGA! * 100);
    expect(historicalCareerAverage(regular, "MIN")).toBeNull();
    expect(historicalCareerPercentage({ ...regular, FG3A: 0, FG3M: 0 }, "FG3")).toBeNull();
    expect(historicalCareerPercentage({ ...regular, FG3A: 50, FG3M: 0 }, "FG3")).toBe(0);
    expect(historicalCareerAverage(sumHistoricalCareerTotals([]), "PTS")).toBeNull();
  });
  it("compares equivalent timestamp precisions by time rather than string ordering", () => {
    expect(normalizeHistoricalCareerData(changed("retrievedAt", "2026-10-04T03:24:33.000Z"), 893)).not.toBeNull();
  });
  it("quarantines disputed minutes and keeps both labelled observations", () => {
    const data = normalizeHistoricalCareerData(archive, 893)!;
    const row = data.rows.find(row => row.season === "2001-02")!;
    expect(row.totals.MIN).toBeNull();
    expect(historicalCareerAverage(row.totals, "MIN")).toBeNull();
    expect(data.disputes).toEqual([{ season: "2001-02", seasonType: "Regular Season", field: "MIN", resolution: "quarantined_null", observations: [
      { sourceId: "statmuse_regular_totals", value: 2093 }, { sourceId: "basketballmonster_regular_totals", value: 2094 },
    ] }]);
  });
  it("does not reuse historical sources as the live or NBA-reviewed career contract", async () => {
    expect(await getHistoricalCareerArchive(2544)).toBeNull();
    expect(await getHistoricalCareerArchive(999999)).toBeNull();
    expect(normalizeHistoricalCareerData(archive, 977)).toBeNull();
    expect(validateHistoricalCareerArchive(archive, 893, "bad-hash")).toBeNull();
    expect(validateHistoricalCareerArchive(changed("rows.0.totals.PTS", 2314), 893, hash(archive))).toBeNull();
  });
  it.each([
    ["schemaVersion", 2], ["player.nbaPlayerId", 977], ["officialNbaVerified", true],
    ["retrievedAt", "2026-02-30T03:24:33Z"], ["rows.0.season", "1984-99"], ["rows.0.nbaPlayerId", 977],
    ["rows.0.seasonType", "Combined"], ["rows.0.sourceStatus", "official"],
    ["rows.0.sourceId", "made-up"], ["rows.0.sourceUrl", "https://evil.test/nba/stats"],
    ["sources.0.url", "https://www.statmuse.com.evil.test/nba/stats"],
    ["rows.0.retrievedAt", "2027-10-04T03:24:33Z"], ["rows.0.totals.GP", 0],
    ["rows.0.totals.MIN", undefined], ["rows.0.totals.PTS", -1], ["rows.0.totals.REB", 3.5],
    ["rows.0.totals.FGM", 99999], ["rows.0.totals.FG3A", 99999], ["rows.0.totals.OREB", 999],
    ["rows.0.totals.PTS", 2314], ["disputes.0.field", "totals.PTS"],
  ])("rejects invalid field %s", (path, value) => {
    expect(normalizeHistoricalCareerData(changed(path as string, value), 893)).toBeNull();
  });
  it("rejects repeated seasons so team splits cannot inflate career totals", () => {
    const copy = structuredClone(archive);
    copy.rows.push({ ...copy.rows[0], teamAbbreviation: "TOT" });
    expect(normalizeHistoricalCareerData(copy, 893)).toBeNull();
  });
  it("never consumes source-provided rounded averages or published career MIN", () => {
    const data = normalizeHistoricalCareerData(changed("rows.0.perGame.PTS", 999), 893)!;
    expect(historicalCareerAverage(data.rows[0].totals, "PTS")).toBe(2313 / 82);
    expect(sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Regular Season")).MIN).toBeNull();
  });
});
