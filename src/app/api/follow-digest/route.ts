import { NextRequest, NextResponse } from "next/server";
import { getFullSchedule, getPlayerInfo, getBoxScore } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import {
  buildTeamDigests,
  teamNextGame,
  teamRecentFinishedGameIds,
  playerLineFromBoxScore,
} from "@/lib/follow-digest";
import type { FollowDigest, PlayerDigest, PlayerLine } from "@/lib/follow-digest-types";

// getBoxScore hits cdn.nba.com (reachable from Vercel); give headroom anyway.
export const maxDuration = 30;

// Bound cost: cap how many entries we'll process per request.
const MAX_TEAMS = 30;
const MAX_PLAYERS = 30;

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

// Build one PlayerDigest. Resilient: a single player's failure degrades that
// entry (lastLine/team/avg may be partial) but never rejects.
async function buildPlayerDigest(
  schedule: Awaited<ReturnType<typeof getFullSchedule>>,
  personId: number,
): Promise<PlayerDigest> {
  // Name/team/season-avg come from the in-app player index.
  const info = await getPlayerInfo(personId).catch(() => null);

  const tricode = info?.teamAbbr?.toUpperCase() ?? "";
  const meta = TEAM_META[tricode];

  // Last line: stats.nba.com playergamelog is blackholed from Vercel, so derive
  // it from the CDN box score (reachable). The literal last team game may be one
  // the player rested/DNP'd, so walk back the last few finished games until the
  // player actually appears. null = team unknown / no appearance found.
  let lastLine: PlayerLine | null = null;
  if (meta) {
    const recent = teamRecentFinishedGameIds(schedule, meta.tricode, 3);
    for (const gid of recent) {
      const box = await getBoxScore(gid).catch(() => null);
      const line = box ? playerLineFromBoxScore(box, personId) : null;
      if (line) {
        lastLine = line;
        break;
      }
    }
  }

  // Empty name = unresolved player (not in the active CDN index — retired /
  // two-way). The client localizes this to "Player #id" rather than a bare id.
  const name = info ? `${info.firstName} ${info.lastName}`.trim() : "";
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
      // Last-resort degrade: keep the entry with everything blank; empty name
      // signals the client to show a localized "Player #id" placeholder.
      players.push({
        personId: playerIds[i],
        name: "",
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
