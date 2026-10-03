import { isSeasonHeatmapIdentity, loadSeasonHeatmapArchive } from "@/lib/verified-season-heatmap-archive";

export const runtime = "nodejs";

/** Read-only, app-owned aggregate lookup. There is no upstream request or fallback. */
export function GET(request: Request): Response {
  let identity;
  try {
    const params = new URL(request.url).searchParams;
    const keys = ["playerId", "season", "seasonType"];
    if ([...params.keys()].length !== keys.length || keys.some(key => params.getAll(key).length !== 1)) throw new Error("Invalid query");
    const playerId = params.get("playerId");
    if (playerId === null || !/^[1-9]\d*$/.test(playerId)) throw new Error("Invalid player");
    identity = { playerId: Number(playerId), season: params.get("season"), seasonType: params.get("seasonType") };
    if (!isSeasonHeatmapIdentity(identity)) throw new Error("Invalid identity");
  } catch {
    return Response.json({ status: "error" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = loadSeasonHeatmapArchive(identity);
  return Response.json(result, {
    status: result.status === "ready" ? 200 : result.status === "unavailable" ? 404 : 503,
    headers: { "Cache-Control": result.status === "ready" ? "public, max-age=3600" : "no-store" },
  });
}
