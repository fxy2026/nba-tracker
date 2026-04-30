import { NextRequest, NextResponse } from "next/server";

const NBA_STATS_BASE = "https://stats.nba.com/stats";
const NBA_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json",
};

// Fetch with 4s abort timeout
async function fetchSafe(url: string, headers: HeadersInit, revalidate: number): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { headers, next: { revalidate }, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch { return null; }
}

// ========== ESPN Data Source (primary — reliable, no blocking) ==========
async function fetchFromESPN(playerName: string) {
  try {
    // Search for player on ESPN to get ESPN athlete ID
    const searchRes = await fetchSafe(
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes?limit=5&active=true`,
      { "User-Agent": "Mozilla/5.0" }, 86400
    );
    // ESPN search doesn't support query params well, so we use the stats endpoint with player name matching
    // Instead, try fetching the athlete profile by searching the NBA roster on ESPN
    // Fallback: use the NBA stats API
    return null;
  } catch { return null; }
}

// ========== NBA Stats API (fallback — may be blocked on some hosts) ==========
async function fetchFromNBAStats(playerId: string) {
  const [careerRes, gameLogRes] = await Promise.all([
    fetchSafe(`${NBA_STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`, NBA_HEADERS, 3600),
    fetchSafe(`${NBA_STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=2025-26&SeasonType=Regular+Season`, NBA_HEADERS, 300),
  ]);

  let careerSeasons = null;
  let recentGames = null;

  if (careerRes?.ok) {
    try {
      const data = await careerRes.json();
      const rs = data.resultSets?.find((r: { name: string }) => r.name === "SeasonTotalsRegularSeason");
      if (rs) {
        const headers: string[] = rs.headers;
        careerSeasons = rs.rowSet.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        });
      }
    } catch { /* ignore */ }
  }

  if (gameLogRes?.ok) {
    try {
      const data = await gameLogRes.json();
      const rs = data.resultSets?.[0];
      if (rs) {
        const headers: string[] = rs.headers;
        recentGames = rs.rowSet.slice(0, 10).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        });
      }
    } catch { /* ignore */ }
  }

  return { careerSeasons, recentGames };
}

// ========== ESPN Stats by ESPN ID (when we can find it) ==========
async function fetchESPNStats(espnId: string) {
  const res = await fetchSafe(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats`,
    { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, 3600
  );
  if (!res?.ok) return null;
  const data = await res.json();
  const cat = data.categories?.find((c: { name: string }) => c.name === "regularSeason");
  if (!cat?.statistics?.length) return null;

  // Map ESPN format to our format
  const labels: string[] = cat.labels || [];
  const careerSeasons = cat.statistics.map((s: { season: { displayName: string }; stats: string[]; teamSlug?: string }) => {
    const vals = s.stats;
    const get = (label: string) => { const idx = labels.indexOf(label); return idx >= 0 ? vals[idx] : null; };
    const parseFGSplit = (v: string | null) => {
      if (!v) return { made: 0, att: 0 };
      const [m, a] = v.split("-").map(Number);
      return { made: m || 0, att: a || 0 };
    };
    const fg = parseFGSplit(get("FG"));
    const fg3 = parseFGSplit(get("3PT"));
    const ft = parseFGSplit(get("FT"));
    return {
      SEASON_ID: s.season?.displayName || "",
      TEAM_ABBREVIATION: (s.teamSlug || "").split("-").map((w: string) => w[0]?.toUpperCase()).join("") || "",
      GP: parseFloat(get("GP") || "0"),
      MIN: parseFloat(get("MIN") || "0"),
      PTS: parseFloat(get("PTS") || "0"),
      REB: parseFloat(get("REB") || "0"),
      AST: parseFloat(get("AST") || "0"),
      STL: parseFloat(get("STL") || "0"),
      BLK: parseFloat(get("BLK") || "0"),
      FG_PCT: parseFloat(get("FG%") || "0") / 100,
      FG3_PCT: parseFloat(get("3P%") || "0") / 100,
      FT_PCT: parseFloat(get("FT%") || "0") / 100,
      FGA: fg.att,
      FG3A: fg3.att,
      FTA: ft.att,
    };
  });

  return { careerSeasons, recentGames: null };
}

// ========== Main Handler ==========
export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  const espnId = request.nextUrl.searchParams.get("espnId");
  if (!playerId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Strategy: Try NBA Stats first (with timeout), fallback to ESPN
  let result = await fetchFromNBAStats(playerId);

  // If NBA Stats failed and we have ESPN ID, try ESPN
  if (!result.careerSeasons && espnId) {
    const espnResult = await fetchESPNStats(espnId);
    if (espnResult) result = { ...result, ...espnResult };
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
