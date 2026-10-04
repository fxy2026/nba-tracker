import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import shaq from "@/data/historical-career-archives/406-2026-10-04.json";
import magic from "@/data/historical-career-archives/77142-2026-10-04.json";
import bird from "@/data/historical-career-archives/1449-2026-10-04.json";
import HistoricalPlayerCareer, { HistoricalCareerTable } from "@/components/player/HistoricalPlayerCareer";
import { getHistoricalCareerArchive } from "./historical-career-archive";
import { historicalCareerAverage, historicalCareerPercentage, normalizeHistoricalCareerData, sumHistoricalCareerTotals } from "./historical-career-data";

const fixtures = [
  { id: 406, name: "Shaquille O'Neal", archive: shaq, regular: 19, playoffs: 17, regularGP: 1207, playoffGP: 216, regularPTS: 28596, playoffPTS: 5250 },
  { id: 77142, name: "Magic Johnson", archive: magic, regular: 13, playoffs: 13, regularGP: 906, playoffGP: 190, regularPTS: 17707, playoffPTS: 3701 },
  { id: 1449, name: "Larry Bird", archive: bird, regular: 13, playoffs: 12, regularGP: 897, playoffGP: 164, regularPTS: 21791, playoffPTS: 3897 },
];
const changed = (archive: unknown, path: string, value: unknown): unknown => {
  const copy = structuredClone(archive) as Record<string, unknown>;
  const keys = path.split(".");
  let target = copy;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = value;
  return copy;
};

describe.each(fixtures)("$name next historical archive", fixture => {
  it("loads the pinned secondary source with truthful day precision", async () => {
    const data = await getHistoricalCareerArchive(fixture.id);
    expect(data).not.toBeNull();
    expect(data?.playerName).toBe(fixture.name);
    expect(data?.retrievedAt).toBe("2026-10-04");
    expect(data?.retrievalPrecision).toBe("day");
    expect(data?.rows.filter(row => row.seasonType === "Regular Season")).toHaveLength(fixture.regular);
    expect(data?.rows.filter(row => row.seasonType === "Playoffs")).toHaveLength(fixture.playoffs);
    expect(data?.rows.every(row => row.sourceStatus === "secondary_source" && row.retrievedAt === "2026-10-04")).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/evidenceFile|evidenceSha256|derivedFromTotals|perGame|sourceObservations|corroborationTeamSplits|publishedCareerTotals|officialNbaVerified/);
  });
  it("aggregates exact game and point counts while incomplete career categories remain null", () => {
    const data = normalizeHistoricalCareerData(fixture.archive, fixture.id)!;
    const regular = sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Regular Season"));
    const playoffs = sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === "Playoffs"));
    expect(regular).toMatchObject({ GP: fixture.regularGP, PTS: fixture.regularPTS, MIN: null, GS: null, PLUS_MINUS: null });
    expect(playoffs).toMatchObject({ GP: fixture.playoffGP, PTS: fixture.playoffPTS, GS: null, PLUS_MINUS: null });
    expect(historicalCareerAverage(regular, "PTS")).toBe(fixture.regularPTS / fixture.regularGP);
    expect(historicalCareerAverage(playoffs, "PTS")).toBe(fixture.playoffPTS / fixture.playoffGP);
    expect(historicalCareerAverage(regular, "MIN")).toBeNull();
    expect(historicalCareerAverage(regular, "PLUS_MINUS")).toBeNull();
    expect(historicalCareerAverage(playoffs, "PLUS_MINUS")).toBeNull();
  });
  it("retains all quarantined counts, derived-rate nulls and original observations", () => {
    const data = normalizeHistoricalCareerData(fixture.archive, fixture.id)!;
    expect(data.disputes).toHaveLength(fixture.archive.disputes.length);
    for (const [index, dispute] of fixture.archive.disputes.entries()) {
      expect(data.disputes[index].observations).toEqual(dispute.observations);
      expect(data.disputes[index].resolution).toBe(dispute.resolution);
      if (dispute.resolution !== "quarantined_null") continue;
      const row = data.rows.find(row => row.season === dispute.season && row.seasonType === dispute.seasonType)!;
      const [group, field] = dispute.field.split(".");
      if (group === "totals") expect(row.totals[field as keyof typeof row.totals]).toBeNull();
      else expect(historicalCareerPercentage(row.totals, field === "FG_PCT" ? "FG" : field === "FG3_PCT" ? "FG3" : "FT")).toBeNull();
    }
  });
  it.each(["en", "zh"] as const)("renders both competitions/modes and honest date labels in %s", locale => {
    const data = normalizeHistoricalCareerData(fixture.archive, fixture.id)!;
    for (const seasonType of ["Regular Season", "Playoffs"] as const) {
      for (const mode of ["per-game", "totals"] as const) {
        const html = renderToStaticMarkup(createElement(HistoricalCareerTable, { data, locale, seasonType, mode }));
        expect(html.match(/scope="row"/g)).toHaveLength((seasonType === "Regular Season" ? fixture.regular : fixture.playoffs) + 1);
        expect(html).toContain('role="region"');
        expect(html).not.toContain("NaN");
      }
    }
    const html = renderToStaticMarkup(createElement(HistoricalPlayerCareer, { data, locale }));
    expect(html).toContain(locale === "zh" ? "仅记录到日期" : "day precision");
    expect(html).toContain(locale === "zh" ? "未记录每次抓取的精确时间" : "without exact per-fetch times");
    expect(html).not.toContain("2026-10-04T00:00:00");
    expect(html).toContain(locale === "zh" ? "暂未解决，显示为 —" : "Unresolved; displayed as —");
    expect(html).not.toMatch(/<details[^>]*open/);
    if (fixture.id === 406) expect(html).toContain(locale === "zh" ? "出场数只计算一次" : "counted once");
  });
});

it("does not treat Shaq's partial plus-minus as full-career coverage", () => {
  const data = normalizeHistoricalCareerData(shaq, 406)!;
  for (const [seasonType, seasons, games, total] of [["Regular Season", 15, 912, 4887], ["Playoffs", 14, 180, 638]] as const) {
    const recorded = data.rows.filter(row => row.seasonType === seasonType && row.totals.PLUS_MINUS !== null);
    expect(recorded).toHaveLength(seasons);
    expect(sumHistoricalCareerTotals(recorded)).toMatchObject({ GP: games, PLUS_MINUS: total });
    expect(sumHistoricalCareerTotals(data.rows.filter(row => row.seasonType === seasonType)).PLUS_MINUS).toBeNull();
  }
});

it("counts Shaq's traded season once and preserves genuine zero-attempt shooting counts", () => {
  const data = normalizeHistoricalCareerData(shaq, 406)!;
  const traded = data.rows.filter(row => row.season === "2007-08" && row.seasonType === "Regular Season");
  expect(traded).toHaveLength(1);
  expect(traded[0]).toMatchObject({ teamAbbreviation: "TOT", totals: { GP: 61, PTS: 832, FG3M: 0, FG3A: 0 } });
  expect(historicalCareerPercentage(traded[0].totals, "FG3")).toBeNull();
  const copy = structuredClone(shaq);
  const source = copy.rows.find(row => row.season === "2007-08" && row.seasonType === "Regular Season")!;
  const split = structuredClone(source);
  split.teamAbbreviation = "MIA";
  split.totals.GP = 33;
  copy.rows.push(split);
  expect(normalizeHistoricalCareerData(copy, 406)).toBeNull();
});

it("keeps Magic/Bird career rates unknown wherever audited operands are quarantined", () => {
  const magicData = normalizeHistoricalCareerData(magic, 77142)!;
  const birdData = normalizeHistoricalCareerData(bird, 1449)!;
  const magicRegular = sumHistoricalCareerTotals(magicData.rows.filter(row => row.seasonType === "Regular Season"));
  expect(magicRegular).toMatchObject({ REB: null, DREB: null, AST: null, FGA: null, FG3A: null });
  expect(historicalCareerAverage(magicRegular, "AST")).toBeNull();
  expect(historicalCareerPercentage(magicRegular, "FG")).toBeNull();
  expect(historicalCareerPercentage(magicRegular, "FG3")).toBeNull();
  const birdPlayoffs = sumHistoricalCareerTotals(birdData.rows.filter(row => row.seasonType === "Playoffs"));
  expect(birdPlayoffs).toMatchObject({ AST: null, FTA: null });
  expect(historicalCareerPercentage(birdPlayoffs, "FT")).toBeNull();
  expect(magicData.rows.some(row => ["1991-92", "1992-93", "1993-94", "1994-95"].includes(row.season))).toBe(false);
  expect(birdData.rows.some(row => row.season === "1988-89" && row.seasonType === "Playoffs")).toBe(false);
});

it.each([
  ["retrievalTimePrecision", undefined], ["retrievalTimePrecision", "second"],
  ["retrievedAt", "2026-02-30"], ["sources.0.retrievedAt", "2026-02-30"],
  ["sources.0.retrievedAt", "2026-10-05"], ["rows.0.retrievedAt", "2026-10-04T00:00:00.000Z"],
])("rejects invalid or invented day-precision provenance at %s", (path, value) => {
  expect(normalizeHistoricalCareerData(changed(shaq, path, value), 406)).toBeNull();
});

it("rejects a quarantined percentage whose canonical shooting operands still produce a rate", () => {
  const copy = structuredClone(bird);
  const rowIndex = copy.rows.findIndex(row => row.season === "1985-86" && row.seasonType === "Playoffs");
  copy.rows[rowIndex].totals.FTA = 109;
  copy.disputes = copy.disputes.filter(dispute => !(dispute.season === "1985-86" && dispute.seasonType === "Playoffs" && dispute.field === "totals.FTA"));
  expect(normalizeHistoricalCareerData(copy, 1449)).toBeNull();
});
