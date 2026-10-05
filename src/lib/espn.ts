import type { CareerSeasonRow } from "./player-career-data";

// ESPN NBA team ID mapping (tricode -> ESPN team ID)
const ESPN_TEAMS: Record<string, number> = {
  ATL: 1, BOS: 2, BKN: 17, CHA: 30, CHI: 4,
  CLE: 5, DAL: 6, DEN: 7, DET: 8, GSW: 9,
  HOU: 10, IND: 11, LAC: 12, LAL: 13, MEM: 29,
  MIA: 14, MIL: 15, MIN: 16, NOP: 3, NYK: 18,
  OKC: 25, ORL: 19, PHI: 20, PHX: 21, POR: 22,
  SAC: 23, SAS: 24, TOR: 28, UTA: 26, WAS: 27,
};

async function fetchJSON(url: string, signal?: AbortSignal): Promise<unknown | null> {
  if (signal?.aborted) return null;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    // The per-provider timeout must include JSON/body consumption too.
    const data = await res.json();
    return controller.signal.aborted ? null : data;
  } catch { return null; }
  finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

// Find ESPN athlete ID by looking up the team roster and matching by name
export async function findESPNId(playerName: string, teamTricode: string, signal?: AbortSignal): Promise<string | null> {
  const espnTeamId = ESPN_TEAMS[teamTricode];
  if (!espnTeamId || typeof playerName !== "string" || !playerName.trim()) return null;

  const data = await fetchJSON(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}/roster`, signal,
  ) as { athletes?: { id: string; fullName: string }[] } | null;

  if (!Array.isArray(data?.athletes)) return null;
  // NBA uses spellings such as Jokić while ESPN may use Jokic. Fold only
  // diacritics/case for an exact full-name match; never use fuzzy matching or
  // silently select one of multiple identities with the same normalized name.
  const normalizeName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normalizedName = normalizeName(playerName);
  const matches = data.athletes.filter(a => typeof a?.fullName === "string" && normalizeName(a.fullName) === normalizedName);
  const match = matches.length === 1 ? matches[0] : null;
  return typeof match?.id === "string" && /^\d+$/.test(match.id) ? match.id : null;
}

type ESPNSeasonStats = CareerSeasonRow;

// Fetch career season-by-season stats from ESPN
export async function getESPNCareerStats(espnId: string, signal?: AbortSignal): Promise<{ careerSeasons: ESPNSeasonStats[] | null; recentGames: null }> {
  const data = await fetchJSON(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats`, signal,
  ) as { categories?: { name: string; labels: string[]; statistics: { season: { displayName: string }; stats: (string | null)[]; teamSlug?: string }[] }[] } | null;

  const unavailable = { careerSeasons: null, recentGames: null };
  if (!Array.isArray(data?.categories)) return unavailable;

  const cat = data.categories.find(c => c?.name === "regularSeason");
  if (!Array.isArray(cat?.statistics) || !Array.isArray(cat.labels)
    || !["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%"].every(label => cat.labels.includes(label))) return unavailable;

  const labels = cat.labels || [];
  const get = (vals: (string | null)[], label: string) => {
    const idx = labels.indexOf(label);
    return idx >= 0 ? vals[idx] : null;
  };

  const careerSeasons = cat.statistics
    .map((s): ESPNSeasonStats | null => {
      if (!Array.isArray(s?.stats) || typeof s.season?.displayName !== "string" || !s.season.displayName
        || (s.teamSlug != null && typeof s.teamSlug !== "string")) return null;
      const v = s.stats;
      const num = (label: string): number | null => {
        const raw = get(v, label);
        if (typeof raw !== "string" || raw.trim() === "") return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      };
      // An explicit missing percentage is unknown, not a zero or a reason to
      // discard the known counting stats. Undefined/junk still means malformed.
      const percentage = (label: string): number | null | undefined => {
        const raw = get(v, label);
        if (raw === null) return null;
        if (typeof raw !== "string") return undefined;
        const value = raw.trim();
        if (value === "" || value === "--" || value === "-") return null;
        if (!/^\d+(?:\.\d+)?$/.test(value)) return undefined;
        const n = Number(value);
        return Number.isFinite(n) && n <= 100 ? n / 100 : undefined;
      };
      const shooting = (raw: string | null): [number | null, number | null] => {
        if (typeof raw !== "string" || !/^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(raw)) return [null, null];
        const [made, attempted] = raw.split("-").map(Number);
        return Number.isFinite(attempted) && made <= attempted ? [made, attempted] : [null, null];
      };
      const gp = num("GP");
      const min = num("MIN");
      const pts = num("PTS");
      const reb = num("REB");
      const ast = num("AST");
      const stl = num("STL");
      const blk = num("BLK");
      const fgPct = percentage("FG%");
      const fg3Pct = percentage("3P%");
      const ftPct = percentage("FT%");
      const [fgm, fga] = shooting(get(v, "FG"));
      const [fg3m, fg3a] = shooting(get(v, "3PT"));
      const [ftm, fta] = shooting(get(v, "FT"));
      // A missing label means ESPN changed the payload — a fake all-zero season
      // row would silently corrupt career charts and advanced-stat math.
      if (gp === null || min === null || pts === null || reb === null || ast === null
        || stl === null || blk === null || fgPct === undefined || fg3Pct === undefined || ftPct === undefined) {
        return null;
      }

      return {
        SEASON_ID: s.season?.displayName || "",
        TEAM_ABBREVIATION: (s.teamSlug || "").replace(/-/g, " ").split(" ").map(w => w[0]?.toUpperCase() || "").join(""),
        GP: gp,
        MIN: min,
        PTS: pts,
        REB: reb,
        AST: ast,
        STL: stl,
        BLK: blk,
        FG_PCT: fgPct,
        FG3_PCT: fg3Pct,
        FT_PCT: ftPct,
        FGM: fgm, FGA: fga,
        FG3M: fg3m, FG3A: fg3a,
        FTM: ftm, FTA: fta,
        // Optional provider columns remain unknown when absent or unrecorded.
        ...Object.fromEntries(([['GS', 'GS'], ['TOV', 'TO'], ['PF', 'PF'], ['OREB', 'OR'], ['DREB', 'DR']] as const)
          .filter(([, label]) => labels.includes(label))
          .map(([key, label]) => [key, num(label)])),
      };
    })
    .filter((row): row is ESPNSeasonStats => row !== null);

  // Dropping malformed rows must not turn a failed payload into empty history
  // or present a partial career as complete.
  return careerSeasons.length === cat.statistics.length ? { careerSeasons, recentGames: null } : unavailable;
}
