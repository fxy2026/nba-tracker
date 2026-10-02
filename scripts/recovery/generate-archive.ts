import { generateStoredArchives } from './snapshot-store';
try {
  generateStoredArchives();
  console.log('Generated validated player archives from per-game snapshots.');
} catch {
  console.error('Player archive generation failed; no partial archive is approved for deployment.');
  process.exitCode = 1;
}
