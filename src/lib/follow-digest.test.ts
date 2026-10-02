import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

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
      game({ gameId: "0022600001", status: 1, utc: "2026-10-25T00:00:00Z", home: ["BOS", 1610612738, 0], away: ["NYK", 1610612752, 0] }),
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
      season: "2025-26",
      calendarDate: "2026-06-10",
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

  it("degrades to unavailable without archived when the team is missing from the snapshot", () => {
    const [orl] = buildTeamDigests([], ["ORL"], SNAPSHOT);
    expect(orl.archived).toBeUndefined();
    expect(orl.wins).toBeNull();
    expect(orl.losses).toBeNull();
    expect(orl.lastGame).toBeNull();
  });
});

const fixture = (id: string, home = "BOS", away = "NYK", status = 3, utc = "2026-10-21T00:00:00Z") => game({gameId:id,status,utc,home:[home,1610612738,110],away:[away,1610612752,100]});
it("mixed history cannot inflate current record, rank or streak", () => {
  const current = fixture("0022600001");
  const [team] = buildTeamDigests([{gameDate:"",games:[fixture("0022500001"),current,current]}],["BOS"],SNAPSHOT);
  expect(team).toMatchObject({wins:1,losses:0,recordSeason:"2026-27",streak:"W1",conferenceRank:1});
  expect(team.archived).toBeUndefined();
});
it("archive-only retains snapshot record and independent historical playoff result", () => {
  const [team] = buildTeamDigests([{gameDate:"",games:[fixture("0022500001"),fixture("0042500401")]}],["BOS"],SNAPSHOT);
  expect(team).toMatchObject({wins:61,losses:21,recordSeason:"2025-26",archived:true,conferenceRank:null,streak:""});
  expect(team.lastGame?.season).toBe("2025-26");
});
it("an unplayed team has no fabricated rank while historical result stays accessible", () => {
  const [team] = buildTeamDigests([{gameDate:"",games:[fixture("0022600001","LAL","NYK"),fixture("0042500401")]}],["BOS"],SNAPSHOT);
  expect(team).toMatchObject({wins:0,losses:0,recordSeason:"2026-27",conferenceRank:null,streak:""});
  expect(team.lastGame?.gameId).toBe("0042500401");
});
it("next game excludes past, invalid, tentative and TBD rows", () => {
  const past = fixture("0022600001","BOS","NYK",1);
  const tbd = {...fixture("0022600002","BOS","NYK",1,"2026-10-23T00:00:00Z"),gameStatusText:"TBD"};
  const tentative = {...fixture("0042600101","BOS","NYK",1,"2026-10-23T00:00:00Z"),ifNecessary:true};
  const next = fixture("0022600003","BOS","NYK",1,"2026-10-25T00:00:00Z");
  const [team] = buildTeamDigests([{gameDate:"",games:[past,tbd,tentative,next]}],["BOS"],null);
  expect(team.nextGame?.gameId).toBe(next.gameId);
  expect(buildTeamDigests([{gameDate:"",games:[past,tbd,tentative]}],["BOS"],null)[0].nextGame).toBeNull();
});

it("newer invalid or tied finals cannot replace an older valid result", () => {
  const valid = fixture("0022600001","BOS","NYK",3,"2026-10-20T00:00:00Z");
  const invalid = fixture("0022600002"); invalid.homeTeam.score = NaN;
  const tied = fixture("0022600003"); tied.homeTeam.score = tied.awayTeam.score;
  expect(buildTeamDigests([{gameDate:"",games:[valid,invalid,tied]}],["BOS"],null)[0].lastGame?.gameId).toBe(valid.gameId);
});
