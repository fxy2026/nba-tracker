import registry from "@/data/player-identity/official-all-player-identities.compact.json";
import { parsePlayerId } from "./player-identity";
const knownPlayerIds = new Set(registry.rows.map(row => Number(row[0])));
/** null means another route; false is a malformed ID; true is locally known. */
export function localPlayerRouteStatus(pathname: string): { id: number | null; known: boolean } | null {
  const match = /^\/player\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const id = parsePlayerId(match[1]);
  return { id, known: id !== null && knownPlayerIds.has(id) };
}
