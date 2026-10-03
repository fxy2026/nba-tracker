import { careerAggregationRows } from "./career-shooting";
import { normalizePlayerCareerData, type PlayerCareerData } from "./player-career-data";
import { careerSourceUrl, isCareerSeason } from "./player-career-provenance";

export interface ValidatedCareerArchive { playerName: string; data: PlayerCareerData; }
const identities: Record<string, { name: string; firstSeason: string }> = {
  "2544": { name: "LeBron James", firstSeason: "2003-04" },
  "203999": { name: "Nikola Jokić", firstSeason: "2015-16" },
};
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

// Used only after the server verifies the independently reviewed content hash.
// Validation is deliberately stricter than the backward-compatible live API.
export function validateCareerArchive(raw: unknown, playerId: string): ValidatedCareerArchive | null {
  if (!Object.hasOwn(identities, playerId) || !raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== 1 || !value.player || typeof value.player !== "object"
    || !value.source || typeof value.source !== "object" || !value.evidence || typeof value.evidence !== "object") return null;
  const player = value.player as Record<string, unknown>;
  const source = value.source as Record<string, unknown>;
  const evidence = value.evidence as Record<string, unknown>;
  const identity = identities[playerId];
  if (player.nbaId !== playerId || player.name !== identity.name) return null;
  const data = normalizePlayerCareerData(value.data);
  if (!data || data.provenance?.source !== "nba-com" || data.provenance.providerPlayerId !== playerId
    || data.provenance.coverage.firstSeason !== identity.firstSeason
    || !data.careerSeasons.length || !data.careerAverage || !data.careerShooting || data.careerShooting.source !== "nba-browser-overall") return null;
  if (source.url !== careerSourceUrl(data.provenance) || source.method !== "rendered-browser-dom"
    || source.perMode !== "PerGame" || source.percentageUnit !== "fraction" || source.sourcePercentageUnit !== "percent"
    || evidence.path !== `docs/evidence/player-career/${playerId}-${data.provenance.capturedAt.slice(0, 10)}.json`
    || !digest(evidence.sha256) || !digest(evidence.perGameCaptureSha256) || !digest(evidence.totalsCaptureSha256)) return null;
  const keys = new Set<string>();
  for (const [index, row] of data.careerSeasons.entries()) {
    const key = `${row.SEASON_ID}:${row.TEAM_ABBREVIATION}`;
    if (!isCareerSeason(row.SEASON_ID) || !/^[A-Z]{2,3}$/.test(row.TEAM_ABBREVIATION)
      || keys.has(key) || !Number.isSafeInteger(row.GP) || row.GP < 1 || row.GP > 82
      || (index > 0 && data.careerSeasons[index - 1].SEASON_ID > row.SEASON_ID)) return null;
    keys.add(key);
  }
  // Keep original team/TOT rows intact; reject ambiguous duplicate aggregates.
  const aggregated = careerAggregationRows(data.careerSeasons);
  if (!aggregated || aggregated.reduce((sum, row) => sum + row.GP, 0) !== data.careerAverage.GP) return null;
  return { playerName: identity.name, data };
}
