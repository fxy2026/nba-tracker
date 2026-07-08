import { describe, it, expect } from "vitest";
import { SEASON_SNAPSHOT } from "./season-snapshot";
import { finalsResult, seasonRecordExtremes, seasonBestGames } from "./season-recap";

describe("finalsResult", () => {
  const r = finalsResult(SEASON_SNAPSHOT);

  it("derives the 2025-26 champion and runner-up from the snapshot finals games", () => {
    expect(r.champion).toBe("New York Knicks");
    expect(r.runnerUp).toBe("San Antonio Spurs");
    expect(r.championTricode).toBe("NYK");
    expect(r.runnerUpTricode).toBe("SAS");
  });

  it("reports the series result and a 5-game list", () => {
    expect(r.seriesText).toBe("4-1");
    expect(r.games.length).toBe(5);
  });

  it("orders finals games chronologically", () => {
    const dates = r.games.map((g) => g.gameDate);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("seasonRecordExtremes", () => {
  const e = seasonRecordExtremes(SEASON_SNAPSHOT);

  it("counts regular + playoff games only", () => {
    expect(e.totalGames).toBeGreaterThan(1000);
  });

  it("finds a plausible highest team score", () => {
    expect(e.highestTeamScore).not.toBeNull();
    expect(e.highestTeamScore!.value).toBeGreaterThanOrEqual(150);
    expect(e.highestTeamScore!.value).toBeLessThanOrEqual(200);
  });

  it("finds a plausible lowest team score", () => {
    expect(e.lowestTeamScore!.value).toBeGreaterThanOrEqual(50);
    expect(e.lowestTeamScore!.value).toBeLessThanOrEqual(85);
  });

  it("finds a plausible largest margin and highest combined", () => {
    expect(e.largestMargin!.value).toBeGreaterThanOrEqual(30);
    expect(e.highestCombined!.value).toBeGreaterThanOrEqual(280);
  });
});

describe("seasonBestGames", () => {
  const b = seasonBestGames(SEASON_SNAPSHOT);

  it("returns up to 5 closest and 5 highest-scoring games", () => {
    expect(b.closest.length).toBe(5);
    expect(b.highestScoring.length).toBe(5);
  });

  it("closest games are ordered by ascending margin", () => {
    expect(b.closest[0].margin).toBeLessThanOrEqual(b.closest[4].margin);
    expect(b.closest[0].margin).toBeLessThanOrEqual(2);
  });

  it("highest-scoring games are ordered by descending total", () => {
    expect(b.highestScoring[0].total).toBeGreaterThanOrEqual(b.highestScoring[4].total);
    expect(b.highestScoring[0].total).toBeGreaterThanOrEqual(280);
  });
});
