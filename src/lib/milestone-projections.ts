import { knownAverage } from "./player-profile-stats";

export const GP_PER_SEASON = 70; // Explicit model assumption, not games actually played.
interface InputPlayer {
  personId: number; firstName: string; lastName: string; teamAbbr: string;
  fromYear: unknown; toYear: unknown; pts: unknown; reb: unknown; ast: unknown;
}
export interface MilestoneCandidate {
  personId: number; firstName: string; lastName: string; teamAbbr: string;
  estCareerPoints: number | null; estCareerRebs: number | null; estCareerAsts: number | null;
  ppg: number | null; rpg: number | null; apg: number | null; seasons: number;
}
export interface Threshold { value: number; label: string }
export interface ChasingMilestone {
  player: MilestoneCandidate; current: number; threshold: Threshold;
  needed: number; gamesNeeded: number;
}

/** FROM/TO_YEAR are a calendar-year span, not a count of seasons actually played. */
export function milestoneCandidates(players: readonly InputPlayer[], nowYear = new Date().getUTCFullYear()): MilestoneCandidate[] {
  return players.flatMap(p => {
    if (typeof p.fromYear !== "string" || typeof p.toYear !== "string" ||
      !/^\d{4}$/.test(p.fromYear) || !/^\d{4}$/.test(p.toYear)) return [];
    const from = Number(p.fromYear), to = Number(p.toYear);
    // NBA/BAA history begins in 1946. Allow next calendar year for a current
    // season index, but never turn ancient or far-future years into a model.
    if (!Number.isInteger(nowYear) || from < 1946 || to < from || to > nowYear + 1) return [];
    const seasons = to - from + 1;
    const ppg = knownAverage(p.pts), rpg = knownAverage(p.reb), apg = knownAverage(p.ast);
    const estimate = (average: number | null) => {
      if (average === null) return null;
      const total = Math.round(average * GP_PER_SEASON * seasons);
      return Number.isFinite(total) ? total : null;
    };
    return [{ personId: p.personId, firstName: p.firstName, lastName: p.lastName,
      teamAbbr: p.teamAbbr, seasons, ppg, rpg, apg,
      estCareerPoints: estimate(ppg), estCareerRebs: estimate(rpg), estCareerAsts: estimate(apg) }];
  });
}

export function findChasing(players: readonly MilestoneCandidate[], tiers: readonly Threshold[],
  current: (p: MilestoneCandidate) => number | null, perGame: (p: MilestoneCandidate) => number | null): ChasingMilestone[] {
  const ascending = [...tiers].sort((a,b) => a.value - b.value);
  const out: ChasingMilestone[] = [];
  for (const player of players) {
    const cur = current(player), pg = perGame(player);
    if (cur === null || pg === null || !Number.isFinite(cur) || !Number.isFinite(pg) || pg <= 0) continue;
    const threshold = ascending.find(t => t.value > cur);
    if (!threshold) continue;
    const needed = threshold.value - cur;
    // A positive remaining amount requires at least one whole future game.
    const gamesNeeded = Math.max(1, Math.ceil(needed / pg));
    if (!Number.isFinite(gamesNeeded) || gamesNeeded > GP_PER_SEASON * 2.5) continue;
    out.push({ player, current: cur, threshold, needed, gamesNeeded });
  }
  return out.sort((a,b) => a.needed - b.needed).slice(0,12);
}
