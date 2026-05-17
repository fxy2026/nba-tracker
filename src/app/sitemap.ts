import type { MetadataRoute } from "next";
import { TEAM_META } from "@/lib/teams";
import { getFullSchedule, getPlayerIndex } from "@/lib/api";
import { isPreseason } from "@/lib/games";

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
    { url: `${BASE}/by-position`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/by-country`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/by-college`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // News & history
  const news: SitemapEntry[] = [
    { url: `${BASE}/injuries`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/transactions`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/this-day`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/history`, changeFrequency: "yearly", priority: 0.4 },
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
  try {
    const schedule = await getFullSchedule();
    for (const gd of schedule) {
      for (const g of gd.games) {
        // Skip preseason (001) — those are exhibition vs international teams
        if (isPreseason(g.gameId)) continue;
        // Skip "if necessary" placeholder games (ghost games)
        if (g.ifNecessary === true && g.gameStatus === 1) continue;
        gamePages.push({
          url: `${BASE}/game/${g.gameId}`,
          changeFrequency: g.gameStatus === 3 ? "monthly" : "daily",
          priority: g.gameStatus === 3 ? 0.5 : 0.6,
        });
      }
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

  return [
    ...live,
    ...standings,
    ...leaders,
    ...playerHubs,
    ...news,
    ...tools,
    ...teamPages,
    ...gamePages,
    ...playerPages,
  ].map((p) => ({ ...p, lastModified: p.lastModified || now }));
}
