import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalIdentity, validateObservedFinalGame, type ObservedFinalGame } from '../../src/lib/observed-final-game';

/** Immutable per-game identity records; no raw schedule or player data. */
export function readObservedFinalDirectory(directory: string): Record<string, ObservedFinalGame> {
  const result: Record<string, ObservedFinalGame> = {};
  if (!existsSync(directory)) return result;
  const files = readdirSync(directory).sort();
  if (files.length > 10_001) throw new Error('Observed schedule storage bound exceeded');
  for (const name of files) {
    const file = join(directory, name), stat = lstatSync(file);
    if (name === '.gitkeep' && stat.isFile() && stat.size === 0) continue;
    if (!/^\d{10}\.json$/.test(name) || !stat.isFile() || stat.size > 16_384) throw new Error('Invalid observed final file');
    const value = validateObservedFinalGame(JSON.parse(readFileSync(file, 'utf8')));
    if (!value || name !== `${value.game.nbaGameId}.json`) throw new Error('Invalid stored official identity');
    result[value.game.nbaGameId] = value;
  }
  return result;
}

export function writeObservedFinals(directory: string, incoming: readonly ObservedFinalGame[]) {
  if (incoming.length > 20) throw new Error('Observed final write bound exceeded');
  const prior = readObservedFinalDirectory(directory), ids = new Set<string>(), additions: ObservedFinalGame[] = [];
  for (const raw of incoming) {
    const value = validateObservedFinalGame(raw);
    if (!value || ids.has(value.game.nbaGameId)) throw new Error('Invalid observed final batch');
    const id = value.game.nbaGameId; ids.add(id);
    if (prior[id]) {
      if (canonicalIdentity(prior[id].game) !== canonicalIdentity(value.game)) throw new Error('Observed identity overwrite refused');
    } else additions.push(value);
  }
  for (const value of additions) writeFileSync(join(directory, `${value.game.nbaGameId}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
