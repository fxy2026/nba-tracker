import type { MetadataRoute } from "next";
import { TEAM_META } from "@/lib/teams";

const BASE = "https://nba.xpy.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: BASE, changeFrequency: "hourly" as const, priority: 1 },
    { url: `${BASE}/standings`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${BASE}/schedule`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${BASE}/stats`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${BASE}/injuries`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${BASE}/transactions`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${BASE}/calendar`, changeFrequency: "weekly" as const, priority: 0.6 },
    { url: `${BASE}/search`, changeFrequency: "weekly" as const, priority: 0.6 },
    { url: `${BASE}/compare`, changeFrequency: "weekly" as const, priority: 0.5 },
    { url: `${BASE}/clutch`, changeFrequency: "daily" as const, priority: 0.6 },
    { url: `${BASE}/history`, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${BASE}/h2h`, changeFrequency: "weekly" as const, priority: 0.5 },
    { url: `${BASE}/favorites`, changeFrequency: "weekly" as const, priority: 0.3 },
  ];

  const teamPages = Object.keys(TEAM_META).map((tricode) => ({
    url: `${BASE}/team/${tricode}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...teamPages];
}
