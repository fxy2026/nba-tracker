import { NextRequest, NextResponse } from "next/server";

// Dedicated proxy for stats.nba.com boxscorematchupsv3 (who-guarded-whom
// tracking data on finished games). Kept separate from /api/stats because the
// response is a nested v3 document (not headers/rowSet), so it gets parsed and
// slimmed server-side instead of being passed through raw (~10x smaller).
const UPSTREAM = "https://stats.nba.com/stats/boxscorematchupsv3";
const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

// Vercel kills functions at 10s by default — upstream needs longer cold.
export const maxDuration = 30;

// Matchup payloads are large like shotchartdetail — give upstream more time.
const TIMEOUT_MS = 20000;
// Finished-game matchups are immutable, but the feed lands with a lag after
// the final whistle — a 15-min upstream TTL keeps an early empty/partial
// answer from sticking, while the CDN Cache-Control below keeps rich
// responses cheap for browsers.
const UPSTREAM_REVALIDATE = 900;

// stats.nba.com blackholes this endpoint for some datacenter IPs (hangs until
// our abort). After a timeout, fail fast for 15 min per warm instance instead
// of burning a 20s invocation per visitor.
let blackholedUntil = 0;
const BLACKHOLE_TTL_MS = 15 * 60 * 1000;

// Relay (SJTU egress) reaches this endpoint; Vercel IPs are blackholed.
// The relay's campus IP rejects inbound from outside China (GFW), so it's
// unreachable from Vercel — production leaves these UNSET on purpose; only
// .env.local enables it for local development.
const RELAY_URL = process.env.STATS_RELAY_URL;
const RELAY_TOKEN = process.env.STATS_RELAY_TOKEN;

export interface MatchupDefenderRow {
  personId: number;
  /** nameI, e.g. "A. Green" */
  name: string;
  /** matchup time as "M:SS" straight from upstream; "" when absent */
  minutes: string;
  /** partial possessions (switches count fractionally), 1 decimal */
  possessions: number;
  /** points the offensive player scored while guarded by this defender */
  points: number;
  fgm: number;
  fga: number;
}

export interface MatchupsPayload {
  gameId: string;
  /** offensive personId -> defenders sorted by partial possessions desc */
  players: Record<string, MatchupDefenderRow[]>;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Name-keyed defensive parse of the boxScoreMatchups document. Orientation
 * (non-obvious — nba_api's flattened header suffixes claim the opposite):
 * each team's `players[]` are that team's OFFENSIVE players and their
 * `matchups[]` are the opposing DEFENDERS who guarded them — verified
 * numerically against game 0022500142, where every outer player's summed
 * matchup playerPoints tracks his own box-score points (Green 17≈17,
 * Turner 9=9, Schröder 24=24, Westbrook 12=12).
 * Returns null when the document shape is unrecognizable so the caller can
 * 502 instead of caching garbage; an empty record is a legitimate
 * "no tracking data (yet)" answer.
 */
function parseMatchups(data: unknown): Record<string, MatchupDefenderRow[]> | null {
  const box = (data as { boxScoreMatchups?: unknown } | null)?.boxScoreMatchups as
    | { homeTeam?: { players?: unknown[] }; awayTeam?: { players?: unknown[] } }
    | undefined;
  if (!box || typeof box !== "object") return null;
  if (!Array.isArray(box.homeTeam?.players) && !Array.isArray(box.awayTeam?.players)) return null;

  const out: Record<string, MatchupDefenderRow[]> = {};
  for (const side of [box.homeTeam, box.awayTeam]) {
    if (!Array.isArray(side?.players)) continue;
    for (const rawPlayer of side.players) {
      const p = rawPlayer as { personId?: unknown; matchups?: unknown } | null;
      const offId = num(p?.personId);
      if (offId == null || offId <= 0 || !Array.isArray(p?.matchups)) continue;

      const defenders: MatchupDefenderRow[] = [];
      for (const rawMatchup of p.matchups) {
        const m = rawMatchup as
          | { personId?: unknown; nameI?: unknown; statistics?: Record<string, unknown> }
          | null;
        const defId = num(m?.personId);
        const s = m?.statistics;
        if (defId == null || defId <= 0 || typeof m?.nameI !== "string" || !s || typeof s !== "object") continue;
        const poss = num(s.partialPossessions);
        if (poss == null || poss <= 0) continue;
        defenders.push({
          personId: defId,
          name: m.nameI,
          minutes: typeof s.matchupMinutes === "string" ? s.matchupMinutes : "",
          possessions: Math.round(poss * 10) / 10,
          points: num(s.playerPoints) ?? 0,
          fgm: num(s.matchupFieldGoalsMade) ?? 0,
          fga: num(s.matchupFieldGoalsAttempted) ?? 0,
        });
      }
      defenders.sort((a, b) => b.possessions - a.possessions);
      if (defenders.length > 0) out[String(offId)] = defenders.slice(0, 6);
    }
  }
  return out;
}

function respondWith(gameId: string, players: Record<string, MatchupDefenderRow[]>) {
  const payload: MatchupsPayload = { gameId, players };
  // Rich data never changes for a finished game; an empty answer is likely
  // "tracking feed not published yet" and must expire fast.
  const sMaxAge = Object.keys(players).length > 0 ? 86400 : 300;
  return NextResponse.json(payload, {
    headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}` },
  });
}

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("gameId") ?? "";
  // Single hard-coded upstream endpoint + strict GameID pattern = no open proxy.
  if (!/^\d{10}$/.test(gameId)) {
    return NextResponse.json({ error: "gameId must be 10 digits" }, { status: 400 });
  }

  if (RELAY_URL && RELAY_TOKEN) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${RELAY_URL}/stats/boxscorematchupsv3?GameID=${gameId}`, {
        headers: { "X-Relay-Token": RELAY_TOKEN },
        next: { revalidate: UPSTREAM_REVALIDATE },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const players = parseMatchups(await res.json());
        if (players) return respondWith(gameId, players);
      }
    } catch {
      // relay down — fall through to the direct path (its breaker applies)
    }
  }

  if (Date.now() < blackholedUntil) {
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${UPSTREAM}?GameID=${gameId}`, {
      headers: HEADERS,
      next: { revalidate: UPSTREAM_REVALIDATE },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json({ error: `NBA API returned ${res.status}` }, { status: res.status });
    }
    blackholedUntil = 0;
    const players = parseMatchups(await res.json());
    if (!players) {
      return NextResponse.json({ error: "unexpected upstream shape" }, { status: 502 });
    }
    return respondWith(gameId, players);
  } catch {
    blackholedUntil = Date.now() + BLACKHOLE_TTL_MS;
    return NextResponse.json({ error: "NBA API request failed or timed out" }, { status: 504 });
  }
}
