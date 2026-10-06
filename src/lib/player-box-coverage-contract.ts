/** Metadata only. No player values, current-roster assignments or season averages. */
export type PlayerBoxCoveragePhase = "regular" | "playoffs" | "play-in" | "preseason" | "cup-final";
export type PlayerBoxEvidenceTier = "officialReport" | "recordedReportReview" | "legacyManualReview" | "espnAssigned" | "unassignedProvider";
export interface TeamPlayerBoxCoverage {
  team: string;
  season: string;
  phase: PlayerBoxCoveragePhase;
  /** null means that a full phase schedule has not been established. */
  expectedGames: number | null;
  archivedGames: number;
  teamAssignedGames: number;
  evidence: Record<PlayerBoxEvidenceTier, number>;
  firstGameDate: string | null;
  lastGameDate: string | null;
  partialPlayerBoxGames: number;
}
export interface PlayerBoxCoverageManifest {
  version: 1;
  inputSha256: string;
  completedSeasons: {
    season: string;
    regularGames: number;
    playoffGames: number;
    scheduleSha256: string;
    finalProjectionSha256: string;
  }[];
  coverage: TeamPlayerBoxCoverage[];
}
