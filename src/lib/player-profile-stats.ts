/** Client-safe guards: missing averages are not zero-valued performances. */
export function knownAverage(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function hasCompleteAverages<T extends { pts: unknown; reb: unknown; ast: unknown }>(player: T): player is T & { pts: number; reb: number; ast: number } {
  return knownAverage(player.pts) !== null && knownAverage(player.reb) !== null && knownAverage(player.ast) !== null;
}
export interface StatContext { rank: number; percentile: number; cohortSize: number; delta: number | null; sampleAvg: number }
export function profileStatContext(
  players: readonly { personId: number; pts: unknown; reb: unknown; ast: unknown }[],
  personId: number,
  stat: "pts" | "reb" | "ast",
  value: number | null,
): StatContext | null {
  const average = knownAverage(value);
  if (average === null) return null;
  // Preserve the existing positive-PPG comparison population, but require the
  // specific compared statistic to exist. A recorded zero REB/AST is valid.
  const eligible = players.filter(p => (knownAverage(p.pts) ?? 0) > 0 && knownAverage(p[stat]) !== null);
  const subject = eligible.find(p => p.personId === personId);
  if (!subject) return null;
  const subjectValue = knownAverage(subject[stat]) as number;
  const values = eligible.map(p => knownAverage(p[stat]) as number);
  const cohortSize = values.length;
  // Competition rank and strict-below percentile give ties the same context,
  // independent of index order. Untied values retain the previous calculation.
  const rank = 1 + values.filter(value => value > subjectValue).length;
  const percentile = Math.round(values.filter(value => value < subjectValue).length / cohortSize * 100);
  const sampleAvg = values.reduce((sum, value) => sum + value, 0) / cohortSize;
  return { rank, percentile, cohortSize, sampleAvg, delta: sampleAvg > 0 ? (average-sampleAvg)/sampleAvg*100 : null };
}
