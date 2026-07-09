// localStorage-backed lifetime quiz stats: cumulative right/wrong counts, the
// current consecutive-correct streak and the best-ever streak, plus a marker
// for which ET calendar date the once-a-day challenge was last completed (so it
// can't be farmed). Mirrors the SSR-guarded read/write idiom in favorites.ts /
// recentlyViewed.ts: every accessor no-ops during the server render and
// swallows JSON / storage errors.

export interface QuizStats {
  totalRight: number;
  totalWrong: number;
  curStreak: number;
  bestStreak: number;
  lastPlayedDate: string; // ET date string of the most recent answer
  playedDailyOn: string; // ET date string the daily challenge was last completed
}

const KEY = "nba-tracker-quiz-stats";

// Shared zero-state. Safe to use as a React useState initial value: applyAnswer
// / recordAnswer never mutate their input, they always return a fresh object.
export const EMPTY_QUIZ_STATS: QuizStats = {
  totalRight: 0,
  totalWrong: 0,
  curStreak: 0,
  bestStreak: 0,
  lastPlayedDate: "",
  playedDailyOn: "",
};

export function readQuizStats(): QuizStats {
  if (typeof window === "undefined") return { ...EMPTY_QUIZ_STATS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_QUIZ_STATS };
    const parsed = JSON.parse(raw) as Partial<QuizStats>;
    // Merge over the empty template so a partial/legacy blob never yields NaN.
    return { ...EMPTY_QUIZ_STATS, ...parsed };
  } catch {
    return { ...EMPTY_QUIZ_STATS };
  }
}

function write(stats: QuizStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* storage full or disabled — silently ignore */
  }
}

// Pure reducer: fold one answer into the stats. Streak = consecutive correct
// answers; a wrong answer resets curStreak to 0. bestStreak is the running max.
// Exported (and free of any localStorage touch) so the streak logic is unit
// testable in isolation.
export function applyAnswer(prev: QuizStats, correct: boolean, date = ""): QuizStats {
  const curStreak = correct ? prev.curStreak + 1 : 0;
  return {
    ...prev,
    totalRight: prev.totalRight + (correct ? 1 : 0),
    totalWrong: prev.totalWrong + (correct ? 0 : 1),
    curStreak,
    bestStreak: Math.max(prev.bestStreak, curStreak),
    lastPlayedDate: date || prev.lastPlayedDate,
  };
}

// Persisted variant of applyAnswer: read → fold → write → return the new stats.
export function recordAnswer(correct: boolean, date = ""): QuizStats {
  const next = applyAnswer(readQuizStats(), correct, date);
  write(next);
  return next;
}

// Stamp today's ET date as the day the daily challenge was played, so it locks
// until tomorrow. Returns the updated stats.
export function markDailyPlayed(date: string): QuizStats {
  const next = { ...readQuizStats(), playedDailyOn: date };
  write(next);
  return next;
}
