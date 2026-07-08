import { describe, it, expect } from "vitest";
import { buildTeamDigests } from "./follow-digest";
import type { ScheduleDate, ScheduleGame } from "./api";
import type { SeasonSnapshot } from "./season-snapshot";

function side(tricode: string, teamId: number, score: number): ScheduleGame["homeTeam"] {
  return {
    teamId,
    teamTricode: tricode,
    teamName: tricode,
    teamCity: tricode,
    teamSlug: tricode.toLowerCase(),
    score,
    wins: 0,
    losses: 0,
    seed: 0,
  };
}

function game(o: {
  gameId: string;
  status: number;
  utc: string;
  home: [string, number, number];
  away: [string, number, number];
}): ScheduleGame {
  return {
    gameId: o.gameId,
    gameStatus: o.status,
    gameStatusText: o.status === 3 ? "Final" : o.status === 2 ? "Q1" : "7:00 pm ET",
    gameCode: "",
    gameDateTimeUTC: o.utc,
    homeTeam: side(o.home[0], o.home[1], o.home[2]),
    awayTeam: side(o.away[0], o.away[1], o.away[2]),
  };
}

const SNAPSHOT: SeasonSnapshot = {
  season: "2025-26",
  generatedAt: "2026-07-01T00:00:00.000Z",
  teams: [
    { tricode: "BOS", teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", wins: 61, losses: 21 },
    { tricode: "LAL", teamId: 1610612747, teamName: "Lakers", teamCity: "Los Angeles", wins: 50, losses: 32 },
  ],
  finishedGames: [
    { gameId: "0022500001", gameDate: "2025-10-21", homeTricode: "BOS", homeTeamId: 1610612738, homeScore: 120, awayTricode: "NYK", awayTeamId: 1610612752, awayScore: 110 },
    { gameId: "0042500401", gameDate: "2026-06-10", homeTricode: "LAL", homeTeamId: 1610612747, homeScore: 98, awayTricode: "BOS", awayTeamId: 1610612738, awayScore: 104 },
  ],
};

// A rolled-over feed: next season's scheduled games only, zero finished.
const flippedFeed: ScheduleDate[] = [
  {
    gameDate: "10/20/2026 00:00:00",
    games: [
      game({ gameId: "0022600001", status: 1, utc: "2026-10-21T00:00:00Z", home: ["BOS", 1610612738, 0], away: ["NYK", 1610612752, 0] }),
    ],
  },
];

describe("buildTeamDigests snapshot fallback", () => {
  it("falls back to snapshot record + last game when the feed has zero finished games", () => {
    const [bos] = buildTeamDigests(flippedFeed, ["BOS"], SNAPSHOT);
    expect(bos.archived).toBe(true);
    expect(bos.wins).toBe(61);
    expect(bos.losses).toBe(21);
    expect(bos.lastGame).toEqual({
      gameId: "0042500401",
      status: 3,
      dateUTC: "2026-06-10T12:00:00Z",
      home: false,
      opponentTricode: "LAL",
      opponentName: "Lakers",
      opponentTeamId: 1610612747,
      teamScore: 104,
      oppScore: 98,
      win: true,
    });
  });

  it("keeps nextGame on the live feed while archived", () => {
    const [bos] = buildTeamDigests(flippedFeed, ["BOS"], SNAPSHOT);
    expect(bos.archived).toBe(true);
    expect(bos.nextGame?.gameId).toBe("0022600001");
    expect(bos.nextGame?.opponentTricode).toBe("NYK");
  });

  it("stays live with no archived flag once the feed has finished games", () => {
    const liveFeed: ScheduleDate[] = [
      {
        gameDate: "10/20/2026 00:00:00",
        games: [
          game({ gameId: "0022600001", status: 3, utc: "2026-10-21T00:00:00Z", home: ["BOS", 1610612738, 112], away: ["NYK", 1610612752, 105] }),
        ],
      },
    ];
    const [bos] = buildTeamDigests(liveFeed, ["BOS"], SNAPSHOT);
    expect(bos.archived).toBeUndefined();
    expect(bos.wins).toBe(1);
    expect(bos.losses).toBe(0);
    expect(bos.lastGame?.gameId).toBe("0022600001");
  });

  it("degrades to 0-0 without archived when the team is missing from the snapshot", () => {
    const [orl] = buildTeamDigests([], ["ORL"], SNAPSHOT);
    expect(orl.archived).toBeUndefined();
    expect(orl.wins).toBe(0);
    expect(orl.losses).toBe(0);
    expect(orl.lastGame).toBeNull();
  });
});
