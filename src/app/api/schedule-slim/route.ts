import { NextResponse } from "next/server";
import { getCachedScheduleFeed } from "@/lib/api";

// Serves the projected (sub-2MB) schedule so pages can pull it through the
// Next data cache instead of every lambda downloading the 11MB CDN feed.
// MUST NOT call getFullSchedule — that function fetches this route.
export async function GET() {
  const feed = await getCachedScheduleFeed();
  if (feed.dates.length === 0) {
    // Never let an empty answer stick in the CDN for 2h — callers fall back
    // to the direct CDN fetch on non-200.
    return NextResponse.json(feed, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400" },
  });
}
