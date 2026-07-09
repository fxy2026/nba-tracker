import { describe, it, expect } from "vitest";
import { applyAnswer, EMPTY_QUIZ_STATS } from "./quizStats";

describe("applyAnswer — streak logic", () => {
  it("increments totalRight and curStreak on a correct answer", () => {
    const s = applyAnswer(EMPTY_QUIZ_STATS, true);
    expect(s.totalRight).toBe(1);
    expect(s.totalWrong).toBe(0);
    expect(s.curStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  it("increments totalWrong and resets curStreak to 0 on a wrong answer", () => {
    let s = applyAnswer(EMPTY_QUIZ_STATS, true);
    s = applyAnswer(s, true); // streak 2
    s = applyAnswer(s, false); // wrong
    expect(s.totalRight).toBe(2);
    expect(s.totalWrong).toBe(1);
    expect(s.curStreak).toBe(0);
    expect(s.bestStreak).toBe(2); // best is preserved across the reset
  });

  it("tracks bestStreak as the running max across multiple streaks", () => {
    let s: typeof EMPTY_QUIZ_STATS = EMPTY_QUIZ_STATS;
    for (let i = 0; i < 3; i++) s = applyAnswer(s, true); // streak 3
    s = applyAnswer(s, false); // reset
    for (let i = 0; i < 5; i++) s = applyAnswer(s, true); // streak 5
    expect(s.curStreak).toBe(5);
    expect(s.bestStreak).toBe(5);
  });

  it("does not lift bestStreak when a later streak is shorter", () => {
    let s: typeof EMPTY_QUIZ_STATS = EMPTY_QUIZ_STATS;
    for (let i = 0; i < 4; i++) s = applyAnswer(s, true); // best 4
    s = applyAnswer(s, false);
    s = applyAnswer(s, true); // streak 1
    expect(s.curStreak).toBe(1);
    expect(s.bestStreak).toBe(4);
  });

  it("does not mutate the input stats (pure)", () => {
    const before = { ...EMPTY_QUIZ_STATS };
    applyAnswer(EMPTY_QUIZ_STATS, true);
    expect(EMPTY_QUIZ_STATS).toEqual(before);
  });

  it("records the played date when one is provided, else keeps the prior", () => {
    const s = applyAnswer(EMPTY_QUIZ_STATS, true, "2026-07-09");
    expect(s.lastPlayedDate).toBe("2026-07-09");
    const s2 = applyAnswer(s, false); // no date → keep last
    expect(s2.lastPlayedDate).toBe("2026-07-09");
  });
});
