import { NextResponse } from "next/server";
import { resolvePlayerIdentity } from "@/lib/player-identity-server";
import { getPlayerSeasonHeatmapCatalog } from "@/lib/season-heatmap-catalog-server";
import { canonicalPlayerArchiveHref, type PlayerProfileQuery } from "@/lib/player-profile-navigation";

/** A handler guarantees HTTP 308 before any page loading boundary can stream. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const player = await resolvePlayerIdentity(id);
  if (!player) return new NextResponse("Player not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  const url = new URL(request.url), query: PlayerProfileQuery = {};
  for (const key of ["season", "seasonType"]) {
    const values = url.searchParams.getAll(key);
    if (values.length) query[key] = values.length === 1 ? values[0] : values;
  }
  const catalog = await getPlayerSeasonHeatmapCatalog(player.id);
  return NextResponse.redirect(new URL(canonicalPlayerArchiveHref(player.id, catalog, query), request.url), 308);
}
