import "server-only";
import { getBundledPlayerIndexSnapshot } from "./api";
import type { ScatterArchive } from "./scatter-archive";

/** Synchronous local-only data; never refreshes the index or contacts upstream. */
export function getScatterArchive(): ScatterArchive {
  const snapshot = getBundledPlayerIndexSnapshot();
  const rows = snapshot.players
    .filter(p => [p.pts, p.reb, p.ast].every(v => typeof v === "number" && Number.isFinite(v)))
    .map(p => ({
      PLAYER_ID: p.personId,
      PLAYER: `${p.firstName} ${p.lastName}`.trim(),
      TEAM: p.teamId > 0 ? (p.teamAbbr || "") : "",
      PTS: p.pts, REB: p.reb, AST: p.ast,
    }));
  return { season: snapshot.provenance.season, total: snapshot.players.length, omitted: snapshot.players.length - rows.length, rows };
}
