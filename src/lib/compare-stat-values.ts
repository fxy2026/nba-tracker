export type CompareStat = number | null | undefined;

export function isCompareStat(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function displayCompareStat(value: CompareStat, decimals?: number): string {
  if (!isCompareStat(value)) return "—";
  return decimals === undefined ? String(value) : value.toFixed(decimals);
}

/** No arithmetic or winner is supported when either value is unknown. */
export function compareStatPair(a: CompareStat, b: CompareStat) {
  if (!isCompareStat(a) || !isCompareStat(b)) return null;
  const max = Math.max(a, b, 0.001);
  return { a, b, max, ratioA: a / max, ratioB: b / max, winner: a > b ? 0 : b > a ? 1 : -1 };
}

export function uniqueStatLeader(values: readonly CompareStat[]): number {
  if (values.length === 0 || !values.every(isCompareStat)) return -1;
  const max = Math.max(...values);
  return values.filter(value => value === max).length === 1 ? values.indexOf(max) : -1;
}

export function productionScore(player: { pts: CompareStat; reb: CompareStat; ast: CompareStat }): number | null {
  if (!isCompareStat(player.pts) || !isCompareStat(player.reb) || !isCompareStat(player.ast)) return null;
  const score = player.pts + 1.2 * player.reb + 1.5 * player.ast;
  return Number.isFinite(score) ? score : null;
}

/** A real zero/zero comparison has no share, rather than an invented 50/50. */
export function productionShares(a: CompareStat, b: CompareStat): [number, number] | null {
  if (!isCompareStat(a) || !isCompareStat(b) || a + b <= 0 || !Number.isFinite(a + b)) return null;
  return [a / (a + b), b / (a + b)];
}
