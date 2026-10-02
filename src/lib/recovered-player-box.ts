// Minimal structural identity keeps this validator usable by offline build
// tooling without importing API code or either generated archive.
export interface RecoveredScheduleIdentity {
  gameId: string;
  gameStatus: number;
  gameCode: string;
  homeTeam: { teamTricode: string; score: number };
  awayTeam: { teamTricode: string; score: number };
}

export interface RecoveredPlayerLine {
  name: string;
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
  provider: "BigBallsData";
  providerMatchId: string;
  retrievedAt: string;
  reportUrl: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  players: RecoveredPlayerLine[];
  excludedProviderRecords?: number;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const optionalCount = (value: unknown) => value === null || count(value);
const countFields = ["minutes", "rebounds", "assists", "fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds", "steals", "blocks", "turnovers", "fouls"] as const;

// This is a deliberately separate basic-stat contract, never a synthetic NBA
// BoxScore. It cannot unlock play-by-play, shot coordinates or derived widgets.
export function validateRecoveredPlayerBox(raw: unknown, game: RecoveredScheduleIdentity): RecoveredPlayerBox | null {
  if (!object(raw) || game.gameStatus !== 3 || raw.gameId !== game.gameId || raw.provider !== "BigBallsData" ||
    raw.season !== "2025-26" || typeof raw.providerMatchId !== "string" || !/^[0-9a-f-]{36}$/.test(raw.providerMatchId) ||
    typeof raw.retrievedAt !== "string" || !Number.isFinite(Date.parse(raw.retrievedAt)) ||
    typeof raw.reportUrl !== "string" || !/^https:\/\/statsdmz\.nba\.com\/pdfs\/\d{8}\/\d{8}_[A-Z]{6}(?:_book)?\.pdf$/.test(raw.reportUrl) ||
    typeof raw.gameDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.gameDate) || raw.gameDate.replaceAll("-", "") !== game.gameCode.split("/")[0] ||
    raw.home !== game.homeTeam.teamTricode || raw.away !== game.awayTeam.teamTricode || raw.home === raw.away ||
    !count(raw.homeScore) || !count(raw.awayScore) || raw.homeScore !== game.homeTeam.score || raw.awayScore !== game.awayTeam.score ||
    !Array.isArray(raw.players) || raw.players.length === 0) return null;
  if (raw.excludedProviderRecords !== undefined && !count(raw.excludedProviderRecords)) return null;
  const names = new Set<string>();
  for (const p of raw.players) {
    if (!object(p) || typeof p.name !== "string" || !p.name.trim() || names.has(p.name) ||
      (p.team !== raw.home && p.team !== raw.away) || !count(p.points) || !countFields.every(key => optionalCount(p[key])) ||
      !(p.plusMinus === null || (typeof p.plusMinus === "number" && Number.isSafeInteger(p.plusMinus))) ||
      !(p.starter === null || typeof p.starter === "boolean")) return null;
    if (!(p.providerPlayerId === undefined || p.providerPlayerId === null || (typeof p.providerPlayerId === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.providerPlayerId)))) return null;
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
  for (const [team, expected] of [[raw.home, raw.homeScore], [raw.away, raw.awayScore]]) {
    if (raw.players.filter(p => p.team === team).reduce((sum, p) => sum + p.points, 0) !== expected) return null;
  }
  return raw as unknown as RecoveredPlayerBox;
}
