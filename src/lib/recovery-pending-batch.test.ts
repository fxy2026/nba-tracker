import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, symlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import sample from './fixtures/provider-snapshot-storage-sample.json';
import { readPendingBatch, writePendingBatch } from '../../scripts/recovery/pending-batch';

const roots: string[] = [];
const context = { baseSha: 'a'.repeat(40), runId: 123 };
function setup() { const root = mkdtempSync(join(tmpdir(), 'nba-pending-')); roots.push(root); return join(root, 'bundle'); }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
it('round-trips only normalized data and fixed context, retaining real zero/null', () => {
  const dir = setup(), row = structuredClone(sample);
  Object.assign(row, { apiKey: 'DO_NOT_EXPORT', rawResponse: { secret: 'DO_NOT_EXPORT' } });
  Object.assign(row.players[0], { headers: 'DO_NOT_EXPORT' });
  writePendingBatch(dir, [row], context, new Set());
  const result = readPendingBatch(dir);
  expect(result.context).toEqual(context);
  expect(result.snapshots[0].game).toEqual(sample.game);
  expect(result.snapshots[0].players).toEqual(sample.players);
  for (const name of readdirSync(dir)) expect(readFileSync(join(dir, name), 'utf8')).not.toContain('DO_NOT_EXPORT');
});
it.each(['score', 'identity', 'blocked-name', 'blocked-id', 'duplicate', 'bad-context', 'empty'])('rejects invalid capture before creating directory: %s', kind => {
  const dir = setup(), row = structuredClone(sample);
  if (kind === 'score') row.players[0].points++;
  if (kind === 'identity') row.game.nbaGameId = '../evil';
  if (kind === 'blocked-name') row.players[0].name = 'Drew Doughty';
  if (kind === 'blocked-id') row.players[0].providerPlayerId = 'bcc566fc-5452-4681-ab41-b042fae11e53';
  const rows = kind === 'duplicate' ? [row, row] : kind === 'empty' ? [] : [row];
  expect(() => writePendingBatch(dir, rows, kind === 'bad-context' ? { ...context, runId: 0 } : context, new Set())).toThrow();
  expect(() => readdirSync(dir)).toThrow();
});
it('never overwrites an existing capture or accepts directory symlinks', () => {
  const dir = setup(); writePendingBatch(dir, [sample], context, new Set());
  const before = readFileSync(join(dir, 'manifest.json'), 'utf8');
  expect(() => writePendingBatch(dir, [sample], context, new Set())).toThrow();
  expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(before);
  const alias = setup(); symlinkSync(dir, alias);
  expect(() => readPendingBatch(alias)).toThrow();
});
it.each(['tamper', 'unexpected-file', 'path', 'duplicate', 'missing-manifest', 'missing-file', 'symlink', 'extra-field', 'oversize'])('rejects incomplete or modified recovery bundles: %s', kind => {
  const dir = setup(); writePendingBatch(dir, [sample], context, new Set());
  const manifestFile = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const file = join(dir, manifest.files[0].name);
  if (kind === 'tamper') writeFileSync(file, '{}');
  if (kind === 'unexpected-file') writeFileSync(join(dir, '.env'), 'DO_NOT_EXPORT');
  if (kind === 'path') { manifest.files[0].name = '../outside.json'; writeFileSync(manifestFile, JSON.stringify(manifest)); }
  if (kind === 'duplicate') { manifest.files.push(manifest.files[0]); writeFileSync(manifestFile, JSON.stringify(manifest)); }
  if (kind === 'missing-manifest') rmSync(manifestFile);
  if (kind === 'missing-file') rmSync(file);
  if (kind === 'symlink') { const target = file + '.outside'; writeFileSync(target, readFileSync(file)); rmSync(file); symlinkSync(target, file); }
  if (kind === 'extra-field') {
    const raw = JSON.parse(readFileSync(file, 'utf8')); raw.players[0].unexpected = 'DO_NOT_EXPORT';
    const text = JSON.stringify(raw, null, 2) + '\n'; writeFileSync(file, text);
    manifest.files[0].sha256 = createHash('sha256').update(text).digest('hex'); writeFileSync(manifestFile, JSON.stringify(manifest));
  }
  if (kind === 'oversize') writeFileSync(file, ' '.repeat(2_000_001));
  expect(() => readPendingBatch(dir)).toThrow();
});
it('an interrupted capture without the final manifest is not accepted', () => {
  const dir = setup(); mkdirSync(dir); writeFileSync(join(dir, `${sample.game.nbaGameId}.json`), JSON.stringify(sample));
  expect(() => readPendingBatch(dir)).toThrow();
});

it('refuses stronger or quarantined game IDs before capture',()=>{const dir=setup();expect(()=>writePendingBatch(dir,[sample],context,new Set([sample.game.nbaGameId]))).toThrow();expect(()=>readdirSync(dir)).toThrow();});

import schedule from '../data/schedule-2025-26.json';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, projectOfficialRecoverySchedule } from './recovery-official-schedule';
function officialObservation(){
 const game=schedule.dates.flatMap(day=>day.games).find(game=>game.gameId===sample.game.nbaGameId)!;
 const observedAt='2026-10-02T00:00:00Z';
 const result=projectOfficialRecoverySchedule({leagueSchedule:{seasonYear:'2025-26',gameDates:[{games:[game]}]}},{expectedSeason:'2025-26',now:observedAt,source:{url:OFFICIAL_RECOVERY_SCHEDULE_URL,sha256:'a'.repeat(64),observedAt}});
 if(result.status!=='ready')throw Error('Invalid official fixture');return{version:1 as const,game:result.games[0],source:result.source};
}
it('captures distinct typed official identity and player files with matching game identity',()=>{
 const dir=setup(),observation=officialObservation();writePendingBatch(dir,[sample],context,new Set(),[observation]);
 expect(readdirSync(dir).sort()).toEqual([`${sample.game.nbaGameId}.json`,'manifest.json',`official-${sample.game.nbaGameId}.json`]);
 expect(readPendingBatch(dir)).toEqual({context,snapshots:[sample],observations:[observation]});
 expect(JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8')).version).toBe(2);
});
it('preserves a new official identity even when provider has no accepted player rows',()=>{
 const dir=setup(),observation=officialObservation();writePendingBatch(dir,[],context,new Set(),[observation]);
 expect(readPendingBatch(dir)).toEqual({context,snapshots:[],observations:[observation]});
});
it.each(['mismatch','extra','protected','duplicate','cap'])('rejects unsafe official artifact before any file creation: %s',kind=>{
 const dir=setup(),observation=officialObservation();
 if(kind==='mismatch')observation.game.home.score++;
 if(kind==='extra')Reflect.set(observation.source,'key','DO_NOT_EXPORT');
 const observations=kind==='duplicate'?[observation,observation]:kind==='cap'?Array(21).fill(observation):[observation];
 expect(()=>writePendingBatch(dir,[sample],context,new Set(kind==='protected'?[sample.game.nbaGameId]:[]),observations)).toThrow();expect(()=>readdirSync(dir)).toThrow();
});
it.each(['prefix','version','mismatch','extra'])('reader rejects retagged or modified official artifact: %s',kind=>{
 const dir=setup();writePendingBatch(dir,[sample],context,new Set(),[officialObservation()]);
 const manifestFile=join(dir,'manifest.json'),manifest=JSON.parse(readFileSync(manifestFile,'utf8'));
 const entry=manifest.files.find((file:{name:string})=>file.name.startsWith('official-'));
 if(kind==='version')manifest.version=1;
 else{
  const file=join(dir,entry.name),raw=JSON.parse(readFileSync(file,'utf8'));
  if(kind==='prefix'){entry.name='identity-'+sample.game.nbaGameId+'.json';rmSync(file);}
  if(kind==='mismatch')raw.game.home.score++;
  if(kind==='extra')raw.source.secret='DO_NOT_EXPORT';
  const text=JSON.stringify(raw,null,2)+'\n';writeFileSync(join(dir,entry.name),text);entry.sha256=createHash('sha256').update(text).digest('hex');
 }
 writeFileSync(manifestFile,JSON.stringify(manifest));expect(()=>readPendingBatch(dir)).toThrow();
});
