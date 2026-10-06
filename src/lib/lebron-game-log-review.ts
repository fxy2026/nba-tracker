import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import manifest from "@/data/player-game-log-archives/lebron-review-manifest.json";
import { normalizePlayerGameLog, type PlayerGameLogData, type PlayerLogRow, type PlayerLogStat, type PlayerLogSupplementSource } from "./player-game-log-data";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const sameIdentity = (a: PlayerGameLogData, b: PlayerGameLogData) => a.playerId === b.playerId && a.season === b.season && a.seasonType === b.seasonType;
const sameGame = (a: PlayerLogRow, b: PlayerLogRow) => a.date === b.date && a.team === b.team && a.opponent === b.opponent && a.home === b.home && a.wl === b.wl;
const counting: PlayerLogStat[] = ["pts", "reb", "ast", "stl", "blk", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "tov", "pf"];
const uniqueGames = (rows: PlayerLogRow[]) => new Set(rows.map(row => row.date)).size === rows.length
  && new Set(rows.filter(row => row.nbaGameId).map(row => row.nbaGameId)).size === rows.filter(row => row.nbaGameId).length;

/** Apply only the reviewed delta bound to the original ESPN source hash. */
export function applyLeBronGameLogReview(data: PlayerGameLogData, review: unknown, sourceSha256: string): PlayerGameLogData | null {
  if (!object(review) || review.schemaVersion !== 1 || review.playerId !== 2544 || data.playerId !== 2544
    || data.source.provider !== "ESPN" || !data.source.archived || !Array.isArray(review.seasons)) return null;
  const seasons = review.seasons.filter(entry => object(entry) && entry.season === data.season);
  if (seasons.length !== 1 || seasons[0].sourceSha256 !== sourceSha256 || !Array.isArray(seasons[0].phases)) return null;
  const phases = seasons[0].phases.filter((entry: unknown) => object(entry) && entry.seasonType === data.seasonType);
  if (phases.length !== 1) return null;
  const phase = phases[0];
  if (!Array.isArray(phase.aliases) || !Array.isArray(phase.supplements) || !Number.isSafeInteger(phase.rows)) return null;
  const rows = data.rows.map(row => ({ ...row }));
  const seenAliases = new Set<string>();
  for (const alias of phase.aliases) {
    if (!object(alias) || typeof alias.id !== "string" || seenAliases.has(alias.id)) return null;
    const row = rows.find(row => row.id === alias.id);
    const prefix = `${data.seasonType === "Playoffs" ? "004" : "002"}${data.season.slice(2, 4)}`;
    if (!row || row.date !== alias.date || row.home !== alias.home || row.team !== alias.sourceTeam || row.opponent !== alias.sourceOpponent
      || alias.team !== row.team || !["NJ:NJN", "NOP:NOH", "NOP:NOK"].includes(`${alias.sourceOpponent}:${alias.opponent}`)
      || typeof alias.nbaGameId !== "string" || !new RegExp(`^${prefix}\\d{5}$`).test(alias.nbaGameId)) return null;
    row.historicalIdentity = { sourceTeam: row.team, sourceOpponent: row.opponent };
    row.opponent = String(alias.opponent);
    seenAliases.add(alias.id);
  }
  const supplement = phase.supplementSource as PlayerLogSupplementSource | undefined;
  for (const row of phase.supplements) {
    if (!object(row) || row.sourceProvider !== "StatMuse" || row.internalGameId !== null || row.sourceUrl !== supplement?.url) return null;
    rows.push(row as unknown as PlayerLogRow);
  }
  if (phase.assistReview !== undefined) {
    const fix = phase.assistReview;
    if (!object(fix) || !supplement) return null;
    const row = rows.find(row => row.id === fix.id);
    if (!row || row.date !== fix.date || row.team !== fix.team || row.opponent !== fix.opponent || row.home !== fix.home || row.ast !== fix.sourceValue
      || fix.sourceValue !== 5 || fix.reviewedValue !== 4) return null;
    row.ast = 4;
    row.assistReview = { ...supplement, sourceValue: 5, reviewedValue: 4, basis: "season-total-reconciliation" };
  }
  if (rows.length !== phase.rows || !uniqueGames(rows)) return null;
  if (data.seasonType === "Regular Season") {
    if (!object(phase.totals) || counting.some(key => rows.some(row => row[key] === null)
      || rows.reduce((sum, row) => sum + row[key]!, 0) !== phase.totals[key])) return null;
  }
  return normalizePlayerGameLog({ ...data, rows, source: { ...data.source, provider: supplement ? "ESPN + StatMuse" : "ESPN", reviewed: true, ...(supplement ? { supplement } : {}) } }, data);
}

export async function withLeBronGameLogReview(data: PlayerGameLogData, sourceSha256: string): Promise<PlayerGameLogData | null> {
  if (data.playerId !== 2544 || !manifest.seasons.includes(data.season)) return data;
  try {
    const bytes = gunzipSync(await readFile(join(process.cwd(), "src/data/player-game-log-archives", manifest.file)), { maxOutputLength: 2 * 1024 * 1024 });
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256) return null;
    return applyLeBronGameLogReview(data, JSON.parse(bytes.toString("utf8")), sourceSha256);
  } catch { return null; }
}

/** Equal counts alone do not establish equivalent game coverage. */
export function sameReviewedGameLogCoverage(a: PlayerGameLogData, b: PlayerGameLogData): boolean {
  return sameIdentity(a, b) && a.rows.length === b.rows.length && a.rows.every(row => b.rows.some(other => sameGame(row, other)));
}

/** Refresh may add valid records, but must not silently discard reviewed corrections. */
export function reconcileReviewedEspnGameLog(fresh: PlayerGameLogData, archive: PlayerGameLogData): PlayerGameLogData | null {
  if (!sameIdentity(fresh, archive) || !archive.source.reviewed || fresh.source.provider !== "ESPN") return fresh;
  const rows = fresh.rows.map(row => ({ ...row }));
  if (!uniqueGames(rows)) return null;
  for (const saved of archive.rows) {
    if (saved.sourceProvider === "StatMuse") continue;
    const row = rows.find(row => row.id === saved.id);
    if (!row) {
      if (saved.historicalIdentity || saved.assistReview) return null;
      continue;
    }
    if (saved.historicalIdentity) {
      if (row.date !== saved.date || row.home !== saved.home || row.wl !== saved.wl
        || row.team !== saved.team || ![saved.opponent, saved.historicalIdentity.sourceOpponent].includes(row.opponent)) return null;
      row.opponent = saved.opponent;
      row.historicalIdentity = saved.historicalIdentity;
    }
    if (saved.assistReview) {
      if (!sameGame(row, saved) || ![saved.assistReview.sourceValue, saved.assistReview.reviewedValue].includes(row.ast as 4 | 5)) return null;
      row.ast = saved.assistReview.reviewedValue;
      row.assistReview = saved.assistReview;
    }
  }
  for (const saved of archive.rows.filter(row => row.sourceProvider === "StatMuse")) {
    const sameDate = rows.filter(row => row.date === saved.date);
    if (!sameDate.length) rows.push(saved);
    else if (sameDate.length !== 1 || !sameGame(sameDate[0], saved)
      || counting.some(key => saved[key] !== null && sameDate[0][key] !== saved[key])) return null;
  }
  if (!uniqueGames(rows)) return null;
  const mixed = rows.some(row => row.sourceProvider === "StatMuse" || row.assistReview);
  return normalizePlayerGameLog({ ...fresh, rows, expectedGames: fresh.expectedGames && fresh.expectedGames >= rows.length ? fresh.expectedGames : undefined,
    source: { ...fresh.source, provider: mixed ? "ESPN + StatMuse" : "ESPN", reviewed: true, ...(mixed ? { supplement: archive.source.supplement } : {}) } }, fresh);
}
