// ESPN NBA team ID mapping (tricode -> ESPN team ID)
const ESPN_TEAMS: Record<string, number> = {
  ATL: 1, BOS: 2, BKN: 17, CHA: 30, CHI: 4,
  CLE: 5, DAL: 6, DEN: 7, DET: 8, GSW: 9,
  HOU: 10, IND: 11, LAC: 12, LAL: 13, MEM: 29,
  MIA: 14, MIL: 15, MIN: 16, NOP: 3, NYK: 18,
  OKC: 25, ORL: 19, PHI: 20, PHX: 21, POR: 22,
  SAC: 23, SAS: 24, TOR: 28, UTA: 26, WAS: 27,
};

async function fetchJSON(url: string): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Find ESPN athlete ID by looking up the team roster and matching by name
export async function findESPNId(playerName: string, teamTricode: string): Promise<string | null> {
  const espnTeamId = ESPN_TEAMS[teamTricode];
  if (!espnTeamId) return null;

  const data = await fetchJSON(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}/roster`
  ) as { athletes?: { id: string; fullName: string }[] } | null;

  if (!data?.athletes) return null;
  const nameLower = playerName.toLowerCase();
  const match = data.athletes.find(a => a.fullName?.toLowerCase() === nameLower);
  return match?.id || null;
}

interface ESPNSeasonStats {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  FGA: number;
  FG3A: number;
  FTA: number;
}

// Fetch career season-by-season stats from ESPN
export async function getESPNCareerStats(espnId: string): Promise<{ careerSeasons: ESPNSeasonStats[]; recentGames: null }> {
  const data = await fetchJSON(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats`
  ) as { categories?: { name: string; labels: string[]; statistics: { season: { displayName: string }; stats: string[]; teamSlug?: string }[] }[] } | null;

  if (!data?.categories) return { careerSeasons: [], recentGames: null };

  const cat = data.categories.find(c => c.name === "regularSeason") || data.categories[0];
  if (!cat?.statistics?.length) return { careerSeasons: [], recentGames: null };

  const labels = cat.labels || [];
  const get = (vals: string[], label: string) => {
    const idx = labels.indexOf(label);
    return idx >= 0 ? vals[idx] : null;
  };

  const careerSeasons: ESPNSeasonStats[] = cat.statistics.map(s => {
    const v = s.stats;
    const parseSplit = (raw: string | null) => {
      if (!raw) return { m: 0, a: 0 };
      const [m, a] = raw.split("-").map(Number);
      return { m: m || 0, a: a || 0 };
    };
    const fg = parseSplit(get(v, "FG"));
    const fg3 = parseSplit(get(v, "3PT"));
    const ft = parseSplit(get(v, "FT"));

    return {
      SEASON_ID: s.season?.displayName || "",
      TEAM_ABBREVIATION: (s.teamSlug || "").replace(/-/g, " ").split(" ").map(w => w[0]?.toUpperCase() || "").join(""),
      GP: parseFloat(get(v, "GP") || "0"),
      MIN: parseFloat(get(v, "MIN") || "0"),
      PTS: parseFloat(get(v, "PTS") || "0"),
      REB: parseFloat(get(v, "REB") || "0"),
      AST: parseFloat(get(v, "AST") || "0"),
      STL: parseFloat(get(v, "STL") || "0"),
      BLK: parseFloat(get(v, "BLK") || "0"),
      FG_PCT: parseFloat(get(v, "FG%") || "0") / 100,
      FG3_PCT: parseFloat(get(v, "3P%") || "0") / 100,
      FT_PCT: parseFloat(get(v, "FT%") || "0") / 100,
      FGA: fg.a,
      FG3A: fg3.a,
      FTA: ft.a,
    };
  });

  return { careerSeasons, recentGames: null };
}
