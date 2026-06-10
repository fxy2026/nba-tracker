import { describe, it, expect } from "vitest";
import { buildRecap } from "./recap";
import type { BoxScore, BoxScoreTeam, PlayerStats } from "./api";
import type { PlayAction } from "@/components/PlayByPlay";

const stats = (o: Partial<PlayerStats["statistics"]> = {}): PlayerStats["statistics"] => ({
  minutes: "PT34M00.00S",
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
  starter = "1"
): PlayerStats => ({
  personId: nextId++,
  name,
  nameI: name,
  position: "G",
  jerseyNum: "0",
  starter,
  oncourt: "0",
  played: "1",
  statistics: stats(s),
});

const periods = (scores: number[]) =>
  scores.map((score, i) => ({ period: i + 1, periodType: i < 4 ? "REGULAR" : "OVERTIME", score }));

const team = (o: Partial<BoxScoreTeam>): BoxScoreTeam => ({
  teamId: 1,
  teamTricode: "OKC",
  teamName: "Thunder",
  teamCity: "Oklahoma City",
  score: 0,
  players: [],
  statistics: {},
  periods: [],
  ...o,
});

const action = (o: Partial<PlayAction>): PlayAction => ({
  actionNumber: nextId++,
  clock: "PT06M00.00S",
  period: 1,
  teamTricode: "OKC",
  actionType: "2pt",
  subType: "Jump Shot",
  description: "Jump Shot",
  personId: 1,
  playerNameI: "S. Star",
  shotResult: "Made",
  scoreHome: "0",
  scoreAway: "0",
  ...o,
});

function makeBox(): BoxScore {
  return {
    gameId: "0022500999",
    gameCode: "20260115/INDOKC",
    gameStatus: 3,
    gameStatusText: "Final",
    gameTimeUTC: "2026-01-16T00:30:00Z",
    arena: { arenaName: "Paycom Center", arenaCity: "Oklahoma City", arenaState: "OK" },
    homeTeam: team({
      teamId: 1610612760,
      teamTricode: "OKC",
      teamName: "Thunder",
      teamCity: "Oklahoma City",
      score: 112,
      periods: periods([30, 32, 24, 26]),
      players: [
        player("S. Star", { points: 34, reboundsTotal: 8, assists: 9, fieldGoalsMade: 12, fieldGoalsAttempted: 22, threePointersMade: 4, threePointersAttempted: 9, freeThrowsMade: 6, freeThrowsAttempted: 7 }),
        player("J. Second", { points: 22, reboundsTotal: 5, assists: 3, fieldGoalsMade: 9, fieldGoalsAttempted: 16 }),
        player("R. Role", { points: 14, reboundsTotal: 6, assists: 2, fieldGoalsMade: 6, fieldGoalsAttempted: 10 }),
        player("B. Bench", { points: 26, reboundsTotal: 4, assists: 4, fieldGoalsMade: 10, fieldGoalsAttempted: 20 }, "0"),
      ],
    }),
    awayTeam: team({
      teamId: 1610612754,
      teamTricode: "IND",
      teamName: "Pacers",
      teamCity: "Indiana",
      score: 104,
      periods: periods([28, 22, 28, 26]),
      players: [
        player("T. Triple", { points: 25, reboundsTotal: 11, assists: 10, fieldGoalsMade: 10, fieldGoalsAttempted: 20 }),
        player("P. Pace", { points: 18, reboundsTotal: 3, assists: 5, fieldGoalsMade: 7, fieldGoalsAttempted: 14 }),
        player("D. Depth", { points: 4, reboundsTotal: 7, assists: 1, fieldGoalsMade: 2, fieldGoalsAttempted: 6 }, "0"),
      ],
    }),
  };
}

// A 9-0 home run to open, two lead changes, then a jump to the final score.
function makeActions(): PlayAction[] {
  return [
    action({ scoreHome: "2", scoreAway: "0" }),
    action({ scoreHome: "4", scoreAway: "0" }),
    action({ scoreHome: "6", scoreAway: "0" }),
    action({ actionType: "3pt", scoreHome: "9", scoreAway: "0" }),
    action({ teamTricode: "IND", playerNameI: "T. Triple", scoreHome: "9", scoreAway: "2" }),
    action({ teamTricode: "IND", playerNameI: "T. Triple", actionType: "3pt", scoreHome: "9", scoreAway: "5" }),
    action({ scoreHome: "11", scoreAway: "5" }),
    action({ teamTricode: "IND", playerNameI: "P. Pace", actionType: "3pt", period: 2, scoreHome: "11", scoreAway: "8" }),
    action({ teamTricode: "IND", playerNameI: "P. Pace", period: 2, scoreHome: "11", scoreAway: "10" }),
    action({ teamTricode: "IND", playerNameI: "T. Triple", period: 2, scoreHome: "11", scoreAway: "12" }),
    action({ period: 2, scoreHome: "13", scoreAway: "12" }),
    action({ period: 4, clock: "PT00M45.00S", scoreHome: "112", scoreAway: "104" }),
  ];
}

describe("buildRecap", () => {
  it("returns null for unfinished games", () => {
    const box = makeBox();
    box.gameStatus = 2;
    expect(buildRecap(box, makeActions())).toBeNull();
  });

  it("produces a structured recap in both locales", () => {
    const recap = buildRecap(makeBox(), makeActions());
    expect(recap).not.toBeNull();
    for (const r of [recap!.zh, recap!.en]) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.paragraphs.length).toBeGreaterThanOrEqual(2);
      expect(r.paragraphs.length).toBeLessThanOrEqual(4);
      for (const p of r.paragraphs) expect(p.length).toBeGreaterThan(0);
    }
    // Winner, score and star scorer must appear in the title
    expect(recap!.en.title).toContain("112-104");
    expect(recap!.en.title).toContain("S. Star");
    expect(recap!.zh.title).toContain("112-104");
    expect(recap!.zh.title).toContain("雷霆");
  });

  it("mentions the play-by-play turning point when actions are provided", () => {
    const recap = buildRecap(makeBox(), makeActions());
    const allEn = recap!.en.paragraphs.join(" ");
    const allZh = recap!.zh.paragraphs.join(" ");
    expect(allEn).toMatch(/9-0|9 unanswered/);
    expect(allZh).toMatch(/9-0|连得 9 分/);
  });

  it("is fully deterministic — same input twice gives identical output", () => {
    const a = buildRecap(makeBox(), makeActions());
    const b = buildRecap(makeBox(), makeActions());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("varies phrasing across different gameIds but stays stable per game", () => {
    const titles = new Set<string>();
    for (const id of ["0022500001", "0022500002", "0022500003", "0022500004", "0022500005", "0022500006"]) {
      const box = makeBox();
      box.gameId = id;
      titles.add(buildRecap(box, [])!.en.title);
    }
    // 3 title variants exist; six ids should hit more than one
    expect(titles.size).toBeGreaterThan(1);
  });

  it("never leaks 'undefined' or 'NaN' into the text", () => {
    for (const actions of [makeActions(), []]) {
      const recap = buildRecap(makeBox(), actions);
      const all = [recap!.zh.title, ...recap!.zh.paragraphs, recap!.en.title, ...recap!.en.paragraphs].join(" ");
      expect(all).not.toContain("undefined");
      expect(all).not.toContain("NaN");
    }
  });

  it("keeps title and opener stable without play-by-play (metadata reuses them)", () => {
    const withActions = buildRecap(makeBox(), makeActions())!;
    const withoutActions = buildRecap(makeBox(), [])!;
    expect(withoutActions.zh.title).toBe(withActions.zh.title);
    expect(withoutActions.en.title).toBe(withActions.en.title);
    expect(withoutActions.zh.paragraphs[0]).toBe(withActions.zh.paragraphs[0]);
    expect(withoutActions.en.paragraphs[0]).toBe(withActions.en.paragraphs[0]);
  });

  it("flags overtime in the title", () => {
    const box = makeBox();
    box.homeTeam.periods = periods([25, 25, 25, 25, 12]);
    box.awayTeam.periods = periods([25, 25, 25, 25, 4]);
    box.homeTeam.score = 112;
    box.awayTeam.score = 104;
    const recap = buildRecap(box, [])!;
    expect(recap.en.title.toLowerCase()).toContain("overtime");
    expect(recap.zh.title).toContain("加时");
  });
});
