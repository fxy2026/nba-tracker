import type { MetadataRoute } from "next";
import { TEAM_META } from "@/lib/teams";
import { OFFICIAL_PLAYER_IDENTITIES } from "@/lib/official-player-registry";
import { getSitemapGameCatalog } from "@/lib/sitemap-catalog";
import { GAME_DECADES, SEASON_DECADES } from "@/lib/decades";

const BASE = "https://nba.xpy.me";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
type SitemapEntry = MetadataRoute.Sitemap[number];

// Bundled catalogs change on deployment. Keep this metadata route prerendered
// and fail the build if a future edit accidentally adds request-time data.
export const dynamic = "error";

export default function sitemap(): MetadataRoute.Sitemap {
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
    { url: `${BASE}/shot-archive`, changeFrequency: "monthly", priority: 0.6 },
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
    { url: `${BASE}/about`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // All 30 team pages
  const teamPages: SitemapEntry[] = Object.keys(TEAM_META).map((tricode) => ({
    url: `${BASE}/team/${tricode}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // The same bundled schedule and validated observed finals used by game
  // pages. Never fetch the NBA/ESPN feed to discover URLs while building or
  // serving sitemap.xml, and never invent IDs for the planned-fixture PDF.
  const catalog = getSitemapGameCatalog();
  const gamePages: SitemapEntry[] = catalog.games.map((game) => ({
    url: `${BASE}/game/${game.id}`,
    changeFrequency: game.finished ? "monthly" : "daily",
    priority: game.finished ? 0.5 : 0.6,
  }));
  const seriesPages: SitemapEntry[] = catalog.seriesIds.map((id) => ({
    url: `${BASE}/series/${id}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // Every canonical ID in the reviewed registry resolves to a player profile.
  // This registry covers the bundled current, historical-shot and legend IDs;
  // coverage tests require it to remain a superset when those catalogs change.
  // It needs no API fallback or optional compressed shooting archive.
  const playerPages: SitemapEntry[] = OFFICIAL_PLAYER_IDENTITIES.map((player) => ({
    url: `${BASE}/player/${player.id}`,
    changeFrequency: "weekly",
    priority: 0.5,
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

  // No source tracks a page's last significant content change. Event dates,
  // registry retrieval dates and the current clock are not that timestamp.
  // Omit lastModified until a genuine per-page revision record is available.
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
    ...iconicSeasonsIndex,
  ];
}
