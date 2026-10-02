import { parseRecoveryManifest } from './recovery-manifest';
import type { ProviderBasicSnapshot,ProviderPlayerLine } from './provider-player-normalizer';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const nullable=(v:unknown)=>v===null||count(v);
const fields=['minutesRounded','rebounds','assists','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds','defensiveRebounds','steals','blocks','turnovers','fouls'];
export function validateProviderPlayerSnapshot(raw:unknown):ProviderBasicSnapshot|null{
 if(!object(raw)||raw.version!==1||raw.provider!=='BigBallsData'||raw.coverage!=='provider-basic-unassigned'||typeof raw.retrievedAt!=='string'||!Number.isFinite(Date.parse(raw.retrievedAt))||!['exact','approximate-minute','unspecified'].includes(String(raw.retrievedAtPrecision))||!object(raw.validation)||raw.validation.officialReportChecked!==false||raw.validation.historicalTeams!=='unassigned'||!Array.isArray(raw.players)||!raw.players.length)return null;
 const parsed=parseRecoveryManifest({version:1,games:[raw.game]});if(!parsed.ok)return null;const game=parsed.manifest.games[0];
 const names=new Set<string>();let total=0;
 for(const p of raw.players){
  if(!object(p)||typeof p.name!=='string'||!p.name.trim()||names.has(p.name.trim().toLowerCase())||p.team!==null||!(p.providerPlayerId===null||(typeof p.providerPlayerId==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.providerPlayerId)))||!count(p.points)||!fields.every(k=>nullable(p[k]))||!(p.plusMinus===null||(typeof p.plusMinus==='number'&&Number.isSafeInteger(p.plusMinus)))||!(p.starter===null||typeof p.starter==='boolean'))return null;
  names.add(p.name.trim().toLowerCase());total+=p.points;
  for(const[m,a]of[['fieldGoalsMade','fieldGoalsAttempted'],['threePointersMade','threePointersAttempted'],['freeThrowsMade','freeThrowsAttempted']])if(count(p[m])&&count(p[a])&&p[m]>p[a])return null;
  if(count(p.threePointersMade)&&count(p.fieldGoalsMade)&&p.threePointersMade>p.fieldGoalsMade)return null;
  if(count(p.threePointersAttempted)&&count(p.fieldGoalsAttempted)&&p.threePointersAttempted>p.fieldGoalsAttempted)return null;
  if(count(p.fieldGoalsMade)&&count(p.threePointersMade)&&count(p.freeThrowsMade)&&2*p.fieldGoalsMade+p.threePointersMade+p.freeThrowsMade!==p.points)return null;
  if(count(p.rebounds)&&count(p.offensiveRebounds)&&count(p.defensiveRebounds)&&p.offensiveRebounds+p.defensiveRebounds!==p.rebounds)return null;
 }
 if(!Number.isSafeInteger(total)||total!==game.home.score+game.away.score||total!==raw.validation.combinedPoints)return null;
 return {version:1,provider:'BigBallsData',coverage:'provider-basic-unassigned',game,retrievedAt:raw.retrievedAt,retrievedAtPrecision:raw.retrievedAtPrecision as ProviderBasicSnapshot['retrievedAtPrecision'],players:raw.players as ProviderPlayerLine[],validation:{combinedPoints:total,historicalTeams:'unassigned',officialReportChecked:false}};
}
