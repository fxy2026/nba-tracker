import { currentSeason } from "./constants";

// A player's latest indexed season is not necessarily the league's current
// season (retired players and archived indexes both retain older years).
export function playerShotRequestUrl(playerId: number, team: string, season: string, seasonType: string, leagueSeason = currentSeason()) {
  const params = new URLSearchParams({ playerId: String(playerId), team, seasonType, context: "4" });
  if (season !== leagueSeason || team === "TOT") params.set("season", season);
  return `/api/player-shots?${params}`;
}
export interface PlayerShotRow { x: number; y: number; shotDistance: number; shotResult: string; }
export interface PlayerShotData { shots: PlayerShotRow[]; gamesLoaded: number; totalGames: number; }
export function normalizePlayerShotData(raw: unknown): PlayerShotData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (!Array.isArray(r.shots) || !count(r.gamesLoaded) || !count(r.totalGames) || r.gamesLoaded > r.totalGames || (r.shots.length > 0 && r.gamesLoaded === 0)) return null;
  if (!r.shots.every(s => s && typeof s === "object" && [s.x, s.y, s.shotDistance].every(n => typeof n === "number" && Number.isFinite(n)) && s.shotDistance >= 0 && ["Made", "Missed"].includes(s.shotResult))) return null;
  return r as unknown as PlayerShotData;
}
