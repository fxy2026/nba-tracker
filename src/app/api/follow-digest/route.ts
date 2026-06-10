import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayerInfo } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { CURRENT_SEASON } from "@/lib/constants";
import {
  buildTeamDigests,
  teamNextGame,
  parseLatestPlayerLine,
} from "@/lib/follow-digest";
import type { FollowDigest, PlayerDigest } from "@/lib/follow-digest-types";

// Players hit stats.nba.com (slow cold upstream) — give the route headroom,
// matching /api/stats. Teams alone come from the in-memory schedule cache.
export const maxDuration = 30;

// stats.nba.com — same upstream the /api/stats proxy targets. Called directly
// here so a server-side fetch's Next data-cache is shared across visitors.
const STATS_BASE = "https://stats.nba.com/stats";
const STATS_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

// Bound cost: cap how many entries we'll process per request.
const MAX_TEAMS = 30;
const MAX_PLAYERS = 30;
// Per-player upstream timeout — stats.nba.com can hang. Fail this player fast
// and degrade (lastLine=null) rather than blow the whole route's budget.
const PLAYER_TIMEOUT_MS = 7000;

function parseIdList(raw: string | null, max: number): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

// Fetch + parse one player's most recent playergamelog row. Any failure
// (timeout, non-2xx, blackholed endpoint, malformed JSON) → null so the
// player still appears in the digest, just without a last line.
async function fetchLastLine(personId: number) {
  const qs = new URLSearchParams({
    PlayerID: String(personId),
    Season: CURRENT_SEASON,
    SeasonType: "Regular Season",
  });
  try {
    const res = await fetch(`${STATS_BASE}/playergamelog?${qs}`, {
      headers: STATS_HEADERS,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(PLAYER_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseLatestPlayerLine(data);
  } catch {
    return null;
  }
}

// Build one PlayerDigest. Resilient: a single player's failure degrades that
// entry (lastLine/team/avg may be partial) but never rejects.
async function buildPlayerDigest(
  schedule: Awaited<ReturnType<typeof getFullSchedule>>,
  personId: number,
): Promise<PlayerDigest> {
  // Name/team/season-avg from the player index; gamelog from stats.nba.com —
  // run both so a slow gamelog doesn't serialize behind the (cached) index.
  const [info, lastLine] = await Promise.all([
    getPlayerInfo(personId).catch(() => null),
    fetchLastLine(personId),
  ]);

  const tricode = info?.teamAbbr?.toUpperCase() ?? "";
  const meta = TEAM_META[tricode];
  const name = info ? `${info.firstName} ${info.lastName}`.trim() : String(personId);
  // Player index pts/reb/ast are season per-game averages — surface only when
  // the player actually has a season (any non-zero), else null.
  const seasonAvg =
    info && (info.pts || info.reb || info.ast)
      ? { pts: info.pts, reb: info.reb, ast: info.ast }
      : null;

  return {
    personId,
    name,
    teamTricode: meta?.tricode ?? tricode,
    teamId: meta?.teamId ?? info?.teamId ?? 0,
    lastLine,
    nextGame: meta ? teamNextGame(schedule, meta.tricode) : null,
    seasonAvg,
  };
}

export async function GET(request: NextRequest) {
  const teamCodes = parseIdList(request.nextUrl.searchParams.get("teams"), MAX_TEAMS);
  const playerIds = parseIdList(request.nextUrl.searchParams.get("players"), MAX_PLAYERS)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

  // Schedule cache is cheap (in-memory after warm-up) and shared by both sections.
  let schedule: Awaited<ReturnType<typeof getFullSchedule>> = [];
  try {
    schedule = await getFullSchedule();
  } catch {
    schedule = [];
  }

  const teams = buildTeamDigests(schedule, teamCodes);

  // Players run concurrently; each settles independently so one hang/timeout
  // can't drop the others (allSettled never rejects).
  const settled = await Promise.allSettled(
    playerIds.map((id) => buildPlayerDigest(schedule, id)),
  );
  const players: PlayerDigest[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      players.push(r.value);
    } else {
      // Last-resort degrade: keep the id visible with everything blank.
      players.push({
        personId: playerIds[i],
        name: String(playerIds[i]),
        teamTricode: "",
        teamId: 0,
        lastLine: null,
        nextGame: null,
        seasonAvg: null,
      });
    }
  }

  const digest: FollowDigest = { teams, players };
  return NextResponse.json(digest, {
    // Per-game data: short edge cache + a slightly longer stale window so a
    // burst of followers shares one upstream refresh.
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
