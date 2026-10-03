// Server-only boundary: do not import this data or node:crypto from clients.
import { createHash } from "node:crypto";
import rawFacts from "@/data/reported-score-sequences/0022500961.json";
import type { ScheduleGame } from "./api";
import { validateReportedScoreFacts, type ReportedScoreSequence } from "./reported-score-sequence";

// One independently reviewed factual capture. A new game/capture needs a fresh
// review and explicit identity/hash allowlist; no network or provider fallback.
const reviewed = {
  gameId: "0022500961",
  gameDate: "2026-03-13",
  gameCode: "20260313/MEMDET",
  gameDateTimeUTC: "2026-03-13T23:30:00Z",
  home: { teamId: 1610612765, teamTricode: "DET", score: 126 },
  away: { teamId: 1610612763, teamTricode: "MEM", score: 110 },
  factsSha256: "97209ef88c46f19cd95ae1664f6e60e9540de81b40e215047c8adf3ca49efe44",
  source: {
    url: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf",
    sha256: "e798bb1ce8dd0d5e035f53af522567c8f5a038577ba3ba27be1bb3afb3afe55e",
    pageCount: 19,
  },
} as const;

// Matches the independently reviewed compact, lexicographically sorted JSON.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function validateReviewedReportedScoreSequence(raw: unknown, game: ScheduleGame): ReportedScoreSequence | null {
  try {
    if (game.gameStatus !== 3 || game.gameId !== reviewed.gameId || game.gameCode !== reviewed.gameCode ||
      game.gameDateTimeUTC !== reviewed.gameDateTimeUTC ||
      game.homeTeam.teamId !== reviewed.home.teamId || game.awayTeam.teamId !== reviewed.away.teamId ||
      game.homeTeam.teamTricode !== reviewed.home.teamTricode || game.awayTeam.teamTricode !== reviewed.away.teamTricode ||
      game.homeTeam.score !== reviewed.home.score || game.awayTeam.score !== reviewed.away.score) return null;
    const facts = validateReportedScoreFacts(raw);
    if (!facts || createHash("sha256").update(canonicalJson(facts)).digest("hex") !== reviewed.factsSha256) return null;
    return {
      kind: "official-gamebook-reported-score-sequence",
      gameId: reviewed.gameId,
      gameDate: reviewed.gameDate,
      home: { ...reviewed.home },
      away: { ...reviewed.away },
      source: { ...reviewed.source },
      ...facts,
    };
  } catch { return null; }
}

export function getReportedScoreSequence(game: ScheduleGame): ReportedScoreSequence | null {
  return validateReviewedReportedScoreSequence(rawFacts, game);
}
