/**
 * Attribution for one complete /api/player regular-season response.
 * retrievedAt records when this API consumed the provider response, which can
 * come from a cache. It is NOT the upstream update time or a game/season date.
 * Provider attribution is not independent verification of the statistics.
 */
export interface PlayerCareerProvenance {
  source: "nba-stats" | "espn";
  providerPlayerId: string;
  scope: "regular-season";
  retrievalKind: "api-response";
  retrievedAt: string;
}

export function normalizeCareerProvenance(raw: unknown): PlayerCareerProvenance | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if ((value.source !== "nba-stats" && value.source !== "espn")
    || typeof value.providerPlayerId !== "string" || !/^\d+$/.test(value.providerPlayerId)
    || value.scope !== "regular-season" || value.retrievalKind !== "api-response"
    || typeof value.retrievedAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.retrievedAt)) return null;
  const date = new Date(value.retrievedAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.retrievedAt) return null;
  // Copy only the declared contract; never preserve arbitrary source URLs or
  // unknown claims such as "verified" supplied by an upstream response.
  return {
    source: value.source, providerPlayerId: value.providerPlayerId,
    scope: value.scope, retrievalKind: value.retrievalKind, retrievedAt: value.retrievedAt,
  };
}

/** Construct the source link from the validated provider identity, not a URL in a payload. */
export function careerSourceUrl(provenance: PlayerCareerProvenance): string {
  return provenance.source === "nba-stats"
    ? `https://stats.nba.com/stats/playercareerstats?PlayerID=${provenance.providerPlayerId}&PerMode=PerGame`
    : `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${provenance.providerPlayerId}/stats`;
}
