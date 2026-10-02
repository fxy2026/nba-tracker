import type { ScheduleGame } from "@/lib/api";

/** Select one evidenced playoff season, never combine years or replace results
 * with a newer season's unplayed schedule. Safe for legacy cached API payloads. */
export function selectPlayoffSeason(games: ScheduleGame[]) {
  const bySeason = new Map<string, ScheduleGame[]>();
  const seen = new Set<string>();
  for (const game of games) {
    if (!/^004\d{2}00[1-4][0-7][1-7]$/.test(game.gameId) || game.gameStatus !== 3) continue;
    const round = Number(game.gameId[7]);
    if (Number(game.gameId[8]) >= 2 ** (4 - round)) continue;
    const home = game.homeTeam.score;
    const away = game.awayTeam.score;
    if (!Number.isSafeInteger(home) || !Number.isSafeInteger(away) || home < 0 || away < 0 || home === away) continue;
    if (seen.has(game.gameId)) continue;
    seen.add(game.gameId);
    const year = 2000 + Number(game.gameId.slice(3, 5));
    const season = `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
    const selected = bySeason.get(season) ?? [];
    selected.push(game);
    bySeason.set(season, selected);
  }
  const season = [...bySeason.keys()].sort().at(-1) ?? null;
  return { season, games: season ? bySeason.get(season)! : [] };
}
