import { expect, it } from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import excerpt from './fixtures/bigballs-actual-excerpt.json';
import { normalizeProviderPlayerStats } from './provider-player-normalizer';
import { dryRunRecovery } from './recovery-dry-run';
import type { RecoveryManifestGame } from './recovery-manifest';

const box=archive['0022500961'];
const game:RecoveryManifestGame={nbaGameId:box.gameId,providerMatchId:box.providerMatchId,season:box.season,gameDate:box.gameDate,home:{tricode:box.home,score:box.homeScore},away:{tricode:box.away,score:box.awayScore}};
const context={requestedMatchId:game.providerMatchId,retrievedAt:box.retrievedAt};
// Reconstructed TEST envelope from captured/verified scalars. This is not a
// claim that a complete HTTP payload has been imported or transport tested.
function simulatedEnvelope(){return{meta:{available:true,players_available:true,team_stats_available:true,withheld:{players:0,team_stats:0}},data:{team_stats:[{team_name:'Memphis Grizzlies'},{team_name:'Detroit Pistons'}],players:box.players.map(p=>({name:p.name,team_name:'Dallas Mavericks',team_id:'untrusted-current-team',stats:{
 minutes:{value:String(p.minutes)},points:{value:String(p.points)},rebounds:{value:String(p.rebounds)},assists:{value:String(p.assists)},offensiveRebounds:{value:String(p.offensiveRebounds)},defensiveRebounds:{value:String(p.defensiveRebounds)},steals:{value:String(p.steals)},blocks:{value:String(p.blocks)},turnovers:{value:String(p.turnovers)},fouls:{value:String(p.fouls)},plusMinus:{value:String(p.plusMinus)},starter:{value:String(p.starter)},
 'fieldGoalsMade-fieldGoalsAttempted':{value:`${p.fieldGoalsMade}-${p.fieldGoalsAttempted}`},'threePointFieldGoalsMade-threePointFieldGoalsAttem':{value:`${p.threePointersMade}-${p.threePointersAttempted}`},'freeThrowsMade-freeThrowsAttempted':{value:`${p.freeThrowsMade}-${p.freeThrowsAttempted}`},
}}))}};}
it('actual truncated envelope is rejected as incomplete, not passed as a whole game',()=>expect(normalizeProviderPlayerStats(excerpt.response,game,context)).toEqual({ok:false,reason:'incomplete-team-identity'}));
it('uses actual nested stat keys with real captured values',()=>{const raw=simulatedEnvelope();const i=raw.data.players.findIndex(p=>p.name==='Jalen Duren');raw.data.players[i]=excerpt.response.data.players[0] as unknown as typeof raw.data.players[number];const result=normalizeProviderPlayerStats(raw,game,context);expect(result.ok).toBe(true);if(result.ok){const duren=result.snapshot.players.find(p=>p.name==='Jalen Duren')!;expect(duren).toMatchObject({providerPlayerId:'43ce53a8-18cc-47fa-9017-cff7b0681830',points:30,rebounds:13,assists:0,fieldGoalsMade:12,fieldGoalsAttempted:15,freeThrowsMade:6,freeThrowsAttempted:10,minutesRounded:28,team:null});}});
it('generalized output never invents historical side or official verification',()=>{const result=normalizeProviderPlayerStats(simulatedEnvelope(),game,context);expect(result.ok).toBe(true);if(result.ok){expect(result.snapshot.players).toHaveLength(22);expect(result.snapshot.players.every(p=>p.team===null)).toBe(true);expect(result.snapshot.validation).toEqual({combinedPoints:236,historicalTeams:'unassigned',officialReportChecked:false});expect(JSON.stringify(result)).not.toContain('Dallas');expect(JSON.stringify(result)).not.toContain('headshot');}});
it.each(['withheld','team','missing-player','duplicate','bad-points','bad-split','bad-assists','bad-starter','bad-rebounds','partial-envelope'])('rejects %s without fabricating data',kind=>{const raw=simulatedEnvelope();if(kind==='withheld')raw.meta.withheld.players=1;if(kind==='team')raw.data.team_stats[0].team_name='Boston Celtics';if(kind==='missing-player')raw.data.players.pop();if(kind==='duplicate')raw.data.players.push(raw.data.players[0]);if(kind==='bad-points')raw.data.players[0].stats.points.value='NaN';if(kind==='bad-split')raw.data.players[0].stats['fieldGoalsMade-fieldGoalsAttempted'].value='9-2';if(kind==='bad-assists')raw.data.players[0].stats.assists.value='3junk';if(kind==='bad-starter')raw.data.players[0].stats.starter.value='maybe';if(kind==='bad-rebounds')raw.data.players[0].stats.rebounds.value='99';if(kind==='partial-envelope')raw.data.players=raw.data.players.slice(0,1);expect(normalizeProviderPlayerStats(raw,game,context).ok).toBe(false);});
it('retains unknown optional stats and genuine zero',()=>{const raw=simulatedEnvelope();raw.data.players[0].stats.assists.value='--';const result=normalizeProviderPlayerStats(raw,game,context);expect(result.ok).toBe(true);if(result.ok){expect(result.snapshot.players[0].assists).toBeNull();expect(result.snapshot.players[1].points).toBe(0);}});
it('request-match mismatch cannot be reassigned by the body',()=>expect(normalizeProviderPlayerStats(simulatedEnvelope(),game,{...context,requestedMatchId:'different'}).ok).toBe(false));
it('dry run preserves stronger existing snapshots without parsing or replacing them',()=>{const out=dryRunRecovery({version:1,games:[game]},[],new Set([game.nbaGameId]));expect(out).toEqual({mode:'offline-dry-run',networkRequests:0,accepted:[],rejected:[],preservedVerified:[game.nbaGameId]});});
it('dry run accepts consistent captured data with no requests',()=>{const out=dryRunRecovery({version:1,games:[game]},[{nbaGameId:game.nbaGameId,requestedMatchId:game.providerMatchId,retrievedAt:box.retrievedAt,httpStatus:200,body:simulatedEnvelope()}],new Set());expect(out.accepted).toHaveLength(1);expect(out.networkRequests).toBe(0);});
it('missing, failed or duplicate captures cannot silently become data',()=>{const base={nbaGameId:game.nbaGameId,requestedMatchId:game.providerMatchId,retrievedAt:box.retrievedAt,httpStatus:503,body:null};for(const captures of[[],[base],[base,base]]){const out=dryRunRecovery({version:1,games:[game]},captures,new Set());expect(out.accepted).toHaveLength(0);expect(out.rejected).toHaveLength(1);}});

it.each(['available','players_available','team_stats_available'] as const)('distinguishes false and malformed %s without accepting either',flag=>{const raw=simulatedEnvelope();Reflect.set(raw.meta,flag,false);expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:`flag-${flag}-false`});Reflect.set(raw.meta,flag,'true');expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:`flag-${flag}-missing-or-invalid`});Reflect.deleteProperty(raw.meta,flag);expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:`flag-${flag}-missing-or-invalid`});});
it.each(['players','team_stats'] as const)('rejects invalid withheld %s without zero coercion',field=>{const raw=simulatedEnvelope();Reflect.set(raw.meta.withheld,field,'0');expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:`withheld-${field}-missing-or-invalid`});});
it.each([[null,'malformed-envelope'],[{data:null},'malformed-data'],[{data:{}},'malformed-meta'],[{data:{},meta:{available:true,players_available:true,team_stats_available:true}},'withheld-missing-or-malformed']])('distinguishes structural metadata failure safely', (raw,reason)=>expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason}));

it('accepts complete synthetic player data with three withheld team values without publishing team aggregates',()=>{
  const baseline=normalizeProviderPlayerStats(simulatedEnvelope(),game,context);
  expect(baseline.ok).toBe(true);
  const raw=simulatedEnvelope();
  raw.meta.withheld.team_stats=3;
  Reflect.set(raw.data.team_stats[0],'display_value','UNPUBLISHED_TEAM_AGGREGATE');
  const result=normalizeProviderPlayerStats(raw,game,context);
  expect(result).toEqual(baseline);
  expect(JSON.stringify(result)).not.toContain('UNPUBLISHED_TEAM_AGGREGATE');
});
it('still rejects positive player withholding with three withheld team values',()=>{
  const raw=simulatedEnvelope();raw.meta.withheld.team_stats=3;raw.meta.withheld.players=1;
  expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:'withheld-players-positive'});
});
it.each([undefined,null,'3',-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects malformed withheld team count %s',value=>{
  const raw=simulatedEnvelope();Reflect.set(raw.meta.withheld,'team_stats',value);
  expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:'withheld-team_stats-missing-or-invalid'});
});
it('rejects a missing withheld team count',()=>{
  const raw=simulatedEnvelope();Reflect.deleteProperty(raw.meta.withheld,'team_stats');
  expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:'withheld-team_stats-missing-or-invalid'});
});
it.each(['missing','one-side','contradictory','unknown'] as const)('does not relax %s team identity when team values are withheld',kind=>{
  const raw=simulatedEnvelope();raw.meta.withheld.team_stats=3;
  if(kind==='missing')raw.data.team_stats=[];
  if(kind==='one-side')raw.data.team_stats.pop();
  if(kind==='contradictory')raw.data.team_stats[0].team_name='Boston Celtics';
  if(kind==='unknown')raw.data.team_stats[0].team_name='Unknown';
  expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:kind==='missing'||kind==='one-side'?'incomplete-team-identity':'team-identity-mismatch'});
});
it.each(['flag','player-math','total'] as const)('keeps the %s validation with positive team withholding',kind=>{
  const raw=simulatedEnvelope();raw.meta.withheld.team_stats=3;
  if(kind==='flag')raw.meta.team_stats_available=false;
  if(kind==='player-math')raw.data.players[0].stats.points.value='999';
  if(kind==='total')raw.data.players.pop();
  expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:kind==='flag'?'flag-team_stats_available-false':kind==='player-math'?'inconsistent-player-points':'incomplete-or-mismatched-points-total'});
});
it.each(['same-name','changed-name-same-uuid','case-normalized'])('incoming known quarantined identity is withheld: %s',kind=>{
 const raw=simulatedEnvelope();Object.assign(raw.data.players[0],{name:kind==='same-name'?'Drew Doughty':kind==='case-normalized'?'  drew doughty  ':'Jrue Holiday',id:kind==='changed-name-same-uuid'?'BCC566FC-5452-4681-AB41-B042FAE11E53':undefined});expect(normalizeProviderPlayerStats(raw,game,context)).toEqual({ok:false,reason:'quarantined-player-identity'});
});
it('ordinary players and similar words are not mistaken for the quarantined identity',()=>{
 const raw=simulatedEnvelope();raw.data.players[0].name='Jrue Holiday';expect(normalizeProviderPlayerStats(raw,game,context).ok).toBe(true);raw.data.players[0].name='Drew Eubanks';expect(normalizeProviderPlayerStats(raw,game,context).ok).toBe(true);
});
