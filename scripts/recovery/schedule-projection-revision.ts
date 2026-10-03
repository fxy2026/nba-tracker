import { createHash } from 'node:crypto';

// Increment only when the projection contract changes. Data changes invalidate
// themselves through the hash; no deploy IDs, timestamps or manual bumps.
const SCHEMA = 3;

export function createScheduleProjectionRevision(archive: unknown, observed: unknown) {
  return {
    schema: SCHEMA,
    revision: createHash('sha256').update(JSON.stringify([SCHEMA, archive, observed])).digest('hex'),
  };
}
