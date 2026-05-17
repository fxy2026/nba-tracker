import { NextResponse } from "next/server";

const ESPN_INJURIES =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(ESPN_INJURIES, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 1800 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ data: [] }, { status: 502 });
    }

    const json = await res.json();
    // ESPN returns { injuries: [...teams], season: {...} }
    return NextResponse.json({ data: json.injuries || [] }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json({ data: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
