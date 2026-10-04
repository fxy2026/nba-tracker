export interface PlayerMeasurements {
  wingspan: number | null;
  standingReach: number | null;
  bodyFat: number | null;
  handLength: number | null;
  handWidth: number | null;
  heightNoShoes: number | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function playerIdentity(value: unknown): number | null {
  const id = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** The endpoint returns a draft class, not the requested player's measurements. */
export function parsePlayerMeasurements(payload: unknown, playerId: number): PlayerMeasurements | null {
  if (playerIdentity(playerId) !== playerId || !record(payload)
    || !Array.isArray(payload.resultSets) || payload.resultSets.length !== 1) return null;
  const result = payload.resultSets[0];
  if (!record(result) || !Array.isArray(result.headers) || !Array.isArray(result.rowSet)) return null;
  const headers: unknown[] = result.headers;
  if (headers.length === 0 || Array.from(headers).some(header => typeof header !== "string" || !header || header.trim() !== header)
    || new Set(headers).size !== headers.length) return null;
  const identityIndex = headers.indexOf("PLAYER_ID");
  if (identityIndex < 0) return null;

  let matchingRow: unknown[] | null = null;
  for (const row of result.rowSet) {
    // A malformed row could conceal another matching ID; don't guess around it.
    if (!Array.isArray(row) || row.length !== headers.length) return null;
    const identity = playerIdentity(row[identityIndex]);
    if (identity === null) return null;
    if (identity !== playerId) continue;
    if (matchingRow) return null;
    matchingRow = row;
  }
  if (!matchingRow) return null;

  const measurement = (header: string, percentage = false): number | null => {
    const index = headers.indexOf(header);
    const value = index < 0 ? undefined : matchingRow[index];
    // Missing, coerced, non-finite and non-positive cells are unknown, never zero.
    return typeof value === "number" && Number.isFinite(value) && value > 0
      && (!percentage || value < 100) ? value : null;
  };
  const data: PlayerMeasurements = {
    wingspan: measurement("WINGSPAN"),
    standingReach: measurement("STANDING_REACH"),
    bodyFat: measurement("BODY_FAT_PCT", true),
    handLength: measurement("HAND_LENGTH"),
    handWidth: measurement("HAND_WIDTH"),
    heightNoShoes: measurement("HEIGHT_WO_SHOES"),
  };
  return Object.values(data).some(value => value !== null) ? data : null;
}
