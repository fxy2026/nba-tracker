import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import kareem from "@/data/historical-career-archives/76003-2026-10-04.json";
import wilt from "@/data/historical-career-archives/76375-2026-10-04.json";
import { getHistoricalCareerArchive, validateHistoricalCareerArchive } from "./historical-career-archive";
import { historicalCareerAverage, historicalCareerPercentage, historicalCareerEraCoverage, normalizeHistoricalCareerData, sumHistoricalCareerTotals } from "./historical-career-data";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fixtures = [
  { id: 76003, raw: kareem, regular: 20, playoffs: 18, regularGP: 1560, playoffGP: 237, regularPTS: 38387, playoffPTS: 5762, regularREB: 17440, playoffREB: 2481 },
  { id: 76375, raw: wilt, regular: 14, playoffs: 13, regularGP: 1045, playoffGP: 160, regularPTS: 31419, playoffPTS: 3607, regularREB: 23924, playoffREB: 3913 },
];
const eraKeys = ["STL", "BLK", "OREB", "DREB", "TOV", "FG3M", "FG3A"] as const;

describe.each(fixtures)("early-era archive $id", fixture => {
  it("loads exact independently audited played rows with approximate collection time", async () => {
    const data = await getHistoricalCareerArchive(fixture.id);
    expect(data?.rows.filter(row => row.seasonType === "Regular Season")).toHaveLength(fixture.regular);
    expect(data?.rows.filter(row => row.seasonType === "Playoffs")).toHaveLength(fixture.playoffs);
    expect(data?.retrievalPrecision).toBe("approximate-minute");
    expect(data?.retrievedAt).toBe("2026-10-04T03:36:00Z");
    expect(data?.rows.every(row => row.nbaPlayerId === fixture.id && row.sourceStatus === "secondary_source")).toBe(true);
    expect(data?.rows.every(row => row.totals.GS === null && row.totals.PLUS_MINUS === null)).toBe(true);
    expect(data?.sources.some(source => source.verifiedScope)).toBe(false);
    expect(JSON.stringify(data)).not.toMatch(/evidenceFile|evidenceSha256|sourceObservations|publishedCareerTotals|corroborationRows|fieldAvailability|officialNbaVerified/);
    expect(validateHistoricalCareerArchive(fixture.raw, fixture.id, hash(fixture.raw))).not.toBeNull();
    expect(validateHistoricalCareerArchive(fixture.raw, fixture.id, "changed-hash")).toBeNull();
  });
  it.each(["Regular Season", "Playoffs"] as const)("derives only fully covered career totals in %s", type => {
    const rows = normalizeHistoricalCareerData(fixture.raw, fixture.id)!.rows.filter(row => row.seasonType === type);
    const totals = sumHistoricalCareerTotals(rows);
    const regular = type === "Regular Season";
    expect(totals.GP).toBe(regular ? fixture.regularGP : fixture.playoffGP);
    expect(totals.PTS).toBe(regular ? fixture.regularPTS : fixture.playoffPTS);
    expect(totals.REB).toBe(regular ? fixture.regularREB : fixture.playoffREB);
    expect(historicalCareerAverage(totals, "PTS")).toBe(totals.PTS! / totals.GP!);
    for (const key of eraKeys) {
      expect(totals[key]).toBeNull();
      expect(historicalCareerAverage(totals, key)).toBeNull();
    }
    expect(historicalCareerPercentage(totals, "FG3")).toBeNull();
    expect(historicalCareerPercentage(totals, "FG")).toBe(totals.FGM! / totals.FGA! * 100);
  });
  it("keeps unavailable era fields null while preserving genuine recorded zeros", () => {
    const data = normalizeHistoricalCareerData(fixture.raw, fixture.id)!;
    for (const row of data.rows) {
      const year = Number(row.season.slice(0, 4));
      for (const key of ["STL", "BLK", "OREB", "DREB"] as const) if (year < 1973) {
        expect(row.totals[key]).toBeNull(); expect(row.eraUnavailableFields).toContain(key);
      }
      if (year < 1977) { expect(row.totals.TOV).toBeNull(); expect(row.eraUnavailableFields).toContain("TOV"); }
      if (year < 1979) for (const key of ["FG3M", "FG3A"] as const) {
        expect(row.totals[key]).toBeNull(); expect(row.eraUnavailableFields).toContain(key);
      }
    }
  });
});

it("computes Kareem coverage denominators by recorded field and competition", () => {
  const data = normalizeHistoricalCareerData(kareem, 76003)!;
  for (const type of ["Regular Season", "Playoffs"] as const) {
    const rows = data.rows.filter(row => row.seasonType === type);
    const coverage = historicalCareerEraCoverage(rows);
    expect(coverage).toHaveLength(7);
    for (const key of ["STL", "BLK", "OREB", "DREB"] as const) expect(coverage.find(row => row.key === key)?.recordedGames).toBe(type === "Regular Season" ? 1239 : 196);
    expect(coverage.find(row => row.key === "TOV")?.recordedGames).toBe(type === "Regular Season" ? 929 : 169);
    expect(coverage.find(row => row.key === "FG3A")?.recordedGames).toBe(type === "Regular Season" ? 787 : 158);
  }
  const firstThree = data.rows.find(row => row.season === "1979-80" && row.seasonType === "Regular Season")!;
  expect(firstThree.totals.FG3M).toBe(0); expect(firstThree.totals.FG3A).toBe(1);
  expect(historicalCareerPercentage(firstThree.totals, "FG3")).toBe(0);
  const noAttempts = data.rows.find(row => row.season === "1979-80" && row.seasonType === "Playoffs")!;
  expect(noAttempts.totals.FG3M).toBe(0); expect(noAttempts.totals.FG3A).toBe(0);
  expect(historicalCareerPercentage(noAttempts.totals, "FG3")).toBeNull();
  expect(data.rows.find(row => row.season === "1986-87" && row.seasonType === "Regular Season")?.totals.FG3M).toBe(1);
  expect(data.rows.some(row => row.seasonType === "Playoffs" && ["1974-75", "1975-76"].includes(row.season))).toBe(false);
});

it("preserves Wilt's historical teams and counts the traded season once", () => {
  const data = normalizeHistoricalCareerData(wilt, 76375)!;
  const regular = data.rows.filter(row => row.seasonType === "Regular Season");
  expect(regular.filter(row => row.season === "1964-65")).toHaveLength(1);
  expect(regular.find(row => row.season === "1964-65")).toMatchObject({ teamAbbreviation: "TOT", teamName: "Multiple teams", totals: { GP: 73, PTS: 2534 } });
  expect(regular.filter(row => row.teamAbbreviation === "PHW")).toHaveLength(3);
  expect(data.rows.filter(row => row.teamAbbreviation === "PHW").every(row => row.teamName === "Philadelphia Warriors")).toBe(true);
  expect(data.rows.filter(row => row.teamAbbreviation === "PHI").every(row => row.teamName === "Philadelphia 76ers")).toBe(true);
  expect(data.rows.some(row => row.seasonType === "Playoffs" && row.season === "1962-63")).toBe(false);
  expect(historicalCareerEraCoverage(regular).every(row => row.recordedSeasons === 0 && row.recordedGames === null)).toBe(true);
  expect(data.sources.find(source => source.url === "https://apbr.org/wilt.html")?.scope).toBe("playoffs-and-historical-team-labels");
  const doubled = structuredClone(wilt); doubled.rows.push({ ...doubled.rows.find(row => row.season === "1964-65")!, teamAbbreviation: "PHI" });
  expect(normalizeHistoricalCareerData(doubled, 76375)).toBeNull();
});

it("fails closed on inconsistent era metadata or an unapproved APBR source scope", () => {
  const zero = structuredClone(kareem); zero.rows[0].totals.STL = 0;
  expect(normalizeHistoricalCareerData(zero, 76003)).toBeNull();
  const wrong = structuredClone(wilt); wrong.sources[3].url = "https://apbr.org/unreviewed.html";
  expect(normalizeHistoricalCareerData(wrong, 76375)).toBeNull();
  const role = structuredClone(wilt); role.sources[3].role = "primary_selected_secondary_source";
  expect(normalizeHistoricalCareerData(role, 76375)).toBeNull();
  const name = structuredClone(wilt); name.rows[0].teamName = "";
  expect(normalizeHistoricalCareerData(name, 76375)).toBeNull();
});
