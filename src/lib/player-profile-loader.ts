import "server-only";
import { cache } from "react";
import { getBundledPlayerIndexSnapshot, getPlayerIndexSnapshot } from "./api";
import { parsePlayerId } from "./player-identity";
import { resolvePlayerIdentity } from "./player-identity-server";

// Explicitly reviewed historical profiles, backed by the fixed official
// registry and career archives. Do not infer this route from roster absence,
// age or registry years: current, newly indexed and unknown IDs still refresh
// the live index, with the original provenance and recovery policy.
const LOCAL_HISTORICAL_PROFILES = new Set([893, 977, 1495, 76003, 76375, 406, 77142, 1449]);

// Share the choice across metadata and rendering within a React request.
// This does not add a process-wide cache or change live-data freshness.
export const getPlayerProfileContext = cache(async (id: string) => {
  const playerId = parsePlayerId(id);
  if (playerId === null) return null;
  const snapshot = LOCAL_HISTORICAL_PROFILES.has(playerId)
    ? getBundledPlayerIndexSnapshot()
    : await getPlayerIndexSnapshot();
  const identity = await resolvePlayerIdentity(id, snapshot);
  return identity ? { snapshot, identity } : null;
});
