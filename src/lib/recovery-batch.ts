import { resolveRecoveryCandidate, type RecoveryTarget, type RecoveryListPage } from "./recovery-candidates";
import { normalizeProviderPlayerStats, type ProviderBasicSnapshot } from "./provider-player-normalizer";
import type { createRecoveryProviderClient } from "./recovery-provider-client";

export async function runRecoveryBatch(targets:RecoveryTarget[],client:ReturnType<typeof createRecoveryProviderClient>,maxRequests:number,verifiedIds:ReadonlySet<string>,existingMatches:ReadonlyMap<string,string>=new Map()) {
  const accepted:ProviderBasicSnapshot[]=[],rejected:{gameId:string;reason:string}[]=[];
  const pages=new Map<string,RecoveryListPage>();const matched=new Map(existingMatches);let cursor:string|null=null;
  for(const target of targets){
    if(verifiedIds.has(target.nbaGameId))continue;
    if(client.requestsMade>=maxRequests)break;
    let transportFailed=false;
    for(const date of target.lookupDates){
      if(pages.has(date))continue;
      const result=await client.getMatches(date);
      if(!result.ok){rejected.push({gameId:target.nbaGameId,reason:`provider-list-${result.reason ?? 'unavailable'}${result.httpStatus===undefined?'':`-http-${result.httpStatus}`}`});transportFailed=true;break;}
      pages.set(date,{requestedDate:date,body:result.body});
    }
    if(transportFailed)break;
    const candidate=resolveRecoveryCandidate(target,target.lookupDates.map(date=>pages.get(date)!));
    if(!candidate.ok){cursor=target.nbaGameId;rejected.push({gameId:target.nbaGameId,reason:candidate.reason});continue;}
    const owner=matched.get(candidate.game.providerMatchId);
    if(owner&&owner!==target.nbaGameId){cursor=target.nbaGameId;rejected.push({gameId:target.nbaGameId,reason:'provider-match-already-assigned'});continue;}
    const result=await client.getStats(candidate.game.providerMatchId);
    if(!result.ok||!result.retrievedAt){rejected.push({gameId:target.nbaGameId,reason:`provider-stats-${result.reason ?? 'unavailable'}${result.httpStatus===undefined?'':`-http-${result.httpStatus}`}`});break;}
    const normalized=normalizeProviderPlayerStats(result.body,candidate.game,{requestedMatchId:result.requestedMatchId,retrievedAt:result.retrievedAt,retrievedAtPrecision:'exact'});
    cursor=target.nbaGameId;
    if(normalized.ok){accepted.push(normalized.snapshot);matched.set(candidate.game.providerMatchId,target.nbaGameId);}
    else rejected.push({gameId:target.nbaGameId,reason:normalized.reason});
  }
  return {accepted,rejected,cursor,requests:client.requestsMade};
}
