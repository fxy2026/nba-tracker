import { generateSnapshotAggregate } from './snapshot-store';
try {
  generateSnapshotAggregate('src/data/provider-player-boxes','src/data/provider-player-boxes.json');
  console.log('Generated validated provider archive from per-game snapshots.');
} catch {
  console.error('Provider archive generation refused invalid input; existing aggregate preserved.');
  process.exitCode = 1;
}
