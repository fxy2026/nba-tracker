// Server-only raw evidence. Never bundle archive payloads into client modules.
import { withLeBronGameLogReview } from "./lebron-game-log-review";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import catalog from "@/data/player-game-log-archives/manifest.json";
import { withEspnPlayerLogGamePages } from "./player-game-log-links";
import { parseEspnPlayerGameLog } from "./espn-player-game-log";
import { getReviewedCareerArchive } from "./player-career-archive";
import { getHistoricalCareerArchive } from "./historical-career-archive";
import { careerAggregationRows } from "./career-shooting";
import type { PlayerGameLogData, PlayerLogSeasonType } from "./player-game-log-data";
export function getPlayerLogArchiveSeasons(playerId: number): string[] {
  return catalog.filter(entry => entry.playerId === playerId).map(entry => entry.season).sort().reverse();
}
export async function withPlayerLogCoverage(data: PlayerGameLogData): Promise<PlayerGameLogData> {
  const [modern, historical] = await Promise.all([getReviewedCareerArchive(String(data.playerId)), getHistoricalCareerArchive(data.playerId)]);
  const row = data.seasonType === "Regular Season" ? careerAggregationRows(modern?.data.careerSeasons ?? [])?.find(row => row.SEASON_ID === data.season) : undefined;
  const total = row?.GP ?? historical?.rows.find(row => row.season === data.season && row.seasonType === data.seasonType)?.totals.GP;
  // A newer source can exceed an older dated season summary. Never treat that
  // older GP as a cap or manufacture missing games from a count difference.
  return total != null && Number.isSafeInteger(total) && total >= data.rows.length ? { ...data, expectedGames: total, coverage: total > data.rows.length ? "partial-source" : data.coverage } : data;
}
export async function getPlayerGameLogArchive(playerId: number, season: string, seasonType: PlayerLogSeasonType): Promise<PlayerGameLogData | null> {
  const entry = catalog.find(row => row.playerId === playerId && row.season === season);
  if (!entry) return null;
  try {
    const bytes = gunzipSync(await readFile(join(process.cwd(), "src/data/player-game-log-archives", entry.file)));
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) return null;
    const raw = JSON.parse(bytes.toString("utf8"));
    const data = parseEspnPlayerGameLog(raw, { playerId, season, seasonType }, entry.espnId, entry.retrievedAt, true);
    const reviewed = data ? await withLeBronGameLogReview(withEspnPlayerLogGamePages(data, raw), entry.sha256) : null;
    return reviewed ? withPlayerLogCoverage(reviewed) : null;
  } catch { return null; }
}
