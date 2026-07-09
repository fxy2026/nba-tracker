import type { MetadataRoute } from "next";
import { TEAM_META } from "@/lib/teams";
import { getFullSchedule, getPlayerIndex } from "@/lib/api";
import { isPlayoff, isPreseason } from "@/lib/games";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { GAME_DECADES, SEASON_DECADES } from "@/lib/decades";

const BASE = "https://nba.xpy.me";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
type SitemapEntry = { url: string; changeFrequency: ChangeFreq; priority: number; lastModified?: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Core, high-priority pages updated frequently
  const live: SitemapEntry[] = [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/calendar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/schedule`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/schedule-heatmap`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/game-predictor`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/back-to-back`, changeFrequency: "daily", priority: 0.5 },
  ];

  // League / standings views
  const standings: SitemapEntry[] = [
    { url: `${BASE}/standings`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/conference-race`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/divisions`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/power-rankings`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/tier-list`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/streaks`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/momentum`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/clutch-teams`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/scoring-output`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/team-stats`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/home-vs-road`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/rivalries`, changeFrequency: "weekly", priority: 0.5 },
  ];

  // Awards & leaders
  const leaders: SitemapEntry[] = [
    { url: `${BASE}/stats`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/awards-race`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/all-time-leaders`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/milestones`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/clutch`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/best-of-night`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/lab`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/lab/team-trajectory`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/lab/career-arc`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/lab/game-impact`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/lab/explore`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/best-games`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/records`, changeFrequency: "weekly", priority: 0.5 },
  ];

  // Player browse hubs
  const playerHubs: SitemapEntry[] = [
    { url: `${BASE}/search`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/compare`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/h2h`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/rookie-watch`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/draft-classes`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/draft/2026`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/by-position`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/by-country`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/by-college`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // News & history
  const news: SitemapEntry[] = [
    { url: `${BASE}/news`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/injuries`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/transactions`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/this-day`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/history`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/season/2025-26`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Tools & meta
  const tools: SitemapEntry[] = [
    { url: `${BASE}/explore`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/glossary`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/quiz`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/favorites`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${BASE}/about`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // All 30 team pages
  const teamPages: SitemapEntry[] = Object.keys(TEAM_META).map((tricode) => ({
    url: `${BASE}/team/${tricode}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // Dynamic: every individual game page (regular season + playoffs only, finished games
  // have the most SEO value because they have full box scores; upcoming games are useful too).
  const gamePages: SitemapEntry[] = [];
  const seriesPages: SitemapEntry[] = [];
  try {
    const schedule = await getFullSchedule();
    // Playoff series hubs — the 9-char series id is a playoff gameId minus
    // its final game digit. Only series with at least one finished game are
    // emitted, which skips TBD/ifNecessary placeholder rows.
    const seriesLatest = new Map<string, Date | undefined>();
    for (const gd of schedule) {
      for (const g of gd.games) {
        // Skip preseason (001) — those are exhibition vs international teams
        if (isPreseason(g.gameId)) continue;
        // Skip "if necessary" placeholder games (ghost games)
        if (g.ifNecessary === true && g.gameStatus === 1) continue;
        // Finished games freeze on their game date — feeding Google the real
        // date stops it treating every box score as "updated today" and lets
        // search results show accurate recency.
        const lastModified = g.gameStatus === 3 && g.gameDateTimeUTC
          ? new Date(g.gameDateTimeUTC)
          : undefined;
        gamePages.push({
          url: `${BASE}/game/${g.gameId}`,
          changeFrequency: g.gameStatus === 3 ? "monthly" : "daily",
          priority: g.gameStatus === 3 ? 0.5 : 0.6,
          lastModified,
        });
        if (g.gameStatus === 3 && isPlayoff(g.gameId)) {
          const seriesId = g.gameId.slice(0, 9);
          const prev = seriesLatest.get(seriesId);
          if (lastModified && (!prev || lastModified > prev)) seriesLatest.set(seriesId, lastModified);
          else if (!seriesLatest.has(seriesId)) seriesLatest.set(seriesId, undefined);
        }
      }
    }
    for (const [seriesId, lastModified] of seriesLatest) {
      seriesPages.push({
        url: `${BASE}/series/${seriesId}`,
        changeFrequency: "weekly",
        priority: 0.5,
        lastModified,
      });
    }
  } catch {
    // If schedule fetch fails during build, just skip game pages — they'll be indexed via crawl
  }

  // Dynamic: every active player profile
  const playerPages: SitemapEntry[] = [];
  try {
    const players = await getPlayerIndex();
    for (const p of players) {
      playerPages.push({
        url: `${BASE}/player/${p.personId}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch {
    // If player index fetch fails during build, skip — they'll be indexed via crawl
  }

  // Static: every retired legend with a verified personId (career snapshot page)
  const legendPages: SitemapEntry[] = ALL_TIME_LEADERS
    .filter((p) => !p.active && p.personId > 0)
    .map((p) => ({
      url: `${BASE}/legends/${p.personId}`,
      changeFrequency: "yearly" as ChangeFreq,
      priority: 0.6,
    }));

  // Iconic seasons + iconic games — gallery index pages. Individual cards
  // deep-link to /compare or /game from inside the gallery.
  const iconicSeasonsIndex: SitemapEntry[] = [
    { url: `${BASE}/iconic-seasons`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/iconic-games`, changeFrequency: "monthly", priority: 0.7 },
    // Per-decade landing pages — each is its own SEO target with an
    // editorial narrative and filtered card grid. The two routes have
    // independent decade coverage, derived from the datasets so an empty
    // decade (which the page 404s) is never advertised.
    ...SEASON_DECADES.map((d) => ({
      url: `${BASE}/iconic-seasons/${d}`,
      changeFrequency: "monthly" as ChangeFreq,
      priority: 0.6,
    })),
    ...GAME_DECADES.map((d) => ({
      url: `${BASE}/iconic-games/${d}`,
      changeFrequency: "monthly" as ChangeFreq,
      priority: 0.6,
    })),
  ];

  return [
    ...live,
    ...standings,
    ...leaders,
    ...playerHubs,
    ...news,
    ...tools,
    ...teamPages,
    ...gamePages,
    ...seriesPages,
    ...playerPages,
    ...legendPages,
    ...iconicSeasonsIndex,
  ].map((p) => ({ ...p, lastModified: p.lastModified || now }));
}
