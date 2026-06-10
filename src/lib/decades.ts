// Single source of truth for the iconic-games / iconic-seasons decade
// taxonomy. The populated-decade lists are derived from the datasets so an
// empty decade is never advertised — a hardcoded copy once put the 404ing
// /iconic-games/1970s in the sitemap.
import { ICONIC_GAMES, type IconicGame } from "@/lib/iconicGames";
import { ICONIC_SEASONS, type IconicSeason } from "@/lib/iconicSeasons";

export const DECADE_SLUGS = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;
export type DecadeSlug = (typeof DECADE_SLUGS)[number];

export function decadeOfYear(year: number): DecadeSlug {
  return `${Math.floor(year / 10) * 10}s` as DecadeSlug;
}

export function gamesForDecade(slug: DecadeSlug): IconicGame[] {
  return ICONIC_GAMES
    .filter((g) => decadeOfYear(parseInt(g.date.slice(0, 4), 10)) === slug)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function seasonsForDecade(slug: DecadeSlug): IconicSeason[] {
  return ICONIC_SEASONS
    .filter((s) => decadeOfYear(s.seasonYear) === slug)
    .sort((a, b) => a.seasonYear - b.seasonYear);
}

export const GAME_DECADES: DecadeSlug[] = DECADE_SLUGS.filter((d) => gamesForDecade(d).length > 0);
export const SEASON_DECADES: DecadeSlug[] = DECADE_SLUGS.filter((d) => seasonsForDecade(d).length > 0);
