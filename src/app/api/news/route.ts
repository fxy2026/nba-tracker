import { NextRequest, NextResponse } from "next/server";

// ESPN's public undocumented API — free, no key needed
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

interface EspnCategory {
  type?: string;
  description?: string;
  teamId?: number;
  abbreviation?: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const rawLimit = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    // Fetch general NBA news from ESPN (5s timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ESPN_NEWS}?limit=${limit}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 600 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return NextResponse.json({ data: [] });
    const data = await res.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    // Filter by player name if query provided
    let filtered = articles;
    if (query) {
      const q = query.toLowerCase();
      filtered = articles.filter((a: { headline?: string; description?: string }) => {
        const text = `${a.headline || ""} ${a.description || ""}`.toLowerCase();
        // Match any part of the name
        return q.split(" ").some((word: string) => word.length > 2 && text.includes(word));
      });
    }

    // Query path stays capped at 5 (PlayerNews/FavoritesDashboard tuned to it);
    // the general feed honors ?limit for the offseason hero and future consumers.
    const sliceCount = query ? 5 : limit;

    const result = filtered.slice(0, sliceCount).map((a: {
      headline?: string;
      description?: string;
      links?: { web?: { href?: string } };
      published?: string;
      images?: { url?: string }[];
      categories?: EspnCategory[];
    }) => ({
      headline: a.headline || "",
      description: a.description || "",
      link: a.links?.web?.href || "",
      published: a.published ? new Date(a.published).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) : "",
      image: a.images?.[0]?.url || "",
      categories: (a.categories || [])
        .filter((c) => c.type === "team" || c.type === "athlete" || c.type === "topic")
        .map((c) => ({ type: c.type || "", label: c.description || "", teamId: c.teamId, abbr: c.abbreviation })),
    }));

    return NextResponse.json({ data: result }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
