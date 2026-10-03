import { NextResponse } from "next/server";
import { getPlayerIdentityDirectory } from "@/lib/player-identity-server";
import { searchPlayerIdentities } from "@/lib/player-identity";
import { canSearchPlayers } from "@/lib/player-search-ui";

/** Small server-side identity lookup shared by the homepage and full search page. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").slice(0, 100).trim();
  const requestedLimit = Number(params.get("limit") ?? 8);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(30, Math.floor(requestedLimit))) : 8;
  if (!canSearchPlayers(query)) return NextResponse.json({ data: [] }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  try {
    const directory = await getPlayerIdentityDirectory();
    const data = searchPlayerIdentities(directory, query).slice(0, limit);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Player search is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
