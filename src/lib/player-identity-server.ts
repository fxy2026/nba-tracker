import "server-only";
import { getBundledPlayerIndexSnapshot, type PlayerIndexSnapshot } from "./api";
import { ALL_TIME_LEADERS } from "./allTimeLeaders";
import { getHistoricalShotPlayers } from "./historical-shot-archive";
import { buildPlayerIdentityDirectory, parsePlayerId, type PlayerIdentity } from "./player-identity";
import { OFFICIAL_PLAYER_IDENTITIES } from "./official-player-registry";

const directories = new WeakMap<PlayerIndexSnapshot, Promise<readonly PlayerIdentity[]>>();
/** Same ID union everywhere. Search defaults to immediate local snapshots;
 * rich profiles explicitly pass their live/cached index and preserve its provenance. */
export async function getPlayerIdentityDirectory(snapshot?: PlayerIndexSnapshot): Promise<readonly PlayerIdentity[]> {
  const index = snapshot ?? getBundledPlayerIndexSnapshot();
  const cached = directories.get(index);
  if (cached) return cached;
  const base = { snapshot: index, registry: OFFICIAL_PLAYER_IDENTITIES, legends: ALL_TIME_LEADERS.map(player => ({ id: player.personId, name: player.name })) };
  const pending = getHistoricalShotPlayers().then(historical => buildPlayerIdentityDirectory({ ...base, historical }))
    .catch(() => {
      // An optional shot catalog outage must not erase known NBA identities.
      // Do not cache this degraded result: the next request can recover coverage.
      directories.delete(index);
      return buildPlayerIdentityDirectory({ ...base, historical: [] }).map(player => ({ ...player, shotArchiveStatus: "error" as const }));
    });
  directories.set(index, pending);
  return pending;
}
export async function resolvePlayerIdentity(id: string, snapshot?: PlayerIndexSnapshot) {
  const playerId = parsePlayerId(id);
  if (playerId === null) return null;
  return (await getPlayerIdentityDirectory(snapshot)).find(player => player.id === playerId) ?? null;
}
