import { NextRequest, NextResponse } from "next/server";

// ESPN's public undocumented API — free, no key needed
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  try {
    // Fetch general NBA news from ESPN
    const res = await fetch(ESPN_NEWS, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      next: { revalidate: 600 }, // Cache 10 min
    });

    if (!res.ok) return NextResponse.json({ data: [] });
    const data = await res.json();
    const articles = data.articles || [];

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

    const result = filtered.slice(0, 5).map((a: {
      headline?: string;
      description?: string;
      links?: { web?: { href?: string } };
      published?: string;
      images?: { url?: string }[];
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
    }));

    return NextResponse.json({ data: result }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
