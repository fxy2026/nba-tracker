import { isSeasonHeatmapIdentity } from "@/lib/verified-season-heatmap-archive";
import { loadPlayerSeasonHeatmapArchive } from "@/lib/season-heatmap-catalog-server";

import { SEASON_HEATMAP_COURT_GEOMETRY_VERSION } from "@/lib/season-heatmap-court-zones";

export const runtime = "nodejs";

/** Read-only, app-owned aggregate lookup. There is no upstream request or fallback. */
export async function GET(request: Request): Promise<Response> {
  let identity;
  try {
    const params = new URL(request.url).searchParams;
    const keys = ["playerId", "season", "seasonType", ...(params.has("geometry") ? ["geometry"] : [])];
    if (params.has("geometry") && params.get("geometry") !== SEASON_HEATMAP_COURT_GEOMETRY_VERSION) throw new Error("Invalid geometry");
    if ([...params.keys()].length !== keys.length || keys.some(key => params.getAll(key).length !== 1)) throw new Error("Invalid query");
    const playerId = params.get("playerId");
    if (playerId === null || !/^[1-9]\d*$/.test(playerId)) throw new Error("Invalid player");
    identity = { playerId: Number(playerId), season: params.get("season"), seasonType: params.get("seasonType") };
    if (!isSeasonHeatmapIdentity(identity)) throw new Error("Invalid identity");
  } catch {
    return Response.json({ status: "error" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await loadPlayerSeasonHeatmapArchive(identity);
  return Response.json(result, {
    status: result.status === "ready" ? 200 : result.status === "unavailable" ? 404 : 503,
    headers: { "Cache-Control": result.status === "ready" ? "public, max-age=3600, s-maxage=86400" : "no-store" },
  });
}
