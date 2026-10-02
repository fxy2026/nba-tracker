import { hasCompleteAverages, knownAverage } from "./player-profile-stats";

/** Counts keep all index rows; only fully known triples enter composite ranks. */
export function directoryStats<T extends { pts: unknown; reb: unknown; ast: unknown }>(players: T[]) {
  const impact = (p: T & { pts: number; reb: number; ast: number }) => p.pts + p.reb * 1.2 + p.ast * 1.5;
  const ranked = players.filter(hasCompleteAverages).sort((a, b) => impact(b) - impact(a));
  const unranked = players.filter(p => !hasCompleteAverages(p));
  const points = players.map(p => knownAverage(p.pts)).filter((value): value is number => value !== null);
  return {
    ranked, unranked,
    avgPts: points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : null,
    bestPpg: points.length ? Math.max(...points) : null,
  };
}
