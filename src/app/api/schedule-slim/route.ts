import { NextResponse } from "next/server";
import { getCachedScheduleFeed } from "@/lib/api";
import scheduleProjection from "@/data/schedule-projection-revision.json";

// Serves the projected (sub-2MB) schedule so pages can pull it through the
// Next data cache instead of every lambda downloading the 11MB CDN feed.
// MUST NOT call getFullSchedule — that function fetches this route.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  // Do not cache this deployment's data under another deployment's identity.
  // A preview or rollout may reach a different build through the public URL.
  if ((query.has("schema") && query.get("schema") !== String(scheduleProjection.schema)) ||
      (query.has("revision") && query.get("revision") !== scheduleProjection.revision)) {
    return NextResponse.json({ error: "Schedule projection revision mismatch", ...scheduleProjection }, {
      status: 409, headers: { "Cache-Control": "no-store" },
    });
  }
  const feed = { ...await getCachedScheduleFeed(), ...scheduleProjection };
  if (feed.dates.length === 0) {
    // Never let an empty answer stick in the CDN for 2h — callers fall back
    // to the direct CDN fetch on non-200.
    return NextResponse.json(feed, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400" },
  });
}
