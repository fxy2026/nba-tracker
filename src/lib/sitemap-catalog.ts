import "server-only";
import schedule from "@/data/schedule-2025-26.json";
import observedFinals from "@/data/observed-final-games.json";
import { observedFinalsToSchedule } from "./observed-final-schedule";
import { TEAM_META } from "./teams";

interface CatalogGame {
  gameId: string;
  gameStatus: number;
  ifNecessary?: boolean;
  homeTeam: { teamId: number; teamTricode: string };
  awayTeam: { teamId: number; teamTricode: string };
}

/** Only concrete canonical NBA game identities backed by local page data.
 * Exhibition games, unknown teams, redirects and if-needed placeholders are
 * not search targets. A planned fixture's source number is not an NBA ID. */
export function sitemapGameCatalog(dates: readonly { games: readonly CatalogGame[] }[]) {
  const games = new Map<string, { id: string; finished: boolean }>();
  const series = new Set<string>();
  for (const day of dates) {
    for (const game of day.games) {
      if (!/^00[2456]\d{7}$/.test(game.gameId)
        || ![1, 2, 3].includes(game.gameStatus)
        || (game.ifNecessary === true && game.gameStatus === 1)
        || game.homeTeam.teamId === game.awayTeam.teamId
        || TEAM_META[game.homeTeam.teamTricode]?.teamId !== game.homeTeam.teamId
        || TEAM_META[game.awayTeam.teamTricode]?.teamId !== game.awayTeam.teamId) continue;
      const finished = game.gameStatus === 3 || games.get(game.gameId)?.finished === true;
      games.set(game.gameId, { id: game.gameId, finished });
      // The series route derives its members from these exact NBA IDs.
      if (finished && game.gameId.startsWith("004")) series.add(game.gameId.slice(0, 9));
    }
  }
  return {
    games: [...games.values()].sort((a, b) => a.id.localeCompare(b.id)),
    seriesIds: [...series].sort(),
  };
}

export function getSitemapGameCatalog() {
  return sitemapGameCatalog([...schedule.dates, ...observedFinalsToSchedule(observedFinals)]);
}
