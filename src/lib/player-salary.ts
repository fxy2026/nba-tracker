import { normalizePlayerSearchText } from "./player-search-text";

export interface SalaryContract {
  season: number;
  base_salary: number | null;
  cap_hit: number | null;
}

interface SalaryPlayer {
  id: number;
  teamId: number;
  teamAbbr: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function abbreviation(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function fullName(player: Record<string, unknown>): string | null {
  if (typeof player.first_name !== "string" || !player.first_name.trim()
    || typeof player.last_name !== "string" || !player.last_name.trim()) return null;
  // Fold accents, case and whitespace only. Suffixes and punctuation are part
  // of the full identity; never use a partial name or drop Jr./II/III.
  return normalizePlayerSearchText(`${player.first_name} ${player.last_name}`);
}

function playerIdentity(player: Record<string, unknown>): SalaryPlayer | null {
  if (!positiveId(player.id) || !record(player.team) || !positiveId(player.team.id)) return null;
  const teamAbbr = abbreviation(player.team.abbreviation);
  if (!teamAbbr || ("team_id" in player && player.team_id !== player.team.id)) return null;
  return { id: player.id, teamId: player.team.id, teamAbbr };
}

/** Provider search ordering is relevance, not proof of the requested identity. */
export function resolveSalaryPlayer(payload: unknown, playerName: string, teamAbbr: string | null): SalaryPlayer | null {
  if (!record(payload) || !Array.isArray(payload.data)) return null;
  const name = normalizePlayerSearchText(playerName);
  const team = teamAbbr === null ? null : abbreviation(teamAbbr);
  if (!name || (teamAbbr !== null && team === null)) return null;

  const namedRows = payload.data.filter((row): row is Record<string, unknown> => record(row) && fullName(row) === name);
  const identities = namedRows.map(playerIdentity);
  // A malformed same-name result could conceal another identity or team.
  if (identities.some(identity => identity === null)) return null;
  const candidates = identities.filter((identity): identity is SalaryPlayer => identity !== null && (team === null || identity.teamAbbr === team));
  const match = candidates[0];
  if (!match || candidates.some(candidate => candidate.id !== match.id)) return null;

  // Repeated rows for one ID are fine only when their full name and team agree,
  // including rows excluded by the requested team or malformed duplicate rows.
  for (const row of payload.data) {
    if (!record(row) || row.id !== match.id) continue;
    const identity = playerIdentity(row);
    if (fullName(row) !== name || !identity || identity.teamId !== match.teamId || identity.teamAbbr !== match.teamAbbr) return null;
  }
  return match;
}

function matchesContractPlayer(contract: Record<string, unknown>, playerId: number): boolean {
  const direct = "player_id" in contract;
  if (contract.player != null && !record(contract.player)) return false;
  const nested = record(contract.player) && "id" in contract.player;
  if (!direct && !nested) return false;
  // Every supplied ID must be valid and agree. An OR would accept a contract
  // whose direct ID belongs to someone else but whose nested ID matches.
  return (!direct || (positiveId(contract.player_id) && contract.player_id === playerId))
    && (!nested || (record(contract.player) && positiveId(contract.player.id) && contract.player.id === playerId));
}

function money(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Missing or malformed money is unknown, while a genuine reported zero stays zero. */
export function parseSalaryContracts(payload: unknown, playerId: number): SalaryContract[] {
  if (!positiveId(playerId) || !record(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.flatMap((row): SalaryContract[] => {
    if (!record(row) || !matchesContractPlayer(row, playerId)
      || typeof row.season !== "number" || !Number.isInteger(row.season)
      || row.season < 1946 || row.season >= 9999) return [];
    return [{ season: row.season, base_salary: money(row.base_salary), cap_hit: money(row.cap_hit) }];
  }).sort((a, b) => b.season - a.season);
}
