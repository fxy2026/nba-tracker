import { NextResponse } from "next/server";
import { getCurrentSeasonSchedule } from "@/lib/api";
import { isRegular } from "@/lib/games";
import { currentSeason } from "@/lib/constants";
import { standingsPayload } from "@/lib/season-snapshot";

interface TeamRecord {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  wins: number;
  losses: number;
}

// In-memory standings cache — avoids re-parsing 11MB schedule on every request
let standingsCache: { data: TeamRecord[]; ts: number; season: string } | null = null;
const fetchingPromises = new Map<string, Promise<TeamRecord[]>>();
const STANDINGS_TTL = 5 * 60 * 1000; // 5 minutes

async function computeStandings(season: string): Promise<TeamRecord[]> {
  const dates = await getCurrentSeasonSchedule(season);
  const teamMap: Record<string, TeamRecord> = {};

  for (const gd of dates) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      // Only count regular season games (gameId starts with "002")
      if (!isRegular(g.gameId)) continue;
      const h = g.homeTeam;
      const a = g.awayTeam;
      if (!teamMap[h.teamTricode])
        teamMap[h.teamTricode] = { tricode: h.teamTricode, teamId: h.teamId, teamName: h.teamName, teamCity: h.teamCity, wins: 0, losses: 0 };
      if (!teamMap[a.teamTricode])
        teamMap[a.teamTricode] = { tricode: a.teamTricode, teamId: a.teamId, teamName: a.teamName, teamCity: a.teamCity, wins: 0, losses: 0 };
      if (h.score > a.score) {
        teamMap[h.teamTricode].wins++;
        teamMap[a.teamTricode].losses++;
      } else {
        teamMap[a.teamTricode].wins++;
        teamMap[h.teamTricode].losses++;
      }
    }
  }

  return Object.values(teamMap).sort((a, b) => {
    const wa = a.wins / (a.wins + a.losses || 1);
    const wb = b.wins / (b.wins + b.losses || 1);
    return wb - wa;
  });
}

export async function GET() {
  try {
    const season = currentSeason();
    // Return cached data if fresh
    if (standingsCache && standingsCache.season === season && Date.now() - standingsCache.ts < STANDINGS_TTL) {
      return NextResponse.json(standingsPayload(standingsCache.data), {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    // Deduplicate concurrent requests — only one parse runs at a time
    let fetchingPromise = fetchingPromises.get(season);
    if (!fetchingPromise) {
      fetchingPromise = computeStandings(season).finally(() => { fetchingPromises.delete(season); });
      fetchingPromises.set(season, fetchingPromise);
    }
    const teams = await fetchingPromise;

    if (teams.length > 0) standingsCache = { data: teams, ts: Date.now(), season };
    return NextResponse.json(standingsPayload(teams), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to compute standings" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
