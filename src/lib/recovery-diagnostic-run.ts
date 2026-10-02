import{selectRecoveryTargets}from'./recovery-target-selection';
import{resolveRecoveryCandidate,type RecoveryListPage}from'./recovery-candidates';
import{normalizeProviderPlayerStats}from'./provider-player-normalizer';
import{diagnoseRecoveryMetadata}from'./recovery-metadata-diagnostic';
import type{createRecoveryProviderClient}from'./recovery-provider-client';
export async function runPlayoffMetadataDiagnostic(schedule:unknown,client:ReturnType<typeof createRecoveryProviderClient>){
 const nbaGameId='0042500405';
 const target=selectRecoveryTargets(schedule,new Set(),null,20).find(game=>game.nbaGameId===nbaGameId);
 if(!target)throw new Error('Diagnostic target is not in the validated playoff schedule');
 const pages:RecoveryListPage[]=[];
 for(const date of target.lookupDates){
  const result=await client.getMatches(date);
  if(!result.ok)return{nbaGameId,requests:client.requestsMade,stage:'date-list',reason:result.reason,httpStatus:result.httpStatus??null};
  pages.push({requestedDate:date,body:result.body});
 }
 const matched=resolveRecoveryCandidate(target,pages);
 if(!matched.ok)return{nbaGameId,requests:client.requestsMade,stage:'candidate',reason:matched.reason};
 const result=await client.getStats(matched.game.providerMatchId);
 if(!result.ok||!result.retrievedAt)return{nbaGameId,requests:client.requestsMade,stage:'stats',reason:result.reason,httpStatus:result.httpStatus??null};
 const normalized=normalizeProviderPlayerStats(result.body,matched.game,{requestedMatchId:result.requestedMatchId,retrievedAt:result.retrievedAt,retrievedAtPrecision:'exact'});
 return{nbaGameId,providerMatchId:matched.game.providerMatchId,requests:client.requestsMade,stage:'metadata',httpStatus:result.httpStatus??null,normalized:normalized.ok,reason:normalized.ok?null:normalized.reason,metadata:diagnoseRecoveryMetadata(result.body)};
}
