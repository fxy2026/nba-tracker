import { validateOfficialPlayerBox, type OfficialPlayerBoxEvidence } from './official-player-box';
import { isQuarantinedProviderIdentity } from "./provider-identity-quarantine";
// Minimal structural identity keeps this validator usable by offline build
// tooling without importing API code or either generated archive.
export interface RecoveredScheduleIdentity {
  gameId: string;
  gameStatus: number;
  gameCode: string;
  homeTeam: { teamTricode: string; score: number; teamId?: number };
  awayTeam: { teamTricode: string; score: number; teamId?: number };
}

export interface RecoveredPlayerLine {
  name: string;
  source?: "NBA official final report";
  officialSource?: {
    kind: "independent-official-player-record";
    reportUrl: string;
    reportSha256: string;
    page: number;
    verifiedOn: string;
    jerseyNumber: string;
    position: string | null;
    officialDuration: string;
  };
  providerPlayerId?: string | null;
  team: string;
  minutes: number | null;
  minutesCorrection?: {
    source: "NBA official final report";
    originalProviderMinutes: number | null;
    officialDuration: string;
    reportUrl: string;
    verifiedOn: string;
    rounding: "nearest-minute";
  };
  points: number;
  rebounds: number | null;
  assists: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  threePointersMade: number | null;
  threePointersAttempted: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempted: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  steals: number | null;
  blocks: number | null;
  blocksCorrection?: {
    source: "NBA official final report";
    originalProviderBlocks: number;
    officialBlocks: number;
    reportUrl: string;
    reportSha256: string;
    verifiedOn: string;
  };
  turnovers: number | null;
  fouls: number | null;
  plusMinus: number | null;
  starter: boolean | null;
}
export interface RecoveredPlayerBox {
  gameId: string;
  gameDate: string;
  season: string;
  provider: "BigBallsData" | "BigBallsData + NBA official final report" | "NBA official final report";
  providerMatchId: string | null;
  officialReport?: OfficialPlayerBoxEvidence;
  retrievedAt: string;
  reportUrl: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  players: RecoveredPlayerLine[];
  excludedProviderRecords?: number;
  sourceSupplement?: {
    reason: "absent-from-provider-snapshot";
    originalProviderPlayerCount: number;
    officialPlayedPlayerCount: number;
    addedOfficialPlayerNames: string[];
    reportUrl: string;
    reportSha256: string;
    verifiedOn: string;
  };
  playedCoverage?: {
    status: "partial";
    source: "NBA official final report";
    officialPlayedPlayerCount: number;
    reportUrl: string;
    reportSha256: string;
    verifiedOn: string;
    missingOfficialPlayedPlayers: { officialName: string; team: string; reason: "absent-from-provider-snapshot" }[];
  };
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const optionalCount = (value: unknown) => value === null || count(value);
const countFields = ["minutes", "rebounds", "assists", "fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds", "steals", "blocks", "turnovers", "fouls"] as const;

// This is a deliberately separate basic-stat contract, never a synthetic NBA
// BoxScore. It cannot unlock play-by-play, shot coordinates or derived widgets.
export function validateRecoveredPlayerBox(raw: unknown, game: RecoveredScheduleIdentity): RecoveredPlayerBox | null {
  if (object(raw) && raw.provider === "NBA official final report") return validateOfficialPlayerBox(raw,game);
  if (!object(raw) || game.gameStatus !== 3 || raw.gameId !== game.gameId || !["BigBallsData", "BigBallsData + NBA official final report"].includes(raw.provider as string) ||
    raw.season !== "2025-26" || typeof raw.providerMatchId !== "string" || !/^[0-9a-f-]{36}$/.test(raw.providerMatchId) ||
    typeof raw.retrievedAt !== "string" || !Number.isFinite(Date.parse(raw.retrievedAt)) ||
    typeof raw.reportUrl !== "string" || !/^https:\/\/statsdmz\.nba\.com\/pdfs\/\d{8}\/\d{8}_[A-Z]{6}(?:_book)?\.pdf$/.test(raw.reportUrl) ||
    typeof raw.gameDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.gameDate) || raw.gameDate.replaceAll("-", "") !== game.gameCode.split("/")[0] ||
    raw.home !== game.homeTeam.teamTricode || raw.away !== game.awayTeam.teamTricode || raw.home === raw.away ||
    !count(raw.homeScore) || !count(raw.awayScore) || raw.homeScore !== game.homeTeam.score || raw.awayScore !== game.awayTeam.score ||
    !Array.isArray(raw.players) || raw.players.length === 0) return null;
  if (raw.officialReport !== undefined) return null;
  if (raw.excludedProviderRecords !== undefined && !count(raw.excludedProviderRecords)) return null;
  const mixed = raw.provider === "BigBallsData + NBA official final report";
  let officialRows = 0;
  const names = new Set<string>();
  for (const p of raw.players) {
    if (!object(p) || typeof p.name !== "string" || !p.name.trim() || names.has(p.name) ||
      (p.team !== raw.home && p.team !== raw.away) || !count(p.points) || !countFields.every(key => optionalCount(p[key])) ||
      !(p.plusMinus === null || (typeof p.plusMinus === "number" && Number.isSafeInteger(p.plusMinus))) ||
      !(p.starter === null || typeof p.starter === "boolean")) return null;
    if (!(p.providerPlayerId === undefined || p.providerPlayerId === null || (typeof p.providerPlayerId === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.providerPlayerId)))) return null;
    if (p.source !== undefined || p.officialSource !== undefined) {
      const evidence = p.officialSource;
      if (!mixed || p.source !== "NBA official final report" || p.providerPlayerId !== null ||
        !object(evidence) || evidence.kind !== "independent-official-player-record" || evidence.reportUrl !== raw.reportUrl ||
        typeof evidence.reportSha256 !== "string" || !/^[0-9a-f]{64}$/.test(evidence.reportSha256) ||
        !count(evidence.page) || evidence.page < 1 || typeof evidence.verifiedOn !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(evidence.verifiedOn) || !Number.isFinite(Date.parse(evidence.verifiedOn)) ||
        typeof evidence.jerseyNumber !== "string" || !/^\d{1,2}$/.test(evidence.jerseyNumber) ||
        !((typeof evidence.position === "string" && evidence.position.trim()) || (evidence.position === null && p.starter === false)) ||
        typeof evidence.officialDuration !== "string" || !/^\d{2}:[0-5]\d$/.test(evidence.officialDuration)) return null;
      const [minutes, seconds] = evidence.officialDuration.split(":").map(Number);
      if (p.minutes !== Math.round(minutes + seconds / 60)) return null;
      officialRows++;
    } else if ((mixed && typeof p.providerPlayerId !== "string") || isQuarantinedProviderIdentity(p.providerPlayerId, p.name)) return null;
    names.add(p.name);
    if (p.blocksCorrection !== undefined) {
      const correction = p.blocksCorrection;
      if (!object(correction) || correction.source !== "NBA official final report" ||
        !count(correction.originalProviderBlocks) || !count(correction.officialBlocks) ||
        p.blocks !== correction.officialBlocks || correction.reportUrl !== raw.reportUrl ||
        typeof correction.reportSha256 !== "string" || !/^[0-9a-f]{64}$/.test(correction.reportSha256) ||
        typeof correction.verifiedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(correction.verifiedOn) ||
        !Number.isFinite(Date.parse(correction.verifiedOn))) return null;
    }
    if (p.minutesCorrection !== undefined) {
      const correction = p.minutesCorrection;
      if (!object(correction) || correction.source !== "NBA official final report" ||
        !optionalCount(correction.originalProviderMinutes) || correction.reportUrl !== raw.reportUrl ||
        correction.rounding !== "nearest-minute" || typeof correction.verifiedOn !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(correction.verifiedOn) || !Number.isFinite(Date.parse(correction.verifiedOn)) ||
        typeof correction.officialDuration !== "string" || !/^\d{2}:[0-5]\d$/.test(correction.officialDuration)) return null;
      const [minutes, seconds] = correction.officialDuration.split(":").map(Number);
      if (p.minutes !== Math.round(minutes + seconds / 60)) return null;
    }
    for (const [made, attempts] of [["fieldGoalsMade", "fieldGoalsAttempted"], ["threePointersMade", "threePointersAttempted"], ["freeThrowsMade", "freeThrowsAttempted"]]) {
      if (count(p[made]) && count(p[attempts]) && p[made] > p[attempts]) return null;
    }
    if (count(p.threePointersMade) && count(p.fieldGoalsMade) && p.threePointersMade > p.fieldGoalsMade) return null;
    if (count(p.fieldGoalsMade) && count(p.threePointersMade) && count(p.freeThrowsMade) &&
      2 * p.fieldGoalsMade + p.threePointersMade + p.freeThrowsMade !== p.points) return null;
    if (count(p.rebounds) && count(p.offensiveRebounds) && count(p.defensiveRebounds) && p.offensiveRebounds + p.defensiveRebounds !== p.rebounds) return null;
  }
  if (mixed && officialRows === 0) return null;
  if (raw.sourceSupplement !== undefined) {
    const supplement = raw.sourceSupplement;
    const official = raw.players.filter(p => p.source === "NBA official final report");
    if (!mixed || raw.playedCoverage !== undefined || !object(supplement) || supplement.reason !== "absent-from-provider-snapshot"
      || !count(supplement.originalProviderPlayerCount) || supplement.originalProviderPlayerCount === 0
      || supplement.officialPlayedPlayerCount !== raw.players.length || raw.players.length > 50
      || supplement.originalProviderPlayerCount + officialRows !== raw.players.length
      || supplement.reportUrl !== raw.reportUrl || typeof supplement.reportSha256 !== "string" || !/^[0-9a-f]{64}$/.test(supplement.reportSha256)
      || typeof supplement.verifiedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(supplement.verifiedOn) || !Number.isFinite(Date.parse(supplement.verifiedOn))
      || !Array.isArray(supplement.addedOfficialPlayerNames) || supplement.addedOfficialPlayerNames.length !== officialRows
      || new Set(supplement.addedOfficialPlayerNames).size !== officialRows
      || official.some(p => !(supplement.addedOfficialPlayerNames as unknown[]).includes(p.name) || !object(p.officialSource)
        || p.officialSource.reportSha256 !== supplement.reportSha256 || p.officialSource.verifiedOn !== supplement.verifiedOn)) return null;
  }
  if (raw.playedCoverage !== undefined) {
    const coverage = raw.playedCoverage;
    if (!object(coverage) || coverage.status !== "partial" || coverage.source !== "NBA official final report" ||
      !count(coverage.officialPlayedPlayerCount) || coverage.officialPlayedPlayerCount > 50 ||
      coverage.reportUrl !== raw.reportUrl || typeof coverage.reportSha256 !== "string" || !/^[0-9a-f]{64}$/.test(coverage.reportSha256) ||
      typeof coverage.verifiedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(coverage.verifiedOn) || !Number.isFinite(Date.parse(coverage.verifiedOn)) ||
      !Array.isArray(coverage.missingOfficialPlayedPlayers) || coverage.missingOfficialPlayedPlayers.length === 0 ||
      coverage.officialPlayedPlayerCount !== raw.players.length + coverage.missingOfficialPlayedPlayers.length) return null;
    const missingNames = new Set<string>();
    const displayedNames = new Set([...names].map(name => name.trim().toLowerCase()));
    for (const missing of coverage.missingOfficialPlayedPlayers) {
      if (!object(missing) || typeof missing.officialName !== "string" || !missing.officialName.trim() ||
        missing.officialName !== missing.officialName.trim() || missing.officialName.length > 100 ||
        (missing.team !== raw.home && missing.team !== raw.away) || missing.reason !== "absent-from-provider-snapshot") return null;
      const key = missing.officialName.toLowerCase();
      if (missingNames.has(key) || displayedNames.has(key)) return null;
      missingNames.add(key);
    }
  }
  for (const [team, expected] of [[raw.home, raw.homeScore], [raw.away, raw.awayScore]]) {
    if (raw.players.filter(p => p.team === team).reduce((sum, p) => sum + p.points, 0) !== expected) return null;
  }
  return raw as unknown as RecoveredPlayerBox;
}
