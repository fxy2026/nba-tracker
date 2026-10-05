import { withNbaPlayerLogGamePages } from "@/lib/player-game-log-links";
import { NextRequest, NextResponse } from "next/server";
import { parsePlayerId } from "@/lib/player-identity";
import { parseNbaPlayerGameLog, validLogSeason, type PlayerGameLogData, type PlayerLogSeasonType } from "@/lib/player-game-log-data";
import { getPlayerGameLogArchive, withPlayerLogCoverage } from "@/lib/player-game-log-archive";
import { fetchEspnPlayerGameLog } from "@/lib/player-game-log-source";
import { STATS_BASE, fetchStatsJson } from "@/lib/statsProxy";
export const maxDuration = 35;
const unavailable = () => NextResponse.json({ error: "Game-log source unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
const respond = (data: PlayerGameLogData) => NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
export async function GET(request: NextRequest) {
  const playerId = parsePlayerId(request.nextUrl.searchParams.get("playerId") ?? "");
  const season = request.nextUrl.searchParams.get("season");
  const seasonType = request.nextUrl.searchParams.get("seasonType") ?? "Regular Season";
  if (playerId === null || !validLogSeason(season) || !["Regular Season", "Playoffs", "Pre Season"].includes(seasonType)) return NextResponse.json({ error: "Invalid player, season or competition" }, { status: 400 });
  const identity = { playerId, season, seasonType: seasonType as PlayerLogSeasonType };
  const archive = await getPlayerGameLogArchive(playerId, season, identity.seasonType);
  if (request.signal.aborted) return unavailable();
  // Past reviewed records are available immediately, without a fragile live
  // prerequisite. Refresh is opt-in and can never replace fuller archived rows.
  if (archive && request.nextUrl.searchParams.get("refresh") !== "1") return respond(archive);
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), 28000);
  const signal = AbortSignal.any([request.signal, deadline.signal]);
  const query = new URLSearchParams({ PlayerID: String(playerId), Season: season, SeasonType: seasonType });
  const completed: PlayerGameLogData[] = [];
  let ready: () => void = () => {};
  const usable = new Promise<void>(resolve => { ready = resolve; });
  const record = async (task: Promise<PlayerGameLogData | null>) => {
    const data = await task;
    if (data && !signal.aborted) {
      completed.push(data);
      // Don't let an optional slow provider delay usable validated records.
      // A successful empty response still waits for the other provider.
      if (data.rows.length > 0) ready();
    }
    return data;
  };
  const nba = record((async () => {
    const result = await fetchStatsJson(`${STATS_BASE}/playergamelog?${query}`, { key: "playergamelog", timeoutMs: 3500, revalidate: 3600, signal });
    const data = result?.ok && !signal.aborted ? parseNbaPlayerGameLog(result.data, identity, new Date().toISOString()) : null;
    return data ? withNbaPlayerLogGamePages(data) : null;
  })());
  let onAbort: () => void = () => {};
  const aborted = new Promise<null>(resolve => { onAbort = () => resolve(null); if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true }); });
  try {
    await Promise.race([Promise.all([nba, record(fetchEspnPlayerGameLog(identity, signal))]), usable, aborted]);
    if (request.signal.aborted) return unavailable();
    const candidates = [...completed, archive].filter((data): data is PlayerGameLogData => data !== null);
    // Prefer more actual records, NBA on a tie. Do not merge providers or
    // silently deduplicate different ID systems without verified game identity.
    candidates.sort((a, b) => b.rows.length - a.rows.length || Number(b.source.provider === "NBA Stats") - Number(a.source.provider === "NBA Stats"));
    const selected = candidates[0];
    return selected ? respond(await withPlayerLogCoverage(selected)) : unavailable();
  } finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); deadline.abort(); }
}
