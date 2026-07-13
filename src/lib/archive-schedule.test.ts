import { describe, it, expect } from "vitest";
import archive from "@/data/schedule-2025-26.json";

const TRICODES = new Set(
  "ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split(" ")
);

const feed = archive as unknown as {
  seasonYear: string;
  dates: { gameDate: string; games: Record<string, unknown>[] }[];
};
const games = feed.dates.flatMap((d) => d.games) as {
  gameId: string;
  gameStatus: number;
  gameCode: string;
  gameDateTimeUTC: string;
  homeTeam: { teamId: number; teamTricode: string; score: number };
  awayTeam: { teamId: number; teamTricode: string; score: number };
}[];

describe("baked 2025-26 archive schedule", () => {
  it("covers the season", () => {
    expect(feed.seasonYear).toBe("2025");
    expect(games.length).toBeGreaterThan(1300);
    const regular = games.filter((g) => g.gameId.startsWith("00225"));
    expect(regular.length).toBeGreaterThan(1150);
    const playoffs = games.filter((g) => g.gameId.startsWith("00425"));
    expect(playoffs.length).toBe(85);
  });

  it("has unique 10-char gameIds", () => {
    const ids = games.map((g) => g.gameId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d{10}$/);
  });

  it("only contains finished games with real teams and scores", () => {
    for (const g of games) {
      expect(g.gameStatus).toBe(3);
      expect(TRICODES.has(g.homeTeam.teamTricode)).toBe(true);
      expect(TRICODES.has(g.awayTeam.teamTricode)).toBe(true);
      expect(g.homeTeam.teamId).toBeGreaterThan(1610612700);
      expect(g.homeTeam.score).toBeGreaterThan(50);
      expect(g.awayTeam.score).toBeGreaterThan(50);
      expect(g.gameCode).toMatch(/^\d{8}\/[A-Z]{6}$/);
      expect(g.gameDateTimeUTC).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });

  it("dates use the schedule feed key format", () => {
    for (const d of feed.dates) {
      expect(d.gameDate).toMatch(/^\d{2}\/\d{2}\/\d{4} 00:00:00$/);
      expect(d.games.length).toBeGreaterThan(0);
    }
  });

  it("includes the finals series under real playoff ids", () => {
    const finals = games.filter((g) => g.gameId.startsWith("00425004"));
    expect(finals.length).toBeGreaterThanOrEqual(4);
    expect(finals.every((g) => g.gameId.slice(0, 9) === finals[0].gameId.slice(0, 9))).toBe(true);
  });
});
