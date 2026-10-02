import { NextRequest, NextResponse } from "next/server";
import { findESPNId, getESPNCareerStats } from "@/lib/espn";
import { STATS_BASE, fetchStats } from "@/lib/statsProxy";
import { normalizePlayerCareerData } from "@/lib/player-career-data";

// Bound the entire serial chain, including response bodies, before the host or
// the client's 18s deadline can interrupt an otherwise successful fallback.
export const maxDuration = 20;
const REQUEST_TIMEOUT_MS = 14000;
const CAREER_COLUMNS = ["SEASON_ID", "TEAM_ABBREVIATION", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT"];

// A present but malformed table must not be mistaken for a valid empty history.
function parseResultSet(rs: { headers?: unknown; rowSet?: unknown } | undefined) {
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return null;
  const { headers, rowSet } = rs;
  if (!headers.every((h) => typeof h === "string") || new Set(headers).size !== headers.length
    || !CAREER_COLUMNS.every((h) => headers.includes(h))) return null;
  const rows: Record<string, unknown>[] = [];
  for (const row of rowSet) {
    if (!Array.isArray(row) || row.length < headers.length) return null;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
    rows.push(obj);
  }
  return normalizePlayerCareerData({ careerSeasons: rows })?.careerSeasons ?? null;
}

async function fetchCareerSeasons(playerId: string, signal: AbortSignal) {
  const res = await fetchStats(
    `${STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`,
    { key: "playercareerstats", timeoutMs: 4000, revalidate: 3600, signal },
  );
  if (!res?.ok) return null;
  try {
    const data = await res.json();
    if (signal.aborted) return null;
    if (!Array.isArray(data?.resultSets)) return null;
    const rs = data.resultSets.find((r: { name?: string } | null) => r?.name === "SeasonTotalsRegularSeason");
    return parseResultSet(rs);
  } catch {
    return null;
  }
}

async function resolveCareerSeasons(playerId: string, playerName: string | null, teamTricode: string | null, signal: AbortSignal) {
  const careerSeasons = await fetchCareerSeasons(playerId, signal);
  // A validated empty history is a successful answer, not a provider failure.
  if (careerSeasons !== null || !playerName || !teamTricode || signal.aborted) return careerSeasons;
  try {
    const espnId = await findESPNId(playerName, teamTricode, signal);
    if (espnId && !signal.aborted) {
      const espnResult = await getESPNCareerStats(espnId, signal);
      return normalizePlayerCareerData(espnResult)?.careerSeasons ?? null;
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
    const careerSeasons = await Promise.race([
      resolveCareerSeasons(playerId, playerName, teamTricode, signal), aborted,
    ]);

    if (careerSeasons === null || signal.aborted) {
      return NextResponse.json({ error: "Career data unavailable", careerSeasons: null, recentGames: null }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    // Keep the successful response shape compatible with existing consumers.
    return NextResponse.json({ careerSeasons, recentGames: null }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
  }
}
