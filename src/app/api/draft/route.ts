import { NextRequest, NextResponse } from "next/server";
import { projectDraft, type DraftPick } from "@/lib/draft";

const ESPN_DRAFT = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/draft";

// Consumers key off picks[]; an unexpected ESPN body would otherwise be cached
// as "empty draft" for a day.
function isValidDraftFeed(json: unknown): json is { picks: unknown[] } {
  if (typeof json !== "object" || json === null) return false;
  return Array.isArray((json as { picks?: unknown }).picks);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("year");
  const year = /^\d{4}$/.test(raw || "") ? raw : "2026";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ESPN_DRAFT}?year=${year}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 86400 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ picks: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const json = await res.json();
    if (!isValidDraftFeed(json)) {
      return NextResponse.json({ picks: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const picks: DraftPick[] = projectDraft(json);
    return NextResponse.json({ picks }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
    });
  } catch {
    return NextResponse.json({ picks: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
