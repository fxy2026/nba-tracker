/** Spatial rendering uses the source coordinate frame, never zone totals. */
export const SHOT_MAP_LOW_PLAYER = 5;
export const SHOT_MAP_LOW_LEAGUE = 20;
export const SHOT_MAP_DELTA_BAND = .03;
export const SHOT_MAP_VIEWBOX = '-270 -20 540 510';
export const SHOT_MAP_PALETTE = { below: '#6c93a2', near: '#c6c3b9', above: '#c3836e', neutral: '#d7d8d4' } as const;
export type ShotMapView = 'hex' | 'density' | 'zones';
export interface BinCounts { fgm: number; fga: number; fg3m: number; fg3a: number }
export function fgRate(counts: Pick<BinCounts, 'fgm' | 'fga'>): number | null { return counts.fga > 0 ? counts.fgm / counts.fga : null; }
export function displayPct(value: number | null): string { return value === null ? '—' : `${(100 * value).toFixed(1)}%`; }
export function binDelta(player: BinCounts, league: BinCounts | null | undefined): number | null { return player.fga && league?.fga ? player.fgm / player.fga - league.fgm / league.fga : null; }
export function binColor(player: BinCounts, league: BinCounts | null | undefined): string {
  const delta = binDelta(player, league);
  if (player.fga < SHOT_MAP_LOW_PLAYER || !league || league.fga < SHOT_MAP_LOW_LEAGUE || delta === null) return SHOT_MAP_PALETTE.neutral;
  return delta > SHOT_MAP_DELTA_BAND + 1e-12 ? SHOT_MAP_PALETTE.above : delta < -SHOT_MAP_DELTA_BAND - 1e-12 ? SHOT_MAP_PALETTE.below : SHOT_MAP_PALETTE.near;
}
export function axialCenter(q: number, r: number, radius: number): readonly [number, number] { return [radius * Math.sqrt(3) * (q + r / 2), radius * 1.5 * r]; }
/** SVG's downwards y is the inverse of the source's away-from-baseline y. */
export function projectShot(x: number, y: number): readonly [number, number] { return [x, 417.5 - y]; }
export function hexRadius(attempts: number, maxAttempts: number, cellRadius: number): number { return maxAttempts > 0 && attempts > 0 ? cellRadius * .92 * Math.sqrt(attempts / maxAttempts) : 0; }
export function hexPoints(x: number, y: number, radius: number): string { return Array.from({ length: 6 }, (_, i) => { const angle = Math.PI / 180 * (60 * i - 30); return `${(x + radius * Math.cos(angle)).toFixed(3)},${(y + radius * Math.sin(angle)).toFixed(3)}`; }).join(' '); }
export function countFormat(value: number, locale: 'en' | 'zh'): string { return value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US'); }
