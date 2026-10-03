/** Provider response time and archived browser capture time are different clocks. */
interface CareerIdentity {
  providerPlayerId: string;
  scope: "regular-season";
}
export interface LiveCareerProvenance extends CareerIdentity {
  source: "nba-stats" | "espn";
  retrievalKind: "api-response";
  // API consumption time, potentially from a cache; not an upstream update.
  retrievedAt: string;
}
export interface ArchivedCareerProvenance extends CareerIdentity {
  source: "nba-com";
  retrievalKind: "archived-browser-capture";
  // Fixed when the public table was captured. Never refreshed by serving it.
  capturedAt: string;
  snapshotId: string;
  coverage: { firstSeason: string; lastSeason: string; seasonCount: number; rowCount: number };
}
export type PlayerCareerProvenance = LiveCareerProvenance | ArchivedCareerProvenance;

export function isIsoTimestamp(raw: unknown): raw is string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return false;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) && date.toISOString() === raw;
}
export function isCareerSeason(raw: unknown): raw is string {
  return typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw)
    && String((Number(raw.slice(0, 4)) + 1) % 100).padStart(2, "0") === raw.slice(5);
}
export function normalizeCareerProvenance(raw: unknown): PlayerCareerProvenance | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.providerPlayerId !== "string" || !/^[1-9]\d*$/.test(value.providerPlayerId)
    || value.scope !== "regular-season") return null;
  const identity = { providerPlayerId: value.providerPlayerId, scope: "regular-season" as const };
  if ((value.source === "nba-stats" || value.source === "espn")
    && value.retrievalKind === "api-response" && isIsoTimestamp(value.retrievedAt)) {
    return { ...identity, source: value.source, retrievalKind: value.retrievalKind, retrievedAt: value.retrievedAt };
  }
  if (value.source !== "nba-com" || value.retrievalKind !== "archived-browser-capture"
    || !isIsoTimestamp(value.capturedAt)
    || value.snapshotId !== `nba-com-${value.providerPlayerId}-${value.capturedAt}`
    || !value.coverage || typeof value.coverage !== "object") return null;
  const c = value.coverage as Record<string, unknown>;
  if (!isCareerSeason(c.firstSeason) || !isCareerSeason(c.lastSeason) || c.firstSeason > c.lastSeason
    || !Number.isSafeInteger(c.seasonCount) || (c.seasonCount as number) < 1
    || !Number.isSafeInteger(c.rowCount) || (c.rowCount as number) < (c.seasonCount as number)
    || (c.seasonCount as number) > Number(c.lastSeason.slice(0, 4)) - Number(c.firstSeason.slice(0, 4)) + 1) return null;
  return { ...identity, source: value.source, retrievalKind: value.retrievalKind,
    capturedAt: value.capturedAt, snapshotId: value.snapshotId,
    coverage: { firstSeason: c.firstSeason, lastSeason: c.lastSeason, seasonCount: c.seasonCount as number, rowCount: c.rowCount as number } };
}

/** Links are constructed from validated identities, never arbitrary payload URLs. */
export function careerSourceUrl(provenance: PlayerCareerProvenance): string {
  if (provenance.source === "nba-com") return `https://www.nba.com/stats/player/${provenance.providerPlayerId}/career`;
  return provenance.source === "nba-stats"
    ? `https://stats.nba.com/stats/playercareerstats?PlayerID=${provenance.providerPlayerId}&PerMode=PerGame`
    : `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${provenance.providerPlayerId}/stats`;
}
