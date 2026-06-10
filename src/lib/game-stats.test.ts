import { describe, it, expect } from "vitest";
import {
  getTopScorer,
  getSpecialPerformances,
  getLargestLead,
  getBiggestRun,
  getAstToRatio,
  getGameHero,
  getLeadChanges,
  getPaceLabel,
} from "./game-stats";
import type { BoxScoreTeam, PlayerStats, ShotAction } from "./api";

const stats = (o: Partial<PlayerStats["statistics"]> = {}): PlayerStats["statistics"] => ({
  minutes: "PT30M00.00S",
  points: 0,
  reboundsTotal: 0,
  reboundsOffensive: 0,
  reboundsDefensive: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  foulsPersonal: 0,
  fieldGoalsMade: 0,
  fieldGoalsAttempted: 0,
  fieldGoalsPercentage: 0,
  threePointersMade: 0,
  threePointersAttempted: 0,
  threePointersPercentage: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
  freeThrowsPercentage: 0,
  plusMinusPoints: 0,
  ...o,
});

let nextId = 1;
const player = (
  name: string,
  s: Partial<PlayerStats["statistics"]> = {},
  played = "1"
): PlayerStats => ({
  personId: nextId++,
  name,
  nameI: name,
  position: "G",
  jerseyNum: "0",
  starter: "0",
  oncourt: "0",
  played,
  statistics: stats(s),
});

const periods = (scores: number[]) =>
  scores.map((score, i) => ({ period: i + 1, periodType: i < 4 ? "REGULAR" : "OVERTIME", score }));

const team = (o: Partial<BoxScoreTeam> = {}): BoxScoreTeam => ({
  teamId: 1,
  teamTricode: "BOS",
  teamName: "Celtics",
  teamCity: "Boston",
  score: 0,
  players: [],
  statistics: {},
  periods: [],
  ...o,
});

const shot = (o: Partial<ShotAction> = {}): ShotAction => ({
  personId: 1,
  playerNameI: "J. Tatum",
  teamTricode: "BOS",
  period: 1,
  clock: "PT10M00.00S",
  actionType: "2pt",
  subType: "Jump Shot",
  shotResult: "Made",
  x: 10,
  y: 50,
  shotDistance: 10,
  description: "",
  ...o,
});

describe("getTopScorer", () => {
  it("returns null when no one played", () => {
    const t = team({ players: [player("A", { points: 20 }, "0"), player("B", { points: 15 }, "0")] });
    expect(getTopScorer(t)).toBeNull();
  });

  it("picks the max-points player among those who played, ignoring DNPs", () => {
    const t = team({
      players: [
        player("A", { points: 18 }),
        player("B", { points: 25 }),
        player("C", { points: 40 }, "0"),
      ],
    });
    expect(getTopScorer(t)?.nameI).toBe("B");
  });
});

describe("getSpecialPerformances", () => {
  it("flags 12pts/11reb/3ast as a double-double but not a triple-double", () => {
    const t = team({ players: [player("DD", { points: 12, reboundsTotal: 11, assists: 3 })] });
    expect(getSpecialPerformances(t)).toEqual([
      { name: "DD", isTriple: false, pts: 12, reb: 11, ast: 3 },
    ]);
  });

  it("flags 12pts/11reb/10ast as a triple-double", () => {
    const t = team({ players: [player("TD", { points: 12, reboundsTotal: 11, assists: 10 })] });
    const result = getSpecialPerformances(t);
    expect(result).toHaveLength(1);
    expect(result[0].isTriple).toBe(true);
  });

  it("counts exactly-10 blocks toward the threshold", () => {
    const t = team({ players: [player("Blk", { points: 10, blocks: 10 })] });
    expect(getSpecialPerformances(t)).toHaveLength(1);
  });

  it("excludes a 9-in-one-category line and DNP players with double-double numbers", () => {
    const t = team({
      players: [
        player("Close", { points: 22, reboundsTotal: 9, assists: 9 }),
        player("DNP", { points: 20, reboundsTotal: 10 }, "0"),
      ],
    });
    expect(getSpecialPerformances(t)).toEqual([]);
  });
});

describe("getLargestLead", () => {
  it("returns the max cumulative lead across period boundaries", () => {
    const home = team({ periods: periods([30, 20, 25, 25]) });
    const away = team({ periods: periods([20, 25, 25, 25]) });
    expect(getLargestLead(home, away)).toBe(10);
  });

  it("returns 0 for a team that never led", () => {
    const home = team({ periods: periods([30, 20, 25, 25]) });
    const away = team({ periods: periods([20, 25, 25, 25]) });
    expect(getLargestLead(away, home)).toBe(0);
  });
});

describe("getLeadChanges", () => {
  it("counts lead flips but not tie transitions", () => {
    const home = team({ periods: periods([30, 10, 15, 30]) });
    const away = team({ periods: periods([20, 25, 10, 20]) });
    // cumulative: home 30/40/55/85 vs away 20/45/55/75 -> home, away, tie, home
    expect(getLeadChanges(home, away)).toBe(2);
  });

  it("returns 0 for a wire-to-wire lead", () => {
    const home = team({ periods: periods([30, 25, 25, 25]) });
    const away = team({ periods: periods([20, 25, 25, 25]) });
    expect(getLeadChanges(home, away)).toBe(0);
  });
});

describe("getBiggestRun", () => {
  it("returns null for no shots", () => {
    expect(getBiggestRun([])).toBeNull();
  });

  it("finds a 7-point run broken by opposing makes, ignoring misses", () => {
    const shots = [
      shot({ teamTricode: "LAL", clock: "PT11M22.00S", shotDistance: 5 }),
      shot({ teamTricode: "BOS", clock: "PT09M45.00S", shotDistance: 5 }),
      shot({ teamTricode: "LAL", clock: "PT09M00.00S", shotResult: "Missed", shotDistance: 5 }),
      shot({ teamTricode: "BOS", clock: "PT08M30.00S", subType: "3PT", shotDistance: 22 }),
      shot({ teamTricode: "BOS", clock: "PT07M10.00S", shotDistance: 15 }),
      shot({ teamTricode: "LAL", clock: "PT05M00.00S", shotDistance: 8 }),
    ];
    expect(getBiggestRun(shots)).toEqual({ teamTricode: "BOS", points: 7, qLabel: "Q1" });
  });

  it("infers 3-pointers from shotDistance > 22 even without a 3pt subType", () => {
    const shots = [
      shot({ clock: "PT10M00.00S", shotDistance: 23 }),
      shot({ clock: "PT09M00.00S", shotDistance: 23 }),
    ];
    expect(getBiggestRun(shots)?.points).toBe(6);
  });

  it("returns null when the best run is under 4 points", () => {
    const shots = [
      shot({ teamTricode: "BOS", clock: "PT10M00.00S", subType: "3PT", shotDistance: 24 }),
      shot({ teamTricode: "LAL", clock: "PT08M00.00S", subType: "3PT", shotDistance: 24 }),
    ];
    expect(getBiggestRun(shots)).toBeNull();
  });

  it("labels overtime runs OT1", () => {
    const shots = [
      shot({ period: 5, clock: "PT04M00.00S", shotDistance: 5 }),
      shot({ period: 5, clock: "PT02M00.00S", shotDistance: 5 }),
    ];
    expect(getBiggestRun(shots)).toEqual({ teamTricode: "BOS", points: 4, qLabel: "OT1" });
  });

  it("sorts shots chronologically before detecting runs", () => {
    // input order would yield a fake LAL 6-0 run; chronological order is LAL, BOS x3, LAL
    const shots = [
      shot({ teamTricode: "LAL", clock: "PT11M00.00S", subType: "3PT", shotDistance: 25 }),
      shot({ teamTricode: "LAL", clock: "PT05M00.00S", subType: "3PT", shotDistance: 25 }),
      shot({ teamTricode: "BOS", clock: "PT10M00.00S", shotDistance: 5 }),
      shot({ teamTricode: "BOS", clock: "PT09M00.00S", shotDistance: 5 }),
      shot({ teamTricode: "BOS", clock: "PT08M00.00S", shotDistance: 5 }),
    ];
    expect(getBiggestRun(shots)).toEqual({ teamTricode: "BOS", points: 6, qLabel: "Q1" });
  });
});

describe("getAstToRatio", () => {
  it("returns '-' when the team has no turnovers", () => {
    const t = team({ players: [player("A", { assists: 12, turnovers: 0 })] });
    expect(getAstToRatio(t)).toBe("-");
  });

  it("formats the ratio to 2 decimals, excluding DNP stat lines", () => {
    const t = team({
      players: [
        player("A", { assists: 14, turnovers: 5 }),
        player("B", { assists: 10, turnovers: 3 }),
        player("DNP", { assists: 0, turnovers: 100 }, "0"),
      ],
    });
    expect(getAstToRatio(t)).toBe("3.00");
  });
});

describe("getGameHero", () => {
  it("weights rebounds and assists so 20/10/10 beats 30/2/2 across teams", () => {
    const home = team({ players: [player("Scorer", { points: 30, reboundsTotal: 2, assists: 2 })] });
    const away = team({ players: [player("Stuffer", { points: 20, reboundsTotal: 10, assists: 10 })] });
    expect(getGameHero(home, away)?.nameI).toBe("Stuffer");
  });

  it("returns null when nobody played", () => {
    const home = team({ players: [player("A", { points: 20 }, "0")] });
    const away = team({ players: [] });
    expect(getGameHero(home, away)).toBeNull();
  });
});

describe("getPaceLabel", () => {
  it("labels 230 combined points over 4 periods as Fast Pace", () => {
    const home = team({ score: 120, periods: periods([30, 30, 30, 30]) });
    const away = team({ score: 110, periods: periods([28, 28, 27, 27]) });
    expect(getPaceLabel(home, away)).toMatchObject({ label: "Fast Pace", pacePerQ: 57.5 });
  });

  it("labels 170 combined points as Slow", () => {
    const home = team({ score: 88, periods: periods([22, 22, 22, 22]) });
    const away = team({ score: 82, periods: periods([21, 21, 20, 20]) });
    expect(getPaceLabel(home, away)).toMatchObject({ label: "Slow", pacePerQ: 42.5 });
  });

  it("labels 200 combined points as Normal", () => {
    const home = team({ score: 102, periods: periods([26, 26, 25, 25]) });
    const away = team({ score: 98, periods: periods([25, 25, 24, 24]) });
    expect(getPaceLabel(home, away)).toMatchObject({ label: "Normal", pacePerQ: 50 });
  });

  it("treats the 55 and 45 boundaries as Normal", () => {
    const t220 = [team({ score: 110, periods: periods([28, 28, 27, 27]) }), team({ score: 110, periods: periods([28, 28, 27, 27]) })] as const;
    const t180 = [team({ score: 90, periods: periods([23, 23, 22, 22]) }), team({ score: 90, periods: periods([23, 23, 22, 22]) })] as const;
    expect(getPaceLabel(t220[0], t220[1]).label).toBe("Normal");
    expect(getPaceLabel(t180[0], t180[1]).label).toBe("Normal");
  });
});
