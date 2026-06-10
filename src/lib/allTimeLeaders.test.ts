import { describe, it, expect } from "vitest";
import { ALL_TIME_LEADERS, getLeaderboard } from "@/lib/allTimeLeaders";

describe("getLeaderboard", () => {
  it("returns the ppg top 5 sorted desc with Michael Jordan first", () => {
    const board = getLeaderboard("ppg", 5);
    expect(board).toHaveLength(5);
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1]._value).toBeGreaterThanOrEqual(board[i]._value);
    }
    expect(board[0].name).toBe("Michael Jordan");
    expect(board[0]._value).toBeCloseTo(30.12, 2);
  });

  it("excludes entries missing the requested category", () => {
    const board = getLeaderboard("totalBlk", 50);
    expect(board.every((p) => (p.totalBlk ?? 0) > 0)).toBe(true);
    expect(board.length).toBeLessThan(ALL_TIME_LEADERS.length);
    expect(board.some((p) => p.name === "Stephen Curry")).toBe(false);
  });

  it("computes tenure as toYear - fromYear + 1", () => {
    const board = getLeaderboard("tenure", 50);
    for (const p of board) {
      expect(p._value).toBe(p.toYear - p.fromYear + 1);
      expect(p._seasons).toBe(p._value);
    }
  });

  it("defaults to a limit of 25", () => {
    expect(getLeaderboard("ppg")).toHaveLength(25);
  });
});

describe("ALL_TIME_LEADERS dataset invariants", () => {
  it("has a non-empty name, valid year span, and positive ppg/rpg/apg for every entry", () => {
    for (const p of ALL_TIME_LEADERS) {
      expect(p.name.trim().length, p.name).toBeGreaterThan(0);
      expect(p.fromYear, p.name).toBeLessThan(p.toYear);
      expect(p.ppg, p.name).toBeGreaterThan(0);
      expect(p.rpg, p.name).toBeGreaterThan(0);
      expect(p.apg, p.name).toBeGreaterThan(0);
    }
  });

  it("gives every active player a real personId and the current toYear", () => {
    const actives = ALL_TIME_LEADERS.filter((p) => p.active);
    expect(actives.length).toBeGreaterThan(0);
    const maxYear = Math.max(...actives.map((p) => p.toYear));
    for (const p of actives) {
      expect(p.personId, p.name).toBeGreaterThan(0);
      expect(p.toYear, p.name).toBe(maxYear);
    }
  });

  it("has unique names and unique non-zero personIds", () => {
    const names = ALL_TIME_LEADERS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    const ids = ALL_TIME_LEADERS.map((p) => p.personId).filter((id) => id > 0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
