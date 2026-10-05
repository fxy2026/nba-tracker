import { describe, expect, it } from "vitest";
import jordan from "@/data/historical-career-archives/893-2026-10-04.json";
import wilt from "@/data/historical-career-archives/76375-2026-10-04.json";
import { normalizeHistoricalCareerData } from "./historical-career-data";
import { normalizePlayerCareerData, type CareerSeasonRow } from "./player-career-data";
import { careerSeasonStats, historicalSeasonStats, selectPlayerSeason } from "./player-season-stats";

const row: CareerSeasonRow = { SEASON_ID: "2025-26", TEAM_ABBREVIATION: "LAL", GP: 70, MIN: 30, PTS: 20, REB: 5, AST: 6, STL: 1, BLK: 0, FG_PCT: .5, FG3_PCT: 0, FT_PCT: null, FGA: 18, FG3A: 1 };

it("keeps API per-game values unchanged, retaining unknowns and genuine zeros", () => {
  const result = careerSeasonStats(row);
  expect(result.stats).toMatchObject({ GP: 70, MIN: 30, PTS: 20, BLK: 0, FGM: null, FGA: 18, GS: null, TOV: null });
  expect(result.percentages).toEqual({ FG: 50, FG3: 0, FT: null });
  expect(careerSeasonStats({ ...row, FG3A: 0 }).percentages.FG3).toBeNull();
});

it("chooses the latest recorded season and provided TOT without adding team splits", () => {
  const rows = [row, { ...row, TEAM_ABBREVIATION: "TOT", GP: 80 }, { ...row, TEAM_ABBREVIATION: "CLE", GP: 10 }, { ...row, SEASON_ID: "2024-25", PTS: 25 }].map(careerSeasonStats);
  expect(selectPlayerSeason(rows).seasons).toEqual(["2025-26", "2024-25"]);
  expect(selectPlayerSeason(rows).row?.stats.GP).toBe(80);
  expect(selectPlayerSeason(rows, "2025-26", "CLE").row?.stats.GP).toBe(10);
  expect(selectPlayerSeason(rows, "2024-25", "TOT").row?.stats.PTS).toBe(25);
  expect(selectPlayerSeason(rows, "unknown").row?.team).toBe("TOT");
  expect(selectPlayerSeason([]).row).toBeUndefined();
});

it("never synthesizes all-team averages when the provider supplies only stints", () => {
  const rows = [row, { ...row, TEAM_ABBREVIATION: "CLE", PTS: 32 }].map(careerSeasonStats);
  const result = selectPlayerSeason(rows);
  expect(result.teams).toHaveLength(2);
  expect(result.row?.team).toBe("LAL");
  expect(result.row?.stats.PTS).toBe(20);
});

it("derives historical per-game statistics and percentages from exact season totals", () => {
  const data = normalizeHistoricalCareerData(jordan, 893)!;
  const source = data.rows.find(row => row.season === "1984-85" && row.seasonType === "Regular Season")!;
  const result = historicalSeasonStats(source);
  expect(result.stats.PTS).toBe(source.totals.PTS! / source.totals.GP!);
  expect(result.stats.FGM).toBe(source.totals.FGM! / source.totals.GP!);
  expect(result.stats.GS).toBe(source.totals.GS);
  expect(result.percentages.FG).toBe(source.totals.FGM! / source.totals.FGA! * 100);
  const disputed = data.rows.find(row => row.season === "2001-02")!;
  expect(historicalSeasonStats(disputed).stats.MIN).toBeNull();
});

it("preserves early-era missing fields and historical team identity", () => {
  const data = normalizeHistoricalCareerData(wilt, 76375)!;
  const source = data.rows.find(row => row.teamAbbreviation === "PHW")!;
  const result = historicalSeasonStats(source);
  expect(result.team).toBe("PHW");
  expect(result.teamName).toBe(source.teamName);
  expect(result.stats.STL).toBeNull();
  expect(result.stats.BLK).toBeNull();
  expect(result.percentages.FG3).toBeNull();
});

describe("optional career columns are validated before reaching detail cards", () => {
  it("accepts source values and explicit missing values without filling gaps", () => {
    const raw = { careerSeasons: [{ ...row, FGM: 9, FG3M: 0, FTM: null, GS: 60, TOV: 2.1, PF: 1.8, OREB: 0, DREB: null }] };
    expect(normalizePlayerCareerData(raw)).toEqual(raw);
  });
  it.each([
    { FGM: "9" }, { FGM: 19 }, { FG3M: 2 }, { GS: 71 }, { GS: .5 }, { TOV: Infinity }, { PF: -1 }, { OREB: NaN }, { DREB: "--" },
  ])("rejects malformed optional fields %j", extra => {
    expect(normalizePlayerCareerData({ careerSeasons: [{ ...row, ...extra }] })).toBeNull();
  });
});
