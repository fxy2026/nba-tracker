import { expect,it } from 'vitest';
import { cpSync,mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sample from './fixtures/provider-snapshot-storage-sample.json';
import verified from '../data/recovered-player-boxes.json';
import { generateStoredArchives, writeNewSnapshots } from '../../scripts/recovery/snapshot-store';
import { writeObservedFinals } from '../../scripts/recovery/official-game-store';
import { OFFICIAL_RECOVERY_SCHEDULE_URL,projectOfficialRecoverySchedule } from './recovery-official-schedule';
import { observedFinalsToSchedule } from './observed-final-schedule';
import type { ProviderBasicSnapshot } from './provider-player-normalizer';
it('a synthetic newly accepted season snapshot survives clean generation alongside every historical verified value',()=>{
 const root=mkdtempSync(join(tmpdir(),'nba-current-growth-'));
 try{
  cpSync('src/data',root,{recursive:true});
  const row=structuredClone(sample) as ProviderBasicSnapshot;
  row.game={...row.game,nbaGameId:'0022600001',providerMatchId:'11111111-1111-4111-8111-111111111111',season:'2026-27',gameDate:'2026-10-01'};
  const observedAt='2026-10-02T00:00:00Z';
  const projected=projectOfficialRecoverySchedule({leagueSchedule:{seasonYear:'2026-27',gameDates:[{games:[{gameId:row.game.nbaGameId,gameStatus:3,gameCode:'20261001/DENMIN',gameDateTimeUTC:'2026-10-01T23:00:00Z',homeTeam:{teamId:1610612750,teamTricode:'MIN',score:112},awayTeam:{teamId:1610612743,teamTricode:'DEN',score:96}}]}]}},{expectedSeason:'2026-27',now:observedAt,source:{url:OFFICIAL_RECOVERY_SCHEDULE_URL,sha256:'a'.repeat(64),observedAt}});
  if(projected.status!=='ready')throw Error('Invalid synthetic projection fixture');
  writeObservedFinals(join(root,'observed-final-games'),[{version:1,game:projected.games[0],source:projected.source}]);
  writeNewSnapshots(join(root,'provider-player-boxes'),[row],new Set(Object.keys(verified)));
  for(const name of ['provider-player-boxes.json','recovered-player-boxes.json','observed-final-games.json'])rmSync(join(root,name),{force:true});
  generateStoredArchives(root);
  expect(JSON.parse(readFileSync(join(root,'recovered-player-boxes.json'),'utf8'))).toEqual(verified);
  expect(JSON.parse(readFileSync(join(root,'provider-player-boxes.json'),'utf8'))[row.game.nbaGameId]).toEqual(row);
  const dates=observedFinalsToSchedule(JSON.parse(readFileSync(join(root,'observed-final-games.json'),'utf8')));
  expect(dates.flatMap(d=>d.games).find(g=>g.gameId===row.game.nbaGameId)).toMatchObject({gameCode:'20261001/DENMIN',homeTeam:{score:112},awayTeam:{score:96}});
 }finally{rmSync(root,{recursive:true,force:true});}
});
