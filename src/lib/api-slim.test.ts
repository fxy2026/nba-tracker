import { describe, it, expect } from "vitest";
import {
  projectScheduleGame,
  projectScheduleDates,
  type RawScheduleGame,
  type RawScheduleTeam,
  type RawScheduleDate,
} from "./api";

function rawTeam(tricode: string, id: number, extra: Record<string, unknown> = {}): RawScheduleTeam {
  return {
    teamId: id,
    teamTricode: tricode,
    teamName: "Team",
    teamCity: "City",
    teamSlug: "team",
    score: 112,
    wins: 50,
    losses: 32,
    seed: 3,
    ...extra,
  };
}

function rawGame(extra: Partial<RawScheduleGame> = {}): RawScheduleGame {
  return {
    gameId: "0022500001",
    gameStatus: 3,
    gameStatusText: "Final",
    gameCode: "20251021/GSWLAL",
    gameDateTimeUTC: "2025-10-22T02:00:00Z",
    homeTeam: rawTeam("LAL", 1610612747, { inBonus: null, timeoutsRemaining: 2 }),
    awayTeam: rawTeam("GSW", 1610612744),
    seriesText: "",
    ifNecessary: false,
    broadcasters: { nationalBroadcasters: [{ broadcasterDisplay: "ESPN" }] },
    gameLabel: "",
    gameSubLabel: "",
    seriesGameNumber: "",
    weekNumber: 5,
    postponedStatus: "A",
    gameSubtype: "",
    ...extra,
  };
}

describe("projectScheduleGame", () => {
  it("keeps exactly the declared ScheduleGame keys and drops raw-feed noise", () => {
    const out = projectScheduleGame(rawGame());
    expect(Object.keys(out).sort()).toEqual(
      ["awayTeam", "gameCode", "gameDateTimeUTC", "gameId", "gameStatus", "gameStatusText", "homeTeam", "ifNecessary", "seriesText"].sort()
    );
    expect(Object.keys(out.homeTeam).sort()).toEqual(
      ["losses", "score", "seed", "teamCity", "teamId", "teamName", "teamSlug", "teamTricode", "wins"].sort()
    );
  });

  it("preserves team periods when present and omits the key when absent", () => {
    const g = rawGame();
    g.homeTeam.periods = [{ period: 1, periodType: "REGULAR", score: 28 }];
    const out = projectScheduleGame(g);
    expect(out.homeTeam.periods).toEqual([{ period: 1, periodType: "REGULAR", score: 28 }]);
    expect("periods" in out.awayTeam).toBe(false);
  });

  it("projects pointsLeaders entries down to the declared PointsLeader keys", () => {
    const out = projectScheduleGame(
      rawGame({
        pointsLeaders: [
          { personId: 2544, firstName: "LeBron", lastName: "James", teamId: 1610612747, teamTricode: "LAL", points: 32, teamName: "Lakers", teamCity: "Los Angeles" },
        ],
      })
    );
    expect(out.pointsLeaders).toEqual([
      { personId: 2544, firstName: "LeBron", lastName: "James", teamId: 1610612747, teamTricode: "LAL", points: 32 },
    ]);
  });

  it("omits pointsLeaders when the feed sends null instead of an array", () => {
    const out = projectScheduleGame(
      rawGame({ pointsLeaders: null as unknown as RawScheduleGame["pointsLeaders"] })
    );
    expect("pointsLeaders" in out).toBe(false);
  });

  it("passes through declared optional arena fields for pre-game previews", () => {
    const out = projectScheduleGame(rawGame({ arenaName: "Crypto.com Arena", arenaCity: "Los Angeles" }));
    expect(out.arenaName).toBe("Crypto.com Arena");
    expect(out.arenaCity).toBe("Los Angeles");
  });
});

describe("projectScheduleDates", () => {
  it("maps gameDate + games and drops date-level extras", () => {
    const out = projectScheduleDates([
      { gameDate: "10/21/2025 00:00:00", games: [rawGame()], leagueId: "00" },
    ]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(["gameDate", "games"]);
    expect(out[0].games[0].gameId).toBe("0022500001");
  });

  it("keeps a full 1300-game season under 2MB when serialized", () => {
    const dates: RawScheduleDate[] = Array.from({ length: 163 }, (_, d) => ({
      gameDate: "10/21/2025 00:00:00",
      games: Array.from({ length: 8 }, (_, i) =>
        rawGame({
          gameId: `00225${String(d * 8 + i).padStart(5, "0")}`,
          pointsLeaders: [
            { personId: 2544, firstName: "LeBron", lastName: "James", teamId: 1610612747, teamTricode: "LAL", points: 32 },
          ],
        })
      ),
    }));
    const projected = projectScheduleDates(dates);
    expect(projected.reduce((n, gd) => n + gd.games.length, 0)).toBe(1304);
    expect(JSON.stringify(projected).length).toBeLessThan(2 * 1024 * 1024);
  });
});
