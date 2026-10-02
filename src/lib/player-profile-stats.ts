/** Client-safe guards: missing averages are not zero-valued performances. */
export function knownAverage(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function hasCompleteAverages<T extends { pts: unknown; reb: unknown; ast: unknown }>(player: T): player is T & { pts: number; reb: number; ast: number } {
  return knownAverage(player.pts) !== null && knownAverage(player.reb) !== null && knownAverage(player.ast) !== null;
}
export interface StatContext { rank: number; percentile: number; delta: number | null; leagueAvg: number }
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
  const sorted = [...eligible].sort((a,b) => (knownAverage(b[stat]) as number) - (knownAverage(a[stat]) as number));
  const rank = sorted.findIndex(p => p.personId === personId) + 1;
  if (!rank) return null;
  const leagueAvg = eligible.reduce((sum,p) => sum + (knownAverage(p[stat]) as number), 0) / eligible.length;
  return { rank, percentile: Math.round((eligible.length-rank)/eligible.length*100), leagueAvg, delta: leagueAvg > 0 ? (average-leagueAvg)/leagueAvg*100 : null };
}
