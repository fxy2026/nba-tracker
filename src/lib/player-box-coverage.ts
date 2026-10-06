import "server-only";
import rawManifest from "@/data/player-box-coverage.json";
import { TEAM_META } from "./teams";
import type { PlayerBoxCoverageManifest, PlayerBoxCoveragePhase, TeamPlayerBoxCoverage } from "./player-box-coverage-contract";

const phases = new Set(["regular", "playoffs", "play-in", "preseason", "cup-final"]);
const tiers = ["officialReport", "recordedReportReview", "legacyManualReview", "espnAssigned", "unassignedProvider"] as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const season = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}$/.test(value) && value.slice(5) === String((Number(value.slice(0, 4)) + 1) % 100).padStart(2, "0");
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Fail closed on malformed generated metadata. Source validation runs offline. */
export function validatePlayerBoxCoverageManifest(raw: unknown): PlayerBoxCoverageManifest | null {
  if (!object(raw) || raw.version !== 1 || !hash(raw.inputSha256) || !Array.isArray(raw.completedSeasons) || !Array.isArray(raw.coverage)) return null;
  const keys = new Set<string>();
  for (const row of raw.coverage) {
    if (!object(row) || typeof row.team !== "string" || !Object.hasOwn(TEAM_META, row.team) || !season(row.season) || typeof row.phase !== "string" || !phases.has(row.phase)
      || !(row.expectedGames === null || count(row.expectedGames)) || !count(row.archivedGames) || !count(row.teamAssignedGames) || !count(row.partialPlayerBoxGames)
      || !object(row.evidence) || Object.keys(row.evidence).length !== tiers.length || !tiers.every(tier => count((row.evidence as Record<string, unknown>)[tier]))) return null;
    const evidence = row.evidence as Record<(typeof tiers)[number], number>;
    const key = `${row.team}/${row.season}/${row.phase}`;
    if (keys.has(key) || tiers.reduce((sum, tier) => sum + evidence[tier], 0) !== row.archivedGames
      || row.teamAssignedGames !== row.archivedGames - evidence.unassignedProvider || row.partialPlayerBoxGames > row.archivedGames
      || (row.expectedGames !== null && row.archivedGames > row.expectedGames)
      || (row.archivedGames === 0 ? row.firstGameDate !== null || row.lastGameDate !== null
        : !date(row.firstGameDate) || !date(row.lastGameDate) || row.firstGameDate > row.lastGameDate)) return null;
    keys.add(key);
  }
  const completed = new Set<string>();
  for (const entry of raw.completedSeasons) {
    if (!object(entry) || !season(entry.season) || completed.has(entry.season) || entry.regularGames !== 1230 || !count(entry.playoffGames) || entry.playoffGames < 60 || entry.playoffGames > 105 || !hash(entry.scheduleSha256) || !hash(entry.finalProjectionSha256)) return null;
    const rows = raw.coverage.filter((r: TeamPlayerBoxCoverage) => r.season === entry.season);
    const regular = rows.filter((r: TeamPlayerBoxCoverage) => r.phase === "regular"), playoffs = rows.filter((r: TeamPlayerBoxCoverage) => r.phase === "playoffs");
    if (regular.length !== 30 || playoffs.length !== 30 || !regular.every((r: TeamPlayerBoxCoverage) => r.expectedGames === 82)
      || !playoffs.every((r: TeamPlayerBoxCoverage) => count(r.expectedGames)) || playoffs.reduce((sum: number, r: TeamPlayerBoxCoverage) => sum + r.expectedGames!, 0) !== entry.playoffGames * 2) return null;
    completed.add(entry.season);
  }
  return raw as unknown as PlayerBoxCoverageManifest;
}
const manifest = validatePlayerBoxCoverageManifest(rawManifest);

/** Explicit team/season/phase lookup; unavailable metadata is never fabricated as zero. */
export function getTeamArchiveCoverage(team: string, archiveSeason: string, phase: PlayerBoxCoveragePhase, data: PlayerBoxCoverageManifest | null = manifest): TeamPlayerBoxCoverage | null {
  if (!data || !Object.hasOwn(TEAM_META, team) || !season(archiveSeason) || !phases.has(phase)) return null;
  return data.coverage.find(row => row.team === team && row.season === archiveSeason && row.phase === phase) ?? null;
}
export interface CompletedTeamArchiveCoverage { season: string; regular: TeamPlayerBoxCoverage; playoffs: TeamPlayerBoxCoverage }
/** Selection uses validated completed schedule metadata, never today's season or a team's largest sample. */
export function getLatestCompletedTeamArchiveCoverage(team: string, data: PlayerBoxCoverageManifest | null = manifest): CompletedTeamArchiveCoverage | null {
  if (!data) return null;
  const archiveSeason = data.completedSeasons.map(entry => entry.season).sort().at(-1);
  if (!archiveSeason) return null;
  const regular = getTeamArchiveCoverage(team, archiveSeason, "regular", data), playoffs = getTeamArchiveCoverage(team, archiveSeason, "playoffs", data);
  return regular && playoffs ? { season: archiveSeason, regular, playoffs } : null;
}
