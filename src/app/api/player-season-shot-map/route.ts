import { loadHistoricalShotMap } from "@/lib/historical-shot-spatial";
import { SHOT_MAP_GEOMETRY_VERSION } from "@/lib/season-shot-map";
import { isSeasonHeatmapIdentity } from "@/lib/verified-season-heatmap-archive";
export const runtime = "nodejs";

/** App-owned immutable spatial bins. No upstream request, coordinate guessing, or aggregate fallback. */
export async function GET(request: Request): Promise<Response> {
  let identity;
  try {
    const params = new URL(request.url).searchParams, keys = ["playerId", "season", "seasonType", "geometry"];
    if ([...params.keys()].length !== keys.length || keys.some(key => params.getAll(key).length !== 1) || params.get("geometry") !== SHOT_MAP_GEOMETRY_VERSION) throw new Error("Invalid query");
    const id = params.get("playerId"); if (!id || !/^[1-9]\d*$/.test(id)) throw new Error("Invalid player");
    identity = { playerId: Number(id), season: params.get("season"), seasonType: params.get("seasonType") };
    if (!isSeasonHeatmapIdentity(identity)) throw new Error("Invalid identity");
  } catch { return Response.json({ status: "error" }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  const resource = await loadHistoricalShotMap(identity);
  return Response.json(resource, { status: resource.status === "ready" ? 200 : resource.status === "unavailable" ? 404 : 503, headers: { "Cache-Control": resource.status === "ready" ? "public, max-age=3600, s-maxage=86400" : "no-store" } });
}
