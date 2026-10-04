import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import kobe from "@/data/historical-career-archives/977-2026-10-04.json";
import duncan from "@/data/historical-career-archives/1495-2026-10-04.json";
import { getHistoricalCareerArchive, validateHistoricalCareerArchive } from "./historical-career-archive";
import { historicalCareerAverage, historicalCareerPercentage, normalizeHistoricalCareerData, sumHistoricalCareerTotals } from "./historical-career-data";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = (archive: unknown, path: string, value: unknown): unknown => {
  const copy = structuredClone(archive) as Record<string, unknown>;
  const keys = path.split(".");
  let target = copy;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = value;
  return copy;
};
const fixtures = [
  { id: 977, archive: kobe, name: "Kobe Bryant", regular: 20, playoffs: 15, regularGP: 1346, playoffGP: 220, regularPTS: 33643, playoffPTS: 5640 },
  { id: 1495, archive: duncan, name: "Tim Duncan", regular: 19, playoffs: 18, regularGP: 1392, playoffGP: 251, regularPTS: 26496, playoffPTS: 5172 },
];

describe.each(fixtures)("$name historical archive", fixture => {
  it("loads all independently audited rows without promoting source authority", async () => {
    const data = await getHistoricalCareerArchive(fixture.id);
    expect(data?.playerName).toBe(fixture.name);
    expect(data?.retrievedAt).toBe("2026-10-04T03:31:48.000Z");
    expect(data?.rows.filter(row => row.seasonType === "Regular Season")).toHaveLength(fixture.regular);
    expect(data?.rows.filter(row => row.seasonType === "Playoffs")).toHaveLength(fixture.playoffs);
    expect(data?.rows.every(row => row.nbaPlayerId === fixture.id && row.sourceStatus === "secondary_source")).toBe(true);
    expect(data?.disputes).toHaveLength(fixture.archive.disputes.length);
    expect(JSON.stringify(data)).not.toMatch(/evidenceFile|evidenceSha256|sourceObservations|derivedFromTotals|perGame|publishedCareerTotals|corroborationRows|officialNbaVerified/);
    expect(validateHistoricalCareerArchive(fixture.archive, fixture.id, hash(fixture.archive))).toEqual(data);
    expect(validateHistoricalCareerArchive(changed(fixture.archive, "rows.0.totals.MIN", 1), fixture.id, hash(fixture.archive))).toBeNull();
  });
  it("aggregates exact counts separately and derives weighted rates from those counts", () => {
    const data = normalizeHistoricalCareerData(fixture.archive, fixture.id)!;
    const regular = sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Regular Season"));
    const playoffs = sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Playoffs"));
    expect(regular).toMatchObject({ GP: fixture.regularGP, PTS: fixture.regularPTS, MIN: null });
    expect(playoffs).toMatchObject({ GP: fixture.playoffGP, PTS: fixture.playoffPTS });
    expect(historicalCareerAverage(regular, "PTS")).toBe(fixture.regularPTS / fixture.regularGP);
    expect(historicalCareerAverage(playoffs, "PTS")).toBe(fixture.playoffPTS / fixture.playoffGP);
    expect(historicalCareerPercentage(regular, "FG")).toBe(regular.FGM! / regular.FGA! * 100);
    expect(historicalCareerAverage(regular, "MIN")).toBeNull();
  });
  it("keeps every quarantined total null and preserves all observed disagreements", () => {
    const data = normalizeHistoricalCareerData(fixture.archive, fixture.id)!;
    for (const [index, dispute] of fixture.archive.disputes.entries()) {
      expect(data.disputes[index].observations).toEqual(dispute.observations);
      expect(data.disputes[index].resolution).toBe(dispute.resolution);
      if (dispute.resolution === "quarantined_null") {
        const row = data.rows.find(row => row.season === dispute.season && row.seasonType === dispute.seasonType)!;
        expect(row.totals[dispute.field.slice(7) as keyof typeof row.totals]).toBeNull();
      }
    }
  });
});

it("preserves Kobe's missing minutes in both competitions, without inventing playoff seasons", () => {
  const data = normalizeHistoricalCareerData(kobe, 977)!;
  expect(data.rows.filter(row => row.totals.MIN === null).map(row => [row.season, row.seasonType])).toEqual([
    ["2002-03", "Regular Season"], ["2002-03", "Playoffs"],
  ]);
  expect(sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Playoffs"))).toMatchObject({ MIN: null, PLUS_MINUS: null });
  expect(data.rows.every(row => row.totals.PLUS_MINUS === null)).toBe(true);
  expect(data.rows.some(row => row.seasonType === "Playoffs" && ["2004-05", "2012-13", "2015-16"].includes(row.season))).toBe(false);
});

it("preserves Duncan's five regular-minute gaps, playoff PF gap, missing starts and decimal evidence", () => {
  const data = normalizeHistoricalCareerData(duncan, 1495)!;
  expect(data.rows.filter(row => row.seasonType === "Regular Season" && row.totals.MIN === null).map(row => row.season)).toEqual([
    "2002-03", "2003-04", "2005-06", "2006-07", "2008-09",
  ]);
  expect(sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Playoffs"))).toMatchObject({ GP: 251, MIN: 9370, PF: null, GS: null });
  expect(data.rows.every(row => row.totals.GS === null)).toBe(true);
  expect(data.disputes.some(dispute => dispute.field === "MIN" && dispute.observations.some(observation => observation.value === 2782.6))).toBe(true);
  expect(data.rows.some(row => row.seasonType === "Playoffs" && row.season === "1999-00")).toBe(false);
});

it("permits only the audited, player-specific partial official corroboration scope", () => {
  const data = normalizeHistoricalCareerData(kobe, 977)!;
  expect(data.sources.find(source => source.publisher === "NBA.com / Los Angeles Lakers")?.verifiedScope).toBe(kobe.sources[3].verifiedScope);
  for (const [path, value] of [
    ["sources.3.url", "https://www.nba.com/stats/player/977"],
    ["sources.3.role", "official_complete"], ["sources.3.verifiedScope", "All fields verified"],
    ["officialNbaVerified", true], ["rows.0.officialNbaVerified", true], ["sources.0.officialNbaVerified", true],
    ["sources.1.url", "https://basketball.realgm.com.evil.test/player/613"],
    ["sources.1.url", "https://user:pass@basketball.realgm.com/player/613"],
  ] as const) expect(normalizeHistoricalCareerData(changed(kobe, path, value), 977)).toBeNull();
});

it("rejects unsupported dispute fields, fractional count observations and false consensus", () => {
  const index = kobe.disputes.findIndex(dispute => dispute.field === "totals.BLK");
  const percentageIndex = kobe.disputes.findIndex(dispute => dispute.field === "percentages.FG_PCT");
  for (const [path, value] of [
    [`disputes.${index}.field`, "percentages.UNKNOWN"], [`disputes.${index}.field`, "totals.BLK.extra"],
    [`disputes.${index}.resolution`, "official_verified"], [`disputes.${index}.observations.0.value`, 40.5],
    [`disputes.${index}.observations.2.value`, 41], [`disputes.${index}.observations.2.sourceId`, "statmuse_kobe_totals"],
    [`disputes.${percentageIndex}.observations.0.value`, 44],
  ] as const) expect(normalizeHistoricalCareerData(changed(kobe, path, value), 977)).toBeNull();
  const quarantinedRow = kobe.rows.findIndex(row => row.season === "2002-03" && row.seasonType === "Regular Season");
  expect(normalizeHistoricalCareerData(changed(kobe, `rows.${quarantinedRow}.totals.MIN`, 3401), 977)).toBeNull();
});

it("never uses source-rounded averages, percentages or published totals for display", () => {
  const copy = structuredClone(kobe);
  copy.rows[0].percentages.FG_PCT = 0.99;
  const data = normalizeHistoricalCareerData(changed(copy, "rows.0.perGame", { PTS: 999 }), 977)!;
  expect(historicalCareerAverage(data.rows[0].totals, "PTS")).toBe(539 / 71);
  expect(historicalCareerPercentage(data.rows[0].totals, "FG")).toBe(176 / 422 * 100);
  expect(sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Regular Season")).MIN).toBeNull();
});
