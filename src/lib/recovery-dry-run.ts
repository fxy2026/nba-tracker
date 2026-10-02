import { parseRecoveryManifest } from "./recovery-manifest";
import { normalizeProviderPlayerStats, type ProviderBasicSnapshot } from "./provider-player-normalizer";

export interface RecoveryCapture {
  nbaGameId: string;
  requestedMatchId: string;
  retrievedAt: string;
  retrievedAtPrecision?: "exact" | "approximate-minute";
  httpStatus: number;
  body: unknown;
}
export interface RecoveryDryRunResult {
  mode: "offline-dry-run";
  networkRequests: 0;
  accepted: ProviderBasicSnapshot[];
  rejected: { gameId: string; reason: string }[];
  preservedVerified: string[];
}
// No environment access, networking or filesystem mutation. Stronger manually
// verified archives are never replaced by an unassigned provider snapshot.
export function dryRunRecovery(rawManifest: unknown, captures: RecoveryCapture[], verifiedGameIds: ReadonlySet<string>): RecoveryDryRunResult {
  const result: RecoveryDryRunResult = {mode:"offline-dry-run",networkRequests:0,accepted:[],rejected:[],preservedVerified:[]};
  const parsed = parseRecoveryManifest(rawManifest);
  if (!parsed.ok) return {...result,rejected:[{gameId:"manifest",reason:"invalid-manifest"}]};
  for (const game of parsed.manifest.games) {
    if (verifiedGameIds.has(game.nbaGameId)) { result.preservedVerified.push(game.nbaGameId); continue; }
    const matching = captures.filter(c=>c.nbaGameId===game.nbaGameId);
    if (matching.length !== 1) {result.rejected.push({gameId:game.nbaGameId,reason:"missing-or-ambiguous-capture"});continue;}
    const capture = matching[0];
    if (capture.httpStatus !== 200) {result.rejected.push({gameId:game.nbaGameId,reason:"provider-unavailable"});continue;}
    const normalized = normalizeProviderPlayerStats(capture.body,game,{requestedMatchId:capture.requestedMatchId,retrievedAt:capture.retrievedAt,retrievedAtPrecision:capture.retrievedAtPrecision});
    if (normalized.ok === true) result.accepted.push(normalized.snapshot);
    else result.rejected.push({gameId:game.nbaGameId,reason:normalized.reason});
  }
  return result;
}
