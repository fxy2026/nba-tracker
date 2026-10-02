import type { PlayerIndexProvenance } from "./player-index-provenance";

interface IndexTenure { personId: number; fromYear: string; toYear: string }
export interface RookieCohort {
  available: boolean;
  rookieIds: number[];
  sophomoreIds: number[];
  sourceSeason: string | null;
  provenance: PlayerIndexProvenance | null;
}
/** Conservative index-derived first-year cohort, not official award eligibility. */
export function rookieCohort(players: readonly IndexTenure[], metadata: unknown, season: string): RookieCohort {
  const m = metadata && typeof metadata === "object" ? metadata as Partial<PlayerIndexProvenance> : null;
  const sourceSeason = typeof m?.season === "string" && /^\d{4}-\d{2}$/.test(m.season) ? m.season : null;
  const provenance = m && (m.source === "nba-cdn" || m.source === "bundled-archive") && typeof m.stale === "boolean"
    ? { source: m.source, season: sourceSeason, stale: m.stale, retrievedAt: typeof m.retrievedAt === "string" ? m.retrievedAt : null } : null;
  const empty = { available: false, rookieIds: [], sophomoreIds: [], sourceSeason, provenance };
  if (!provenance || provenance.source !== "nba-cdn" || provenance.stale || sourceSeason !== season) return empty;
  const start = Number(season.slice(0,4));
  const valid = players.filter(p => Number.isSafeInteger(p.personId) && p.personId > 0 && /^\d{4}$/.test(p.fromYear) && /^\d{4}$/.test(p.toYear) && p.toYear === String(start));
  const rookieIds = [...new Set(valid.filter(p => p.fromYear === String(start)).map(p => p.personId))];
  const sophomoreIds = [...new Set(valid.filter(p => p.fromYear === String(start-1)).map(p => p.personId))];
  return { ...empty, available: rookieIds.length > 0, rookieIds, sophomoreIds };
}
/** Never widen to every league player when the index cohort is unavailable. */
export function filterRookieRows<T extends { PLAYER_ID: number; GP: number; PTS: number; REB: number; AST: number }>(rows: readonly T[], cohort: RookieCohort): T[] {
  if (!cohort.available) return [];
  const ids = new Set(cohort.rookieIds);
  return rows.filter(p => ids.has(p.PLAYER_ID) && [p.GP,p.PTS,p.REB,p.AST].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0));
}
