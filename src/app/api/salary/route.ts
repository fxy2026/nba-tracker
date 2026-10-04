import { NextRequest, NextResponse } from "next/server";
import { parseSalaryContracts, resolveSalaryPlayer } from "@/lib/player-salary";

const BDL_BASE = "https://api.balldontlie.io/v1";

export const maxDuration = 10;

const bdlRetryAt = new Map<string, number>();
const FAIL_HEADERS = { "Cache-Control": "public, s-maxage=60" };

function retryDelayMs(res: Response): number {
  // Retry-After may be an HTTP-date or garbage — Number() yields NaN then; cap at 1h.
  const secs = Number(res.headers.get("Retry-After"));
  return Number.isFinite(secs) && secs > 0 && secs <= 3600 ? secs * 1000 : 60_000;
}

function bdlFailure(key: string, res: Response): NextResponse {
  if (bdlRetryAt.size >= 500) bdlRetryAt.clear();
  bdlRetryAt.set(key, Date.now() + retryDelayMs(res));
  return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
}

export async function GET(request: NextRequest) {
  const playerName = request.nextUrl.searchParams.get("player");
  const teamAbbr = request.nextUrl.searchParams.get("team");

  if (!playerName) {
    return NextResponse.json({ data: [] });
  }

  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ data: [] });
  }

  const normalizedName = playerName.trim().toLowerCase().slice(0, 100);
  const searchKey = `player:${normalizedName}`;
  if ((bdlRetryAt.get(searchKey) ?? 0) > Date.now()) {
    return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
  }

  try {
    // First, search for the player to get their BDL player ID (5s timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const searchRes = await fetch(
      `${BDL_BASE}/players?search=${encodeURIComponent(playerName.slice(0, 100))}&per_page=5`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!searchRes.ok) return bdlFailure(searchKey, searchRes);
    const searchData: unknown = await searchRes.json();
    const match = resolveSalaryPlayer(searchData, playerName, teamAbbr);
    if (!match) return NextResponse.json({ data: [] });

    // Get contracts for the player's team
    const teamId = match.teamId;

    const teamKey = `team:${teamId}`;
    if ((bdlRetryAt.get(teamKey) ?? 0) > Date.now()) {
      return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
    }

    const contractController = new AbortController();
    const contractTimeout = setTimeout(() => contractController.abort(), 5000);
    const contractRes = await fetch(
      `${BDL_BASE}/contracts/teams?team_id=${teamId}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
        signal: contractController.signal,
      }
    );
    clearTimeout(contractTimeout);
    if (!contractRes.ok) return bdlFailure(teamKey, contractRes);
    const contractData: unknown = await contractRes.json();
    const playerContracts = parseSalaryContracts(contractData, match.id);

    return NextResponse.json({ data: playerContracts }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
    });
  } catch {
    return NextResponse.json({ data: [] }, { headers: FAIL_HEADERS });
  }
}
