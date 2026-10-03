import { NextRequest, NextResponse } from "next/server";
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";
import { parseCareerShootingTable } from "@/lib/career-shooting";
import { normalizePlayerCareerData, type PlayerCareerData } from "@/lib/player-career-data";
import type { LiveCareerProvenance } from "@/lib/player-career-provenance";

import { getReviewedCareerArchive } from "@/lib/player-career-archive";
import { coversArchivedCareer } from "@/lib/player-career-coverage";

// Bound the entire serial chain, including response bodies, before the host or
// the client's 18s deadline can interrupt an otherwise successful fallback.
export const maxDuration = 20;
const REQUEST_TIMEOUT_MS = 14000;
const CAREER_COLUMNS = ["SEASON_ID", "TEAM_ABBREVIATION", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT"];

function provenance(source: LiveCareerProvenance["source"], providerPlayerId: string): LiveCareerProvenance {
  // This is when the API read a successful response, potentially from Next's
  // data cache. Do not label it as the provider's last update or verifiedAt.
  return { source, providerPlayerId, scope: "regular-season", retrievalKind: "api-response", retrievedAt: new Date().toISOString() };
}

// A present but malformed table must not be mistaken for a valid empty history.
function parseResultSet(rs: { headers?: unknown; rowSet?: unknown } | undefined, playerId: number) {
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return null;
  const { headers, rowSet } = rs;
  if (!headers.every((h) => typeof h === "string") || new Set(headers).size !== headers.length
    || !CAREER_COLUMNS.every((h) => headers.includes(h))) return null;
  const rows: Record<string, unknown>[] = [];
  for (const row of rowSet) {
    if (!Array.isArray(row) || row.length < headers.length) return null;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    // Legacy tables may omit PLAYER_ID. If the provider does include identity,
    // it must agree with the requested player before we attribute this history.
    if ("PLAYER_ID" in obj && (typeof obj.PLAYER_ID !== "number"
      || !Number.isSafeInteger(obj.PLAYER_ID) || obj.PLAYER_ID !== playerId)) return null;
    rows.push(obj);
  }
  return normalizePlayerCareerData({ careerSeasons: rows })?.careerSeasons ?? null;
}

async function fetchCareerData(playerId: string, signal: AbortSignal) {
  try {
    const res = await fetchStats(
      `${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`,
      { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600, signal },
    );
    if (!res?.ok) return null;
    const data = await res.json();
    if (signal.aborted) return null;
    if (!Array.isArray(data?.resultSets)) return null;
    const rs = data.resultSets.find((r: { name?: string } | null) => r?.name === "SeasonTotalsRegularSeason");
    const careerSeasons = parseResultSet(rs, Number(playerId));
    if (careerSeasons === null) return null;
    const tables = data.resultSets.filter((row: {name?:string}|null) => row?.name === "CareerTotalsRegularSeason");
    const careerShooting = tables.length === 1 ? parseCareerShootingTable(tables[0], Number(playerId)) : null;
    return { careerSeasons, ...(careerShooting ? { careerShooting } : {}), provenance: provenance("nba-stats", playerId) };
  } catch {
    return null;
  }
}

async function resolveCareerData(playerId: string, playerName: string | null, teamTricode: string | null, signal: AbortSignal, archive?: PlayerCareerData) {
  const acceptable = (data: PlayerCareerData | null) => data !== null && (!archive || coversArchivedCareer(data, archive));
  const careerData = await fetchCareerData(playerId, signal);
  // Unknown players retain valid-empty behavior. A reviewed known history
  // establishes minimum coverage, so truncated/older responses try fallback.
  if (acceptable(careerData)) return careerData;
  if (!playerName || !teamTricode || signal.aborted) return null;
  try {
    const espnId = await findESPNId(playerName, teamTricode, signal);
    if (espnId && !signal.aborted) {
      const espnResult = await getESPNCareerStats(espnId, signal);
      const data = normalizePlayerCareerData(espnResult);
      return data && acceptable(data) && !signal.aborted ? { ...data, provenance: provenance("espn", espnId) } : null;
    }
  } catch { /* ESPN also failed */ }
  return null;
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  const playerName = request.nextUrl.searchParams.get("name");
  const teamTricode = request.nextUrl.searchParams.get("team");
  if (!playerId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!/^\d+$/.test(playerId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const archive = await getReviewedCareerArchive(playerId);
  const deadline = new AbortController();
  const timeout = setTimeout(() => deadline.abort(), REQUEST_TIMEOUT_MS);
  const signal = AbortSignal.any([deadline.signal, request.signal]);
  let onAbort: () => void = () => {};
  const aborted = new Promise<null>((resolve) => {
    onAbort = () => resolve(null);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    // Cancellation normally rejects fetch/body consumption. The race also
    // bounds a non-cooperative body and ignores any result arriving afterward.
    const careerData = await Promise.race([
      resolveCareerData(playerId, playerName ? archive?.playerName ?? playerName : null, teamTricode, signal, archive?.data), aborted,
    ]);

    // An aborted visitor has left. A provider/deadline failure may still use
    // the independently reviewed dated snapshot, without another source call.
    const result = request.signal.aborted ? null : careerData ?? archive?.data ?? null;
    if (result === null) {
      return NextResponse.json({ error: "Career data unavailable", careerSeasons: null, recentGames: null }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    // Keep the successful response shape compatible with existing consumers.
    return NextResponse.json({ ...result, recentGames: null }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
  }
}
