import type { PlayAction } from "@/components/PlayByPlay";

export interface ScorePair { scoreHome: number; scoreAway: number }
export interface ScoringRun extends ScorePair {
  teamTricode: string;
  points: number;
  period: number;
  clock: string;
}

export function readScorePair(action: Pick<PlayAction, "scoreHome" | "scoreAway">): ScorePair | null {
  if (typeof action.scoreHome !== "string" || typeof action.scoreAway !== "string") return null;
  if (!/^\d+$/.test(action.scoreHome) || !/^\d+$/.test(action.scoreAway)) return null;
  const scoreHome = Number(action.scoreHome), scoreAway = Number(action.scoreAway);
  if (!Number.isSafeInteger(scoreHome) || !Number.isSafeInteger(scoreAway)) return null;
  return { scoreHome, scoreAway };
}

function remainingSeconds(clock: string): number | null {
  const match = /^PT(\d+)M([\d.]+)S$/.exec(clock) ?? /^(\d+):([\d.]+)$/.exec(clock);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(seconds) ? seconds : null;
}

export function chronologicalActions(actions: PlayAction[]): PlayAction[] {
  const timed = actions.map((action) => ({ action, remaining: remainingSeconds(action.clock) }));
  // Unknown time must not be relocated past a gap, creating false continuity.
  if (timed.some((entry) => entry.remaining === null)) return actions;
  return timed.sort((a, b) => a.action.period - b.action.period || b.remaining! - a.remaining! || a.action.actionNumber - b.action.actionNumber).map((entry) => entry.action);
}

export function getScoringChange(action: PlayAction, previous: ScorePair, score: ScorePair): { side: "home" | "away"; points: number } | null {
  const homeDelta = score.scoreHome - previous.scoreHome;
  const awayDelta = score.scoreAway - previous.scoreAway;
  const side = homeDelta > 0 && awayDelta === 0 ? "home" : awayDelta > 0 && homeDelta === 0 ? "away" : null;
  const points = side === "home" ? homeDelta : awayDelta;
  const expected = action.actionType === "freethrow" ? 1 : action.actionType === "2pt" ? 2 : action.actionType === "3pt" ? 3 : null;
  return side && action.shotResult === "Made" && expected === points && action.teamTricode ? { side, points } : null;
}

// Scores are cumulative; only the newest verified delta belongs to this event.
// No inferred opening 0-0, no distance-based shot values, and no point recovery
// across missing scores. Unanswered runs can continue across quarter breaks.
export function getScoringRuns(actions: PlayAction[], minimumPoints = 8): ScoringRun[] {
  const runs: ScoringRun[] = [];
  let previous: ScorePair | null = null;
  let current: ScoringRun | null = null;
  let currentPoints = 0;
  let currentSide: "home" | "away" | null = null;
  const finish = () => {
    if (current && current.points >= minimumPoints) runs.push(current);
    current = null;
    currentPoints = 0;
    currentSide = null;
  };

  for (const action of chronologicalActions(actions)) {
    const score = readScorePair(action);
    if (!score) { finish(); previous = null; continue; }
    if (!previous) { previous = score; continue; }
    const homeDelta = score.scoreHome - previous.scoreHome;
    const awayDelta = score.scoreAway - previous.scoreAway;
    const change = getScoringChange(action, previous, score);
    previous = score;
    // A retrospective correction can revoke points already counted. Wait for
    // a consistent feed rather than publish claims based on corrected totals.
    if (homeDelta < 0 || awayDelta < 0) return [];
    if (homeDelta === 0 && awayDelta === 0) continue;
    if (!change) { finish(); continue; }
    const { side, points } = change;
    if (current && (currentSide !== side || current.teamTricode !== action.teamTricode)) finish();
    currentPoints += points;
    current = {
      ...score, teamTricode: action.teamTricode, points: currentPoints,
      period: action.period, clock: action.clock,
    };
    currentSide = side;
  }
  finish();
  return runs;
}
