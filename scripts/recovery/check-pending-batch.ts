import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readPendingBatch } from './pending-batch';

// This separate step receives no provider secret and never prints input data.
try {
  const root = process.env.RUNNER_TEMP, id = process.env.GITHUB_RUN_ID;
  if (!root || !id || !/^[1-9]\d*$/.test(id) || !process.env.GITHUB_OUTPUT) throw new Error('Invalid capture context');
  const directory = join(root, `nba-player-pending-${id}`);
  if (existsSync(directory)) {
    const batch = readPendingBatch(directory);
    if (batch.context.runId !== Number(id) || batch.context.baseSha !== process.env.GITHUB_SHA) throw new Error('Mismatched capture context');
    appendFileSync(process.env.GITHUB_OUTPUT, 'ready=true\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Prepared temporary recovery bundle: nba-player-pending-${id}; ${batch.snapshots.length} validated player snapshots and ${batch.observations.length} official final identities. If the upload step succeeds, retention is 7 days. Preparation is not proof of upload or permanent publication.\n`);
  }
} catch {
  console.error('Pending recovery bundle was not safe to upload.');
  process.exitCode = 1;
}
