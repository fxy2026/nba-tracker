import type { RecoveredPlayerBox } from './recovered-player-box';
import { diagnoseMembershipResponse, isMembershipReference, MEMBERSHIP_TARGETS } from './recovery-membership-evidence';
import type { createRecoveryMembershipClient } from './recovery-membership-client';

/** Fixed requests and comparisons only. No snapshot, cursor, or file writes. */
export async function runMembershipDiagnostic(references: Record<string, RecoveredPlayerBox>, client: ReturnType<typeof createRecoveryMembershipClient>) {
  for (const { gameId } of MEMBERSHIP_TARGETS) if (!references[gameId] || !isMembershipReference(references[gameId])) throw new Error('Missing fixed verified reference');
  if (client.requestsMade !== 0) throw new Error('Diagnostic requires a fresh bounded client');
  const results = [];
  for (const { kind, gameId } of MEMBERSHIP_TARGETS) {
    const result = await client.get(kind, gameId);
    if (!result.ok) {
      results.push({ kind, gameId, ...result });
      if (result.reason === 'resource-missing' && result.httpStatus === 404) continue;
      break;
    }
    const evidence = diagnoseMembershipResponse(result.body, kind, references[gameId]);
    results.push({ ...evidence, retrievedAt: result.retrievedAt, responseSha256: result.responseSha256 });
    if (evidence.status === 'malformed-envelope' || evidence.status === 'provider-error') break;
  }
  return { type: 'bounded-membership-diagnostic', requests: client.requestsMade, results };
}
