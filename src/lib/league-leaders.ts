const numericFields = ["RANK", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "EFF"] as const;
export type LeagueLeaderNumericField = typeof numericFields[number];
export type LeagueLeaderRow = {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string | null;
} & Record<LeagueLeaderNumericField, number | null>;

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function numericCell(field: LeagueLeaderNumericField, value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (field === "GP" || field === "RANK") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (field === "EFF") return value;
  if (value < 0 || ((field === "FG_PCT" || field === "FG3_PCT") && value > 1)) return null;
  return value;
}

/** Existing leagueleaders envelope only. Unknown numeric cells stay unavailable. */
export function parseLeagueLeaders(raw: unknown): { rows: LeagueLeaderRow[]; rejectedRows: number } | null {
  if (!object(raw) || !object(raw.resultSet)) return null;
  const { headers, rowSet } = raw.resultSet;
  if (!Array.isArray(headers) || !headers.every(h => typeof h === "string" && h.trim()) ||
    new Set(headers).size !== headers.length || !headers.includes("PLAYER_ID") ||
    !headers.includes("PLAYER") || !Array.isArray(rowSet)) return null;
  const indices = new Map(headers.map((header, index) => [header, index]));
  const rows: LeagueLeaderRow[] = [];
  const playerIds = new Set<number>();
  let rejectedRows = 0;
  for (const values of rowSet) {
    if (!Array.isArray(values)) { rejectedRows++; continue; }
    const get = (field: string): unknown => {
      const index = indices.get(field);
      return index === undefined ? undefined : values[index];
    };
    const id = get("PLAYER_ID"), name = get("PLAYER"), team = get("TEAM");
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) { rejectedRows++; continue; }
    // Repeated IDs may be totals or team splits. Do not choose or merge rows.
    if (playerIds.has(id)) return null;
    playerIds.add(id);
    if (typeof name !== "string" || !name.trim()) { rejectedRows++; continue; }
    const numbers = Object.fromEntries(numericFields.map(field => [field, numericCell(field, get(field))])) as Record<LeagueLeaderNumericField, number | null>;
    rows.push({ PLAYER_ID: id, PLAYER: name, TEAM: typeof team === "string" && team.trim() ? team : null, ...numbers });
  }
  return { rows, rejectedRows };
}

export function hasLeagueLeaderNumbers<K extends LeagueLeaderNumericField>(
  row: LeagueLeaderRow, fields: readonly K[],
): row is LeagueLeaderRow & Record<K, number> {
  return fields.every(field => typeof row[field] === "number" && Number.isFinite(row[field]));
}

export function formatLeagueLeaderValue(value: number | null, percentage = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return percentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
}
