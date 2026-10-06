import { generateStoredArchives } from './snapshot-store';
import { generatePlayerBoxCoverageManifest } from './player-box-coverage';
try {
  generateStoredArchives();
  generatePlayerBoxCoverageManifest();
  console.log('Generated validated player archives from per-game snapshots.');
} catch {
  console.error('Player archive generation failed; no partial archive is approved for deployment.');
  process.exitCode = 1;
}
