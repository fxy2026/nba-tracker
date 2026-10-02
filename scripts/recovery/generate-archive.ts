import { generateSnapshotAggregate, readQuarantinedSnapshots, readSnapshotDirectory } from './snapshot-store';
try {
  const blocked=readQuarantinedSnapshots('src/data/quarantined-player-boxes','src/data/player-box-quarantine.json');
  const active=readSnapshotDirectory('src/data/provider-player-boxes');
  const owners=new Set(Object.values(blocked).map(box=>box.game.providerMatchId));
  if(Object.values(active).some(box=>Object.hasOwn(blocked,box.game.nbaGameId)||owners.has(box.game.providerMatchId)))throw new Error('Quarantine overlap');
  generateSnapshotAggregate('src/data/provider-player-boxes','src/data/provider-player-boxes.json');
  console.log('Generated validated provider archive from per-game snapshots.');
} catch {
  console.error('Provider archive generation refused invalid input; existing aggregate preserved.');
  process.exitCode = 1;
}
