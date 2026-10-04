// Deliberately one game. Neither an ID from a URL nor a source-provided path
// can expand filesystem access or enable an unreviewed historical timeline.
export const HISTORICAL_SCORING_GAME_ID = "0042500405";
export const historicalScoringSource = {
  repository: "https://github.com/fxy2026/nba_data",
  commit: "e829d4678be1e075f99e5d41a1c5f97089be446b",
  archivePath: "datasets/nbastatsv3_po_2025.tar.xz",
  archiveGitBlob: "e7237d33250fc71b5f1f5fa643988170420f4b3e",
  archiveSha256: "22f8479396ee7c5cd5a286f884eab4f9020d145e49cdfd7499d8abad5e70852c",
  csvSha256: "0dd9a89e44c9b92026eb2fad2f5371b00fa650d8b6745184974fc2e1acd12812",
  feed: "nbastatsv3",
  captureTime: null,
  verifiedOn: "2026-10-04",
} as const;
export const historicalScoringFiles = {
  facts: { path: "src/data/verified-play-by-play/0042500405.json", sha256: "c1bcd29760ebbf00dc6331ff98026ecbd4d6cae5fc2622f246b8ebfb6c129e92" },
  box: { path: "src/data/recovered-player-boxes/0042500405.json", sha256: "ab4f25a4016eecb5875929430ee0abb05283b42712b5d3a4b975cd8564259591" },
  shots: { path: "src/data/verified-shot-charts/0042500405.json", sha256: "a95e6a3331e698c76d98e03ecbe84d69e7f5c2061a5598a9c47196ece8165e34" },
  periods: { path: "src/data/official-period-scores/0042500405.json", sha256: "72f8aa8a744257464532ffe5b01831386d9a60ab76b1b4982a99c0d3e92836f5" },
} as const;
export const historicalScoringColumns = [
  "actionNumber", "clock", "period", "teamId", "teamTricode", "personId", "playerName", "playerNameI",
  "xLegacy", "yLegacy", "shotDistance", "shotResult", "isFieldGoal", "scoreHome", "scoreAway", "pointsTotal",
  "location", "description", "actionType", "subType", "videoAvailable", "shotValue", "actionId", "gameId",
] as const;
