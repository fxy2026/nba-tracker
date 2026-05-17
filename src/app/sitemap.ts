import type { MetadataRoute } from "next";
import { TEAM_META } from "@/lib/teams";

const BASE = "https://nba.xpy.me";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export default function sitemap(): MetadataRoute.Sitemap {
  // Core, high-priority pages updated frequently
  const live: { url: string; changeFrequency: ChangeFreq; priority: number }[] = [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/calendar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/schedule`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/schedule-heatmap`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/game-predictor`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/back-to-back`, changeFrequency: "daily", priority: 0.5 },
  ];

  // League / standings views
  const standings: { url: string; changeFrequency: ChangeFreq; priority: number }[] = [
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
  const leaders: { url: string; changeFrequency: ChangeFreq; priority: number }[] = [
    { url: `${BASE}/stats`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/awards-race`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/all-time-leaders`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/milestones`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/clutch`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/best-games`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/records`, changeFrequency: "weekly", priority: 0.5 },
  ];

  // Player browse hubs
  const players: { url: string; changeFrequency: ChangeFreq; priority: number }[] = [
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
  const news: { url: string; changeFrequency: ChangeFreq; priority: number }[] = [
    { url: `${BASE}/injuries`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/transactions`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/this-day`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/history`, changeFrequency: "yearly", priority: 0.4 },
  ];

  // Tools & meta
  const tools: { url: string; changeFrequency: ChangeFreq; priority: number }[] = [
    { url: `${BASE}/explore`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/glossary`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/quiz`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/favorites`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${BASE}/about`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // All 30 team pages
  const teamPages = Object.keys(TEAM_META).map((tricode) => ({
    url: `${BASE}/team/${tricode}`,
    changeFrequency: "daily" as ChangeFreq,
    priority: 0.7,
  }));

  const now = new Date();
  return [
    ...live,
    ...standings,
    ...leaders,
    ...players,
    ...news,
    ...tools,
    ...teamPages,
  ].map((p) => ({ ...p, lastModified: now }));
}
